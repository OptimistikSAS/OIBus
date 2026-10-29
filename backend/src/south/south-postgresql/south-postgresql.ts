import { DateTime } from 'luxon';
import * as pg from 'pg';
import { ClientConfig } from 'pg';

import { OIBusContent, OIBusRecord } from '../../../shared/model/common/content.model';
import { Instant } from '../../../shared/model/common/types';
import {
  SouthItemSettings,
  SouthPostgreSQLItemSettings,
  SouthPostgreSQLSettings
} from '../../../shared/model/connector/south-settings.model';
import { OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import {
  SouthConnectorExploreEntry,
  SouthConnectorItemQueryResult,
  SouthConnectorItemTestingSettings
} from '../../../shared/model/domain/south-connector.model';

import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { encryptionService } from '../../service/encryption.service';
import {
  convertDateTimeToInstant,
  extractDiscoveryQuery,
  formatInstant,
  generateReplacementParameters,
  getErrorMessage,
  logQuery,
  workUnitLogCtx
} from '../../service/utils';
import SouthConnector from '../south-connector';
import { SouthConfigurationDiscovery, SouthExplore, SouthHistoryQuery } from '../south-interface';
import { POSTGRESQL_DIALECT } from '../sql-dialects';
import {
  discoverTables,
  extractCombine,
  extractNodeIds,
  splitSchemaTable,
  toColumnExploreEntry,
  withTableSelect
} from '../sql-table-discovery';

/**
 * Class SouthPostgreSQL - Retrieve data from PostgreSQL databases and send the resulting rows as
 * record-list content to the cache. Row values are passed through untouched — datetime parsing for
 * display is the responsibility of the north-side transformer (e.g. record-list-to-csv); the only
 * datetime handling done here is tracking the incremental cursor via `item.settings.trackingInstant`.
 */
export default class SouthPostgreSQL
  extends SouthConnector<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>
  implements SouthHistoryQuery, SouthExplore, SouthConfigurationDiscovery
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

      // Dispatch is on the driver's raw .message (exact text / regex), not getErrorMessage(): pg
      // always throws plain Error instances here, so the two are equivalent, but the dispatch keys
      // below need the literal driver text, not a possibly-transformed one.
      if (/(timeout expired)|(^(connect ECONNREFUSED).*)/.test((error as Error).message)) {
        throw new Error(`Please check host and port. ${getErrorMessage(error)}`);
      }

      switch ((error as Error).message) {
        case `password authentication failed for user "${this.connector.settings.username}"`:
          throw new Error(`Please check username and password. ${getErrorMessage(error)}`);

        case `database "${this.connector.settings.database}" does not exist`:
          throw new Error(`Database "${this.connector.settings.database}" does not exist. ${getErrorMessage(error)}`);

        default:
          throw new Error(`Unexpected error. ${getErrorMessage(error)}`);
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
      throw new Error(`Unable to read tables in database "${this.connector.settings.database}". ${getErrorMessage(error)}`);
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
    logQuery(item.settings.query, postgresqlStartTime, postgresqlEndTime, this.logger, workUnitLogCtx([item]));

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

  /**
   * Interactive explore of the database: its tables at the root, schema-qualified as "schema.table" (system schemas
   * left out), with their column count and an approximate row count (the `reltuples` statistic rather than a
   * `COUNT(*)` per table, far too costly just to browse), and the columns of a table under it, with their type,
   * nullability, primary key membership and default.
   * @param parentId - a "schema.table" id to list the columns of, or null to list the tables
   */
  async explore(parentId: string | null): Promise<Array<SouthConnectorExploreEntry>> {
    const connection = new pg.Client(await this.createConnectionOptions());
    await connection.connect();
    try {
      return withTableSelect(
        parentId,
        parentId === null ? await this.exploreTables(connection) : await this.exploreColumns(connection, parentId),
        POSTGRESQL_DIALECT
      );
    } finally {
      await connection.end();
    }
  }

  private async exploreTables(connection: pg.Client): Promise<Array<SouthConnectorExploreEntry>> {
    const { rows } = await connection.query<{ tableSchema: string; tableName: string; columnCount: number; rowCount: string }>(`
      SELECT
        t.table_schema AS "tableSchema",
        t.table_name AS "tableName",
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name)::int AS "columnCount",
        GREATEST(COALESCE((
          SELECT pc.reltuples FROM pg_class pc INNER JOIN pg_namespace pn ON pn.oid = pc.relnamespace
          WHERE pn.nspname = t.table_schema AND pc.relname = t.table_name
        ), 0), 0)::bigint AS "rowCount"
      FROM information_schema.tables t
      WHERE t.table_type = 'BASE TABLE' AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY t.table_schema, t.table_name
    `);
    return rows.map(table => ({
      id: `${table.tableSchema}.${table.tableName}`,
      name: `${table.tableSchema}.${table.tableName}`,
      metadata: { columns: Number(table.columnCount), rows: Number(table.rowCount) },
      hasChildren: Number(table.columnCount) > 0
    }));
  }

  private async exploreColumns(connection: pg.Client, tableId: string): Promise<Array<SouthConnectorExploreEntry>> {
    const { schema, table } = splitSchemaTable(tableId);
    const { rows } = await connection.query<{
      name: string;
      type: string;
      nullable: string;
      columnDefault: string | null;
      primaryKey: boolean;
    }>(
      `
      SELECT
        c.column_name AS name,
        c.data_type AS type,
        c.is_nullable AS nullable,
        c.column_default AS "columnDefault",
        EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          INNER JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name AND tc.constraint_schema = ku.constraint_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND ku.table_schema = c.table_schema AND ku.table_name = c.table_name AND ku.column_name = c.column_name
        ) AS "primaryKey"
      FROM information_schema.columns c
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position
    `,
      [schema, table]
    );
    return rows.map(column =>
      toColumnExploreEntry(tableId, {
        name: column.name,
        type: column.type,
        nullable: column.nullable === 'YES',
        primaryKey: column.primaryKey,
        defaultValue: column.columnDefault
      })
    );
  }

  /**
   * Retrieve step of a Configuration Workflow run: runs the workflow's own dedicated metadata query
   * (`discoveryScope.query`) as-is - no `@StartTime`/`@EndTime` substitution, since it's independent of
   * any item's own data query - and returns its rows directly as the discovered records. The tables and
   * columns checked in the Explore modal (`discoveryScope.nodeIds`) give one record per table instead, holding
   * the item that reads it (see `discoverTables()`).
   */
  async discover(scope: Record<string, unknown>): Promise<Array<OIBusRecord>> {
    const nodeIds = extractNodeIds(scope);
    if (nodeIds) {
      return discoverTables(parentId => this.explore(parentId), nodeIds, POSTGRESQL_DIALECT, extractCombine(scope));
    }
    const query = extractDiscoveryQuery(scope);
    const config = await this.createConnectionOptions();

    let connection;
    try {
      connection = new pg.Client(config);
      await connection.connect();
      const { rows } = await connection.query(query);
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
