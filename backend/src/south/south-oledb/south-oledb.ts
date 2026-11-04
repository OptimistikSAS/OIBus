import { DateTime } from 'luxon';

import { OIBusContent, OIBusRecord } from '../../../shared/model/common/content.model';
import { Instant } from '../../../shared/model/common/types';
import {
  SouthItemSettings,
  SouthOLEDBItemSettings,
  SouthOLEDBItemSettingsTrackingInstantDateTimeInput,
  SouthOLEDBSettings
} from '../../../shared/model/connector/south-settings.model';
import { OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/domain/south-connector.model';

import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { encryptionService } from '../../service/encryption.service';
import {
  convertDateTimeToInstant,
  formatInstant,
  getErrorMessage,
  getSqlQueryTimeVariablesUsage,
  logQuery,
  QueryTimeVariablesUsage,
  workUnitLogCtx
} from '../../service/utils';
import SouthConnector from '../south-connector';
import { SouthHistoryQuery } from '../south-interface';
import { loadOleDb, OleDbColumnType, OleDbConnection, OleDbQueryResult } from './oledb-loader';

// Upper bound of maxParallelRun, as in the manifest.
const MAX_PARALLEL_RUN_CEILING = 8;

/**
 * Class SouthOLEDB - Retrieve data from SQL databases with an OLE DB provider and send them to the cache as record-list
 * content.
 *
 * Windows-only: queries go through `@oibus/oledb` (https://github.com/OptimistikSAS/oibus-oledb), a standalone package
 * that spawns and multiplexes a bundled .NET helper process (System.Data.OleDb). The OLE DB provider named in the
 * connection string is not bundled: it must be installed, in its 64-bit version, on the machine running OIBus. The
 * package owns the helper process and the timeouts; this class owns its connections and its reconnection policy
 * (`retryInterval`).
 *
 * An OLE DB connection runs one query at a time: the connector keeps a pool of connections, one per query running in
 * parallel (up to `maxParallelRun`), opened when needed and kept open between runs.
 */
export default class SouthOLEDB extends SouthConnector<SouthOLEDBSettings, SouthOLEDBItemSettings> implements SouthHistoryQuery {
  // Every open connection of the pool, idle or running a query
  private readonly connections = new Set<OleDbConnection>();
  private idleConnections: Array<OleDbConnection> = [];
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings>,
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

  /**
   * Each query runs on its own connection of the pool: work-units can query in parallel.
   */
  protected override getMaxParallelRun(): number {
    return Math.max(1, Math.min(this.connector.settings.maxParallelRun, MAX_PARALLEL_RUN_CEILING));
  }

  /**
   * Opens a first connection, checking that the data source is reachable before the queries are scheduled, and keeps it
   * in the pool for them.
   */
  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      const connectStart = DateTime.now().toMillis();
      const connection = await this.acquireConnection();
      this.releaseConnection(connection);
      this.logger.info(`Connected to ${this.describe(connection)} in ${DateTime.now().toMillis() - connectStart} ms`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(
        `Error while connecting to the OLE DB data source. Reconnecting in ${this.connector.settings.retryInterval} ms. ${getErrorMessage(error)}`
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
    if (this.connections.size > 0) {
      const disconnectStart = DateTime.now().toMillis();
      const closed = await Promise.all(Array.from(this.connections).map(connection => this.closeConnection(connection)));
      if (closed.every(Boolean)) {
        this.logger.info(`Disconnected from the OLE DB data source in ${DateTime.now().toMillis() - disconnectStart} ms`);
      }
    }
    await super.disconnect();
    this.disconnecting = false;
  }

  /**
   * An idle connection of the pool, or a new one. After a failed query, its connection is closed and a new one is
   * opened by the next run (see `historyQuery`), without going through `connect()`, which would signal a new connection
   * to the engine (and start a history query run again).
   */
  private async acquireConnection(): Promise<OleDbConnection> {
    const idle = this.idleConnections.pop();
    if (idle) {
      return idle;
    }
    const connection = await this.openConnection();
    this.connections.add(connection);
    return connection;
  }

  /** Gives a connection back to the pool, unless it was closed in the meantime (by a disconnection) */
  private releaseConnection(connection: OleDbConnection): void {
    if (this.connections.has(connection)) {
      this.idleConnections.push(connection);
    }
  }

  /** Closes a connection and removes it from the pool, returning whether it closed without error */
  private async closeConnection(connection: OleDbConnection): Promise<boolean> {
    this.connections.delete(connection);
    this.idleConnections = this.idleConnections.filter(idle => idle !== connection);
    try {
      await connection.disconnect();
      return true;
    } catch (error: unknown) {
      this.logger.error(`Error while disconnecting from the OLE DB data source: ${getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * A throwaway connection, isolated from the pool: a running connector's own connections are never touched by a
   * connection test.
   */
  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const connectStart = DateTime.now().toMillis();
    const connection = await this.openConnection();
    this.logger.info(`Connected to ${this.describe(connection)} in ${DateTime.now().toMillis() - connectStart} ms`);
    await connection.disconnect();
    const { provider, dataSource, database, serverVersion } = connection.info;
    return {
      items: [
        { key: 'Provider', value: provider },
        { key: 'Data source', value: dataSource },
        { key: 'Database', value: database },
        { key: 'Version', value: serverVersion }
      ].filter(item => item.value)
    };
  }

  /**
   * Uses a throwaway connection, isolated from the pool: a running connector's own connections are never touched by
   * testing an item from the UI.
   */
  override async testItem(
    item: SouthConnectorItemEntity<SouthOLEDBItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;

    const connectStart = DateTime.now().toMillis();
    const connection = await this.openConnection();
    const connectionDuration = DateTime.now().toMillis() - connectStart;

    try {
      const queryStart = DateTime.now().toMillis();
      const { records } = await this.queryData(connection, item, startTime, endTime);
      const queryDuration = DateTime.now().toMillis() - queryStart;
      return { result: { type: 'record-list', content: records }, connectionDuration, queryDuration };
    } finally {
      await connection.disconnect().catch((error: unknown) => {
        this.logger.error(`Error while disconnecting the test connection: ${getErrorMessage(error)}`);
      });
    }
  }

  protected override getHistoryQueryTimeVariablesUsage(lead: SouthConnectorItemEntity<SouthOLEDBItemSettings>): QueryTimeVariablesUsage {
    return getSqlQueryTimeVariablesUsage(lead.settings.query);
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query) and send them to the cache
   * as record-list content.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOLEDBItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: OIBusRecord | null }> {
    const connection = await this.acquireConnection();
    const item = items[0];
    const logCtx = workUnitLogCtx(items);

    const startRequest = DateTime.now();
    let result: { records: Array<OIBusRecord>; trackedInstant: Instant | null };
    try {
      result = await this.queryData(connection, item, startTime, endTime);
    } catch (error: unknown) {
      // Logged by the caller with the item's context. A failed query may come from a lost connection, or leave the
      // connection unusable (a query cancelled after its timeout): it is closed, the next run opens a new one.
      await this.closeConnection(connection);
      throw error;
    }
    this.releaseConnection(connection);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

    const { records, trackedInstant } = result;
    if (records.length > 0) {
      this.logger.info(logCtx, `Found ${records.length} results in ${requestDuration} ms`);
      await this.addContent({ type: 'record-list', content: records }, startRequest.toUTC().toISO(), items);
    } else {
      this.logger.debug(logCtx, `No result found. Request done in ${requestDuration} ms`);
    }

    return { trackedInstant, value: records.length > 0 ? records[records.length - 1] : null };
  }

  /**
   * Apply the SQL query with the OLE DB provider. Only `@StartTime`/`@EndTime` query parameters are formatted, using the
   * tracking field's `dateTimeInput` config so they match the source column's native representation. The tracking
   * field of the returned records is converted to an ISO string in UTC (see `trackInstants`).
   */
  async queryData(
    connection: OleDbConnection,
    item: SouthConnectorItemEntity<SouthOLEDBItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ records: Array<OIBusRecord>; trackedInstant: Instant | null }> {
    const dateTimeInput = item.settings.trackingInstant?.trackInstant ? item.settings.trackingInstant.dateTimeInput : null;
    const oleStartTime = dateTimeInput == null ? startTime : formatInstant(startTime, dateTimeInput);
    const oleEndTime = dateTimeInput == null ? endTime : formatInstant(endTime, dateTimeInput);
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, `${oleStartTime}`).replace(/@EndTime/g, `${oleEndTime}`);
    logQuery(adaptedQuery, oleStartTime, oleEndTime, this.logger, workUnitLogCtx([item]));

    const result = await connection.query(adaptedQuery, { timeout: this.connector.settings.requestTimeout });
    return this.trackInstants(item, result);
  }

  /**
   * Converts the tracking field of every record to an ISO string in UTC, and returns the max instant found, used as the
   * cursor of the next incremental query. Records are otherwise left as the provider returned them.
   *
   * A date time column of the provider (an ISO string, or a SQL one) has no time zone: it is read in the timezone of
   * the item's `dateTimeInput` (UTC when it has none), and its format is ignored. A date time column with an offset is read as is. Any other
   * column (strings, numbers) is converted according to the `dateTimeInput`. A value that cannot be converted is
   * replaced by null and not tracked.
   */
  private trackInstants(
    item: SouthConnectorItemEntity<SouthOLEDBItemSettings>,
    result: OleDbQueryResult
  ): { records: Array<OIBusRecord>; trackedInstant: Instant | null } {
    if (!item.settings.trackingInstant?.trackInstant) {
      return { records: result.records, trackedInstant: null };
    }

    const fieldName = item.settings.trackingInstant.fieldName!;
    const dateTimeInput = item.settings.trackingInstant.dateTimeInput!;
    const columnType = result.columns.find(column => column.name === fieldName)?.type;
    let trackedInstant: Instant | null = null;
    let conversionError: string | null = null;
    for (const record of result.records) {
      const rawValue = record[fieldName];
      if (rawValue === null || rawValue === undefined || rawValue === '') continue;
      let instant: Instant | null;
      try {
        instant = this.toInstant(rawValue, columnType, dateTimeInput);
      } catch (error: unknown) {
        conversionError ??= getErrorMessage(error);
        instant = null;
      }
      record[fieldName] = instant;
      if (instant && (!trackedInstant || instant > trackedInstant)) {
        trackedInstant = instant;
      }
    }
    if (conversionError) {
      this.logger.warn(workUnitLogCtx([item]), `Could not convert the values of the tracking field "${fieldName}": ${conversionError}`);
    }
    return { records: result.records, trackedInstant };
  }

  private toInstant(
    value: string | number | boolean,
    columnType: OleDbColumnType | undefined,
    dateTimeInput: SouthOLEDBItemSettingsTrackingInstantDateTimeInput
  ): Instant | null {
    if (typeof value === 'string' && (columnType === 'datetime' || columnType === 'datetimeoffset')) {
      const zone = dateTimeInput.timezone ?? 'UTC';
      const isoDateTime = DateTime.fromISO(value, { zone });
      const dateTime = isoDateTime.isValid ? isoDateTime : DateTime.fromSQL(value, { zone });
      if (!dateTime.isValid) {
        throw new Error(`Invalid date time "${value}"`);
      }
      return dateTime.toUTC().toISO();
    }
    if (typeof value === 'boolean') {
      throw new Error(`Invalid date time "${value}"`);
    }
    return convertDateTimeToInstant(value, dateTimeInput) || null;
  }

  /**
   * `@oibus/oledb` is an optional, Windows-only dependency (see oledb-loader.ts): it is not installed on other
   * platforms, where any connection attempt fails here.
   */
  private async openConnection(): Promise<OleDbConnection> {
    const oledb = loadOleDb();
    if (!oledb) {
      throw new Error('OLE DB library not available: the OLEDB south connector only runs on Windows');
    }
    const { connectionString, logValue } = await this.buildConnectionString(this.connector.settings);
    this.logger.debug(`Connecting to the OLE DB data source with "${logValue}"`);
    return oledb.OleDbConnection.connect(connectionString, { connectionTimeout: this.connector.settings.connectionTimeout });
  }

  private describe(connection: OleDbConnection): string {
    const { provider, dataSource, database } = connection.info;
    return `the OLE DB data source ${dataSource}${database ? `/${database}` : ''} (provider ${provider})`;
  }

  private async buildConnectionString(settings: SouthOLEDBSettings): Promise<{ connectionString: string; logValue: string }> {
    let connectionString = settings.connectionString.trimEnd();
    let logValue = connectionString;

    if (settings.password) {
      if (!connectionString.endsWith(';')) {
        connectionString += ';';
        logValue += ';';
      }
      const decryptedPassword = await encryptionService.decryptText(settings.password);
      connectionString += `Password=${decryptedPassword};`;
      logValue += 'Password=<secret>;';
    }

    return { connectionString, logValue };
  }
}
