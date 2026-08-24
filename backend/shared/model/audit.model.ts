export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type AuditEntityType =
  | 'south_connector'
  | 'south_item'
  | 'south_item_group'
  | 'north_connector'
  | 'north_transformer'
  | 'history_query'
  | 'history_query_item'
  | 'history_query_transformer'
  | 'scan_mode'
  | 'ip_filter'
  | 'certificate'
  | 'user'
  | 'transformer'
  | 'engine'
  | 'oianalytics_registration';

/**
 * Data Transfer Object for an audit log entry.
 * Represents a single create/update/delete event recorded against an audited entity.
 */
export interface AuditLogDTO {
  /**
   * The unique identifier of the audit log entry.
   */
  id: string;

  /**
   * The type of entity this audit log entry relates to.
   * @example "south_connector"
   */
  entityType: AuditEntityType;

  /**
   * The identifier of the entity this audit log entry relates to.
   */
  entityId: string;

  /**
   * The kind of change performed on the entity.
   * @example "UPDATE"
   */
  action: AuditAction;

  /**
   * A JSON snapshot of the entity before the change. `null` for `CREATE`.
   */
  previousState: Record<string, unknown> | null;

  /**
   * A JSON snapshot of the entity after the change. `null` for `DELETE`.
   */
  newState: Record<string, unknown> | null;

  /**
   * The identifier of the user who performed the change.
   */
  userId: string;

  /**
   * ISO timestamp of when the change was recorded.
   * @example "2026-01-01T00:00:00.000Z"
   */
  createdAt: string;
}
