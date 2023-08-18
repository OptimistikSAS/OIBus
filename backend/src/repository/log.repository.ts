import { Page } from '../../../shared/model/types';
import { LEVEL_FORMAT, LogDTO, LogSearchParam, PinoLog, Scope } from '../../../shared/model/logs.model';
import { Database } from 'better-sqlite3';
import { DateTime } from 'luxon';
import { ScopeType } from '../../../shared/model/engine.model';

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

  /**
   * Search logs
   */
  searchLogs(searchParams: LogSearchParam): Page<LogDTO> {
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
      `SELECT timestamp, level, scope_id AS scopeId, scope_type as scopeType, scope_name as scopeName, message FROM ${LOG_TABLE} ${whereClause}` +
      ` ORDER BY timestamp DESC LIMIT ${PAGE_SIZE}` +
      ` OFFSET ?;`;
    const results: Array<LogDTO> = this.database.prepare(query).all(...queryParams, PAGE_SIZE * searchParams.page) as Array<LogDTO>;
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
    const query = `SELECT DISTINCT scope_id AS scopeId, scope_type as scopeType, scope_name as scopeName FROM ${LOG_TABLE} WHERE scope_name LIKE '%' || ? || '%';`;
    return this.database.prepare(query).all(name) as Array<Scope>;
  }

  getScopeById(id: string): Scope | undefined {
    const query = `SELECT scope_id AS scopeId, scope_type as scopeType, scope_name as scopeName FROM ${LOG_TABLE} WHERE scope_id = ?;`;
    return this.database.prepare(query).get(id) as Scope | undefined;
  }

  addLogs = (logsToStore: Array<PinoLog> = []): void => {
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

  /**
   * Count the number of logs stored in the repository
   */
  countLogs = (): number => {
    const query = `SELECT COUNT(*) AS count FROM ${LOG_TABLE}`;
    return (this.database.prepare(query).get() as { count: number }).count;
  };

  deleteLogs = (numberOfLogsToDelete: number): void => {
    const query = `DELETE FROM ${LOG_TABLE} WHERE timestamp IN (` + `SELECT timestamp FROM ${LOG_TABLE} ORDER BY timestamp LIMIT ?);`;
    this.database.prepare(query).run(numberOfLogsToDelete);
  };

  deleteLogsByScopeId = (scopeType: ScopeType, scopeId: string): void => {
    const query = `DELETE FROM ${LOG_TABLE} WHERE scope_type = ? AND scope_id = ?`;
    this.database.prepare(query).run(scopeType, scopeId);
  };
}
