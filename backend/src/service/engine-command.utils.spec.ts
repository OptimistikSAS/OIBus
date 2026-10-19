import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EngineLoggerCommandDTO, EngineProxyCommandDTO } from '../../shared/model/api/engine.model';

import testData from '../tests/utils/test-data';
import { toEngineLoggerCommand, toEngineProxyCommand, toEngineSettingsCommand, toEngineWebServerCommand } from './engine-command.utils';

const loggerCommand: EngineLoggerCommandDTO = {
  auditRetentionDuration: 30,
  console: { level: 'info' },
  file: { level: 'debug', maxFileSize: 10, numberOfFiles: 5 },
  database: { level: 'warn', maxNumberOfLogs: 100_000 },
  loki: { level: 'error', interval: 60, address: 'http://loki:3100', username: 'oibus', password: 'plain-text' },
  oia: { level: 'silent', interval: 10 },
  syslog: { level: 'trace', host: 'syslog-host', port: 514, protocol: 'udp4' }
};

describe('engine-command utils', () => {
  describe('toEngineWebServerCommand', () => {
    const currentHttps = testData.engine.settings.webServer.https;

    it('should map the web server settings', () => {
      assert.deepStrictEqual(
        toEngineWebServerCommand(
          {
            port: 2223,
            authTokenDuration: '7d',
            https: { enabled: true, certificateSource: 'store', certificateId: 'certificateId', certificatePath: '', privateKeyPath: '' }
          },
          currentHttps
        ),
        {
          port: 2223,
          authTokenDuration: '7d',
          https: { enabled: true, certificateSource: 'store', certificateId: 'certificateId', certificatePath: null, privateKeyPath: null }
        }
      );
    });

    it('should keep the current https settings when the command has none', () => {
      assert.deepStrictEqual(toEngineWebServerCommand({ port: 2223, authTokenDuration: '7d' }, currentHttps), {
        port: 2223,
        authTokenDuration: '7d',
        https: currentHttps
      });
    });
  });

  describe('toEngineProxyCommand', () => {
    it('should store the given secrets, never the ones of the API command', () => {
      const command: EngineProxyCommandDTO = {
        enabled: true,
        port: 9000,
        username: 'user',
        password: 'plain-text',
        forward: { enabled: true, url: 'http://forward', username: 'forward-user', password: 'plain-text' }
      };
      assert.deepStrictEqual(toEngineProxyCommand(command, { proxyPassword: 'hashed', forwardProxyPassword: 'encrypted' }), {
        enabled: true,
        port: 9000,
        username: 'user',
        password: 'hashed',
        forward: { enabled: true, url: 'http://forward', username: 'forward-user', password: 'encrypted' }
      });
    });

    it('should turn omitted values into nulls', () => {
      assert.deepStrictEqual(
        toEngineProxyCommand({ enabled: true, forward: { enabled: false } }, { proxyPassword: null, forwardProxyPassword: null }),
        {
          enabled: true,
          port: null,
          username: null,
          password: null,
          forward: { enabled: false, url: null, username: null, password: null }
        }
      );
    });

    it('should fall back to a disabled forward proxy when the command has none', () => {
      assert.deepStrictEqual(
        toEngineProxyCommand({ enabled: true, port: 8081 }, { proxyPassword: null, forwardProxyPassword: 'ignored' }),
        {
          enabled: true,
          port: 8081,
          username: null,
          password: null,
          forward: { enabled: false, url: null, username: null, password: null }
        }
      );
    });
  });

  describe('toEngineLoggerCommand', () => {
    it('should map every logger section and store the given Loki secret', () => {
      assert.deepStrictEqual(toEngineLoggerCommand(loggerCommand, { lokiPassword: 'encrypted' }), {
        ...loggerCommand,
        loki: { ...loggerCommand.loki, password: 'encrypted' }
      });
    });

    it('should turn omitted values into nulls', () => {
      const command: EngineLoggerCommandDTO = {
        ...loggerCommand,
        loki: { level: 'silent', interval: 60 },
        syslog: { level: 'silent', port: 514, protocol: 'tcp' }
      };
      const result = toEngineLoggerCommand(command, { lokiPassword: null });
      assert.deepStrictEqual(result.loki, { level: 'silent', interval: 60, address: null, username: null, password: null });
      assert.deepStrictEqual(result.syslog, { level: 'silent', host: null, port: 514, protocol: 'tcp' });
    });
  });

  describe('toEngineSettingsCommand', () => {
    it('should map every section, keeping the audit retention duration at the top level only', () => {
      const command = { ...testData.engine.command, auditRetentionDuration: 45, logger: { ...loggerCommand, auditRetentionDuration: 12 } };
      const result = toEngineSettingsCommand(
        command,
        {
          proxyPassword: 'hashed',
          forwardProxyPassword: 'encrypted',
          lokiPassword: 'secret'
        },
        testData.engine.settings.webServer.https
      );

      assert.strictEqual(result.auditRetentionDuration, 45);
      assert.deepStrictEqual(result.general, { name: command.general.name });
      assert.deepStrictEqual(result.webServer, toEngineWebServerCommand(command.webServer, testData.engine.settings.webServer.https));
      assert.deepStrictEqual(
        result.proxyServer,
        toEngineProxyCommand(command.proxyServer, { proxyPassword: 'hashed', forwardProxyPassword: 'encrypted' })
      );
      const { auditRetentionDuration: _, ...logger } = toEngineLoggerCommand(loggerCommand, { lokiPassword: 'secret' });
      assert.deepStrictEqual(result.logger, logger);
    });
  });
});
