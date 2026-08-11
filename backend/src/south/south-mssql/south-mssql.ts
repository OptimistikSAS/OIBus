import mssql, { config } from 'mssql';

import SouthConnector from '../south-connector';
import { convertDateTimeToInstant, formatInstant, logQuery } from '../../service/utils';
import { encryptionService } from '../../service/encryption.service';
import { Instant } from '../../../shared/model/types';
import { SouthHistoryQuery } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthItemSettings, SouthMSSQLItemSettings, SouthMSSQLSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusRecord } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { OIBusTestingError } from '../../model/types';

/**
 * Class SouthMSSQL - Retrieve data from MSSQL databases and send the resulting rows as record-list
 * content to the cache. Row values are passed through untouched — datetime parsing for display is
 * the responsibility of the north-side transformer (e.g. record-list-to-csv); the only datetime
 * handling done here is tracking the incremental cursor via `item.settings.trackingInstant`.
 */
export default class SouthMSSQL extends SouthConnector<SouthMSSQLSettings, SouthMSSQLItemSettings> implements SouthHistoryQuery {
  constructor(
    connector: SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings>,
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

  async createConnectionOptions(): Promise<config> {
    const config: config = {
      user: this.connector.settings.username || undefined,
      password: this.connector.settings.password ? await encryptionService.decryptText(this.connector.settings.password) : undefined,
      server: this.connector.settings.host,
      port: this.connector.settings.port,
      database: this.connector.settings.database,
      connectionTimeout: this.connector.settings.connectionTimeout,
      requestTimeout: this.connector.settings.requestTimeout,
      options: {
        encrypt: this.connector.settings.encryption,
        trustServerCertificate: this.connector.settings.trustServerCertificate,
        useUTC: true
      }
    };
    if (this.connector.settings.domain) {
      config.domain = this.connector.settings.domain;
    }
    return config;
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const config = await this.createConnectionOptions();

    let pool;
    let request;
    try {
      pool = await new mssql.ConnectionPool(config).connect();
      request = pool.request();
    } catch (error: unknown) {
      switch ((error as { code: string; message: string }).code) {
        case 'ETIMEOUT':
        case 'ESOCKET':
          throw new OIBusTestingError(`Please check host and port. ${(error as { code: string; message: string }).message}`);

        case 'ELOGIN':
          throw new OIBusTestingError(
            `Please check username, password and database name. ${(error as { code: string; message: string }).message}`
          );

        default:
          throw new OIBusTestingError(`Unable to connect to database. ${(error as { code: string; message: string }).message}`);
      }
    }

    let table_count;
    try {
      const {
        recordsets: [recordset]
      } = await request.query<Array<Record<string, string | number>>>(`
        SELECT COUNT_BIG(*) AS table_count
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
      `);
      table_count = (recordset[0]?.table_count as number) ?? 0;
    } catch (error: unknown) {
      await pool.close();
      throw new OIBusTestingError(`Unable to read tables in database "${this.connector.settings.database}". ${(error as Error).message}`);
    }

    if (table_count === 0) {
      await pool.close();
      throw new OIBusTestingError(`Database "${this.connector.settings.database}" has no tables`);
    }

    const items: Array<{ key: string; value: string }> = [{ key: 'Tables', value: String(table_count) }];

    try {
      const {
        recordsets: [versionResult]
      } = await request.query<Array<Record<string, string>>>(`SELECT @@VERSION AS version`);
      const version = versionResult[0]?.version;
      if (version) {
        items.unshift({ key: 'Version', value: version.split('\n')[0].trim() });
      }
    } catch {
      // Version info not available
    }

    await pool.close();
    return { items };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthMSSQLItemSettings>,
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
    items: Array<SouthConnectorItemEntity<SouthMSSQLItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: OIBusRecord | null }> {
    const item = items[0];

    const startRequest = DateTime.now();
    const result = await this.queryData(item, startTime, endTime);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

    let updatedStartTime: Instant | null = null;
    if (result.length > 0) {
      this.logger.info(`Found ${result.length} results for item ${item.name} in ${requestDuration} ms`);
      updatedStartTime = this.trackMaxInstant(item, result);
      await this.addContent({ type: 'record-list', content: result }, startRequest.toUTC().toISO(), items);
    } else {
      this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
    }

    return { trackedInstant: updatedStartTime, value: result.length > 0 ? result[result.length - 1] : null };
  }

  /**
   * Scan the rows for the configured tracking field and return the max Instant found, used as the
   * cursor for the next incremental query. Row values are otherwise left untouched.
   */
  private trackMaxInstant(item: SouthConnectorItemEntity<SouthMSSQLItemSettings>, rows: Array<OIBusRecord>): Instant | null {
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
   * Apply the SQL query to the target MSSQL database. Rows are returned as-is (no datetime
   * parsing/formatting) — only `@StartTime`/`@EndTime` query parameters are formatted, using the
   * tracking field's `dateTimeInput` config so they match the source column's native representation.
   */
  async queryData(item: SouthConnectorItemEntity<SouthMSSQLItemSettings>, startTime: Instant, endTime: Instant): Promise<Array<OIBusRecord>> {
    const config = await this.createConnectionOptions();

    const dateTimeInput = item.settings.trackingInstant?.trackInstant ? item.settings.trackingInstant.dateTimeInput : null;
    const mssqlStartTime = dateTimeInput == null ? startTime : formatInstant(startTime, dateTimeInput);
    const mssqlEndTime = dateTimeInput == null ? endTime : formatInstant(endTime, dateTimeInput);
    logQuery(item.settings.query, mssqlStartTime, mssqlEndTime, this.logger);

    const pool = await new mssql.ConnectionPool(config).connect();
    const request = pool.request();
    if (item.settings.query.indexOf('@StartTime') !== -1) {
      request.input('StartTime', mssqlStartTime);
    }
    if (item.settings.query.indexOf('@EndTime') !== -1) {
      request.input('EndTime', mssqlEndTime);
    }
    try {
      const result = await request.query(item.settings.query);
      const [first] = result.recordsets as Array<unknown>;
      await pool.close();
      return first as Array<OIBusRecord>;
    } catch (error) {
      await pool.close();
      throw error;
    }
  }
}
