import { mock } from 'node:test';
import { AuditAction, AuditEntityType, AuditLog, AuditSearchParam } from '../../../model/audit.model';
import { Page } from '../../../../shared/model/types';

const EMPTY_PAGE: Page<AuditLog> = { content: [], size: 50, number: 0, totalElements: 0, totalPages: 0 };

/**
 * Create a mock object for Audit Service
 */
export default class AuditServiceMock {
  record = mock.fn(
    (
      _entityType: AuditEntityType,
      _entityId: string,
      _action: AuditAction,
      _previousEntity: Record<string, unknown> | null,
      _newEntity: Record<string, unknown> | null,
      _userId: string
    ): void => undefined
  );
  search = mock.fn((_searchParams: AuditSearchParam): Page<AuditLog> => EMPTY_PAGE);
  findByEntity = mock.fn((_entityType: AuditEntityType, _entityId: string): Array<AuditLog> => []);
}
