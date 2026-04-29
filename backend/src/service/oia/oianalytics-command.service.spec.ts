import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';

import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, flushPromises, asLogger, seq } from '../../tests/utils/test-utils';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import OIAnalyticsCommandRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-command-repository.mock';
import OIAnalyticsRegistrationServiceMock from '../../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import OIAnalyticsMessageServiceMock from '../../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import OianalyticsClientMock from '../../tests/__mocks__/service/oia/oianalytics-client.mock';
import OibusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import ScanModeServiceMock from '../../tests/__mocks__/service/scan-mode-service.mock';
import IpFilterServiceMock from '../../tests/__mocks__/service/ip-filter-service.mock';
import CertificateServiceMock from '../../tests/__mocks__/service/certificate-service.mock';
import SouthServiceMock from '../../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../../tests/__mocks__/service/north-service.mock';
import HistoryQueryServiceMock from '../../tests/__mocks__/service/history-query-service.mock';
import TransformerServiceMock from '../../tests/__mocks__/service/transformer-service.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';

import { version } from '../../../package.json';
import { createPageFromArray } from '../../../shared/model/types';
import { NotFoundError } from '../../model/types';
import {
  OIBusCreateCertificateCommand,
  OIBusCreateHistoryQueryCommand,
  OIBusCreateIPFilterCommand,
  OIBusCreateNorthConnectorCommand,
  OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand,
  OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand,
  OIBusCreateScanModeCommand,
  OIBusCreateSouthConnectorCommand,
  OIBusDeleteCertificateCommand,
  OIBusDeleteHistoryQueryCommand,
  OIBusDeleteIPFilterCommand,
  OIBusDeleteNorthConnectorCommand,
  OIBusDeleteScanModeCommand,
  OIBusDeleteSouthConnectorCommand,
  OIBusGetHistoryCacheFileContentCommand,
  OIBusGetNorthCacheFileContentCommand,
  OIBusUpdateHistoryCacheContentCommand,
  OIBusUpdateNorthCacheContentCommand,
  OIBusSearchHistoryCacheContentCommand,
  OIBusSearchNorthCacheContentCommand,
  OIBusTestHistoryQueryNorthConnectionCommand,
  OIBusTestHistoryQuerySouthConnectionCommand,
  OIBusTestHistoryQuerySouthItemCommand,
  OIBusTestNorthConnectorCommand,
  OIBusTestSouthConnectorCommand,
  OIBusTestSouthConnectorItemCommand,
  OIBusUpdateCertificateCommand,
  OIBusUpdateEngineSettingsCommand,
  OIBusUpdateHistoryQueryCommand,
  OIBusUpdateHistoryQueryStatusCommand,
  OIBusUpdateIPFilterCommand,
  OIBusUpdateNorthConnectorCommand,
  OIBusUpdateRegistrationSettingsCommand,
  OIBusUpdateScanModeCommand,
  OIBusUpdateSouthConnectorCommand,
  OIBusUpdateVersionCommand
} from '../../model/oianalytics-command.model';
import { IPFilterCommandDTO } from '../../../shared/model/ip-filter.model';
import { CertificateCommandDTO } from '../../../shared/model/certificate.model';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { OIAnalyticsFetchSetpointCommandDTO } from './oianalytics.model';
import { CacheSearchResult, FileCacheContent, OIBusContent } from '../../../shared/model/engine.model';
import { EngineSettings } from '../../model/engine.model';

import type OIAnalyticsCommandServiceType from './oianalytics-command.service';
import type { toOIBusCommandDTO as toOIBusCommandDTOType } from './oianalytics-command.service';
import { toSouthConnectorItemDTO } from '../south.service';

const nodeRequire = createRequire(import.meta.url);

// --- mock instances ---
const logger = new PinoLogger();
const anotherLogger = new PinoLogger();
const oIAnalyticsCommandRepository = new OIAnalyticsCommandRepositoryMock();
const oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
const oIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const oIBusService = new OibusServiceMock();
const scanModeService = new ScanModeServiceMock();
const ipFilterService = new IpFilterServiceMock();
const certificateService = new CertificateServiceMock();
const southService = new SouthServiceMock();
const northService = new NorthServiceMock();
const historyQueryService = new HistoryQueryServiceMock();
const transformerService = new TransformerServiceMock();
const oIAnalyticsClient = new OianalyticsClientMock();
const encryptionService = new EncryptionServiceMock('', '');

// --- mocked utility modules (mutated in-place between tests) ---
const mockUtils = {
  delay: mock.fn(async () => undefined),
  getOIBusInfo: mock.fn(() => testData.engine.oIBusInfo),
  unzip: mock.fn()
};

let OIAnalyticsCommandService: typeof OIAnalyticsCommandServiceType;
let toOIBusCommandDTO: typeof toOIBusCommandDTOType;

before(() => {
  // third-party modules that get pulled transitively (must exist in cache before reload)
  mockModule(nodeRequire, 'undici', {
    __esModule: true,
    request: mock.fn(),
    ProxyAgent: function (options: unknown) {
      return { options, isMockProxyAgent: true };
    },
    Agent: function (options: unknown) {
      return { options, isMockAgent: true };
    }
  });

  mockModule(nodeRequire, 'node-opcua', {
    OPCUAClient: { createSession: mock.fn(async () => ({})) },
    ClientSubscription: { create: mock.fn() },
    ClientMonitoredItem: { create: mock.fn() },
    DataType: {},
    StatusCodes: {},
    SecurityPolicy: {},
    AttributeIds: {},
    UserTokenType: {},
    TimestampsToReturn: {},
    AggregateFunction: {},
    HistoryReadRequest: {},
    ReadRawModifiedDetails: {},
    ReadProcessedDetails: {},
    OPCUACertificateManager: function () {
      return {};
    },
    resolveNodeId: mock.fn((nodeId: unknown) => nodeId)
  });

  mockModule(nodeRequire, 'ssh2-sftp-client', {
    __esModule: true,
    default: function () {
      return {
        connect: mock.fn(),
        list: mock.fn(),
        put: mock.fn(),
        delete: mock.fn(),
        end: mock.fn(),
        exists: mock.fn(),
        fastGet: mock.fn()
      };
    }
  });

  mockModule(nodeRequire, '../utils', mockUtils);
  mockModule(nodeRequire, '../../web-server/controllers/validators/joi.validator', {
    default: class {
      validateSettings = mock.fn(async () => undefined);
      validate = mock.fn(async () => undefined);
    }
  });
  mockModule(nodeRequire, '../encryption.service', { encryptionService });

  const mod = reloadModule<{
    default: typeof OIAnalyticsCommandServiceType;
    toOIBusCommandDTO: typeof toOIBusCommandDTOType;
  }>(nodeRequire, './oianalytics-command.service');

  OIAnalyticsCommandService = mod.default;
  toOIBusCommandDTO = mod.toOIBusCommandDTO;
});

// Helper to reset ALL mock functions across all mock instances
function resetAllMocks() {
  // logger
  for (const fn of Object.values(logger)) {
    if (fn && typeof (fn as { mock?: unknown }).mock === 'object') {
      (fn as { mock: { resetCalls(): void } }).mock.resetCalls();
    }
  }
  for (const fn of Object.values(anotherLogger)) {
    if (fn && typeof (fn as { mock?: unknown }).mock === 'object') {
      (fn as { mock: { resetCalls(): void } }).mock.resetCalls();
    }
  }
  // repositories & services
  const mocks = [
    oIAnalyticsCommandRepository,
    oIAnalyticsRegistrationService,
    oIAnalyticsMessageService,
    oIBusService,
    scanModeService,
    ipFilterService,
    certificateService,
    southService,
    northService,
    historyQueryService,
    transformerService,
    oIAnalyticsClient,
    encryptionService
  ];
  for (const m of mocks) {
    for (const val of Object.values(m as Record<string, unknown>)) {
      if (val && typeof (val as { mock?: unknown }).mock === 'object') {
        (val as { mock: { resetCalls(): void } }).mock.resetCalls();
      }
    }
  }
  // utils
  for (const val of Object.values(mockUtils)) {
    val.mock.resetCalls();
  }
}

function makeService(ignoreRemoteUpdate = false, launcherVersion = testData.engine.settings.launcherVersion) {
  return new OIAnalyticsCommandService(
    oIAnalyticsCommandRepository,
    oIAnalyticsRegistrationService,
    oIAnalyticsMessageService,
    oIAnalyticsClient,
    oIBusService,
    scanModeService,
    ipFilterService,
    certificateService,
    southService,
    northService,
    historyQueryService,
    transformerService,
    asLogger(logger),
    'binaryFolder',
    ignoreRemoteUpdate,
    launcherVersion
  );
}

