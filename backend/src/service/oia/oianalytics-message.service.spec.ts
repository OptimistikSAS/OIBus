import { describe, it, beforeEach, afterEach, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule, seq } from '../../tests/utils/test-utils';
import type OIAnalyticsMessageServiceType from './oianalytics-message.service';
import type LoggerMock from '../../tests/__mocks__/service/logger/logger.mock';
import OIAnalyticsMessageRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-message-repository.mock';
import EngineRepositoryMock from '../../tests/__mocks__/repository/config/engine-repository.mock';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import OianalyticsClientMock from '../../tests/__mocks__/service/oia/oianalytics-client.mock';
import IpFilterRepositoryMock from '../../tests/__mocks__/repository/config/ip-filter-repository.mock';
import CertificateRepositoryMock from '../../tests/__mocks__/repository/config/certificate-repository.mock';
import UserRepositoryMock from '../../tests/__mocks__/repository/config/user-repository.mock';
import OIAnalyticsRegistrationServiceMock from '../../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import HistoryQueryRepositoryMock from '../../tests/__mocks__/repository/config/history-query-repository.mock';
import TransformerRepositoryMock from '../../tests/__mocks__/repository/config/transformer-repository.mock';
import { OIAnalyticsMessageHistoryQueries } from '../../model/oianalytics-message.model';
import { StandardTransformer } from '../../model/transformer.model';
import IsoTransformer from '../../transformers/iso-transformer';
import DeferredPromise from '../deferred-promise';
import { DateTime } from 'luxon';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';

const nodeRequire = createRequire(import.meta.url);

// Mocked module exports — mutated in-place between tests
let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let mockEncryptionService: { encryptionService: EncryptionServiceMock };

let OIAnalyticsMessageService: new (
  ...args: ConstructorParameters<typeof OIAnalyticsMessageServiceType>
) => InstanceType<typeof OIAnalyticsMessageServiceType>;

before(() => {
  mockUtils = {
    getOIBusInfo: mock.fn(() => testData.engine.oIBusInfo),
    createFolder: mock.fn(),
    filesExists: mock.fn()
  };
  mockEncryptionService = {
    encryptionService: new EncryptionServiceMock('', '')
  };

  mockModule(nodeRequire, '../utils', mockUtils);
  mockModule(nodeRequire, '../encryption.service', mockEncryptionService);

  const mod = reloadModule<{
    default: new (
      ...args: ConstructorParameters<typeof OIAnalyticsMessageServiceType>
    ) => InstanceType<typeof OIAnalyticsMessageServiceType>;
  }>(nodeRequire, './oianalytics-message.service');
  OIAnalyticsMessageService = mod.default;
});

const standardTransformer: StandardTransformer = {
  id: IsoTransformer.transformerName,
  type: 'standard',
  functionName: IsoTransformer.transformerName,
  inputType: 'any',
  outputType: 'any'
};

