import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { writeFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import v8 from 'node:v8';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import Database from 'better-sqlite3';

import { CertificateCommandDTO } from '../../../shared/model/api/certificate.model';
import { HistoryQueryItemDTO } from '../../../shared/model/api/history-query.model';
import { IPFilterCommandDTO } from '../../../shared/model/api/ip-filter.model';
import { ScanModeCommandDTO } from '../../../shared/model/api/scan-mode.model';
import { SouthConnectorItemDTO, SouthConnectorItemTestResult, SouthItemGroupDTO } from '../../../shared/model/api/south-connector.model';
import { OIBusContent } from '../../../shared/model/common/content.model';
import { createPageFromArray } from '../../../shared/model/common/types';
import { OIBUS_NORTH_TYPES } from '../../../shared/model/connector/north-manifest.model';
import { OIBUS_SOUTH_TYPES } from '../../../shared/model/connector/south-manifest.model';
import { CacheSearchResult, FileCacheContent, RegistrationCommandPermissions } from '../../../shared/model/domain/engine.model';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/domain/south-connector.model';
import { OIBUS_COMMAND_TYPES } from '../../../shared/model/oia/command.model';

import { version } from '../../../package.json';
import {
  BaseOIBusCommand,
  OIBusCommand,
  OIBusCreateCertificateCommand,
  OIBusCreateCustomTransformerCommand,
  OIBusCreateHistoryQueryCommand,
  OIBusCreateIPFilterCommand,
  OIBusCreateNorthConnectorCommand,
  OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand,
  OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand,
  OIBusCreateScanModeCommand,
  OIBusCreateSouthConnectorCommand,
  OIBusDeleteCertificateCommand,
  OIBusDeleteCustomTransformerCommand,
  OIBusDeleteHistoryQueryCommand,
  OIBusDeleteIPFilterCommand,
  OIBusDeleteNorthConnectorCommand,
  OIBusDeleteScanModeCommand,
  OIBusDeleteSouthConnectorCommand,
  OIBusDumpMemoryCommand,
  OIBusGetHistoryCacheFileContentCommand,
  OIBusGetNorthCacheFileContentCommand,
  OIBusImportConfigurationCommand,
  OIBusRetrieveLogsDatabaseCommand,
  OIBusSearchHistoryCacheContentCommand,
  OIBusSearchNorthCacheContentCommand,
  OIBusSetpointCommand,
  OIBusTestCustomTransformerCommand,
  OIBusTestHistoryQueryNorthConnectionCommand,
  OIBusTestHistoryQuerySouthConnectionCommand,
  OIBusTestHistoryQuerySouthItemCommand,
  OIBusTestNorthConnectorCommand,
  OIBusTestSouthConnectorCommand,
  OIBusTestSouthConnectorItemCommand,
  OIBusTestTransformerCommand,
  OIBusUpdateCertificateCommand,
  OIBusUpdateCustomTransformerCommand,
  OIBusUpdateEngineGeneralCommand,
  OIBusUpdateEngineLoggerCommand,
  OIBusUpdateEngineProxyCommand,
  OIBusUpdateEngineWebServerCommand,
  OIBusUpdateHistoryCacheContentCommand,
  OIBusUpdateHistoryQueryCommand,
  OIBusUpdateHistoryQueryStatusCommand,
  OIBusUpdateIPFilterCommand,
  OIBusUpdateNorthCacheContentCommand,
  OIBusUpdateNorthConnectorCommand,
  OIBusUpdateRegistrationSettingsCommand,
  OIBusUpdateScanModeCommand,
  OIBusUpdateSouthConnectorCommand,
  OIBusUpdateVersionCommand
} from '../../model/oianalytics-command.model';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { NotFoundError } from '../../model/types';
import type OIAnalyticsCommandRepository from '../../repository/config/oianalytics-command.repository';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import LoggerMock from '../../tests/__mocks__/service/logger/logger.mock';
import OianalyticsClientMock from '../../tests/__mocks__/service/oia/oianalytics-client.mock';
import testData from '../../tests/utils/test-data';
import { createMock, flushPromises, Mocked, mockModule, reloadModule, seq } from '../../tests/utils/test-utils';
import type CertificateService from '../certificate.service';
import type ConfigImportService from '../config-transfer/config-import.service';
import { ConfigImportError } from '../config-transfer/config-import.service';
import type HistoryQueryService from '../history-query.service';
import { toHistoryQueryItemDTO } from '../history-query-item-dto.utils';
import type IPFilterService from '../ip-filter.service';
import type NorthService from '../north.service';
import type OIBusService from '../oibus.service';
import type ScanModeService from '../scan-mode.service';
import type SouthService from '../south.service';
import { toSouthConnectorItemDTO } from '../south-connector-dto.utils';
import type TransformerService from '../transformer.service';
import type * as Utils from '../utils';
import type OIAnalyticsCommandServiceType from './oianalytics-command.service';
import type { toOIBusCommandDTO as toOIBusCommandDTOType } from './oianalytics-command.service';
import type OIAnalyticsMessageService from './oianalytics-message.service';
import type OIAnalyticsRegistrationService from './oianalytics-registration.service';

const nodeRequire = createRequire(import.meta.url);

const realUtils: typeof Utils = nodeRequire('../utils');
// Only the waits, the OIBus info and the (un)zipping are controlled by the tests
const createUtilsMocks = () => ({
  delay: mock.fn<typeof Utils.delay>(async () => undefined),
  getOIBusInfo: mock.fn<typeof Utils.getOIBusInfo>(() => testData.engine.oIBusInfo),
  unzip: mock.fn<typeof Utils.unzip>(async () => undefined),
  zipFile: mock.fn<typeof Utils.zipFile>(async (_input, _entryName, output) => fs.writeFile(output, 'zip'))
});
const utilsExports = { ...realUtils, ...createUtilsMocks() };
const encryptionServiceExports = { encryptionService: new EncryptionServiceMock('', '') };

const FAKE_NOW = testData.constants.dates.FAKE_NOW;
const TEST_FOLDER = path.join(os.tmpdir(), `oibus-command-service-spec-${process.pid}`);
const LOGS_DATABASE_PATH = path.join(TEST_FOLDER, 'logs.db');
const TMP_FOLDER = path.join(TEST_FOLDER, 'tmp');

let OIAnalyticsCommandService: typeof OIAnalyticsCommandServiceType;
let toOIBusCommandDTO: typeof toOIBusCommandDTOType;

// --- fresh mocks for each test ---
let logger: LoggerMock;
let encryptionService: EncryptionServiceMock;
let oIAnalyticsCommandRepository: Mocked<OIAnalyticsCommandRepository>;
let oIAnalyticsRegistrationService: Mocked<OIAnalyticsRegistrationService>;
let oIAnalyticsMessageService: Mocked<OIAnalyticsMessageService>;
let oIBusService: Mocked<OIBusService>;
let scanModeService: Mocked<ScanModeService>;
let ipFilterService: Mocked<IPFilterService>;
let certificateService: Mocked<CertificateService>;
let southService: Mocked<SouthService>;
let northService: Mocked<NorthService>;
let historyQueryService: Mocked<HistoryQueryService>;
let transformerService: Mocked<TransformerService>;
let configImportService: Mocked<ConfigImportService>;
let oIAnalyticsClient: OianalyticsClientMock;
let service: OIAnalyticsCommandServiceType;

before(() => {
  mockModule(nodeRequire, '../utils', utilsExports);
  mockModule(nodeRequire, '../encryption.service', encryptionServiceExports);

  const mod = reloadModule<{
    default: typeof OIAnalyticsCommandServiceType;
    toOIBusCommandDTO: typeof toOIBusCommandDTOType;
  }>(nodeRequire, './oianalytics-command.service');

  OIAnalyticsCommandService = mod.default;
  toOIBusCommandDTO = mod.toOIBusCommandDTO;
});

beforeEach(() => {
  mock.method(Date, 'now', () => new Date(FAKE_NOW).getTime());
  Object.assign(utilsExports, createUtilsMocks());
  encryptionService = encryptionServiceExports.encryptionService = new EncryptionServiceMock('', '');
  logger = new LoggerMock();
  oIAnalyticsCommandRepository = createMock<OIAnalyticsCommandRepository>({
    list: () => commands,
    findById: () => updateVersionCommand
  });
  oIAnalyticsRegistrationService = createMock<OIAnalyticsRegistrationService>({
    registrationEvent: new EventEmitter(),
    getRegistrationSettings: () => testData.oIAnalytics.registration.completed
  });
  oIAnalyticsMessageService = createMock<OIAnalyticsMessageService>();
  oIBusService = createMock<OIBusService>({ loggerEvent: new EventEmitter(), getEngineSettings: () => testData.engine.settings });
  scanModeService = createMock<ScanModeService>();
  ipFilterService = createMock<IPFilterService>();
  certificateService = createMock<CertificateService>();
  // a manifest for each connector type, to decrypt the secrets of the commands
  southService = createMock<SouthService>({ listManifest: () => OIBUS_SOUTH_TYPES.map(id => ({ ...testData.south.manifest, id })) });
  northService = createMock<NorthService>({ listManifest: () => OIBUS_NORTH_TYPES.map(id => ({ ...testData.north.manifest, id })) });
  historyQueryService = createMock<HistoryQueryService>();
  transformerService = createMock<TransformerService>();
  configImportService = createMock<ConfigImportService>();
  oIAnalyticsClient = new OianalyticsClientMock();
});

afterEach(() => {
  mock.restoreAll();
});

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
    configImportService,
    logger,
    'binaryFolder',
    LOGS_DATABASE_PATH,
    TMP_FOLDER,
    ignoreRemoteUpdate,
    launcherVersion
  );
}

// --- commands ---
type CommandFields<T extends OIBusCommand> = Omit<T, keyof BaseOIBusCommand> & Pick<T, 'id' | 'type'>;
/** A retrieved command targeting the current OIBus version */
const buildCommand = <T extends OIBusCommand>(fields: CommandFields<T>): T =>
  ({
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: '',
    targetVersion: testData.engine.settings.version,
    status: 'RETRIEVED',
    ack: false,
    retrievedDate: FAKE_NOW,
    completedDate: null,
    result: null,
    ...fields
  }) as T;

const commands = testData.oIAnalytics.commands.oIBusList;
const updateVersionCommand = commands[0] as OIBusUpdateVersionCommand;
const launcherUpdateCommand: OIBusUpdateVersionCommand = {
  ...updateVersionCommand,
  commandContent: { version: 'v3.5.0-beta', assetId: 'assetId', backupFolders: 'cache/*', updateLauncher: true }
};
const updateEngineGeneralCommand = commands[1] as OIBusUpdateEngineGeneralCommand;
const restartCommand = commands[2];
const updateScanModeCommand = commands[3] as OIBusUpdateScanModeCommand;
const updateSouthCommand = commands[4] as OIBusUpdateSouthConnectorCommand;
const updateNorthCommand = commands[5] as OIBusUpdateNorthConnectorCommand;
const deleteScanModeCommand = commands[6] as OIBusDeleteScanModeCommand;
const deleteSouthCommand = commands[7] as OIBusDeleteSouthConnectorCommand;
const deleteNorthCommand = commands[8] as OIBusDeleteNorthConnectorCommand;
const createScanModeCommand = commands[9] as OIBusCreateScanModeCommand;
const createSouthCommand = commands[10] as OIBusCreateSouthConnectorCommand;
const createNorthCommand = commands[11] as OIBusCreateNorthConnectorCommand;
const regenerateCipherKeysCommand = commands[12];
const southItemsFromCsvCommand = commands[14] as OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand;
const updateRegistrationCommand = commands[15] as OIBusUpdateRegistrationSettingsCommand;

