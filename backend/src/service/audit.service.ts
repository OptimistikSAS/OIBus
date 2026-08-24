import AuditRepository from '../repository/config/audit.repository';
import { AuditAction, AuditEntityType, AuditLog, AuditSearchParam } from '../model/audit.model';
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
}
