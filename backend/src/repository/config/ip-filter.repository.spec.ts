import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Database } from 'better-sqlite3';
import { createAuditServiceMock, emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import IpFilterRepository from './ip-filter.repository';
import AuditService from '../../service/audit.service';

const TEST_DB_PATH = 'src/tests/test-config-ip-filter.db';

let database: Database;
describe('IpFilterRepository', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: IpFilterRepository;
  let auditService: AuditService;
  let createdId: string;

  beforeEach(() => {
    auditService = createAuditServiceMock();
    repository = new IpFilterRepository(database, auditService);
  });

  it('findAll() should properly get all IP filters', () => {
    const result = repository.list().map(stripAuditFields);
    const expected = testData.ipFilters.list.map(stripAuditFields);
    assert.strictEqual(result.length, expected.length);
    for (let i = 0; i < expected.length; i++) {
      assert.deepStrictEqual(result[i], expected[i]);
    }
  });

  it('findById() should properly get an IP filter', () => {
    assert.deepStrictEqual(
      stripAuditFields(repository.findById(testData.ipFilters.list[0].id)),
      stripAuditFields(testData.ipFilters.list[0])
    );
    assert.strictEqual(repository.findById('badId'), null);
  });

  it('create() should create an IP filter', () => {
    const created = repository.create(testData.ipFilters.command, 'userTest');
    createdId = created.id;
    assert.ok(createdId);
    assert.strictEqual(created.createdBy, 'userTest');
    assert.strictEqual(created.updatedBy, 'userTest');
    assert.strictEqual(created.address, testData.ipFilters.command.address);
    assert.strictEqual(created.description, testData.ipFilters.command.description);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    assert.strictEqual(recordMock.mock.calls.length, 1);
    assert.deepStrictEqual(recordMock.mock.calls[0].arguments, ['ip_filter', created.id, 'CREATE', null, created, 'userTest']);
  });

  it('update() should update an IP filter', () => {
    const before = repository.findById(createdId);
    repository.update(createdId, testData.ipFilters.command, 'userTest');
    const result = repository.findById(createdId)!;
    assert.strictEqual(result.address, testData.ipFilters.command.address);
    assert.strictEqual(result.updatedBy, 'userTest');

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    assert.strictEqual(recordMock.mock.calls.length, 1);
    assert.deepStrictEqual(recordMock.mock.calls[0].arguments, ['ip_filter', createdId, 'UPDATE', before, result, 'userTest']);
  });

  it('delete() should delete an IP filter', () => {
    const before = repository.findById(createdId);
    assert.notStrictEqual(before, null);
    repository.delete(createdId, 'userTest');
    assert.strictEqual(repository.findById(createdId), null);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    assert.strictEqual(recordMock.mock.calls.length, 1);
    assert.deepStrictEqual(recordMock.mock.calls[0].arguments, ['ip_filter', createdId, 'DELETE', before, null, 'userTest']);
  });
});