const testSouthItemCommand = buildCommand<OIBusTestSouthConnectorItemCommand>({
  id: 'testSouthItemId',
  type: 'test-south-item',
  itemId: 'itemId',
  southConnectorId: 'southConnectorId',
  commandContent: {
    southCommand: testData.south.command,
    itemCommand: testData.south.itemCommand,
    testingSettings: {} as SouthConnectorItemTestingSettings
  }
});
const testHistoryQuerySouthItemCommand = buildCommand<OIBusTestHistoryQuerySouthItemCommand>({
  id: 'testHistoryQuerySouthItemId',
  type: 'test-history-query-south-item',
  historyQueryId: 'historyId',
  itemId: 'itemId',
  southConnectorId: 'southConnectorId',
  commandContent: {
    historyCommand: testData.historyQueries.command,
    itemCommand: testData.historyQueries.itemCommand,
    testingSettings: {} as SouthConnectorItemTestingSettings
  }
});
const testTransformerWithItemCommand = buildCommand<OIBusTestTransformerCommand>({
  id: 'testTransformerItemId',
  type: 'test-transformer',
  transformerId: 'transformerId',
  commandContent: {
    southId: 'southConnectorId',
    southType: testData.south.command.type,
    itemName: 'Current',
    southSettings: testData.south.command.settings,
    itemSettings: testData.south.itemCommand.settings,
    testingSettings: {} as SouthConnectorItemTestingSettings
  }
});
const historyItemsFromCsvCommand = buildCommand<OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand>({
  id: 'createOrUpdateHistoryQuerySouthItemsId',
  type: 'create-or-update-history-query-south-items-from-csv',
  historyQueryId: 'h1',
  commandContent: { deleteItemsNotPresent: false, csvContent: '', delimiter: ',' }
});

const cacheSearch = { start: undefined, end: undefined, nameContains: 'test', maxNumberOfFilesReturned: 1000 };
const cacheUpdate = {
  cache: {
    remove: ['file1.txt', 'file2.txt'],
    move: [
      { filename: 'file3.txt', to: 'error' as const },
      { filename: 'file4.txt', to: 'archive' as const }
    ]
  },
  error: {
    remove: ['file5.txt', 'file6.txt'],
    move: [
      { filename: 'file7.txt', to: 'cache' as const },
      { filename: 'file8.txt', to: 'archive' as const }
    ]
  },
  archive: {
    remove: ['file9.txt', 'file10.txt'],
    move: [
      { filename: 'file11.txt', to: 'cache' as const },
      { filename: 'file12.txt', to: 'error' as const }
    ]
  }
};
const searchNorthCacheCommand = buildCommand<OIBusSearchNorthCacheContentCommand>({
  id: 'searchNorthCacheContentId',
  type: 'search-north-cache-content',
  northConnectorId: 'northId1',
  commandContent: cacheSearch
});
const searchHistoryCacheCommand = buildCommand<OIBusSearchHistoryCacheContentCommand>({
  id: 'searchHistoryCacheContentId',
  type: 'search-history-cache-content',
  historyQueryId: 'historyId1',
  commandContent: cacheSearch
});
const getNorthCacheFileCommand = buildCommand<OIBusGetNorthCacheFileContentCommand>({
  id: 'getNorthCacheFileContentId',
  type: 'get-north-cache-file-content',
  northConnectorId: 'northId1',
  commandContent: { folder: 'cache', filename: 'file.txt' }
});
const getHistoryCacheFileCommand = buildCommand<OIBusGetHistoryCacheFileContentCommand>({
  id: 'getHistoryCacheFileContentId',
  type: 'get-history-cache-file-content',
  historyQueryId: 'historyId1',
  commandContent: { folder: 'error', filename: 'file.txt' }
});
const updateNorthCacheCommand = buildCommand<OIBusUpdateNorthCacheContentCommand>({
  id: 'updateNorthCacheContentId',
  type: 'update-north-cache-content',
  northConnectorId: 'northId1',
  commandContent: cacheUpdate
});
const updateHistoryCacheCommand = buildCommand<OIBusUpdateHistoryCacheContentCommand>({
  id: 'updateHistoryCacheContentId',
  type: 'update-history-cache-content',
  historyQueryId: 'historyId1',
  commandContent: cacheUpdate
});
const cacheSearchResult: CacheSearchResult = { searchDate: FAKE_NOW, metrics: testData.north.metrics, error: [], archive: [], cache: [] };
const cacheFileContent: FileCacheContent = {
  content: 'content',
  contentFilename: 'my_file.txt',
  contentType: 'raw',
  truncated: false,
  totalSize: 7
};

// --- results of the item tests ---
const rawContent: OIBusContent = { type: 'file', content: 'raw content' };
const transformedContent: OIBusContent = { type: 'file', content: 'transformed content' };
const itemTestResult = { raw: rawContent, transformed: transformedContent, connectionDuration: 56, queryDuration: 78 };
const itemTestResultWithoutTransformer = { raw: rawContent, transformed: null, connectionDuration: 0, queryDuration: 0 };
// the size of a file held in memory is the length of its content
const completedItemTest = JSON.stringify({
  raw: { ...rawContent, truncated: false, totalSize: 11 },
  transformed: { ...transformedContent, truncated: false, totalSize: 19 },
  connectionDuration: 56,
  queryDuration: 78
});
const completedItemTestWithoutTransformer = JSON.stringify({
  raw: { ...rawContent, truncated: false, totalSize: 11 },
  transformed: null,
  connectionDuration: 0,
  queryDuration: 0
});

// --- helpers ---
const getUserInfo = (id: string) => ({ id, friendlyName: id });
const logged = (log: LoggerMock['trace']): Array<string> => log.mock.calls.map(call => call.arguments[0]);

async function executeCommand(command: OIBusCommand) {
  oIAnalyticsCommandRepository.findFirstToExecute.mock.mockImplementationOnce(() => command);
  await service.processNextCommand();
}

/** The first markAsCompleted call is the update-version command completed by the constructor */
function assertCompleted(command: OIBusCommand, result: string) {
  assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments, [command.id, FAKE_NOW, result]);
}

function assertErrored(command: OIBusCommand, error: string) {
  assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments, [command.id, error]);
}

function withoutPermission(permission: keyof RegistrationCommandPermissions) {
  oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementationOnce(() => ({
    ...testData.oIAnalytics.registration.completed,
    commandPermissions: { ...testData.oIAnalytics.registration.completed.commandPermissions, [permission]: false }
  }));
}

function expectedRegistrationEdit(registration: OIAnalyticsRegistration) {
  return {
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
    commandRefreshInterval: updateRegistrationCommand.commandContent.commandRefreshInterval,
    commandRetryInterval: updateRegistrationCommand.commandContent.commandRetryInterval,
    messageRetryInterval: updateRegistrationCommand.commandContent.messageRetryInterval,
    commandPermissions: registration.commandPermissions
  };
}

/** A command that calls one service method and completes with a result */
interface ExecutionCase {
  title?: string;
  command: OIBusCommand;
  setup?: () => void;
  /** Calls of the service method executing the command */
  calls: () => ReadonlyArray<{ arguments: ReadonlyArray<unknown> }>;
  args: ReadonlyArray<unknown>;
  result: string;
}

