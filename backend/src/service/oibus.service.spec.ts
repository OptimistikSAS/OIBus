import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import { EngineSettingsCommandDTO } from '../../shared/model/api/engine.model';
import { CacheContentUpdateCommand } from '../../shared/model/domain/engine.model';

import type DataStreamEngine from '../engine/data-stream-engine';
import { EngineSettings } from '../model/engine.model';
import { OIBusValidationError } from '../model/types';
import type CertificateRepository from '../repository/config/certificate.repository';
import type EngineRepository from '../repository/config/engine.repository';
import type EngineMetricsRepository from '../repository/metrics/engine-metrics.repository';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import LoggerMock from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../tests/utils/test-utils';
import type JoiValidator from '../web-server/controllers/validators/joi.validator';
import type HistoryQueryService from './history-query.service';
import type IPFilterService from './ip-filter.service';
import type LoggerService from './logger/logger.service';
import type NorthService from './north.service';
import type OIAnalyticsMessageService from './oia/oianalytics-message.service';
import type OIAnalyticsRegistrationService from './oia/oianalytics-registration.service';
import type OIBusServiceType from './oibus.service';
import type { toEngineSettingsDTO as toEngineSettingsDTOType } from './oibus.service';
import type SouthService from './south.service';
import type UserService from './user.service';
import type * as Utils from './utils';

const nodeRequire = createRequire(import.meta.url);

// ProxyServer mock — OIBusService uses `new ProxyServer(...)` in its constructor
class MockProxyServer {
  static lastInstance: MockProxyServer;
  start = mock.fn(async (_settings: unknown) => undefined);
  stop = mock.fn(async () => undefined);
  refreshIpFilters = mock.fn();
  constructor() {
    MockProxyServer.lastInstance = this;
  }
}

// Mocked module exports: the same objects for the whole file, their functions are replaced before each test
const realUtils: typeof Utils = nodeRequire('./utils');
const utilsExports = { ...realUtils, getOIBusInfo: mock.fn(realUtils.getOIBusInfo) };
const utilsCertificateExports = { assertTlsCredentials: mock.fn() };
const encryptionExports = { __esModule: true, encryptionService: new EncryptionServiceMock('', '') };

let OIBusService: typeof OIBusServiceType;
let toEngineSettingsDTO: typeof toEngineSettingsDTOType;

before(() => {
  mockModule(nodeRequire, './utils', utilsExports);
  mockModule(nodeRequire, './utils-certificate', utilsCertificateExports);
  mockModule(nodeRequire, '../web-server/proxy-server', { __esModule: true, default: MockProxyServer });
  mockModule(nodeRequire, './encryption.service', encryptionExports);
  mockModule(nodeRequire, 'argon2', {
    __esModule: true,
    default: { hash: mock.fn(async (pass: string) => `argon2hash:${pass}`) }
  });

  const mod = reloadModule<{
    default: typeof OIBusServiceType;
    toEngineSettingsDTO: typeof toEngineSettingsDTOType;
  }>(nodeRequire, './oibus.service');
  OIBusService = mod.default;
  toEngineSettingsDTO = mod.toEngineSettingsDTO;
});

