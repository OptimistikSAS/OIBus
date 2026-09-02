import SouthConnector from '../south-connector';
import { Aggregate, Instant, Resampling } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { SouthHistoryQuery } from '../south-interface';
import { SouthItemSettings, SouthOPCItemSettings, SouthOPCSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { getErrorMessage, workUnitLogCtx } from '../../service/utils';
import { OpcConnection, OpcRawValue } from '@oibus/opc-classic';

const MAX_READ_VALUES = 3600;
const INTERVAL_READ_DELAY_MS = 200;

/**
 * Class SouthOPC - Retrieve data from an OPC Classic (DA/HDA) server.
 *
 * Windows-only: queries go through `@oibus/opc-classic` (https://github.com/OptimistikSAS/opc-classic),
 * a standalone package that spawns and multiplexes a bundled .NET child process wrapping the
 * Quick.OpcNetApi/OpcComRcw DCOM interop libraries — see that package's README for why (DCOM/COM
 * interop is Windows-only, no maintained Node bridge). Each connection gets its own real OPC server
 * object on the helper side (see the package's `OpcConnection`), since different OPC
 * connectors can genuinely target different hosts/servers/modes. `connection.read()` returns just
 * the raw values found, or rejects outright on failure — building the `time-values` content, tracking
 * the incremental cursor, and logging a read failure are this class's job, the same division of
 * responsibility south-pi.ts uses for raw PI values. The package itself owns process lifecycle and
 * concurrency; this class only owns the connect/reconnect policy (`retryInterval`) for its own
 * connection.
 */
export default class SouthOPC extends SouthConnector<SouthOPCSettings, SouthOPCItemSettings> implements SouthHistoryQuery {
  private connection: OpcConnection | null = null;
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
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, cacheFolderPath);
  }

  async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      this.logger.debug(`Connecting to the OPC ${this.connector.settings.mode.toUpperCase()} server`);
      const connectStart = DateTime.now().toMillis();
      this.connection = await OpcConnection.connect(
        this.connector.settings.host,
        this.connector.settings.serverName,
        this.connector.settings.mode
      );
      const { vendorInfo, productVersion } = this.connection.serverInfo;
      this.logger.info(`Connected to the OPC server ${vendorInfo} (v${productVersion}) in ${DateTime.now().toMillis() - connectStart} ms`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(
        `Error while connecting to the OPC server. Reconnecting in ${this.connector.settings.retryInterval} ms. ${getErrorMessage(error)}`
      );
      // Guarded together (not just the reschedule): disconnect() resets `disconnecting` to false at
      // its own end, so calling it re-entrantly while an outer disconnect()/stop() is still in
      // flight would cut that outer call's "disconnecting" state short.
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    // A throwaway connection, isolated from the live `this.connection` — a running connector's own
    // session is never touched by a connection test.
    this.logger.debug(`Testing connection to the OPC ${this.connector.settings.mode.toUpperCase()} server`);
    const connectStart = DateTime.now().toMillis();
    const connection = await OpcConnection.connect(
      this.connector.settings.host,
      this.connector.settings.serverName,
      this.connector.settings.mode
    );
    const { vendorInfo, productVersion, serverState } = connection.serverInfo;
    this.logger.info(`Connected to the OPC server ${vendorInfo} (v${productVersion}) in ${DateTime.now().toMillis() - connectStart} ms`);
    await connection.disconnect();
    return {
      items: [
        { key: 'Vendor', value: vendorInfo },
        { key: 'Version', value: productVersion },
        { key: 'State', value: serverState }
      ]
    };
  }

  /**
   * Uses a throwaway connection, isolated from `this.connection` — a running connector's own session
   * is never touched by testing an item from the UI.
   */
  override async testItem(
    item: SouthConnectorItemEntity<SouthOPCItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;

    const connectStart = DateTime.now().toMillis();
    const connection = await OpcConnection.connect(
      this.connector.settings.host,
      this.connector.settings.serverName,
      this.connector.settings.mode
    );
    const connectionDuration = DateTime.now().toMillis() - connectStart;

    try {
      const queryStart = DateTime.now().toMillis();
      const values = await connection.read(startTime, endTime, [item.settings.nodeId], {
        aggregate: item.settings.aggregate,
        resampling: item.settings.resampling ?? 'none',
        maxReadValues: MAX_READ_VALUES,
        intervalReadDelay: INTERVAL_READ_DELAY_MS
      });
      const queryDuration = DateTime.now().toMillis() - queryStart;
      return { result: { type: 'time-values', content: toTimeValues(values, [item]) }, connectionDuration, queryDuration };
    } finally {
      await connection.disconnect().catch(error => {
        this.logger.error(`Error while disconnecting the test connection: ${getErrorMessage(error)}`);
      });
    }
  }

  /**
   * Get entries from the OPC server between startTime and endTime and send them to the cache.
   *
   * A single `read()` call only accepts one aggregate/resampling pair (an HDA-only concept; ignored
   * for a DA connection), so items are grouped by their own (aggregate, resampling) pair first, same
   * as the original agent-based version did — one read per group, not one per item.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOPCItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    if (!this.connection) {
      throw new Error('OPC server is not connected');
    }
    const logCtx = workUnitLogCtx(items);
    let updatedStartTime: Instant | null = null;
    let lastContent: Array<OIBusTimeValue> = [];

    try {
      for (const [aggregate, resampling, groupItems] of groupByAggregateAndResampling(items)) {
        this.logger.debug(
          logCtx,
          `Requesting ${groupItems.length} items with aggregate ${aggregate} and resampling ${resampling} between ${startTime} and ${endTime}`
        );
        const startRequest = DateTime.now();
        const values = await this.connection.read(
          startTime,
          endTime,
          groupItems.map(item => item.settings.nodeId),
          { aggregate, resampling, maxReadValues: MAX_READ_VALUES, intervalReadDelay: INTERVAL_READ_DELAY_MS }
        );
        const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

        const content = toTimeValues(values, groupItems);
        if (content.length > 0) {
          this.logger.debug(logCtx, `Found ${content.length} results for ${groupItems.length} items in ${requestDuration} ms`);

          // Join each returned value back to its item through the name-keyed map (toTimeValues sets
          // pointId to the item's name), then apply the item's per-item caching strategy against its
          // last cached state (batch-read once per sub-batch, not per value) before addContent. Only
          // items actually cached this cycle feed into lastContent/updatedStartTime below.
          const itemByName = new Map(groupItems.map(item => [item.name, item]));
          const valuePairs: Array<{ item: SouthConnectorItemEntity<SouthOPCItemSettings>; value: OIBusTimeValue }> = [];
          for (const value of content) {
            const item = itemByName.get(value.pointId);
            if (item) {
              valuePairs.push({ item, value });
            }
          }

          // applyCachingStrategy keeps its own in-call shadow up to date as entries are accepted, so
          // multiple points for the same pointId within one resampled/aggregate response batch
          // compare against each other correctly, not a stale pre-batch state.
          const cachedPairs = this.applyCachingStrategy(valuePairs, ({ item, value }) => ({
            item,
            value: value.data.value,
            timestamp: value.timestamp
          }));

          await this.addContent(
            { type: 'time-values', content: cachedPairs.map(({ value }) => value) },
            startRequest.toUTC().toISO(),
            cachedPairs.map(({ item }) => item)
          );
          const maxInstant = trackMaxInstant(values, startTime);
          if (maxInstant && maxInstant > startTime && (!updatedStartTime || maxInstant > updatedStartTime)) {
            updatedStartTime = maxInstant;
          }
          lastContent = cachedPairs.map(({ value }) => value);
        } else {
          this.logger.debug(logCtx, `No result found. Request done in ${requestDuration} ms`);
        }
      }
    } catch (error: unknown) {
      // The package never logs its own errors — see OpcConnection.read's doc comment — so this is
      // the only place a read failure's message actually reaches the logs. OPC/DCOM connections are
      // more prone to genuinely dropping than a typical DB/PI connection, so — matching the original
      // agent-based version's own resilience strategy — any read error here forces a reconnect rather
      // than assuming the connection is still good.
      this.logger.error(logCtx, `Error while querying the OPC server: ${getErrorMessage(error)}`);
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        await this.connect();
      }
      throw error;
    }
    return { trackedInstant: updatedStartTime, value: lastContent.length > 0 ? lastContent[lastContent.length - 1] : null };
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.connection) {
      const connection = this.connection;
      this.connection = null;
      const disconnectStart = DateTime.now().toMillis();
      try {
        await connection.disconnect();
        this.logger.info(`Disconnected from the OPC server in ${DateTime.now().toMillis() - disconnectStart} ms`);
      } catch (error) {
        this.logger.error(`Error while disconnecting from the OPC server: ${getErrorMessage(error)}`);
      }
    }
    await super.disconnect();
    this.disconnecting = false;
  }
}

/**
 * Groups items by their (aggregate, resampling) pair, preserving each group's item order. A single
 * `read()` call only accepts one pair for the whole batch, so items with different pairs can't share
 * a call — same constraint the original agent-based version had (aggregate/resampling live at the
 * request level, not per-item, on both the old HTTP protocol and the new package's protocol).
 */