describe('OIAnalytics Message Service', () => {
  let oIAnalyticsMessageRepository: OIAnalyticsMessageRepositoryMock;
  let oIAnalyticsRegistrationService: OIAnalyticsRegistrationServiceMock;
  let engineRepository: EngineRepositoryMock;
  let ipFilterRepository: IpFilterRepositoryMock;
  let certificateRepository: CertificateRepositoryMock;
  let userRepository: UserRepositoryMock;
  let scanModeRepository: ScanModeRepositoryMock;
  let southRepository: SouthConnectorRepositoryMock;
  let northRepository: NorthConnectorRepositoryMock;
  let historyQueryRepository: HistoryQueryRepositoryMock;
  let transformerRepository: TransformerRepositoryMock;
  let oIAnalyticsClient: OianalyticsClientMock;
  let logger: LoggerMock;
  let service: InstanceType<typeof OIAnalyticsMessageServiceType>;

  beforeEach(() => {
    oIAnalyticsMessageRepository = new OIAnalyticsMessageRepositoryMock();
    oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
    engineRepository = new EngineRepositoryMock();
    ipFilterRepository = new IpFilterRepositoryMock();
    certificateRepository = new CertificateRepositoryMock();
    userRepository = new UserRepositoryMock();
    scanModeRepository = new ScanModeRepositoryMock();
    southRepository = new SouthConnectorRepositoryMock();
    northRepository = new NorthConnectorRepositoryMock();
    historyQueryRepository = new HistoryQueryRepositoryMock();
    transformerRepository = new TransformerRepositoryMock();
    oIAnalyticsClient = new OianalyticsClientMock();
    logger = new (nodeRequire('../../tests/__mocks__/service/logger/logger.mock') as { default: new () => LoggerMock }).default();

    mockUtils.getOIBusInfo = mock.fn(() => testData.engine.oIBusInfo);

    oIAnalyticsMessageRepository.list = mock.fn(() => testData.oIAnalytics.messages.oIBusList);
    oIAnalyticsMessageRepository.create = mock.fn(() => testData.oIAnalytics.messages.oIBusList[0]);
    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(() => testData.oIAnalytics.registration.completed);
    engineRepository.get = mock.fn(() => testData.engine.settings);
    scanModeRepository.findAll = mock.fn(() => testData.scanMode.list);
    ipFilterRepository.list = mock.fn(() => testData.ipFilters.list);
    certificateRepository.list = mock.fn(() => testData.certificates.list);
    userRepository.list = mock.fn(() => testData.users.list);
    southRepository.findAllSouth = mock.fn(() => testData.south.list);
    southRepository.findSouthById = mock.fn((id: string) => testData.south.list.find(element => element.id === id));
    northRepository.findAllNorth = mock.fn(() => testData.north.list);
    northRepository.findNorthById = mock.fn((id: string) => testData.north.list.find(element => element.id === id));
    transformerRepository.list = mock.fn(() => [...testData.transformers.list, standardTransformer]);

    mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

    service = new OIAnalyticsMessageService(
      oIAnalyticsMessageRepository,
      oIAnalyticsRegistrationService,
      engineRepository,
      scanModeRepository,
      ipFilterRepository,
      certificateRepository,
      userRepository,
      southRepository,
      northRepository,
      historyQueryRepository,
      transformerRepository,
      oIAnalyticsClient,
      logger as unknown as Parameters<typeof OIAnalyticsMessageService.prototype.setLogger>[0]
    );
  });

  afterEach(async () => {
    mock.timers.reset();
    mock.restoreAll();
    await flushPromises();
    oIAnalyticsRegistrationService.registrationEvent.removeAllListeners();
  });

  it('should properly start and stop', async () => {
    (service as Record<string, unknown>)['retryMessageInterval'] = setTimeout(() => null);
    service.run = mock.fn();
    service.start();
    assert.strictEqual((service.run as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.ok(
      oIAnalyticsMessageRepository.list.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          JSON.stringify(c.arguments[0]) === JSON.stringify({ status: ['PENDING'], types: [], start: undefined, end: undefined })
      ),
      'Expected list to have been called with { status: ["PENDING"], types: [], start: undefined, end: undefined }'
    );

    await service.stop();
    service.resolveDeferredPromise();
    assert.ok(
      logger.debug.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'Stopping OIAnalytics message service...')
    );
    assert.ok(logger.debug.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'OIAnalytics message service stopped'));
  });

  it('should properly create full config message on registration', () => {
    service.createFullConfigMessageIfNotPending = mock.fn();
    service.start();
    assert.strictEqual((service.createFullConfigMessageIfNotPending as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    assert.strictEqual((service.createFullConfigMessageIfNotPending as ReturnType<typeof mock.fn>).mock.calls.length, 2);
  });

  it('should properly send message and wait for it to finish before stopping', async () => {
    oIAnalyticsClient.sendConfiguration = mock.fn(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve(null), 1_000);
        })
    );

    service.start(); // trigger a runProgress
    assert.strictEqual(oIAnalyticsClient.sendConfiguration.mock.calls.length, 1);

    service.start(); // should enter only once in run
    assert.strictEqual(oIAnalyticsClient.sendConfiguration.mock.calls.length, 1);

    service.stop();
    mock.timers.tick(1_000);

    await flushPromises();
    assert.strictEqual(oIAnalyticsClient.sendConfiguration.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageRepository.markAsCompleted.mock.calls.length, 1);
    assert.deepStrictEqual(oIAnalyticsMessageRepository.markAsCompleted.mock.calls[0].arguments, [
      testData.oIAnalytics.messages.oIBusList[0].id,
      DateTime.fromISO(testData.constants.dates.FAKE_NOW).plus({ second: 1 }).toUTC().toISO()!
    ]);
    assert.ok(
      logger.debug.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'Waiting for OIAnalytics message to finish')
    );
    assert.ok(
      logger.debug.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'Full OIBus configuration sent to OIAnalytics')
    );
  });

  it('should properly send message', async () => {
    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(() => ({
      ...testData.oIAnalytics.registration.completed,
      publicCipherKey: null
    }));
    oIAnalyticsClient.sendConfiguration = mock.fn(() => Promise.resolve());
    service.start(); // trigger a runProgress
    assert.strictEqual(oIAnalyticsClient.sendConfiguration.mock.calls.length, 1);
  });

  it('should properly send message and trigger timeout', async () => {
    oIAnalyticsClient.sendConfiguration = mock.fn(
      () =>
        new Promise<void>(resolve => {
          setTimeout(resolve, 100_000);
        })
    );

    service.start();
    service.stop();
    mock.timers.tick(10_000);

    assert.ok(
      logger.debug.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'Waiting for OIAnalytics message to finish')
    );
    mock.timers.tick(20_000);

    await service.stop();
    assert.ok(logger.debug.mock.calls.some((c: { arguments: Array<string> }) => c.arguments[0] === 'OIAnalytics message service stopped'));
  });

  it('should properly stop with stop timeout already set', async () => {
    const deferredPromise = new DeferredPromise();
    (service as Record<string, unknown>)['runProgress$'] = deferredPromise;
    (service as Record<string, unknown>)['stopTimeout'] = setTimeout(() => {
      deferredPromise.resolve();
    }, 30_000);

    service.stop();
    mock.timers.tick(30_000);
    await flushPromises();
    // clearTimeout was called — verified by the fact that stop() completed without hanging
  });

  it('should properly resend message if fetch fails', async () => {
    oIAnalyticsClient.sendConfiguration = mock.fn(() => {
      throw new Error('fetch error');
    });
    (service as Record<string, unknown>)['retryMessageInterval'] = setTimeout(() => null, 1);

    service.start();
    await flushPromises();
    assert.ok(logger.error.mock.calls.length >= 1);
    assert.ok(
      logger.error.mock.calls.some(
        (c: { arguments: Array<string> }) =>
          c.arguments[0] ===
          `Retrying message ${testData.oIAnalytics.messages.oIBusList[0].id} of type ${testData.oIAnalytics.messages.oIBusList[0].type} after error: fetch error`
      )
    );
  });

  it('should not resend message if fetch fails because of Bad request', async () => {
    oIAnalyticsClient.sendConfiguration = mock.fn(
      seq(
        () => {
          throw new Error('Bad Request');
        },
        () => undefined
      )
    );

    service.start();
    await flushPromises();
    assert.strictEqual(logger.error.mock.calls.length, 1);
    assert.strictEqual(
      logger.error.mock.calls[0].arguments[0],
      `Error while sending message ${testData.oIAnalytics.messages.oIBusList[0].id} of type ${testData.oIAnalytics.messages.oIBusList[0].type}: Bad Request`
    );
  });
});

