import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Database } from 'better-sqlite3';
import { createAuditServiceMock, emptyDatabase, flushPromises, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import EngineRepository from './engine.repository';
import { version } from '../../../package.json';
import argon2 from 'argon2';
import UserRepository from './user.repository';
import AuditService from '../../service/audit.service';
import { EngineSettings } from '../../model/engine.model';

type EngineSection = 'engine_general' | 'engine_web_server' | 'engine_proxy_server' | 'engine_logging';

/**
 * Mirrors EngineRepository's audited sections: the audit trail must never carry proxyServer.password,
 * proxyServer.forward.password or logger.loki.password in the clear.
 */
function auditedSection(settings: EngineSettings | null, section: EngineSection): Record<string, unknown> {
  switch (section) {
    case 'engine_general':
      return { ...settings!.general };
    case 'engine_web_server':
      return { ...settings!.webServer };
    case 'engine_proxy_server':
      return { ...settings!.proxyServer, password: '', forward: { ...settings!.proxyServer.forward, password: '' } };
    case 'engine_logging':
      return {
        ...settings!.logger,
        loki: { ...settings!.logger.loki, password: '' },
        auditRetentionDuration: settings!.auditRetentionDuration
      };
  }
}

function recordCalls(auditService: AuditService): Array<Array<unknown>> {
  return (auditService.record as unknown as ReturnType<typeof mock.fn>).mock.calls.map(call => call.arguments);
}

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
    let auditService: AuditService;

    beforeEach(() => {
      auditService = createAuditServiceMock();
      repository = new EngineRepository(database, auditService, '3.5.0');
    });

    it('should properly get the engine settings', () => {
      assert.deepStrictEqual(repository.get(), testData.engine.settings);
    });

    it('should update engine settings', () => {
      const command = { ...testData.engine.command, general: { name: 'updated engine' } };
      const { auditRetentionDuration: _loggerAuditRetentionDuration, ...loggerOnly } = command.logger;
      const before = repository.get();
      repository.update(command, testData.users.list[0].id);
      const after = repository.get();
      assert.deepStrictEqual(stripAuditFields(after), {
        id: testData.engine.settings.id,
        version: testData.engine.settings.version,
        launcherVersion: testData.engine.settings.launcherVersion,
        auditRetentionDuration: null,
        general: { name: 'updated engine' },
        webServer: { port: command.webServer.port, authTokenDuration: command.webServer.authTokenDuration },
        proxyServer: {
          enabled: command.proxyServer.enabled,
          port: command.proxyServer.port,
          forward: {
            enabled: command.proxyServer.forward!.enabled,
            url: command.proxyServer.forward!.url,
            username: command.proxyServer.forward!.username,
            password: command.proxyServer.forward!.password
          },
          username: command.proxyServer.username,
          password: command.proxyServer.password
        },
        logger: loggerOnly
      });

      // One audit entry per changed section: the web server settings are unchanged, so not recorded
      const calls = recordCalls(auditService);
      assert.deepStrictEqual(
        calls.map(call => call[0]),
        ['engine_general', 'engine_proxy_server', 'engine_logging']
      );
      assert.deepStrictEqual(calls[0], [
        'engine_general',
        after!.id,
        'UPDATE',
        { name: before!.general.name },
        { name: 'updated engine' },
        testData.users.list[0].id
      ]);
      // Passwords are never recorded, but their change is (they are cleared by this command)
      assert.deepStrictEqual(calls[1], [
        'engine_proxy_server',
        after!.id,
        'UPDATE',
        auditedSection(before, 'engine_proxy_server'),
        {
          ...auditedSection(after, 'engine_proxy_server'),
          password: '<changed>',
          forward: { ...after!.proxyServer.forward, password: '<changed>' }
        },
        testData.users.list[0].id
      ]);
      assert.deepStrictEqual(calls[2], [
        'engine_logging',
        after!.id,
        'UPDATE',
        auditedSection(before, 'engine_logging'),
        { ...auditedSection(after, 'engine_logging'), loki: { ...after!.logger.loki, password: '<changed>' } },
        testData.users.list[0].id
      ]);
    });

    it('should round-trip auditRetentionDuration on update', () => {
      const command = { ...testData.engine.command, auditRetentionDuration: 45 };
      repository.update(command, testData.users.list[0].id);
      const after = repository.get();
      assert.strictEqual(after!.auditRetentionDuration, 45);

      // Reset back to null so subsequent tests relying on the default fixture are unaffected
      repository.update(testData.engine.command, testData.users.list[0].id);
      assert.strictEqual(repository.get()!.auditRetentionDuration, null);
    });

    it('should update name only', () => {
      const before = repository.get();
      repository.updateName('my new name', testData.users.list[0].id);
      const after = repository.get();
      assert.strictEqual(after!.general.name, 'my new name');

      assert.deepStrictEqual(recordCalls(auditService), [
        [
          'engine_general',
          after!.id,
          'UPDATE',
          auditedSection(before, 'engine_general'),
          auditedSection(after, 'engine_general'),
          testData.users.list[0].id
        ]
      ]);
    });

    it('should update web server port only', () => {
      const before = repository.get();
      repository.updateWebServer(testData.engine.webServerCommand, testData.users.list[0].id);
      const after = repository.get();
      assert.strictEqual(after!.webServer.port, testData.engine.webServerCommand.port);

      assert.deepStrictEqual(recordCalls(auditService), [
        [
          'engine_web_server',
          after!.id,
          'UPDATE',
          auditedSection(before, 'engine_web_server'),
          auditedSection(after, 'engine_web_server'),
          testData.users.list[0].id
        ]
      ]);
    });

    it('should update engine settings without a forward proxy (falls back to disabled defaults)', () => {
      const { forward: _forward, ...proxyServerWithoutForward } = testData.engine.command.proxyServer;
      const command = {
        ...testData.engine.command,
        proxyServer: proxyServerWithoutForward
      };
      repository.update(command, testData.users.list[0].id);
      const result = repository.get()!;
      assert.strictEqual(result.proxyServer.forward.enabled, false);
      assert.strictEqual(result.proxyServer.forward.url, null);
      assert.strictEqual(result.proxyServer.forward.username, null);
      assert.strictEqual(result.proxyServer.forward.password, null);
    });

    it('should update proxy settings with proxy disabled', () => {
      const disabledForward = { enabled: false, url: null, username: null, password: null };
      const before = repository.get();
      repository.updateProxy({ enabled: false, port: null, forward: disabledForward }, testData.users.list[0].id);
      const result = repository.get()!;
      assert.strictEqual(result.proxyServer.enabled, false);
      assert.strictEqual(result.proxyServer.port, null);

      assert.deepStrictEqual(recordCalls(auditService), [
        [
          'engine_proxy_server',
          result.id,
          'UPDATE',
          auditedSection(before, 'engine_proxy_server'),
          auditedSection(result, 'engine_proxy_server'),
          testData.users.list[0].id
        ]
      ]);
    });

    it('should update proxy settings with proxy enabled', () => {
      const disabledForward = { enabled: false, url: null, username: null, password: null };
      repository.updateProxy({ enabled: true, port: 8080, forward: disabledForward }, testData.users.list[0].id);
      const result = repository.get()!;
      assert.strictEqual(result.proxyServer.enabled, true);
      assert.strictEqual(result.proxyServer.port, 8080);
    });

    it('should update proxy settings without a forward proxy (falls back to disabled defaults)', () => {
      repository.updateProxy({ enabled: true, port: 8081 }, testData.users.list[0].id);
      const result = repository.get()!;
      assert.strictEqual(result.proxyServer.enabled, true);
      assert.strictEqual(result.proxyServer.port, 8081);
      assert.strictEqual(result.proxyServer.forward.enabled, false);
      assert.strictEqual(result.proxyServer.forward.url, null);
      assert.strictEqual(result.proxyServer.forward.username, null);
      assert.strictEqual(result.proxyServer.forward.password, null);
    });

    it('should update logger settings only', () => {
      const before = repository.get();
      repository.updateLogger(testData.engine.loggerCommand, testData.users.list[0].id);
      const after = repository.get();
      const { auditRetentionDuration, ...loggerOnly } = testData.engine.loggerCommand;
      assert.deepStrictEqual(after!.logger, loggerOnly);
      assert.strictEqual(after!.auditRetentionDuration, auditRetentionDuration);

      assert.deepStrictEqual(recordCalls(auditService), [
        [
          'engine_logging',
          after!.id,
          'UPDATE',
          auditedSection(before, 'engine_logging'),
          auditedSection(after, 'engine_logging'),
          testData.users.list[0].id
        ]
      ]);
    });

    it('should persist and return the audit retention duration set through updateLogger', () => {
      const loggerCommandWithRetention = { ...testData.engine.loggerCommand, auditRetentionDuration: 30 };
      repository.updateLogger(loggerCommandWithRetention, testData.users.list[0].id);
      const after = repository.get();
      assert.strictEqual(after!.auditRetentionDuration, 30);

      // Reset back to the shared fixture so subsequent tests are unaffected
      repository.updateLogger(testData.engine.loggerCommand, testData.users.list[0].id);
    });

    it('should never persist a real loki password in the audit trail', () => {
      const loggerCommandWithRealPassword = {
        ...testData.engine.loggerCommand,
        loki: { ...testData.engine.loggerCommand.loki, password: 'super-secret-loki-password' }
      };
      repository.updateLogger(loggerCommandWithRealPassword, testData.users.list[0].id);
      const after = repository.get();
      // The password is genuinely stored (readable back through get())...
      assert.strictEqual(after!.logger.loki.password, 'super-secret-loki-password');

      // ...but never persisted in clear in the audit trail: only its change is
      const calls = recordCalls(auditService);
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0][0], 'engine_logging');
      assert.deepStrictEqual((calls[0][3] as { loki: { password: string } }).loki.password, '');
      assert.deepStrictEqual((calls[0][4] as { loki: { password: string } }).loki.password, '<changed>');

      // Reset back to the shared fixture so subsequent tests are unaffected
      repository.updateLogger(testData.engine.loggerCommand, testData.users.list[0].id);
    });

    it('should not record anything when a section is saved without changes', () => {
      const current = repository.get()!;
      repository.updateName(current.general.name, testData.users.list[0].id);
      repository.updateWebServer(current.webServer, testData.users.list[0].id);
      assert.deepStrictEqual(recordCalls(auditService), []);
    });

    it('should record a proxy password only change without the password', () => {
      const current = repository.get()!;
      repository.updateProxy({ ...current.proxyServer, password: 'new-hashed-password' }, testData.users.list[0].id);
      assert.deepStrictEqual(recordCalls(auditService), [
        [
          'engine_proxy_server',
          current.id,
          'UPDATE',
          auditedSection(current, 'engine_proxy_server'),
          { ...auditedSection(current, 'engine_proxy_server'), password: '<changed>' },
          testData.users.list[0].id
        ]
      ]);
    });

    it('should not call the audit service when updating the version', () => {
      repository.updateVersion('9.9.100', '9.9.100');
      const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
      assert.strictEqual(recordMock.mock.calls.length, 0);
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
      const repository = new EngineRepository(database, createAuditServiceMock(), '3.5.0');
      const result = stripAuditFields(repository.get());

      assert.ok(result);
      assert.ok(result.id);
      assert.strictEqual(result.version, version);
      assert.strictEqual(result.launcherVersion, '3.5.0');
      assert.strictEqual(result.auditRetentionDuration, 90);
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
      const repository = new EngineRepository(database, createAuditServiceMock(), '3.5.0', 3000);
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

      const repository = new UserRepository(database, createAuditServiceMock());

      await flushPromises();
      assert.strictEqual(repository.list().length, 0);
      assert.ok(consoleErrorMock.mock.calls.some(c => c.arguments[0] === 'hash error'));

      mock.restoreAll();
    });

    it('should create a default admin user', async () => {
      mock.method(argon2, 'hash', async (password: string) => password);

      const repository = new UserRepository(database, createAuditServiceMock());

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
    const repository = new EngineRepository(db, createAuditServiceMock(), '3.5.0', 3000);
    assert.strictEqual(repository.get()!.webServer.port, 3000);
  });
});
