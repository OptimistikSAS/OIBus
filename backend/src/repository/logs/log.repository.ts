import { Page } from '../../../../shared/model/types';
import { LEVEL_FORMAT, LogSearchParam, PinoLog, Scope } from '../../../../shared/model/logs.model';
import { Database } from 'better-sqlite3';
import { DateTime } from 'luxon';
import { ScopeType } from '../../../../shared/model/engine.model';
import { OIBusLog } from '../../model/logs.model';

export const LOG_TABLE = 'logs';
const PAGE_SIZE = 50;

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
    if (searchParams.messageContent) {
      whereClause += ` AND message LIKE '%' || ? || '%'`;
      queryParams.push(searchParams.messageContent);
    }

    const query =
      `SELECT timestamp, level, scope_id, scope_type, scope_name, message FROM ${LOG_TABLE} ${whereClause}` +
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

  searchScopesByName(name: string): Array<Scope> {
    const query = `SELECT DISTINCT scope_id AS scopeId, scope_name as scopeName FROM ${LOG_TABLE} WHERE scope_name LIKE '%' || ? || '%';`;
    return this.database.prepare(query).all(name) as Array<Scope>;
  }

  getScopeById(id: string): Scope | null {
    const query = `SELECT scope_id, scope_name FROM ${LOG_TABLE} WHERE scope_id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;
    return { scopeId: (result as Record<string, string>).scope_id, scopeName: (result as Record<string, string>).scope_name };
  }

  saveAll = (logsToStore: Array<PinoLog>): void => {
    if (logsToStore.length === 0) return;
    // Create a single query to store many logs at once
    let valueClause = 'VALUES';
    const params: Array<string | number | null> = [];
    logsToStore.forEach(log => {
      valueClause += ' (?,?,?,?,?,?),';
      params.push(log.time, LEVEL_FORMAT[log.level], log.scopeType, log.scopeId, log.scopeName, log.msg);
    });

    // Remove last string char ","
    const query = `INSERT INTO ${LOG_TABLE} (timestamp, level, scope_type, scope_id, scope_name, message) ${valueClause.slice(0, -1)};`;

    this.database.prepare(query).run(...params);
  };

  count = (): number => {
    const query = `SELECT COUNT(*) AS count FROM ${LOG_TABLE}`;
    return (this.database.prepare(query).get() as { count: number }).count;
  };

  delete = (numberOfLogsToDelete: number): void => {
    const query = `DELETE FROM ${LOG_TABLE} WHERE ROWID IN (SELECT ROWID FROM ${LOG_TABLE} ORDER BY timestamp LIMIT ?);`;
    this.database.prepare(query).run(numberOfLogsToDelete);
  };

  deleteLogsByScopeId = (scopeType: ScopeType, scopeId: string): void => {
    this.database.prepare(`DELETE FROM ${LOG_TABLE} WHERE scope_type = ? AND scope_id = ?`).run(scopeType, scopeId);
  };

  private toLog(result: Record<string, string>): OIBusLog {
    return {
      timestamp: result.timestamp,
      level: result.level,
      scopeType: result.scope_type,
      scopeId: result.scope_id || null,
      scopeName: result.scope_name || null,
      message: result.message
    };
  }
}