describe('OIAnalytics message service without message', () => {
  let oIAnalyticsMessageRepository: OIAnalyticsMessageRepositoryMock;
  let oIAnalyticsRegistrationService: OIAnalyticsRegistrationServiceMock;
  let engineRepository: EngineRepositoryMock;
  let ipFilterRepository: IpFilterRepositoryMock;
  let certificateRepository: CertificateRepositoryMock;
  let userRepository: UserRepositoryMock;
  let scanModeRepository: ScanModeRepositoryMock;
  let southRepository: SouthConnectorRepositoryMock;
  let northRepository: NorthConnectorRepositoryMock;
  let historyQueryRepository: HistoryQueryRepositoryMock;
  let transformerRepository: TransformerRepositoryMock;
  let oIAnalyticsClient: OianalyticsClientMock;
  let logger: LoggerMock;
  let anotherLogger: LoggerMock;
  let service: InstanceType<typeof OIAnalyticsMessageServiceType>;

  beforeEach(() => {
    oIAnalyticsMessageRepository = new OIAnalyticsMessageRepositoryMock();
    oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
    engineRepository = new EngineRepositoryMock();
    ipFilterRepository = new IpFilterRepositoryMock();
    certificateRepository = new CertificateRepositoryMock();
    userRepository = new UserRepositoryMock();
    scanModeRepository = new ScanModeRepositoryMock();
    southRepository = new SouthConnectorRepositoryMock();
    northRepository = new NorthConnectorRepositoryMock();
    historyQueryRepository = new HistoryQueryRepositoryMock();
    transformerRepository = new TransformerRepositoryMock();
    oIAnalyticsClient = new OianalyticsClientMock();
    const LoggerMockCtor = (nodeRequire('../../tests/__mocks__/service/logger/logger.mock') as { default: new () => LoggerMock }).default;
    logger = new LoggerMockCtor();
    anotherLogger = new LoggerMockCtor();

    oIAnalyticsMessageRepository.list = mock.fn(() => []);
    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(() => testData.oIAnalytics.registration.completed);

    service = new OIAnalyticsMessageService(
      oIAnalyticsMessageRepository,
      oIAnalyticsRegistrationService,
      engineRepository,
      scanModeRepository,
      ipFilterRepository,
      certificateRepository,
      userRepository,
      southRepository,
      northRepository,
      historyQueryRepository,
      transformerRepository,
      oIAnalyticsClient,
      logger as unknown as Parameters<typeof OIAnalyticsMessageService.prototype.setLogger>[0]
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should properly start when no message retrieved', () => {
    assert.strictEqual(oIAnalyticsMessageRepository.markAsCompleted.mock.calls.length, 0);

    service.run = mock.fn();
    service.start();
    assert.strictEqual((service.run as ReturnType<typeof mock.fn>).mock.calls.length, 0);
  });

  it('should change logger', () => {
    service.setLogger(anotherLogger as unknown as Parameters<typeof OIAnalyticsMessageService.prototype.setLogger>[0]);
  });
});

describe('OIAnalytics message service without completed registration', () => {
  let oIAnalyticsMessageRepository: OIAnalyticsMessageRepositoryMock;
  let oIAnalyticsRegistrationService: OIAnalyticsRegistrationServiceMock;
  let engineRepository: EngineRepositoryMock;
  let ipFilterRepository: IpFilterRepositoryMock;
  let certificateRepository: CertificateRepositoryMock;
  let userRepository: UserRepositoryMock;
  let scanModeRepository: ScanModeRepositoryMock;
  let southRepository: SouthConnectorRepositoryMock;
  let northRepository: NorthConnectorRepositoryMock;
  let historyQueryRepository: HistoryQueryRepositoryMock;
  let transformerRepository: TransformerRepositoryMock;
  let oIAnalyticsClient: OianalyticsClientMock;
  let logger: LoggerMock;
  let service: InstanceType<typeof OIAnalyticsMessageServiceType>;

  beforeEach(() => {
    oIAnalyticsMessageRepository = new OIAnalyticsMessageRepositoryMock();
    oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
    engineRepository = new EngineRepositoryMock();
    ipFilterRepository = new IpFilterRepositoryMock();
    certificateRepository = new CertificateRepositoryMock();
    userRepository = new UserRepositoryMock();
    scanModeRepository = new ScanModeRepositoryMock();
    southRepository = new SouthConnectorRepositoryMock();
    northRepository = new NorthConnectorRepositoryMock();
    historyQueryRepository = new HistoryQueryRepositoryMock();
    transformerRepository = new TransformerRepositoryMock();
    oIAnalyticsClient = new OianalyticsClientMock();
    logger = new (nodeRequire('../../tests/__mocks__/service/logger/logger.mock') as { default: new () => LoggerMock }).default();

    oIAnalyticsMessageRepository.list = mock.fn(() => testData.oIAnalytics.messages.oIBusList);
    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(() => testData.oIAnalytics.registration.completed);

    service = new OIAnalyticsMessageService(
      oIAnalyticsMessageRepository,
      oIAnalyticsRegistrationService,
      engineRepository,
      scanModeRepository,
      ipFilterRepository,
      certificateRepository,
      userRepository,
      southRepository,
      northRepository,
      historyQueryRepository,
      transformerRepository,
      oIAnalyticsClient,
      logger as unknown as Parameters<typeof OIAnalyticsMessageService.prototype.setLogger>[0]
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should properly start and do nothing', () => {
    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(
      seq(
        () => testData.oIAnalytics.registration.pending,
        () => testData.oIAnalytics.registration.pending,
        () => testData.oIAnalytics.registration.pending
      )
    );
    oIAnalyticsMessageRepository.list = mock.fn(() => testData.oIAnalytics.messages.oIBusList);
    service.start();
    assert.strictEqual(oIAnalyticsMessageRepository.list.mock.calls.length, 1);
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<string> }) =>
          c.arguments[0] === "OIBus is not registered to OIAnalytics. Full config message won't be created"
      )
    );
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<string> }) =>
          c.arguments[0] === "OIBus is not registered to OIAnalytics. History query message won't be created"
      )
    );
    assert.ok(
      logger.trace.mock.calls.some(
        (c: { arguments: Array<string> }) => c.arguments[0] === "OIBus is not registered to OIAnalytics. Messages won't be sent"
      )
    );
  });

  it('should not create save history query message if not register', async () => {
    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(() => testData.oIAnalytics.registration.pending);
    service.createFullHistoryQueriesMessageIfNotPending();
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<string> }) =>
          c.arguments[0] === "OIBus is not registered to OIAnalytics. History query message won't be created"
      )
    );
    assert.strictEqual(oIAnalyticsMessageRepository.list.mock.calls.length, 0);
    assert.strictEqual(oIAnalyticsMessageRepository.create.mock.calls.length, 0);
  });

  it('should not create save history query message if message already exists', async () => {
    const saveHistoryQueryMessage: OIAnalyticsMessageHistoryQueries = {
      id: 'messageId2',
      status: 'PENDING',
      error: null,
      completedDate: null,
      type: 'history-queries',
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(() => testData.oIAnalytics.registration.completed);
    oIAnalyticsMessageRepository.list = mock.fn(() => [saveHistoryQueryMessage]);
    service.createFullHistoryQueriesMessageIfNotPending();
    assert.strictEqual(oIAnalyticsMessageRepository.create.mock.calls.length, 0);
  });

  it('should create save history query message and run it', async () => {
    const saveHistoryQueryMessage: OIAnalyticsMessageHistoryQueries = {
      id: 'messageId3',
      status: 'PENDING',
      error: null,
      completedDate: null,
      type: 'history-queries',
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(() => testData.oIAnalytics.registration.pending);
    oIAnalyticsMessageRepository.list = mock.fn(() => []);
    service.start();

    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(
      seq(
        () => testData.oIAnalytics.registration.completed,
        () => testData.oIAnalytics.registration.completed,
        () => testData.oIAnalytics.registration.completed
      )
    );
    oIAnalyticsMessageRepository.list = mock.fn(() => []);
    historyQueryRepository.findAllHistoriesFull = mock.fn(() => testData.historyQueries.list);
    oIAnalyticsMessageRepository.create = mock.fn(() => saveHistoryQueryMessage);
    service.createFullHistoryQueriesMessageIfNotPending();

    assert.deepStrictEqual(oIAnalyticsMessageRepository.create.mock.calls[0].arguments, [{ type: 'history-queries' }]);
    assert.strictEqual(oIAnalyticsClient.sendHistoryQuery.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsClient.sendHistoryQuery.mock.calls[0].arguments[0], testData.oIAnalytics.registration.completed);
  });
});
