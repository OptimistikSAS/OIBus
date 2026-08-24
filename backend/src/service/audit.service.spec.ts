import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import AuditService from './audit.service';
import AuditRepository from '../repository/config/audit.repository';
import { AuditLog } from '../model/audit.model';

let auditRepository: { record: ReturnType<typeof mock.fn>; search: ReturnType<typeof mock.fn>; findByEntity: ReturnType<typeof mock.fn> };
let service: AuditService;

describe('Audit Service', () => {
  beforeEach(() => {
    auditRepository = {
      record: mock.fn(),
      search: mock.fn(),
      findByEntity: mock.fn()
    };
    service = new AuditService(auditRepository as unknown as AuditRepository);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should record an audit log and strip bookkeeping fields from both entities', () => {
    const previousEntity = {
      id: 'id1',
      createdAt: '2020-01-01T00:00:00.000Z',
      createdBy: 'user1',
      updatedAt: '2020-01-02T00:00:00.000Z',
      updatedBy: 'user1',
      name: 'old name',
      port: 502
    };
    const newEntity = {
      id: 'id1',
      createdAt: '2020-01-01T00:00:00.000Z',
      createdBy: 'user1',
      updatedAt: '2020-01-03T00:00:00.000Z',
      updatedBy: 'user2',
      name: 'new name',
      port: 503
    };

    service.record('south_connector', 'id1', 'UPDATE', previousEntity, newEntity, 'user2');

    assert.strictEqual(auditRepository.record.mock.calls.length, 1);
    assert.deepStrictEqual(auditRepository.record.mock.calls[0].arguments, [
      'south_connector',
      'id1',
      'UPDATE',
      { name: 'old name', port: 502 },
      { name: 'new name', port: 503 },
      'user2'
    ]);
  });

  it('should not call the repository when the userId is "system"', () => {
    service.record('south_connector', 'id1', 'CREATE', null, { name: 'my south' }, 'system');

    assert.strictEqual(auditRepository.record.mock.calls.length, 0);
  });

  it('should call the repository when the userId is "oianalytics"', () => {
    service.record('south_connector', 'id1', 'CREATE', null, { name: 'my south' }, 'oianalytics');

    assert.strictEqual(auditRepository.record.mock.calls.length, 1);
    assert.deepStrictEqual(auditRepository.record.mock.calls[0].arguments, [
      'south_connector',
      'id1',
      'CREATE',
      null,
      { name: 'my south' },
      'oianalytics'
    ]);
  });

  it('should handle a null previous entity (CREATE) without throwing', () => {
    service.record('south_connector', 'id1', 'CREATE', null, { name: 'my south' }, 'user1');

    assert.deepStrictEqual(auditRepository.record.mock.calls[0].arguments, [
      'south_connector',
      'id1',
      'CREATE',
      null,
      { name: 'my south' },
      'user1'
    ]);
  });

  it('should handle a null new entity (DELETE) without throwing', () => {
    service.record('south_connector', 'id1', 'DELETE', { name: 'my south' }, null, 'user1');

    assert.deepStrictEqual(auditRepository.record.mock.calls[0].arguments, [
      'south_connector',
      'id1',
      'DELETE',
      { name: 'my south' },
      null,
      'user1'
    ]);
  });

  it('should pass search through to the repository', () => {
    const expectedResult = { content: [] as Array<AuditLog>, size: 50, number: 0, totalElements: 0, totalPages: 0 };
    auditRepository.search.mock.mockImplementationOnce(() => expectedResult);

    const searchParams = { entityType: 'south_connector' as const, page: 0 };
    const result = service.search(searchParams);

    assert.deepStrictEqual(auditRepository.search.mock.calls[0].arguments, [searchParams]);
    assert.strictEqual(result, expectedResult);
  });

  it('should pass findByEntity through to the repository', () => {
    const expectedResult: Array<AuditLog> = [];
    auditRepository.findByEntity.mock.mockImplementationOnce(() => expectedResult);

    const result = service.findByEntity('south_connector', 'id1');

    assert.deepStrictEqual(auditRepository.findByEntity.mock.calls[0].arguments, ['south_connector', 'id1']);
    assert.strictEqual(result, expectedResult);
  });
});
