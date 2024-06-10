import { generateRandomId } from '../service/utils';
import { Database } from 'better-sqlite3';
import { Instant, Page } from '../../../shared/model/types';
import { InfoMessage, OIAnalyticsMessageDTO, OIAnalyticsMessageSearchParam } from '../../../shared/model/oianalytics-message.model';

export const OIANALYTICS_MESSAGE_TABLE = 'oianalytics_messages';
const PAGE_SIZE = 50;
/**
 * Repository used for engine settings
 */
export default class OianalyticsMessageRepository {
  constructor(private readonly database: Database) {}

  /**
   * Search messages by page
   */
  searchMessagesPage(searchParams: OIAnalyticsMessageSearchParam, page: number): Page<OIAnalyticsMessageDTO> {
    const queryParams = [];
    let whereClause = 'WHERE id IS NOT NULL';
    if (searchParams.types.length > 0) {
      whereClause += ` AND type IN (${searchParams.types.map(() => '?')})`;
      queryParams.push(...searchParams.types);
    }
    if (searchParams.status.length > 0) {
      whereClause += ` AND status IN (${searchParams.status.map(() => '?')})`;
      queryParams.push(...searchParams.status);
    }
    if (searchParams.start) {
      whereClause += ` AND created_at >= ?`;
      queryParams.push(searchParams.start);
    }
    if (searchParams.end) {
      whereClause += ` AND created_at <= ?`;
      queryParams.push(searchParams.end);
    }

    const query = `SELECT id, created_at as creationDate, completed_date as compeltedDate, type, status, error, content FROM ${OIANALYTICS_MESSAGE_TABLE} ${whereClause} ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ?;`;
    const results: Array<any> = this.database.prepare(query).all(...queryParams, PAGE_SIZE * page);
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${OIANALYTICS_MESSAGE_TABLE} ${whereClause};`).get(...queryParams) as {
        count: number;
      }
    ).count;
    const totalPages = Math.ceil(totalElements / PAGE_SIZE);

    return {
      content: results.map(result => ({
        id: result.id,
        creationDate: result.creationDate,
        type: result.type,
        status: result.status,
        error: result.error,
        completedDate: result.completedDate,
        content: JSON.parse(result.content)
      })) as Array<OIAnalyticsMessageDTO>,
      size: PAGE_SIZE,
      number: page,
      totalElements,
      totalPages
    };
  }

  /**
   * Search messages by list
   */
  searchMessagesList(searchParams: OIAnalyticsMessageSearchParam): Array<OIAnalyticsMessageDTO> {
    const queryParams = [];
    let whereClause = 'WHERE id IS NOT NULL';
    if (searchParams.types.length > 0) {
      whereClause += ` AND type IN (${searchParams.types.map(() => '?')})`;
      queryParams.push(...searchParams.types);
    }
    if (searchParams.status.length > 0) {
      whereClause += ` AND status IN (${searchParams.status.map(() => '?')})`;
      queryParams.push(...searchParams.status);
    }
    if (searchParams.start) {
      whereClause += ` AND created_at >= ?`;
      queryParams.push(searchParams.start);
    }
    if (searchParams.end) {
      whereClause += ` AND created_at <= ?`;
      queryParams.push(searchParams.end);
    }

    const query = `SELECT id, created_at as creationDate, completed_date as compeltedDate, type, status, error, content FROM ${OIANALYTICS_MESSAGE_TABLE} ${whereClause} ORDER BY created_at DESC;`;
    const results: Array<any> = this.database.prepare(query).all(...queryParams);
    return results.map(result => ({
      id: result.id,
      creationDate: result.creationDate,
      type: result.type,
      status: result.status,
      error: result.error,
      completedDate: result.completedDate,
      content: JSON.parse(result.content)
    })) as Array<OIAnalyticsMessageDTO>;
  }

  /**
   * Update a message
   */
  updateOIAnalyticsMessages(id: string, content: InfoMessage): void {
    const query = `UPDATE ${OIANALYTICS_MESSAGE_TABLE} SET content = ? WHERE id = ?;`;
    this.database.prepare(query).run(JSON.stringify(content), id);
  }

  /**
   * Create a message
   */
  createOIAnalyticsMessages(type: string, content: InfoMessage): OIAnalyticsMessageDTO {
    const insertQuery = `INSERT INTO ${OIANALYTICS_MESSAGE_TABLE} (id, type, status, content) VALUES (?, ?, ?, ?);`;
    const insertResult = this.database.prepare(insertQuery).run(generateRandomId(), type, 'PENDING', JSON.stringify(content));

    const query =
      `SELECT id, created_at as creationDate, completed_date as compeltedDate, type, status, error, content FROM ${OIANALYTICS_MESSAGE_TABLE} ` +
      `WHERE ROWID = ?;`;
    const result: any = this.database.prepare(query).get(insertResult.lastInsertRowid);
    return {
      ...result,
      content: JSON.parse(result.content)
    } as OIAnalyticsMessageDTO;
  }

  markAsCompleted(id: string, completedDate: Instant): void {
    const query = `UPDATE ${OIANALYTICS_MESSAGE_TABLE} SET status = 'COMPLETED', completed_date = ? WHERE id = ?;`;
    this.database.prepare(query).run(completedDate, id);
  }

  markAsErrored(id: string, completedDate: Instant, result: string): void {
    const query = `UPDATE ${OIANALYTICS_MESSAGE_TABLE} SET status = 'ERRORED', completed_date = ?, error = ? WHERE id = ?;`;
    this.database.prepare(query).run(completedDate, result, id);
  }
}