function groupByAggregateAndResampling(
  items: Array<SouthConnectorItemEntity<SouthOPCItemSettings>>
): Array<[Aggregate, Resampling, Array<SouthConnectorItemEntity<SouthOPCItemSettings>>]> {
  const groups = new Map<string, [Aggregate, Resampling, Array<SouthConnectorItemEntity<SouthOPCItemSettings>>]>();
  for (const item of items) {
    const resampling = item.settings.resampling ?? 'none';
    const key = `${item.settings.aggregate}\0${resampling}`;
    const existing = groups.get(key);
    if (existing) {
      existing[2].push(item);
    } else {
      groups.set(key, [item.settings.aggregate, resampling, [item]]);
    }
  }
  return Array.from(groups.values());
}

/**
 * The helper returns each value's `nodeId` as the exact OPC item id the read was issued for — OPC
 * Classic items are always exact references (never a mask, unlike PI's `piQuery`) — so mapping it
 * back to the item's own `name` is a plain lookup, no ambiguity to handle.
 */
function toTimeValues(values: Array<OpcRawValue>, items: Array<SouthConnectorItemEntity<SouthOPCItemSettings>>): Array<OIBusTimeValue> {
  const nameByNodeId = new Map(items.map(item => [item.settings.nodeId, item.name]));
  return values.map(value => ({
    pointId: nameByNodeId.get(value.nodeId) ?? value.nodeId,
    timestamp: value.timestamp,
    data: { value: value.value, quality: value.quality }
  }));
}

/**
 * Scans the raw values for the max timestamp found, bumped by 1ms — mirroring
 * OIBusAgentWindows/Web/OPC/OPCService.cs's own maxInstant handling, so the next incremental query's
 * start time (exclusive-by-convention here) doesn't re-fetch the same last value again.
 */
function trackMaxInstant(values: Array<OpcRawValue>, fallback: Instant): Instant | null {
  if (values.length === 0) return null;
  let max = fallback;
  for (const value of values) {
    if (value.timestamp > max) {
      max = value.timestamp;
    }
  }
  return DateTime.fromISO(max).plus({ milliseconds: 1 }).toUTC().toISO();
}
