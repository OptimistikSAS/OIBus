import path from 'node:path';

import { DateTime } from 'luxon';
import oracledb, { ConnectionAttributes } from 'oracledb';

import { OIBusContent, OIBusRecord } from '../../../shared/model/common/content.model';
import { Instant } from '../../../shared/model/common/types';
import { SouthItemSettings, SouthOracleItemSettings, SouthOracleSettings } from '../../../shared/model/connector/south-settings.model';
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
import { ORACLE_DIALECT } from '../sql-dialects';
import { buildTableQuery, discoverTables, extractNodeIds, extractTableScope, toColumnExploreEntry } from '../sql-table-discovery';

/**
 * Class SouthOracle - Retrieve data from Oracle databases and send the resulting rows as record-list
 * content to the cache. Row values are passed through untouched — datetime parsing for display is
 * the responsibility of the north-side transformer (e.g. record-list-to-csv); the only datetime
 * handling done here is tracking the incremental cursor via `item.settings.trackingInstant`.
 */
export default class SouthOracle
  extends SouthConnector<SouthOracleSettings, SouthOracleItemSettings>
  implements SouthHistoryQuery, SouthExplore, SouthConfigurationDiscovery
{
  constructor(
    connector: SouthConnectorEntity<SouthOracleSettings, SouthOracleItemSettings>,
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
    if (this.connector.settings.thickMode && this.connector.settings.oracleClient) {
      try {
        if (!oracledb.oracleClientVersion) {
          oracledb.initOracleClient({ libDir: path.resolve(this.connector.settings.oracleClient) });
          this.logger.info(`Successfully loaded Oracle Thick mode from ${path.resolve(this.connector.settings.oracleClient)}`);
        }
      } catch (err) {
        this.logger.error(
          `FATAL: Failed to initialize Oracle Thick mode. Falling back to Thin mode. Error details: ${getErrorMessage(err)}`
        );
      }
    }
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    let connectString = `${this.connector.settings.host}:${this.connector.settings.port}/${this.connector.settings.database}`;
    if (this.connector.settings.connectionTimeout) {
      connectString += `?connect_timeout=${this.connector.settings.connectionTimeout}ms`;
    }
    const config: ConnectionAttributes = {
      user: this.connector.settings.username || undefined,
      password: this.connector.settings.password ? await encryptionService.decryptText(this.connector.settings.password) : undefined,
      connectString: connectString
    };

    let connection;
    try {
      connection = await oracledb.getConnection(config);
      await connection.ping();
    } catch (error: unknown) {
      if (connection) {
        await connection.close();
      }

      switch ((error as { code: string }).code) {
        case 'NJS-515':
        case 'NJS-503':
          throw new Error(`Please check host and port. ${getErrorMessage(error)}`);

        case 'ORA-01017':
          throw new Error(`Please check username and password. ${getErrorMessage(error)}`);

        case 'NJS-518':
          throw new Error(
            `Cannot connect to database "${this.connector.settings.database}". Service is not registered. ${getErrorMessage(error)}`
          );

        default:
          throw new Error(`Unexpected error. ${getErrorMessage(error)}`);
      }
    }

    let table_count = 0;
    try {
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      const { rows } = await connection.execute(`
      SELECT COUNT(*) AS TABLE_COUNT
        FROM ALL_TABLES
        WHERE OWNER = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')
      `);
      if (rows) {
        const result = rows[0] as { TABLE_COUNT: number };
        table_count = result?.TABLE_COUNT || 0;
      }
    } catch (error: unknown) {
      await connection.close();
      throw new Error(`Unable to read tables in database "${this.connector.settings.database}": ${getErrorMessage(error)}`);
    }

    await connection.close();

    if (table_count === 0) {
      throw new Error(`No tables in the "${this.connector.settings.username}" schema`);
    }
    return { items: [] };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOracleItemSettings>,
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
    items: Array<SouthConnectorItemEntity<SouthOracleItemSettings>>,
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
  private trackMaxInstant(item: SouthConnectorItemEntity<SouthOracleItemSettings>, rows: Array<OIBusRecord>): Instant | null {
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
   * Apply the SQL query to the target Oracle database. Rows are returned as-is (no datetime
   * parsing/formatting) — only `@StartTime`/`@EndTime` query parameters are formatted, using the
   * tracking field's `dateTimeInput` config so they match the source column's native representation.
   */
  async queryData(
    item: SouthConnectorItemEntity<SouthOracleItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<OIBusRecord>> {
    let connectString = `${this.connector.settings.host}:${this.connector.settings.port}/${this.connector.settings.database}`;
    if (this.connector.settings.connectionTimeout) {
      connectString += `?connect_timeout=${this.connector.settings.connectionTimeout}ms`;
    }
    const config: ConnectionAttributes = {
      user: this.connector.settings.username || undefined,
      password: this.connector.settings.password ? await encryptionService.decryptText(this.connector.settings.password) : undefined,
      connectString
    };
    const dateTimeInput = item.settings.trackingInstant?.trackInstant ? item.settings.trackingInstant.dateTimeInput : null;
    const oracleStartTime = dateTimeInput ? formatInstant(startTime, dateTimeInput) : startTime;
    const oracleEndTime = dateTimeInput ? formatInstant(endTime, dateTimeInput) : endTime;
    logQuery(item.settings.query, oracleStartTime, oracleEndTime, this.logger, workUnitLogCtx([item]));

    let connection;
    try {
      process.env.ORA_SDTZ = 'UTC';
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      connection = await oracledb.getConnection(config);
      connection.callTimeout = item.settings.requestTimeout;

      const params = generateReplacementParameters(item.settings.query, oracleStartTime, oracleEndTime);
      const query = item.settings.query.replace(/@StartTime/g, ':date1').replace(/@EndTime/g, ':date2');
      const result = await connection.execute(query, params);
      await connection.close();
      if (!result.rows) {
        return [];
      }
      return result.rows as Array<OIBusRecord>;
    } catch (error) {
      if (connection) {
        await connection.close();
      }
      throw error;
    }
  }

  /** The connection to the database, as the connector settings describe it. */
  private async createConnectionAttributes(): Promise<ConnectionAttributes> {
    let connectString = `${this.connector.settings.host}:${this.connector.settings.port}/${this.connector.settings.database}`;
    if (this.connector.settings.connectionTimeout) {
      connectString += `?connect_timeout=${this.connector.settings.connectionTimeout}ms`;
    }
    return {
      user: this.connector.settings.username || undefined,
      password: this.connector.settings.password ? await encryptionService.decryptText(this.connector.settings.password) : undefined,
      connectString
    };
  }

  /**
   * Interactive explore of the schema of the connected user: its tables at the root, with their column count and an
   * approximate row count (the `NUM_ROWS` statistic rather than a `COUNT(*)` per table, far too costly just to
   * browse), and the columns of a table under it, with their type, nullability and primary key membership.
   * @param parentId - a table name to list the columns of, or null to list the tables
   */
  async explore(parentId: string | null): Promise<Array<SouthConnectorExploreEntry>> {
    const connection = await oracledb.getConnection(await this.createConnectionAttributes());
    try {
      return parentId === null ? await this.exploreTables(connection) : await this.exploreColumns(connection, parentId);
    } finally {
      await connection.close();
    }
  }

  private async exploreTables(connection: oracledb.Connection): Promise<Array<SouthConnectorExploreEntry>> {
    const result = await connection.execute<{ tableName: string; rowCount: number; columnCount: number }>(
      `
      SELECT
        t.TABLE_NAME AS "tableName",
        NVL(t.NUM_ROWS, 0) AS "rowCount",
        (SELECT COUNT(*) FROM USER_TAB_COLUMNS c WHERE c.TABLE_NAME = t.TABLE_NAME) AS "columnCount"
      FROM USER_TABLES t
      ORDER BY t.TABLE_NAME
    `,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return (result.rows ?? []).map(table => ({
      id: table.tableName,
      name: table.tableName,
      metadata: { columns: Number(table.columnCount), rows: Number(table.rowCount) },
      hasChildren: Number(table.columnCount) > 0
    }));
  }

  private async exploreColumns(connection: oracledb.Connection, tableName: string): Promise<Array<SouthConnectorExploreEntry>> {
    // DATA_DEFAULT is a LONG, which can't be read in a query like the other columns: the default value is left out
    const result = await connection.execute<{ name: string; type: string; nullable: string; primaryKey: number }>(
      `
      SELECT
        c.COLUMN_NAME AS "name",
        c.DATA_TYPE AS "type",
        c.NULLABLE AS "nullable",
        CASE WHEN EXISTS (
          SELECT 1 FROM USER_CONSTRAINTS uc
          INNER JOIN USER_CONS_COLUMNS ucc ON uc.CONSTRAINT_NAME = ucc.CONSTRAINT_NAME
          WHERE uc.CONSTRAINT_TYPE = 'P' AND ucc.TABLE_NAME = c.TABLE_NAME AND ucc.COLUMN_NAME = c.COLUMN_NAME
        ) THEN 1 ELSE 0 END AS "primaryKey"
      FROM USER_TAB_COLUMNS c
      WHERE c.TABLE_NAME = :tableName
      ORDER BY c.COLUMN_ID
    `,
      { tableName },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return (result.rows ?? []).map(column =>
      toColumnExploreEntry(tableName, {
        name: column.name,
        type: column.type,
        nullable: column.nullable === 'Y',
        primaryKey: column.primaryKey === 1,
        defaultValue: null
      })
    );
  }

  /**
   * Retrieve step of a Configuration Workflow run: runs the workflow's own dedicated metadata query
   * (`discoveryScope.query`) as-is - no `@StartTime`/`@EndTime` substitution, since it's independent of
   * any item's own data query - and returns its rows directly as the discovered records; or reads the rows of a table
   * (`discoveryScope.table`, and the `columns` to read - all when none). The tables and
   * columns checked in the Explore modal (`discoveryScope.nodeIds`) give one record per table instead, holding
   * the item that reads it (see `discoverTables()`).
   */
  async discover(scope: Record<string, unknown>): Promise<Array<OIBusRecord>> {
    const nodeIds = extractNodeIds(scope);
    if (nodeIds) {
      return discoverTables(parentId => this.explore(parentId), nodeIds, ORACLE_DIALECT);
    }
    // The rows of a table, or of a query of its own
    const tableScope = extractTableScope(scope);
    const query = tableScope ? buildTableQuery(ORACLE_DIALECT, tableScope.table, tableScope.columns) : extractDiscoveryQuery(scope);
    const config = await this.createConnectionAttributes();

    let connection;
    try {
      process.env.ORA_SDTZ = 'UTC';
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      connection = await oracledb.getConnection(config);
      const result = await connection.execute(query);
      await connection.close();
      return (result.rows ?? []) as Array<OIBusRecord>;
    } catch (error) {
      if (connection) {
        await connection.close();
      }
      throw error;
    }
  }
}
