import SouthConnector from '../south-connector';
import { Aggregate, Instant, Resampling } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { SouthHistoryQuery } from '../south-interface';
import { SouthItemSettings, SouthOPCItemSettings, SouthOPCSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { OpcAgent, OpcClient, type OpcItemRef, type OpcValue } from '@optimistik/opc-classic';
import type { ILogger } from '../../model/logger.model';

/**
 * Map OPC HDA aggregate string names to the native OpcNetApi AggregateID
 * integer. 0 = raw (ReadRaw); 1..24 dispatch to ReadProcessed.
 */
const AGGREGATE_IDS: Record<string, number> = {
  raw: 0,
  interpolative: 1,
  total: 2,
  average: 3,
  'time-average': 4,
  count: 5,
  stdev: 6,
  'minimum-actual-time': 7,
  minimum: 8,
  'maximum-actual-time': 9,
  maximum: 10,
  start: 11,
  end: 12,
  delta: 13,
  'reg-slope': 14,
  'reg-const': 15,
  'reg-dev': 16,
  variance: 17,
  range: 18,
  'duration-good': 19,
  'duration-bad': 20,
  'percent-good': 21,
  'percent-bad': 22,
  'worst-quality': 23,
  annotations: 24
};

/** Decimal seconds for each HDA resampling option. */
const RESAMPLING_SECONDS: Record<string, number> = {
  none: 0,
  '1s': 1,
  '10s': 10,
  '30s': 30,
  '1min': 60,
  '1h': 3600,
  '1d': 86400
};

const MAX_READ_VALUES = 3600;
const INTERVAL_READ_DELAY_MS = 200;

/**
 * Class SouthOPC — Spawns the bundled OPC Classic agent as a subprocess and
 * controls it over NDJSON JSON-RPC on stdio. The agent itself is shipped by
 * the `@optimistik/opc-classic` npm package; this connector owns its lifecycle.
 */
export default class SouthOPC extends SouthConnector<SouthOPCSettings, SouthOPCItemSettings> implements SouthHistoryQuery {
  private agent: OpcAgent | null = null;
  private client: OpcClient | null = null;
  private connected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthOPCSettings, SouthOPCItemSettings>,
    engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: ILogger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      this.ensureAgent();
      await this.client!.connect({
        connectorId: this.connector.id,
        host: this.connector.settings.host,
        serverName: this.connector.settings.serverName,
        mode: this.connector.settings.mode
      });
      this.connected = true;
      await super.connect();
    } catch (error) {
      this.logger.error(
        `Error while connecting to OPC agent. Reconnecting in ${this.connector.settings.retryInterval} ms. ${error}`
      );
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    const agent = new OpcAgent();
    agent.start();
    const client = new OpcClient(agent);
    const testId = `${this.connector.id}-test`;
    try {
      await client.connect({
        connectorId: testId,
        host: this.connector.settings.host,
        serverName: this.connector.settings.serverName,
        mode: this.connector.settings.mode
      });
      const status = await client.status(testId);
      this.logger.info(`OPC server info: ${JSON.stringify(status)}`);
      await client.disconnect(testId);
    } finally {
      await agent.stop();
    }
    return { items: [] };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOPCItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    const agent = new OpcAgent();
    agent.start();
    const client = new OpcClient(agent);
    const testId = `${this.connector.id}-test`;
    const collected: Array<OIBusTimeValue> = [];

    try {
      await client.connect({
        connectorId: testId,
        host: this.connector.settings.host,
        serverName: this.connector.settings.serverName,
        mode: this.connector.settings.mode
      });

      const handler = {
        onValues: (values: Array<OpcValue>) => {
          for (const v of values) collected.push(toOIBusTimeValue(v));
        }
      };

      if (this.connector.settings.mode === 'da') {
        await client.daRead(
          { connectorId: testId, items: [{ name: item.name, nodeId: item.settings.nodeId }] },
          handler
        );
      } else {
        await client.hdaRead(
          {
            connectorId: testId,
            startTime: testingSettings.history!.startTime,
            endTime: testingSettings.history!.endTime,
            aggregateId: AGGREGATE_IDS[item.settings.aggregate] ?? 0,
            resamplingInterval: RESAMPLING_SECONDS[item.settings.resampling ?? 'none'] ?? 0,
            maxReadValues: MAX_READ_VALUES,
            intervalReadDelay: INTERVAL_READ_DELAY_MS,
            items: [{ name: item.name, nodeId: item.settings.nodeId }]
          },
          handler
        );
      }

      await client.disconnect(testId);
    } finally {
      await agent.stop();
    }
    return { type: 'time-values', content: collected };
  }

  /**
   * Pull data for the given interval. In HDA mode, items are grouped by
   * (aggregate, resampling) to minimise round-trips. In DA mode, the interval
   * is ignored and a single snapshot is read for all items.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOPCItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    // Wrapped in an object so the closures inside onValues can mutate it
    // without TypeScript losing the type narrowing after the await.
    const state: { maxInstantRetrieved: Instant | null; recordCount: number } = {
      maxInstantRetrieved: null,
      recordCount: 0
    };

    try {
      if (this.connector.settings.mode === 'da') {
        const opcItems: Array<OpcItemRef> = items.map(it => ({ name: it.name, nodeId: it.settings.nodeId }));
        const queryStart = DateTime.now();
        await this.client!.daRead(
          { connectorId: this.connector.id, items: opcItems },
          {
            onValues: async values => {
              if (values.length === 0) return;
              state.recordCount += values.length;
              for (const v of values) {
                if (!state.maxInstantRetrieved || v.timestamp > state.maxInstantRetrieved) state.maxInstantRetrieved = v.timestamp;
              }
              await this.addContent(
                { type: 'time-values', content: values.map(toOIBusTimeValue) },
                queryStart.toUTC().toISO()!,
                items
              );
            }
          }
        );
      } else {
        const groups = groupItemsByAggregate(items);
        for (const [aggregate, byResampling] of groups.entries()) {
          for (const [resampling, group] of byResampling.entries()) {
            this.logger.debug(
              `Requesting ${group.length} items with aggregate ${aggregate} and resampling ${resampling} between ${startTime} and ${endTime}`
            );
            const queryStart = DateTime.now();
            const groupItems = group.map(g => g.item);

            await this.client!.hdaRead(
              {
                connectorId: this.connector.id,
                startTime,
                endTime,
                aggregateId: AGGREGATE_IDS[aggregate] ?? 0,
                resamplingInterval: RESAMPLING_SECONDS[resampling] ?? 0,
                maxReadValues: MAX_READ_VALUES,
                intervalReadDelay: INTERVAL_READ_DELAY_MS,
                items: group.map(g => ({ name: g.item.name, nodeId: g.nodeId }))
              },
              {
                onValues: async values => {
                  if (values.length === 0) return;
                  state.recordCount += values.length;
                  for (const v of values) {
                    if (!state.maxInstantRetrieved || v.timestamp > state.maxInstantRetrieved) state.maxInstantRetrieved = v.timestamp;
                  }
                  await this.addContent(
                    { type: 'time-values', content: values.map(toOIBusTimeValue) },
                    queryStart.toUTC().toISO()!,
                    groupItems
                  );
                }
              }
            );
          }
        }
      }
    } catch (error) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        await this.connect();
      }
      throw error;
    }

    // 1ms past the last retrieved instant so we don't refetch it next interval.
    const trackedInstant =
      state.maxInstantRetrieved && state.maxInstantRetrieved > startTime
        ? DateTime.fromISO(state.maxInstantRetrieved).plus({ millisecond: 1 }).toUTC().toISO()
        : null;

    return {
      trackedInstant,
      value: { recordCount: state.recordCount, maxInstantRetrieved: state.maxInstantRetrieved }
    };
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connected && this.client) {
      try {
        await this.client.disconnect(this.connector.id);
      } catch (error) {
        this.logger.error(`Error while disconnecting OPC. ${error}`);
      }
    }

    if (this.agent) {
      try {
        await this.agent.stop();
      } catch (error) {
        this.logger.error(`Error while stopping OPC agent. ${error}`);
      }
      this.agent = null;
      this.client = null;
    }

    this.connected = false;
    await super.disconnect();
    this.disconnecting = false;
  }

  private ensureAgent(): void {
    if (this.agent && this.client) return;
    this.agent = new OpcAgent({
      onLog: (line: string) => this.logger.debug(`[opc-agent] ${line}`),
      onProtocolError: (err: Error) => this.logger.error(`OPC agent protocol error: ${err.message}`)
    });
    this.agent.start();
    this.client = new OpcClient(this.agent);
  }
}

function toOIBusTimeValue(v: OpcValue): OIBusTimeValue {
  return {
    pointId: v.pointId,
    timestamp: v.timestamp,
    data: { value: v.value, quality: v.quality }
  };
}

function groupItemsByAggregate(
  items: Array<SouthConnectorItemEntity<SouthOPCItemSettings>>
): Map<Aggregate, Map<Resampling, Array<{ nodeId: string; item: SouthConnectorItemEntity<SouthOPCItemSettings> }>>> {
  const out = new Map<Aggregate, Map<Resampling, Array<{ nodeId: string; item: SouthConnectorItemEntity<SouthOPCItemSettings> }>>>();
  for (const item of items) {
    const aggregate = item.settings.aggregate;
    const resampling = (item.settings.resampling ?? 'none') as Resampling;
    if (!out.has(aggregate)) out.set(aggregate, new Map());
    const inner = out.get(aggregate)!;
    if (!inner.has(resampling)) inner.set(resampling, []);
    inner.get(resampling)!.push({ nodeId: item.settings.nodeId, item });
  }
  return out;
}
