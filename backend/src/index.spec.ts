/**
 * Tests for the bootstrap() and runAsMain() functions exported from index.ts.
 * All external services and the filesystem are mocked so the test process
 * never starts real databases, HTTP servers, or connectivity.
 */
import { describe, it, before, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mockModule, reloadModule, flushPromises } from './tests/utils/test-utils';
import LoggerMock from './tests/__mocks__/service/logger/logger.mock';

const nodeRequire = createRequire(import.meta.url);

interface IndexModule {
  bootstrap: () => Promise<void>;
  runAsMain: () => boolean;
}

// ─── Shared mock objects ────────────────────────────────────────────────────

const loggerInst = new LoggerMock();

const makeLoggerServiceMock = () => ({
  logger: loggerInst,
  init: mock.fn(() => undefined),
  start: mock.fn(async () => undefined),
  stop: mock.fn(() => undefined),
  createChildLogger: mock.fn(() => loggerInst)
});

const fakeEngineSettings = {
  id: 'oibus-id-1',
  name: 'OIBus',
  port: 2223,
  version: '3.0.0',
  launcherVersion: '3.0.0'
};

const fakeCryptoSettings = {
  id: 'oibus-id-1',
  algorithm: 'aes-256-cbc',
  initVector: 'iv',
  securityKey: 'sk'
};

function makeCryptoRepoMock(settingsValue: unknown) {
  return {
    getCryptoSettings: mock.fn(() => settingsValue),
    createCryptoSettings: mock.fn()
  };
}

function makeEngineRepoMock(settingsValue: unknown) {
  return { get: mock.fn(() => settingsValue), update: mock.fn(), updateVersion: mock.fn() };
}

function makeRepositoryServiceMock(engineSettings: unknown, cryptoSettings: unknown) {
  return {
    engineRepository: makeEngineRepoMock(engineSettings),
    cryptoRepository: makeCryptoRepoMock(cryptoSettings),
    oianalyticsRegistrationRepository: { get: mock.fn(() => null) },
    oianalyticsMessageRepository: {},
    scanModeRepository: {},
    ipFilterRepository: {},
    certificateRepository: {},
    userRepository: {},
    logRepository: {},
    southConnectorRepository: {},
    northConnectorRepository: {},
    historyQueryRepository: {},
    historyQueryMetricsRepository: {},
    southCacheRepository: {},
    southMetricsRepository: {},
    northMetricsRepository: {},
    oianalyticsCommandRepository: {},
    engineMetricsRepository: {},
    southItemGroupRepository: {},
    transformerRepository: {}
  };
}

function makeServiceMock() {
  return { start: mock.fn(async () => undefined), stop: mock.fn(async () => undefined) };
}

function makeWebServerMock() {
  return { init: mock.fn(async () => undefined), stop: mock.fn(async () => undefined) };
}

// ─── Setup: mock all dependencies and load bootstrap ────────────────────────

