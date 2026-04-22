import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import ScanModeRepository from './scan-mode.repository';

const TEST_DB_PATH = 'src/tests/test-config-scan-mode.db';

let database: Database;
describe('ScanModeRepository with populated database', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: ScanModeRepository;
  let createdId: string;

  beforeEach(() => {
    repository = new ScanModeRepository(database);
  });

  it('should properly get all scan modes', () => {
    assert.strictEqual(repository.findAll().length, testData.scanMode.list.length);
  });

  it('should properly get a scan mode', () => {
    assert.deepStrictEqual(
      stripAuditFields(repository.findById(testData.scanMode.list[0].id)),
      stripAuditFields(testData.scanMode.list[0])
    );
    assert.strictEqual(repository.findById('badId'), null);
  });

  it('should create a scan mode', () => {
    const created = repository.create(testData.scanMode.command, 'userTest');
    createdId = created.id;
    assert.ok(createdId);
    assert.strictEqual(created.createdBy, 'userTest');
    assert.strictEqual(created.updatedBy, 'userTest');
    assert.strictEqual(created.name, testData.scanMode.command.name);
    assert.strictEqual(created.description, testData.scanMode.command.description);
    assert.strictEqual(created.cron, testData.scanMode.command.cron);
  });

  it('should update a scan mode', () => {
    repository.update(createdId, testData.scanMode.command, 'userTest');
    const result = repository.findById(createdId)!;
    assert.strictEqual(result.name, testData.scanMode.command.name);
    assert.strictEqual(result.updatedBy, 'userTest');
  });

  it('should delete a scan mode', () => {
    assert.notStrictEqual(repository.findById(createdId), null);
    repository.delete(createdId);
    assert.strictEqual(repository.findById(createdId), null);
  });
});

describe('ScanModeRepository with empty database', () => {
  before(async () => {
    database = await initDatabase('config', false, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  it('should properly init scan mode table with default scan modes', () => {
    const repository = new ScanModeRepository(database);
    // 7 default scan modes are created (6 with generated IDs + 1 with hardcoded 'subscription' id)
    assert.strictEqual(repository.findAll().length, 7);
  });
});
