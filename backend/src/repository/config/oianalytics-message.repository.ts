import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { Instant, Page } from '../../../../shared/model/types';
import {
  OIAnalyticsMessageSearchParam,
  OIAnalyticsMessageStatus,
  OIAnalyticsMessageType
} from '../../../../shared/model/oianalytics-message.model';
import { OIAnalyticsMessage } from '../../model/oianalytics-message.model';

export const OIANALYTICS_MESSAGE_TABLE = 'oianalytics_messages';
const PAGE_SIZE = 50;

/**
 * Repository used for managing actions that need to be managed for OIAnalytics communication
 */
export default class OIAnalyticsMessageRepository {
  constructor(private readonly database: Database) {}

  search(searchParams: OIAnalyticsMessageSearchParam, page: number): Page<OIAnalyticsMessage> {
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

    const query = `SELECT * FROM ${OIANALYTICS_MESSAGE_TABLE} ${whereClause} ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ?;`;
    const results: Array<OIAnalyticsMessage> = this.database
      .prepare(query)
      .all(...queryParams, PAGE_SIZE * page)
      .map(result => this.toMessage(result as Record<string, string>));
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${OIANALYTICS_MESSAGE_TABLE} ${whereClause};`).get(...queryParams) as {
        count: number;
      }
    ).count;
    const totalPages = Math.ceil(totalElements / PAGE_SIZE);

    return {
      content: results,
      size: PAGE_SIZE,
      number: page,
      totalElements,
      totalPages
    };
  }

  list(searchParams: OIAnalyticsMessageSearchParam): Array<OIAnalyticsMessage> {
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

    const query = `SELECT * FROM ${OIANALYTICS_MESSAGE_TABLE} ${whereClause} ORDER BY created_at DESC;`;
    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toMessage(result as Record<string, string>));
  }

  findById(id: string): OIAnalyticsMessage | null {
    const query = `SELECT *
                   FROM ${OIANALYTICS_MESSAGE_TABLE}
                   WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return result ? this.toMessage(result as Record<string, string>) : null;
  }

  create(message: Omit<OIAnalyticsMessage, 'id' | 'status' | 'completedDate' | 'error'>): OIAnalyticsMessage {
    // id, type, status
    const queryParams = [generateRandomId(), message.type, 'PENDING'];
    let insertQuery = `INSERT INTO ${OIANALYTICS_MESSAGE_TABLE} `;

    switch (message.type) {
      case 'full-config':
        insertQuery += `(id, type, status) VALUES (?, ?, ?);`;
        break;
    }
    const result = this.database.prepare(insertQuery).run(...queryParams);
    const query = `SELECT * FROM ${OIANALYTICS_MESSAGE_TABLE} WHERE ROWID = ?;`;
    return this.toMessage(this.database.prepare(query).get(result.lastInsertRowid) as Record<string, string>);
  }

  markAsCompleted(id: string, completedDate: Instant): void {
    const query = `UPDATE ${OIANALYTICS_MESSAGE_TABLE} SET status = 'COMPLETED', completed_date = ? WHERE id = ?;`;
    this.database.prepare(query).run(completedDate, id);
  }

  markAsErrored(id: string, completedDate: Instant, result: string): void {
    const query = `UPDATE ${OIANALYTICS_MESSAGE_TABLE} SET status = 'ERRORED', completed_date = ?, error = ? WHERE id = ?;`;
    this.database.prepare(query).run(completedDate, result, id);
  }

  private toMessage(message: Record<string, string>): OIAnalyticsMessage {
    switch (message.type as OIAnalyticsMessageType) {
      case 'full-config':
        return {
          id: message.id,
          type: message.type as OIAnalyticsMessageType,
          status: message.status as OIAnalyticsMessageStatus,
          error: message.error,
          completedDate: message.completed_date
        };
    }
  }
}