describe('index.ts bootstrap()', () => {
  let indexMod: IndexModule;
  let loggerServiceMock: ReturnType<typeof makeLoggerServiceMock>;
  let repoServiceMock: ReturnType<typeof makeRepositoryServiceMock>;
  let webServerMock: ReturnType<typeof makeWebServerMock>;
  let oibusServiceMock: ReturnType<typeof makeServiceMock>;
  let oianalyticsCommandServiceMock: ReturnType<typeof makeServiceMock>;
  let oianalyticsMessageServiceMock: { start: ReturnType<typeof mock.fn>; stop: ReturnType<typeof mock.fn> };
  let cleanupServiceMock: ReturnType<typeof makeServiceMock>;
  let oianalyticsRegistrationServiceMock: { start: ReturnType<typeof mock.fn>; stop: ReturnType<typeof mock.fn> };

  before(() => {
    mock.method(console, 'info', () => undefined);
    mock.method(console, 'error', () => undefined);
  });

  function setupMocks(engineSettings: unknown, cryptoSettings: unknown, version = false) {
    // Mock process methods that index.ts calls at runtime (not in before() since afterEach restores).
    mock.method(process, 'chdir', mock.fn());

    loggerServiceMock = makeLoggerServiceMock();
    repoServiceMock = makeRepositoryServiceMock(engineSettings, cryptoSettings);
    webServerMock = makeWebServerMock();
    oibusServiceMock = makeServiceMock();
    oianalyticsCommandServiceMock = makeServiceMock();
    oianalyticsMessageServiceMock = { start: mock.fn(), stop: mock.fn(async () => undefined) };
    cleanupServiceMock = makeServiceMock();
    oianalyticsRegistrationServiceMock = { start: mock.fn(), stop: mock.fn() };

    mockModule(nodeRequire, './service/utils', {
      __esModule: true,
      INIT_CONFIG_FILENAME: 'init-config.json',
      getCommandLineArguments: () => ({
        configFile: '/tmp',
        version,
        ignoreIpFilters: false,
        ignoreRemoteUpdate: false,
        ignoreRemoteConfig: false,
        launcherVersion: '3.0.0'
      }),
      createFolder: async () => undefined,
      readInitConfig: () => ({}),
      getOIBusInfo: () => ({})
    });

    mockModule(nodeRequire, './migration/migration-service', {
      __esModule: true,
      migrateEntities: async () => undefined,
      migrateLogs: async () => undefined,
      migrateMetrics: async () => undefined,
      migrateCrypto: async () => undefined,
      migrateSouthCache: async () => undefined,
      migrateDataFolder: async () => undefined
    });

    const repoMock = repoServiceMock;
    mockModule(nodeRequire, './service/repository.service', {
      __esModule: true,
      default: class FakeRepositoryService {
        constructor() {
          Object.assign(this, repoMock);
        }
      }
    });

    mockModule(nodeRequire, './service/encryption.service', {
      __esModule: true,
      encryptionService: { init: async () => undefined }
    });

    const loggerMock = loggerServiceMock;
    mockModule(nodeRequire, './service/logger/logger.service', {
      __esModule: true,
      loggerService: loggerMock,
      default: class FakeLoggerService {
        constructor() {
          Object.assign(this, loggerMock);
        }
      }
    });

    mockModule(nodeRequire, './service/oia/oianalytics-client.service', {
      __esModule: true,
      default: class FakeOIAnalyticsClient {}
    });

    const regMock = oianalyticsRegistrationServiceMock;
    mockModule(nodeRequire, './service/oia/oianalytics-registration.service', {
      __esModule: true,
      default: class FakeOIAnalyticsRegistrationService {
        constructor() {
          Object.assign(this, regMock);
        }
      }
    });

    const msgMock = oianalyticsMessageServiceMock;
    mockModule(nodeRequire, './service/oia/oianalytics-message.service', {
      __esModule: true,
      default: class FakeOIAnalyticsMessageService {
        constructor() {
          Object.assign(this, msgMock);
        }
      }
    });

    mockModule(nodeRequire, './engine/data-stream-engine', {
      __esModule: true,
      default: class FakeDataStreamEngine {}
    });

    mockModule(nodeRequire, './service/transformer.service', {
      __esModule: true,
      default: class FakeTransformerService {}
    });

    mockModule(nodeRequire, './service/north.service', {
      __esModule: true,
      default: class FakeNorthService {}
    });

    mockModule(nodeRequire, './service/south.service', {
      __esModule: true,
      default: class FakeSouthService {}
    });

    mockModule(nodeRequire, './service/history-query.service', {
      __esModule: true,
      default: class FakeHistoryQueryService {}
    });

    mockModule(nodeRequire, './service/user.service', {
      __esModule: true,
      default: class FakeUserService {}
    });

    mockModule(nodeRequire, './service/log.service', {
      __esModule: true,
      default: class FakeLogService {}
    });

    mockModule(nodeRequire, './service/ip-filter.service', {
      __esModule: true,
      default: class FakeIPFilterService {}
    });

    const oibusMock = oibusServiceMock;
    mockModule(nodeRequire, './service/oibus.service', {
      __esModule: true,
      default: class FakeOIBusService {
        constructor() {
          Object.assign(this, oibusMock);
        }
      }
    });

    mockModule(nodeRequire, './service/metrics/home-metrics.service', {
      __esModule: true,
      default: class FakeHomeMetricsService {}
    });

    mockModule(nodeRequire, './service/scan-mode.service', {
      __esModule: true,
      default: class FakeScanModeService {}
    });

    mockModule(nodeRequire, './service/certificate.service', {
      __esModule: true,
      default: class FakeCertificateService {}
    });

    const cmdMock = oianalyticsCommandServiceMock;
    mockModule(nodeRequire, './service/oia/oianalytics-command.service', {
      __esModule: true,
      default: class FakeOIAnalyticsCommandService {
        constructor() {
          Object.assign(this, cmdMock);
        }
      }
    });

    const cleanMock = cleanupServiceMock;
    mockModule(nodeRequire, './service/cache/cleanup.service', {
      __esModule: true,
      default: class FakeCleanupService {
        constructor() {
          Object.assign(this, cleanMock);
        }
      }
    });

    const wsMock = webServerMock;
    mockModule(nodeRequire, './web-server/web-server', {
      __esModule: true,
      default: class FakeWebServer {
        constructor() {
          Object.assign(this, wsMock);
        }
      }
    });

    mockModule(nodeRequire, './web-server/controllers/validators/joi.validator', {
      __esModule: true,
      default: class FakeJoiValidator {}
    });

    indexMod = reloadModule<IndexModule>(nodeRequire, './index');
  }

  afterEach(() => {
    mock.restoreAll();
  });

  it('returns early when engineRepository.get() returns null', async () => {
    setupMocks(null, null);
    await assert.doesNotReject(() => indexMod.bootstrap());
    assert.equal(webServerMock.init.mock.calls.length, 0);
  });

  it('returns early when cryptoSettings is null after createCryptoSettings', async () => {
    setupMocks(fakeEngineSettings, null);
    await assert.doesNotReject(() => indexMod.bootstrap());
    assert.equal(webServerMock.init.mock.calls.length, 0);
  });

  it('calls process.exit(0) when version=true', async () => {
    const exitMock = mock.fn();
    mock.method(process, 'exit', exitMock as never);
    setupMocks(fakeEngineSettings, fakeCryptoSettings, true);
    await assert.doesNotReject(() => indexMod.bootstrap());
    assert.equal(exitMock.mock.calls.length, 1);
    assert.equal(exitMock.mock.calls[0]?.arguments[0], 0);
  });

  it('completes the happy-path bootstrap and starts the web server', async () => {
    setupMocks(fakeEngineSettings, fakeCryptoSettings);
    await assert.doesNotReject(() => indexMod.bootstrap());
    assert.equal(webServerMock.init.mock.calls.length, 1);
    assert.equal(oibusServiceMock.start.mock.calls.length, 1);
    assert.equal(oianalyticsCommandServiceMock.start.mock.calls.length, 1);
    assert.equal(cleanupServiceMock.start.mock.calls.length, 1);
  });

  it('SIGINT handler stops all services', async () => {
    setupMocks(fakeEngineSettings, fakeCryptoSettings);

    const processOnMock = mock.fn();
    mock.method(process, 'on', processOnMock as never);

    await indexMod.bootstrap();

    const sigintCall = processOnMock.mock.calls.find(c => c.arguments[0] === 'SIGINT');
    const sigintHandler = sigintCall?.arguments[1] as (() => Promise<void>) | undefined;
    assert.ok(sigintHandler, 'SIGINT handler should be registered');

    await sigintHandler!();

    assert.equal(oibusServiceMock.stop.mock.calls.length, 1);
    assert.equal(oianalyticsCommandServiceMock.stop.mock.calls.length, 1);
    assert.equal(oianalyticsMessageServiceMock.stop.mock.calls.length, 1);
    assert.equal(webServerMock.stop.mock.calls.length, 1);
    assert.equal(cleanupServiceMock.stop.mock.calls.length, 1);
    assert.equal(oianalyticsRegistrationServiceMock.stop.mock.calls.length, 1);
    assert.equal(loggerServiceMock.stop.mock.calls.length, 1);
  });

  it('SIGINT handler is guarded against concurrent invocations (stopping=true)', async () => {
    setupMocks(fakeEngineSettings, fakeCryptoSettings);

    const processOnMock = mock.fn();
    mock.method(process, 'on', processOnMock as never);

    await indexMod.bootstrap();

    const sigintCall = processOnMock.mock.calls.find(c => c.arguments[0] === 'SIGINT');
    const sigintHandler = sigintCall?.arguments[1] as (() => Promise<void>) | undefined;
    assert.ok(sigintHandler);

    const firstCall = sigintHandler!();
    const secondCall = sigintHandler!();
    await Promise.all([firstCall, secondCall]);

    // oibusService.stop should be called exactly once despite two SIGINT calls.
    assert.equal(oibusServiceMock.stop.mock.calls.length, 1);
  });

  describe('runAsMain()', () => {
    it('returns false and does not bootstrap when not the entry point', () => {
      setupMocks(fakeEngineSettings, fakeCryptoSettings);
      const originalArgv1 = process.argv[1];
      process.argv[1] = '/some/test-runner.js';
      try {
        assert.equal(indexMod.runAsMain(), false);
      } finally {
        process.argv[1] = originalArgv1;
      }
    });

    it('returns true and triggers bootstrap when invoked as the entry point', async () => {
      setupMocks(fakeEngineSettings, fakeCryptoSettings);
      const originalArgv1 = process.argv[1];
      process.argv[1] = '/app/index.js';
      try {
        assert.equal(indexMod.runAsMain(), true);
        await flushPromises();
        // bootstrap() was invoked, so the web server was initialised.
        assert.equal(webServerMock.init.mock.calls.length, 1);
      } finally {
        process.argv[1] = originalArgv1;
      }
    });
  });
});
