import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import CryptoRepository from './crypto.repository';
import { initDatabase, emptyDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import type { Database } from 'better-sqlite3';

const TEST_DB_PATH = 'src/tests/test-crypto-repo.db';

let database: Database;
let repository: CryptoRepository;

describe('CryptoRepository', () => {
  before(async () => {
    database = await initDatabase('crypto', true, TEST_DB_PATH);
    repository = new CryptoRepository(database);
  });

  after(async () => {
    database.close();
    await emptyDatabase('crypto', TEST_DB_PATH);
  });

  it('should return crypto settings when they exist', () => {
    const result = repository.getCryptoSettings(testData.engine.settings.id);

    assert.ok(result !== null);
    assert.strictEqual(result!.algorithm, testData.engine.crypto.algorithm);
    assert.strictEqual(result!.initVector, testData.engine.crypto.initVector);
    assert.strictEqual(result!.securityKey, testData.engine.crypto.securityKey);
  });

  it('should return null when crypto settings do not exist', () => {
    const result = repository.getCryptoSettings('non-existent-id');

    assert.strictEqual(result, null);
  });

  it('should skip createCryptoSettings when settings already exist', () => {
    // Settings for testData.engine.settings.id already exist from populateCryptoDatabase
    const beforeCount = (database.prepare('SELECT COUNT(*) as count FROM crypto').get() as { count: number }).count;

    repository.createCryptoSettings(testData.engine.settings.id);

    const afterCount = (database.prepare('SELECT COUNT(*) as count FROM crypto').get() as { count: number }).count;
    assert.strictEqual(afterCount, beforeCount);
  });

  it('should create crypto settings when they do not exist', () => {
    const newId = 'new-oibus-id';
    const beforeCount = (database.prepare('SELECT COUNT(*) as count FROM crypto').get() as { count: number }).count;

    repository.createCryptoSettings(newId);

    const afterCount = (database.prepare('SELECT COUNT(*) as count FROM crypto').get() as { count: number }).count;
    assert.strictEqual(afterCount, beforeCount + 1);

    const result = repository.getCryptoSettings(newId);
    assert.ok(result !== null);
    assert.strictEqual(result!.algorithm, 'aes-256-cbc');
    assert.ok(result!.initVector.length > 0);
    assert.ok(result!.securityKey.length > 0);
  });
});
