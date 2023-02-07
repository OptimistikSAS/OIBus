import { Page } from '../../shared/model/types';
import { LogDTO, LogSearchParam } from '../../shared/model/logs.model';
import { Database } from 'better-sqlite3';

const LOG_TABLE = 'logs';
const PAGE_SIZE = 50;

/**
 * Repository used for logs
 */
export default class LogRepository {
  private readonly database: Database;

  /**
   * The database is initialized by the SqliteTransport Pino Logger.
   * @param database
   */
  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Search logs
   */
  searchLogs(searchParams: LogSearchParam): Page<LogDTO> {
    const queryParams = [];
    let whereClause = `WHERE timestamp BETWEEN ? AND ? `;
    queryParams.push(searchParams.start, searchParams.end);
    if (searchParams.levels.length > 0) {
      whereClause += `AND level IN (${searchParams.levels.map(() => '?')})`;
      queryParams.push(...searchParams.levels);
    }
    if (searchParams.scope) {
      whereClause += ` AND scope LIKE '%?%'`;
      queryParams.push(searchParams.scope);
    }
    if (searchParams.messageContent) {
      whereClause += ` AND message LIKE '%?%'`;
      queryParams.push(searchParams.messageContent);
    }

    const query =
      `SELECT timestamp, level, scope, message FROM ${LOG_TABLE} ${whereClause}` +
      ` ORDER BY timestamp DESC LIMIT ${PAGE_SIZE}` +
      ` OFFSET ?;`;
    const results: Array<LogDTO> = this.database.prepare(query).all(...queryParams, PAGE_SIZE * searchParams.page);
    const totalElements = this.database.prepare(`SELECT COUNT(*) as count FROM ${LOG_TABLE} ${whereClause}`).get(...queryParams).count;
    const totalPages = Math.ceil(totalElements / PAGE_SIZE);

    return {
      content: results,
      size: PAGE_SIZE,
      number: searchParams.page,
      totalElements,
      totalPages
    };
  }
}
