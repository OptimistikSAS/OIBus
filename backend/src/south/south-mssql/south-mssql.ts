import mssql, { config, ConnectionPool } from 'mssql';

import SouthConnector from '../south-connector';
import {
  convertDateTimeToInstant,
  extractDiscoveryQuery,
  formatInstant,
  getErrorMessage,
  logQuery,
  workUnitLogCtx
} from '../../service/utils';
import { encryptionService } from '../../service/encryption.service';
import { Instant } from '../../../shared/model/types';
import { SouthConfigurationDiscovery, SouthExplore, SouthHistoryQuery } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthItemSettings, SouthMSSQLItemSettings, SouthMSSQLSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusRecord } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import {
  SouthConnectorExploreEntry,
  SouthConnectorItemQueryResult,
  SouthConnectorItemTestingSettings
} from '../../../shared/model/south-connector.model';
import { OIBusTestingError } from '../../model/types';

/**
 * Class SouthMSSQL - Retrieve data from MSSQL databases and send the resulting rows as record-list
 * content to the cache. Row values are passed through untouched — datetime parsing for display is
 * the responsibility of the north-side transformer (e.g. record-list-to-csv); the only datetime
 * handling done here is tracking the incremental cursor via `item.settings.trackingInstant`.
 */
export default class SouthMSSQL
  extends SouthConnector<SouthMSSQLSettings, SouthMSSQLItemSettings>
  implements SouthHistoryQuery, SouthExplore, SouthConfigurationDiscovery
{
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
      switch ((error as { code: string }).code) {
        case 'ETIMEOUT':
        case 'ESOCKET':
          throw new OIBusTestingError(`Please check host and port. ${getErrorMessage(error)}`);

        case 'ELOGIN':
          throw new OIBusTestingError(`Please check username, password and database name. ${getErrorMessage(error)}`);

        default:
          throw new OIBusTestingError(`Unable to connect to database. ${getErrorMessage(error)}`);
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
      throw new OIBusTestingError(`Unable to read tables in database "${this.connector.settings.database}". ${getErrorMessage(error)}`);
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
  async queryData(
    item: SouthConnectorItemEntity<SouthMSSQLItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<OIBusRecord>> {
    const config = await this.createConnectionOptions();

    const dateTimeInput = item.settings.trackingInstant?.trackInstant ? item.settings.trackingInstant.dateTimeInput : null;
    const mssqlStartTime = dateTimeInput == null ? startTime : formatInstant(startTime, dateTimeInput);
    const mssqlEndTime = dateTimeInput == null ? endTime : formatInstant(endTime, dateTimeInput);
    logQuery(item.settings.query, mssqlStartTime, mssqlEndTime, this.logger, workUnitLogCtx([item]));

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

  /**
   * Browse the database for the interactive explore feature: the root level lists every table, each
   * schema-qualified as "schema.table" since MSSQL supports multiple schemas per database, with its
   * column count and an approximate row count read from `sys.partitions` metadata rather than a
   * `SELECT COUNT(*)` per table - a full table scan would be far too costly to run just for browsing.
   * Expanding a table lists its columns with their declared type, nullability, primary-key membership
   * and default value.
   * @param parentId - a "schema.table" id to list columns for, or null to list every table in the database
   */
  async explore(parentId: string | null): Promise<Array<SouthConnectorExploreEntry>> {
    const config = await this.createConnectionOptions();
    const pool = await new mssql.ConnectionPool(config).connect();
    try {
      const entries = parentId === null ? await this.exploreTables(pool) : await this.exploreColumns(pool, parentId);
      await pool.close();
      return entries;
    } catch (error) {
      await pool.close();
      throw error;
    }
  }

  /** Root level of `explore()`: every table in the database, schema-qualified. */
  private async exploreTables(pool: ConnectionPool): Promise<Array<SouthConnectorExploreEntry>> {
    const {
      recordsets: [tables]
    } = await pool.request().query<Array<{ tableSchema: string; tableName: string; columnCount: number; rowCount: number }>>(`
      SELECT
        s.name AS tableSchema,
        t.name AS tableName,
        (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS columnCount,
        ISNULL((SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0, 1)), 0) AS rowCount
      FROM sys.tables t
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      ORDER BY s.name, t.name
    `);

    return tables.map(table => ({
      id: `${table.tableSchema}.${table.tableName}`,
      name: `${table.tableSchema}.${table.tableName}`,
      metadata: { columns: table.columnCount, rows: table.rowCount },
      hasChildren: table.columnCount > 0
    }));
  }

  /** One level down from `explore()`'s root: every column of the "schema.table" being expanded, with
   *  its primary-key membership resolved via a single join rather than a second round-trip. */
  private async exploreColumns(pool: ConnectionPool, parentId: string): Promise<Array<SouthConnectorExploreEntry>> {
    const dotIndex = parentId.indexOf('.');
    const tableSchema = dotIndex === -1 ? '' : parentId.slice(0, dotIndex);
    const tableName = dotIndex === -1 ? parentId : parentId.slice(dotIndex + 1);

    const request = pool.request();
    request.input('tableSchema', tableSchema);
    request.input('tableName', tableName);
    const {
      recordsets: [columns]
    } = await request.query<Array<{ name: string; type: string; nullable: string; columnDefault: string | null; isPrimaryKey: number }>>(`
      SELECT
        c.COLUMN_NAME AS name,
        c.DATA_TYPE AS type,
        c.IS_NULLABLE AS nullable,
        c.COLUMN_DEFAULT AS columnDefault,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS isPrimaryKey
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME AND tc.CONSTRAINT_SCHEMA = ku.CONSTRAINT_SCHEMA
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ) pk ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA AND pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME
      WHERE c.TABLE_SCHEMA = @tableSchema AND c.TABLE_NAME = @tableName
      ORDER BY c.ORDINAL_POSITION
    `);

    return columns.map(column => {
      const metadata: Record<string, string | number> = { type: column.type, nullable: column.nullable === 'YES' ? 'yes' : 'no' };
      if (column.isPrimaryKey) {
        metadata.primaryKey = 'yes';
      }
      if (column.columnDefault !== null) {
        metadata.default = column.columnDefault;
      }
      return {
        id: `${parentId}.${column.name}`,
        name: column.name,
        metadata,
        hasChildren: false
      };
    });
  }

  /**
   * Retrieve step of a Configuration Workflow run: runs the workflow's own dedicated metadata query
   * (`discoveryScope.query`) as-is - no `@StartTime`/`@EndTime` substitution, since it's independent of
   * any item's own data query - and returns its rows directly as the discovered records.
   */
  async discover(scope: Record<string, unknown>): Promise<Array<OIBusRecord>> {
    const query = extractDiscoveryQuery(scope);
    const config = await this.createConnectionOptions();

    const pool = await new mssql.ConnectionPool(config).connect();
    try {
      const result = await pool.request().query(query);
      const [first] = result.recordsets as Array<unknown>;
      await pool.close();
      return (first ?? []) as Array<OIBusRecord>;
    } catch (error) {
      await pool.close();
      throw error;
    }
  }
}
