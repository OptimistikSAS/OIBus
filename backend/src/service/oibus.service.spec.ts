import { describe, it, beforeEach, afterEach, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import os from 'node:os';

import testData from '../tests/utils/test-data';
import { mockModule, reloadModule } from '../tests/utils/test-utils';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import type OIBusServiceType from './oibus.service';
import type { toEngineSettingsDTO as toEngineSettingsDTOType } from './oibus.service';
import EngineRepositoryMock from '../tests/__mocks__/repository/config/engine-repository.mock';
import EngineMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/engine-metrics-repository.mock';
import IpFilterServiceMock from '../tests/__mocks__/service/ip-filter-service.mock';
import OIAnalyticsRegistrationServiceMock from '../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import LoggerServiceMock from '../tests/__mocks__/service/logger/logger-service.mock';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';
import HistoryQueryServiceMock from '../tests/__mocks__/service/history-query-service.mock';
import UserServiceMock from '../tests/__mocks__/service/user-service.mock';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import LoggerMock from '../tests/__mocks__/service/logger/logger.mock';
import type pino from 'pino';
import { EngineSettings } from '../model/engine.model';
import { CacheContentUpdateCommand, EngineSettingsCommandDTO } from '../../shared/model/engine.model';

const nodeRequire = createRequire(import.meta.url);

// Mocked module exports — mutated in-place between tests
let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let mockProxyServer: Record<string, unknown>;
let mockEncryptionService: Record<string, unknown>;

let OIBusService: new (...args: Array<unknown>) => InstanceType<typeof OIBusServiceType>;
let toEngineSettingsDTO: typeof toEngineSettingsDTOType;

before(() => {
  mockUtils = {
    getOIBusInfo: mock.fn(),
    testIPOnFilter: mock.fn(() => true)
  };

  // ProxyServer mock — OIBusService uses `new ProxyServer(...)` internally
  class MockProxyServer {
    start = mock.fn(async () => undefined);
    stop = mock.fn(async () => undefined);
    refreshIpFilters = mock.fn();
    setLogger = mock.fn();
  }
  mockProxyServer = { __esModule: true, default: MockProxyServer };

  const encryptionServiceMock = new EncryptionServiceMock('', '');
  mockEncryptionService = { __esModule: true, encryptionService: encryptionServiceMock };

  mockModule(nodeRequire, './utils', mockUtils);
  mockModule(nodeRequire, '../web-server/proxy-server', mockProxyServer);
  mockModule(nodeRequire, './encryption.service', mockEncryptionService);

  const mod = reloadModule<{
    default: new (...args: Array<unknown>) => InstanceType<typeof OIBusServiceType>;
    toEngineSettingsDTO: typeof toEngineSettingsDTOType;
  }>(nodeRequire, './oibus.service');
  OIBusService = mod.default;
  toEngineSettingsDTO = mod.toEngineSettingsDTO;
});

describe('OIBus Service', () => {
  let service: InstanceType<typeof OIBusServiceType>;
  let engineRepository: EngineRepositoryMock;
  let engineMetricsRepository: EngineMetricsRepositoryMock;
  let ipFilterService: IpFilterServiceMock;
  let oIAnalyticsRegistrationService: OIAnalyticsRegistrationServiceMock;
  let loggerService: LoggerServiceMock;
  let oIAnalyticsMessageService: OianalyticsMessageServiceMock;
  let southService: SouthServiceMock;
  let northService: NorthServiceMock;
  let historyQueryService: HistoryQueryServiceMock;
  let userService: UserServiceMock;
  let logger: LoggerMock;
  let engine: DataStreamEngineMock;
  let validator: { validate: ReturnType<typeof mock.fn> };

  const priv = () => service as unknown as Record<string, unknown>;

  beforeEach(() => {
    mock.timers.enable({
      apis: ['Date', 'setInterval', 'setImmediate', 'setTimeout'],
      now: new Date(testData.constants.dates.FAKE_NOW).getTime()
    });

    engineRepository = new EngineRepositoryMock();
    engineMetricsRepository = new EngineMetricsRepositoryMock();
    ipFilterService = new IpFilterServiceMock();
    oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
    loggerService = new LoggerServiceMock();
    oIAnalyticsMessageService = new OianalyticsMessageServiceMock();
    southService = new SouthServiceMock();
    northService = new NorthServiceMock();
    historyQueryService = new HistoryQueryServiceMock();
    userService = new UserServiceMock();
    logger = new LoggerMock();
    engine = new DataStreamEngineMock(logger as unknown as pino.Logger);
    validator = { validate: mock.fn(async () => undefined) };

    // Reset getOIBusInfo mock in-place
    mockUtils.getOIBusInfo = mock.fn();

    // Reset encryptionService mock in-place
    const encryptionMock = mockEncryptionService.encryptionService as EncryptionServiceMock;
    encryptionMock.encryptText.mock.resetCalls();

    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);
    engineMetricsRepository.getMetrics.mock.mockImplementation(() => testData.engine.metrics);
    loggerService.createChildLogger.mock.mockImplementation(() => logger as unknown as pino.Logger);
    ipFilterService.list.mock.mockImplementation(() => testData.ipFilters.list);

    mock.method(
      process,
      'cpuUsage',
      mock.fn(() => ({ user: 1000, system: 1000 }))
    );
    mock.method(
      process,
      'uptime',
      mock.fn(() => 10000)
    );
    mock.method(
      os,
      'freemem',
      mock.fn(() => 2_000_000)
    );
    mock.method(
      os,
      'totalmem',
      mock.fn(() => 16_000_000)
    );
    mock.method(
      process,
      'memoryUsage',
      mock.fn(() => ({ rss: 5, heapTotal: 5, heapUsed: 5, external: 5, arrayBuffers: 5 }))
    );

    service = new OIBusService(
      validator as unknown as Parameters<typeof OIBusService>[0],
      engineRepository,
      engineMetricsRepository,
      ipFilterService,
      oIAnalyticsRegistrationService,
      loggerService,
      oIAnalyticsMessageService,
      southService,
      northService,
      historyQueryService,
      userService,
      engine,
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
    historyQueryService.list.mock.mockImplementation(() => testData.historyQueries.list);
    southService.findById.mock.mockImplementation((id: unknown) => testData.south.list.find(el => el.id === id));
    northService.findById.mock.mockImplementation((id: unknown) => testData.north.list.find(el => el.id === id));
    historyQueryService.findById.mock.mockImplementation((id: unknown) => testData.historyQueries.list.find(el => el.id === id));

    await service.start();

    assert.strictEqual(engine.start.mock.calls.length, 1);
    assert.deepStrictEqual(engine.start.mock.calls[0].arguments, [testData.north.list, testData.south.list, testData.historyQueries.list]);
    assert.ok((logger.info.mock.calls[0].arguments[0] as string).includes('Starting OIBus...'));
    assert.ok(service.getProxyServer() !== undefined && service.getProxyServer() !== null);
    assert.strictEqual(ipFilterService.list.mock.calls.length, 1);

    const settingsWithoutOIAlog: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    settingsWithoutOIAlog.logParameters.oia.level = 'silent';
    engineRepository.get.mock.mockImplementation(() => settingsWithoutOIAlog);
    priv()['resetLogger'] = mock.fn(async () => undefined);

    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    assert.strictEqual((priv()['resetLogger'] as ReturnType<typeof mock.fn>).mock.calls.length, 0);

    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);
    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    assert.strictEqual((priv()['resetLogger'] as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.deepStrictEqual((priv()['resetLogger'] as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [testData.engine.settings]);

    // Reset call counts
    (logger.info as ReturnType<typeof mock.fn>).mock.resetCalls();
    settingsWithoutOIAlog.proxyEnabled = false;
    engineRepository.get.mock.mockImplementation(() => settingsWithoutOIAlog);
    const proxyServer = service.getProxyServer();
    // refreshIpFilters was called once in start() — reset before the new assertions
    (proxyServer.refreshIpFilters as ReturnType<typeof mock.fn>).mock.resetCalls();

    ipFilterService.whiteListEvent.emit('update-white-list');
    assert.strictEqual((proxyServer.refreshIpFilters as ReturnType<typeof mock.fn>).mock.calls.length, 0);

    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);
    ipFilterService.whiteListEvent.emit('update-white-list');
    assert.strictEqual((proxyServer.refreshIpFilters as ReturnType<typeof mock.fn>).mock.calls.length, 1);

    await service.stop();
    assert.strictEqual(engine.stop.mock.calls.length, 1);
  });

  it('should start OIBus without proxy', async () => {
    northService.list.mock.mockImplementation(() => []);
    southService.list.mock.mockImplementation(() => []);
    historyQueryService.list.mock.mockImplementation(() => []);
    const settingsWithoutProxy: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    settingsWithoutProxy.proxyEnabled = false;
    engineRepository.get.mock.mockImplementation(() => settingsWithoutProxy);

    await service.start();
    assert.strictEqual(ipFilterService.list.mock.calls.length, 0);
  });

  it('should stop OIBus without starting', async () => {
    await service.stop();
    assert.strictEqual(engine.stop.mock.calls.length, 1);
  });

  it('should add content', async () => {
    await service.addExternalContent('northId', 'dataSourceId', { type: 'time-values', content: [] });
    assert.strictEqual(engine.addExternalContent.mock.calls.length, 1);
    assert.deepStrictEqual(engine.addExternalContent.mock.calls[0].arguments, [
      'northId',
      'dataSourceId',
      { type: 'time-values', content: [] }
    ]);
  });

  it('should set logger', () => {
    service.setLogger(logger as unknown as pino.Logger);
    // engine.setLogger is also called once in the constructor; verify the last call used our logger
    assert.ok(engine.setLogger.mock.calls.some(c => c.arguments[0] === logger));
    assert.ok(oIAnalyticsMessageService.setLogger.mock.calls.some(c => c.arguments[0] === logger));
  });

  it('should correctly update settings and call callback methods', async () => {
    const newEngineSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    newEngineSettings.name = 'updated oibus';
    newEngineSettings.proxyEnabled = true;
    newEngineSettings.port = 999;
    const specificCommand: EngineSettingsCommandDTO = JSON.parse(JSON.stringify(testData.engine.command));
    specificCommand.logParameters.loki.password = 'updated password';
    specificCommand.port = 999;

    // seq: first get() = old settings (for comparison), second get() = new settings (after update), third get() = new settings again
    let getCallCount = 0;
    engineRepository.get.mock.mockImplementation(() => {
      getCallCount++;
      if (getCallCount === 1) return testData.engine.settings;
      return newEngineSettings;
    });

    const portChangeEmitSpy = mock.method(service.portChangeEvent, 'emit', mock.fn());

    // Temporarily use real timers for setImmediate
    mock.timers.reset();

    const result = await service.updateEngineSettings(specificCommand, testData.users.list[0].id);

    assert.deepStrictEqual(result, {
      needsRedirect: true,
      newPort: 999
    });
    assert.strictEqual(engineRepository.get.mock.calls.length, 3);
    const encryptionMock = mockEncryptionService.encryptionService as EncryptionServiceMock;
    assert.strictEqual(encryptionMock.encryptText.mock.calls.length, 1);
    assert.strictEqual(engineRepository.update.mock.calls.length, 1);
    assert.strictEqual(loggerService.stop.mock.calls.length, 1);
    assert.strictEqual(loggerService.start.mock.calls.length, 1);
    assert.strictEqual(loggerService.createChildLogger.mock.calls.length, 3); // in constructor and 2x at update
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);

    // Wait for setImmediate callback to execute
    await new Promise(resolve => setImmediate(resolve));

    // Verify port change event was emitted
    assert.strictEqual(portChangeEmitSpy.mock.calls.length, 1);
    assert.deepStrictEqual(portChangeEmitSpy.mock.calls[0].arguments, ['updated', 999]);

    // Restore fake timers
    mock.timers.enable({
      apis: ['Date', 'setInterval', 'setImmediate', 'setTimeout'],
      now: new Date(testData.constants.dates.FAKE_NOW).getTime()
    });
  });

  it('should throw error if bad port configuration', async () => {
    await assert.rejects(
      () =>
        service.updateEngineSettings({ ...testData.engine.command, proxyPort: testData.engine.command.port }, testData.users.list[0].id),
      new Error('Web server port and proxy port can not be the same')
    );

    assert.strictEqual(engineRepository.update.mock.calls.length, 0);
  });

  it('should correctly update settings without encrypting password', async () => {
    const specificTestCommand: Omit<EngineSettings, 'id' | 'version'> = JSON.parse(JSON.stringify(testData.engine.command));
    specificTestCommand.logParameters.loki.password = '';
    specificTestCommand.proxyEnabled = false;

    let getCallCount = 0;
    engineRepository.get.mock.mockImplementation(() => {
      getCallCount++;
      if (getCallCount === 1) return testData.engine.settings;
      return specificTestCommand;
    });

    const result = await service.updateEngineSettings(specificTestCommand, testData.users.list[0].id);

    assert.deepStrictEqual(result, {
      needsRedirect: false,
      newPort: null
    });
    assert.strictEqual(engineRepository.get.mock.calls.length, 3);
    const encryptionMock = mockEncryptionService.encryptionService as EncryptionServiceMock;
    assert.strictEqual(encryptionMock.encryptText.mock.calls.length, 0);
    assert.strictEqual(engineRepository.update.mock.calls.length, 1);
  });

  it('should correctly update settings without reloading logger', async () => {
    const specificTestCommand: Omit<EngineSettings, 'id' | 'version'> = JSON.parse(JSON.stringify(testData.engine.command));
    specificTestCommand.logParameters = JSON.parse(JSON.stringify(testData.engine.settings.logParameters));

    await service.updateEngineSettings(specificTestCommand, testData.users.list[0].id);

    assert.strictEqual(loggerService.stop.mock.calls.length, 0);
    assert.strictEqual(loggerService.start.mock.calls.length, 0);
    assert.strictEqual(loggerService.createChildLogger.mock.calls.length, 1); // in constructor only
  });

  it('should correctly restart OIBus', async () => {
    const processExitSpy = mock.method(process, 'exit', mock.fn());

    await service.restart();
    mock.timers.tick(100);
    assert.strictEqual(processExitSpy.mock.calls.length, 1);
  });

  it('should log health signal', async () => {
    northService.list.mock.mockImplementation(() => []);
    southService.list.mock.mockImplementation(() => []);
    historyQueryService.list.mock.mockImplementation(() => []);
    await service.start();
    assert.strictEqual((logger.info as ReturnType<typeof mock.fn>).mock.calls.length, 3); // starting, health info, started

    service.logHealthSignal();
    assert.strictEqual((logger.info as ReturnType<typeof mock.fn>).mock.calls.length, 4);

    mock.timers.tick(1_800_000);
    assert.strictEqual((logger.info as ReturnType<typeof mock.fn>).mock.calls.length, 5);
  });

  it('should update and reset metrics', async () => {
    mock.method(
      process,
      'uptime',
      mock.fn(() => 10000)
    );
    mock.method(
      os,
      'freemem',
      mock.fn(() => 2_000_000)
    );
    mock.method(
      os,
      'totalmem',
      mock.fn(() => 16_000_000)
    );

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

    assert.strictEqual(engineMetricsRepository.updateMetrics.mock.calls.length, 0);
    mock.timers.tick(1000);
    mock.timers.tick(1000);
    mock.timers.tick(1000);
    mock.timers.tick(1000);

    assert.strictEqual(engineMetricsRepository.updateMetrics.mock.calls.length, 4);
    assert.deepStrictEqual(engineMetricsRepository.updateMetrics.mock.calls[3].arguments[1], {
      metricsStart: '2020-01-01T00:00:00.000',
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

    priv()['updateEngineMetrics'] = mock.fn();

    service.resetEngineMetrics();
    assert.strictEqual(engineMetricsRepository.removeMetrics.mock.calls.length, 1);
    assert.deepStrictEqual(engineMetricsRepository.removeMetrics.mock.calls[0].arguments, [testData.engine.settings.id]);
    assert.strictEqual(engineMetricsRepository.initMetrics.mock.calls.length, 2); // once in start(), once in resetEngineMetrics()
    assert.strictEqual((priv()['updateEngineMetrics'] as ReturnType<typeof mock.fn>).mock.calls.length, 1);
  });

  it('should get stream', () => {
    const stream = service.stream;
    stream.write = mock.fn();
    mock.timers.tick(100);
    assert.strictEqual((stream.write as ReturnType<typeof mock.fn>).mock.calls.length, 1);

    // The timer tick wrote this.metrics (= testData.engine.metrics) as the first call.
    // updateEngineMetrics() writes newly computed values as the second call.
    // The original Jest test used toHaveBeenCalledWith which matches ANY call, so we check
    // the first write (index 0) which has the unmodified testData.engine.metrics values.
    service.updateEngineMetrics();
    assert.strictEqual(
      (stream.write as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0],
      `data: ${JSON.stringify({
        metricsStart: '2020-01-01T00:00:00.000',
        processCpuUsageInstant: 0,
        processCpuUsageAverage: 0.0000002,
        processUptime: 10000,
        freeMemory: 2_000_000,
        totalMemory: 16_000_000,
        minRss: 5,
        currentRss: 5,
        maxRss: 5,
        minHeapTotal: 5,
        currentHeapTotal: 5,
        maxHeapTotal: 5,
        minHeapUsed: 5,
        currentHeapUsed: 5,
        maxHeapUsed: 5,
        minExternal: 5,
        currentExternal: 5,
        maxExternal: 5,
        minArrayBuffers: 5,
        currentArrayBuffers: 5,
        maxArrayBuffers: 5
      })}\n\n`
    );

    assert.ok(service.stream !== undefined && service.stream !== null);
  });

  it('should get OIBus info', () => {
    mockUtils.getOIBusInfo = mock.fn(() => testData.engine.oIBusInfo);

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
        name: engineSettings.name,
        port: engineSettings.port,
        version: engineSettings.version,
        launcherVersion: engineSettings.launcherVersion,
        proxyEnabled: engineSettings.proxyEnabled,
        proxyPort: engineSettings.proxyPort,
        logParameters: {
          console: {
            level: engineSettings.logParameters.console.level
          },
          file: {
            level: engineSettings.logParameters.file.level,
            maxFileSize: engineSettings.logParameters.file.maxFileSize,
            numberOfFiles: engineSettings.logParameters.file.numberOfFiles
          },
          database: {
            level: engineSettings.logParameters.database.level,
            maxNumberOfLogs: engineSettings.logParameters.database.maxNumberOfLogs
          },

          loki: {
            level: engineSettings.logParameters.loki.level,
            interval: engineSettings.logParameters.loki.interval,
            address: engineSettings.logParameters.loki.address,
            username: engineSettings.logParameters.loki.username,
            password: ''
          },
          oia: {
            level: engineSettings.logParameters.oia.level,
            interval: engineSettings.logParameters.oia.interval
          }
        }
      }
    );
  });
});
