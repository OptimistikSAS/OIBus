import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CustomExpressRequest } from '../express';
import { createMockServices, fixTsoaModuleResolution, reloadModule } from '../../tests/utils/test-utils';
import AuditServiceMock from '../../tests/__mocks__/service/audit-service.mock';
import { AuditSearchParam } from '../../model/audit.model';
import { createPageFromArray } from '../../../shared/model/types';
import type { AuditController as AuditControllerShape } from './audit.controller';

const nodeRequire = createRequire(import.meta.url);

let AuditController: typeof AuditControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  const mod = reloadModule<{ AuditController: typeof AuditControllerShape }>(nodeRequire, './audit.controller');
  AuditController = mod.AuditController;
});

const auditLog1 = {
  id: 'audit1',
  entityType: 'south_connector' as const,
  entityId: 'south1',
  action: 'CREATE' as const,
  previousState: null,
  newState: { name: 'south1' },
  userId: 'user1',
  createdAt: '2020-01-01T00:00:00.000Z'
};
const auditLog2 = {
  id: 'audit2',
  entityType: 'south_connector' as const,
  entityId: 'south1',
  action: 'UPDATE' as const,
  previousState: { name: 'south1' },
  newState: { name: 'south1-renamed' },
  userId: 'user1',
  createdAt: '2020-01-02T00:00:00.000Z'
};

describe('AuditController', () => {
  let controller: AuditControllerShape;
  let auditService: AuditServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    auditService = new AuditServiceMock();
    mockRequest = {
      services: createMockServices({ auditService })
    } as Partial<CustomExpressRequest>;
    controller = new AuditController();
  });

  describe('search()', () => {
    it('should pass parsed query params through to auditService.search() and map results', () => {
      const expectedResult = createPageFromArray([auditLog1, auditLog2], 50, 0);
      auditService.search = mock.fn(() => expectedResult);

      const result = controller.search(
        mockRequest as CustomExpressRequest,
        'south_connector',
        'south1',
        'CREATE',
        '2020-01-01',
        '2020-02-01',
        1
      );

      assert.strictEqual(auditService.search.mock.calls.length, 1);
      const searchParams: AuditSearchParam = {
        entityType: 'south_connector',
        entityId: 'south1',
        action: 'CREATE',
        start: '2020-01-01',
        end: '2020-02-01',
        page: 1
      };
      assert.deepStrictEqual(auditService.search.mock.calls[0].arguments[0], searchParams);
      assert.deepStrictEqual(result, {
        content: [auditLog1, auditLog2],
        totalElements: expectedResult.totalElements,
        size: expectedResult.size,
        number: expectedResult.number,
        totalPages: expectedResult.totalPages
      });
    });

    it('should default page to 0 and forward undefined filters when none are provided', () => {
      const expectedResult = createPageFromArray([], 50, 0);
      auditService.search = mock.fn(() => expectedResult);

      const result = controller.search(mockRequest as CustomExpressRequest);

      const searchParams: AuditSearchParam = {
        entityType: undefined,
        entityId: undefined,
        action: undefined,
        start: undefined,
        end: undefined,
        page: 0
      };
      assert.deepStrictEqual(auditService.search.mock.calls[0].arguments[0], searchParams);
      assert.deepStrictEqual(result.content, []);
    });
  });

  describe('history()', () => {
    it('should pass entityType/entityId through to auditService.findByEntity() and map results', () => {
      auditService.findByEntity = mock.fn(() => [auditLog2, auditLog1]);

      const result = controller.history(mockRequest as CustomExpressRequest, 'south_connector', 'south1');

      assert.strictEqual(auditService.findByEntity.mock.calls.length, 1);
      assert.deepStrictEqual(auditService.findByEntity.mock.calls[0].arguments, ['south_connector', 'south1']);
      assert.deepStrictEqual(result, [auditLog2, auditLog1]);
    });
  });
});
