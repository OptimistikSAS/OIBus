import SouthConnector from '../south-connector';
import { convertDateTimeToInstant, formatInstant, getErrorMessage, logQuery, workUnitLogCtx } from '../../service/utils';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { SouthHistoryQuery } from '../south-interface';
import { SouthItemSettings, SouthOLEDBItemSettings, SouthOLEDBSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusRecord } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { encryptionService } from '../../service/encryption.service';
import { OleDbConnection } from '@oibus/oledb-windows';

/**
 * Class SouthOLEDB - Retrieve data from SQL databases with an OLE DB driver and send the resulting
 * rows as record-list content to the cache, the same way south-mssql/south-mysql/etc. do. Row values
 * are passed through untouched — datetime parsing for display is the responsibility of the north-side
 * transformer (e.g. record-list-to-csv); the only datetime handling done here is tracking the
 * incremental cursor via `item.settings.trackingInstant`.
 *
 * Windows-only: queries go through `@oibus/oledb-windows` (backend/native/oledb-windows), a local
 * package that spawns and multiplexes a bundled .NET child process wrapping `System.Data.OleDb` — see
 * that package's README for why (COM-based, Windows-only, no maintained Node/COM bridge currently
 * builds on this project's Node/Windows toolchain). The package itself owns process lifecycle and
 * concurrency; this class only owns the connect/reconnect policy (`retryInterval`) for its own
 * connection.
 */
export default class SouthOLEDB extends SouthConnector<SouthOLEDBSettings, SouthOLEDBItemSettings> implements SouthHistoryQuery {
  private connection: OleDbConnection | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

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

  override async connect(): Promise<void> {
    try {
      this.logger.debug('Connecting to the OLE DB source');
      const connectStart = DateTime.now().toMillis();
      const { connectionString } = await this.buildConnectionString(this.connector.settings);
      this.connection = await OleDbConnection.connect(connectionString);
      this.logger.info(`Connected to the OLE DB source in ${DateTime.now().toMillis() - connectStart} ms`);
      await super.connect();
    } catch (error) {
      this.logger.error(
        `Error while connecting to the OLE DB source. Reconnecting in ${this.connector.settings.retryInterval} ms. ${getErrorMessage(error)}`
      );
      this.connection = null;
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = null;

    if (this.connection) {
      const connection = this.connection;
      this.connection = null;
      await connection.disconnect();
    }
    await super.disconnect();
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const { connectionString, logValue } = await this.buildConnectionString(this.connector.settings);
    this.logger.debug(`Testing connection to the OLE DB source with "${logValue}"`);
    const connection = await OleDbConnection.connect(connectionString);
    await connection.disconnect();
    return { items: [] };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOLEDBItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    const queryStart = DateTime.now().toMillis();
    const result = await this.queryData(item, startTime, endTime);
    const queryDuration = DateTime.now().toMillis() - queryStart;

    return {
      result: { type: 'record-list', content: result },
      // Connect + query happen together inside the query call above — splitting them would mean
      // refactoring a method the scheduled query path also uses, so connectionDuration stays 0 and
      // queryDuration covers the whole call.
      connectionDuration: 0,
      queryDuration
    };
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query) and send
   * them to the cache as record-list content.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOLEDBItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: OIBusRecord | null }> {
    const item = items[0];
    const logCtx = workUnitLogCtx(items);

    const startRequest = DateTime.now();
    const result = await this.queryData(item, startTime, endTime);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

    let updatedStartTime: Instant | null = null;
    if (result.length > 0) {
      this.logger.info(logCtx, `Found ${result.length} results in ${requestDuration} ms`);
      updatedStartTime = this.trackMaxInstant(item, result);
      await this.addContent({ type: 'record-list', content: result }, startRequest.toUTC().toISO(), items);
    } else {
      this.logger.debug(logCtx, `No result found. Request done in ${requestDuration} ms`);
    }

    return { trackedInstant: updatedStartTime, value: result.length > 0 ? result[result.length - 1] : null };
  }

  /**
   * Scan the rows for the configured tracking field and return the max Instant found, used as the
   * cursor for the next incremental query. Row values are otherwise left untouched.
   */
  private trackMaxInstant(item: SouthConnectorItemEntity<SouthOLEDBItemSettings>, rows: Array<OIBusRecord>): Instant | null {
    if (!item.settings.trackingInstant?.trackInstant) return null;

    const fieldName = item.settings.trackingInstant.fieldName!;
    let updatedStartTime: Instant | null = null;
    for (const row of rows) {
      const rawValue = row[fieldName];
      if (rawValue === null || rawValue === undefined) continue;
      const instant = convertDateTimeToInstant(rawValue as string | number, item.settings.trackingInstant.dateTimeInput!);
      if (instant && (!updatedStartTime || instant > updatedStartTime)) {
        updatedStartTime = instant;
      }
    }
    return updatedStartTime;
  }

  /**
   * Apply the SQL query to the OLE DB source through the local helper. Rows are returned as-is (no
   * datetime parsing/formatting) — only `@StartTime`/`@EndTime` are formatted, using the tracking
   * field's `dateTimeInput` config so they match the source column's native representation.
   */
  async queryData(
    item: SouthConnectorItemEntity<SouthOLEDBItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<OIBusRecord>> {
    if (!this.connection) {
      throw new Error('OLE DB source is not connected');
    }

    const dateTimeInput = item.settings.trackingInstant?.trackInstant ? item.settings.trackingInstant.dateTimeInput : null;
    const oleStartTime = dateTimeInput == null ? startTime : formatInstant(startTime, dateTimeInput);
    const oleEndTime = dateTimeInput == null ? endTime : formatInstant(endTime, dateTimeInput);
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, `${oleStartTime}`).replace(/@EndTime/g, `${oleEndTime}`);
    logQuery(adaptedQuery, oleStartTime, oleEndTime, this.logger, workUnitLogCtx([item]));

    const rows = await this.connection.read(adaptedQuery, this.connector.settings.requestTimeout);
    return rows as Array<OIBusRecord>;
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
