import { DateTime } from 'luxon';

import { OIBusContent, OIBusPointRecord } from '../../../shared/model/common/content.model';
import { Instant } from '../../../shared/model/common/types';
import { SouthItemSettings, SouthPIItemSettings, SouthPISettings } from '../../../shared/model/connector/south-settings.model';
import { OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/domain/south-connector.model';

import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { getErrorMessage, workUnitLogCtx } from '../../service/utils';
import SouthConnector from '../south-connector';
import { SouthHistoryQuery } from '../south-interface';
import { loadPi, PiConnection, PiPointValues, PiValue } from './pi-loader';

/**
 * Class SouthPI - Read the recorded values of a PI Data Archive and send them to the cache as record-list content.
 *
 * Windows-only: reads go through `@oibus/pi` (https://github.com/OptimistikSAS/oibus-pi), a standalone package that
 * spawns and multiplexes a bundled .NET Framework helper process. The helper contains no AVEVA file: it loads the AF
 * SDK of the PI AF Client installed on the machine running OIBus, and connects to a PI Data Archive of its known servers
 * table (the default one when no server name is set) with the Windows account running OIBus. The package owns the
 * helper process; this class owns its connection and its reconnection policy (`retryInterval`).
 */
export default class SouthPI extends SouthConnector<SouthPISettings, SouthPIItemSettings> implements SouthHistoryQuery {
  private connection: PiConnection | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthPISettings, SouthPIItemSettings>,
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

  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      const connectStart = DateTime.now().toMillis();
      this.connection = await this.openConnection();
      this.logger.info(`Connected to ${this.describe(this.connection)} in ${DateTime.now().toMillis() - connectStart} ms`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(
        `Error while connecting to the PI Data Archive. Reconnecting in ${this.connector.settings.retryInterval} ms. ${getErrorMessage(error)}`
      );
      // Guarded together (not just the reschedule): disconnect() resets `disconnecting` to false at its own end, so
      // calling it re-entrantly while an outer disconnect()/stop() is still in flight would cut that outer call's
      // "disconnecting" state short.
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  override async disconnect(): Promise<void> {
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
        this.logger.info(`Disconnected from the PI Data Archive in ${DateTime.now().toMillis() - disconnectStart} ms`);
      } catch (error: unknown) {
        this.logger.error(`Error while disconnecting from the PI Data Archive: ${getErrorMessage(error)}`);
      }
    }
    await super.disconnect();
    this.disconnecting = false;
  }

  /**
   * A throwaway connection: a running connector's own connection is never touched by a connection test.
   */
  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const connectStart = DateTime.now().toMillis();
    const connection = await this.openConnection();
    this.logger.info(`Connected to ${this.describe(connection)} in ${DateTime.now().toMillis() - connectStart} ms`);
    await connection.disconnect();
    const { name, version } = connection.info;
    return {
      items: [
        { key: 'Server', value: name },
        { key: 'Version', value: version }
      ].filter(item => item.value)
    };
  }

  /**
   * Uses a throwaway connection: a running connector's own connection is never touched by testing an item from the UI.
   */
  override async testItem(
    item: SouthConnectorItemEntity<SouthPIItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const connectStart = DateTime.now().toMillis();
    const connection = await this.openConnection();
    const connectionDuration = DateTime.now().toMillis() - connectStart;

    try {
      const queryStart = DateTime.now().toMillis();
      const { records } = await this.readRecords(connection, [item], testingSettings.history!.startTime, testingSettings.history!.endTime);
      const queryDuration = DateTime.now().toMillis() - queryStart;
      return { result: { type: 'record-list', content: records }, connectionDuration, queryDuration };
    } finally {
      await connection.disconnect().catch((error: unknown) => {
        this.logger.error(`Error while disconnecting the test connection: ${getErrorMessage(error)}`);
      });
    }
  }

  /**
   * Reads the recorded values of the items between startTime and endTime (both included) and sends them to the cache
   * as record-list content.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthPIItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: OIBusPointRecord | null }> {
    if (!this.connection) {
      throw new Error('Not connected to the PI Data Archive');
    }
    const logCtx = workUnitLogCtx(items);
    this.logger.debug(logCtx, `Requesting ${items.length} items between ${startTime} and ${endTime}`);

    const startRequest = DateTime.now();
    const { records, maxInstant } = await this.readRecords(this.connection, items, startTime, endTime);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

    if (records.length > 0) {
      this.logger.debug(logCtx, `Found ${records.length} results for ${items.length} items in ${requestDuration} ms`);
      await this.addContent({ type: 'record-list', content: records }, startRequest.toUTC().toISO(), items);
    } else {
      this.logger.debug(logCtx, `No result found. Request done in ${requestDuration} ms`);
    }

    // The values of the end of the time range are included: the next query starts just after the last value
    const trackedInstant = maxInstant ? DateTime.fromISO(maxInstant, { zone: 'utc' }).plus({ milliseconds: 1 }).toISO()! : null;
    return {
      trackedInstant: trackedInstant && trackedInstant > startTime ? trackedInstant : null,
      value: records.length > 0 ? records[records.length - 1] : null
    };
  }

  /**
   * Reads the values of the items in one call: the `point-id` items by point name, their records named after the item;
   * the `point-query` items by PI point query, their records named after each point found. The points not found and the
   * failed queries are logged, the other values are kept.
   */
  private async readRecords(
    connection: PiConnection,
    items: Array<SouthConnectorItemEntity<SouthPIItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ records: Array<OIBusPointRecord>; maxInstant: Instant | null }> {
    const logCtx = workUnitLogCtx(items);
    const pointItems = items.filter(item => item.settings.type === 'point-id' && item.settings.piPoint);
    const queryItems = items.filter(item => item.settings.type === 'point-query' && item.settings.piQuery);
    const points = Array.from(new Set(pointItems.map(item => item.settings.piPoint!)));
    const queries = Array.from(new Set(queryItems.map(item => item.settings.piQuery!)));

    const result = await connection.recordedValues(startTime, endTime, { points, queries });

    if (result.notFound.length > 0) {
      this.logger.warn(logCtx, `PI points not found: ${result.notFound.join(', ')}`);
    }
    if (result.pointsError) {
      this.logger.warn(logCtx, `Error with the query of ${points.length} items. ${result.pointsError}`);
    }
    const records: Array<OIBusPointRecord> = [];
    let maxInstant: Instant | null = null;
    const addRecords = (pointId: string, values: PiPointValues['values']) => {
      for (const { timestamp, value } of values) {
        records.push({ pointId, timestamp, value: toRecordValue(value) });
        if (!maxInstant || timestamp > maxInstant) {
          maxInstant = timestamp;
        }
      }
    };
    for (const pointValues of result.points) {
      for (const item of pointItems.filter(pointItem => pointItem.settings.piPoint === pointValues.name)) {
        addRecords(item.name, pointValues.values);
      }
    }
    for (const queryValues of result.queries) {
      if (queryValues.error) {
        const names = queryItems.filter(item => item.settings.piQuery === queryValues.query).map(item => item.name);
        this.logger.warn(logCtx, `Error with the query of item ${names.join(', ')}. ${queryValues.error}`);
      }
      for (const pointValues of queryValues.points) {
        addRecords(pointValues.point, pointValues.values);
      }
    }
    return { records, maxInstant };
  }

  /**
   * `@oibus/pi` is an optional, Windows-only dependency (see pi-loader.ts): it is not installed on other platforms,
   * where any connection attempt fails here.
   */
  private openConnection(): Promise<PiConnection> {
    const pi = loadPi();
    if (!pi) {
      throw new Error('PI library not available: the PI south connector only runs on Windows');
    }
    const serverName = this.connector.settings.serverName?.trim();
    this.logger.debug(serverName ? `Connecting to the PI Data Archive "${serverName}"` : 'Connecting to the default PI Data Archive');
    return pi.PiConnection.connect({ serverName: serverName || undefined });
  }

  private describe(connection: PiConnection): string {
    const { name, version } = connection.info;
    return `the PI Data Archive ${name}${version ? ` (version ${version})` : ''}`;
  }
}

/** Numbers and strings are kept; a missing value gives an empty string and a boolean its string */
function toRecordValue(value: PiValue): string | number {
  if (value === null) return '';
  return typeof value === 'boolean' ? String(value) : value;
}
