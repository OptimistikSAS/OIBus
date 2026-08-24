import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { AuditAction, AuditEntityType, AuditLog, AuditSearchParam } from '../../../../model/audit.model';
import { Page } from '../../../../../shared/model/types';
import AuditRepository from '../../../../repository/config/audit.repository';

const EMPTY_PAGE: Page<AuditLog> = { content: [], size: 50, number: 0, totalElements: 0, totalPages: 0 };

/**
 * Create a mock object for Audit repository
 */
export default class AuditRepositoryMock extends AuditRepository {
  constructor() {
    super({} as Database);
  }
  override record = mock.fn(
    (
      _entityType: AuditEntityType,
      _entityId: string,
      _action: AuditAction,
      _previousState: Record<string, unknown> | null,
      _newState: Record<string, unknown> | null,
      _userId: string,
      _id?: string
    ): void => undefined
  );
  override search = mock.fn((_searchParams: AuditSearchParam): Page<AuditLog> => EMPTY_PAGE);
  override findByEntity = mock.fn((_entityType: AuditEntityType, _entityId: string): Array<AuditLog> => []);
  override deleteOlderThan = mock.fn((_cutoffIso: string): void => undefined);
}