const executionCases = (): Array<ExecutionCase> => {
  const updateEngineWebServerCommand = buildCommand<OIBusUpdateEngineWebServerCommand>({
    id: 'updateEngineWebServerId',
    type: 'update-engine-web-server',
    commandContent: testData.engine.webServerCommand
  });
  const updateEngineProxyCommand = buildCommand<OIBusUpdateEngineProxyCommand>({
    id: 'updateEngineProxyId',
    type: 'update-engine-proxy',
    commandContent: testData.engine.proxyCommand
  });
  const updateEngineLoggerCommand = buildCommand<OIBusUpdateEngineLoggerCommand>({
    id: 'updateEngineLoggerId',
    type: 'update-engine-logger',
    commandContent: testData.engine.loggerCommand
  });
  const createIpFilterCommand = buildCommand<OIBusCreateIPFilterCommand>({
    id: 'createIpFilterId',
    type: 'create-ip-filter',
    commandContent: {} as IPFilterCommandDTO
  });
  const updateIpFilterCommand = buildCommand<OIBusUpdateIPFilterCommand>({
    id: 'updateIpFilterId',
    type: 'update-ip-filter',
    ipFilterId: 'ipFilterId',
    commandContent: {} as IPFilterCommandDTO
  });
  const deleteIpFilterCommand = buildCommand<OIBusDeleteIPFilterCommand>({
    id: 'deleteIpFilterId',
    type: 'delete-ip-filter',
    ipFilterId: 'ipFilterId'
  });
  const createCertificateCommand = buildCommand<OIBusCreateCertificateCommand>({
    id: 'createCertificateId',
    type: 'create-certificate',
    commandContent: {} as CertificateCommandDTO
  });
  const updateCertificateCommand = buildCommand<OIBusUpdateCertificateCommand>({
    id: 'updateCertificateId',
    type: 'update-certificate',
    certificateId: 'certificateId',
    commandContent: {} as CertificateCommandDTO
  });
  const deleteCertificateCommand = buildCommand<OIBusDeleteCertificateCommand>({
    id: 'deleteCertificateId',
    type: 'delete-certificate',
    certificateId: 'certificateId'
  });
  const createCustomTransformerCommand = buildCommand<OIBusCreateCustomTransformerCommand>({
    id: 'createCustomTransformerId',
    type: 'create-custom-transformer',
    commandContent: testData.transformers.command
  });
  const updateCustomTransformerCommand = buildCommand<OIBusUpdateCustomTransformerCommand>({
    id: 'updateCustomTransformerId',
    type: 'update-custom-transformer',
    transformerId: 'transformerId1',
    commandContent: testData.transformers.command
  });
  const deleteCustomTransformerCommand = buildCommand<OIBusDeleteCustomTransformerCommand>({
    id: 'deleteCustomTransformerId',
    type: 'delete-custom-transformer',
    transformerId: 'transformerId1'
  });
  const transformerTestRequest = { inputData: 'raw', options: {} };
  const transformerTestResult = { output: 'result', metadata: {} };
  const testCustomTransformerCommand = buildCommand<OIBusTestCustomTransformerCommand>({
    id: 'testCustomTransformerId',
    type: 'test-custom-transformer',
    commandContent: { command: testData.transformers.command, testRequest: transformerTestRequest }
  });
  const testTransformerCommand = (id: string, options?: object) =>
    buildCommand<OIBusTestTransformerCommand>({
      id,
      type: 'test-transformer',
      transformerId: 'transformerId',
      commandContent: options ? { inputData: 'pasted content', options } : { inputData: 'pasted content' }
    });
  const testSouthConnectionCommand = buildCommand<OIBusTestSouthConnectorCommand>({
    id: 'testSouthConnectorId',
    type: 'test-south-connection',
    southConnectorId: 'southConnectorId',
    commandContent: testData.south.command
  });
  const testNorthConnectionCommand = buildCommand<OIBusTestNorthConnectorCommand>({
    id: 'testNorthConnectorId',
    type: 'test-north-connection',
    northConnectorId: 'northConnectorId',
    commandContent: testData.north.command
  });
  const createHistoryQueryCommand = buildCommand<OIBusCreateHistoryQueryCommand>({
    id: 'createHistoryQueryId',
    type: 'create-history-query',
    northConnectorId: undefined,
    southConnectorId: undefined,
    historyQueryId: undefined,
    commandContent: testData.historyQueries.command
  });
  const updateHistoryQueryCommand = buildCommand<OIBusUpdateHistoryQueryCommand>({
    id: 'updateHistoryQueryId',
    type: 'update-history-query',
    historyQueryId: 'h1',
    commandContent: { resetCache: false, historyQuery: testData.historyQueries.command }
  });
  const deleteHistoryQueryCommand = buildCommand<OIBusDeleteHistoryQueryCommand>({
    id: 'deleteHistoryQueryId',
    type: 'delete-history-query',
    historyQueryId: 'h1'
  });
  const testHistoryNorthConnectionCommand = buildCommand<OIBusTestHistoryQueryNorthConnectionCommand>({
    id: 'testHistoryNorthConnectorId',
    type: 'test-history-query-north-connection',
    northConnectorId: 'northConnectorId',
    historyQueryId: 'historyId',
    commandContent: testData.historyQueries.command
  });
  const testHistorySouthConnectionCommand = buildCommand<OIBusTestHistoryQuerySouthConnectionCommand>({
    id: 'testHistorySouthConnectorId',
    type: 'test-history-query-south-connection',
    southConnectorId: 'southConnectorId',
    historyQueryId: 'historyId',
    commandContent: testData.historyQueries.command
  });
  const scanModeCommand = (base: OIBusCreateScanModeCommand | OIBusUpdateScanModeCommand, commandContent: Partial<ScanModeCommandDTO>) => ({
    ...base,
    commandContent: commandContent as ScanModeCommandDTO
  });
  const explicitCronScanMode: ScanModeCommandDTO = {
    name: 'my scan mode',
    description: 'a scan mode',
    type: 'cron',
    cron: '0 0 * * * *',
    interval: null,
    activationWindow: null
  };

  return [
    // engine
    {
      command: updateEngineGeneralCommand,
      calls: () => oIBusService.updateEngineName.mock.calls,
      args: [updateEngineGeneralCommand.commandContent, 'oianalytics'],
      result: 'Engine name updated successfully'
    },
    {
      command: updateEngineWebServerCommand,
      calls: () => oIBusService.updateEngineWebServer.mock.calls,
      args: [testData.engine.webServerCommand, 'oianalytics'],
      result: 'Engine web server settings updated successfully'
    },
    {
      command: updateEngineProxyCommand,
      calls: () => oIBusService.updateEngineProxy.mock.calls,
      args: [testData.engine.proxyCommand, 'oianalytics'],
      result: 'Engine proxy settings updated successfully'
    },
    {
      command: updateEngineLoggerCommand,
      calls: () => oIBusService.updateEngineLogger.mock.calls,
      args: [testData.engine.loggerCommand, 'oianalytics'],
      result: 'Engine logger settings updated successfully'
    },
    // scan modes
    {
      command: createScanModeCommand,
      calls: () => scanModeService.create.mock.calls,
      args: [createScanModeCommand.commandContent, 'oianalytics'],
      result: 'Scan mode created successfully'
    },
    {
      title: 'should execute create-scan-mode command with old-style payload missing type, cron, interval and activationWindow',
      command: scanModeCommand(createScanModeCommand, { name: 'my new scan mode', description: 'another scan mode' }),
      calls: () => scanModeService.create.mock.calls,
      args: [
        { name: 'my new scan mode', description: 'another scan mode', type: 'cron', cron: '', interval: null, activationWindow: null },
        'oianalytics'
      ],
      result: 'Scan mode created successfully'
    },
    {
      title: 'should execute create-scan-mode command with new-style interval payload, defaulting only the missing cron',
      command: scanModeCommand(createScanModeCommand, {
        name: 'my new interval scan mode',
        description: 'an interval scan mode',
        type: 'interval',
        interval: { value: 30, unit: 's' },
        activationWindow: { dateRange: { start: '2026-08-01T00:00:00.000Z', end: null } }
      }),
      calls: () => scanModeService.create.mock.calls,
      args: [
        {
          name: 'my new interval scan mode',
          description: 'an interval scan mode',
          type: 'interval',
          cron: '',
          interval: { value: 30, unit: 's' },
          activationWindow: { dateRange: { start: '2026-08-01T00:00:00.000Z', end: null } }
        },
        'oianalytics'
      ],
      result: 'Scan mode created successfully'
    },
    {
      command: updateScanModeCommand,
      calls: () => scanModeService.update.mock.calls,
      args: [updateScanModeCommand.scanModeId, updateScanModeCommand.commandContent, 'oianalytics'],
      result: 'Scan mode updated successfully'
    },
    {
      title: 'should execute update-scan-mode command with old-style payload missing type, cron, interval and activationWindow',
      command: scanModeCommand(updateScanModeCommand, { name: 'my scan mode', description: 'a scan mode' }),
      calls: () => scanModeService.update.mock.calls,
      args: [
        updateScanModeCommand.scanModeId,
        { name: 'my scan mode', description: 'a scan mode', type: 'cron', cron: '', interval: null, activationWindow: null },
        'oianalytics'
      ],
      result: 'Scan mode updated successfully'
    },
    {
      title: 'should execute update-scan-mode command keeping an explicit cron and not defaulting already-present fields',
      command: scanModeCommand(updateScanModeCommand, explicitCronScanMode),
      calls: () => scanModeService.update.mock.calls,
      args: [updateScanModeCommand.scanModeId, { ...explicitCronScanMode }, 'oianalytics'],
      result: 'Scan mode updated successfully'
    },
    {
      command: deleteScanModeCommand,
      calls: () => scanModeService.delete.mock.calls,
      args: [deleteScanModeCommand.scanModeId, 'oianalytics'],
      result: 'Scan mode deleted successfully'
    },
    // IP filters
    {
      command: createIpFilterCommand,
      calls: () => ipFilterService.create.mock.calls,
      args: [createIpFilterCommand.commandContent, 'oianalytics'],
      result: 'IP Filter created successfully'
    },
    {
      command: updateIpFilterCommand,
      calls: () => ipFilterService.update.mock.calls,
      args: ['ipFilterId', updateIpFilterCommand.commandContent, 'oianalytics'],
      result: 'IP Filter updated successfully'
    },
    {
      command: deleteIpFilterCommand,
      calls: () => ipFilterService.delete.mock.calls,
      args: ['ipFilterId', 'oianalytics'],
      result: 'IP Filter deleted successfully'
    },
    // certificates
    {
      command: createCertificateCommand,
      calls: () => certificateService.create.mock.calls,
      args: [createCertificateCommand.commandContent, 'oianalytics'],
      result: 'Certificate created successfully'
    },
    {
      command: updateCertificateCommand,
      calls: () => certificateService.update.mock.calls,
      args: ['certificateId', updateCertificateCommand.commandContent, 'oianalytics'],
      result: 'Certificate updated successfully'
    },
    {
      command: deleteCertificateCommand,
      calls: () => certificateService.delete.mock.calls,
      args: ['certificateId', 'oianalytics'],
      result: 'Certificate deleted successfully'
    },
    // custom transformers
    {
      command: createCustomTransformerCommand,
      calls: () => transformerService.create.mock.calls,
      args: [testData.transformers.command, 'oianalytics'],
      result: 'Transformer created successfully'
    },
    {
      command: updateCustomTransformerCommand,
      calls: () => transformerService.update.mock.calls,
      args: ['transformerId1', testData.transformers.command, 'oianalytics'],
      result: 'Transformer updated successfully'
    },
    {
      command: deleteCustomTransformerCommand,
      calls: () => transformerService.delete.mock.calls,
      args: ['transformerId1', 'oianalytics'],
      result: 'Transformer deleted successfully'
    },
    {
      command: testCustomTransformerCommand,
      setup: () => transformerService.test.mock.mockImplementationOnce(async () => transformerTestResult as never),
      calls: () => transformerService.test.mock.calls,
      args: [testData.transformers.command, transformerTestRequest],
      result: JSON.stringify(transformerTestResult)
    },
    {
      title: 'should execute test-transformer command with pasted input data using no explicit options',
      command: testTransformerCommand('testTransformerNoOptionsId'),
      setup: () => transformerService.testTransformer.mock.mockImplementationOnce(async () => itemTestResult),
      calls: () => transformerService.testTransformer.mock.calls,
      args: ['transformerId', {}, 'pasted content'],
      result: completedItemTest
    },
    {
      title: 'should execute test-transformer command with pasted input data, keeping both raw and transformed',
      command: testTransformerCommand('testTransformerPasteId', {}),
      setup: () => transformerService.testTransformer.mock.mockImplementationOnce(async () => itemTestResult),
      calls: () => transformerService.testTransformer.mock.calls,
      args: ['transformerId', {}, 'pasted content'],
      result: completedItemTest
    },
    {
      title: 'should execute test-transformer command with a south item, keeping both raw and transformed',
      command: testTransformerWithItemCommand,
      setup: () => southService.testItem.mock.mockImplementationOnce(async () => itemTestResult),
      calls: () => southService.testItem.mock.calls,
      args: [
        'southConnectorId',
        testData.south.command.type,
        'Current',
        testData.south.command.settings,
        testData.south.itemCommand.settings,
        {}
      ],
      result: completedItemTest
    },
    {
      title: 'should execute test-transformer command with a south item that has no transformer configured, storing transformed: null',
      command: testTransformerWithItemCommand,
      setup: () => southService.testItem.mock.mockImplementationOnce(async () => itemTestResultWithoutTransformer),
      calls: () => southService.testItem.mock.calls,
      args: [
        'southConnectorId',
        testData.south.command.type,
        'Current',
        testData.south.command.settings,
        testData.south.itemCommand.settings,
        {}
      ],
      result: completedItemTestWithoutTransformer
    },
    // south connectors
    {
      command: createSouthCommand,
      calls: () => southService.create.mock.calls,
      args: [createSouthCommand.commandContent, null, 'oianalytics'],
      result: 'South connector created successfully'
    },
    {
      command: updateSouthCommand,
      calls: () => southService.update.mock.calls,
      args: [updateSouthCommand.southConnectorId, updateSouthCommand.commandContent, 'oianalytics'],
      result: 'South connector updated successfully'
    },
    {
      command: deleteSouthCommand,
      calls: () => southService.delete.mock.calls,
      args: [deleteSouthCommand.southConnectorId, 'oianalytics'],
      result: 'South connector deleted successfully'
    },
    {
      title: 'should execute south-connection-test command',
      command: testSouthConnectionCommand,
      setup: () => southService.testSouth.mock.mockImplementationOnce(async () => ({ items: [] })),
      calls: () => southService.testSouth.mock.calls,
      args: ['southConnectorId', testData.south.command.type, testData.south.command.settings],
      result: JSON.stringify({ items: [] })
    },
    {
      title: 'should execute south-item-test command',
      command: testSouthItemCommand,
      setup: () => southService.testItem.mock.mockImplementationOnce(async () => itemTestResult),
      calls: () => southService.testItem.mock.calls,
      args: [
        'southConnectorId',
        testData.south.command.type,
        testData.south.itemCommand.name,
        testData.south.command.settings,
        testData.south.itemCommand.settings,
        {}
      ],
      result: completedItemTest
    },
    {
      title: 'should execute south-item-test command and store transformed: null when there is no transformer',
      command: testSouthItemCommand,
      setup: () => southService.testItem.mock.mockImplementationOnce(async () => itemTestResultWithoutTransformer),
      calls: () => southService.testItem.mock.calls,
      args: [
        'southConnectorId',
        testData.south.command.type,
        testData.south.itemCommand.name,
        testData.south.command.settings,
        testData.south.itemCommand.settings,
        {}
      ],
      result: completedItemTestWithoutTransformer
    },
    // north connectors
    {
      command: createNorthCommand,
      calls: () => northService.create.mock.calls,
      args: [createNorthCommand.commandContent, null, 'oianalytics'],
      result: 'North connector created successfully'
    },
    {
      command: updateNorthCommand,
      calls: () => northService.update.mock.calls,
      args: [updateNorthCommand.northConnectorId, updateNorthCommand.commandContent, 'oianalytics'],
      result: 'North connector updated successfully'
    },
    {
      command: deleteNorthCommand,
      calls: () => northService.delete.mock.calls,
      args: [deleteNorthCommand.northConnectorId, 'oianalytics'],
      result: 'North connector deleted successfully'
    },
    {
      title: 'should execute north-connection-test command',
      command: testNorthConnectionCommand,
      setup: () => northService.testNorth.mock.mockImplementationOnce(async () => ({ items: [] })),
      calls: () => northService.testNorth.mock.calls,
      args: ['northConnectorId', testData.north.command.type, testData.north.command.settings],
      result: JSON.stringify({ items: [] })
    },
    // history queries
    {
      command: createHistoryQueryCommand,
      calls: () => historyQueryService.create.mock.calls,
      args: [testData.historyQueries.command, undefined, undefined, undefined, 'oianalytics'],
      result: 'History query created successfully'
    },
    {
      command: updateHistoryQueryCommand,
      calls: () => historyQueryService.update.mock.calls,
      args: ['h1', testData.historyQueries.command, false, 'oianalytics'],
      result: 'History query updated successfully'
    },
    {
      command: deleteHistoryQueryCommand,
      calls: () => historyQueryService.delete.mock.calls,
      args: ['h1', 'oianalytics'],
      result: 'History query deleted successfully'
    },
    {
      command: testHistoryNorthConnectionCommand,
      setup: () => historyQueryService.testNorth.mock.mockImplementationOnce(async () => ({ items: [] })),
      calls: () => historyQueryService.testNorth.mock.calls,
      args: ['historyId', testData.historyQueries.command.northType, 'northConnectorId', testData.historyQueries.command.northSettings],
      result: JSON.stringify({ items: [] })
    },
    {
      command: testHistorySouthConnectionCommand,
      setup: () => historyQueryService.testSouth.mock.mockImplementationOnce(async () => ({ items: [] })),
      calls: () => historyQueryService.testSouth.mock.calls,
      args: ['historyId', testData.historyQueries.command.southType, 'southConnectorId', testData.historyQueries.command.southSettings],
      result: JSON.stringify({ items: [] })
    },
    {
      command: testHistoryQuerySouthItemCommand,
      setup: () => historyQueryService.testItem.mock.mockImplementationOnce(async () => itemTestResult),
      calls: () => historyQueryService.testItem.mock.calls,
      args: [
        'historyId',
        testData.historyQueries.command.southType,
        testData.historyQueries.itemCommand.name,
        'southConnectorId',
        testData.historyQueries.command.southSettings,
        testData.historyQueries.itemCommand.settings,
        {}
      ],
      // History query item tests keep the full raw → transformer → output pipeline, same as south-item tests
      result: completedItemTest
    },
    {
      title: 'should execute test-history-query-south-item command and store transformed: null when there is no transformer',
      command: testHistoryQuerySouthItemCommand,
      setup: () => historyQueryService.testItem.mock.mockImplementationOnce(async () => itemTestResultWithoutTransformer),
      calls: () => historyQueryService.testItem.mock.calls,
      args: [
        'historyId',
        testData.historyQueries.command.southType,
        testData.historyQueries.itemCommand.name,
        'southConnectorId',
        testData.historyQueries.command.southSettings,
        testData.historyQueries.itemCommand.settings,
        {}
      ],
      result: completedItemTestWithoutTransformer
    },
    // caches
    {
      command: searchNorthCacheCommand,
      setup: () => oIBusService.searchCacheContent.mock.mockImplementationOnce(async () => cacheSearchResult),
      calls: () => oIBusService.searchCacheContent.mock.calls,
      args: ['north', 'northId1', cacheSearch],
      result: JSON.stringify(cacheSearchResult)
    },
    {
      command: searchHistoryCacheCommand,
      setup: () => oIBusService.searchCacheContent.mock.mockImplementationOnce(async () => cacheSearchResult),
      calls: () => oIBusService.searchCacheContent.mock.calls,
      args: ['history', 'historyId1', cacheSearch],
      result: JSON.stringify(cacheSearchResult)
    },
    {
      command: getNorthCacheFileCommand,
      setup: () => oIBusService.getFileFromCache.mock.mockImplementationOnce(async () => cacheFileContent),
      calls: () => oIBusService.getFileFromCache.mock.calls,
      args: ['north', 'northId1', 'cache', 'file.txt'],
      result: JSON.stringify(cacheFileContent)
    },
    {
      command: getHistoryCacheFileCommand,
      setup: () => oIBusService.getFileFromCache.mock.mockImplementationOnce(async () => cacheFileContent),
      calls: () => oIBusService.getFileFromCache.mock.calls,
      args: ['history', 'historyId1', 'error', 'file.txt'],
      result: JSON.stringify(cacheFileContent)
    },
    {
      command: updateNorthCacheCommand,
      calls: () => oIBusService.updateCacheContent.mock.calls,
      args: ['north', 'northId1', cacheUpdate],
      result: 'Cache updated successfully'
    },
    {
      command: updateHistoryCacheCommand,
      calls: () => oIBusService.updateCacheContent.mock.calls,
      args: ['history', 'historyId1', cacheUpdate],
      result: 'Cache updated successfully'
    }
  ];
};