describe('OIBus Service', () => {
  let service: OIBusServiceType;
  let engineRepository: Mocked<EngineRepository>;
  let engineMetricsRepository: Mocked<EngineMetricsRepository>;
  let certificateRepository: Mocked<CertificateRepository>;
  let ipFilterService: Mocked<IPFilterService>;
  let oIAnalyticsRegistrationService: Mocked<OIAnalyticsRegistrationService>;
  let loggerService: Mocked<LoggerService>;
  let oIAnalyticsMessageService: Mocked<OIAnalyticsMessageService>;
  let southService: Mocked<SouthService>;
  let northService: Mocked<NorthService>;
  let historyQueryService: Mocked<HistoryQueryService>;
  let logger: LoggerMock;
  let engine: Mocked<DataStreamEngine>;
  let encryptionService: EncryptionServiceMock;

  // Gives access to the private methods replaced by some tests
  const priv = () => service as unknown as Record<string, unknown>;

  beforeEach(() => {
    mock.timers.enable({
      apis: ['Date', 'setInterval', 'setImmediate', 'setTimeout'],
      now: new Date(testData.constants.dates.FAKE_NOW).getTime()
    });

    logger = new LoggerMock();
    engineRepository = createMock<EngineRepository>({ get: () => testData.engine.settings });
    engineMetricsRepository = createMock<EngineMetricsRepository>({ getMetrics: () => testData.engine.metrics });
    certificateRepository = createMock<CertificateRepository>();
    ipFilterService = createMock<IPFilterService>({ whiteListEvent: new EventEmitter(), list: () => testData.ipFilters.list });
    oIAnalyticsRegistrationService = createMock<OIAnalyticsRegistrationService>({ registrationEvent: new EventEmitter() });
    loggerService = createMock<LoggerService>({ createChildLogger: () => logger });
    oIAnalyticsMessageService = createMock<OIAnalyticsMessageService>();
    southService = createMock<SouthService>();
    northService = createMock<NorthService>();
    historyQueryService = createMock<HistoryQueryService>();
    engine = createMock<DataStreamEngine>({ logger: new LoggerMock() });

    utilsExports.getOIBusInfo = mock.fn(realUtils.getOIBusInfo);
    utilsCertificateExports.assertTlsCredentials = mock.fn();
    encryptionService = encryptionExports.encryptionService = new EncryptionServiceMock('', '');

    mock.method(process, 'cpuUsage', () => ({ user: 1000, system: 1000 }));
    mock.method(process, 'uptime', () => 10000);
    mock.method(os, 'freemem', () => 2_000_000);
    mock.method(os, 'totalmem', () => 16_000_000);
    mock.method(process, 'memoryUsage', () => ({ rss: 5, heapTotal: 5, heapUsed: 5, external: 5, arrayBuffers: 5 }));

    service = new OIBusService(
      createMock<JoiValidator>(),
      engineRepository,
      engineMetricsRepository,
      certificateRepository,
      ipFilterService,
      oIAnalyticsRegistrationService,
      loggerService,
      oIAnalyticsMessageService,
      southService,
      northService,
      historyQueryService,
      createMock<UserService>(),
      engine,
      false,
      false
    );
  });

  afterEach(() => {
    oIAnalyticsRegistrationService.registrationEvent.removeAllListeners();
    ipFilterService.whiteListEvent.removeAllListeners();
    mock.restoreAll();
    mock.timers.reset();
  });

  it('should start OIBus and stop it', async () => {
    northService.list.mock.mockImplementation(() => testData.north.list);
    southService.list.mock.mockImplementation(() => testData.south.list);
    historyQueryService.list.mock.mockImplementation(() => testData.historyQueries.listLight);
    southService.findById.mock.mockImplementation((id: string) => testData.south.list.find(el => el.id === id) ?? testData.south.list[0]);
    northService.findById.mock.mockImplementation((id: string) => testData.north.list.find(el => el.id === id) ?? testData.north.list[0]);
    historyQueryService.findById.mock.mockImplementation(
      (id: string) => testData.historyQueries.list.find(el => el.id === id) ?? testData.historyQueries.list[0]
    );

    await service.start();

    assert.strictEqual(engine.start.mock.calls.length, 1);
    assert.deepStrictEqual(engine.start.mock.calls[0].arguments, [
      testData.north.list,
      testData.south.list,
      testData.historyQueries.listLight
    ]);
    assert.ok((logger.info.mock.calls[0].arguments[0] as string).includes('Starting OIBus...'));
    assert.ok(service.getProxyServer() !== undefined && service.getProxyServer() !== null);
    assert.strictEqual(ipFilterService.list.mock.calls.length, 1);

    const settingsWithoutOIAlog: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    settingsWithoutOIAlog.logger.oia.level = 'silent';
    engineRepository.get.mock.mockImplementation(() => settingsWithoutOIAlog);
    const resetLogger = mock.fn(async (_settings: EngineSettings) => undefined);
    priv().resetLogger = resetLogger;

    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    assert.strictEqual(resetLogger.mock.calls.length, 0);

    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);
    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    assert.strictEqual(resetLogger.mock.calls.length, 1);
    assert.deepStrictEqual(resetLogger.mock.calls[0].arguments, [testData.engine.settings]);

    settingsWithoutOIAlog.proxyServer.enabled = false;
    engineRepository.get.mock.mockImplementation(() => settingsWithoutOIAlog);
    service.getProxyServer();
    // refreshIpFilters was called once in start()
    const proxyServer = MockProxyServer.lastInstance;
    assert.strictEqual(proxyServer.refreshIpFilters.mock.calls.length, 1);

    ipFilterService.whiteListEvent.emit('update-white-list');
    assert.strictEqual(proxyServer.refreshIpFilters.mock.calls.length, 1);

    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);
    ipFilterService.whiteListEvent.emit('update-white-list');
    assert.strictEqual(proxyServer.refreshIpFilters.mock.calls.length, 2);

    await service.stop();
    assert.strictEqual(engine.stop.mock.calls.length, 1);
  });

  it('should start OIBus without proxy', async () => {
    northService.list.mock.mockImplementation(() => []);
    southService.list.mock.mockImplementation(() => []);
    historyQueryService.list.mock.mockImplementation(() => []);
    const settingsWithoutProxy: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    settingsWithoutProxy.proxyServer.enabled = false;
    engineRepository.get.mock.mockImplementation(() => settingsWithoutProxy);

    await service.start();
    assert.strictEqual(ipFilterService.list.mock.calls.length, 0);
  });

  it('should stop OIBus without starting', async () => {
    await service.stop();
    assert.strictEqual(engine.stop.mock.calls.length, 1);
  });

  it('should add content', async () => {
    await service.addExternalContent('northId', 'dataSourceId', { type: 'record-list', content: [] });
    assert.strictEqual(engine.addExternalContent.mock.calls.length, 1);
    assert.deepStrictEqual(engine.addExternalContent.mock.calls[0].arguments, [
      'northId',
      'dataSourceId',
      { type: 'record-list', content: [] }
    ]);
  });

  it('should correctly update settings and call callback methods', async () => {
    const newEngineSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    newEngineSettings.general.name = 'updated oibus';
    newEngineSettings.proxyServer.enabled = true;
    newEngineSettings.webServer.port = 999;
    const specificCommand: EngineSettingsCommandDTO = JSON.parse(JSON.stringify(testData.engine.command));
    specificCommand.logger.loki.password = 'updated password';
    specificCommand.webServer.port = 999;

    // first get() = old settings (for comparison), the next ones = new settings (after update)
    engineRepository.get.mock.mockImplementation(() => newEngineSettings);
    engineRepository.get.mock.mockImplementationOnce(() => testData.engine.settings);

    const webServerChangeEmitSpy = mock.method(service.webServerChangeEvent, 'emit', mock.fn());

    // Real timers for setImmediate
    mock.timers.reset();

    const result = await service.updateEngineSettings(specificCommand, testData.users.list[0].id);

    assert.deepStrictEqual(result, {
      needsRedirect: true,
      newPort: 999,
      newProtocol: 'http'
    });
    assert.strictEqual(engineRepository.get.mock.calls.length, 3);
    assert.strictEqual(encryptionService.encryptText.mock.calls.length, 1);
    assert.strictEqual(engineRepository.update.mock.calls.length, 1);
    assert.strictEqual(loggerService.stop.mock.calls.length, 1);
    assert.strictEqual(loggerService.start.mock.calls.length, 1);
    assert.strictEqual(loggerService.createChildLogger.mock.calls.length, 2); // in constructor and 1x at update (resetLogger)
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);

    // Wait for setImmediate callback to execute
    await new Promise(resolve => setImmediate(resolve));

    // Verify web server change event was emitted
    assert.strictEqual(webServerChangeEmitSpy.mock.calls.length, 1);
    assert.deepStrictEqual(webServerChangeEmitSpy.mock.calls[0].arguments, ['updated', newEngineSettings.webServer]);
  });

  it('should throw error if bad port configuration', async () => {
    const badCommand: EngineSettingsCommandDTO = JSON.parse(JSON.stringify(testData.engine.command));
    badCommand.proxyServer.port = badCommand.webServer.port;

    await assert.rejects(
      () => service.updateEngineSettings(badCommand, testData.users.list[0].id),
      new Error('Web server port and proxy port can not be the same')
    );

    assert.strictEqual(engineRepository.update.mock.calls.length, 0);
  });

  it('should correctly update settings without encrypting password', async () => {
    const specificTestCommand: EngineSettingsCommandDTO = JSON.parse(JSON.stringify(testData.engine.command));
    specificTestCommand.logger.loki.password = '';
    specificTestCommand.proxyServer.enabled = false;

    engineRepository.get.mock.mockImplementation(
      () => ({ ...testData.engine.settings, ...specificTestCommand, webServer: testData.engine.settings.webServer }) as EngineSettings
    );
    engineRepository.get.mock.mockImplementationOnce(() => testData.engine.settings);

    const result = await service.updateEngineSettings(specificTestCommand, testData.users.list[0].id);

    assert.deepStrictEqual(result, {
      needsRedirect: false,
      newPort: null,
      newProtocol: null
    });
    assert.strictEqual(engineRepository.get.mock.calls.length, 3);
    assert.strictEqual(encryptionService.encryptText.mock.calls.length, 0);
    assert.strictEqual(engineRepository.update.mock.calls.length, 1);
  });

  it('should encrypt proxy forward password and hash proxy password when both provided', async () => {
    const specificTestCommand: EngineSettingsCommandDTO = JSON.parse(JSON.stringify(testData.engine.command));
    specificTestCommand.proxyServer.forward = {
      enabled: true,
      url: 'http://forward-proxy:3128',
      username: 'proxy-user',
      password: 'new forward password'
    };
    specificTestCommand.proxyServer.password = 'new proxy password';
    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);

    await service.updateEngineSettings(specificTestCommand, testData.users.list[0].id);

    assert.strictEqual(encryptionService.encryptText.mock.calls.length, 1);
    assert.deepStrictEqual(encryptionService.encryptText.mock.calls[0].arguments, ['new forward password']);
    assert.strictEqual(engineRepository.update.mock.calls.length, 1);
    assert.strictEqual(engineRepository.update.mock.calls[0].arguments[0].proxyServer.password, 'argon2hash:new proxy password');
    // the API command itself is left untouched
    assert.strictEqual(specificTestCommand.proxyServer.password, 'new proxy password');
  });

  it('should correctly update settings without reloading logger', async () => {
    const specificTestCommand: EngineSettingsCommandDTO = JSON.parse(JSON.stringify(testData.engine.command));
    specificTestCommand.logger = JSON.parse(JSON.stringify(testData.engine.settings.logger));

    await service.updateEngineSettings(specificTestCommand, testData.users.list[0].id);

    assert.strictEqual(loggerService.stop.mock.calls.length, 0);
    assert.strictEqual(loggerService.start.mock.calls.length, 0);
    assert.strictEqual(loggerService.createChildLogger.mock.calls.length, 1); // in constructor only
  });

  it('should update engine name', async () => {
    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);

    await service.updateEngineName(testData.engine.nameCommand, testData.users.list[0].id);

    assert.strictEqual(engineRepository.updateName.mock.calls.length, 1);
    assert.deepStrictEqual(engineRepository.updateName.mock.calls[0].arguments, [
      testData.engine.nameCommand.name,
      testData.users.list[0].id
    ]);
    assert.strictEqual(loggerService.stop.mock.calls.length, 1);
    assert.strictEqual(loggerService.start.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
  });

  it('should update engine web server port without redirect when port unchanged', async () => {
    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);

    const result = await service.updateEngineWebServer(
      { port: testData.engine.settings.webServer.port, authTokenDuration: testData.engine.settings.webServer.authTokenDuration },
      testData.users.list[0].id
    );

    assert.deepStrictEqual(result, { needsRedirect: false, newPort: null, newProtocol: null });
    assert.strictEqual(engineRepository.updateWebServer.mock.calls.length, 1);
    // the https settings are kept when the command has none
    assert.deepStrictEqual(engineRepository.updateWebServer.mock.calls[0].arguments[0].https, testData.engine.settings.webServer.https);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
  });

  it('should update engine web server port with redirect when port changed', async () => {
    const newSettings = { ...testData.engine.settings, webServer: { ...testData.engine.settings.webServer, port: 3333 } };
    engineRepository.get.mock.mockImplementation(() => newSettings);
    engineRepository.get.mock.mockImplementationOnce(() => testData.engine.settings);

    mock.timers.reset();
    const result = await service.updateEngineWebServer(testData.engine.webServerCommand, testData.users.list[0].id);
    await new Promise(resolve => setImmediate(resolve));

    assert.deepStrictEqual(result, { needsRedirect: true, newPort: 3333, newProtocol: 'http' });
  });

  describe('web server https', () => {
    const certificate = { ...testData.certificates.list[0], privateKey: 'encrypted key', certificateChain: 'ca chain' };
    const storeHttps = {
      enabled: true,
      certificateSource: 'store' as const,
      certificateId: certificate.id,
      certificatePath: null,
      privateKeyPath: null
    };
    const fileHttps = {
      enabled: true,
      certificateSource: 'file' as const,
      certificateId: null,
      certificatePath: 'oibus.crt',
      privateKeyPath: '/etc/oibus/oibus.key'
    };

    const withHttps = (https: EngineSettings['webServer']['https']): EngineSettings => ({
      ...testData.engine.settings,
      webServer: { ...testData.engine.settings.webServer, https }
    });

    it('should read the certificate, its chain and its decrypted private key from the store', async () => {
      certificateRepository.findById.mock.mockImplementation(() => certificate);

      const credentials = await service.getWebServerCredentials(storeHttps);

      assert.deepStrictEqual(credentials, { cert: `${certificate.certificate}\nca chain`, key: 'encrypted key' });
      assert.deepStrictEqual(certificateRepository.findById.mock.calls[0].arguments, [certificate.id]);
      assert.deepStrictEqual(utilsCertificateExports.assertTlsCredentials.mock.calls[0].arguments, [credentials.cert, credentials.key]);
    });

    it('should reject a certificate of the store that is not found or has no private key', async () => {
      await assert.rejects(
        () => service.getWebServerCredentials(storeHttps),
        new OIBusValidationError(`Certificate "${certificate.id}" not found`)
      );
      await assert.rejects(
        () => service.getWebServerCredentials({ ...storeHttps, certificateId: null }),
        new OIBusValidationError('Certificate "null" not found')
      );
      certificateRepository.findById.mock.mockImplementation(() => ({ ...certificate, privateKey: '' }));
      await assert.rejects(
        () => service.getWebServerCredentials(storeHttps),
        new OIBusValidationError(`Certificate "${certificate.name}" has no private key`)
      );
    });

    it('should read the certificate and private key from files, relative to the data folder', async () => {
      const readFile = mock.method(fs, 'readFile', async (filePath: string) => `content of ${filePath}`);

      const credentials = await service.getWebServerCredentials(fileHttps);

      assert.deepStrictEqual(readFile.mock.calls[0].arguments, [path.resolve('oibus.crt'), 'utf8']);
      assert.deepStrictEqual(readFile.mock.calls[1].arguments, [path.resolve('/etc/oibus/oibus.key'), 'utf8']);
      assert.deepStrictEqual(credentials, {
        cert: `content of ${path.resolve('oibus.crt')}`,
        key: `content of ${path.resolve('/etc/oibus/oibus.key')}`
      });
    });

    it('should reject a file that cannot be read', async () => {
      mock.method(fs, 'readFile', async () => {
        throw new Error('ENOENT');
      });

      await assert.rejects(
        () => service.getWebServerCredentials(fileHttps),
        new OIBusValidationError('Unable to read the certificate file "oibus.crt": ENOENT')
      );
    });

    it('should reject the settings when the web server would restart with a certificate it cannot load', async () => {
      engineRepository.get.mock.mockImplementation(() => testData.engine.settings);

      await assert.rejects(
        () =>
          service.updateEngineWebServer(
            { port: testData.engine.settings.webServer.port, authTokenDuration: '7d', https: storeHttps },
            testData.users.list[0].id
          ),
        new OIBusValidationError(`Certificate "${certificate.id}" not found`)
      );
      assert.strictEqual(engineRepository.updateWebServer.mock.calls.length, 0);
    });

    it('should enable https and redirect to it', async () => {
      certificateRepository.findById.mock.mockImplementation(() => certificate);
      engineRepository.get.mock.mockImplementation(() => withHttps(storeHttps));
      engineRepository.get.mock.mockImplementationOnce(() => testData.engine.settings);
      const webServerChangeEmitSpy = mock.method(service.webServerChangeEvent, 'emit', mock.fn());

      mock.timers.reset();
      const result = await service.updateEngineWebServer(
        { port: testData.engine.settings.webServer.port, authTokenDuration: '7d', https: storeHttps },
        testData.users.list[0].id
      );
      await new Promise(resolve => setImmediate(resolve));

      assert.deepStrictEqual(result, { needsRedirect: true, newPort: testData.engine.settings.webServer.port, newProtocol: 'https' });
      assert.strictEqual(utilsCertificateExports.assertTlsCredentials.mock.calls.length, 1);
      assert.deepStrictEqual(engineRepository.updateWebServer.mock.calls[0].arguments[0].https, storeHttps);
      assert.deepStrictEqual(webServerChangeEmitSpy.mock.calls[0].arguments, ['updated', withHttps(storeHttps).webServer]);
    });

    it('should restart the web server without redirect when only its certificate changes', async () => {
      const previous = withHttps(storeHttps);
      const next = withHttps({ ...storeHttps, certificateId: 'other' });
      certificateRepository.findById.mock.mockImplementation(() => certificate);
      engineRepository.get.mock.mockImplementation(() => next);
      engineRepository.get.mock.mockImplementationOnce(() => previous);
      const webServerChangeEmitSpy = mock.method(service.webServerChangeEvent, 'emit', mock.fn());

      mock.timers.reset();
      const result = await service.updateEngineWebServer(
        { port: previous.webServer.port, authTokenDuration: '7d', https: next.webServer.https },
        testData.users.list[0].id
      );
      await new Promise(resolve => setImmediate(resolve));

      assert.deepStrictEqual(result, { needsRedirect: false, newPort: null, newProtocol: null });
      assert.deepStrictEqual(webServerChangeEmitSpy.mock.calls[0].arguments, ['updated', next.webServer]);
    });

    it('should not check the certificate when the web server does not restart', async () => {
      engineRepository.get.mock.mockImplementation(() => withHttps(storeHttps));

      const result = await service.updateEngineWebServer(
        { port: testData.engine.settings.webServer.port, authTokenDuration: '1d', https: storeHttps },
        testData.users.list[0].id
      );

      assert.deepStrictEqual(result, { needsRedirect: false, newPort: null, newProtocol: null });
      assert.strictEqual(certificateRepository.findById.mock.calls.length, 0);
      assert.strictEqual(engineRepository.updateWebServer.mock.calls.length, 1);
    });
  });

  it('should throw error when web server port equals proxy port', async () => {
    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);

    await assert.rejects(
      () =>
        service.updateEngineWebServer(
          { port: testData.engine.settings.proxyServer.port!, authTokenDuration: testData.engine.settings.webServer.authTokenDuration },
          testData.users.list[0].id
        ),
      new Error('Web server port and proxy port can not be the same')
    );
    assert.strictEqual(engineRepository.updateWebServer.mock.calls.length, 0);
  });

  it('should update engine proxy settings', async () => {
    engineRepository.get.mock.mockImplementation(() => ({
      ...testData.engine.settings,
      proxyServer: { ...testData.engine.settings.proxyServer, enabled: false }
    }));

    await service.updateEngineProxy(
      { enabled: false, port: null, forward: testData.engine.settings.proxyServer.forward },
      testData.users.list[0].id
    );

    assert.strictEqual(engineRepository.updateProxy.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
  });

  it('should throw error when proxy port equals web server port', async () => {
    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);

    await assert.rejects(
      () =>
        service.updateEngineProxy(
          {
            enabled: true,
            port: testData.engine.settings.webServer.port,
            forward: testData.engine.settings.proxyServer.forward
          },
          testData.users.list[0].id
        ),
      new Error('Web server port and proxy port can not be the same')
    );
    assert.strictEqual(engineRepository.updateProxy.mock.calls.length, 0);
  });

  it('should preserve old forward password when proxy forward password not provided', async () => {
    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);

    const command = {
      enabled: true,
      port: 9000,
      forward: { enabled: true, url: 'http://forward-proxy:3128', username: 'proxy-user', password: null },
      username: 'proxy-server-user',
      password: null
    };

    await service.updateEngineProxy(command, testData.users.list[0].id);

    assert.strictEqual(engineRepository.updateProxy.mock.calls.length, 1);
    const persisted = engineRepository.updateProxy.mock.calls[0].arguments[0];
    assert.strictEqual(persisted.forward.password, testData.engine.settings.proxyServer.forward.password);
    assert.strictEqual(persisted.password, testData.engine.settings.proxyServer.password);
    assert.strictEqual(command.password, null);
  });

  it('should start proxy server when proxy is enabled', async () => {
    const settingsWithProxy = {
      ...testData.engine.settings,
      proxyServer: { ...testData.engine.settings.proxyServer, enabled: true, port: 9000 }
    };
    engineRepository.get.mock.mockImplementation(() => settingsWithProxy);

    await service.updateEngineProxy(settingsWithProxy.proxyServer, testData.users.list[0].id);

    assert.strictEqual(engineRepository.updateProxy.mock.calls.length, 1);
    assert.strictEqual(MockProxyServer.lastInstance.stop.mock.calls.length, 1);
    assert.strictEqual(MockProxyServer.lastInstance.start.mock.calls.length, 1);
    assert.deepStrictEqual(MockProxyServer.lastInstance.start.mock.calls[0].arguments, [settingsWithProxy.proxyServer]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
  });

  it('should update engine logger settings and encrypt loki password', async () => {
    const command = JSON.parse(JSON.stringify(testData.engine.loggerCommand));
    command.loki.password = 'new password';
    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);

    await service.updateEngineLogger(command, testData.users.list[0].id);

    assert.strictEqual(encryptionService.encryptText.mock.calls.length, 1);
    assert.strictEqual(engineRepository.updateLogger.mock.calls.length, 1);
    assert.strictEqual(loggerService.stop.mock.calls.length, 1);
    assert.strictEqual(loggerService.start.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
  });

  it('should update engine logger settings and preserve loki password when empty', async () => {
    const command = JSON.parse(JSON.stringify(testData.engine.loggerCommand));
    command.loki.password = '';
    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);

    await service.updateEngineLogger(command, testData.users.list[0].id);

    assert.strictEqual(encryptionService.encryptText.mock.calls.length, 0);
    assert.strictEqual(engineRepository.updateLogger.mock.calls.length, 1);
    assert.strictEqual(
      engineRepository.updateLogger.mock.calls[0].arguments[0].loki.password,
      testData.engine.settings.logger.loki.password
    );
    assert.strictEqual(command.loki.password, '');
  });

  it('should correctly restart OIBus', async () => {
    const processExitSpy = mock.method(process, 'exit', mock.fn());

    await service.restart();
    mock.timers.tick(100);
    assert.strictEqual(processExitSpy.mock.calls.length, 1);
  });

  it('should dump memory in the data folder', () => {
    const writeHeapSnapshotSpy = mock.method(v8, 'writeHeapSnapshot', (filePath: string) => filePath);
    const expectedFilename = 'oibus-memory-dump-2021-01-02_00-00-00.heapsnapshot';

    const result = service.dumpMemory();

    assert.deepStrictEqual(result, { filename: expectedFilename });
    assert.strictEqual(writeHeapSnapshotSpy.mock.calls.length, 1);
    assert.deepStrictEqual(writeHeapSnapshotSpy.mock.calls[0].arguments, [path.resolve(process.cwd(), expectedFilename)]);
    assert.strictEqual(logger.warn.mock.calls.length, 1);
    assert.strictEqual(logger.info.mock.calls.length, 1);
  });

  it('should log health signal', async () => {
    northService.list.mock.mockImplementation(() => []);
    southService.list.mock.mockImplementation(() => []);
    historyQueryService.list.mock.mockImplementation(() => []);
    await service.start();
    assert.strictEqual(logger.info.mock.calls.length, 3); // starting, health info, started

    service.logHealthSignal();
    assert.strictEqual(logger.info.mock.calls.length, 4);

    mock.timers.tick(1_800_000);
    assert.strictEqual(logger.info.mock.calls.length, 5);
  });

  it('should update and reset metrics', async () => {
    let memCallCount = 0;
    mock.method(
      process,
      'memoryUsage',
      mock.fn(() => {
        memCallCount++;
        if (memCallCount === 1) return { rss: 5, heapTotal: 5, heapUsed: 5, external: 5, arrayBuffers: 5 };
        if (memCallCount === 2) return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
        if (memCallCount === 3) return { rss: 10, heapTotal: 10, heapUsed: 10, external: 10, arrayBuffers: 10 };
        return { rss: 5, heapTotal: 5, heapUsed: 5, external: 5, arrayBuffers: 5 };
      })
    );

    northService.list.mock.mockImplementation(() => []);
    southService.list.mock.mockImplementation(() => []);
    historyQueryService.list.mock.mockImplementation(() => []);
    await service.start();

    // start() persists a freshly reset metricsStart, so the pre-tick call count is 1, not 0
    assert.strictEqual(engineMetricsRepository.updateMetrics.mock.calls.length, 1);
    mock.timers.tick(1000);
    mock.timers.tick(1000);
    mock.timers.tick(1000);
    mock.timers.tick(1000);

    assert.strictEqual(engineMetricsRepository.updateMetrics.mock.calls.length, 5);
    assert.deepStrictEqual(engineMetricsRepository.updateMetrics.mock.calls[4].arguments[1], {
      metricsStart: testData.constants.dates.FAKE_NOW,
      processCpuUsageInstant: 0,
      processCpuUsageAverage: 0.0000002,
      processUptime: 10000000,
      freeMemory: 2_000_000,
      totalMemory: 16_000_000,
      minRss: 0,
      currentRss: 5,
      maxRss: 10,
      minHeapTotal: 0,
      currentHeapTotal: 5,
      maxHeapTotal: 10,
      minHeapUsed: 0,
      currentHeapUsed: 5,
      maxHeapUsed: 10,
      minExternal: 0,
      currentExternal: 5,
      maxExternal: 10,
      minArrayBuffers: 0,
      currentArrayBuffers: 5,
      maxArrayBuffers: 10
    });

    const updateEngineMetrics = mock.fn();
    priv().updateEngineMetrics = updateEngineMetrics;

    service.resetEngineMetrics();
    assert.strictEqual(engineMetricsRepository.removeMetrics.mock.calls.length, 1);
    assert.deepStrictEqual(engineMetricsRepository.removeMetrics.mock.calls[0].arguments, [testData.engine.settings.id]);
    assert.strictEqual(engineMetricsRepository.initMetrics.mock.calls.length, 2); // once in start(), once in resetEngineMetrics()
    assert.strictEqual(updateEngineMetrics.mock.calls.length, 1);
  });

  it('should get engine metrics', () => {
    assert.deepStrictEqual(service.getEngineMetrics(), testData.engine.metrics);
  });

  it('should get home metrics', () => {
    const northMetrics = { [testData.north.list[0].id]: testData.north.metrics };
    const southMetrics = { [testData.south.list[0].id]: testData.south.metrics };
    engine.getAllNorthMetrics.mock.mockImplementation(() => northMetrics);
    engine.getAllSouthMetrics.mock.mockImplementation(() => southMetrics);

    assert.deepStrictEqual(service.getHomeMetrics(), { norths: northMetrics, engine: testData.engine.metrics, souths: southMetrics });
  });

  it('should get OIBus info', () => {
    utilsExports.getOIBusInfo.mock.mockImplementation(() => testData.engine.oIBusInfo);

    assert.deepStrictEqual(service.getInfo(), testData.engine.oIBusInfo);
  });

  it('should update OIBus version', () => {
    service.updateOIBusVersion('3.4.9', '3.4.5');
    assert.strictEqual(engineRepository.updateVersion.mock.calls.length, 1);
    assert.deepStrictEqual(engineRepository.updateVersion.mock.calls[0].arguments, ['3.4.9', '3.4.5']);
  });

  it('should reset North Connector Metrics', () => {
    service.resetNorthMetrics('id');
    assert.strictEqual(engine.resetNorthMetrics.mock.calls.length, 1);
    assert.deepStrictEqual(engine.resetNorthMetrics.mock.calls[0].arguments, ['id']);
  });

  it('should reset South Connector Metrics', () => {
    service.resetSouthMetrics('id');
    assert.strictEqual(engine.resetSouthMetrics.mock.calls.length, 1);
    assert.deepStrictEqual(engine.resetSouthMetrics.mock.calls[0].arguments, ['id']);
  });

  it('should search cache content', async () => {
    await service.searchCacheContent('north', 'northId', { start: '', end: '', nameContains: '', maxNumberOfFilesReturned: 1000 });
    assert.strictEqual(engine.searchCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(engine.searchCacheContent.mock.calls[0].arguments, [
      'north',
      'northId',
      { start: '', end: '', nameContains: '', maxNumberOfFilesReturned: 1000 }
    ]);
  });

  it('should get file from cache', async () => {
    await service.getFileFromCache('north', 'northId', 'cache', 'file');
    assert.strictEqual(engine.getFileFromCache.mock.calls.length, 1);
    assert.deepStrictEqual(engine.getFileFromCache.mock.calls[0].arguments, ['north', 'northId', 'cache', 'file']);
  });

  it('should update cache content', async () => {
    await service.updateCacheContent('north', 'northId', {} as CacheContentUpdateCommand);
    assert.strictEqual(engine.updateCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(engine.updateCacheContent.mock.calls[0].arguments, ['north', 'northId', {}]);
  });

  it('should properly convert to DTO', () => {
    const engineSettings = testData.engine.settings;
    assert.deepStrictEqual(
      toEngineSettingsDTO(engineSettings, id => ({ id, friendlyName: '' })),
      {
        id: engineSettings.id,
        createdBy: { id: engineSettings.createdBy, friendlyName: '' },
        updatedBy: { id: engineSettings.updatedBy, friendlyName: '' },
        createdAt: engineSettings.createdAt,
        updatedAt: engineSettings.updatedAt,
        version: engineSettings.version,
        launcherVersion: engineSettings.launcherVersion,
        auditRetentionDuration: engineSettings.auditRetentionDuration,
        general: {
          name: engineSettings.general.name
        },
        webServer: {
          port: engineSettings.webServer.port,
          authTokenDuration: engineSettings.webServer.authTokenDuration,
          https: engineSettings.webServer.https
        },
        proxyServer: {
          enabled: engineSettings.proxyServer.enabled,
          port: engineSettings.proxyServer.port,
          forward: {
            enabled: engineSettings.proxyServer.forward.enabled,
            url: engineSettings.proxyServer.forward.url,
            username: engineSettings.proxyServer.forward.username,
            password: ''
          },
          username: engineSettings.proxyServer.username,
          password: ''
        },
        logger: {
          console: {
            level: engineSettings.logger.console.level
          },
          file: {
            level: engineSettings.logger.file.level,
            maxFileSize: engineSettings.logger.file.maxFileSize,
            numberOfFiles: engineSettings.logger.file.numberOfFiles
          },
          database: {
            level: engineSettings.logger.database.level,
            maxNumberOfLogs: engineSettings.logger.database.maxNumberOfLogs
          },

          loki: {
            level: engineSettings.logger.loki.level,
            interval: engineSettings.logger.loki.interval,
            address: engineSettings.logger.loki.address,
            username: engineSettings.logger.loki.username,
            password: ''
          },
          oia: {
            level: engineSettings.logger.oia.level,
            interval: engineSettings.logger.oia.interval
          },
          syslog: {
            level: engineSettings.logger.syslog.level,
            host: engineSettings.logger.syslog.host,
            port: engineSettings.logger.syslog.port,
            protocol: engineSettings.logger.syslog.protocol
          }
        }
      }
    );
  });
});
