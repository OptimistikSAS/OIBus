export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type AuditEntityType =
  | 'south_connector'
  | 'south_item'
  | 'south_item_group'
  | 'configuration_workflow'
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
