import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import { Database } from 'better-sqlite3';

import { emptyDatabase, initDatabase } from '../../tests/utils/database-utils';
import testData from '../../tests/utils/test-data';
import CryptoRepository from './crypto.repository';

const TEST_DB_PATH = 'src/tests/test-crypto-db.db';

let database: Database;
describe('Repository with populated database', () => {
  before(async () => {
    database = await initDatabase('crypto', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('crypto', TEST_DB_PATH);
  });

  describe('Crypto', () => {
    let repository: CryptoRepository;

    beforeEach(() => {
      repository = new CryptoRepository(database);
    });

    afterEach(() => {
      mock.restoreAll();
    });

    it('should not create crypto if already init', () => {
      const randomBytesMock = mock.method(crypto, 'randomBytes');

      repository.createCryptoSettings(testData.engine.settings.id);
      assert.strictEqual(randomBytesMock.mock.calls.length, 0);
    });

    it('should properly get crypto settings', () => {
      assert.deepStrictEqual(repository.getCryptoSettings(testData.engine.settings.id), testData.engine.crypto);
    });
  });
});

describe('Repository with empty database', () => {
  before(async () => {
    database = await initDatabase('crypto', false, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('crypto', TEST_DB_PATH);
  });

  describe('Crypto', () => {
    let repository: CryptoRepository;

    beforeEach(() => {
      repository = new CryptoRepository(database);
    });

    afterEach(() => {
      mock.restoreAll();
    });

    it('should properly init crypto settings table', () => {
      const randomBytesMock = mock.method(crypto, 'randomBytes');
      randomBytesMock.mock.mockImplementationOnce(() => Buffer.from('security key'), 0);

      repository.createCryptoSettings('id1');
      assert.strictEqual(randomBytesMock.mock.calls.length, 1);
      assert.deepStrictEqual(randomBytesMock.mock.calls[0].arguments, [32]);

      assert.deepStrictEqual(repository.getCryptoSettings('id1'), {
        securityKey: Buffer.from('security key').toString('base64')
      });
    });
  });
});
