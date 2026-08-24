import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { AuditAction, AuditEntityType, AuditLog, AuditSearchParam } from '../../model/audit.model';
import { Page } from '../../../shared/model/types';

const AUDIT_LOGS_TABLE = 'audit_logs';

const PAGE_SIZE = 50;

/**
 * Repository used for recording and searching audit log entries
 */
export default class AuditRepository {
  constructor(private readonly database: Database) {}

  record(
    entityType: AuditEntityType,
    entityId: string,
    action: AuditAction,
    previousState: Record<string, unknown> | null,
    newState: Record<string, unknown> | null,
    userId: string,
    id = generateRandomId(6)
  ): void {
    const query = `INSERT INTO ${AUDIT_LOGS_TABLE} (id, entity_type, entity_id, action, previous_state, new_state, user_id, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
    this.database
      .prepare(query)
      .run(
        id,
        entityType,
        entityId,
        action,
        previousState !== null ? JSON.stringify(previousState) : null,
        newState !== null ? JSON.stringify(newState) : null,
        userId
      );
  }

  search(searchParams: AuditSearchParam): Page<AuditLog> {
    const queryParams = [];
    let whereClause = 'WHERE id IS NOT NULL';
    if (searchParams.entityType) {
      whereClause += ` AND entity_type = ?`;
      queryParams.push(searchParams.entityType);
    }
    if (searchParams.entityId) {
      whereClause += ` AND entity_id = ?`;
      queryParams.push(searchParams.entityId);
    }
    if (searchParams.action) {
      whereClause += ` AND action = ?`;
      queryParams.push(searchParams.action);
    }
    if (searchParams.start) {
      whereClause += ` AND created_at >= ?`;
      queryParams.push(searchParams.start);
    }
    if (searchParams.end) {
      whereClause += ` AND created_at <= ?`;
      queryParams.push(searchParams.end);
    }

    const query = `SELECT *
                   FROM ${AUDIT_LOGS_TABLE} ${whereClause}
                   ORDER BY created_at DESC
                   LIMIT ${PAGE_SIZE} OFFSET ?;`;
    const results: Array<AuditLog> = this.database
      .prepare(query)
      .all(...queryParams, PAGE_SIZE * searchParams.page)
      .map(result => this.toAuditLog(result as Record<string, string>));
    const totalElements = (
      this.database
        .prepare(
          `SELECT COUNT(*) as count
           FROM ${AUDIT_LOGS_TABLE} ${whereClause}`
        )
        .get(...queryParams) as { count: number }
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

  findByEntity(entityType: AuditEntityType, entityId: string): Array<AuditLog> {
    const query = `SELECT *
                   FROM ${AUDIT_LOGS_TABLE}
                   WHERE entity_type = ? AND entity_id = ?
                   ORDER BY created_at DESC;`;
    return this.database
      .prepare(query)
      .all(entityType, entityId)
      .map(result => this.toAuditLog(result as Record<string, string>));
  }

  deleteOlderThan(cutoffIso: string): void {
    const query = `DELETE FROM ${AUDIT_LOGS_TABLE} WHERE created_at < ?;`;
    this.database.prepare(query).run(cutoffIso);
  }

  private toAuditLog(result: Record<string, string>): AuditLog {
    return {
      id: result.id,
      entityType: result.entity_type as AuditEntityType,
      entityId: result.entity_id,
      action: result.action as AuditAction,
      previousState: result.previous_state !== null ? JSON.parse(result.previous_state) : null,
      newState: result.new_state !== null ? JSON.parse(result.new_state) : null,
      userId: result.user_id,
      createdAt: result.created_at
    };
  }
}