describe('OIAnalytics Command Service', () => {
  let service: InstanceType<typeof OIAnalyticsCommandServiceType>;

  beforeEach(() => {
    resetAllMocks();
    mock.method(Date, 'now', () => new Date(testData.constants.dates.FAKE_NOW).getTime());

    oIBusService.getEngineSettings.mock.mockImplementation(() => testData.engine.settings);
    oIAnalyticsCommandRepository.list.mock.mockImplementation(() => testData.oIAnalytics.commands.oIBusList);
    oIAnalyticsCommandRepository.findById.mock.mockImplementation(() => testData.oIAnalytics.commands.oIBusList[0]);
    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);
    mockUtils.getOIBusInfo.mock.mockImplementation(() => testData.engine.oIBusInfo);

    service = makeService();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should get an OIAnalytics command', () => {
    const result = service.findById(testData.oIAnalytics.commands.oIBusList[0].id);

    assert.strictEqual(oIAnalyticsCommandRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.findById.mock.calls[0].arguments, [testData.oIAnalytics.commands.oIBusList[0].id]);
    assert.deepStrictEqual(result, testData.oIAnalytics.commands.oIBusList[0]);
  });

  it('should throw an error when OIAnalytics command does not exist', () => {
    oIAnalyticsCommandRepository.findById.mock.mockImplementation(() => null);

    assert.throws(
      () => service.findById(testData.oIAnalytics.commands.oIBusList[0].id),
      new NotFoundError(`OIAnalytics command "${testData.oIAnalytics.commands.oIBusList[0].id}" not found`)
    );
    assert.deepStrictEqual(oIAnalyticsCommandRepository.findById.mock.calls[0].arguments, [testData.oIAnalytics.commands.oIBusList[0].id]);
  });

  it('should properly start and stop service', async () => {
    assert.strictEqual(oIBusService.getEngineSettings.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.updateOIBusVersion.mock.calls[0].arguments, [
      (testData.oIAnalytics.commands.oIBusList[0] as OIBusUpdateVersionCommand).commandContent.version.slice(1),
      testData.engine.settings.launcherVersion
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[0].arguments, [
      testData.oIAnalytics.commands.oIBusList[0].id,
      testData.constants.dates.FAKE_NOW,
      `OIBus updated to version ${(testData.oIAnalytics.commands.oIBusList[0] as OIBusUpdateVersionCommand).commandContent.version.slice(1)}, launcher updated to version ${testData.engine.settings.launcherVersion}`
    ]);

    // Prevent background executeCommand (triggered by commandEvent.emit('next') in start()) from
    // running real logic. Return [] so it sees no commands and exits immediately.
    oIAnalyticsCommandRepository.list.mock.mockImplementation(() => []);
    mock.method(process, 'exit', () => undefined as never);
    mock.method(process, 'kill', () => undefined as unknown as void);

    await service.start();
    await service.stop();
    await flushPromises();

    // After start: one setTimeout scheduled; after stop: clearTimeout called
    // registrationEvent: REGISTERED -> schedules another timeout
    oIAnalyticsRegistrationService.registrationEvent.emit('updated');

    // registrationEvent with PENDING status -> no new setTimeout
    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementationOnce(() => testData.oIAnalytics.registration.pending);
    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
  });

  it('should search commands', () => {
    const page = createPageFromArray(testData.oIAnalytics.commands.oIBusList, 1, 25);
    oIAnalyticsCommandRepository.search.mock.mockImplementation(() => page);

    const result = service.search({ types: [], status: [], page: 0, ack: undefined, start: undefined, end: undefined });
    assert.deepStrictEqual(result, page);
  });

  it('should delete command', () => {
    service.delete(testData.oIAnalytics.commands.oIBusList[0].id);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.delete.mock.calls[0].arguments, [testData.oIAnalytics.commands.oIBusList[0].id]);
  });

  it('should check commands', async () => {
    // Use fake timers so that setTimeout calls in checkCommands are captured and never fire,
    // preventing async activity after the test ends.
    mock.timers.enable({ apis: ['setTimeout'] });

    service.sendAckCommands = mock.fn(async () => undefined);
    service.checkRetrievedCommands = mock.fn(async () => undefined);
    service.retrieveCommands = mock.fn(async () => undefined);

    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementation(
      seq(
        () => testData.oIAnalytics.registration.completed,
        () => testData.oIAnalytics.registration.completed,
        () => testData.oIAnalytics.registration.pending
      )
    );

    service.checkCommands();
    await service.checkCommands();
    assert.ok(
      (logger.trace.mock.calls as Array<{ arguments: Array<string> }>).some(
        c => c.arguments[0] === 'OIBus is already retrieving commands from OIAnalytics'
      )
    );
    await service.checkCommands();
    assert.ok(
      (logger.trace.mock.calls as Array<{ arguments: Array<string> }>).some(
        c => c.arguments[0] === "OIAnalytics not registered. OIBus won't retrieve commands"
      )
    );

    await flushPromises();
    // Reset fake timers — discards all pending setTimeout callbacks without firing them
    mock.timers.reset();
  });

  it('should fail to check commands and retry', async () => {
    service.retrieveCommands = mock.fn(async () => {
      throw new Error('retrieve command error');
    });
    service.checkRetrievedCommands = mock.fn(async () => undefined);
    service.sendAckCommands = mock.fn(async () => undefined);

    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementationOnce(() => testData.oIAnalytics.registration.completed);

    await service.checkCommands();
    assert.strictEqual((service.sendAckCommands as ReturnType<typeof mock.fn>).mock.calls.length, 0);
    assert.ok((logger.error.mock.calls as Array<{ arguments: Array<string> }>).some(c => c.arguments[0] === 'retrieve command error'));
    // Cancel the retry timer to prevent async activity after test ends
    await service.stop();
  });

  it('should send ack', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => testData.oIAnalytics.commands.oIBusList);
    await service.sendAckCommands(testData.oIAnalytics.registration.completed);

    assert.strictEqual(oIAnalyticsClient.updateCommandStatus.mock.calls.length, testData.oIAnalytics.commands.oIBusList.length);
    assert.strictEqual(oIAnalyticsCommandRepository.markAsAcknowledged.mock.calls.length, testData.oIAnalytics.commands.oIBusList.length);
    assert.ok(
      (logger.trace.mock.calls as Array<{ arguments: Array<string> }>).some(
        c =>
          c.arguments[0] ===
          `Command ${testData.oIAnalytics.commands.oIBusList[0].id} of type ${testData.oIAnalytics.commands.oIBusList[0].type} acknowledged`
      )
    );
  });

  it('should not send ack if no command to ack', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => []);
    await service.sendAckCommands(testData.oIAnalytics.registration.completed);

    assert.ok((logger.trace.mock.calls as Array<{ arguments: Array<string> }>).some(c => c.arguments[0] === 'No command to ack'));
  });

  it('should properly manage ack error', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [
      testData.oIAnalytics.commands.oIBusList[0],
      testData.oIAnalytics.commands.oIBusList[1]
    ]);
    oIAnalyticsClient.updateCommandStatus.mock.mockImplementation(
      seq(
        () => {
          throw new Error('error');
        },
        () => {
          throw new Error('404 - not found');
        }
      )
    );

    await service.sendAckCommands(testData.oIAnalytics.registration.completed);

    assert.ok(
      (logger.error.mock.calls as Array<{ arguments: Array<string> }>).some(
        c =>
          c.arguments[0] ===
          `Error while acknowledging command ${testData.oIAnalytics.commands.oIBusList[0].id} of type ${testData.oIAnalytics.commands.oIBusList[0].type}: error`
      )
    );
    assert.strictEqual(logger.error.mock.calls.length, 2);
    assert.strictEqual(oIAnalyticsCommandRepository.markAsAcknowledged.mock.calls.length, 1);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsAcknowledged.mock.calls[0].arguments, [
      testData.oIAnalytics.commands.oIBusList[1].id
    ]);
  });

  it('should check retrieved command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => testData.oIAnalytics.commands.oIBusList);
    oIAnalyticsClient.retrieveCancelledCommands.mock.mockImplementationOnce(async () => testData.oIAnalytics.commands.oIBusList);

    await service.checkRetrievedCommands(testData.oIAnalytics.registration.completed);

    assert.strictEqual(oIAnalyticsClient.retrieveCancelledCommands.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsCommandRepository.cancel.mock.calls.length, testData.oIAnalytics.commands.oIBusList.length);
    assert.ok(
      (logger.trace.mock.calls as Array<{ arguments: Array<string> }>).some(
        c =>
          c.arguments[0] ===
          `${testData.oIAnalytics.commands.oIBusList.length} commands cancelled among the ${testData.oIAnalytics.commands.oIBusList.length} pending commands`
      )
    );

    // error case
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => testData.oIAnalytics.commands.oIBusList);
    oIAnalyticsClient.retrieveCancelledCommands.mock.mockImplementationOnce(async () => {
      throw new Error('error');
    });
    await assert.rejects(
      () => service.checkRetrievedCommands(testData.oIAnalytics.registration.completed),
      new Error('Error while checking PENDING commands status: error')
    );

    // empty case
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => []);
    await service.checkRetrievedCommands(testData.oIAnalytics.registration.completed);
    assert.ok(
      (logger.trace.mock.calls as Array<{ arguments: Array<string> }>).some(c => c.arguments[0] === 'No command retrieved to check')
    );
  });

  it('should check retrieved command and cancel nothing', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => testData.oIAnalytics.commands.oIBusList);
    oIAnalyticsClient.retrieveCancelledCommands.mock.mockImplementationOnce(async () => []);

    await service.checkRetrievedCommands(testData.oIAnalytics.registration.completed);

    assert.strictEqual(oIAnalyticsClient.retrieveCancelledCommands.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsCommandRepository.cancel.mock.calls.length, 0);
    assert.strictEqual(logger.trace.mock.calls.length, 0);
  });

  it('should retrieve commands', async () => {
    oIAnalyticsClient.retrievePendingCommands.mock.mockImplementationOnce(async () => testData.oIAnalytics.commands.oIAnalyticsList);

    await service.retrieveCommands(testData.oIAnalytics.registration.completed);

    assert.strictEqual(oIAnalyticsClient.retrievePendingCommands.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsCommandRepository.create.mock.calls.length, testData.oIAnalytics.commands.oIAnalyticsList.length);
    assert.ok(
      (logger.trace.mock.calls as Array<{ arguments: Array<string> }>).some(
        c => c.arguments[0] === `${testData.oIAnalytics.commands.oIAnalyticsList.length} commands to add`
      )
    );

    oIAnalyticsClient.retrievePendingCommands.mock.mockImplementationOnce(async () => {
      throw new Error('error');
    });
    await assert.rejects(
      () => service.retrieveCommands(testData.oIAnalytics.registration.completed),
      new Error('Error while retrieving commands: error')
    );
  });

  it('should retrieve commands and do nothing', async () => {
    oIAnalyticsClient.retrievePendingCommands.mock.mockImplementationOnce(async () => []);

    await service.retrieveCommands(testData.oIAnalytics.registration.completed);

    assert.strictEqual(oIAnalyticsClient.retrievePendingCommands.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsCommandRepository.create.mock.calls.length, 0);
    assert.strictEqual(logger.trace.mock.calls.length, 0);
  });

  it('should execute update-version command without updating launcher', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[0]]);
    const exitMock = mock.method(process, 'exit', () => undefined as never);
    mock.method(fs, 'unlink', async () => undefined);
    mock.method(fs, 'writeFile', async () => undefined);

    await service.executeCommand();

    assert.strictEqual(oIAnalyticsRegistrationService.getRegistrationSettings.mock.calls.length, 1);
    assert.ok(oIAnalyticsCommandRepository.list.mock.calls.length > 0);
    assert.strictEqual(oIAnalyticsCommandRepository.markAsRunning.mock.calls.length, 1);
    assert.ok(oIBusService.getEngineSettings.mock.calls.length > 0);
    assert.strictEqual(oIAnalyticsClient.downloadFile.mock.calls.length, 1);
    assert.strictEqual(mockUtils.unzip.mock.calls.length, 1);
    assert.strictEqual(mockUtils.delay.mock.calls.length, 1);
    assert.strictEqual(exitMock.mock.calls.length, 1);
  });

  it('should execute update-version command with launcher update', async () => {
    const launcherCommand = {
      ...testData.oIAnalytics.commands.oIBusList[0],
      commandContent: {
        version: 'v3.5.0-beta',
        assetId: 'assetId',
        backupFolders: 'cache/*',
        updateLauncher: true
      }
    };
    oIAnalyticsCommandRepository.list.mock.mockImplementation(
      seq(
        () => [launcherCommand], // first executeCommand's commandsToExecute
        () => [], // sendAckCommands after first executeCommand
        () => [launcherCommand], // second executeCommand's commandsToExecute
        () => [] // sendAckCommands after second executeCommand
      )
    );
    const killMock = mock.method(process, 'kill', () => true as unknown as void);
    const osTypeMock = mock.method(
      os,
      'type',
      seq(
        () => 'linux' as NodeJS.Platform,
        () => 'Windows_NT' as NodeJS.Platform
      )
    );
    const fsFsMock = mock.method(fs, 'rename', async () => undefined);
    mock.method(fs, 'unlink', async () => undefined);
    mock.method(fs, 'writeFile', async () => undefined);
    mock.method(process, 'exit', () => undefined as never);

    await service.executeCommand();

    assert.strictEqual(oIAnalyticsClient.downloadFile.mock.calls.length, 1);
    assert.strictEqual(mockUtils.unzip.mock.calls.length, 1);
    assert.strictEqual(fsFsMock.mock.calls.length, 2);
    assert.ok(
      (fsFsMock.mock.calls as Array<{ arguments: [string, string] }>).some(
        c => c.arguments[0].includes('oibus-launcher') && c.arguments[1].includes('oibus-launcher_backup')
      )
    );
    assert.strictEqual(osTypeMock.mock.calls.length, 1);
    assert.strictEqual(killMock.mock.calls.length, 1);

    await service.executeCommand();
    assert.ok(
      (fsFsMock.mock.calls as Array<{ arguments: [string, string] }>).some(
        c => c.arguments[0].includes('oibus-launcher.exe') && c.arguments[1].includes('oibus-launcher_backup.exe')
      )
    );
  });

  it('should not execute update-version command if a command is already being executed', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[0]]);
    mock.method(process, 'exit', () => undefined as never);
    mockUtils.delay.mock.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          setTimeout(resolve, 1000);
        })
    );

    service.executeCommand();
    await service.executeCommand();

    assert.ok(
      (logger.trace.mock.calls as Array<{ arguments: Array<string> }>).some(c => c.arguments[0] === 'A command is already being executed')
    );

    await flushPromises();
  });

  it('should not execute a command if not registered', async () => {
    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementationOnce(() => ({
      ...JSON.parse(JSON.stringify(testData.oIAnalytics.registration.completed)),
      status: 'PENDING'
    }));

    await service.executeCommand();

    assert.ok(
      (logger.trace.mock.calls as Array<{ arguments: Array<string> }>).some(
        c => c.arguments[0] === "OIAnalytics not registered. OIBus won't retrieve commands"
      )
    );
  });

  it('should not execute a command if no command found', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => []);

    await service.executeCommand();

    assert.ok((logger.trace.mock.calls as Array<{ arguments: Array<string> }>).some(c => c.arguments[0] === 'No command to execute'));
  });

  it('should execute update-engine-settings command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[1]]);

    await service.executeCommand();

    assert.strictEqual(encryptionService.decryptTextWithPrivateKey.mock.calls.length, 0);
    assert.deepStrictEqual(oIBusService.updateEngineSettings.mock.calls[0].arguments, [
      (testData.oIAnalytics.commands.oIBusList[1] as OIBusUpdateEngineSettingsCommand).commandContent,
      'oianalytics'
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[1].id,
      testData.constants.dates.FAKE_NOW,
      'Engine settings updated successfully'
    ]);
  });

  it('should execute update-engine-settings command without loki password', async () => {
    const command: OIBusUpdateEngineSettingsCommand = JSON.parse(JSON.stringify(testData.oIAnalytics.commands.oIBusList[1]));
    command.commandContent.logParameters.loki.password = 'test';

    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(oIBusService.updateEngineSettings.mock.calls[0].arguments, [
      (command as OIBusUpdateEngineSettingsCommand).commandContent,
      'oianalytics'
    ]);
    assert.strictEqual(encryptionService.decryptTextWithPrivateKey.mock.calls.length, 1);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[1].id,
      testData.constants.dates.FAKE_NOW,
      'Engine settings updated successfully'
    ]);
  });

  it('should execute update-registration-settings command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[15]]);

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsRegistrationService.editRegistrationSettings.mock.calls[0].arguments, [
      {
        host: testData.oIAnalytics.registration.completed.host,
        useProxy: testData.oIAnalytics.registration.completed.useProxy,
        proxyUrl: testData.oIAnalytics.registration.completed.proxyUrl,
        proxyUsername: testData.oIAnalytics.registration.completed.proxyUsername,
        proxyPassword: '',
        useApiGateway: testData.oIAnalytics.registration.completed.useApiGateway,
        apiGatewayHeaderKey: testData.oIAnalytics.registration.completed.apiGatewayHeaderKey,
        apiGatewayHeaderValue: '',
        apiGatewayBaseEndpoint: testData.oIAnalytics.registration.completed.apiGatewayBaseEndpoint,
        acceptUnauthorized: testData.oIAnalytics.registration.completed.acceptUnauthorized,
        commandRefreshInterval: (testData.oIAnalytics.commands.oIBusList[15] as OIBusUpdateRegistrationSettingsCommand).commandContent
          .commandRefreshInterval,
        commandRetryInterval: (testData.oIAnalytics.commands.oIBusList[15] as OIBusUpdateRegistrationSettingsCommand).commandContent
          .commandRetryInterval,
        messageRetryInterval: (testData.oIAnalytics.commands.oIBusList[15] as OIBusUpdateRegistrationSettingsCommand).commandContent
          .messageRetryInterval,
        commandPermissions: testData.oIAnalytics.registration.completed.commandPermissions
      },
      'oianalytics'
    ]);
    assert.strictEqual(oIAnalyticsRegistrationService.editRegistrationSettings.mock.calls.length, 1);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[15].id,
      testData.constants.dates.FAKE_NOW,
      'Registration settings updated successfully'
    ]);
  });

  it('should execute update-registration-settings command and not enabling permissions if disabled', async () => {
    const registration: OIAnalyticsRegistration = {
      ...testData.oIAnalytics.registration.completed,
      commandPermissions: {
        updateVersion: false,
        restartEngine: false,
        regenerateCipherKeys: false,
        updateEngineSettings: false,
        updateRegistrationSettings: false,
        createScanMode: false,
        updateScanMode: false,
        deleteScanMode: false,
        createIpFilter: false,
        updateIpFilter: false,
        deleteIpFilter: false,
        createCertificate: false,
        updateCertificate: false,
        deleteCertificate: false,
        createHistoryQuery: false,
        updateHistoryQuery: false,
        deleteHistoryQuery: false,
        createOrUpdateHistoryItemsFromCsv: false,
        testHistoryNorthConnection: false,
        testHistorySouthConnection: false,
        testHistorySouthItem: false,
        createSouth: false,
        updateSouth: false,
        deleteSouth: false,
        createOrUpdateSouthItemsFromCsv: false,
        testSouthConnection: false,
        testSouthItem: false,
        createNorth: false,
        updateNorth: false,
        deleteNorth: false,
        testNorthConnection: false,
        setpoint: false,
        searchHistoryCacheContent: false,
        getHistoryCacheFileContent: false,
        updateHistoryCacheContent: false,
        searchNorthCacheContent: false,
        getNorthCacheFileContent: false,
        updateNorthCacheContent: false,
        createCustomTransformer: false,
        updateCustomTransformer: false,
        deleteCustomTransformer: false,
        testCustomTransformer: false
      }
    };

    // Call private method directly
    await (
      service as unknown as {
        executeUpdateRegistrationSettingsCommand(cmd: OIBusUpdateRegistrationSettingsCommand, reg: OIAnalyticsRegistration): Promise<void>;
      }
    ).executeUpdateRegistrationSettingsCommand(
      testData.oIAnalytics.commands.oIBusList[15] as OIBusUpdateRegistrationSettingsCommand,
      registration
    );

    assert.deepStrictEqual(oIAnalyticsRegistrationService.editRegistrationSettings.mock.calls[0].arguments, [
      {
        host: registration.host,
        useProxy: registration.useProxy,
        proxyUrl: registration.proxyUrl,
        proxyUsername: registration.proxyUsername,
        proxyPassword: '',
        useApiGateway: registration.useApiGateway,
        apiGatewayHeaderKey: registration.apiGatewayHeaderKey,
        apiGatewayHeaderValue: '',
        apiGatewayBaseEndpoint: registration.apiGatewayBaseEndpoint,
        acceptUnauthorized: registration.acceptUnauthorized,
        commandRefreshInterval: (testData.oIAnalytics.commands.oIBusList[15] as OIBusUpdateRegistrationSettingsCommand).commandContent
          .commandRefreshInterval,
        commandRetryInterval: (testData.oIAnalytics.commands.oIBusList[15] as OIBusUpdateRegistrationSettingsCommand).commandContent
          .commandRetryInterval,
        messageRetryInterval: (testData.oIAnalytics.commands.oIBusList[15] as OIBusUpdateRegistrationSettingsCommand).commandContent
          .messageRetryInterval,
        commandPermissions: registration.commandPermissions
      },
      'oianalytics'
    ]);
    assert.strictEqual(oIAnalyticsRegistrationService.editRegistrationSettings.mock.calls.length, 1);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[15].id,
      testData.constants.dates.FAKE_NOW,
      'Registration settings updated successfully'
    ]);
  });

  it('should execute restart-engine command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[2]]);
    const exitMock = mock.method(process, 'exit', () => undefined as never);

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[2].id,
      testData.constants.dates.FAKE_NOW,
      'OIBus restarted'
    ]);
    assert.strictEqual(mockUtils.delay.mock.calls.length, 1);
    assert.strictEqual(exitMock.mock.calls.length, 1);
  });

  it('should execute update-scan-mode command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[3]]);

    await service.executeCommand();

    assert.deepStrictEqual(scanModeService.update.mock.calls[0].arguments, [
      (testData.oIAnalytics.commands.oIBusList[3] as OIBusUpdateScanModeCommand).scanModeId,
      (testData.oIAnalytics.commands.oIBusList[3] as OIBusUpdateScanModeCommand).commandContent,
      'oianalytics'
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[3].id,
      testData.constants.dates.FAKE_NOW,
      'Scan mode updated successfully'
    ]);
  });

  it('should execute update-south command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[4]]);
    southService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.south.manifest,
        id: (testData.oIAnalytics.commands.oIBusList[4] as OIBusUpdateSouthConnectorCommand).commandContent.type
      }
    ]);

    await service.executeCommand();

    assert.deepStrictEqual(southService.update.mock.calls[0].arguments, [
      (testData.oIAnalytics.commands.oIBusList[4] as OIBusUpdateSouthConnectorCommand).southConnectorId,
      (testData.oIAnalytics.commands.oIBusList[4] as OIBusUpdateSouthConnectorCommand).commandContent,
      'oianalytics'
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[4].id,
      testData.constants.dates.FAKE_NOW,
      'South connector updated successfully'
    ]);
  });

  it('should execute update-north command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[5]]);
    northService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.south.manifest,
        id: (testData.oIAnalytics.commands.oIBusList[5] as OIBusUpdateNorthConnectorCommand).commandContent.type
      }
    ]);

    await service.executeCommand();

    assert.deepStrictEqual(northService.update.mock.calls[0].arguments, [
      (testData.oIAnalytics.commands.oIBusList[5] as OIBusUpdateNorthConnectorCommand).northConnectorId,
      (testData.oIAnalytics.commands.oIBusList[5] as OIBusUpdateNorthConnectorCommand).commandContent,
      'oianalytics'
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[5].id,
      testData.constants.dates.FAKE_NOW,
      'North connector updated successfully'
    ]);
  });

  it('should execute delete-scan-mode command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[6]]);

    await service.executeCommand();

    assert.deepStrictEqual(scanModeService.delete.mock.calls[0].arguments, [
      (testData.oIAnalytics.commands.oIBusList[6] as OIBusDeleteScanModeCommand).scanModeId
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[6].id,
      testData.constants.dates.FAKE_NOW,
      'Scan mode deleted successfully'
    ]);
  });

  it('should execute delete-south command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[7]]);

    await service.executeCommand();

    assert.deepStrictEqual(southService.delete.mock.calls[0].arguments, [
      (testData.oIAnalytics.commands.oIBusList[7] as OIBusDeleteSouthConnectorCommand).southConnectorId
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[7].id,
      testData.constants.dates.FAKE_NOW,
      'South connector deleted successfully'
    ]);
  });

  it('should execute delete-north command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[8]]);

    await service.executeCommand();

    assert.deepStrictEqual(northService.delete.mock.calls[0].arguments, [
      (testData.oIAnalytics.commands.oIBusList[8] as OIBusDeleteNorthConnectorCommand).northConnectorId
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[8].id,
      testData.constants.dates.FAKE_NOW,
      'North connector deleted successfully'
    ]);
  });

  it('should execute create-scan-mode command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[9]]);

    await service.executeCommand();

    assert.deepStrictEqual(scanModeService.create.mock.calls[0].arguments, [
      (testData.oIAnalytics.commands.oIBusList[9] as OIBusCreateScanModeCommand).commandContent,
      'oianalytics'
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[9].id,
      testData.constants.dates.FAKE_NOW,
      'Scan mode created successfully'
    ]);
  });

  it('should execute create-south command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[10]]);
    southService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.south.manifest,
        id: (testData.oIAnalytics.commands.oIBusList[10] as OIBusCreateSouthConnectorCommand).commandContent.type
      }
    ]);

    await service.executeCommand();

    assert.deepStrictEqual(southService.create.mock.calls[0].arguments, [
      (testData.oIAnalytics.commands.oIBusList[10] as OIBusCreateSouthConnectorCommand).commandContent,
      null,
      'oianalytics'
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[10].id,
      testData.constants.dates.FAKE_NOW,
      'South connector created successfully'
    ]);
  });

  it('should execute create-north command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[11]]);
    northService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.south.manifest,
        id: (testData.oIAnalytics.commands.oIBusList[11] as OIBusCreateNorthConnectorCommand).commandContent.type
      }
    ]);

    await service.executeCommand();

    assert.deepStrictEqual(northService.create.mock.calls[0].arguments, [
      (testData.oIAnalytics.commands.oIBusList[11] as OIBusCreateNorthConnectorCommand).commandContent,
      null,
      'oianalytics'
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[11].id,
      testData.constants.dates.FAKE_NOW,
      'North connector created successfully'
    ]);
  });

  it('should execute create-or-update-south-items-from-csv command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[14]]);
    southService.findById.mock.mockImplementationOnce(() => testData.south.list[0]);
    southService.checkImportItems.mock.mockImplementationOnce(async () => ({
      items: [{ scanMode: testData.scanMode.list[0] }, { scanMode: testData.scanMode.list[0] }],
      errors: []
    }));

    await service.executeCommand();

    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments, [
      (testData.oIAnalytics.commands.oIBusList[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand).southConnectorId
    ]);
    assert.deepStrictEqual(southService.checkImportItems.mock.calls[0].arguments, [
      testData.south.list[0].type,
      (testData.oIAnalytics.commands.oIBusList[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand).commandContent.csvContent,
      (testData.oIAnalytics.commands.oIBusList[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand).commandContent.delimiter,
      testData.south.list[0].items.map(item =>
        toSouthConnectorItemDTO(item, testData.south.list[0].type, (id: string) => ({ id, friendlyName: id }))
      )
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[14].id,
      testData.constants.dates.FAKE_NOW,
      `2 items imported on South connector ${testData.south.list[0].name}`
    ]);
  });

  it('should execute create-or-update-south-items-from-csv command and throw an error if south not found', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[14]]);
    southService.findById.mock.mockImplementationOnce(() => null);

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [
      testData.oIAnalytics.commands.oIBusList[14].id,
      `South connector ${(testData.oIAnalytics.commands.oIBusList[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand).southConnectorId} not found`
    ]);
  });

  it('should execute create-or-update-south-items-from-csv command with item errors', async () => {
    const command: OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand = JSON.parse(
      JSON.stringify(testData.oIAnalytics.commands.oIBusList[14])
    );
    command.commandContent.deleteItemsNotPresent = true;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    southService.findById.mock.mockImplementationOnce(() => testData.south.list[0]);
    southService.checkImportItems.mock.mockImplementationOnce(async () => ({
      items: [{}, {}],
      errors: [
        { item: { name: 'item1' }, error: 'error1' },
        { item: { name: 'item2' }, error: 'error2' }
      ]
    }));

    await service.executeCommand();

    assert.deepStrictEqual(southService.checkImportItems.mock.calls[0].arguments, [
      testData.south.list[0].type,
      (testData.oIAnalytics.commands.oIBusList[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand).commandContent.csvContent,
      (testData.oIAnalytics.commands.oIBusList[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand).commandContent.delimiter,
      []
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [
      testData.oIAnalytics.commands.oIBusList[14].id,
      `Error when checking csv items:\nitem1: error1\nitem2: error2`
    ]);
  });

  it('should catch error when execution fails', async () => {
    const command = testData.oIAnalytics.commands.oIBusList[11];
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    northService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.south.manifest,
        id: (testData.oIAnalytics.commands.oIBusList[11] as OIBusCreateNorthConnectorCommand).commandContent.type
      }
    ]);
    northService.create.mock.mockImplementationOnce(async () => {
      throw new Error('command execution error');
    });

    await service.executeCommand();

    assert.ok(
      (logger.error.mock.calls as Array<{ arguments: Array<string> }>).some(
        c =>
          c.arguments[0] ===
          `Error while executing command ${command.id} (retrieved ${command.retrievedDate}) of type ${command.type}. Error: command execution error`
      )
    );
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [command.id, 'command execution error']);
  });

  it('should not execute command if target version is not the same', async () => {
    const command = testData.oIAnalytics.commands.oIBusList[11];
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIBusService.getEngineSettings.mock.mockImplementationOnce(() => ({
      ...testData.engine.settings,
      version: 'bad version'
    }));

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [
      command.id,
      `Wrong target version: ${command.targetVersion} for OIBus version bad version`
    ]);
  });

  it('should not execute command if permission is not right', async () => {
    const command = testData.oIAnalytics.commands.oIBusList[11];
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementationOnce(() => ({
      ...testData.oIAnalytics.registration.completed,
      commandPermissions: {
        ...testData.oIAnalytics.registration.completed.commandPermissions,
        createNorth: false
      }
    }));

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [
      command.id,
      `Command ${command.id} of type ${command.type} is not authorized`
    ]);
  });

  it('should execute regenerate-cipher-keys command', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [testData.oIAnalytics.commands.oIBusList[12]]);
    mock.method(crypto, 'generateKeyPairSync', () => ({ publicKey: 'public key', privateKey: 'private key' }));

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsRegistrationService.updateKeys.mock.calls[0].arguments, ['private key', 'public key']);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      testData.oIAnalytics.commands.oIBusList[12].id,
      testData.constants.dates.FAKE_NOW,
      'OIAnalytics keys reloaded'
    ]);
  });

  it('should execute create-ip-filter command', async () => {
    const command: OIBusCreateIPFilterCommand = {
      id: 'createIpFilterId',
      type: 'create-ip-filter',
      targetVersion: testData.engine.settings.version,
      commandContent: {} as IPFilterCommandDTO
    } as OIBusCreateIPFilterCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(ipFilterService.create.mock.calls[0].arguments, [command.commandContent, 'oianalytics']);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'IP Filter created successfully'
    ]);
  });

  it('should execute update-ip-filter command', async () => {
    const command: OIBusUpdateIPFilterCommand = {
      id: 'updateIpFilterId',
      type: 'update-ip-filter',
      targetVersion: testData.engine.settings.version,
      ipFilterId: 'ipFilterId',
      commandContent: {} as IPFilterCommandDTO
    } as OIBusUpdateIPFilterCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(ipFilterService.update.mock.calls[0].arguments, [command.ipFilterId, command.commandContent, 'oianalytics']);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'IP Filter updated successfully'
    ]);
  });

  it('should execute delete-ip-filter command', async () => {
    const command: OIBusDeleteIPFilterCommand = {
      id: 'deleteIpFilterId',
      type: 'delete-ip-filter',
      targetVersion: testData.engine.settings.version,
      ipFilterId: 'ipFilterId'
    } as OIBusDeleteIPFilterCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(ipFilterService.delete.mock.calls[0].arguments, [command.ipFilterId]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'IP Filter deleted successfully'
    ]);
  });

  it('should execute create-certificate command', async () => {
    const command: OIBusCreateCertificateCommand = {
      id: 'createCertificateId',
      type: 'create-certificate',
      targetVersion: testData.engine.settings.version,
      commandContent: {} as CertificateCommandDTO
    } as OIBusCreateCertificateCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(certificateService.create.mock.calls[0].arguments, [command.commandContent, 'oianalytics']);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'Certificate created successfully'
    ]);
  });

  it('should execute update-certificate command', async () => {
    const command: OIBusUpdateCertificateCommand = {
      id: 'updateCertificateId',
      type: 'update-certificate',
      targetVersion: testData.engine.settings.version,
      certificateId: 'certificateId',
      commandContent: {} as CertificateCommandDTO
    } as OIBusUpdateCertificateCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(certificateService.update.mock.calls[0].arguments, [
      command.certificateId,
      command.commandContent,
      'oianalytics'
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'Certificate updated successfully'
    ]);
  });

  it('should execute delete-certificate command', async () => {
    const command: OIBusDeleteCertificateCommand = {
      id: 'deleteCertificateId',
      type: 'delete-certificate',
      targetVersion: testData.engine.settings.version,
      certificateId: 'certificateId'
    } as OIBusDeleteCertificateCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(certificateService.delete.mock.calls[0].arguments, [command.certificateId]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'Certificate deleted successfully'
    ]);
  });

  it('should execute south-connection-test command', async () => {
    const command: OIBusTestSouthConnectorCommand = {
      id: 'testSouthConnectorId',
      type: 'test-south-connection',
      targetVersion: testData.engine.settings.version,
      southConnectorId: 'southConnectorId',
      commandContent: testData.south.command
    } as OIBusTestSouthConnectorCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    southService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.south.manifest,
        id: command.commandContent.type
      }
    ]);

    await service.executeCommand();

    assert.deepStrictEqual(southService.testSouth.mock.calls[0].arguments, [
      command.southConnectorId,
      command.commandContent.type,
      command.commandContent.settings
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify({ items: [] })
    ]);
  });

  it('should execute south-item-test command', async () => {
    const command: OIBusTestSouthConnectorItemCommand = {
      id: 'testSouthItemId',
      type: 'test-south-item',
      targetVersion: testData.engine.settings.version,
      itemId: 'itemId',
      southConnectorId: 'southConnectorId',
      commandContent: {
        southCommand: testData.south.command,
        itemCommand: testData.south.itemCommand,
        testingSettings: {} as SouthConnectorItemTestingSettings
      }
    } as OIBusTestSouthConnectorItemCommand;

    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    southService.testItem.mock.mockImplementationOnce(async () => ({}));
    southService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.south.manifest,
        id: command.commandContent.southCommand.type
      }
    ]);
    const completeTestItemMock = mock.fn();
    (service as unknown as { completeTestItemCommand: typeof completeTestItemMock }).completeTestItemCommand = completeTestItemMock;

    await service.executeCommand();

    assert.deepStrictEqual(southService.testItem.mock.calls[0].arguments, [
      command.southConnectorId,
      command.commandContent.southCommand.type,
      command.commandContent.itemCommand.name,
      command.commandContent.southCommand.settings,
      command.commandContent.itemCommand.settings,
      command.commandContent.testingSettings
    ]);
    assert.deepStrictEqual(completeTestItemMock.mock.calls[0].arguments, [command, {}]);
  });

  it('should execute north-connection-test command', async () => {
    const command: OIBusTestNorthConnectorCommand = {
      id: 'testNorthConnectorId',
      type: 'test-north-connection',
      targetVersion: testData.engine.settings.version,
      northConnectorId: 'northConnectorId',
      commandContent: testData.north.command
    } as OIBusTestNorthConnectorCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    northService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.north.manifest,
        id: command.commandContent.type
      }
    ]);

    await service.executeCommand();

    assert.deepStrictEqual(northService.testNorth.mock.calls[0].arguments, [
      command.northConnectorId,
      command.commandContent.type,
      command.commandContent.settings
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify({ items: [] })
    ]);
  });

  it('should execute create-history-query command', async () => {
    const command: OIBusCreateHistoryQueryCommand = {
      id: 'createHistoryQueryId',
      type: 'create-history-query',
      targetVersion: testData.engine.settings.version,
      northConnectorId: undefined,
      southConnectorId: undefined,
      historyQueryId: undefined,
      commandContent: testData.historyQueries.command
    } as OIBusCreateHistoryQueryCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    southService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.south.manifest,
        id: testData.historyQueries.command.southType
      }
    ]);
    northService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.north.manifest,
        id: testData.historyQueries.command.northType
      }
    ]);

    await service.executeCommand();

    assert.deepStrictEqual(historyQueryService.create.mock.calls[0].arguments, [
      command.commandContent,
      undefined,
      undefined,
      undefined,
      'oianalytics'
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'History query created successfully'
    ]);
  });

  it('should execute update-history-query command', async () => {
    const command: OIBusUpdateHistoryQueryCommand = {
      id: 'updateHistoryQueryId',
      type: 'update-history-query',
      targetVersion: testData.engine.settings.version,
      historyQueryId: 'h1',
      commandContent: { resetCache: false, historyQuery: testData.historyQueries.command }
    } as OIBusUpdateHistoryQueryCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    southService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.south.manifest,
        id: testData.historyQueries.command.southType
      }
    ]);
    northService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.north.manifest,
        id: testData.historyQueries.command.northType
      }
    ]);

    await service.executeCommand();

    assert.deepStrictEqual(historyQueryService.update.mock.calls[0].arguments, [
      command.historyQueryId,
      command.commandContent.historyQuery,
      command.commandContent.resetCache,
      'oianalytics'
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'History query updated successfully'
    ]);
  });

  it('should execute delete-history-query command', async () => {
    const command: OIBusDeleteHistoryQueryCommand = {
      id: 'deleteHistoryQueryId',
      type: 'delete-history-query',
      targetVersion: testData.engine.settings.version,
      historyQueryId: 'h1'
    } as OIBusDeleteHistoryQueryCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(historyQueryService.delete.mock.calls[0].arguments, [command.historyQueryId]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'History query deleted successfully'
    ]);
  });

  it('should execute create-or-update-history-query-south-items-from-csv command', async () => {
    const command: OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand = {
      id: 'createOrUpdateHistoryQuerySouthItemsId',
      type: 'create-or-update-history-query-south-items-from-csv',
      targetVersion: testData.engine.settings.version,
      historyQueryId: 'h1',
      commandContent: {
        deleteItemsNotPresent: false,
        csvContent: '',
        delimiter: ','
      }
    } as OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand;
    historyQueryService.findById.mock.mockImplementationOnce(() => testData.historyQueries.list[0]);
    historyQueryService.checkImportItems.mock.mockImplementationOnce(async () => ({ items: [{}, {}], errors: [] }));
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(historyQueryService.findById.mock.calls[0].arguments, [command.historyQueryId]);
    assert.deepStrictEqual(historyQueryService.checkImportItems.mock.calls[0].arguments, [
      testData.historyQueries.list[0].southType,
      command.commandContent.csvContent,
      command.commandContent.delimiter,
      testData.historyQueries.list[0].items.map(item => ({
        ...item,
        updatedBy: { id: '', friendlyName: '' },
        createdBy: { id: '', friendlyName: '' }
      }))
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      `2 items imported on History query ${testData.historyQueries.list[0].name}`
    ]);
  });

  it('should execute create-or-update-history-query-south-items-from-csv command and throw an error if history not found', async () => {
    const command: OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand = {
      id: 'createOrUpdateHistoryQuerySouthItemsId',
      type: 'create-or-update-history-query-south-items-from-csv',
      targetVersion: testData.engine.settings.version,
      historyQueryId: 'h1',
      commandContent: {
        deleteItemsNotPresent: false,
        csvContent: '',
        delimiter: ','
      }
    } as OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand;
    historyQueryService.findById.mock.mockImplementationOnce(() => null);
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [
      command.id,
      `History query ${command.historyQueryId} not found`
    ]);
  });

  it('should execute create-or-update-history-query-south-items-from-csv command with item error', async () => {
    const command: OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand = {
      id: 'createOrUpdateHistoryQuerySouthItemsId',
      type: 'create-or-update-history-query-south-items-from-csv',
      targetVersion: testData.engine.settings.version,
      historyQueryId: 'h1',
      commandContent: {
        deleteItemsNotPresent: true,
        csvContent: '',
        delimiter: ','
      }
    } as OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand;
    historyQueryService.findById.mock.mockImplementationOnce(() => testData.historyQueries.list[0]);
    historyQueryService.checkImportItems.mock.mockImplementationOnce(async () => ({
      items: [{}, {}],
      errors: [
        { item: { name: 'item1' }, error: 'error1' },
        { item: { name: 'item2' }, error: 'error2' }
      ]
    }));
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(historyQueryService.checkImportItems.mock.calls[0].arguments, [
      testData.historyQueries.list[0].southType,
      command.commandContent.csvContent,
      command.commandContent.delimiter,
      []
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [
      command.id,
      `Error when checking csv items:\nitem1: error1\nitem2: error2`
    ]);
  });

  it('should execute test-history-query-north-connection command', async () => {
    const command: OIBusTestHistoryQueryNorthConnectionCommand = {
      id: 'testHistoryNorthConnectorId',
      type: 'test-history-query-north-connection',
      targetVersion: testData.engine.settings.version,
      northConnectorId: 'northConnectorId',
      historyQueryId: 'historyId',
      commandContent: testData.historyQueries.command
    } as OIBusTestHistoryQueryNorthConnectionCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    southService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.south.manifest,
        id: testData.historyQueries.command.southType
      }
    ]);
    northService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.north.manifest,
        id: testData.historyQueries.command.northType
      }
    ]);

    await service.executeCommand();

    assert.deepStrictEqual(historyQueryService.testNorth.mock.calls[0].arguments, [
      command.historyQueryId,
      command.commandContent.northType,
      command.northConnectorId,
      command.commandContent.northSettings
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify({ items: [] })
    ]);
  });

  it('should execute test-history-query-south-connection command', async () => {
    const command: OIBusTestHistoryQuerySouthConnectionCommand = {
      id: 'testHistorySouthConnectorId',
      type: 'test-history-query-south-connection',
      targetVersion: testData.engine.settings.version,
      southConnectorId: 'southConnectorId',
      historyQueryId: 'historyId',
      commandContent: testData.historyQueries.command
    } as OIBusTestHistoryQuerySouthConnectionCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    southService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.south.manifest,
        id: testData.historyQueries.command.southType
      }
    ]);
    northService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.north.manifest,
        id: testData.historyQueries.command.northType
      }
    ]);

    await service.executeCommand();

    assert.deepStrictEqual(historyQueryService.testSouth.mock.calls[0].arguments, [
      command.historyQueryId,
      command.commandContent.southType,
      command.southConnectorId,
      command.commandContent.southSettings
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify({ items: [] })
    ]);
  });

  it('should execute test-history-query-south-item command', async () => {
    const command: OIBusTestHistoryQuerySouthItemCommand = {
      id: 'testHistoryQuerySouthItemId',
      type: 'test-history-query-south-item',
      targetVersion: testData.engine.settings.version,
      historyQueryId: 'historyId',
      itemId: 'itemId',
      southConnectorId: 'southConnectorId',
      commandContent: {
        historyCommand: testData.historyQueries.command,
        itemCommand: testData.historyQueries.itemCommand,
        testingSettings: {} as SouthConnectorItemTestingSettings
      }
    } as OIBusTestHistoryQuerySouthItemCommand;

    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    historyQueryService.testItem.mock.mockImplementationOnce(async () => ({}));
    southService.listManifest.mock.mockImplementationOnce(() => [
      {
        ...testData.south.manifest,
        id: command.commandContent.historyCommand.southType
      }
    ]);
    const completeTestItemMock = mock.fn();
    (service as unknown as { completeTestItemCommand: typeof completeTestItemMock }).completeTestItemCommand = completeTestItemMock;

    await service.executeCommand();

    assert.deepStrictEqual(historyQueryService.testItem.mock.calls[0].arguments, [
      command.historyQueryId,
      command.commandContent.historyCommand.southType,
      command.commandContent.itemCommand.name,
      command.southConnectorId,
      command.commandContent.historyCommand.southSettings,
      command.commandContent.itemCommand.settings,
      command.commandContent.testingSettings
    ]);
    assert.deepStrictEqual(completeTestItemMock.mock.calls[0].arguments, [command, {}]);
  });

  it('should execute update-history-query-status command', async () => {
    const command: OIBusUpdateHistoryQueryStatusCommand = {
      id: 'updateHistoryQueryStatusId',
      type: 'update-history-query-status',
      targetVersion: testData.engine.settings.version,
      historyQueryId: 'historyId',
      commandContent: {
        historyQueryStatus: 'RUNNING'
      }
    } as OIBusUpdateHistoryQueryStatusCommand;

    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(historyQueryService.start.mock.calls[0].arguments, [command.historyQueryId]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'History query started'
    ]);

    command.commandContent.historyQueryStatus = 'PAUSED';
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();

    assert.deepStrictEqual(historyQueryService.pause.mock.calls[0].arguments, [command.historyQueryId]);
    assert.ok(
      (oIAnalyticsCommandRepository.markAsCompleted.mock.calls as Array<{ arguments: Array<unknown> }>).some(
        c => c.arguments[2] === 'History query paused'
      )
    );

    command.commandContent.historyQueryStatus = 'ERRORED';
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);

    await service.executeCommand();
    assert.ok(
      (oIAnalyticsCommandRepository.markAsErrored.mock.calls as Array<{ arguments: Array<unknown> }>).some(
        c =>
          c.arguments[1] ===
          `History query status of ${command.historyQueryId} can not be updated to ${command.commandContent.historyQueryStatus}`
      )
    );
  });

  it('should execute setpoint command', async () => {
    const command: OIAnalyticsFetchSetpointCommandDTO = {
      id: 'setpointCommandId',
      targetVersion: testData.engine.settings.version,
      type: 'setpoint',
      northConnectorId: 'n1',
      commandContent: {
        pointId: 'reference',
        value: '123456'
      }
    };

    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    northService.executeSetpoint.mock.mockImplementationOnce(
      (_northId: string, _commandContent: unknown, callback: (s: string) => void) => {
        callback('ok');
      }
    );

    await service.executeCommand();

    assert.strictEqual(northService.executeSetpoint.mock.calls[0].arguments[0], command.northConnectorId);
    assert.deepStrictEqual(northService.executeSetpoint.mock.calls[0].arguments[1], command.commandContent);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'ok'
    ]);
  });

  it('should execute search-north-cache-content command', async () => {
    const command: OIBusSearchNorthCacheContentCommand = {
      id: 'searchNorthCacheContentId',
      type: 'search-north-cache-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: 'northId1',
      commandContent: { start: undefined, end: undefined, nameContains: 'test', maxNumberOfFilesReturned: 1000 }
    } as OIBusSearchNorthCacheContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    const searchResult: CacheSearchResult = {
      searchDate: testData.constants.dates.FAKE_NOW,
      metrics: testData.north.metrics,
      error: [],
      archive: [],
      cache: []
    };
    oIBusService.searchCacheContent.mock.mockImplementationOnce(async () => searchResult);

    await service.executeCommand();

    assert.strictEqual(oIBusService.searchCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.searchCacheContent.mock.calls[0].arguments, [
      'north',
      command.northConnectorId,
      command.commandContent
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify(searchResult)
    ]);
  });

  it('should execute search-history-cache-content command', async () => {
    const command: OIBusSearchHistoryCacheContentCommand = {
      id: 'searchHistoryCacheContentId',
      type: 'search-history-cache-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: 'historyId1',
      commandContent: { start: undefined, end: undefined, nameContains: 'test', maxNumberOfFilesReturned: 1000 }
    } as OIBusSearchHistoryCacheContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    const searchResult: CacheSearchResult = {
      searchDate: testData.constants.dates.FAKE_NOW,
      metrics: testData.north.metrics,
      error: [],
      archive: [],
      cache: []
    };
    oIBusService.searchCacheContent.mock.mockImplementationOnce(async () => searchResult);

    await service.executeCommand();

    assert.strictEqual(oIBusService.searchCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.searchCacheContent.mock.calls[0].arguments, [
      'history',
      command.historyQueryId,
      command.commandContent
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify(searchResult)
    ]);
  });

  it('should execute get-north-cache-file-content command', async () => {
    const command: OIBusGetNorthCacheFileContentCommand = {
      id: 'getNorthCacheFileContentId',
      type: 'get-north-cache-file-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: 'northId1',
      commandContent: {
        folder: 'cache',
        filename: 'file.txt'
      }
    } as OIBusGetNorthCacheFileContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    const fileContent: FileCacheContent = {
      content: 'content',
      contentFilename: 'my_file.txt',
      contentType: 'raw',
      truncated: false,
      totalSize: 7
    };
    oIBusService.getFileFromCache.mock.mockImplementationOnce(async () => fileContent);

    await service.executeCommand();

    assert.deepStrictEqual(oIBusService.getFileFromCache.mock.calls[0].arguments, [
      'north',
      command.northConnectorId,
      command.commandContent.folder,
      command.commandContent.filename
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify(fileContent)
    ]);
  });

  it('should execute get-history-cache-file-content command', async () => {
    const command: OIBusGetHistoryCacheFileContentCommand = {
      id: 'getHistoryCacheFileContentId',
      type: 'get-history-cache-file-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: 'historyId1',
      commandContent: {
        folder: 'error',
        filename: 'file.txt'
      }
    } as OIBusGetHistoryCacheFileContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    const fileContent: FileCacheContent = {
      content: 'content',
      contentFilename: 'my_file.txt',
      contentType: 'raw',
      truncated: false,
      totalSize: 7
    };
    oIBusService.getFileFromCache.mock.mockImplementationOnce(async () => fileContent);

    await service.executeCommand();

    assert.deepStrictEqual(oIBusService.getFileFromCache.mock.calls[0].arguments, [
      'history',
      command.historyQueryId,
      command.commandContent.folder,
      command.commandContent.filename
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify(fileContent)
    ]);
  });

  it('should execute update-north-cache-content command', async () => {
    const command: OIBusUpdateNorthCacheContentCommand = {
      id: 'updateNorthCacheContentId',
      type: 'update-north-cache-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: 'northId1',
      commandContent: {
        cache: {
          remove: ['file1.txt', 'file2.txt'],
          move: [
            { filename: 'file3.txt', to: 'error' },
            { filename: 'file4.txt', to: 'archive' }
          ]
        },
        error: {
          remove: ['file5.txt', 'file6.txt'],
          move: [
            { filename: 'file7.txt', to: 'cache' },
            { filename: 'file8.txt', to: 'archive' }
          ]
        },
        archive: {
          remove: ['file9.txt', 'file10.txt'],
          move: [
            { filename: 'file11.txt', to: 'cache' },
            { filename: 'file12.txt', to: 'error' }
          ]
        }
      }
    } as OIBusUpdateNorthCacheContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIBusService.updateCacheContent.mock.mockImplementationOnce(async () => undefined);

    await service.executeCommand();

    assert.strictEqual(oIBusService.updateCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.updateCacheContent.mock.calls[0].arguments, [
      'north',
      command.northConnectorId,
      command.commandContent
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'Cache updated successfully'
    ]);
  });

  it('should execute update-history-cache-content command', async () => {
    const command: OIBusUpdateHistoryCacheContentCommand = {
      id: 'updateHistoryCacheContentId',
      type: 'update-history-cache-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: 'historyId1',
      commandContent: {
        cache: {
          remove: ['file1.txt', 'file2.txt'],
          move: [
            { filename: 'file3.txt', to: 'error' },
            { filename: 'file4.txt', to: 'archive' }
          ]
        },
        error: {
          remove: ['file5.txt', 'file6.txt'],
          move: [
            { filename: 'file7.txt', to: 'cache' },
            { filename: 'file8.txt', to: 'archive' }
          ]
        },
        archive: {
          remove: ['file9.txt', 'file10.txt'],
          move: [
            { filename: 'file11.txt', to: 'cache' },
            { filename: 'file12.txt', to: 'error' }
          ]
        }
      }
    } as OIBusUpdateHistoryCacheContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIBusService.updateCacheContent.mock.mockImplementationOnce(async () => undefined);

    await service.executeCommand();

    assert.strictEqual(oIBusService.updateCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.updateCacheContent.mock.calls[0].arguments, [
      'history',
      command.historyQueryId,
      command.commandContent
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      'Cache updated successfully'
    ]);
  });

  it('should not execute cache command if permission is not right', async () => {
    const command: OIBusSearchNorthCacheContentCommand = {
      id: 'searchNorthCacheContentId',
      type: 'search-north-cache-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: 'northId1',
      commandContent: { start: undefined, end: undefined, nameContains: 'test', maxNumberOfFilesReturned: 1000 }
    } as OIBusSearchNorthCacheContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementationOnce(() => ({
      ...testData.oIAnalytics.registration.completed,
      commandPermissions: {
        ...testData.oIAnalytics.registration.completed.commandPermissions,
        searchNorthCacheContent: false
      }
    }));

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [
      command.id,
      `Command ${command.id} of type ${command.type} is not authorized`
    ]);
  });

  it('should not execute get-cache-file-content command if permission is not right', async () => {
    const command: OIBusGetNorthCacheFileContentCommand = {
      id: 'getNorthCacheFileContentId',
      type: 'get-north-cache-file-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: 'northId1',
      commandContent: {
        folder: 'cache',
        filename: 'file.txt'
      }
    } as OIBusGetNorthCacheFileContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementationOnce(() => ({
      ...testData.oIAnalytics.registration.completed,
      commandPermissions: {
        ...testData.oIAnalytics.registration.completed.commandPermissions,
        getNorthCacheFileContent: false
      }
    }));

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [
      command.id,
      `Command ${command.id} of type ${command.type} is not authorized`
    ]);
  });

  it('should not execute update-cache-content command if permission is not right', async () => {
    const command: OIBusUpdateNorthCacheContentCommand = {
      id: 'updateNorthCacheContentId',
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: '',
      type: 'update-north-cache-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: 'northId1',
      commandContent: {
        cache: { remove: [], move: [] },
        error: { remove: [], move: [] },
        archive: { remove: [], move: [] }
      }
    } as OIBusUpdateNorthCacheContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementationOnce(() => ({
      ...testData.oIAnalytics.registration.completed,
      commandPermissions: {
        ...testData.oIAnalytics.registration.completed.commandPermissions,
        updateNorthCacheContent: false
      }
    }));

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [
      command.id,
      `Command ${command.id} of type ${command.type} is not authorized`
    ]);
  });

  it('should fail to execute search-north-cache-content if north not found', async () => {
    const command: OIBusSearchNorthCacheContentCommand = {
      id: 'searchNorthCacheContentId',
      type: 'search-north-cache-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: 'northId1',
      commandContent: { start: undefined, end: undefined, nameContains: 'test', maxNumberOfFilesReturned: 1000 }
    } as OIBusSearchNorthCacheContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIBusService.searchCacheContent.mock.mockImplementationOnce(async () => {
      throw new Error('North northId1 not found');
    });

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [command.id, 'North northId1 not found']);
  });

  it('should handle error in executeGetNorthCacheFileContentCommand', async () => {
    const command: OIBusGetNorthCacheFileContentCommand = {
      id: 'getNorthCacheFileContentId',
      type: 'get-north-cache-file-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: 'northId1',
      commandContent: {
        folder: 'error',
        filename: 'file.txt'
      }
    } as OIBusGetNorthCacheFileContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIBusService.getFileFromCache.mock.mockImplementationOnce(async () => {
      throw new Error('File not found');
    });

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [command.id, 'File not found']);
  });

  it('should fail to execute update-north-cache-content command when action returns an error', async () => {
    const command: OIBusUpdateNorthCacheContentCommand = {
      id: 'updateNorthCacheContentId',
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: '',
      type: 'update-north-cache-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      northConnectorId: 'northId1',
      commandContent: {
        cache: { remove: [], move: [] },
        error: { remove: [], move: [] },
        archive: { remove: [], move: [] }
      }
    } as OIBusUpdateNorthCacheContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIBusService.updateCacheContent.mock.mockImplementationOnce(async () => {
      throw new Error('error while removing file');
    });

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [command.id, 'error while removing file']);
  });

  it('should handle error in executeSearchHistoryCacheContentCommand if history not found', async () => {
    const command: OIBusSearchHistoryCacheContentCommand = {
      id: 'searchHistoryCacheContentId',
      type: 'search-history-cache-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: 'historyId1',
      commandContent: { start: undefined, end: undefined, nameContains: 'test', maxNumberOfFilesReturned: 1000 }
    } as OIBusSearchHistoryCacheContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIBusService.searchCacheContent.mock.mockImplementationOnce(async () => {
      throw new Error('History historyId1 not found');
    });

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [
      command.id,
      'History historyId1 not found'
    ]);
  });

  it('should handle error in executeGetHistoryCacheFileContentCommand', async () => {
    const command: OIBusGetHistoryCacheFileContentCommand = {
      id: 'getHistoryCacheFileContentId',
      type: 'get-history-cache-file-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: 'historyId1',
      commandContent: {
        folder: 'error',
        filename: 'file.txt'
      }
    } as OIBusGetHistoryCacheFileContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIBusService.getFileFromCache.mock.mockImplementationOnce(async () => {
      throw new Error('File not found');
    });

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [command.id, 'File not found']);
  });

  it('should handle error in executeUpdateHistoryCacheContentCommand', async () => {
    const command: OIBusUpdateHistoryCacheContentCommand = {
      id: 'updateHistoryCacheContentId',
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: '',
      type: 'update-history-cache-content',
      targetVersion: testData.engine.settings.version,
      status: 'RETRIEVED',
      ack: false,
      retrievedDate: testData.constants.dates.FAKE_NOW,
      completedDate: null,
      result: null,
      historyQueryId: 'historyId1',
      commandContent: {
        cache: { remove: [], move: [] },
        error: { remove: [], move: [] },
        archive: { remove: [], move: [] }
      }
    } as OIBusUpdateHistoryCacheContentCommand;
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [command]);
    oIBusService.updateCacheContent.mock.mockImplementationOnce(async () => {
      throw new Error('Update failed');
    });

    await service.executeCommand();

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [command.id, 'Update failed']);
  });
});

