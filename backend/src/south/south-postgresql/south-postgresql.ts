import * as pg from 'pg';
import { ClientConfig } from 'pg';

import SouthConnector from '../south-connector';
import { convertDateTimeToInstant, formatInstant, generateReplacementParameters, logQuery } from '../../service/utils';
import { encryptionService } from '../../service/encryption.service';
import { Instant } from '../../../shared/model/types';
import { SouthHistoryQuery } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthItemSettings, SouthPostgreSQLItemSettings, SouthPostgreSQLSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusRecord } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';

/**
 * Class SouthPostgreSQL - Retrieve data from PostgreSQL databases and send the resulting rows as
 * record-list content to the cache. Row values are passed through untouched — datetime parsing for
 * display is the responsibility of the north-side transformer (e.g. record-list-to-csv); the only
 * datetime handling done here is tracking the incremental cursor via `item.settings.trackingInstant`.
 */
export default class SouthPostgreSQL
  extends SouthConnector<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>
  implements SouthHistoryQuery
{
  constructor(
    connector: SouthConnectorEntity<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>,
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

  async createConnectionOptions(): Promise<ClientConfig> {
    return {
      host: this.connector.settings.host,
      port: this.connector.settings.port,
      user: this.connector.settings.username || undefined,
      password: this.connector.settings.password ? await encryptionService.decryptText(this.connector.settings.password) : undefined,
      database: this.connector.settings.database,
      query_timeout: this.connector.settings.requestTimeout,
      connectionTimeoutMillis: this.connector.settings.connectionTimeout,
      ssl: this.connector.settings.sslMode
    };
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const config = await this.createConnectionOptions();

    let connection;
    try {
      connection = new pg.Client(config);
      await connection.connect();
    } catch (error: unknown) {
      if (connection) {
        await connection.end();
      }

      if (/(timeout expired)|(^(connect ECONNREFUSED).*)/.test((error as Error).message)) {
        throw new Error(`Please check host and port. ${(error as Error).message}`);
      }

      switch ((error as Error).message) {
        case `password authentication failed for user "${this.connector.settings.username}"`:
          throw new Error(`Please check username and password. ${(error as Error).message}`);

        case `database "${this.connector.settings.database}" does not exist`:
          throw new Error(`Database "${this.connector.settings.database}" does not exist. ${(error as Error).message}`);

        default:
          throw new Error(`Unexpected error. ${(error as Error).message}`);
      }
    }

    let table_count;
    try {
      const { rows } = await connection.query(`
        SELECT COUNT(*) AS table_count
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND table_schema = current_schema()
      `);
      table_count = rows[0]?.table_count ?? 0;
    } catch (error: unknown) {
      await connection.end();
      throw new Error(`Unable to read tables in database "${this.connector.settings.database}". ${(error as Error).message}`);
    }

    if (table_count === 0) {
      await connection.end();
      throw new Error(`Database "${this.connector.settings.database}" has no tables`);
    }

    const items: Array<{ key: string; value: string }> = [{ key: 'Tables', value: String(table_count) }];

    try {
      const { rows: versionRows } = await connection.query(`SELECT version() AS version`);
      const version = versionRows[0]?.version;
      if (version) {
        items.unshift({ key: 'Version', value: String(version) });
      }
    } catch {
      // Version info not available
    }

    await connection.end();
    return { items };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthPostgreSQLItemSettings>,
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
    items: Array<SouthConnectorItemEntity<SouthPostgreSQLItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
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
  private trackMaxInstant(item: SouthConnectorItemEntity<SouthPostgreSQLItemSettings>, rows: Array<OIBusRecord>): Instant | null {
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
   * Apply the SQL query to the target PostgreSQL database. Rows are returned as-is (no datetime
   * parsing/formatting) — only `@StartTime`/`@EndTime` query parameters are formatted, using the
   * tracking field's `dateTimeInput` config so they match the source column's native representation.
   */
  async queryData(
    item: SouthConnectorItemEntity<SouthPostgreSQLItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<OIBusRecord>> {
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, '$1').replace(/@EndTime/g, '$2');
    const config = await this.createConnectionOptions();

    const dateTimeInput = item.settings.trackingInstant?.trackInstant ? item.settings.trackingInstant.dateTimeInput : null;
    const postgresqlStartTime = dateTimeInput == null ? startTime : formatInstant(startTime, dateTimeInput);
    const postgresqlEndTime = dateTimeInput == null ? endTime : formatInstant(endTime, dateTimeInput);
    logQuery(item.settings.query, postgresqlStartTime, postgresqlEndTime, this.logger);

    let connection;
    try {
      connection = new pg.Client(config);
      await connection.connect();
      const params = generateReplacementParameters(item.settings.query, postgresqlStartTime, postgresqlEndTime);
      const { rows } = await connection.query(adaptedQuery, params);
      await connection.end();
      return rows;
    } catch (error) {
      if (connection) {
        await connection.end();
      }
      throw error;
    }
  }
}
