import { AuditAction, AuditEntityType } from '../../shared/model/audit.model';

export type { AuditAction, AuditEntityType };

export interface AuditLog {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  userId: string;
  createdAt: string;
}

export interface AuditSearchParam {
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  start?: string;
  end?: string;
  page: number;
}

export interface AuditEntityInfo {
  /**
   * Whether the audited entity still exists in the configuration
   */
  exists: boolean;
  /**
   * Current name of the entity if it exists, otherwise its last known name from the recorded snapshots.
   */
  name: string | null;
  /**
   * Identifier of the owning entity (south connector, north connector or history query) for child entities
   * (items, groups, workflows, transformers). Null otherwise, or when the entity no longer exists.
   */
  parentId: string | null;
}
