import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Database } from 'better-sqlite3';
import { emptyDatabase, flushPromises, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import EngineRepository from './engine.repository';
import { EngineSettings } from '../../model/engine.model';
import { version } from '../../../package.json';
import argon2 from 'argon2';
import UserRepository from './user.repository';

const TEST_DB_PATH = 'src/tests/test-config-engine.db';

let database: Database;
describe('EngineRepository with populated database', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  describe('Engine', () => {
    let repository: EngineRepository;

    beforeEach(() => {
      repository = new EngineRepository(database, '3.5.0');
    });

    it('should properly get the engine settings', () => {
      assert.deepStrictEqual(repository.get(), testData.engine.settings);
    });

    it('should update engine settings', () => {
      repository.update({ ...testData.engine.command, name: 'updated engine' }, testData.users.list[0].id);
      assert.deepStrictEqual(stripAuditFields(repository.get()), {
        ...testData.engine.command,
        id: testData.engine.settings.id,
        version: testData.engine.settings.version,
        launcherVersion: testData.engine.settings.launcherVersion,
        name: 'updated engine'
      });
    });

    it('should update version', () => {
      repository.updateVersion('9.9.99', '9.9.99');
      assert.strictEqual(repository.get()!.version, '9.9.99');
    });
  });
});

describe('EngineRepository with empty database', () => {
  before(async () => {
    database = await initDatabase('config', false, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  describe('Engine', () => {
    it('should properly init engine settings table', () => {
      const repository = new EngineRepository(database, '3.5.0');
      const result = stripAuditFields(repository.get());

      assert.ok(result);
      assert.ok(result.id);
      assert.strictEqual(result.version, version);
      assert.strictEqual(result.launcherVersion, '3.5.0');
      assert.strictEqual(result.name, 'OIBus');
      assert.strictEqual(result.port, 2223);
      assert.strictEqual(result.proxyEnabled, false);
      assert.strictEqual(result.proxyPort, 9000);
      assert.deepStrictEqual(result.logParameters, {
        console: { level: 'silent' },
        file: { level: 'info', maxFileSize: 50, numberOfFiles: 5 },
        database: { level: 'info', maxNumberOfLogs: 100_000 },
        loki: { level: 'silent', interval: 60, address: '', username: '', password: '' },
        oia: { level: 'silent', interval: 10 }
      });
    });
  });

  describe('User', () => {
    it('should not create a default admin user on hash error', async () => {
      mock.method(argon2, 'hash', () => {
        throw new Error('hash error');
      });
      const consoleErrorMock = mock.method(console, 'error', () => null);

      const repository = new UserRepository(database);

      await flushPromises();
      assert.strictEqual(repository.list().length, 0);
      assert.ok(consoleErrorMock.mock.calls.some(c => c.arguments[0] === 'hash error'));

      mock.restoreAll();
    });

    it('should create a default admin user', async () => {
      mock.method(argon2, 'hash', async (password: string) => password);

      const repository = new UserRepository(database);

      await flushPromises();

      const users = repository.list();
      assert.strictEqual(users.length, 1);
      const user = users[0];
      assert.strictEqual(user.login, 'admin');
      assert.strictEqual(user.language, 'en');
      assert.strictEqual(user.timezone, 'Europe/Paris');
      assert.strictEqual(repository.getHashedPasswordByLogin('admin'), 'pass');

      mock.restoreAll();
    });
  });
});
