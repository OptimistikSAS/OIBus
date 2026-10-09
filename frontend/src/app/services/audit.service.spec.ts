import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { AuditLogDTO } from '@oibus/shared/api/audit.model';

import { expectHttp } from '../../test/http-testing';
import { toPage } from '../shared/utils/page.utils';
import { AuditService } from './audit.service';

const auditLog: AuditLogDTO = {
  id: 'id1',
  entityType: 'south_connector',
  entityId: 'entityId1',
  action: 'UPDATE',
  previousState: { name: 'old' },
  newState: { name: 'new' },
  entity: { exists: true, name: 'South 1', parentId: null },
  user: { id: 'userId1', friendlyName: 'User 1' },
  createdAt: '2023-01-01T00:00:00.000Z'
};

describe('AuditService', () => {
  let http: HttpTestingController;
  let service: AuditService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AuditService);
  });

  afterEach(() => http.verify());

  test('should search audit logs with all filters', async () => {
    const auditLogs = toPage([auditLog]);

    const result = await expectHttp(
      http,
      service.search({
        page: 1,
        entityType: 'south_connector',
        entityId: 'entityId1',
        action: 'CREATE',
        start: '2023-01-01T00:00:00.000Z',
        end: '2023-01-02T00:00:00.000Z'
      }),
      {
        url: '/api/audit?page=1&entityType=south_connector&entityId=entityId1&action=CREATE&start=2023-01-01T00:00:00.000Z&end=2023-01-02T00:00:00.000Z',
        method: 'GET'
      },
      { response: auditLogs }
    );

    expect(result).toEqual(auditLogs);
  });

  test('should search audit logs without optional filters', async () => {
    const auditLogs = toPage<AuditLogDTO>([]);

    const result = await expectHttp(http, service.search({}), { url: '/api/audit?page=0', method: 'GET' }, { response: auditLogs });

    expect(result).toEqual(auditLogs);
  });

  test('should get the history of an entity', async () => {
    const result = await expectHttp(
      http,
      service.getHistory('south_connector', 'entityId1'),
      { url: '/api/audit/south_connector/entityId1', method: 'GET' },
      { response: [auditLog] }
    );

    expect(result).toEqual([auditLog]);
  });
});
