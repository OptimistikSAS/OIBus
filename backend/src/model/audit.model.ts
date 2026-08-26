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
