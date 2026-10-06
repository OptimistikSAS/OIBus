import { UserInfo } from '../common/types';
import { AuditAction, AuditEntityType } from '../domain/audit.model';

/**
 * Information about the entity an audit log entry relates to, resolved at read time.
 */
export interface AuditEntityInfoDTO {
  /**
   * Whether the audited entity still exists in the configuration.
   */
  exists: boolean;

  /**
   * Current name of the entity if it exists, otherwise its last known name from the recorded snapshots.
   * @example "My South connector"
   */
  name: string | null;

  /**
   * Identifier of the owning entity (south connector, north connector or history query) for child entities
   * (items, groups, configuration workflows, transformers). `null` otherwise, or when the entity no longer exists.
   */
  parentId: string | null;
}

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
   * Information about the audited entity (name, existence, owning entity).
   */
  entity: AuditEntityInfoDTO;

  /**
   * The user who performed the change.
   */
  user: UserInfo;

  /**
   * ISO timestamp of when the change was recorded.
   * @example "2026-01-01T00:00:00.000Z"
   */
  createdAt: string;
}
