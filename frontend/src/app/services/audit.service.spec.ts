import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { Page } from '../../../../backend/shared/model/types';
import { toPage } from '../shared/test-utils';
import { AuditService } from './audit.service';
import { AuditLogDTO } from '../../../../backend/shared/model/audit.model';

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

  test('should search audit logs with all filters', () => {
    let expectedAuditLogs: Page<AuditLogDTO> | null = null;
    const auditLogs = toPage<AuditLogDTO>([
      {
        id: 'id1',
        entityType: 'south_connector',
        entityId: 'entityId1',
        action: 'CREATE',
        previousState: null,
        newState: { name: 'my south' },
        userId: 'userId1',
        createdAt: '2023-01-01T00:00:00.000Z'
      }
    ]);

    service
      .search({
        page: 0,
        entityType: 'south_connector',
        entityId: 'entityId1',
        action: 'CREATE',
        start: '2023-01-01T00:00:00.000Z',
        end: '2023-01-02T00:00:00.000Z'
      })
      .subscribe(c => (expectedAuditLogs = c));

    http
      .expectOne({
        url: '/api/audit?page=0&entityType=south_connector&entityId=entityId1&action=CREATE&start=2023-01-01T00:00:00.000Z&end=2023-01-02T00:00:00.000Z',
        method: 'GET'
      })
      .flush(auditLogs);
    expect(expectedAuditLogs!).toEqual(auditLogs);
  });

  test('should search audit logs without optional filters', () => {
    let expectedAuditLogs: Page<AuditLogDTO> | null = null;
    const auditLogs = toPage<AuditLogDTO>([]);

    service.search({}).subscribe(c => (expectedAuditLogs = c));

    http
      .expectOne({
        url: '/api/audit?page=0',
        method: 'GET'
      })
      .flush(auditLogs);
    expect(expectedAuditLogs!).toEqual(auditLogs);
  });

  test('should get history for an entity', () => {
    let expectedHistory: Array<AuditLogDTO> = [];
    const history: Array<AuditLogDTO> = [
      {
        id: 'id1',
        entityType: 'south_connector',
        entityId: 'entityId1',
        action: 'UPDATE',
        previousState: { name: 'old' },
        newState: { name: 'new' },
        userId: 'userId1',
        createdAt: '2023-01-01T00:00:00.000Z'
      }
    ];

    service.getHistory('south_connector', 'entityId1').subscribe(c => (expectedHistory = c));

    http
      .expectOne({
        url: '/api/audit/south_connector/entityId1',
        method: 'GET'
      })
      .flush(history);
    expect(expectedHistory!).toEqual(history);
  });
});