describe('OIAnalytics Command Service', () => {
  beforeEach(() => {
    service = makeService();
  });

  it('should get an OIAnalytics command', () => {
    const result = service.findById(updateVersionCommand.id);

    assert.strictEqual(oIAnalyticsCommandRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.findById.mock.calls[0].arguments, [updateVersionCommand.id]);
    assert.deepStrictEqual(result, updateVersionCommand);
  });

  it('should throw an error when OIAnalytics command does not exist', () => {
    oIAnalyticsCommandRepository.findById.mock.mockImplementation(() => null);

    assert.throws(
      () => service.findById(updateVersionCommand.id),
      new NotFoundError(`OIAnalytics command "${updateVersionCommand.id}" not found`)
    );
    assert.deepStrictEqual(oIAnalyticsCommandRepository.findById.mock.calls[0].arguments, [updateVersionCommand.id]);
  });

  it('should complete the update version command when created after an update', () => {
    const updatedVersion = updateVersionCommand.commandContent.version.slice(1);
    assert.strictEqual(oIBusService.getEngineSettings.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.updateOIBusVersion.mock.calls[0].arguments, [
      updatedVersion,
      testData.engine.settings.launcherVersion
    ]);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[0].arguments, [
      updateVersionCommand.id,
      FAKE_NOW,
      `OIBus updated to version ${updatedVersion}, launcher updated to version ${testData.engine.settings.launcherVersion}`
    ]);
  });

  it('should properly start and stop service', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const refreshCommands = mock.method(service, 'refreshCommands', async () => undefined);

    await service.start();

    assert.strictEqual(refreshCommands.mock.calls.length, 1);
    assert.strictEqual(service['commandEvent'].listenerCount('next'), 1);

    // A registration update refreshes the commands right away, instead of waiting for the scheduled refresh
    service['refreshCommandsTimeout'] = setTimeout(() => null, 1000);
    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    await flushPromises();
    assert.strictEqual(refreshCommands.mock.calls.length, 2);
    assert.strictEqual(service['refreshCommandsTimeout'], null);

    service['refreshCommandsTimeout'] = setTimeout(() => null, 1000);
    service.stop();

    assert.strictEqual(service['refreshCommandsTimeout'], null);
    assert.strictEqual(service['commandEvent'].listenerCount('next'), 0);
    assert.deepStrictEqual(logged(logger.debug), ['Stopping OIAnalytics command service...', 'OIAnalytics command service stopped']);

    // Once stopped, a registration update does not refresh the commands anymore
    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    await flushPromises();
    assert.strictEqual(refreshCommands.mock.calls.length, 2);
  });

  it('should clear the pending refresh timeout and refresh again when registration is updated while running', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementation(() => []);
    mock.method(process, 'exit', () => undefined as never);
    mock.method(process, 'kill', () => true);

    await service.start();
    // start() -> refreshCommands() scheduled a refreshCommandsTimeout since registration is REGISTERED
    const refreshCommandsSpy = mock.method(service, 'refreshCommands', async () => undefined);

    oIAnalyticsRegistrationService.registrationEvent.emit('updated');
    await flushPromises();

    assert.strictEqual(refreshCommandsSpy.mock.calls.length, 1);

    await service.stop();
  });

  it('should do nothing when processing the next command while stopped', async () => {
    await service.stop();

    await service.processNextCommand();

    assert.strictEqual(oIAnalyticsCommandRepository.findFirstToExecute.mock.calls.length, 0);
  });

  it('should search commands', () => {
    const page = createPageFromArray(commands, 1, 25);
    oIAnalyticsCommandRepository.search.mock.mockImplementation(() => page);

    const result = service.search({ types: [], status: [], page: 0, ack: undefined, start: undefined, end: undefined });
    assert.deepStrictEqual(result, page);
  });

  it('should delete command', () => {
    service.delete(updateVersionCommand.id);
    assert.deepStrictEqual(oIAnalyticsCommandRepository.delete.mock.calls[0].arguments, [updateVersionCommand.id]);
  });

  it('should check commands', async () => {
    // Use fake timers so that setTimeout calls in refreshCommands are captured and never fire,
    // preventing async activity after the test ends.
    mock.timers.enable({ apis: ['setTimeout'] });

    service.acknowledgeCommands = mock.fn(async () => undefined);
    service.checkForCancelledCommands = mock.fn(async () => undefined);
    service.fetchNewCommands = mock.fn(async () => undefined);

    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementation(
      seq(
        () => testData.oIAnalytics.registration.completed,
        () => testData.oIAnalytics.registration.completed,
        () => testData.oIAnalytics.registration.pending
      )
    );

    service.refreshCommands();
    await service.refreshCommands();
    assert.ok(logged(logger.warn).some(message => message.startsWith('OIBus is already retrieving commands from OIAnalytics')));
    await service.refreshCommands();
    assert.ok(logged(logger.trace).includes("OIAnalytics not registered. OIBus won't retrieve commands"));

    await flushPromises();
    // Reset fake timers — discards all pending setTimeout callbacks without firing them
    mock.timers.reset();
  });

  it('should not refresh commands when service is stopped', async () => {
    service.stop();

    await service.refreshCommands();

    assert.strictEqual(oIAnalyticsRegistrationService.getRegistrationSettings.mock.calls.length, 0);
  });

  for (const [title, error, message] of [
    ['should fail to check commands and retry', new Error('retrieve command error'), 'retrieve command error'],
    [
      'should display proper error message on AggregateError in refreshCommands',
      new AggregateError([new Error('connect ECONNREFUSED 127.0.0.1:4200')], ''),
      'connect ECONNREFUSED 127.0.0.1:4200'
    ],
    [
      'should display proper error message for Error with cause in refreshCommands',
      Object.assign(new TypeError('fetch failed'), { cause: new AggregateError([new Error('connect ECONNREFUSED 127.0.0.1:4200')], '') }),
      'fetch failed: connect ECONNREFUSED 127.0.0.1:4200'
    ]
  ] as const) {
    it(title, async () => {
      service.fetchNewCommands = mock.fn(async () => {
        throw error;
      });
      service.checkForCancelledCommands = mock.fn(async () => undefined);
      const acknowledgeCommandsMock = mock.fn(async () => undefined);
      service.acknowledgeCommands = acknowledgeCommandsMock;

      await service.refreshCommands();

      assert.strictEqual(acknowledgeCommandsMock.mock.calls.length, 0);
      assert.ok(logged(logger.error).includes(message));
      // Cancel the retry timer to prevent async activity after test ends
      await service.stop();
    });
  }

  it('should send ack', async () => {
    await service.acknowledgeCommands(testData.oIAnalytics.registration.completed);

    assert.strictEqual(oIAnalyticsClient.updateCommandStatus.mock.calls.length, commands.length);
    assert.strictEqual(oIAnalyticsCommandRepository.markAsAcknowledged.mock.calls.length, commands.length);
    assert.ok(logged(logger.trace).includes(`Command ${updateVersionCommand.id} of type ${updateVersionCommand.type} acknowledged`));
  });

  it('should not send ack if no command to ack', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => []);
    await service.acknowledgeCommands(testData.oIAnalytics.registration.completed);

    assert.ok(logged(logger.trace).includes('No command to ack'));
  });

  it('should properly manage ack error', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [updateVersionCommand, updateEngineGeneralCommand]);
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

    await service.acknowledgeCommands(testData.oIAnalytics.registration.completed);

    assert.ok(
      logged(logger.error).includes(
        `Error while acknowledging command ${updateVersionCommand.id} of type ${updateVersionCommand.type}: error`
      )
    );
    assert.strictEqual(logger.error.mock.calls.length, 2);
    assert.deepStrictEqual(
      oIAnalyticsCommandRepository.markAsAcknowledged.mock.calls.map(call => call.arguments),
      [[updateEngineGeneralCommand.id]]
    );
  });

  it('should display proper error message on AggregateError in acknowledgeCommands', async () => {
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => [updateVersionCommand]);
    oIAnalyticsClient.updateCommandStatus.mock.mockImplementationOnce(async () => {
      throw new AggregateError([new Error('connect ECONNREFUSED 127.0.0.1:4200')], '');
    });

    await service.acknowledgeCommands(testData.oIAnalytics.registration.completed);

    assert.ok(
      logged(logger.error).includes(
        `Error while acknowledging command ${updateVersionCommand.id} of type ${updateVersionCommand.type}: connect ECONNREFUSED 127.0.0.1:4200`
      )
    );
    assert.strictEqual(oIAnalyticsCommandRepository.markAsAcknowledged.mock.calls.length, 0);
  });

  it('should check retrieved command', async () => {
    const cancelledCommands = testData.oIAnalytics.commands.oIAnalyticsList;
    oIAnalyticsClient.retrieveCancelledCommands.mock.mockImplementationOnce(async () => cancelledCommands);

    await service.checkForCancelledCommands(testData.oIAnalytics.registration.completed);

    assert.strictEqual(oIAnalyticsClient.retrieveCancelledCommands.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsCommandRepository.cancel.mock.calls.length, cancelledCommands.length);
    assert.ok(
      logged(logger.trace).includes(`${cancelledCommands.length} commands cancelled among the ${commands.length} pending commands`)
    );

    // error case
    oIAnalyticsClient.retrieveCancelledCommands.mock.mockImplementationOnce(async () => {
      throw new Error('error');
    });
    await assert.rejects(
      () => service.checkForCancelledCommands(testData.oIAnalytics.registration.completed),
      new Error('Error while checking PENDING commands status: error')
    );

    // empty case
    oIAnalyticsCommandRepository.list.mock.mockImplementationOnce(() => []);
    await service.checkForCancelledCommands(testData.oIAnalytics.registration.completed);
    assert.ok(logged(logger.trace).includes('No command retrieved to check'));
  });

  it('should check retrieved command and cancel nothing', async () => {
    oIAnalyticsClient.retrieveCancelledCommands.mock.mockImplementationOnce(async () => []);

    await service.checkForCancelledCommands(testData.oIAnalytics.registration.completed);

    assert.strictEqual(oIAnalyticsClient.retrieveCancelledCommands.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsCommandRepository.cancel.mock.calls.length, 0);
    assert.strictEqual(logger.trace.mock.calls.length, 0);
  });

  it('should retrieve commands', async () => {
    const pendingCommands = testData.oIAnalytics.commands.oIAnalyticsList;
    oIAnalyticsClient.retrievePendingCommands.mock.mockImplementationOnce(async () => pendingCommands);

    await service.fetchNewCommands(testData.oIAnalytics.registration.completed);

    assert.strictEqual(oIAnalyticsClient.retrievePendingCommands.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsCommandRepository.create.mock.calls.length, pendingCommands.length);
    assert.ok(logged(logger.trace).includes(`${pendingCommands.length} commands to add`));

    oIAnalyticsClient.retrievePendingCommands.mock.mockImplementationOnce(async () => {
      throw new Error('error');
    });
    await assert.rejects(
      () => service.fetchNewCommands(testData.oIAnalytics.registration.completed),
      new Error('Error while retrieving commands: error')
    );
  });

  it('should retrieve commands and do nothing', async () => {
    await service.fetchNewCommands(testData.oIAnalytics.registration.completed);

    assert.strictEqual(oIAnalyticsClient.retrievePendingCommands.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsCommandRepository.create.mock.calls.length, 0);
    assert.strictEqual(logger.trace.mock.calls.length, 0);
  });

  it('should execute update-version command without updating launcher', async () => {
    const exitMock = mock.method(process, 'exit', () => undefined as never);
    mock.method(fs, 'unlink', async () => undefined);
    mock.method(fs, 'writeFile', async () => undefined);

    await executeCommand(updateVersionCommand);

    assert.strictEqual(oIAnalyticsRegistrationService.getRegistrationSettings.mock.calls.length, 2);
    assert.ok(oIAnalyticsCommandRepository.findFirstToExecute.mock.calls.length > 0);
    assert.strictEqual(oIAnalyticsCommandRepository.markAsRunning.mock.calls.length, 1);
    assert.ok(oIBusService.getEngineSettings.mock.calls.length > 0);
    assert.strictEqual(oIAnalyticsClient.downloadFile.mock.calls.length, 1);
    assert.strictEqual(utilsExports.unzip.mock.calls.length, 1);
    assert.strictEqual(utilsExports.delay.mock.calls.length, 1);
    assert.strictEqual(exitMock.mock.calls.length, 1);
  });

  it('should execute update-version command with launcher update', async () => {
    oIAnalyticsCommandRepository.findFirstToExecute.mock.mockImplementation(() => launcherUpdateCommand);
    const killMock = mock.method(process, 'kill', () => true);
    const osTypeMock = mock.method(
      os,
      'type',
      seq(
        () => 'linux',
        () => 'Windows_NT'
      )
    );
    const renameMock = mock.method(fs, 'rename', async () => undefined);
    mock.method(fs, 'unlink', async () => undefined);
    mock.method(fs, 'writeFile', async () => undefined);
    mock.method(process, 'exit', () => undefined as never);
    const renamed = () => renameMock.mock.calls.map(call => call.arguments as Array<string>);

    await service.processNextCommand();

    assert.strictEqual(oIAnalyticsClient.downloadFile.mock.calls.length, 1);
    assert.strictEqual(utilsExports.unzip.mock.calls.length, 1);
    assert.strictEqual(renameMock.mock.calls.length, 2);
    assert.ok(renamed().some(([from, to]) => from.includes('oibus-launcher') && to.includes('oibus-launcher_backup')));
    assert.strictEqual(osTypeMock.mock.calls.length, 1);
    assert.strictEqual(killMock.mock.calls.length, 1);

    await service.processNextCommand();
    assert.ok(renamed().some(([from, to]) => from.includes('oibus-launcher.exe') && to.includes('oibus-launcher_backup.exe')));
  });

  it('should delete the zip file even when unzip fails', async () => {
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);
    utilsExports.unzip.mock.mockImplementationOnce(() => {
      throw new Error('unzip error');
    });

    await executeCommand(updateVersionCommand);

    assert.strictEqual(unlinkMock.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls.length, 1);
    assert.ok((oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments[1] as string).includes('unzip error'));
  });

  it('should clean the update directory and propagate the error when writeFile fails after unzip', async () => {
    mock.method(fs, 'unlink', async () => undefined);
    const rmMock = mock.method(fs, 'rm', async () => undefined);
    mock.method(fs, 'writeFile', async () => {
      throw new Error('disk full');
    });

    await executeCommand(updateVersionCommand);

    assert.strictEqual(rmMock.mock.calls.length, 1);
    assert.ok((rmMock.mock.calls[0].arguments[0] as string).endsWith('update'));
    assert.strictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls.length, 1);
    assert.ok((oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments[1] as string).includes('disk full'));
  });

  it('should restore the launcher backup and clean the update directory when the launcher swap fails', async () => {
    mock.method(fs, 'unlink', async () => undefined);
    const rmMock = mock.method(fs, 'rm', async () => undefined);
    mock.method(os, 'type', () => 'Linux');
    const renameMock = mock.method(
      fs,
      'rename',
      seq(
        async () => undefined,
        async () => {
          throw new Error('rename failed');
        },
        async () => undefined
      )
    );

    await executeCommand(launcherUpdateCommand);

    const renameArgs = renameMock.mock.calls.map(call => call.arguments as Array<string>);
    // First rename: current launcher → backup
    assert.ok(renameArgs[0][1].includes('oibus-launcher_backup'));
    // Second rename: update/launcher → launcher (throws)
    assert.ok(renameArgs[1][0].includes('update'));
    // Third rename: restores backup → current launcher
    assert.ok(renameArgs[2][0].includes('oibus-launcher_backup'));
    assert.ok(renameArgs[2][1].endsWith('oibus-launcher'));
    // Update directory cleaned up
    assert.strictEqual(rmMock.mock.calls.length, 1);
    assert.ok((rmMock.mock.calls[0].arguments[0] as string).endsWith('update'));
    // Error propagated
    assert.strictEqual(oIAnalyticsCommandRepository.markAsErrored.mock.calls.length, 1);
    assert.ok((oIAnalyticsCommandRepository.markAsErrored.mock.calls[0].arguments[1] as string).includes('rename failed'));
  });

  it('should not execute update-version command if a command is already being executed', async () => {
    oIAnalyticsCommandRepository.findFirstToExecute.mock.mockImplementationOnce(() => updateVersionCommand);
    mock.method(process, 'exit', () => undefined as never);
    // Mock fs operations so they resolve as microtasks rather than real I/O,
    // allowing service1's async chain to reach delay() before we explicitly resolve it.
    mock.method(fs, 'unlink', async () => undefined);
    mock.method(fs, 'writeFile', async () => undefined);
    // Use a manually-resolvable deferred promise: service1 stays blocked at delay()
    // during the assertion, then we drain the microtask queue to confirm it reached
    // delay(), resolve it, and let the in-flight call clean up without leaving a
    // dangling async handle that would stall the test runner.
    let resolveDelay!: () => void;
    utilsExports.delay.mock.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveDelay = resolve;
        })
    );

    service.processNextCommand();
    await service.processNextCommand();

    assert.ok(logged(logger.trace).includes('A command is already being executed'));

    // Drain all pending microtasks so service1's chain reaches delay() and resolveDelay is set.
    await flushPromises();
    // Let the in-flight processNextCommand finish cleanly.
    resolveDelay();
    await flushPromises();
  });

  it('should not execute a command if not registered', async () => {
    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementationOnce(() => ({
      ...testData.oIAnalytics.registration.completed,
      status: 'PENDING'
    }));

    await service.processNextCommand();

    assert.ok(logged(logger.trace).includes("OIAnalytics not registered. OIBus won't retrieve commands"));
  });

  it('should not execute a command if no command found', async () => {
    oIAnalyticsCommandRepository.findFirstToExecute.mock.mockImplementationOnce(() => null);

    await service.processNextCommand();

    assert.ok(logged(logger.trace).includes('No command to execute'));
  });

  for (const { title, command, setup, calls, args, result } of executionCases()) {
    it(title ?? `should execute ${command.type} command`, async () => {
      setup?.();

      await executeCommand(command);

      assert.deepStrictEqual(
        calls().map(call => call.arguments),
        [args]
      );
      assertCompleted(command, result);
      // only the logger command with a loki password decrypts a text with the private key
      assert.strictEqual(encryptionService.decryptTextWithPrivateKey.mock.calls.length, 0);
    });
  }

  it('should execute update-engine-logger command with loki password', async () => {
    const command = buildCommand<OIBusUpdateEngineLoggerCommand>({
      id: 'updateEngineLoggerId',
      type: 'update-engine-logger',
      commandContent: { ...testData.engine.loggerCommand, loki: { ...testData.engine.loggerCommand.loki, password: 'test' } }
    });

    await executeCommand(command);

    assert.deepStrictEqual(oIBusService.updateEngineLogger.mock.calls[0].arguments, [command.commandContent, 'oianalytics']);
    assert.strictEqual(encryptionService.decryptTextWithPrivateKey.mock.calls.length, 1);
    assertCompleted(command, 'Engine logger settings updated successfully');
  });

  it('should execute update-registration-settings command', async () => {
    await executeCommand(updateRegistrationCommand);

    assert.deepStrictEqual(
      oIAnalyticsRegistrationService.editRegistrationSettings.mock.calls.map(call => call.arguments),
      [[expectedRegistrationEdit(testData.oIAnalytics.registration.completed), 'oianalytics']]
    );
    assertCompleted(updateRegistrationCommand, 'Registration settings updated successfully');
  });

  it('should execute update-registration-settings command and not enabling permissions if disabled', async () => {
    const commandPermissions = { ...testData.oIAnalytics.registration.completed.commandPermissions };
    for (const permission of Object.keys(commandPermissions) as Array<keyof RegistrationCommandPermissions>) {
      commandPermissions[permission] = false;
    }
    const registration: OIAnalyticsRegistration = { ...testData.oIAnalytics.registration.completed, commandPermissions };

    // Call private method directly
    await service['executeUpdateRegistrationSettingsCommand'](updateRegistrationCommand, registration);

    assert.deepStrictEqual(
      oIAnalyticsRegistrationService.editRegistrationSettings.mock.calls.map(call => call.arguments),
      [[expectedRegistrationEdit(registration), 'oianalytics']]
    );
    assertCompleted(updateRegistrationCommand, 'Registration settings updated successfully');
  });

  it('should execute restart-engine command', async () => {
    const exitMock = mock.method(process, 'exit', () => undefined as never);

    await executeCommand(restartCommand);

    assertCompleted(restartCommand, 'OIBus restarted');
    assert.strictEqual(utilsExports.delay.mock.calls.length, 1);
    assert.strictEqual(exitMock.mock.calls.length, 1);
  });

  it('should execute regenerate-cipher-keys command', async () => {
    mock.method(crypto, 'generateKeyPairSync', () => ({ publicKey: 'public key', privateKey: 'private key' }));

    await executeCommand(regenerateCipherKeysCommand);

    assert.deepStrictEqual(oIAnalyticsRegistrationService.updateKeys.mock.calls[0].arguments, ['private key', 'public key', 'oianalytics']);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assertCompleted(regenerateCipherKeysCommand, 'OIAnalytics keys reloaded');
  });

  describe('import-configuration command', () => {
    const command = buildCommand<OIBusImportConfigurationCommand>({
      id: 'importConfigurationId',
      type: 'import-configuration',
      commandContent: { fileId: 'fileId' }
    });
    const configuration = { oibusVersion: '3.10.0', exportedAt: FAKE_NOW, config: {} };

    beforeEach(() => {
      oIAnalyticsCommandRepository.findFirstToExecute.mock.mockImplementationOnce(() => command);
      oIAnalyticsClient.retrieveConfigurationFile.mock.mockImplementationOnce(async () => JSON.stringify(configuration));
    });

    it('should import the configuration downloaded from OIAnalytics and restart', async () => {
      const exitMock = mock.method(process, 'exit', () => undefined as never);
      const result = {
        fromVersion: '3.9.0',
        toVersion: '3.10.0',
        appliedUpgrades: [],
        warnings: ['warning'],
        newPort: null,
        newProtocol: null
      };
      configImportService.importConfigurationFromOIAnalytics.mock.mockImplementationOnce(async () => result);

      await service.processNextCommand();

      assert.deepStrictEqual(oIAnalyticsClient.retrieveConfigurationFile.mock.calls[0].arguments, [
        testData.oIAnalytics.registration.completed,
        'fileId'
      ]);
      assert.deepStrictEqual(configImportService.importConfigurationFromOIAnalytics.mock.calls[0].arguments, [configuration]);
      assertCompleted(command, JSON.stringify(result));
      assert.strictEqual(utilsExports.delay.mock.calls.length, 1);
      assert.strictEqual(exitMock.mock.calls.length, 1);
    });

    it('should fail when the configuration file is not valid JSON', async () => {
      oIAnalyticsClient.retrieveConfigurationFile.mock.mockImplementationOnce(async () => 'not json', 0);

      await service.processNextCommand();

      assert.strictEqual(configImportService.importConfigurationFromOIAnalytics.mock.calls.length, 0);
      assertErrored(command, 'Configuration file fileId is not valid JSON');
    });

    it('should report the validation errors of the configuration', async () => {
      configImportService.importConfigurationFromOIAnalytics.mock.mockImplementationOnce(async () => {
        throw new ConfigImportError('Configuration is invalid', [
          { scope: 'south', entityName: 'MySouth', message: 'host is required' },
          { scope: 'engine', message: 'port is required' }
        ]);
      });

      await service.processNextCommand();

      assertErrored(command, 'Configuration is invalid\n- south "MySouth": host is required\n- engine: port is required');
    });

    it('should report the error of an import without validation errors', async () => {
      configImportService.importConfigurationFromOIAnalytics.mock.mockImplementationOnce(async () => {
        throw new ConfigImportError('Export from a newer OIBus');
      });

      await service.processNextCommand();

      assertErrored(command, 'Export from a newer OIBus');
    });

    it('should not import the configuration without permission', async () => {
      withoutPermission('importConfiguration');

      await service.processNextCommand();

      assert.strictEqual(oIAnalyticsClient.retrieveConfigurationFile.mock.calls.length, 0);
      assertErrored(command, `Command ${command.id} of type ${command.type} is not authorized`);
    });
  });

  describe('commands uploading a file', () => {
    const dumpMemoryCommand = buildCommand<OIBusDumpMemoryCommand>({ id: 'dumpMemoryId', type: 'dump-memory' });
    const retrieveLogsDatabaseCommand = buildCommand<OIBusRetrieveLogsDatabaseCommand>({
      id: 'retrieveLogsDatabaseId',
      type: 'retrieve-logs-database'
    });
    const engineName = realUtils.sanitizeFilename(testData.engine.settings.general.name);
    const mockHeapSnapshot = () =>
      mock.method(v8, 'writeHeapSnapshot', (filePath: string) => {
        writeFileSync(filePath, 'heap snapshot');
        return filePath;
      });

    beforeEach(async () => {
      await fs.mkdir(TEST_FOLDER, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(TEST_FOLDER, { recursive: true, force: true });
    });

    it('should upload a zipped memory dump', async () => {
      const writeHeapSnapshot = mockHeapSnapshot();

      await executeCommand(dumpMemoryCommand);

      const filename = `heapdump-${engineName}-2021_01_02_00_00_00.zip`;
      const [snapshotPath, entryName, zipPath] = utilsExports.zipFile.mock.calls[0].arguments;
      assert.deepStrictEqual(writeHeapSnapshot.mock.calls[0].arguments, [snapshotPath]);
      assert.strictEqual(entryName, `heapdump-${engineName}-2021_01_02_00_00_00.heapsnapshot`);
      assert.strictEqual(path.basename(zipPath), filename);
      assert.deepStrictEqual(oIAnalyticsClient.uploadCommandFile.mock.calls[0].arguments, [
        testData.oIAnalytics.registration.completed,
        dumpMemoryCommand.id,
        zipPath,
        filename
      ]);
      assertCompleted(
        dumpMemoryCommand,
        JSON.stringify({ fileId: 'fileId', filename, compressedSize: 'zip'.length, uncompressedSize: 'heap snapshot'.length })
      );
      assert.deepStrictEqual(await fs.readdir(TMP_FOLDER), [], 'temporary files removed');
    });

    it('should upload a zipped copy of the logs database', async () => {
      const logsDatabase = new Database(LOGS_DATABASE_PATH);
      logsDatabase.exec(`CREATE TABLE logs (message TEXT); INSERT INTO logs VALUES ('log message');`);
      logsDatabase.close();
      let copiedLogs: unknown;
      utilsExports.zipFile.mock.mockImplementationOnce(async (input, _entryName, output) => {
        const copy = new Database(input, { readonly: true });
        copiedLogs = copy.prepare('SELECT message FROM logs').all();
        copy.close();
        await fs.writeFile(output, 'zip');
      });

      await executeCommand(retrieveLogsDatabaseCommand);

      const filename = `logs-${engineName}-2021_01_02_00_00_00.zip`;
      assert.deepStrictEqual(copiedLogs, [{ message: 'log message' }]);
      assert.strictEqual(utilsExports.zipFile.mock.calls[0].arguments[1], 'logs.db');
      assert.strictEqual(oIAnalyticsClient.uploadCommandFile.mock.calls[0].arguments[3], filename);
      const result = JSON.parse(oIAnalyticsCommandRepository.markAsCompleted.mock.calls[1].arguments[2] as string);
      assert.strictEqual(result.fileId, 'fileId');
      assert.strictEqual(result.filename, filename);
      assert.strictEqual(result.compressedSize, 'zip'.length);
      assert.ok(result.uncompressedSize > 0);
      assert.deepStrictEqual(await fs.readdir(TMP_FOLDER), [], 'temporary files removed');
    });

    it('should remove the temporary files when the upload fails', async () => {
      mockHeapSnapshot();
      oIAnalyticsClient.uploadCommandFile.mock.mockImplementationOnce(async () => {
        throw new Error('413 - Payload Too Large');
      });

      await executeCommand(dumpMemoryCommand);

      assertErrored(dumpMemoryCommand, '413 - Payload Too Large');
      assert.deepStrictEqual(await fs.readdir(TMP_FOLDER), []);
    });

    for (const [command, permission] of [
      [dumpMemoryCommand, 'dumpMemory'],
      [retrieveLogsDatabaseCommand, 'retrieveLogsDatabase']
    ] as const) {
      it(`should not execute ${command.type} command without permission`, async () => {
        withoutPermission(permission);

        await executeCommand(command);

        assert.strictEqual(oIAnalyticsClient.uploadCommandFile.mock.calls.length, 0);
        assertErrored(command, `Command ${command.id} of type ${command.type} is not authorized`);
      });
    }
  });

  describe('create-or-update-south-items-from-csv command', () => {
    const southConnector = testData.south.list[0];
    const itemDTOs = southConnector.items.map(item =>
      toSouthConnectorItemDTO(item, southConnector.type, getUserInfo)
    ) as Array<SouthConnectorItemDTO>;

    it('should execute create-or-update-south-items-from-csv command', async () => {
      southService.findById.mock.mockImplementationOnce(() => southConnector);
      southService.checkImportItems.mock.mockImplementationOnce(async () => ({ items: itemDTOs, errors: [] }));

      await executeCommand(southItemsFromCsvCommand);

      assert.deepStrictEqual(southService.findById.mock.calls[0].arguments, [southItemsFromCsvCommand.southConnectorId]);
      assert.deepStrictEqual(southService.checkImportItems.mock.calls[0].arguments, [
        southConnector.type,
        southItemsFromCsvCommand.commandContent.csvContent,
        southItemsFromCsvCommand.commandContent.delimiter,
        itemDTOs
      ]);
      assertCompleted(southItemsFromCsvCommand, `2 items imported on South connector ${southConnector.name}`);
    });

    it('should execute create-or-update-south-items-from-csv command and throw an error if south not found', async () => {
      southService.findById.mock.mockImplementationOnce(southId => {
        throw new Error(`South connector ${southId} not found`);
      });

      await executeCommand(southItemsFromCsvCommand);

      assertErrored(southItemsFromCsvCommand, `South connector ${southItemsFromCsvCommand.southConnectorId} not found`);
    });

    it('should execute create-or-update-south-items-from-csv command and error when south connector resolves to a falsy value', async () => {
      southService.findById.mock.mockImplementationOnce(() => null as never);

      await executeCommand(southItemsFromCsvCommand);

      assertErrored(southItemsFromCsvCommand, `South connector ${southItemsFromCsvCommand.southConnectorId} not found`);
      assert.strictEqual(southService.checkImportItems.mock.calls.length, 0);
    });

    it('should execute create-or-update-south-items-from-csv command with an item that has no scan mode', async () => {
      southService.findById.mock.mockImplementationOnce(() => southConnector);
      const itemWithoutScanMode = { ...itemDTOs[0], scanMode: null } as unknown as SouthConnectorItemDTO;
      southService.checkImportItems.mock.mockImplementationOnce(async () => ({ items: [itemWithoutScanMode], errors: [] }));

      await executeCommand(southItemsFromCsvCommand);

      assert.deepStrictEqual(southService.importItems.mock.calls[0].arguments[1], [
        {
          id: itemWithoutScanMode.id,
          enabled: itemWithoutScanMode.enabled,
          name: itemWithoutScanMode.name,
          settings: itemWithoutScanMode.settings,
          scanModeId: null,
          scanModeName: null,
          groupId: null,
          groupName: null,
          syncWithGroup: itemWithoutScanMode.syncWithGroup,
          maxReadInterval: itemWithoutScanMode.maxReadInterval,
          readDelay: itemWithoutScanMode.readDelay,
          startTimeOffset: itemWithoutScanMode.startTimeOffset,
          endTimeOffset: itemWithoutScanMode.endTimeOffset,
          recoveryStrategy: itemWithoutScanMode.recoveryStrategy
        }
      ]);
    });

    it('should execute create-or-update-south-items-from-csv command and keep the group and history settings of items', async () => {
      southService.findById.mock.mockImplementationOnce(() => southConnector);
      const [itemWithScanMode, itemInGroup] = itemDTOs;
      // checkImportItems only knows the group name of an item, and an item of a group may have no scan mode of its own
      southService.checkImportItems.mock.mockImplementationOnce(async () => ({
        items: [
          { ...itemWithScanMode, maxReadInterval: 3600, readDelay: 200, startTimeOffset: 10, endTimeOffset: 5, recoveryStrategy: 'oldest' },
          {
            ...itemInGroup,
            scanMode: null,
            group: { id: '', standardSettings: { name: 'group1' } } as SouthItemGroupDTO,
            syncWithGroup: true
          }
        ] as Array<SouthConnectorItemDTO>,
        errors: []
      }));

      await executeCommand(southItemsFromCsvCommand);

      assert.deepStrictEqual(southService.importItems.mock.calls[0].arguments, [
        southConnector.id,
        [
          {
            id: itemWithScanMode.id,
            enabled: itemWithScanMode.enabled,
            name: itemWithScanMode.name,
            settings: itemWithScanMode.settings,
            scanModeId: itemWithScanMode.scanMode!.id,
            scanModeName: null,
            groupId: null,
            groupName: null,
            syncWithGroup: false,
            maxReadInterval: 3600,
            readDelay: 200,
            startTimeOffset: 10,
            endTimeOffset: 5,
            recoveryStrategy: 'oldest'
          },
          {
            id: itemInGroup.id,
            enabled: itemInGroup.enabled,
            name: itemInGroup.name,
            settings: itemInGroup.settings,
            scanModeId: null,
            scanModeName: null,
            groupId: null,
            groupName: 'group1',
            syncWithGroup: true,
            maxReadInterval: itemInGroup.maxReadInterval,
            readDelay: itemInGroup.readDelay,
            startTimeOffset: itemInGroup.startTimeOffset,
            endTimeOffset: itemInGroup.endTimeOffset,
            recoveryStrategy: itemInGroup.recoveryStrategy
          }
        ],
        'oianalytics',
        false
      ]);
    });

    it('should execute create-or-update-south-items-from-csv command with item errors', async () => {
      const command: OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand = {
        ...southItemsFromCsvCommand,
        commandContent: { ...southItemsFromCsvCommand.commandContent, deleteItemsNotPresent: true }
      };
      southService.findById.mock.mockImplementationOnce(() => southConnector);
      southService.checkImportItems.mock.mockImplementationOnce(async () => ({
        items: itemDTOs,
        errors: [
          { item: { name: 'item1' }, error: 'error1' },
          { item: { name: 'item2' }, error: 'error2' }
        ]
      }));

      await executeCommand(command);

      assert.deepStrictEqual(southService.checkImportItems.mock.calls[0].arguments, [
        southConnector.type,
        command.commandContent.csvContent,
        command.commandContent.delimiter,
        []
      ]);
      assertErrored(command, `Error when checking csv items:\nitem1: error1\nitem2: error2`);
    });
  });

  describe('create-or-update-history-query-south-items-from-csv command', () => {
    const historyQuery = testData.historyQueries.list[0];
    const itemDTOs = historyQuery.items.map(item =>
      toHistoryQueryItemDTO(item, historyQuery.southType, getUserInfo)
    ) as Array<HistoryQueryItemDTO>;

    it('should execute create-or-update-history-query-south-items-from-csv command', async () => {
      historyQueryService.findById.mock.mockImplementationOnce(() => historyQuery);
      historyQueryService.checkImportItems.mock.mockImplementationOnce(async () => ({ items: itemDTOs, errors: [] }));

      await executeCommand(historyItemsFromCsvCommand);

      assert.deepStrictEqual(historyQueryService.findById.mock.calls[0].arguments, ['h1']);
      assert.deepStrictEqual(historyQueryService.checkImportItems.mock.calls[0].arguments, [
        historyQuery.southType,
        '',
        ',',
        historyQuery.items.map(item => ({
          ...item,
          updatedBy: { id: '', friendlyName: '' },
          createdBy: { id: '', friendlyName: '' }
        }))
      ]);
      assertCompleted(historyItemsFromCsvCommand, `2 items imported on History query ${historyQuery.name}`);
    });

    it('should execute create-or-update-history-query-south-items-from-csv command and throw an error if history not found', async () => {
      historyQueryService.findById.mock.mockImplementationOnce(historyId => {
        throw new Error(`History query ${historyId} not found`);
      });

      await executeCommand(historyItemsFromCsvCommand);

      assertErrored(historyItemsFromCsvCommand, 'History query h1 not found');
    });

    it('should execute create-or-update-history-query-south-items-from-csv command and error when history query resolves to a falsy value', async () => {
      historyQueryService.findById.mock.mockImplementationOnce(() => null as never);

      await executeCommand(historyItemsFromCsvCommand);

      assertErrored(historyItemsFromCsvCommand, 'History query h1 not found');
      assert.strictEqual(historyQueryService.checkImportItems.mock.calls.length, 0);
    });

    it('should execute create-or-update-history-query-south-items-from-csv command with item error', async () => {
      const command: OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommand = {
        ...historyItemsFromCsvCommand,
        commandContent: { ...historyItemsFromCsvCommand.commandContent, deleteItemsNotPresent: true }
      };
      historyQueryService.findById.mock.mockImplementationOnce(() => historyQuery);
      historyQueryService.checkImportItems.mock.mockImplementationOnce(async () => ({
        items: itemDTOs,
        errors: [
          { item: { name: 'item1' }, error: 'error1' },
          { item: { name: 'item2' }, error: 'error2' }
        ]
      }));

      await executeCommand(command);

      assert.deepStrictEqual(historyQueryService.checkImportItems.mock.calls[0].arguments, [historyQuery.southType, '', ',', []]);
      assertErrored(command, `Error when checking csv items:\nitem1: error1\nitem2: error2`);
    });
  });

  it('should catch error when execution fails', async () => {
    northService.create.mock.mockImplementationOnce(async () => {
      throw new Error('command execution error');
    });

    await executeCommand(createNorthCommand);

    assert.ok(
      logged(logger.error).includes(
        `Error while executing command ${createNorthCommand.id} (retrieved ${createNorthCommand.retrievedDate}) of type ${createNorthCommand.type}. Error: command execution error`
      )
    );
    assertErrored(createNorthCommand, 'command execution error');
  });

  it('should display proper error message on AggregateError during command execution', async () => {
    northService.create.mock.mockImplementationOnce(async () => {
      throw new AggregateError([new Error('connect ECONNREFUSED 127.0.0.1:4200')], '');
    });

    await executeCommand(createNorthCommand);

    assert.ok(
      logged(logger.error).includes(
        `Error while executing command ${createNorthCommand.id} (retrieved ${createNorthCommand.retrievedDate}) of type ${createNorthCommand.type}. Error: connect ECONNREFUSED 127.0.0.1:4200`
      )
    );
    assertErrored(createNorthCommand, 'connect ECONNREFUSED 127.0.0.1:4200');
  });

  it('should display proper error message on AggregateError in sendPendingAcks', async () => {
    // Run a command successfully so it gets enqueued for ack, then fail the ack with AggregateError
    oIAnalyticsClient.updateCommandStatus.mock.mockImplementationOnce(async () => {
      throw new AggregateError([new Error('connect ECONNREFUSED 127.0.0.1:4200')], '');
    });

    await executeCommand(updateEngineGeneralCommand);

    assert.ok(logged(logger.error).some(message => message.includes('connect ECONNREFUSED 127.0.0.1:4200')));
    assert.strictEqual(oIAnalyticsCommandRepository.markAsAcknowledged.mock.calls.length, 0);
    // Cancel the scheduled retry to prevent async activity after the test ends
    await service.stop();
  });

  it('sendPendingAcks should do nothing when the service is stopped', async () => {
    service['ackQueue'].set(updateVersionCommand.id, updateVersionCommand);
    await service.stop();

    await service['sendPendingAcks']();

    assert.strictEqual(oIAnalyticsClient.updateCommandStatus.mock.calls.length, 0);
  });

  it('sendPendingAcks should do nothing when the ack queue is empty', async () => {
    await service['sendPendingAcks']();

    assert.strictEqual(oIAnalyticsRegistrationService.getRegistrationSettings.mock.calls.length, 0);
    assert.strictEqual(oIAnalyticsClient.updateCommandStatus.mock.calls.length, 0);
  });

  it('sendPendingAcks should keep the queue while OIAnalytics is not registered', async () => {
    service['ackQueue'].set(updateVersionCommand.id, updateVersionCommand);
    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementation(() => testData.oIAnalytics.registration.pending);

    await service['sendPendingAcks']();

    assert.strictEqual(oIAnalyticsClient.updateCommandStatus.mock.calls.length, 0);
    assert.strictEqual(service['ackQueue'].size, 1);
  });

  it('sendPendingAcks should drop queued commands that no longer exist locally', async () => {
    service['ackQueue'].set(updateVersionCommand.id, updateVersionCommand);
    oIAnalyticsCommandRepository.findById.mock.mockImplementation(() => null);

    await service['sendPendingAcks']();

    assert.strictEqual(oIAnalyticsClient.updateCommandStatus.mock.calls.length, 0);
    assert.strictEqual(service['ackQueue'].size, 0);
    assert.strictEqual(service['isAckFlushInProgress'], false);
  });

  it('sendPendingAcks should clear a pending retry timeout before flushing', async () => {
    service['ackQueue'].set(updateVersionCommand.id, updateVersionCommand);
    service['ackRetryTimeout'] = setTimeout(() => undefined, 100_000);

    await service['sendPendingAcks']();

    assert.strictEqual(service['ackRetryTimeout'], null);
    assert.strictEqual(oIAnalyticsClient.updateCommandStatus.mock.calls.length, 1);
  });

  it('sendPendingAcks should treat a 404 as already acknowledged and clear the queue', async () => {
    service['ackQueue'].set(updateVersionCommand.id, updateVersionCommand);
    oIAnalyticsClient.updateCommandStatus.mock.mockImplementationOnce(async () => {
      throw new Error('404 - not found');
    });

    await service['sendPendingAcks']();

    assert.deepStrictEqual(
      oIAnalyticsCommandRepository.markAsAcknowledged.mock.calls.map(call => call.arguments),
      [[updateVersionCommand.id]]
    );
    assert.strictEqual(service['ackQueue'].size, 0);
  });

  it('should not execute command if target version is not the same', async () => {
    oIBusService.getEngineSettings.mock.mockImplementationOnce(() => ({ ...testData.engine.settings, version: 'bad version' }));

    await executeCommand(createNorthCommand);

    assertErrored(createNorthCommand, `Wrong target version: ${createNorthCommand.targetVersion} for OIBus version bad version`);
  });

  for (const [title, command, permission] of [
    ['should not execute command if permission is not right', createNorthCommand, 'createNorth'],
    ['should not execute cache command if permission is not right', searchNorthCacheCommand, 'searchNorthCacheContent'],
    ['should not execute get-cache-file-content command if permission is not right', getNorthCacheFileCommand, 'getNorthCacheFileContent'],
    ['should not execute update-cache-content command if permission is not right', updateNorthCacheCommand, 'updateNorthCacheContent']
  ] as const) {
    it(title, async () => {
      withoutPermission(permission);

      await executeCommand(command);

      assertErrored(command, `Command ${command.id} of type ${command.type} is not authorized`);
    });
  }

  describe('withTimeout for test commands', () => {
    it('should mark command as errored and release the lock when the operation hangs past the timeout', async () => {
      mock.timers.enable({ apis: ['setTimeout'] });
      // Never-resolving promise simulates a hung MQTT / TCP connection
      southService.testItem.mock.mockImplementationOnce(
        () =>
          new Promise(() => {
            /* empty */
          })
      );

      const processPromise = executeCommand(testSouthItemCommand);
      // Let the async preamble (decryptText, listManifest) run before ticking the clock
      await flushPromises();

      // Advance past the 5-minute deadline
      mock.timers.tick(5 * 60 * 1000 + 1);
      await flushPromises();
      await processPromise;

      assert.ok(
        oIAnalyticsCommandRepository.markAsErrored.mock.calls.some(
          c => c.arguments[0] === testSouthItemCommand.id && c.arguments[1].includes('timed out')
        ),
        'markAsErrored should be called with a timeout message'
      );

      // isExecutingCommand must be reset so subsequent commands are not blocked
      oIAnalyticsCommandRepository.findFirstToExecute.mock.mockImplementationOnce(() => null);
      await service.processNextCommand();
      assert.ok(logged(logger.trace).includes('No command to execute'), 'subsequent processNextCommand call should not be blocked');

      mock.timers.reset();
    });

    it('should propagate the real error immediately when the operation rejects before the timeout', async () => {
      southService.testItem.mock.mockImplementationOnce(() => Promise.reject(new Error('connection refused')));

      await executeCommand(testSouthItemCommand);

      // The real error — not a timeout — should be reported
      assertErrored(testSouthItemCommand, 'connection refused');
    });
  });

  it('should execute update-history-query-status command', async () => {
    const command = buildCommand<OIBusUpdateHistoryQueryStatusCommand>({
      id: 'updateHistoryQueryStatusId',
      type: 'update-history-query-status',
      historyQueryId: 'historyId',
      commandContent: { historyQueryStatus: 'RUNNING' }
    });

    await executeCommand(command);

    assert.deepStrictEqual(historyQueryService.start.mock.calls[0].arguments, [command.historyQueryId]);
    assertCompleted(command, 'History query started');

    command.commandContent.historyQueryStatus = 'PAUSED';
    await executeCommand(command);

    assert.deepStrictEqual(historyQueryService.pause.mock.calls[0].arguments, [command.historyQueryId]);
    assert.ok(oIAnalyticsCommandRepository.markAsCompleted.mock.calls.some(c => c.arguments[2] === 'History query paused'));

    command.commandContent.historyQueryStatus = 'ERRORED';
    await executeCommand(command);

    assert.ok(
      oIAnalyticsCommandRepository.markAsErrored.mock.calls.some(
        c => c.arguments[1] === `History query status of ${command.historyQueryId} can not be updated to ERRORED`
      )
    );
  });

  it('should execute setpoint command', async () => {
    const command = buildCommand<OIBusSetpointCommand>({
      id: 'setpointCommandId',
      type: 'setpoint',
      northConnectorId: 'n1',
      commandContent: [{ reference: 'reference', value: '123456' }]
    });
    northService.executeSetpoint.mock.mockImplementationOnce(async (_northId, _commandContent, callback) => {
      callback('ok');
    });

    await executeCommand(command);

    assert.strictEqual(northService.executeSetpoint.mock.calls[0].arguments[0], command.northConnectorId);
    assert.deepStrictEqual(northService.executeSetpoint.mock.calls[0].arguments[1], command.commandContent);
    assertCompleted(command, 'ok');
  });

  for (const { title, command, failing, error } of [
    {
      title: 'should fail to execute search-north-cache-content if north not found',
      command: searchNorthCacheCommand,
      failing: () => oIBusService.searchCacheContent,
      error: 'North northId1 not found'
    },
    {
      title: 'should handle error in executeGetNorthCacheFileContentCommand',
      command: getNorthCacheFileCommand,
      failing: () => oIBusService.getFileFromCache,
      error: 'File not found'
    },
    {
      title: 'should fail to execute update-north-cache-content command when action returns an error',
      command: updateNorthCacheCommand,
      failing: () => oIBusService.updateCacheContent,
      error: 'error while removing file'
    },
    {
      title: 'should handle error in executeSearchHistoryCacheContentCommand if history not found',
      command: searchHistoryCacheCommand,
      failing: () => oIBusService.searchCacheContent,
      error: 'History historyId1 not found'
    },
    {
      title: 'should handle error in executeGetHistoryCacheFileContentCommand',
      command: getHistoryCacheFileCommand,
      failing: () => oIBusService.getFileFromCache,
      error: 'File not found'
    },
    {
      title: 'should handle error in executeUpdateHistoryCacheContentCommand',
      command: updateHistoryCacheCommand,
      failing: () => oIBusService.updateCacheContent,
      error: 'Update failed'
    }
  ]) {
    it(title, async () => {
      failing().mock.mockImplementationOnce(async () => {
        throw new Error(error);
      });

      await executeCommand(command);

      assertErrored(command, error);
    });
  }
});

