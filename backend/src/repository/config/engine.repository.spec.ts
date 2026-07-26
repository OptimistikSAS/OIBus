import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Database } from 'better-sqlite3';
import { emptyDatabase, flushPromises, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import EngineRepository from './engine.repository';
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
      const command = { ...testData.engine.command, general: { name: 'updated engine' } };
      repository.update(command, testData.users.list[0].id);
      assert.deepStrictEqual(stripAuditFields(repository.get()), {
        id: testData.engine.settings.id,
        version: testData.engine.settings.version,
        launcherVersion: testData.engine.settings.launcherVersion,
        general: { name: 'updated engine' },
        webServer: { port: command.webServer.port, authTokenDuration: command.webServer.authTokenDuration },
        proxyServer: {
          enabled: command.proxyServer.enabled,
          port: command.proxyServer.port,
          forward: {
            enabled: command.proxyServer.forward.enabled,
            url: command.proxyServer.forward.url,
            username: command.proxyServer.forward.username,
            password: command.proxyServer.forward.password
          },
          username: command.proxyServer.username,
          password: command.proxyServer.password
        },
        logger: command.logger
      });
    });

    it('should update name only', () => {
      repository.updateName('my new name', testData.users.list[0].id);
      assert.strictEqual(repository.get()!.general.name, 'my new name');
    });

    it('should update web server port only', () => {
      repository.updateWebServer(testData.engine.webServerCommand, testData.users.list[0].id);
      assert.strictEqual(repository.get()!.webServer.port, testData.engine.webServerCommand.port);
    });

    it('should update proxy settings with proxy disabled', () => {
      const disabledForward = { enabled: false, url: null, username: null, password: null };
      repository.updateProxy({ enabled: false, port: null, forward: disabledForward }, testData.users.list[0].id);
      const result = repository.get()!;
      assert.strictEqual(result.proxyServer.enabled, false);
      assert.strictEqual(result.proxyServer.port, null);
    });

    it('should update proxy settings with proxy enabled', () => {
      const disabledForward = { enabled: false, url: null, username: null, password: null };
      repository.updateProxy({ enabled: true, port: 8080, forward: disabledForward }, testData.users.list[0].id);
      const result = repository.get()!;
      assert.strictEqual(result.proxyServer.enabled, true);
      assert.strictEqual(result.proxyServer.port, 8080);
    });

    it('should update logger settings only', () => {
      repository.updateLogger(testData.engine.loggerCommand, testData.users.list[0].id);
      assert.deepStrictEqual(repository.get()!.logger, testData.engine.loggerCommand);
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
    it('should properly init engine settings table with default port', () => {
      const repository = new EngineRepository(database, '3.5.0');
      const result = stripAuditFields(repository.get());

      assert.ok(result);
      assert.ok(result.id);
      assert.strictEqual(result.version, version);
      assert.strictEqual(result.launcherVersion, '3.5.0');
      assert.strictEqual(result.general.name, 'OIBus');
      assert.strictEqual(result.webServer.port, 2223);
      assert.strictEqual(result.proxyServer.enabled, false);
      assert.strictEqual(result.proxyServer.port, 9000);
      assert.strictEqual(result.proxyServer.username, null);
      assert.strictEqual(result.proxyServer.password, null);
      assert.strictEqual(result.proxyServer.forward.enabled, false);
      assert.strictEqual(result.proxyServer.forward.url, null);
      assert.strictEqual(result.proxyServer.forward.username, null);
      assert.strictEqual(result.proxyServer.forward.password, null);
      assert.deepStrictEqual(result.logger, {
        console: { level: 'silent' },
        file: { level: 'info', maxFileSize: 50, numberOfFiles: 5 },
        database: { level: 'info', maxNumberOfLogs: 100_000 },
        loki: { level: 'silent', interval: 60, address: '', username: '', password: '' },
        oia: { level: 'silent', interval: 10 },
        syslog: { level: 'silent', host: '', port: 514, protocol: 'udp4' }
      });
    });

    it('should use a custom port when provided', () => {
      const repository = new EngineRepository(database, '3.5.0', 3000);
      // createDefault is a no-op because the record already exists from the previous test
      assert.strictEqual(repository.get()!.webServer.port, 2223);
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

describe('EngineRepository with custom default port', () => {
  const CUSTOM_PORT_DB_PATH = 'src/tests/test-config-engine-custom.db';
  let db: Database;

  before(async () => {
    db = await initDatabase('config', false, CUSTOM_PORT_DB_PATH);
  });

  after(async () => {
    db.close();
    await emptyDatabase('config', CUSTOM_PORT_DB_PATH);
  });

  it('should seed engine settings with a custom port', () => {
    const repository = new EngineRepository(db, '3.5.0', 3000);
    assert.strictEqual(repository.get()!.webServer.port, 3000);
  });
});
