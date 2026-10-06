/**
 * List of possible audit actions.
 */
export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;
/**
 * Type representing an audit action.
 * @example 'UPDATE'
 */
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * List of possible audited entity types.
 */
export const AUDIT_ENTITY_TYPES = [
  'south_connector',
  'south_item',
  'south_item_group',
  'configuration_workflow',
  'north_connector',
  'north_transformer',
  'history_query',
  'history_query_item',
  'history_query_transformer',
  'scan_mode',
  'ip_filter',
  'certificate',
  'user',
  'transformer',
  'engine_general',
  'engine_web_server',
  'engine_proxy_server',
  'engine_logging',
  'oianalytics_registration'
] as const;
/**
 * Type representing an audited entity type.
 * @example 'south_connector'
 */
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