describe('OIAnalytics Command service with update error', () => {
  beforeEach(() => {
    const updatedVersion = updateVersionCommand.commandContent.version.slice(1);
    oIBusService.getEngineSettings.mock.mockImplementation(() => ({ ...testData.engine.settings, version: updatedVersion }));
    const rollbackCommand: OIBusUpdateVersionCommand = {
      ...updateVersionCommand,
      commandContent: { ...updateVersionCommand.commandContent, version: updatedVersion }
    };
    oIAnalyticsCommandRepository.list.mock.mockImplementation(() => [rollbackCommand]);

    service = makeService();
  });

  it('should properly start and stop service', () => {
    assert.strictEqual(oIBusService.getEngineSettings.mock.calls.length, 1);
    assert.strictEqual(oIBusService.updateOIBusVersion.mock.calls.length, 0);
    assertErrored(updateVersionCommand, `OIBus has not been updated. Rollback to version ${version}`);
  });
});

describe('OIAnalytics Command service with ignoreRemoteUpdate', () => {
  beforeEach(() => {
    service = makeService(true, '3.4.0');
  });

  it('should change logger', async () => {
    const anotherLogger = new LoggerMock();
    // Prevent background processNextCommand from running real logic
    oIAnalyticsCommandRepository.list.mock.mockImplementation(() => []);
    mock.method(process, 'exit', () => undefined as never);
    mock.method(process, 'kill', () => true);

    await service.start();
    oIBusService.loggerEvent.emit('updated', anotherLogger);
    await service.stop();
    await flushPromises();

    assert.strictEqual(logger.debug.mock.calls.length, 0);
    assert.strictEqual(anotherLogger.debug.mock.calls.length, 2);
  });

  it('should not run an update', async () => {
    await executeCommand(updateVersionCommand);

    assert.ok(
      logged(logger.error).includes(
        `Error while executing command ${updateVersionCommand.id} (retrieved ${updateVersionCommand.retrievedDate}) of type ${updateVersionCommand.type}. Error: OIBus is not set up to execute remote update`
      )
    );
  });
});

