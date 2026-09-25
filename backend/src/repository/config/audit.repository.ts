import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { AuditAction, AuditEntityType, AuditLog, AuditSearchParam } from '../../model/audit.model';
import { Page } from '../../../shared/model/types';

const AUDIT_LOGS_TABLE = 'audit_logs';

const PAGE_SIZE = 50;

interface EntityReferenceRow {
  name: string | null;
  parent_id: string | null;
}

/**
 * Per entity type, the query retrieving the current name of an entity and the id of its owning entity (if any).
 * `oianalytics_registration` has a single row, and its host is used as name. Standard transformers have no name,
 * their function name is used instead.
 */
const ENTITY_REFERENCE_QUERIES: Record<AuditEntityType, string> = {
  south_connector: `SELECT name, NULL AS parent_id FROM south_connectors WHERE id = ?;`,
  south_item: `SELECT name, connector_id AS parent_id FROM south_items WHERE id = ?;`,
  south_item_group: `SELECT name, south_id AS parent_id FROM south_item_groups WHERE id = ?;`,
  configuration_workflow: `SELECT name, south_id AS parent_id FROM configuration_workflows WHERE id = ?;`,
  north_connector: `SELECT name, NULL AS parent_id FROM north_connectors WHERE id = ?;`,
  north_transformer: `SELECT COALESCE(t.name, t.function_name) AS name, nt.north_id AS parent_id
                      FROM north_transformers nt JOIN transformers t ON t.id = nt.transformer_id WHERE nt.id = ?;`,
  history_query: `SELECT name, NULL AS parent_id FROM history_queries WHERE id = ?;`,
  history_query_item: `SELECT name, history_id AS parent_id FROM history_items WHERE id = ?;`,
  history_query_transformer: `SELECT COALESCE(t.name, t.function_name) AS name, ht.history_id AS parent_id
                              FROM history_query_transformers ht JOIN transformers t ON t.id = ht.transformer_id WHERE ht.id = ?;`,
  scan_mode: `SELECT name, NULL AS parent_id FROM scan_modes WHERE id = ?;`,
  ip_filter: `SELECT address AS name, NULL AS parent_id FROM ip_filters WHERE id = ?;`,
  certificate: `SELECT name, NULL AS parent_id FROM certificates WHERE id = ?;`,
  user: `SELECT login AS name, NULL AS parent_id FROM users WHERE id = ?;`,
  transformer: `SELECT name, NULL AS parent_id FROM transformers WHERE id = ?;`,
  engine: `SELECT name, NULL AS parent_id FROM engines WHERE id = ?;`,
  oianalytics_registration: `SELECT host AS name, NULL AS parent_id FROM registrations WHERE id = ?;`
};

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

  /**
   * Retrieve the current name and owning entity id of an audited entity, or null if it does not exist anymore
   */
  findEntityReference(entityType: AuditEntityType, entityId: string): { name: string | null; parentId: string | null } | null {
    const query = ENTITY_REFERENCE_QUERIES[entityType];
    if (!query) return null;
    const result = this.database.prepare(query).get(entityId) as EntityReferenceRow | undefined;
    if (!result) return null;
    return { name: result.name, parentId: result.parent_id };
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
