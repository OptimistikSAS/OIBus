import { Page } from '../../../shared/model/types';
import { Item, LogLevel, LogSearchParam, Scope, ScopeType } from '../../../shared/model/logs.model';
import { Database } from 'better-sqlite3';
import { DateTime } from 'luxon';
import { OIBusLog, PinoLog } from '../../model/logs.model';

export const LOG_TABLE = 'logs';
const PAGE_SIZE = 50;

const LEVEL_FORMAT: Record<string, LogLevel> = {
  '10': 'trace',
  '20': 'debug',
  '30': 'info',
  '40': 'warn',
  '50': 'error'
};

/**
 * Repository used for logs
 */
export default class LogRepository {
  /**
   * The database is initialized by the SqliteTransport Pino Logger.
   * @param database
   */
  constructor(private readonly database: Database) {}

  search(searchParams: LogSearchParam): Page<OIBusLog> {
    const queryParams = [];
    let whereClause = `WHERE timestamp BETWEEN ? AND ?`;
    queryParams.push(DateTime.fromISO(searchParams.start!).toUTC().toISO(), DateTime.fromISO(searchParams.end!).toUTC().toISO());
    if (searchParams.levels.length > 0) {
      whereClause += ` AND level IN (${searchParams.levels.map(() => '?')})`;
      queryParams.push(...searchParams.levels);
    }
    if (searchParams.scopeIds.length > 0) {
      whereClause += ` AND scope_id IN (${searchParams.scopeIds.map(() => '?')})`;
      queryParams.push(...searchParams.scopeIds);
    }
    if (searchParams.scopeTypes.length > 0) {
      whereClause += ` AND scope_type IN (${searchParams.scopeTypes.map(() => '?')})`;
      queryParams.push(...searchParams.scopeTypes);
    }
    if (searchParams.itemIds.length > 0) {
      whereClause += ` AND item_id IN (${searchParams.itemIds.map(() => '?')})`;
      queryParams.push(...searchParams.itemIds);
    }
    if (searchParams.messageContent) {
      whereClause += ` AND message LIKE '%' || ? || '%'`;
      queryParams.push(searchParams.messageContent);
    }

    const query =
      `SELECT timestamp, level, scope_id, scope_type, scope_name, item_id, item_name, message FROM ${LOG_TABLE} ${whereClause}` +
      ` ORDER BY timestamp DESC LIMIT ${PAGE_SIZE}` +
      ` OFFSET ?;`;
    const results = this.database
      .prepare(query)
      .all(...queryParams, PAGE_SIZE * searchParams.page)
      .map(result => this.toLog(result as Record<string, string>));
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${LOG_TABLE} ${whereClause}`).get(...queryParams) as { count: number }
    ).count;
    const totalPages = Math.ceil(totalElements / PAGE_SIZE);

    return {
      content: results,
      size: PAGE_SIZE,
      number: searchParams.page,
      totalElements,
      totalPages
    };
  }

  suggestScopes(name: string): Array<Scope> {
    const query = `SELECT DISTINCT scope_id AS scopeId, scope_name as scopeName FROM ${LOG_TABLE} WHERE scope_name LIKE '%' || ? || '%';`;
    return this.database.prepare(query).all(name) as Array<Scope>;
  }

  getScopeById(id: string): Scope | null {
    const query = `SELECT scope_id, scope_name FROM ${LOG_TABLE} WHERE scope_id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;
    return { scopeId: (result as Record<string, string>).scope_id, scopeName: (result as Record<string, string>).scope_name };
  }

  suggestItems(name: string): Array<Item> {
    const query = `SELECT DISTINCT item_id AS itemId, item_name AS itemName FROM ${LOG_TABLE} WHERE item_id IS NOT NULL AND item_name LIKE '%' || ? || '%';`;
    return this.database.prepare(query).all(name) as Array<Item>;
  }

  getItemById(id: string): Item | null {
    const query = `SELECT item_id, item_name FROM ${LOG_TABLE} WHERE item_id = ? LIMIT 1;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;
    return { itemId: (result as Record<string, string>).item_id, itemName: (result as Record<string, string>).item_name };
  }

  saveAll = (logsToStore: Array<PinoLog>): void => {
    if (logsToStore.length === 0) return;

    const stmt = this.database.prepare(
      `INSERT INTO ${LOG_TABLE} (timestamp, level, scope_type, scope_id, scope_name, item_id, item_name, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertMany = this.database.transaction((logs: Array<PinoLog>) => {
      for (const log of logs) {
        stmt.run(
          log.time,
          LEVEL_FORMAT[log.level],
          log.scopeType,
          log.scopeId,
          log.scopeName,
          log.itemId ?? null,
          log.itemName ?? null,
          log.msg
        );
      }
    });

    insertMany(logsToStore);
  };

  count = (): number => {
    const query = `SELECT COUNT(*) AS count FROM ${LOG_TABLE}`;
    return (this.database.prepare(query).get() as { count: number }).count;
  };

  /**
   * Delete the OLDEST `numberOfLogsToDelete` rows.
   *
   * Returns the number of rows actually deleted (may be < requested if the
   * table has fewer rows), so the caller can update its own counters without
   * issuing a follow-up `SELECT COUNT(*)`.
   */
  delete = (numberOfLogsToDelete: number): number => {
    const query = `DELETE FROM ${LOG_TABLE} WHERE ROWID IN (SELECT ROWID FROM ${LOG_TABLE} ORDER BY ROWID ASC LIMIT ?);`;
    const result = this.database.prepare(query).run(numberOfLogsToDelete);
    return result.changes;
  };

  deleteLogsByScopeId = (scopeType: ScopeType, scopeId: string): void => {
    this.database.prepare(`DELETE FROM ${LOG_TABLE} WHERE scope_type = ? AND scope_id = ?`).run(scopeType, scopeId);
  };

  // Note: no vacuum methods here. The v3.8.0 migration enables
  // `auto_vacuum = FULL` on the logs DB, so SQLite reclaims free pages itself
  // on any transaction that frees them. The previous full-VACUUM-on-startup
  // and periodic-VACUUM-after-deletion paths are both gone.

  private toLog(result: Record<string, string>): OIBusLog {
    return {
      timestamp: result.timestamp,
      level: result.level as LogLevel,
      scopeType: result.scope_type as ScopeType,
      scopeId: result.scope_id || null,
      scopeName: result.scope_name || null,
      itemId: result.item_id || null,
      itemName: result.item_name || null,
      message: result.message
    };
  }
}