describe('OIAnalytics Command service with no commands', () => {
  beforeEach(() => {
    oIAnalyticsCommandRepository.list.mock.mockImplementation(() => []);

    service = makeService(true, '3.4.0');
  });

  it('should properly start when not registered', () => {
    assert.ok(oIBusService.getEngineSettings.mock.calls.length > 0);
    assert.ok(oIAnalyticsCommandRepository.list.mock.calls.length > 0);
    assert.deepStrictEqual(oIBusService.updateOIBusVersion.mock.calls[0].arguments, [version, '3.4.0']);
    assert.strictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls.length, 0);
  });
});

describe('OIAnalytics Command service with no commands and without update', () => {
  beforeEach(() => {
    oIAnalyticsCommandRepository.list.mock.mockImplementation(() => []);
    oIBusService.getEngineSettings.mock.mockImplementation(() => ({ ...testData.engine.settings, version }));

    service = makeService(true, testData.engine.settings.launcherVersion);
  });

  const complete = (result: SouthConnectorItemTestResult) => service['completeDualResultTestCommand'](testSouthItemCommand, result);
  const completedResults = () => oIAnalyticsCommandRepository.markAsCompleted.mock.calls.map(call => call.arguments);
  const testResult = (raw: OIBusContent): SouthConnectorItemTestResult => ({
    raw,
    transformed: null,
    connectionDuration: 5,
    queryDuration: 10
  });
  const completedResult = (raw: object) => [
    testSouthItemCommand.id,
    FAKE_NOW,
    JSON.stringify({ raw, transformed: null, connectionDuration: 5, queryDuration: 10 })
  ];

  it('should properly start when not registered', () => {
    assert.strictEqual(oIBusService.updateOIBusVersion.mock.calls.length, 0);
    assert.strictEqual(oIAnalyticsCommandRepository.markAsCompleted.mock.calls.length, 0);
  });

  it('should complete time values test item command', () => {
    const content = new Array(2000).fill(0);
    const content2 = new Array(10).fill(0);

    complete(testResult({ type: 'record-list', content }));
    complete(testResult({ type: 'record-list', content: content2 }));

    assert.deepStrictEqual(completedResults(), [
      completedResult({ type: 'record-list', content: content.slice(0, 1000), truncated: true, totalSize: 2000 }),
      completedResult({ type: 'record-list', content: content2, truncated: false, totalSize: 10 })
    ]);
  });

  it('should complete file test item command', () => {
    const content2 = 'A'.repeat(500 * 1025);

    complete(testResult({ type: 'file', filePath: 'file.csv', content: 'content' }));
    complete(testResult({ type: 'file', filePath: 'file.csv', content: content2 }));
    complete(testResult({ type: 'file', filePath: 'file.csv' }));

    assert.deepStrictEqual(completedResults(), [
      completedResult({ type: 'file', filePath: 'file.csv', content: 'content', truncated: false, totalSize: 'content'.length }),
      completedResult({
        type: 'file',
        filePath: 'file.csv',
        content: content2.slice(0, 1024 * 500),
        truncated: true,
        totalSize: 1025 * 500
      }),
      completedResult({ type: 'file', filePath: 'file.csv', truncated: false, totalSize: 0 })
    ]);
  });

  it('should properly convert to DTO without audit fields', () => {
    for (const command of commands) {
      const { createdBy: _createdBy, updatedBy: _updatedBy, createdAt: _createdAt, updatedAt: _updatedAt, ...expected } = command;
      assert.deepStrictEqual(toOIBusCommandDTO(command), expected);
    }
  });

  it('should properly convert custom transformer commands to DTO', () => {
    const baseCommand = {
      status: 'COMPLETED' as const,
      ack: true,
      retrievedDate: testData.constants.dates.DATE_1,
      completedDate: testData.constants.dates.DATE_2,
      result: 'ok',
      targetVersion: testData.engine.settings.version
    };
    const auditFields = {
      createdBy: '',
      updatedBy: '',
      createdAt: testData.constants.dates.DATE_1,
      updatedAt: testData.constants.dates.DATE_2
    };
    const createCommand = {
      ...baseCommand,
      id: 'createCustomTransformerId',
      type: 'create-custom-transformer' as const,
      commandContent: testData.transformers.command
    };
    const updateCommand = {
      ...baseCommand,
      id: 'updateCustomTransformerId',
      type: 'update-custom-transformer' as const,
      transformerId: 'transformerId1',
      commandContent: testData.transformers.command
    };
    const deleteCommand = {
      ...baseCommand,
      id: 'deleteCustomTransformerId',
      type: 'delete-custom-transformer' as const,
      transformerId: 'transformerId1'
    };
    const testCommand = {
      ...baseCommand,
      id: 'testCustomTransformerId',
      type: 'test-custom-transformer' as const,
      commandContent: { command: testData.transformers.command, testRequest: { inputData: 'raw', options: {} } }
    };

    for (const dto of [createCommand, updateCommand, deleteCommand, testCommand]) {
      assert.deepStrictEqual(toOIBusCommandDTO({ ...auditFields, ...dto }), dto);
    }
  });

  it('should never expose audit fields, whatever the command type', () => {
    for (const type of OIBUS_COMMAND_TYPES) {
      const command = { ...updateVersionCommand, type, createdBy: 'createdBy', updatedBy: 'updatedBy' } as OIBusCommand;
      const dto = toOIBusCommandDTO(command);
      assert.strictEqual(dto.type, type);
      assert.strictEqual(dto.id, command.id);
      assert.strictEqual(dto.targetVersion, command.targetVersion);
      for (const field of ['createdBy', 'updatedBy', 'createdAt', 'updatedAt']) {
        assert.ok(!(field in dto), `${type} must not expose ${field}`);
      }
    }
  });
});
