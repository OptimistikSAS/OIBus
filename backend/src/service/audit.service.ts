import AuditRepository from '../repository/config/audit.repository';
import { AuditAction, AuditEntityInfo, AuditEntityType, AuditLog, AuditSearchParam } from '../model/audit.model';
import { Page } from '../../shared/model/types';

const BOOKKEEPING_FIELDS = ['id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'] as const;
// 'system' is the only non-real-user sentinel used for created_by/updated_by across the codebase
// (bootstrap/migrations, see user.repository.ts, scan-mode.repository.ts, engine.repository.ts,
// oianalytics-message.repository.ts, oianalytics-registration.repository.ts). 'oianalytics' is a
// genuine actor (changes pushed from OIAnalytics) and must remain auditable.
const NON_AUDITABLE_USER_IDS = new Set(['system']);

function strip(entity: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!entity) return null;
  const clone = { ...entity };
  for (const field of BOOKKEEPING_FIELDS) delete clone[field];
  return clone;
}

// Snapshot field holding the display name of an entity, when it is not `name`
const SNAPSHOT_NAME_FIELDS: Partial<Record<AuditEntityType, string>> = {
  ip_filter: 'address',
  user: 'login',
  oianalytics_registration: 'host'
};

/**
 * Retrieve the last known name of an entity from the snapshots recorded in an audit log, used when the entity
 * does not exist anymore
 */
function nameFromSnapshot(auditLog: AuditLog): string | null {
  const state = auditLog.newState ?? auditLog.previousState;
  if (!state) return null;
  if (auditLog.entityType === 'north_transformer' || auditLog.entityType === 'history_query_transformer') {
    const transformer = state.transformer as Record<string, unknown> | undefined;
    const value = transformer?.name ?? transformer?.functionName;
    return typeof value === 'string' ? value : null;
  }
  const value = state[SNAPSHOT_NAME_FIELDS[auditLog.entityType] ?? 'name'];
  return typeof value === 'string' ? value : null;
}

export default class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  record(
    entityType: AuditEntityType,
    entityId: string,
    action: AuditAction,
    previousEntity: Record<string, unknown> | null,
    newEntity: Record<string, unknown> | null,
    userId: string
  ): void {
    if (NON_AUDITABLE_USER_IDS.has(userId)) return;
    this.auditRepository.record(entityType, entityId, action, strip(previousEntity), strip(newEntity), userId);
  }

  search(searchParams: AuditSearchParam): Page<AuditLog> {
    return this.auditRepository.search(searchParams);
  }

  findByEntity(entityType: AuditEntityType, entityId: string): Array<AuditLog> {
    return this.auditRepository.findByEntity(entityType, entityId);
  }

  /**
   * Resolve the current name and owning entity of the entity an audit log relates to. When the entity does not
   * exist anymore, its last known name is taken from the audit log snapshots.
   */
  getEntityInfo(auditLog: AuditLog): AuditEntityInfo {
    const reference = this.auditRepository.findEntityReference(auditLog.entityType, auditLog.entityId);
    if (reference) {
      return { exists: true, ...reference };
    }
    return { exists: false, name: nameFromSnapshot(auditLog), parentId: null };
  }
}