describe('OIAnalytics Command service with update error', () => {
  beforeEach(() => {
    resetAllMocks();
    mock.method(Date, 'now', () => new Date(testData.constants.dates.FAKE_NOW).getTime());

    oIBusService.getEngineSettings.mock.mockImplementation(() => ({
      ...JSON.parse(JSON.stringify(testData.engine.settings)),
      version: (testData.oIAnalytics.commands.oIBusList[0] as OIBusUpdateVersionCommand).commandContent.version.slice(1)
    }));
    oIAnalyticsCommandRepository.list.mock.mockImplementation(() => [
      {
        ...testData.oIAnalytics.commands.oIBusList[0],
        commandContent: {
          ...(testData.oIAnalytics.commands.oIBusList[0] as OIBusUpdateVersionCommand).commandContent,
          version: (testData.oIAnalytics.commands.oIBusList[0] as OIBusUpdateVersionCommand).commandContent.version.slice(1)
        }
      }
    ]);

    makeService();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should properly start and stop service', () => {
    assert.strictEqual(oIBusService.getEngineSettings.mock.calls.length, 1);
    assert.strictEqual(oIBusService.updateOIBusVersion.mock.calls.length, 0);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [
      testData.oIAnalytics.commands.oIBusList[0].id,
      `OIBus has not been updated. Rollback to version ${version}`
    ]);
  });
});

