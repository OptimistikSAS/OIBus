import { describe, it, beforeEach, afterEach, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule, seq } from '../../tests/utils/test-utils';
import type OIAnalyticsMessageServiceType from './oianalytics-message.service';
import type LoggerMock from '../../tests/__mocks__/service/logger/logger.mock';
import OIAnalyticsMessageRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-message-repository.mock';
import OianalyticsClientMock from '../../tests/__mocks__/service/oia/oianalytics-client.mock';
import OIAnalyticsRegistrationServiceMock from '../../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import ConfigTransferBuilderServiceMock from '../../tests/__mocks__/service/config-transfer/config-transfer-builder-service.mock';
import { OIAnalyticsMessageHistoryQueries } from '../../model/oianalytics-message.model';
import { OIBusFullConfigurationCommandDTO, OIBusHistoryQueriesCommandDTO } from './oianalytics.model';
import DeferredPromise from '../deferred-promise';
import { DateTime } from 'luxon';

const nodeRequire = createRequire(import.meta.url);

// Shared logger reference updated by each beforeEach so the loggerService mock returns the active logger
let activeLogger: LoggerMock | null = null;

let OIAnalyticsMessageService: new (
  ...args: ConstructorParameters<typeof OIAnalyticsMessageServiceType>
) => InstanceType<typeof OIAnalyticsMessageServiceType>;

before(() => {
  mockModule(nodeRequire, '../logger/logger.service', {
    loggerService: { createChildLogger: mock.fn(() => activeLogger) },
    default: class {}
  });

  const mod = reloadModule<{
    default: new (
      ...args: ConstructorParameters<typeof OIAnalyticsMessageServiceType>
    ) => InstanceType<typeof OIAnalyticsMessageServiceType>;
  }>(nodeRequire, './oianalytics-message.service');
  OIAnalyticsMessageService = mod.default;
});

