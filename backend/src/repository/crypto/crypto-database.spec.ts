import { before, after, beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import CryptoRepository from './crypto.repository';
import testData from '../../tests/utils/test-data';

let database: Database;
describe('Repository with populated database', () => {
  before(async () => {
    database = await initDatabase('crypto');
  });

  after(async () => {
    database.close();
    await emptyDatabase('crypto');
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
    database = await initDatabase('crypto', false);
  });

  after(async () => {
    database.close();
    await emptyDatabase('crypto');
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
      randomBytesMock.mock.mockImplementationOnce(() => Buffer.from('init vector'), 0);
      randomBytesMock.mock.mockImplementationOnce(() => Buffer.from('security key'), 1);

      repository.createCryptoSettings('id1');
      assert.strictEqual(randomBytesMock.mock.calls.length, 2);
      assert.deepStrictEqual(randomBytesMock.mock.calls[0].arguments, [16]);
      assert.deepStrictEqual(randomBytesMock.mock.calls[1].arguments, [32]);

      assert.deepStrictEqual(repository.getCryptoSettings('id1'), {
        algorithm: 'aes-256-cbc',
        initVector: Buffer.from('init vector').toString('base64'),
        securityKey: Buffer.from('security key').toString('base64')
      });
    });
  });
});