describe('OIAnalytics Command service with ignoreRemoteUpdate', () => {
  let service: InstanceType<typeof OIAnalyticsCommandServiceType>;

  beforeEach(() => {
    resetAllMocks();
    mock.method(Date, 'now', () => new Date(testData.constants.dates.FAKE_NOW).getTime());

    oIBusService.getEngineSettings.mock.mockImplementation(() => testData.engine.settings);
    oIAnalyticsCommandRepository.list.mock.mockImplementation(() => testData.oIAnalytics.commands.oIBusList);
    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);

    service = makeService(true, '3.4.0');
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should change logger', async () => {
    // Prevent background executeCommand from running real logic
    oIAnalyticsCommandRepository.list.mock.mockImplementation(() => []);
    mock.method(process, 'exit', () => undefined as never);
    mock.method(process, 'kill', () => undefined as unknown as void);

    await service.start();
    oIBusService.loggerEvent.emit('updated', asLogger(anotherLogger));
    await service.stop();
    await flushPromises();

    assert.strictEqual(logger.debug.mock.calls.length, 0);
    assert.strictEqual(anotherLogger.debug.mock.calls.length, 2);
  });

  it('should not run an update', async () => {
    await service.executeCommand();
    assert.ok(
      (logger.error.mock.calls as Array<{ arguments: Array<string> }>).some(
        c =>
          c.arguments[0] ===
          `Error while executing command ${testData.oIAnalytics.commands.oIBusList[0].id} (retrieved ${testData.oIAnalytics.commands.oIBusList[0].retrievedDate}) of type ${testData.oIAnalytics.commands.oIBusList[0].type}. Error: OIBus is not set up to execute remote update`
      )
    );
  });
});