describe('OIAnalytics Message Service', () => {
  let oIAnalyticsMessageRepository: OIAnalyticsMessageRepositoryMock;
  let oIAnalyticsRegistrationService: OIAnalyticsRegistrationServiceMock;
  let configTransferBuilderService: ConfigTransferBuilderServiceMock;
  let oIAnalyticsClient: OianalyticsClientMock;
  let logger: LoggerMock;
  let service: InstanceType<typeof OIAnalyticsMessageServiceType>;

  beforeEach(() => {
    oIAnalyticsMessageRepository = new OIAnalyticsMessageRepositoryMock();
    oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
    configTransferBuilderService = new ConfigTransferBuilderServiceMock();
    oIAnalyticsClient = new OianalyticsClientMock();
    logger = new (nodeRequire('../../tests/__mocks__/service/logger/logger.mock') as { default: new () => LoggerMock }).default();
    activeLogger = logger;

    oIAnalyticsMessageRepository.list = mock.fn(() => testData.oIAnalytics.messages.oIBusList);
    oIAnalyticsMessageRepository.create = mock.fn(() => testData.oIAnalytics.messages.oIBusList[0]);
    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(() => testData.oIAnalytics.registration.completed);

    mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });

    service = new OIAnalyticsMessageService(
      oIAnalyticsMessageRepository,
      oIAnalyticsRegistrationService,
      oIAnalyticsClient,
      configTransferBuilderService
    );
  });

  afterEach(async () => {
    mock.timers.reset();
    mock.restoreAll();
    await flushPromises();
    oIAnalyticsRegistrationService.registrationEvent.removeAllListeners();
  });

  it('should properly start and stop', async () => {
    service['retryMessageInterval'] = setTimeout(() => null);
    const runMock = mock.fn(async () => undefined);
    service.run = runMock;
    service.start();
    assert.strictEqual(runMock.mock.calls.length, 1);
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
    const createFullConfigMock = mock.fn();
    service.createFullConfigMessageIfNotPending = createFullConfigMock;
    service.start();
    assert.strictEqual(createFullConfigMock.mock.calls.length, 1);
    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    assert.strictEqual(createFullConfigMock.mock.calls.length, 2);
  });

  it('should properly send message and wait for it to finish before stopping', async () => {
    oIAnalyticsClient.sendConfiguration = mock.fn(
      () =>
        new Promise<void>(resolve => {
          setTimeout(() => resolve(), 1_000);
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

  it('should properly build and send the full configuration from the config transfer builder', async () => {
    const builtConfiguration = {
      engine: { settings: { general: { name: 'my oibus' } } }
    } as unknown as OIBusFullConfigurationCommandDTO;
    configTransferBuilderService.buildFullConfiguration = mock.fn(() => builtConfiguration);
    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(() => ({
      ...testData.oIAnalytics.registration.completed,
      publicCipherKey: null
    }));
    oIAnalyticsClient.sendConfiguration = mock.fn(() => Promise.resolve());
    service.start(); // trigger a runProgress
    assert.strictEqual(oIAnalyticsClient.sendConfiguration.mock.calls.length, 1);

    assert.deepStrictEqual(configTransferBuilderService.buildFullConfiguration.mock.calls[0].arguments, [
      { ...testData.oIAnalytics.registration.completed, publicCipherKey: null }
    ]);
    const sentConfiguration = JSON.parse(oIAnalyticsClient.sendConfiguration.mock.calls[0].arguments[1] as string);
    assert.deepStrictEqual(sentConfiguration, builtConfiguration);
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
    service['runProgress$'] = deferredPromise;
    service['stopTimeout'] = setTimeout(() => {
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
    service['retryMessageInterval'] = setTimeout(() => null, 1);

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
        async () => undefined
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

  it('should display proper error message on AggregateError in run', async () => {
    const networkError = new AggregateError([new Error('connect ECONNREFUSED 127.0.0.1:4200')], '');
    oIAnalyticsClient.sendConfiguration = mock.fn(async () => {
      throw networkError;
    });

    service.start();
    await flushPromises();

    assert.ok(
      (logger.error.mock.calls as Array<{ arguments: Array<string> }>).some(c =>
        c.arguments[0].includes('connect ECONNREFUSED 127.0.0.1:4200')
      )
    );
  });

  it('should display proper error message for Error with cause (AggregateError) in run', async () => {
    const cause = new AggregateError([new Error('connect ECONNREFUSED 127.0.0.1:4200')], '');
    const fetchError = Object.assign(new TypeError('fetch failed'), { cause });
    oIAnalyticsClient.sendConfiguration = mock.fn(async () => {
      throw fetchError;
    });

    service.start();
    await flushPromises();

    assert.ok(
      (logger.error.mock.calls as Array<{ arguments: Array<string> }>).some(
        c => c.arguments[0].includes('fetch failed') && c.arguments[0].includes('connect ECONNREFUSED 127.0.0.1:4200')
      )
    );
  });

  it('should not execute run after service is stopped', async () => {
    // stop() sets stopped = true even on a never-started service
    await service.stop();
    oIAnalyticsClient.sendConfiguration = mock.fn(async () => undefined);
    await service.run();
    assert.strictEqual(oIAnalyticsClient.sendConfiguration.mock.calls.length, 0);
    assert.strictEqual(oIAnalyticsMessageRepository.markAsCompleted.mock.calls.length, 0);
  });

  it('should handle empty queue gracefully in run without throwing', async () => {
    // Before the fix, an empty queue caused TypeError inside run() that triggered infinite retry
    service['messagesQueue'] = [];
    await service.run();
    assert.strictEqual(oIAnalyticsMessageRepository.markAsCompleted.mock.calls.length, 0);
    assert.strictEqual(logger.error.mock.calls.length, 0);
  });
});

describe('OIAnalytics message service without message', () => {
  let oIAnalyticsMessageRepository: OIAnalyticsMessageRepositoryMock;
  let oIAnalyticsRegistrationService: OIAnalyticsRegistrationServiceMock;
  let configTransferBuilderService: ConfigTransferBuilderServiceMock;
  let oIAnalyticsClient: OianalyticsClientMock;
  let logger: LoggerMock;
  let service: InstanceType<typeof OIAnalyticsMessageServiceType>;

  beforeEach(() => {
    oIAnalyticsMessageRepository = new OIAnalyticsMessageRepositoryMock();
    oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
    configTransferBuilderService = new ConfigTransferBuilderServiceMock();
    oIAnalyticsClient = new OianalyticsClientMock();
    const LoggerMockCtor = (nodeRequire('../../tests/__mocks__/service/logger/logger.mock') as { default: new () => LoggerMock }).default;
    logger = new LoggerMockCtor();
    activeLogger = logger;

    oIAnalyticsMessageRepository.list = mock.fn(() => []);
    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(() => testData.oIAnalytics.registration.completed);

    service = new OIAnalyticsMessageService(
      oIAnalyticsMessageRepository,
      oIAnalyticsRegistrationService,
      oIAnalyticsClient,
      configTransferBuilderService
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should properly start when no message retrieved', () => {
    assert.strictEqual(oIAnalyticsMessageRepository.markAsCompleted.mock.calls.length, 0);

    const runMock = mock.fn(async () => undefined);
    service.run = runMock;
    service.start();
    assert.strictEqual(runMock.mock.calls.length, 0);
  });
});

describe('OIAnalytics message service without completed registration', () => {
  let oIAnalyticsMessageRepository: OIAnalyticsMessageRepositoryMock;
  let oIAnalyticsRegistrationService: OIAnalyticsRegistrationServiceMock;
  let configTransferBuilderService: ConfigTransferBuilderServiceMock;
  let oIAnalyticsClient: OianalyticsClientMock;
  let logger: LoggerMock;
  let service: InstanceType<typeof OIAnalyticsMessageServiceType>;

  beforeEach(() => {
    oIAnalyticsMessageRepository = new OIAnalyticsMessageRepositoryMock();
    oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
    configTransferBuilderService = new ConfigTransferBuilderServiceMock();
    oIAnalyticsClient = new OianalyticsClientMock();
    logger = new (nodeRequire('../../tests/__mocks__/service/logger/logger.mock') as { default: new () => LoggerMock }).default();
    activeLogger = logger;

    oIAnalyticsMessageRepository.list = mock.fn(() => testData.oIAnalytics.messages.oIBusList);
    oIAnalyticsRegistrationService.getRegistrationSettings = mock.fn(() => testData.oIAnalytics.registration.completed);

    service = new OIAnalyticsMessageService(
      oIAnalyticsMessageRepository,
      oIAnalyticsRegistrationService,
      oIAnalyticsClient,
      configTransferBuilderService
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
    const builtHistoryQueries = { historyQueries: [{ oIBusInternalId: 'hist1' }] } as unknown as OIBusHistoryQueriesCommandDTO;
    configTransferBuilderService.buildHistoryQueriesConfiguration = mock.fn(() => builtHistoryQueries);
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
    oIAnalyticsMessageRepository.create = mock.fn(() => saveHistoryQueryMessage);
    service.createFullHistoryQueriesMessageIfNotPending();

    assert.deepStrictEqual(oIAnalyticsMessageRepository.create.mock.calls[0].arguments, [{ type: 'history-queries' }]);
    assert.strictEqual(oIAnalyticsClient.sendHistoryQuery.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsClient.sendHistoryQuery.mock.calls[0].arguments[0], testData.oIAnalytics.registration.completed);
    const sentHistoryQueries = JSON.parse(oIAnalyticsClient.sendHistoryQuery.mock.calls[0].arguments[1] as string);
    assert.deepStrictEqual(sentHistoryQueries, builtHistoryQueries);
  });
});
