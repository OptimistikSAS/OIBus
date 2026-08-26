import path from 'node:path';
import fs from 'node:fs/promises';
import db from 'better-sqlite3';

import SouthConnector from '../south-connector';
import { convertDateTimeToInstant, formatInstant, logQuery, workUnitLogCtx } from '../../service/utils';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { SouthExplore, SouthHistoryQuery } from '../south-interface';
import { SouthItemSettings, SouthSQLiteItemSettings, SouthSQLiteSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusRecord } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import {
  SouthConnectorExploreEntry,
  SouthConnectorItemQueryResult,
  SouthConnectorItemTestingSettings
} from '../../../shared/model/south-connector.model';

/**
 * Wraps a SQL identifier (table/column name) in double quotes for safe interpolation into PRAGMA and
 * COUNT statements, neither of which can be parameterized with a bind variable in SQLite — the name
 * itself has to be part of the SQL text. Embedded double quotes are doubled per the standard SQL
 * identifier-escaping rule, so a maliciously/oddly named table can't break out of the quoting.
 */
function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Class SouthSQLite - Retrieve data from SQLite databases and send the resulting rows as record-list
 * content to the cache. Row values are passed through untouched — datetime parsing for display is
 * the responsibility of the north-side transformer (e.g. record-list-to-csv); the only datetime
 * handling done here is tracking the incremental cursor via `item.settings.trackingInstant`.
 */
export default class SouthSQLite
  extends SouthConnector<SouthSQLiteSettings, SouthSQLiteItemSettings>
  implements SouthHistoryQuery, SouthExplore
{
  constructor(
    connector: SouthConnectorEntity<SouthSQLiteSettings, SouthSQLiteItemSettings>,
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

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const dbPath = path.resolve(this.connector.settings.databasePath);

    try {
      await fs.access(dbPath, fs.constants.F_OK);
    } catch (error: unknown) {
      throw new Error(`Access error on "${dbPath}". ${(error as Error).message}`);
    }

    const database = db(dbPath);
    let result;
    let table_count;
    try {
      result = database
        .prepare(
          `SELECT COUNT(*) AS table_count
           FROM sqlite_master
           WHERE type = 'table'`
        )
        .all() as Array<{ table_count: number }>;
      table_count = result[0]?.table_count ?? 0;
    } catch (error: unknown) {
      database.close();
      throw new Error(`Unable to query system table. ${(error as Error).message}`);
    }

    if (table_count === 0) {
      database.close();
      throw new Error(`Database "${dbPath}" has no tables`);
    }

    const items: Array<{ key: string; value: string }> = [{ key: 'Tables', value: String(table_count) }];

    try {
      const versionResult = database.prepare(`SELECT sqlite_version() AS version`).all() as Array<{ version: string }>;
      if (versionResult[0]?.version) {
        items.unshift({ key: 'SQLite Version', value: versionResult[0].version });
      }
    } catch {
      // Version info not available
    }

    database.close();

    try {
      const stat = await fs.stat(dbPath);
      items.push({ key: 'File Size', value: `${(stat.size / 1024).toFixed(1)} KB` });
    } catch {
      // File stat not critical
    }

    return { items };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthSQLiteItemSettings>,
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
   * Browse the database for the interactive explore feature: the root level lists every table with its
   * column and row counts; expanding a table lists its columns with their declared type, nullability,
   * primary-key membership and default value (whatever `PRAGMA table_info` reports — SQLite is
   * dynamically typed, so `type` can be blank for a column that was never given one).
   * @param parentId - a table name to list columns for, or null to list every table in the database
   */
  // better-sqlite3 is fully synchronous, so this never actually awaits anything — but it still needs to
  // be declared `async`, not just typed `Promise<...>`, so that a thrown error (e.g. a missing/locked
  // database file) is caught and turned into a rejected promise like every other SouthExplore
  // implementation, rather than throwing synchronously out of the call and breaking callers' `await`.
  // eslint-disable-next-line require-await
  async explore(parentId: string | null): Promise<Array<SouthConnectorExploreEntry>> {
    const dbPath = path.resolve(this.connector.settings.databasePath);
    const database = db(dbPath, { readonly: true, fileMustExist: true });
    try {
      if (parentId === null) {
        const tables = database
          .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
          .all() as Array<{ name: string }>;

        return tables.map(table => {
          const columnCount = (database.prepare(`PRAGMA table_info(${quoteIdentifier(table.name)})`).all() as Array<unknown>).length;
          // A table can exist without being queryable (e.g. a broken virtual table) — a row count that
          // can't be read shouldn't stop the rest of the tree from being explorable.
          let rowCount: number | null = null;
          try {
            const countResult = database.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table.name)}`).all() as Array<{
              count: number;
            }>;
            rowCount = countResult[0]?.count ?? null;
          } catch {
            // leave rowCount unset
          }

          const metadata: Record<string, string | number> = { columns: columnCount };
          if (rowCount !== null) {
            metadata.rows = rowCount;
          }
          return {
            id: table.name,
            name: table.name,
            metadata,
            hasChildren: columnCount > 0
          };
        });
      }

      const columns = database.prepare(`PRAGMA table_info(${quoteIdentifier(parentId)})`).all() as Array<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }>;

      return columns.map(column => {
        const metadata: Record<string, string | number> = { nullable: column.notnull === 0 ? 'yes' : 'no' };
        if (column.type) {
          metadata.type = column.type;
        }
        if (column.pk > 0) {
          metadata.primaryKey = 'yes';
        }
        if (column.dflt_value !== null) {
          metadata.default = column.dflt_value;
        }
        return {
          id: `${parentId}.${column.name}`,
          name: column.name,
          metadata,
          hasChildren: false
        };
      });
    } finally {
      database.close();
    }
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query) and send
   * them to the cache as record-list content.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthSQLiteItemSettings>>,
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
  private trackMaxInstant(item: SouthConnectorItemEntity<SouthSQLiteItemSettings>, rows: Array<OIBusRecord>): Instant | null {
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
   * Apply the SQL query to the target SQLite database. Rows are returned as-is (no datetime
   * parsing/formatting) — only `@StartTime`/`@EndTime` query parameters are formatted, using the
   * tracking field's `dateTimeInput` config so they match the source column's native representation.
   */
  queryData(item: SouthConnectorItemEntity<SouthSQLiteItemSettings>, startTime: Instant, endTime: Instant): Array<OIBusRecord> {
    this.logger.debug(`Opening ${path.resolve(this.connector.settings.databasePath)} SQLite database`);
    const database = db(path.resolve(this.connector.settings.databasePath));

    const dateTimeInput = item.settings.trackingInstant?.trackInstant ? item.settings.trackingInstant.dateTimeInput : null;
    const sqliteStartTime = dateTimeInput == null ? startTime : formatInstant(startTime, dateTimeInput);
    const sqliteEndTime = dateTimeInput == null ? endTime : formatInstant(endTime, dateTimeInput);
    logQuery(item.settings.query, sqliteStartTime, sqliteEndTime, this.logger, workUnitLogCtx([item]));

    try {
      const stmt = database.prepare(item.settings.query);
      const preparedParameters: Record<string, number | string> = {};
      if (item.settings.query.indexOf('@StartTime') !== -1) {
        preparedParameters.StartTime = sqliteStartTime;
      }
      if (item.settings.query.indexOf('@EndTime') !== -1) {
        preparedParameters.EndTime = sqliteEndTime;
      }

      const data = stmt.all(preparedParameters);
      database.close();
      return data as unknown as Array<OIBusRecord>;
    } catch (error) {
      database.close();
      throw error;
    }
  }
}