describe('OIAnalytics Command service with no commands', () => {
  beforeEach(() => {
    resetAllMocks();
    mock.method(Date, 'now', () => new Date(testData.constants.dates.FAKE_NOW).getTime());

    oIBusService.getEngineSettings.mock.mockImplementation(() => testData.engine.settings);
    oIAnalyticsCommandRepository.list.mock.mockImplementation(() => []);

    makeService(true, '3.4.0');
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should properly start when not registered', () => {
    assert.ok(oIBusService.getEngineSettings.mock.calls.length > 0);
    assert.ok(oIAnalyticsCommandRepository.list.mock.calls.length > 0);
    assert.deepStrictEqual(oIBusService.updateOIBusVersion.mock.calls[0].arguments, [version, '3.4.0']);
    assert.strictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls.length, 0);
  });
});

describe('OIAnalytics Command service with no commands and without update', () => {
  let service: InstanceType<typeof OIAnalyticsCommandServiceType>;

  beforeEach(() => {
    resetAllMocks();
    mock.method(Date, 'now', () => new Date(testData.constants.dates.FAKE_NOW).getTime());

    oIAnalyticsCommandRepository.list.mock.mockImplementation(() => []);
    const engineSettings: EngineSettings = JSON.parse(JSON.stringify(testData.engine.settings));
    engineSettings.version = version;
    oIBusService.getEngineSettings.mock.mockImplementation(() => engineSettings);

    service = makeService(true, engineSettings.launcherVersion);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should properly start when not registered', () => {
    assert.strictEqual(oIBusService.updateOIBusVersion.mock.calls.length, 0);
    assert.strictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls.length, 0);
  });

  it('should complete time values test item command', () => {
    const command: OIBusTestSouthConnectorItemCommand = {
      id: 'testSouthItemId',
      type: 'test-south-item',
      targetVersion: testData.engine.settings.version,
      itemId: 'itemId',
      southConnectorId: 'southConnectorId',
      commandContent: {
        southCommand: testData.south.command,
        itemCommand: testData.south.itemCommand,
        testingSettings: {} as SouthConnectorItemTestingSettings
      }
    } as OIBusTestSouthConnectorItemCommand;

    const content = new Array(2000).fill(0);
    const result: OIBusContent = { type: 'time-values', content };
    (
      service as unknown as { completeTestItemCommand(cmd: OIBusTestSouthConnectorItemCommand, r: OIBusContent): void }
    ).completeTestItemCommand(command, result);

    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[0].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify({ type: 'time-values', content: content.slice(0, 1000), truncated: true, totalSize: 2000 })
    ]);

    const content2 = new Array(10).fill(0);
    const result2: OIBusContent = { type: 'time-values', content: content2 };
    (
      service as unknown as { completeTestItemCommand(cmd: OIBusTestSouthConnectorItemCommand, r: OIBusContent): void }
    ).completeTestItemCommand(command, result2);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify({ type: 'time-values', content: content2, truncated: false, totalSize: 10 })
    ]);
  });

  it('should complete file test item command', () => {
    const command: OIBusTestSouthConnectorItemCommand = {
      id: 'testSouthItemId',
      type: 'test-south-item',
      targetVersion: testData.engine.settings.version,
      itemId: 'itemId',
      southConnectorId: 'southConnectorId',
      commandContent: {
        southCommand: testData.south.command,
        itemCommand: testData.south.itemCommand,
        testingSettings: {} as SouthConnectorItemTestingSettings
      }
    } as OIBusTestSouthConnectorItemCommand;

    const result: OIBusContent = { type: 'any', filePath: 'file.csv', content: 'content' };
    (
      service as unknown as { completeTestItemCommand(cmd: OIBusTestSouthConnectorItemCommand, r: OIBusContent): void }
    ).completeTestItemCommand(command, result);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[0].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify({ type: 'any', filePath: 'file.csv', content: result.content, truncated: false, totalSize: result.content!.length })
    ]);

    const content2 = 'A'.repeat(500 * 1025);
    const result2: OIBusContent = { type: 'any', filePath: 'file.csv', content: content2 };
    (
      service as unknown as { completeTestItemCommand(cmd: OIBusTestSouthConnectorItemCommand, r: OIBusContent): void }
    ).completeTestItemCommand(command, result2);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify({ type: 'any', filePath: 'file.csv', content: content2.slice(0, 1024 * 500), truncated: true, totalSize: 1025 * 500 })
    ]);

    const result3: OIBusContent = { type: 'any', filePath: 'file.csv' };
    (
      service as unknown as { completeTestItemCommand(cmd: OIBusTestSouthConnectorItemCommand, r: OIBusContent): void }
    ).completeTestItemCommand(command, result3);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[2].arguments, [
      command.id,
      testData.constants.dates.FAKE_NOW,
      JSON.stringify({ type: 'any', filePath: 'file.csv', truncated: false, totalSize: 0 })
    ]);
  });

  it('should properly convert to DTO', () => {
    const command = testData.oIAnalytics.commands.oIBusList[0];
    assert.deepStrictEqual(toOIBusCommandDTO(command), command);
  });
});
