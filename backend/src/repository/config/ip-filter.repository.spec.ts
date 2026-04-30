import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import IpFilterRepository from './ip-filter.repository';

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
  let createdId: string;

  beforeEach(() => {
    repository = new IpFilterRepository(database);
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
  });

  it('update() should update an IP filter', () => {
    repository.update(createdId, testData.ipFilters.command, 'userTest');
    const result = repository.findById(createdId)!;
    assert.strictEqual(result.address, testData.ipFilters.command.address);
    assert.strictEqual(result.updatedBy, 'userTest');
  });

  it('delete() should delete an IP filter', () => {
    assert.notStrictEqual(repository.findById(createdId), null);
    repository.delete(createdId);
    assert.strictEqual(repository.findById(createdId), null);
  });
});
