import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import AuditService, { redactAuditSnapshots } from './audit.service';
import AuditRepository from '../repository/config/audit.repository';
import { AuditLog } from '../model/audit.model';

let auditRepository: {
  record: ReturnType<typeof mock.fn>;
  search: ReturnType<typeof mock.fn>;
  findByEntity: ReturnType<typeof mock.fn>;
  findEntityReference: ReturnType<typeof mock.fn>;
};
let service: AuditService;

describe('Audit Service', () => {
  beforeEach(() => {
    auditRepository = {
      record: mock.fn(),
      search: mock.fn(),
      findByEntity: mock.fn(),
      findEntityReference: mock.fn(() => null)
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

  it('should strip tracking fields from sub entities, keeping their ids', () => {
    const tracking = {
      createdAt: '2020-01-01T00:00:00.000Z',
      createdBy: 'user1',
      updatedAt: '2020-01-02T00:00:00.000Z',
      updatedBy: 'user1'
    };
    const entity = {
      id: 'south1',
      ...tracking,
      name: 'my south',
      settings: { port: 502 },
      items: [
        {
          id: 'item1',
          ...tracking,
          name: 'item',
          scanMode: { id: 'scanMode1', ...tracking, name: 'every second' },
          group: null
        }
      ]
    };

    service.record('south_connector', 'south1', 'CREATE', null, entity, 'user1');

    assert.deepStrictEqual(auditRepository.record.mock.calls[0].arguments[4], {
      name: 'my south',
      settings: { port: 502 },
      items: [{ id: 'item1', name: 'item', scanMode: { id: 'scanMode1', name: 'every second' }, group: null }]
    });
    // The recorded entity is not altered
    assert.strictEqual(entity.items[0].createdBy, 'user1');
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

  describe('getEntityInfo()', () => {
    const baseLog: AuditLog = {
      id: 'audit1',
      entityType: 'south_connector',
      entityId: 'id1',
      action: 'UPDATE',
      previousState: { name: 'old name' },
      newState: { name: 'new name' },
      userId: 'user1',
      createdAt: '2020-01-01T00:00:00.000Z'
    };

    it('should return the current reference when the entity exists', () => {
      auditRepository.findEntityReference.mock.mockImplementationOnce(() => ({
        name: 'current name',
        parentId: null
      }));

      assert.deepStrictEqual(service.getEntityInfo(baseLog), {
        exists: true,
        name: 'current name',
        parentId: null
      });
      assert.deepStrictEqual(auditRepository.findEntityReference.mock.calls[0].arguments, ['south_connector', 'id1']);
    });

    it('should fall back on the new state name, then the previous state name, when the entity does not exist', () => {
      assert.deepStrictEqual(service.getEntityInfo(baseLog), {
        exists: false,
        name: 'new name',
        parentId: null
      });
      assert.deepStrictEqual(service.getEntityInfo({ ...baseLog, action: 'DELETE', newState: null }), {
        exists: false,
        name: 'old name',
        parentId: null
      });
      assert.deepStrictEqual(service.getEntityInfo({ ...baseLog, previousState: null, newState: null }), {
        exists: false,
        name: null,
        parentId: null
      });
    });

    it('should use the relevant snapshot field for entities without name', () => {
      assert.strictEqual(service.getEntityInfo({ ...baseLog, entityType: 'ip_filter', newState: { address: '1.1.1.1' } }).name, '1.1.1.1');
      assert.strictEqual(service.getEntityInfo({ ...baseLog, entityType: 'user', newState: { login: 'john' } }).name, 'john');
      assert.strictEqual(
        service.getEntityInfo({ ...baseLog, entityType: 'oianalytics_registration', newState: { host: 'http://oia' } }).name,
        'http://oia'
      );
      assert.strictEqual(service.getEntityInfo({ ...baseLog, newState: { name: 42 } }).name, null);
    });

    it('should retrieve transformer names from north/history transformer snapshots', () => {
      assert.deepStrictEqual(
        service.getEntityInfo({ ...baseLog, entityType: 'transformer', newState: { type: 'custom', name: 'my transformer' } }),
        { exists: false, name: 'my transformer', parentId: null }
      );
      assert.deepStrictEqual(
        service.getEntityInfo({
          ...baseLog,
          entityType: 'north_transformer',
          newState: { transformer: { type: 'custom', name: 'my transformer' } }
        }),
        { exists: false, name: 'my transformer', parentId: null }
      );
      assert.deepStrictEqual(
        service.getEntityInfo({
          ...baseLog,
          entityType: 'north_transformer',
          newState: { transformer: { type: 'standard', functionName: 'iso' } }
        }),
        { exists: false, name: 'iso', parentId: null }
      );
      assert.deepStrictEqual(service.getEntityInfo({ ...baseLog, entityType: 'history_query_transformer', newState: { options: {} } }), {
        exists: false,
        name: null,
        parentId: null
      });
    });
  });

  describe('redactAuditSnapshots()', () => {
    const redact = (entity: Record<string, unknown>) => ({
      ...entity,
      password: '',
      nested: { ...(entity.nested as Record<string, unknown>), token: '' },
      list: (entity.list as Array<Record<string, unknown>>).map(element => ({ ...element, secret: '' }))
    });
    const entity = {
      name: 'name',
      password: 'pass',
      nested: { token: 'token', port: 1 },
      list: [{ key: 'a', secret: 's1' }]
    };

    it('should hide unchanged secrets', () => {
      assert.deepStrictEqual(redactAuditSnapshots(entity, { ...entity, name: 'new name' }, redact), [
        { name: 'name', password: '', nested: { token: '', port: 1 }, list: [{ key: 'a', secret: '' }] },
        { name: 'new name', password: '', nested: { token: '', port: 1 }, list: [{ key: 'a', secret: '' }] }
      ]);
    });

    it('should mark changed secrets, including nested and array ones', () => {
      const [previousState, newState] = redactAuditSnapshots(
        entity,
        {
          ...entity,
          password: 'new pass',
          nested: { token: 'new token', port: 1 },
          list: [
            { key: 'a', secret: 's1' },
            { key: 'b', secret: 's2' }
          ]
        },
        redact
      );
      assert.deepStrictEqual(previousState, {
        name: 'name',
        password: '',
        nested: { token: '', port: 1 },
        list: [{ key: 'a', secret: '' }]
      });
      assert.deepStrictEqual(newState, {
        name: 'name',
        password: '<changed>',
        nested: { token: '<changed>', port: 1 },
        list: [
          { key: 'a', secret: '' },
          { key: 'b', secret: '<changed>' }
        ]
      });
    });

    it('should mark a cleared secret as changed', () => {
      const [, newState] = redactAuditSnapshots(entity, { ...entity, password: '' }, redact);
      assert.strictEqual(newState!.password, '<changed>');
    });

    it('should mark secrets set on creation, but not empty ones', () => {
      const [previousState, newState] = redactAuditSnapshots(null, { ...entity, password: null, nested: { token: '', port: 1 } }, redact);
      assert.strictEqual(previousState, null);
      assert.deepStrictEqual(newState, {
        name: 'name',
        password: '',
        nested: { token: '', port: 1 },
        list: [{ key: 'a', secret: '<changed>' }]
      });
    });

    it('should only redact the previous state on deletion', () => {
      assert.deepStrictEqual(redactAuditSnapshots(entity, null, redact), [
        { name: 'name', password: '', nested: { token: '', port: 1 }, list: [{ key: 'a', secret: '' }] },
        null
      ]);
    });

    it('should not alter the raw entities', () => {
      const newEntity = { ...entity, password: 'new pass' };
      redactAuditSnapshots(entity, newEntity, redact);
      assert.strictEqual(entity.password, 'pass');
      assert.strictEqual(newEntity.password, 'new pass');
    });
  });
});
