import AuditRepository from '../repository/config/audit.repository';
import { AuditAction, AuditEntityInfo, AuditEntityType, AuditLog, AuditSearchParam } from '../model/audit.model';
import { Page } from '../../shared/model/types';

// Tracking fields, removed from every level of the snapshots (the entity itself and its sub entities: items, groups,
// scan modes…) since the audit log records by itself who changed what and when
const TRACKING_FIELDS = new Set(['createdAt', 'createdBy', 'updatedAt', 'updatedBy']);
// 'system' is the only non-real-user sentinel used for created_by/updated_by across the codebase
// (bootstrap/migrations, see user.repository.ts, scan-mode.repository.ts, engine.repository.ts,
// oianalytics-message.repository.ts, oianalytics-registration.repository.ts). 'oianalytics' is a
// genuine actor (changes pushed from OIAnalytics) and must remain auditable.
const NON_AUDITABLE_USER_IDS = new Set(['system']);

function stripTrackingFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTrackingFields);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !TRACKING_FIELDS.has(key))
      .map(([key, element]) => [key, stripTrackingFields(element)])
  );
}

/**
 * Remove the entity id (already recorded as the audit log entity id) and the tracking fields of the entity and of
 * its sub entities. Sub entity ids are kept to identify them.
 */
function strip(entity: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!entity) return null;
  const { id: _id, ...rest } = entity;
  return stripTrackingFields(rest) as Record<string, unknown>;
}

/**
 * Value recorded in place of a secret (password, token, key…) whose value changed. Secrets are never stored in the
 * audit trail, but this marker lets users know a secret was modified (or set on creation).
 */
export const CHANGED_SECRET = '<changed>';

const isContainer = (value: unknown): value is Record<string, unknown> | Array<unknown> => typeof value === 'object' && value !== null;
const isSame = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const isEmptySecret = (value: unknown): boolean => value === undefined || value === null || value === '';
const childOf = (value: unknown, key: string | number): unknown =>
  isContainer(value) ? (value as Record<string | number, unknown>)[key] : undefined;

/**
 * Walk the redacted new snapshot alongside the raw ones. A value is a secret when the redaction altered it (in the
 * previous or new snapshot); when its raw value differs between both snapshots, it is replaced by CHANGED_SECRET.
 * Returns a new structure: redacted snapshots may share nested references with the raw entities.
 */
function markChangedSecrets(rawPrevious: unknown, rawNew: unknown, redactedPrevious: unknown, redactedNew: unknown): unknown {
  if (Array.isArray(redactedNew)) {
    return redactedNew.map((value, index) =>
      markChangedSecrets(childOf(rawPrevious, index), childOf(rawNew, index), childOf(redactedPrevious, index), value)
    );
  }
  if (isContainer(redactedNew) && isContainer(rawNew)) {
    return Object.fromEntries(
      Object.entries(redactedNew).map(([key, value]) => [
        key,
        markChangedSecrets(childOf(rawPrevious, key), childOf(rawNew, key), childOf(redactedPrevious, key), value)
      ])
    );
  }
  const isSecret = !isSame(rawNew, redactedNew) || (rawPrevious !== undefined && !isSame(rawPrevious, redactedPrevious));
  const changed = !isSame(rawPrevious, rawNew) && !(isEmptySecret(rawPrevious) && isEmptySecret(rawNew));
  return isSecret && changed ? CHANGED_SECRET : redactedNew;
}

/**
 * Build the audit snapshots of an entity whose secrets are removed by `redact`. Secrets whose value changed between
 * both states (or that are set on creation) are recorded as CHANGED_SECRET in the new snapshot.
 */
export function redactAuditSnapshots<T>(
  previousEntity: T | null,
  newEntity: T | null,
  redact: (entity: T) => Record<string, unknown> | null
): [Record<string, unknown> | null, Record<string, unknown> | null] {
  const redactedPrevious = previousEntity ? redact(previousEntity) : null;
  const redactedNew = newEntity ? redact(newEntity) : null;
  if (!redactedNew) {
    return [redactedPrevious, null];
  }
  return [
    redactedPrevious,
    markChangedSecrets(previousEntity ?? undefined, newEntity, redactedPrevious ?? undefined, redactedNew) as Record<string, unknown>
  ];
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
