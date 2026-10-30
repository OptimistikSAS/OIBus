import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { Database } from 'better-sqlite3';

import { ConfigurationWorkflowCommandDTO } from '../../shared/model/api/configuration-workflow.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorFolderScannerCommandDTO,
  SouthConnectorFolderScannerItemCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthItemGroupCommandDTO
} from '../../shared/model/api/south-connector.model';
import { OIBusContent } from '../../shared/model/common/content.model';
import { OIBUS_SOUTH_TYPES } from '../../shared/model/connector/south-manifest.model';
import { SouthItemSettings } from '../../shared/model/connector/south-settings.model';

import type DataStreamEngine from '../engine/data-stream-engine';
import { SouthConnectorEntityLight, SouthConnectorItemEntity, SouthItemGroupEntity } from '../model/south-connector.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import type SouthCacheRepository from '../repository/cache/south-cache.repository';
import type CertificateRepository from '../repository/config/certificate.repository';
import type NorthConnectorRepository from '../repository/config/north-connector.repository';
import type OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import type ScanModeRepository from '../repository/config/scan-mode.repository';
import type SouthConnectorRepository from '../repository/config/south-connector.repository';
import type SouthItemGroupRepository from '../repository/config/south-item-group.repository';
import type LogRepository from '../repository/logs/log.repository';
import type SouthConnectorMetricsRepository from '../repository/metrics/south-connector-metrics.repository';
import type { buildSouth as buildSouthType } from '../south/south-connector-factory';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import testData from '../tests/utils/test-data';
import { createMock, Mocked, mockModule, reloadModule, seq } from '../tests/utils/test-utils';
import type JoiValidator from '../web-server/controllers/validators/joi.validator';
import type SouthConnectorMetricsService from './metrics/south-connector-metrics.service';
import type OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { toScanModeDTO } from './scan-mode.service';
import type SouthServiceType from './south.service';
import type {
  copySouthItemCommandToSouthItemEntity as copySouthItemCommandToSouthItemEntityType,
  southManifestList as southManifestListType,
  toSouthConnectorDTO as toSouthConnectorDTOType,
  toSouthConnectorItemDTO as toSouthConnectorItemDTOType,
  toSouthConnectorLightDTO as toSouthConnectorLightDTOType,
  toSouthItemGroupDTO as toSouthItemGroupDTOType
} from './south.service';
import type TransformerService from './transformer.service';
import type * as Utils from './utils';

const nodeRequire = createRequire(import.meta.url);

const realUtils: typeof Utils = nodeRequire('./utils');
// Only the CSV parsing, the group resolution (real by default) and the explore session id are controlled by the tests
const createUtilsMocks = () => ({
  parseCsvImport: mock.fn((_fileContent: string, _delimiter: string): Array<Record<string, unknown>> => []),
  checkGroups: mock.fn<typeof Utils.checkGroups>(realUtils.checkGroups),
  generateRandomId: mock.fn<typeof Utils.generateRandomId>(() => 'exploreSessionId')
});
const utilsExports = { ...realUtils, ...createUtilsMocks() };
const southConnectorFactory = { buildSouth: mock.fn<typeof buildSouthType>() };

const getUserInfo = (id: string) => ({ id, friendlyName: id });

const buildGroup = (overrides: Partial<SouthItemGroupEntity> = {}): SouthItemGroupEntity => ({
  id: 'group1',
  name: 'Group 1',
  southId: testData.south.list[0].id,
  scanMode: testData.scanMode.list[0],
  startTimeOffset: null,
  endTimeOffset: null,
  maxReadInterval: null,
  readDelay: 0,
  recoveryStrategy: null,
  emptyIntervalStrategy: null,
  cachingStrategy: null,
  items: [],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: '',
  ...overrides
});

const buildGroupCommand = (
  name: string,
  historySettings: Partial<SouthItemGroupCommandDTO['historySettings']> = {},
  scanModeId = testData.scanMode.list[0].id
): SouthItemGroupCommandDTO => ({
  id: null,
  standardSettings: { name, scanModeId },
  historySettings: {
    startTimeOffset: null,
    endTimeOffset: null,
    maxReadInterval: null,
    recoveryStrategy: null,
    emptyIntervalStrategy: null,
    cachingStrategy: null,
    readDelay: 0,
    ...historySettings
  }
});

/** Last value of a synced group, shared by all its items */
const buildGroupCache = (groupId: string) => ({
  itemId: null,
  groupId,
  queryTime: '2024-05-01T00:00:00.000Z',
  value: { temperature: 42 },
  trackedInstant: '2024-05-01T00:00:10.000Z'
});

const leaveGroupCommand: SouthConnectorItemCommandDTO = {
  ...testData.south.itemCommand,
  groupId: null,
  groupName: null,
  syncWithGroup: false
};

const buildItemEntity = (overrides: Partial<SouthConnectorItemEntity<SouthItemSettings>>): SouthConnectorItemEntity<SouthItemSettings> => ({
  id: 'item1',
  name: 'Test Item',
  description: null,
  enabled: true,
  scanMode: testData.scanMode.list[0],
  settings: {} as SouthItemSettings,
  group: null,
  syncWithGroup: false,
  maxReadInterval: null,
  recoveryStrategy: null,
  emptyIntervalStrategy: null,
  cachingStrategy: null,
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
  readDelay: null,
  startTimeOffset: null,
  endTimeOffset: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: '',
  ...overrides
});

/** A CSV row of a folder-scanner item */
const folderScannerRow = (name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  name,
  enabled: 'true',
  settings_regex: '*',
  settings_preserveFiles: 'true',
  settings_ignoreModifiedDate: 'false',
  settings_minAge: 100,
  scanMode: testData.scanMode.list[0].name,
  ...overrides
});

/** An item returned by checkImportItems with the default history settings */
const buildImportedItem = (name: string, settings: Record<string, unknown>, overrides: Record<string, unknown> = {}) => ({
  id: '',
  name,
  description: null,
  enabled: true,
  scanMode: toScanModeDTO(testData.scanMode.list[0], getUserInfo),
  settings,
  group: null,
  maxReadInterval: 0,
  startTimeOffset: 0,
  endTimeOffset: 0,
  readDelay: 0,
  recoveryStrategy: 'oldest',
  emptyIntervalStrategy: 'keep',
  syncWithGroup: false,
  ...overrides
});

const existingItemsOf = (southIndex: number) => testData.south.list[southIndex].items.map(item => ({ ...item, group: null }));

const localWorkflowCommand: ConfigurationWorkflowCommandDTO = {
  id: null,
  name: 'local',
  description: 'Creates an item for each variable',
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [],
  itemFieldMapping: { name: '{{name}}' },
  pushToOIAnalytics: false,
  scanModeId: testData.scanMode.list[0].id,
  enabled: true
};

let SouthService: typeof SouthServiceType;
let southManifestList: typeof southManifestListType;
let toSouthConnectorDTO: typeof toSouthConnectorDTOType;
let toSouthConnectorItemDTO: typeof toSouthConnectorItemDTOType;
let toSouthConnectorLightDTO: typeof toSouthConnectorLightDTOType;
let toSouthItemGroupDTO: typeof toSouthItemGroupDTOType;
let copySouthItemCommandToSouthItemEntity: typeof copySouthItemCommandToSouthItemEntityType;

describe('South Service', () => {
  let service: SouthServiceType;
  let validator: Mocked<JoiValidator>;
  let southConnectorRepository: Mocked<SouthConnectorRepository>;
  let logRepository: Mocked<LogRepository>;
  let southMetricsRepository: Mocked<SouthConnectorMetricsRepository>;
  let southCacheRepository: Mocked<SouthCacheRepository>;
  let oIAnalyticsMessageService: Mocked<OIAnalyticsMessageService>;
  let engine: Mocked<DataStreamEngine>;
  let southItemGroupRepository: Mocked<SouthItemGroupRepository>;
  let transformerService: Mocked<TransformerService>;
  let northConnectorRepository: Mocked<NorthConnectorRepository>;
  let database: Mocked<Database>;
  let buildSouth: Mock<typeof buildSouthType>;
  let mockedSouth1: SouthConnectorMock;
  let logger: PinoLogger;

  /** Makes the engine hold `south` as the live instance of the connector */
  const registerLiveSouth = (south: SouthConnectorMock) => {
    engine.hasSouth.mock.mockImplementation(() => true);
    engine.getSouth.mock.mockImplementation(() => ({ south, metrics: createMock<SouthConnectorMetricsService>() }));
  };

  before(() => {
    mockModule(nodeRequire, './utils', utilsExports);
    mockModule(nodeRequire, '../south/south-connector-factory', southConnectorFactory);
    mockModule(nodeRequire, './encryption.service', { encryptionService: new EncryptionServiceMock('', '') });

    const mod = reloadModule<{
      default: typeof SouthServiceType;
      southManifestList: typeof southManifestListType;
      toSouthConnectorDTO: typeof toSouthConnectorDTOType;
      toSouthConnectorItemDTO: typeof toSouthConnectorItemDTOType;
      toSouthConnectorLightDTO: typeof toSouthConnectorLightDTOType;
      toSouthItemGroupDTO: typeof toSouthItemGroupDTOType;
      copySouthItemCommandToSouthItemEntity: typeof copySouthItemCommandToSouthItemEntityType;
    }>(nodeRequire, './south.service');
    SouthService = mod.default;
    southManifestList = mod.southManifestList;
    toSouthConnectorDTO = mod.toSouthConnectorDTO;
    toSouthConnectorItemDTO = mod.toSouthConnectorItemDTO;
    toSouthConnectorLightDTO = mod.toSouthConnectorLightDTO;
    toSouthItemGroupDTO = mod.toSouthItemGroupDTO;
    copySouthItemCommandToSouthItemEntity = mod.copySouthItemCommandToSouthItemEntity;
  });

  beforeEach(() => {
    Object.assign(utilsExports, createUtilsMocks());
    mockedSouth1 = new SouthConnectorMock(testData.south.list[0]);
    buildSouth = mock.fn<typeof buildSouthType>(() => mockedSouth1);
    southConnectorFactory.buildSouth = buildSouth;

    logger = new PinoLogger();
    validator = createMock<JoiValidator>();
    southConnectorRepository = createMock<SouthConnectorRepository>({
      findAllSouth: () => [],
      findSouthById: () => testData.south.list[0],
      findItemById: () => testData.south.list[0].items[0],
      findAllItemsForSouth: () => []
    });
    logRepository = createMock<LogRepository>();
    southMetricsRepository = createMock<SouthConnectorMetricsRepository>();
    southCacheRepository = createMock<SouthCacheRepository>();
    oIAnalyticsMessageService = createMock<OIAnalyticsMessageService>();
    engine = createMock<DataStreamEngine>({ logger });
    southItemGroupRepository = createMock<SouthItemGroupRepository>({ findBySouthId: () => [] });
    transformerService = createMock<TransformerService>({ findById: () => testData.transformers.list[0] });
    northConnectorRepository = createMock<NorthConnectorRepository>({ findNorthById: () => testData.north.list[0] });
    database = createMock<Database>({ transaction: fn => fn });

    service = new SouthService(
      validator,
      southConnectorRepository,
      logRepository,
      southMetricsRepository,
      southCacheRepository,
      createMock<ScanModeRepository>({ findAll: () => testData.scanMode.list }),
      createMock<OIAnalyticsRegistrationRepository>(),
      createMock<CertificateRepository>(),
      oIAnalyticsMessageService,
      engine,
      southItemGroupRepository,
      transformerService,
      northConnectorRepository,
      database
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should retrieve a list of south manifest', () => {
    const list = service.listManifest();

    assert.strictEqual(list, southManifestList);
    // One manifest per connector type
    assert.deepStrictEqual(list.map(manifest => manifest.id).sort(), [...OIBUS_SOUTH_TYPES].sort());
  });

  it('should retrieve a manifest', () => {
    const consoleManifest = service.getManifest('folder-scanner');
    assert.deepStrictEqual(consoleManifest, southManifestList[0]);
  });

  it('should throw an error if manifest is not found', () => {
    assert.throws(() => service.getManifest('bad'), new NotFoundError(`South manifest "bad" not found`));
  });

  it('should get all south connector settings', () => {
    service.list();
    assert.strictEqual(southConnectorRepository.findAllSouth.mock.calls.length, 1);
  });

  it('should get a south connector', () => {
    service.findById(testData.south.list[0].id);
    assert.strictEqual(southConnectorRepository.findSouthById.mock.calls.length, 1);
    assert.deepStrictEqual(southConnectorRepository.findSouthById.mock.calls[0].arguments, [testData.south.list[0].id]);
  });

  it('should throw an error when south connector does not exist', () => {
    southConnectorRepository.findSouthById.mock.mockImplementation(() => null);

    assert.throws(() => service.findById(testData.south.list[0].id), new NotFoundError(`South "${testData.south.list[0].id}" not found`));
    assert.strictEqual(southConnectorRepository.findSouthById.mock.calls.length, 1);
    assert.deepStrictEqual(southConnectorRepository.findSouthById.mock.calls[0].arguments, [testData.south.list[0].id]);
  });

  it('should create a south connector', async () => {
    const retrieveSecrets = mock.method(service, 'retrieveSecretsFromSouth', () => testData.south.list[0]);

    await service.create(testData.south.command, testData.south.list[0].id, 'userTest');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual(retrieveSecrets.mock.calls.length, 1);
    assert.strictEqual(engine.createSouth.mock.calls.length, 1);
    assert.strictEqual(engine.startSouth.mock.calls.length, 1);
  });

  it("should leave a south connector's workflows untouched when its command predates them", async () => {
    const { configurationWorkflows: _configurationWorkflows, ...commandWithoutWorkflows } = testData.south.command;

    await service.create(commandWithoutWorkflows as SouthConnectorCommandDTO, null, 'userTest');
    await service.update(testData.south.list[0].id, commandWithoutWorkflows as SouthConnectorCommandDTO, 'userTest');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls[0].arguments[2], undefined);
    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls[1].arguments[2], undefined);
    assert.strictEqual(engine.reloadWorkflows.mock.calls.length, 0);
  });

  it('should create a south connector with its configuration workflows', async () => {
    mock.method(service, 'retrieveSecretsFromSouth', () => null);

    await service.create({ ...testData.south.command, configurationWorkflows: [localWorkflowCommand] }, null, 'userTest');

    assert.deepStrictEqual(southConnectorRepository.saveSouth.mock.calls[0].arguments[2], [
      {
        id: null,
        name: 'local',
        description: 'Creates an item for each variable',
        discoveryScope: { rootNodeId: 'ns=1;s=Root' },
        identityKeyFields: ['nodeId'],
        eligibilityFilter: [],
        itemFieldMapping: { name: '{{name}}' },
        pushToOIAnalytics: false,
        scanMode: testData.scanMode.list[0],
        enabled: true
      }
    ]);
    assert.strictEqual(engine.reloadWorkflows.mock.calls.length, 1);
  });

  it('should create a south connector with items in a group created with it', async () => {
    mock.method(service, 'retrieveSecretsFromSouth', () => null);
    // A group not saved yet has a temporary id: the repository creates it with the south and remaps its items
    const command = structuredClone(testData.south.command);
    command.groups = [
      {
        id: 'temp_1',
        standardSettings: { name: 'New Group', scanModeId: testData.scanMode.list[0].id },
        historySettings: {
          startTimeOffset: null,
          endTimeOffset: null,
          maxReadInterval: null,
          readDelay: null,
          recoveryStrategy: null,
          emptyIntervalStrategy: null,
          cachingStrategy: null
        }
      }
    ];
    command.items[0].groupId = 'temp_1';

    await service.create(command, null, 'userTest');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    const savedSouth = southConnectorRepository.saveSouth.mock.calls[0].arguments[0];
    assert.deepStrictEqual(savedSouth.groups, [
      {
        id: 'temp_1',
        name: 'New Group',
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: null,
        recoveryStrategy: null,
        emptyIntervalStrategy: null,
        cachingStrategy: null
      }
    ]);
    assert.deepStrictEqual(savedSouth.items[0].group, { id: 'temp_1' });
    assert.strictEqual(savedSouth.items[0].createdBy, 'userTest');
    assert.strictEqual(savedSouth.items[0].updatedBy, 'userTest');
    // The groups are created by the repository, along with the south
    assert.strictEqual(southItemGroupRepository.create.mock.calls.length, 0);
  });

  it('should not create a south connector with items in a group unknown by name', async () => {
    mock.method(service, 'retrieveSecretsFromSouth', () => null);
    const command = structuredClone(testData.south.command);
    command.items[0].groupName = 'Unknown Group';
    command.items[0].groupId = null;

    await assert.rejects(service.create(command, null, 'userTest'), new NotFoundError('Group "Unknown Group" not found'));

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 0);
    assert.strictEqual(southItemGroupRepository.create.mock.calls.length, 0);
  });

  it('should create a south connector with retrieveSecretsFromSouth when item has no id', async () => {
    const retrieveSecrets = mock.method(service, 'retrieveSecretsFromSouth', () => testData.south.list[0]);

    const command = structuredClone(testData.south.command);
    command.items[0].id = null;

    await service.create(command, testData.south.list[0].id, 'userTest');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    assert.strictEqual(retrieveSecrets.mock.calls.length, 1);
  });

  it('should not create south connector if disabled', async () => {
    mock.method(service, 'retrieveSecretsFromSouth', () => null);

    await service.create({ ...testData.south.command, enabled: false }, null, 'userTest');
    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual(engine.createSouth.mock.calls.length, 1);
    assert.strictEqual(engine.startSouth.mock.calls.length, 0);
  });

  it('should not create a south connector with duplicate name', async () => {
    mock.method(service, 'retrieveSecretsFromSouth', () => null);
    southConnectorRepository.findAllSouth.mock.mockImplementation(() => [
      { ...testData.south.list[0], id: 'existing-id', name: testData.south.command.name } satisfies SouthConnectorEntityLight
    ]);

    await assert.rejects(
      async () => service.create(testData.south.command, null, 'userTest'),
      new OIBusValidationError(`South connector name "${testData.south.command.name}" already exists`)
    );
  });

  it('should update a south connector', async () => {
    southConnectorRepository.findAllSouth.mock.mockImplementation(() => testData.south.list);
    await service.update(testData.south.list[0].id, testData.south.command, 'userTest');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual(engine.reloadSouth.mock.calls.length, 1);
  });

  it('should update a south connector and sync its configuration workflows', async () => {
    const remoteWorkflowCommand: ConfigurationWorkflowCommandDTO = {
      ...localWorkflowCommand,
      id: 'workflowId1',
      name: 'remote',
      identityKeyFields: ['discarded for a remote workflow'],
      itemFieldMapping: null,
      pushToOIAnalytics: true,
      scanModeId: null
    };

    await service.update(
      testData.south.list[0].id,
      { ...testData.south.command, configurationWorkflows: [localWorkflowCommand, remoteWorkflowCommand] },
      'userTest'
    );

    const workflows = southConnectorRepository.saveSouth.mock.calls[0].arguments[2]!;
    assert.deepStrictEqual(
      workflows.map(workflow => ({ id: workflow.id, identityKeyFields: workflow.identityKeyFields, scanMode: workflow.scanMode })),
      [
        { id: null, identityKeyFields: ['nodeId'], scanMode: testData.scanMode.list[0] },
        { id: 'workflowId1', identityKeyFields: [], scanMode: null }
      ]
    );
    assert.deepStrictEqual(engine.reloadWorkflows.mock.calls[0].arguments, [testData.south.list[0].id]);
    // Saving a remote workflow while unregistered is allowed, but warned about
    assert.strictEqual(logger.warn.mock.calls.length, 1);
  });

  it('should reject a south connector command with two configuration workflows of the same name', async () => {
    await assert.rejects(
      service.update(
        testData.south.list[0].id,
        { ...testData.south.command, configurationWorkflows: [localWorkflowCommand, { ...localWorkflowCommand, id: 'workflowId1' }] },
        'userTest'
      ),
      new OIBusValidationError('A configuration workflow with name "local" already exists for this south connector')
    );
    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 0);
  });

  it('should reject a south connector command with an invalid configuration workflow', async () => {
    await assert.rejects(
      service.update(
        testData.south.list[0].id,
        { ...testData.south.command, configurationWorkflows: [{ ...localWorkflowCommand, identityKeyFields: [] }] },
        'userTest'
      ),
      new OIBusValidationError('A configuration workflow creating/updating items requires at least one identity key field')
    );
    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 0);
  });

  it('should update a south connector with a new unique name', async () => {
    southConnectorRepository.findAllSouth.mock.mockImplementation(() => testData.south.list);

    await service.update(testData.south.list[0].id, { ...testData.south.command, name: 'Updated South Name' }, 'userTest');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    assert.strictEqual(engine.reloadSouth.mock.calls.length, 1);
  });

  it('should update a south connector and map groups from the command onto the entity', async () => {
    const groupCommand: SouthItemGroupCommandDTO = {
      ...buildGroupCommand('My Group', {
        startTimeOffset: 5,
        endTimeOffset: 10,
        maxReadInterval: 3600,
        readDelay: 200,
        recoveryStrategy: 'oldest',
        emptyIntervalStrategy: 'keep'
      }),
      id: 'existingGroupId'
    };
    southConnectorRepository.findAllSouth.mock.mockImplementation(() => testData.south.list);

    await service.update(testData.south.list[0].id, { ...testData.south.command, groups: [groupCommand] }, 'userTest');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    const savedEntity = southConnectorRepository.saveSouth.mock.calls[0].arguments[0];
    assert.strictEqual(savedEntity.groups.length, 1);
    assert.deepStrictEqual(savedEntity.groups[0], {
      id: 'existingGroupId',
      name: 'My Group',
      startTimeOffset: 5,
      endTimeOffset: 10,
      maxReadInterval: 3600,
      readDelay: 200,
      recoveryStrategy: 'oldest',
      emptyIntervalStrategy: 'keep',
      cachingStrategy: null,
      scanMode: testData.scanMode.list[0]
    });
  });

  it('should update a south connector and set createdBy on new items', async () => {
    const command = structuredClone(testData.south.command);
    command.items[0].id = '';
    southConnectorRepository.findAllSouth.mock.mockImplementation(() => testData.south.list);

    await service.update(testData.south.list[0].id, command, 'user1');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    const savedSouth = southConnectorRepository.saveSouth.mock.calls[0].arguments[0];
    assert.strictEqual(savedSouth.items.length, 1);
    assert.strictEqual(savedSouth.items[0].id, '');
    assert.strictEqual(savedSouth.items[0].createdBy, 'user1');
    assert.strictEqual(savedSouth.items[0].updatedBy, 'user1');
    // The connector itself keeps its creator
    assert.strictEqual(savedSouth.createdBy, testData.south.list[0].createdBy);
    assert.strictEqual(savedSouth.updatedBy, 'user1');
  });

  it('should update a south connector and not set createdBy on existing items', async () => {
    const command = structuredClone(testData.south.command);
    command.items[0].id = testData.south.list[0].items[0].id;
    southConnectorRepository.findAllSouth.mock.mockImplementation(() => testData.south.list);

    await service.update(testData.south.list[0].id, command, 'user1');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    const savedEntity = southConnectorRepository.saveSouth.mock.calls[0].arguments[0];
    const existingItem = savedEntity.items.find(item => item.id === testData.south.list[0].items[0].id);
    assert.ok(existingItem !== undefined);
    assert.strictEqual(existingItem!.updatedBy, 'user1');
  });

  it('should not update a south connector whose item settings do not match the manifest', async () => {
    validator.validateSettings.mock.mockImplementation(
      seq(
        async () => undefined, // connector settings
        async () => {
          throw new Error('"regex" must be a string');
        }
      )
    );

    await assert.rejects(
      service.update(testData.south.list[0].id, testData.south.command, 'userTest'),
      new Error('"regex" must be a string')
    );
    assert.strictEqual(validator.validateSettings.mock.calls[1].arguments[1], testData.south.command.items[0].settings);
    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 0);
  });

  it('should not update a south connector with duplicate name', async () => {
    southConnectorRepository.findAllSouth.mock.mockImplementation(() => [
      { ...testData.south.list[0], id: 'other-id', name: 'Duplicate Name' } satisfies SouthConnectorEntityLight
    ]);

    await assert.rejects(
      async () => service.update(testData.south.list[0].id, { ...testData.south.command, name: 'Duplicate Name' }, 'userTest'),
      new OIBusValidationError(`South connector name "Duplicate Name" already exists`)
    );
  });

  it('should delete a south connector', async () => {
    await service.delete(testData.south.list[0].id, 'userTest');

    assert.deepStrictEqual(engine.deleteSouth.mock.calls[0].arguments, [testData.south.list[0]]);
    assert.deepStrictEqual(southConnectorRepository.deleteSouth.mock.calls[0].arguments, [testData.south.list[0].id, 'userTest']);
    assert.deepStrictEqual(logRepository.deleteLogsByScopeId.mock.calls[0].arguments, ['south', testData.south.list[0].id]);
    assert.deepStrictEqual(southMetricsRepository.removeMetrics.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
  });

  it('should start south', async () => {
    await service.start(testData.south.list[0].id);

    assert.deepStrictEqual(southConnectorRepository.start.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.deepStrictEqual(engine.startSouth.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
  });

  it('should stop south', async () => {
    await service.stop(testData.south.list[0].id);

    assert.deepStrictEqual(southConnectorRepository.stop.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.deepStrictEqual(engine.stopSouth.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
  });

  it('should get a south metric', () => {
    service.getSouthMetric(testData.south.list[0].id);
    assert.deepStrictEqual(engine.getSouthMetrics.mock.calls[0].arguments, [testData.south.list[0].id]);
  });

  it('should test a south connector in creation mode', async () => {
    await service.testSouth('create', testData.south.command.type, testData.south.command.settings);

    assert.strictEqual(buildSouth.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.testConnection.mock.calls.length, 1);
  });

  it('should test a south connector in edit mode', async () => {
    await service.testSouth(testData.south.list[0].id, testData.south.command.type, testData.south.command.settings);

    assert.strictEqual(buildSouth.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.testConnection.mock.calls.length, 1);
  });

  it('should test item in creation mode', async () => {
    await service.testItem(
      'create',
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    );

    assert.strictEqual(buildSouth.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.testItem.mock.calls.length, 1);
  });

  it('should test item in edit mode', async () => {
    await service.testItem(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    );

    assert.strictEqual(buildSouth.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.testItem.mock.calls.length, 1);
  });

  it('should test a discovery query in creation mode', async () => {
    mockedSouth1.hasConfigurationDiscovery.mock.mockImplementation(() => true);
    mockedSouth1.discover.mock.mockImplementation(async () => [{ name: 'sensor1', unit: 'C' }]);

    const result = await service.testDiscoveryQuery('create', testData.south.command.type, testData.south.command.settings, 'SELECT 1');

    assert.strictEqual(buildSouth.mock.calls.length, 1);
    assert.deepStrictEqual(mockedSouth1.discover.mock.calls[0].arguments, [{ query: 'SELECT 1' }]);
    assert.deepStrictEqual(result, [{ name: 'sensor1', unit: 'C' }]);
  });

  it('should discover on a throwaway connector and stop it afterward', async () => {
    mockedSouth1.hasConfigurationDiscovery.mock.mockImplementation(() => true);
    mockedSouth1.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature' }]);

    const result = await service.discover('create', testData.south.command.type, testData.south.command.settings, { rootNodeId: 'root' });

    assert.deepStrictEqual(result, [{ nodeId: 'ns=1;s=Temperature' }]);
    assert.deepStrictEqual(mockedSouth1.discover.mock.calls[0].arguments, [{ rootNodeId: 'root' }]);
    assert.strictEqual(mockedSouth1.stop.mock.calls.length, 1);
  });

  it('should stop the throwaway connector even when discovery fails', async () => {
    mockedSouth1.hasConfigurationDiscovery.mock.mockImplementation(() => true);
    mockedSouth1.discover.mock.mockImplementation(async () => {
      throw new Error('browse failed');
    });

    await assert.rejects(service.discover('create', testData.south.command.type, testData.south.command.settings, {}), /browse failed/);
    assert.strictEqual(mockedSouth1.stop.mock.calls.length, 1);
  });

  it('should discover on the live instance when its settings already match, without stopping it', async () => {
    mockedSouth1.hasConfigurationDiscovery.mock.mockImplementation(() => true);
    mockedSouth1.isEnabled.mock.mockImplementation(() => true);
    registerLiveSouth(mockedSouth1);

    await service.discover(testData.south.list[0].id, testData.south.command.type, testData.south.list[0].settings, {});

    assert.strictEqual(buildSouth.mock.calls.length, 0);
    assert.strictEqual(mockedSouth1.discover.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.stop.mock.calls.length, 0);
  });

  it('should throw when testing a discovery query on a connector that does not support it', async () => {
    mockedSouth1.hasConfigurationDiscovery.mock.mockImplementation(() => false);

    await assert.rejects(
      () => service.testDiscoveryQuery('create', testData.south.command.type, testData.south.command.settings, 'SELECT 1'),
      /does not support configuration discovery/
    );
    assert.strictEqual(mockedSouth1.discover.mock.calls.length, 0);
  });

  it('should test a south connector against the live instance when its settings already match', async () => {
    mockedSouth1.isEnabled.mock.mockImplementation(() => true);
    registerLiveSouth(mockedSouth1);

    await service.testSouth(testData.south.list[0].id, testData.south.command.type, testData.south.list[0].settings);

    // Delegated straight to the live instance — no throwaway connector was built
    assert.strictEqual(buildSouth.mock.calls.length, 0);
    assert.deepStrictEqual(engine.getSouth.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.strictEqual(mockedSouth1.testConnection.mock.calls.length, 1);
  });

  it('should fall back to a throwaway connector when the live instance is disabled', async () => {
    registerLiveSouth(mockedSouth1);

    await service.testSouth(testData.south.list[0].id, testData.south.command.type, testData.south.list[0].settings);

    assert.strictEqual(buildSouth.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.testConnection.mock.calls.length, 1);
  });

  it('should fall back to a throwaway connector when the live instance settings differ', async () => {
    engine.hasSouth.mock.mockImplementation(() => true);

    await service.testSouth(testData.south.list[0].id, testData.south.command.type, {
      ...testData.south.list[0].settings,
      inputFolder: 'another-input'
    });

    assert.strictEqual(buildSouth.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.testConnection.mock.calls.length, 1);
  });

  it('should test an item against the live instance when connector settings already match', async () => {
    mockedSouth1.isEnabled.mock.mockImplementation(() => true);
    registerLiveSouth(mockedSouth1);

    await service.testItem(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.list[0].settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    );

    assert.strictEqual(buildSouth.mock.calls.length, 0);
    assert.deepStrictEqual(engine.getSouth.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.strictEqual(mockedSouth1.testItem.mock.calls.length, 1);
  });

  it('should fall back to a throwaway connector for item testing when connector settings differ', async () => {
    engine.hasSouth.mock.mockImplementation(() => true);

    await service.testItem(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.itemCommand.name,
      { ...testData.south.list[0].settings, inputFolder: 'another-input' },
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    );

    assert.strictEqual(buildSouth.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.testItem.mock.calls.length, 1);
  });

  it('should delegate to the transformer service when a transformer is provided', async () => {
    const rawContent = { type: 'file', content: 'raw' } as OIBusContent;
    const transformedContent = { type: 'record-list', content: [] } as OIBusContent;
    mockedSouth1.testItem.mock.mockImplementationOnce(async () => ({ result: rawContent, connectionDuration: 12, queryDuration: 34 }));
    transformerService.runTransformer.mock.mockImplementationOnce(async () => transformedContent);

    const result = await service.testItem(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      {
        history: { startTime: '2020-01-01T00:00:00.000Z', endTime: '2020-01-02T00:00:00.000Z' },
        transformer: { transformerId: 'transformer-id', options: { foo: 'bar' } }
      }
    );

    assert.strictEqual(mockedSouth1.testItem.mock.calls.length, 1);
    // the tested item is the source of the content, whose name the transformers can use
    const [transformerId, options, content, source] = transformerService.runTransformer.mock.calls[0].arguments;
    assert.deepStrictEqual([transformerId, options, content], ['transformer-id', { foo: 'bar' }, rawContent]);
    assert.strictEqual(source?.source, 'south');
    assert.deepStrictEqual(
      {
        ...source,
        queryTime: undefined,
        items: (source as { items: Array<{ name: string }> }).items.map(item => item.name)
      },
      {
        source: 'south',
        queryTime: undefined,
        queryStartTime: '2020-01-01T00:00:00.000Z',
        queryEndTime: '2020-01-02T00:00:00.000Z',
        southId: testData.south.list[0].id,
        southName: testData.south.list[0].name,
        items: [testData.south.itemCommand.name]
      }
    );
    assert.deepStrictEqual(result.raw, rawContent);
    assert.deepStrictEqual(result.transformed, transformedContent);
    assert.strictEqual(result.connectionDuration, 12);
    assert.strictEqual(result.queryDuration, 34);
  });

  it('should name the source connector of the transformer after the given connector name, for a history query', async () => {
    mockedSouth1.testItem.mock.mockImplementationOnce(async () => ({
      result: { type: 'file', content: 'raw' } as OIBusContent,
      connectionDuration: 0,
      queryDuration: 0
    }));
    transformerService.runTransformer.mock.mockImplementationOnce(async () => ({ type: 'file', content: 'out' }) as OIBusContent);

    await service.testItem(
      'history',
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      { history: undefined, transformer: { transformerId: 'transformer-id', options: {} } },
      'History query name'
    );

    const source = transformerService.runTransformer.mock.calls[0].arguments[3];
    assert.strictEqual(source?.source === 'south' && source.southName, 'History query name');
  });

  it('should return the raw result with transformed null when no transformer is provided', async () => {
    const rawContent = { type: 'file', content: 'raw' } as OIBusContent;
    mockedSouth1.testItem.mock.mockImplementationOnce(async () => ({ result: rawContent, connectionDuration: 12, queryDuration: 34 }));

    const result = await service.testItem(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      { history: undefined }
    );

    assert.deepStrictEqual(result, { raw: rawContent, transformed: null, connectionDuration: 12, queryDuration: 34 });
    assert.strictEqual(transformerService.runTransformer.mock.calls.length, 0);
  });

  it('should start an explore session', async () => {
    mock.method(mockedSouth1, 'hasExplore', () => true);
    mockedSouth1.explore.mock.mockImplementation(async () => [{ id: 'n1', name: 'N1', metadata: { type: 'Object' }, hasChildren: true }]);

    const result = await service.startExplore('create', testData.south.command.type, testData.south.command.settings);

    assert.strictEqual(buildSouth.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.connect.mock.calls.length, 1);
    assert.deepStrictEqual(result, {
      sessionId: 'exploreSessionId',
      entries: [{ id: 'n1', name: 'N1', metadata: { type: 'Object' }, hasChildren: true }]
    });
  });

  it('should explore a disabled connector through a throwaway instance, stopped on close', async () => {
    mock.method(mockedSouth1, 'hasExplore', () => true);
    // The engine instance of the disabled connector (wired to the north caches) must not be connected
    const engineSouth = new SouthConnectorMock(testData.south.list[0]);
    registerLiveSouth(engineSouth);

    const { sessionId } = await service.startExplore(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.list[0].settings
    );
    await service.closeExplore(sessionId);

    assert.strictEqual(buildSouth.mock.calls.length, 1);
    assert.strictEqual(engineSouth.connect.mock.calls.length, 0);
    assert.strictEqual(mockedSouth1.connect.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.stop.mock.calls.length, 1);
  });

  it('should explore a running connector through its live instance, without connecting or stopping it', async () => {
    mock.method(mockedSouth1, 'hasExplore', () => true);
    mockedSouth1.isEnabled.mock.mockImplementation(() => true);
    registerLiveSouth(mockedSouth1);

    const { sessionId } = await service.startExplore(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.list[0].settings
    );
    await service.closeExplore(sessionId);

    assert.strictEqual(buildSouth.mock.calls.length, 0);
    assert.strictEqual(mockedSouth1.explore.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.connect.mock.calls.length, 0);
    assert.strictEqual(mockedSouth1.stop.mock.calls.length, 0);
  });

  it('should throw when starting explore on an unsupported connector', async () => {
    mock.method(mockedSouth1, 'hasExplore', () => false);

    await assert.rejects(
      () => service.startExplore('create', testData.south.command.type, testData.south.command.settings),
      /does not support exploration/
    );
    assert.strictEqual(mockedSouth1.connect.mock.calls.length, 0);
  });

  it('should stop the connector if connect fails during explore', async () => {
    mock.method(mockedSouth1, 'hasExplore', () => true);
    mockedSouth1.connect.mock.mockImplementation(async () => {
      throw new Error('connect failed');
    });

    await assert.rejects(
      () => service.startExplore('create', testData.south.command.type, testData.south.command.settings),
      /connect failed/
    );
    assert.strictEqual(mockedSouth1.stop.mock.calls.length, 1);
  });

  it('should close the session if the initial browse fails', async () => {
    mock.method(mockedSouth1, 'hasExplore', () => true);
    mockedSouth1.explore.mock.mockImplementation(async () => {
      throw new Error('browse failed');
    });

    await assert.rejects(
      () => service.startExplore('create', testData.south.command.type, testData.south.command.settings),
      /browse failed/
    );
    assert.strictEqual(mockedSouth1.stop.mock.calls.length, 1);
  });

  it('should browse an explore session', async () => {
    mock.method(mockedSouth1, 'hasExplore', () => true);
    mockedSouth1.explore.mock.mockImplementation(async () => [
      { id: 'child', name: 'Child', metadata: { type: 'file' }, hasChildren: false }
    ]);
    const { sessionId } = await service.startExplore('create', testData.south.command.type, testData.south.command.settings);

    const result = await service.browseExplore(sessionId, 'parent');

    assert.deepStrictEqual(result, { entries: [{ id: 'child', name: 'Child', metadata: { type: 'file' }, hasChildren: false }] });
    assert.strictEqual(mockedSouth1.explore.mock.calls[1].arguments[0], 'parent');
  });

  it('should close an explore session', async () => {
    mock.method(mockedSouth1, 'hasExplore', () => true);
    const { sessionId } = await service.startExplore('create', testData.south.command.type, testData.south.command.settings);

    await service.closeExplore(sessionId);

    assert.strictEqual(mockedSouth1.stop.mock.calls.length, 1);
  });

  it('should close all explore sessions', async () => {
    mock.method(mockedSouth1, 'hasExplore', () => true);
    await service.startExplore('create', testData.south.command.type, testData.south.command.settings);

    await service.closeAllExploreSessions();

    assert.strictEqual(mockedSouth1.stop.mock.calls.length, 1);
  });

  it('should list items', () => {
    service.listItems(testData.south.list[0].id);
    assert.deepStrictEqual(southConnectorRepository.findAllItemsForSouth.mock.calls[0].arguments, [testData.south.list[0].id]);
  });

  it('should search items', () => {
    service.searchItems(testData.south.list[0].id, { name: undefined, scanModeId: undefined, enabled: undefined, page: 0 });
    assert.deepStrictEqual(southConnectorRepository.searchItems.mock.calls[0].arguments, [
      testData.south.list[0].id,
      { name: undefined, scanModeId: undefined, enabled: undefined, page: 0 }
    ]);
  });

  it('should find an item', () => {
    service.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id);
    assert.deepStrictEqual(southConnectorRepository.findItemById.mock.calls[0].arguments, [
      testData.south.list[0].id,
      testData.south.list[0].items[0].id
    ]);
  });

  it('should throw not found error if item does not exist', () => {
    southConnectorRepository.findItemById.mock.mockImplementation(() => null);

    assert.throws(
      () => service.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id),
      new NotFoundError(`Item "${testData.south.list[0].items[0].id}" not found`)
    );
    assert.deepStrictEqual(southConnectorRepository.findItemById.mock.calls[0].arguments, [
      testData.south.list[0].id,
      testData.south.list[0].items[0].id
    ]);
  });

  it('should get item last value when cache has value', () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    const cached = {
      itemId,
      groupId: null,
      queryTime: '2024-01-01T00:00:00.000Z',
      value: { temperature: 42 },
      trackedInstant: '2024-01-02T00:00:00.000Z'
    };
    southCacheRepository.getItemLastValue.mock.mockImplementation(() => cached);

    const result = service.getItemLastValue(southId, itemId);

    assert.deepStrictEqual(southConnectorRepository.findSouthById.mock.calls[0].arguments, [southId]);
    assert.deepStrictEqual(southConnectorRepository.findItemById.mock.calls[0].arguments, [southId, itemId]);
    assert.deepStrictEqual(southCacheRepository.getItemLastValue.mock.calls[0].arguments, [southId, itemId]);
    assert.strictEqual(southCacheRepository.getGroupLastValue.mock.calls.length, 0);
    assert.deepStrictEqual(result, {
      itemLastValue: {
        groupId: null,
        groupName: '',
        itemId,
        itemName: testData.south.list[0].items[0].name,
        queryTime: cached.queryTime,
        value: cached.value,
        trackedInstant: cached.trackedInstant
      },
      groupLastValue: null
    });
  });

  it('should get item last value when cache has no value', () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    southCacheRepository.getItemLastValue.mock.mockImplementation(() => null);

    const result = service.getItemLastValue(southId, itemId);

    assert.deepStrictEqual(southCacheRepository.getItemLastValue.mock.calls[0].arguments, [southId, itemId]);
    assert.deepStrictEqual(result, { itemLastValue: null, groupLastValue: null });
  });

  it('should get both the item last value and the group last value when the item belongs to a group', () => {
    const southConnector = testData.south.list[2];
    const southId = southConnector.id;
    const groupId = 'group-123';
    const groupedItem = {
      ...southConnector.items[0],
      syncWithGroup: true,
      group: {
        id: groupId,
        name: 'My Group',
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: null,
        recoveryStrategy: null,
        emptyIntervalStrategy: null,
        cachingStrategy: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    };
    southConnectorRepository.findSouthById.mock.mockImplementationOnce(() => southConnector);
    southConnectorRepository.findItemById.mock.mockImplementationOnce(() => groupedItem);
    // southConnector.type is 'opcua' (IoT-family), so the item's own last value comes from the
    // dedicated caching-strategy cache (getItemCachedValue), not the legacy getItemLastValue.
    const itemCached = {
      value: { temperature: 99 },
      trackedInstant: '2024-03-01T00:01:00.000Z'
    };
    const groupCached = {
      itemId: null,
      groupId,
      queryTime: '2024-03-01T00:02:00.000Z',
      value: { temperature: 100 },
      trackedInstant: '2024-03-01T00:03:00.000Z'
    };
    southCacheRepository.getItemCachedValue.mock.mockImplementationOnce(() => itemCached);
    southCacheRepository.getGroupLastValue.mock.mockImplementationOnce(() => groupCached);

    const result = service.getItemLastValue(southId, groupedItem.id);

    assert.deepStrictEqual(southCacheRepository.getItemCachedValue.mock.calls[0].arguments, [southId, groupedItem.id]);
    assert.deepStrictEqual(southCacheRepository.getGroupLastValue.mock.calls[0].arguments, [southId, groupId]);
    assert.deepStrictEqual(result, {
      itemLastValue: {
        groupId,
        groupName: 'My Group',
        itemId: groupedItem.id,
        itemName: groupedItem.name,
        queryTime: itemCached.trackedInstant,
        value: itemCached.value,
        trackedInstant: itemCached.trackedInstant
      },
      groupLastValue: {
        groupId,
        groupName: 'My Group',
        itemId: groupedItem.id,
        itemName: groupedItem.name,
        queryTime: groupCached.queryTime,
        value: groupCached.value,
        trackedInstant: groupCached.trackedInstant
      }
    });
  });

  it('should not call getGroupLastValue when the item does not belong to a group', () => {
    service.getItemLastValue(testData.south.list[0].id, testData.south.list[0].items[0].id);

    assert.strictEqual(southCacheRepository.getGroupLastValue.mock.calls.length, 0);
  });

  it('should create an item', async () => {
    await service.createItem(testData.south.list[0].id, testData.south.itemCommand, 'userTest');

    assert.deepStrictEqual(southConnectorRepository.findSouthById.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  it('should create an item with null id', async () => {
    await service.createItem(testData.south.list[0].id, { ...testData.south.itemCommand, id: null }, 'userTest');

    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
    assert.strictEqual(southConnectorRepository.saveItem.mock.calls[0].arguments[1].id, '');
  });

  it('should create item with group', async () => {
    const group = buildGroup({ name: 'Test Group' });
    southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [buildGroup({ id: 'otherGroup' }), group]);

    await service.createItem(testData.south.list[0].id, { ...testData.south.itemCommand, groupId: 'group1' }, 'userTest');

    assert.deepStrictEqual(southItemGroupRepository.findBySouthId.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
    const savedItem = southConnectorRepository.saveItem.mock.calls[0].arguments[1];
    assert.strictEqual(savedItem.group, group);
    assert.strictEqual(savedItem.createdBy, 'userTest');
    assert.strictEqual(savedItem.updatedBy, 'userTest');
  });

  it('should create item without group when groupId is null', async () => {
    await service.createItem(testData.south.list[0].id, { ...testData.south.itemCommand, groupId: null }, 'userTest');

    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
    assert.deepStrictEqual(southConnectorRepository.saveItem.mock.calls[0].arguments[1].group, null);
  });

  it('should not create item with non-existent groupId', async () => {
    southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [buildGroup()]);

    await assert.rejects(
      service.createItem(testData.south.list[0].id, { ...testData.south.itemCommand, groupId: 'non-existent-group-id' }, 'userTest'),
      NotFoundError
    );

    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 0);
    assert.strictEqual(engine.reloadSouthItems.mock.calls.length, 0);
  });

  it('should name the non-existent groupId in the error', async () => {
    await assert.rejects(
      service.createItem(testData.south.list[0].id, { ...testData.south.itemCommand, groupId: 'non-existent-group-id' }, 'userTest'),
      new NotFoundError('Group "non-existent-group-id" not found')
    );
  });

  it('should update an item', async () => {
    await service.updateItem(testData.south.list[0].id, testData.south.list[0].items[0].id, testData.south.itemCommand, 'userTest');

    assert.deepStrictEqual(southConnectorRepository.findItemById.mock.calls[0].arguments, [
      testData.south.list[0].id,
      testData.south.list[0].items[0].id
    ]);
    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
    assert.strictEqual(southConnectorRepository.saveItem.mock.calls[0].arguments[1].id, testData.south.itemCommand.id);
  });

  it('should update item with group', async () => {
    const group = buildGroup({ id: 'group2', name: 'Update Group' });
    southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [buildGroup(), group]);

    await service.updateItem(
      testData.south.list[0].id,
      testData.south.list[0].items[0].id,
      { ...testData.south.itemCommand, groupId: 'group2' },
      'userTest'
    );

    assert.deepStrictEqual(southItemGroupRepository.findBySouthId.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
    const savedItem = southConnectorRepository.saveItem.mock.calls[0].arguments[1];
    assert.strictEqual(savedItem.group, group);
    // The item keeps its creator
    assert.strictEqual(savedItem.createdBy, testData.south.list[0].items[0].createdBy);
    assert.strictEqual(savedItem.updatedBy, 'userTest');
  });

  it('should update item without group when groupId is null', async () => {
    await service.updateItem(
      testData.south.list[0].id,
      testData.south.list[0].items[0].id,
      { ...testData.south.itemCommand, groupId: null },
      'userTest'
    );

    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
    assert.deepStrictEqual(southConnectorRepository.saveItem.mock.calls[0].arguments[1].group, null);
  });

  describe('with north transformers attached along with the item', () => {
    const savedSouth = testData.south.list[0];
    const savedItem = savedSouth.items[0];
    const attach = (
      scope: 'item' | 'group' | 'south',
      overrides: Partial<SouthConnectorFolderScannerItemCommandDTO> = {}
    ): SouthConnectorFolderScannerItemCommandDTO => ({
      ...(testData.south.itemCommand as SouthConnectorFolderScannerItemCommandDTO),
      name: savedItem.name,
      northTransformers: [
        { northId: testData.north.list[0].id, scope, transformerId: testData.transformers.list[0].id, options: { a: 1 } }
      ],
      ...overrides
    });

    it('should attach a transformer to the item once it is created, in the same transaction', async () => {
      await service.createItem(savedSouth.id, attach('item'), 'userTest');

      assert.strictEqual(database.transaction.mock.calls.length, 1);
      assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
      assert.deepStrictEqual(northConnectorRepository.addOrEditTransformer.mock.calls[0].arguments, [
        testData.north.list[0].id,
        {
          id: '',
          transformer: testData.transformers.list[0],
          options: { a: 1 },
          source: { type: 'south', south: savedSouth, group: undefined, items: [savedItem], excludedItems: [] }
        },
        'userTest'
      ]);
      assert.deepStrictEqual(engine.updateNorthConfiguration.mock.calls[0].arguments, [testData.north.list[0].id]);
    });

    it('should attach a transformer to the group of the item', async () => {
      const group = buildGroup();
      southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [group]);
      southItemGroupRepository.findById.mock.mockImplementation(() => group);
      southConnectorRepository.findSouthById.mock.mockImplementation(() => ({
        ...savedSouth,
        items: [{ ...savedItem, group }]
      }));

      await service.updateItem(savedSouth.id, savedItem.id, attach('group', { groupId: group.id }), 'userTest');

      assert.deepStrictEqual(southItemGroupRepository.findById.mock.calls[0].arguments, [group.id]);
      const source = northConnectorRepository.addOrEditTransformer.mock.calls[0].arguments[1].source;
      assert.deepStrictEqual(source.type === 'south' && { group: source.group, items: source.items }, { group, items: [] });
      assert.deepStrictEqual(engine.updateNorthConfiguration.mock.calls[0].arguments, [testData.north.list[0].id]);
    });

    it('should attach a transformer to all the items of the south', async () => {
      await service.updateItem(savedSouth.id, savedItem.id, attach('south'), 'userTest');

      const source = northConnectorRepository.addOrEditTransformer.mock.calls[0].arguments[1].source;
      assert.deepStrictEqual(source.type === 'south' && { group: source.group, items: source.items }, { group: undefined, items: [] });
    });

    it('should not change the norths when no transformer is attached', async () => {
      await service.updateItem(savedSouth.id, savedItem.id, testData.south.itemCommand, 'userTest');

      assert.strictEqual(northConnectorRepository.addOrEditTransformer.mock.calls.length, 0);
      assert.strictEqual(engine.updateNorthConfiguration.mock.calls.length, 0);
    });

    it('should not save the item when the north does not exist', async () => {
      northConnectorRepository.findNorthById.mock.mockImplementation(() => null);

      await assert.rejects(
        service.createItem(savedSouth.id, attach('item'), 'userTest'),
        new NotFoundError(`North "${testData.north.list[0].id}" not found`)
      );
      assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 0);
    });

    it('should not save the item when the transformer does not exist', async () => {
      transformerService.findById.mock.mockImplementation(() => {
        throw new NotFoundError('Transformer "unknown" not found');
      });

      await assert.rejects(service.createItem(savedSouth.id, attach('item'), 'userTest'), NotFoundError);
      assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 0);
    });

    it('should not attach a transformer to the group of an item without one', async () => {
      await assert.rejects(
        service.createItem(savedSouth.id, attach('group', { groupId: null, groupName: null }), 'userTest'),
        new OIBusValidationError(`Item "${savedItem.name}" has no group to attach a transformer to`)
      );
      assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 0);
    });

    it('should not reload anything when a transformer cannot be attached', async () => {
      northConnectorRepository.addOrEditTransformer.mock.mockImplementation(() => {
        throw new Error('database error');
      });

      await assert.rejects(service.createItem(savedSouth.id, attach('item'), 'userTest'), new Error('database error'));
      assert.strictEqual(engine.reloadSouthItems.mock.calls.length, 0);
      assert.strictEqual(engine.updateNorthConfiguration.mock.calls.length, 0);
    });

    it('should attach the transformers of the items of a south once it is created', async () => {
      mock.method(service, 'retrieveSecretsFromSouth', () => null);

      await service.create(
        { ...(testData.south.command as SouthConnectorFolderScannerCommandDTO), items: [attach('south')] },
        null,
        'userTest'
      );

      assert.strictEqual(database.transaction.mock.calls.length, 1);
      const [northId, transformer] = northConnectorRepository.addOrEditTransformer.mock.calls[0].arguments;
      assert.strictEqual(northId, testData.north.list[0].id);
      assert.deepStrictEqual(transformer.source.type === 'south' && transformer.source.south, savedSouth);
      assert.deepStrictEqual(engine.updateNorthConfiguration.mock.calls[0].arguments, [testData.north.list[0].id]);
    });

    it('should attach the transformers of the items of a south when it is updated', async () => {
      await service.update(
        savedSouth.id,
        { ...(testData.south.command as SouthConnectorFolderScannerCommandDTO), items: [attach('item')] },
        'userTest'
      );

      assert.strictEqual(northConnectorRepository.addOrEditTransformer.mock.calls.length, 1);
      assert.deepStrictEqual(engine.updateNorthConfiguration.mock.calls[0].arguments, [testData.north.list[0].id]);
    });
  });

  describe('when an opcua item synced with a group is updated', () => {
    // opcua (testData.south.list[2]) is NOT in SOUTH_SINGLE_ITEMS: a synced group there shares one
    // cache row, so leaving it must seed the item's own row from that shared row.
    const southConnector = testData.south.list[2];
    const group = buildGroup({ southId: southConnector.id, readDelay: null });
    const existingItem = { ...southConnector.items[0], group, syncWithGroup: true };

    beforeEach(() => {
      southConnectorRepository.findSouthById.mock.mockImplementation(() => southConnector);
      southConnectorRepository.findItemById.mock.mockImplementation(() => existingItem);
    });

    it("should carry over the group's tracked instant, but not its value, when an item's group is set to none", async () => {
      const groupCache = buildGroupCache(group.id);
      southCacheRepository.getGroupLastValue.mock.mockImplementation(() => groupCache);

      await service.updateItem(southConnector.id, existingItem.id, leaveGroupCommand, 'userTest');

      assert.deepStrictEqual(southCacheRepository.getGroupLastValue.mock.calls[0].arguments, [southConnector.id, group.id]);
      assert.strictEqual(southCacheRepository.saveItemLastValue.mock.calls.length, 1);
      assert.deepStrictEqual(southCacheRepository.saveItemLastValue.mock.calls[0].arguments, [
        southConnector.id,
        {
          itemId: existingItem.id,
          groupId: null,
          queryTime: groupCache.queryTime,
          value: null, // the group's last VALUE is deliberately not carried over
          trackedInstant: groupCache.trackedInstant // but its tracked instant is
        }
      ]);
    });

    it('should not touch the cache when an item moves from one synced group straight to another', async () => {
      // Still consults a group cache afterward (just a different one) — nothing to carry over.
      const newGroup = buildGroup({ id: 'group2', name: 'Group 2', southId: southConnector.id, readDelay: null });
      southItemGroupRepository.findById.mock.mockImplementation(() => newGroup);
      // copySouthItemCommandToSouthItemEntity resolves command.groupId to an entity via the (mocked)
      // checkGroups() util — without this, southItemEntity.group would stay undefined.
      utilsExports.checkGroups.mock.mockImplementation(() => newGroup);

      await service.updateItem(
        southConnector.id,
        existingItem.id,
        { ...testData.south.itemCommand, groupId: newGroup.id, syncWithGroup: true },
        'userTest'
      );

      assert.strictEqual(southCacheRepository.getGroupLastValue.mock.calls.length, 0);
      assert.strictEqual(southCacheRepository.saveItemLastValue.mock.calls.length, 0);
    });

    it('should not save an item last value when the group cache has no tracked instant', async () => {
      // group cache exists but has never been assigned a tracked instant
      southCacheRepository.getGroupLastValue.mock.mockImplementation(() => ({
        ...buildGroupCache(group.id),
        value: null,
        trackedInstant: null
      }));

      await service.updateItem(southConnector.id, existingItem.id, leaveGroupCommand, 'userTest');

      assert.strictEqual(southCacheRepository.getGroupLastValue.mock.calls.length, 1);
      assert.strictEqual(southCacheRepository.saveItemLastValue.mock.calls.length, 0);
    });

    it('should not save an item last value when there is no group cache at all', async () => {
      southCacheRepository.getGroupLastValue.mock.mockImplementation(() => null);

      await service.updateItem(southConnector.id, existingItem.id, leaveGroupCommand, 'userTest');

      assert.strictEqual(southCacheRepository.getGroupLastValue.mock.calls.length, 1);
      assert.strictEqual(southCacheRepository.saveItemLastValue.mock.calls.length, 0);
    });
  });

  it('should not touch the cache when the connector cannot batch, even if the item leaves a synced group', async () => {
    // folder-scanner (testData.south.list[0], the default findSouthById() mock) is a
    // SOUTH_SINGLE_ITEMS connector: it never shared a group cache, so there is nothing to carry over.
    const existingItem = { ...testData.south.list[0].items[0], group: buildGroup(), syncWithGroup: true };
    southConnectorRepository.findItemById.mock.mockImplementation(() => existingItem);

    await service.updateItem(testData.south.list[0].id, existingItem.id, { ...testData.south.itemCommand, groupId: null }, 'userTest');

    assert.strictEqual(southCacheRepository.getGroupLastValue.mock.calls.length, 0);
    assert.strictEqual(southCacheRepository.saveItemLastValue.mock.calls.length, 0);
  });

  it('should enable an item', async () => {
    await service.enableItem(testData.south.list[0].id, testData.south.list[0].items[0].id);

    assert.deepStrictEqual(southConnectorRepository.findItemById.mock.calls[0].arguments, [
      testData.south.list[0].id,
      testData.south.list[0].items[0].id
    ]);
    assert.deepStrictEqual(southConnectorRepository.enableItem.mock.calls[0].arguments, [testData.south.list[0].items[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  it('should disable an item', async () => {
    await service.disableItem(testData.south.list[0].id, testData.south.list[0].items[0].id);

    assert.deepStrictEqual(southConnectorRepository.findItemById.mock.calls[0].arguments, [
      testData.south.list[0].id,
      testData.south.list[0].items[0].id
    ]);
    assert.deepStrictEqual(southConnectorRepository.disableItem.mock.calls[0].arguments, [testData.south.list[0].items[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  describe('with two items', () => {
    const itemIds = [testData.south.list[0].items[0].id, testData.south.list[0].items[1].id];

    beforeEach(() => {
      southConnectorRepository.findItemById.mock.mockImplementation(
        seq(
          () => testData.south.list[0].items[0],
          () => testData.south.list[0].items[1]
        )
      );
    });

    it('should enable multiple south items', async () => {
      await service.enableItems(testData.south.list[0].id, itemIds);

      assert.deepStrictEqual(southConnectorRepository.enableItem.mock.calls[0].arguments, [testData.south.list[0].items[0].id]);
      assert.deepStrictEqual(southConnectorRepository.enableItem.mock.calls[1].arguments, [testData.south.list[0].items[1].id]);
      assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
      assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
    });

    it('should disable multiple south items', async () => {
      await service.disableItems(testData.south.list[0].id, itemIds);

      assert.deepStrictEqual(southConnectorRepository.disableItem.mock.calls[0].arguments, [testData.south.list[0].items[0].id]);
      assert.deepStrictEqual(southConnectorRepository.disableItem.mock.calls[1].arguments, [testData.south.list[0].items[1].id]);
      assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
      assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
    });

    it('should delete multiple south items', async () => {
      await service.deleteItems(testData.south.list[0].id, itemIds, 'userTest');

      assert.deepStrictEqual(southConnectorRepository.deleteItem.mock.calls[0].arguments, [
        testData.south.list[0].id,
        testData.south.list[0].items[0].id,
        'userTest'
      ]);
      assert.deepStrictEqual(southConnectorRepository.deleteItem.mock.calls[1].arguments, [
        testData.south.list[0].id,
        testData.south.list[0].items[1].id,
        'userTest'
      ]);
      assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
      assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
    });
  });

  it('should delete an item', async () => {
    await service.deleteItem(testData.south.list[0].id, testData.south.list[0].items[0].id, 'userTest');

    assert.deepStrictEqual(southConnectorRepository.findItemById.mock.calls[0].arguments, [
      testData.south.list[0].id,
      testData.south.list[0].items[0].id
    ]);
    assert.deepStrictEqual(southConnectorRepository.deleteItem.mock.calls[0].arguments, [
      testData.south.list[0].id,
      testData.south.list[0].items[0].id,
      'userTest'
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  it('should delete all items', async () => {
    await service.deleteAllItems(testData.south.list[0].id, 'userTest');

    assert.deepStrictEqual(southConnectorRepository.deleteAllItemsBySouth.mock.calls[0].arguments, [testData.south.list[0].id, 'userTest']);
    assert.deepStrictEqual(southCacheRepository.deleteItemsBySouth.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  it('should properly check items', async () => {
    const csvData = [
      folderScannerRow('item1'),
      folderScannerRow('item2bis', { scanMode: 'bad scan mode' }),
      folderScannerRow('item3', { settings_badItem: 100 }),
      folderScannerRow('item4', { settings_ignoreModifiedDate: 12 }),
      folderScannerRow('item5', { description: 'item5 description', settings_regex: '' })
    ];
    utilsExports.parseCsvImport.mock.mockImplementation(() => csvData);
    validator.validateSettings.mock.mockImplementation(
      seq(
        async () => {
          throw new Error('validation error');
        }, // item4 reaches validateSettings first
        async () => undefined // item5 passes
      )
    );

    const result = await service.checkImportItems(testData.south.list[0].type, 'file content', ',', existingItemsOf(0));
    assert.deepStrictEqual(result, {
      items: [
        buildImportedItem(
          'item5',
          { ignoreModifiedDate: false, minAge: 100, preserveFiles: true, regex: undefined },
          { description: 'item5 description' }
        )
      ],
      errors: [
        { error: 'Item name "item1" already used', item: folderScannerRow('item1') },
        {
          error: 'Scan mode "bad scan mode" not found for item "item2bis"',
          item: folderScannerRow('item2bis', { scanMode: 'bad scan mode' })
        },
        { error: 'Settings "badItem" not accepted in manifest', item: folderScannerRow('item3', { settings_badItem: 100 }) },
        { error: 'validation error', item: folderScannerRow('item4', { settings_ignoreModifiedDate: 12 }) }
      ]
    });
  });

  it('should convert number settings when checking items', async () => {
    const csvData = [
      { name: 'numberItem', enabled: 'true', settings_regex: '*', settings_minAge: '100', scanMode: testData.scanMode.list[0].name },
      { name: 'emptyNumberItem', enabled: 'true', settings_regex: '*', settings_minAge: '', scanMode: testData.scanMode.list[0].name }
    ];
    utilsExports.parseCsvImport.mock.mockImplementation(() => csvData);

    const result = await service.checkImportItems(testData.south.list[0].type, 'file content', ',', []);

    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(
      result.items.map(item => item.settings),
      [
        { regex: '*', minAge: 100 },
        { regex: '*', minAge: undefined }
      ]
    );
    assert.deepStrictEqual(validator.validateSettings.mock.calls[0].arguments[1], { regex: '*', minAge: 100 });
    assert.deepStrictEqual(validator.validateSettings.mock.calls[1].arguments[1], { regex: '*', minAge: undefined });
  });

  it('should properly check items with array or object', async () => {
    utilsExports.parseCsvImport.mock.mockImplementation(() => [
      {
        name: 'item',
        enabled: 'true',
        settings_query: 'query',
        settings_trackingInstant: JSON.stringify({ trackInstant: false }),
        scanMode: testData.scanMode.list[0].name
      }
    ]);

    const result = await service.checkImportItems(testData.south.list[1].type, 'file content', ',', existingItemsOf(1));
    assert.deepStrictEqual(result, {
      items: [buildImportedItem('item', { query: 'query', trackingInstant: { trackInstant: false } })],
      errors: []
    });
  });

  it('should properly check items with group name from CSV', async () => {
    utilsExports.parseCsvImport.mock.mockImplementation(() => [folderScannerRow('itemWithGroup', { group: 'Test Group' })]);

    const result = await service.checkImportItems(testData.south.list[0].type, 'file content', ',', existingItemsOf(0));
    assert.deepStrictEqual(result, {
      items: [
        buildImportedItem(
          'itemWithGroup',
          { ignoreModifiedDate: false, minAge: 100, preserveFiles: true, regex: '*' },
          { group: { id: '', standardSettings: { name: 'Test Group' } } }
        )
      ],
      errors: []
    });
  });

  it('should use the recoveryStrategy provided in the CSV instead of the default', async () => {
    utilsExports.parseCsvImport.mock.mockImplementation(() => [
      folderScannerRow('itemWithRecoveryStrategy', { recoveryStrategy: 'newest' })
    ]);

    const result = await service.checkImportItems(testData.south.list[0].type, 'file content', ',', existingItemsOf(0));

    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.items[0].recoveryStrategy, 'newest');
  });

  it('should properly check items with group name and no scan mode from CSV', async () => {
    utilsExports.parseCsvImport.mock.mockImplementation(() => [
      folderScannerRow('itemWithGroupNoScanMode', { scanMode: '', group: 'Test Group' })
    ]);

    const result = await service.checkImportItems(testData.south.list[0].type, 'file content', ',', existingItemsOf(0));
    assert.deepStrictEqual(result, {
      items: [
        buildImportedItem(
          'itemWithGroupNoScanMode',
          { ignoreModifiedDate: false, minAge: 100, preserveFiles: true, regex: '*' },
          { scanMode: null, group: { id: '', standardSettings: { name: 'Test Group' } } }
        )
      ],
      errors: []
    });
  });

  it('should reject items with no scan mode and no group from CSV', async () => {
    const csvRow = folderScannerRow('itemWithoutGroupOrScanMode', { scanMode: '', group: '' });
    utilsExports.parseCsvImport.mock.mockImplementation(() => [csvRow]);

    const result = await service.checkImportItems(testData.south.list[0].type, 'file content', ',', existingItemsOf(0));
    assert.deepStrictEqual(result, {
      items: [],
      errors: [{ error: `Scan mode not specified for item "itemWithoutGroupOrScanMode"`, item: csvRow }]
    });
  });

  it('should throw error if delimiter does not match', async () => {
    utilsExports.parseCsvImport.mock.mockImplementation(() => {
      throw new OIBusValidationError(`The entered delimiter "," does not correspond to the file delimiter ";"`);
    });

    await assert.rejects(
      async () => service.checkImportItems(testData.south.command.type, 'file content', ',', []),
      new OIBusValidationError(`The entered delimiter "," does not correspond to the file delimiter ";"`)
    );
    assert.deepStrictEqual(utilsExports.parseCsvImport.mock.calls.at(-1)!.arguments, ['file content', ',']);
  });

  it('should import items', async () => {
    await service.importItems(testData.south.list[0].id, [testData.south.itemCommand], 'userTest');

    assert.strictEqual(southConnectorRepository.saveAllItems.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  it('should import items with groupName and create group when it does not exist', async () => {
    const newGroup = buildGroup({ id: 'newGroupId', name: 'New Import Group' });
    southItemGroupRepository.findByNameAndSouthId.mock.mockImplementation(() => null);
    utilsExports.checkGroups.mock.mockImplementation(() => newGroup);
    southItemGroupRepository.create.mock.mockImplementation(() => newGroup);

    await service.importItems(
      testData.south.list[0].id,
      [{ ...testData.south.itemCommand, groupName: 'New Import Group', groupId: null }],
      'userTest'
    );

    assert.deepStrictEqual(southItemGroupRepository.findByNameAndSouthId.mock.calls[0].arguments, [
      'New Import Group',
      testData.south.list[0].id
    ]);
    assert.strictEqual(southItemGroupRepository.create.mock.calls.length, 1);
    assert.strictEqual(southConnectorRepository.saveAllItems.mock.calls.length, 1);
    assert.deepStrictEqual(southConnectorRepository.saveAllItems.mock.calls[0].arguments[1][0].group, newGroup);

    // The group snapshot taken before creation is empty; the newly created group must be added to it,
    // otherwise checkGroups() (real implementation) would throw "Group not found" for every item in it.
    assert.strictEqual(utilsExports.checkGroups.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.checkGroups.mock.calls[0].arguments, [[newGroup], 'newGroupId', null]);
  });

  it('should create a new group using the startTimeOffset, endTimeOffset, maxReadInterval, readDelay and recoveryStrategy of the first item where the group is noticed', async () => {
    const newGroup = buildGroup({
      id: 'newGroupId',
      name: 'New Import Group',
      startTimeOffset: 10,
      endTimeOffset: 20,
      maxReadInterval: 3600,
      readDelay: 200,
      recoveryStrategy: 'oldest',
      emptyIntervalStrategy: 'keep'
    });
    southItemGroupRepository.findByNameAndSouthId.mock.mockImplementation(() => null);
    southItemGroupRepository.create.mock.mockImplementation(() => newGroup);

    // Two items reference the same new group: only the first one's historian settings must be used
    const firstItemWithGroupName: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupName: 'New Import Group',
      groupId: null,
      startTimeOffset: 10,
      endTimeOffset: 20,
      maxReadInterval: 3600,
      readDelay: 200,
      recoveryStrategy: 'oldest',
      emptyIntervalStrategy: 'keep',
      cachingStrategy: null
    };
    const secondItemWithGroupName: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      id: 'anotherNewSouthItemId',
      groupName: 'New Import Group',
      groupId: null,
      startTimeOffset: 999,
      endTimeOffset: 999,
      maxReadInterval: 999,
      readDelay: 999,
      recoveryStrategy: 'newest',
      emptyIntervalStrategy: 'advance',
      cachingStrategy: null
    };

    await service.importItems(testData.south.list[0].id, [firstItemWithGroupName, secondItemWithGroupName], 'userTest');

    assert.strictEqual(southItemGroupRepository.create.mock.calls.length, 1);
    assert.deepStrictEqual(southItemGroupRepository.create.mock.calls[0].arguments[0], {
      name: 'New Import Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      startTimeOffset: 10,
      endTimeOffset: 20,
      maxReadInterval: 3600,
      readDelay: 200,
      recoveryStrategy: 'oldest',
      emptyIntervalStrategy: 'keep',
      cachingStrategy: null
    });
  });

  it('should trim a group name with surrounding whitespace before creating and resolving the group', async () => {
    const newGroup = buildGroup({ id: 'newGroupId' });
    southItemGroupRepository.findByNameAndSouthId.mock.mockImplementation(() => null);
    utilsExports.checkGroups.mock.mockImplementation(() => newGroup);
    southItemGroupRepository.create.mock.mockImplementation(() => newGroup);

    // Simulates a CSV cell with a trailing tab/whitespace character
    await service.importItems(
      testData.south.list[0].id,
      [{ ...testData.south.itemCommand, groupName: 'Group1\t', groupId: null }],
      'userTest'
    );

    // The group must be looked up / created with the trimmed name
    assert.strictEqual(southItemGroupRepository.findByNameAndSouthId.mock.calls[0].arguments[0], 'Group1');
    assert.strictEqual(southItemGroupRepository.create.mock.calls.length, 1);
    assert.strictEqual(southItemGroupRepository.create.mock.calls[0].arguments[0].name, 'Group1');

    // The item must resolve to the newly created group's id rather than falling through with the
    // untrimmed group name (which would previously throw `Group "Group1\t" not found`). The newly
    // created group must also be present in the `groups` list passed to checkGroups (which is a
    // snapshot taken before this group existed) or checkGroups would throw `Group not found`.
    assert.strictEqual(utilsExports.checkGroups.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.checkGroups.mock.calls[0].arguments, [[newGroup], 'newGroupId', null]);
  });

  it('should import items with groupName and use existing group when it exists', async () => {
    const existingGroup = buildGroup({ id: 'existingGroupId', name: 'Existing Import Group' });
    southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [existingGroup]);
    southItemGroupRepository.findByNameAndSouthId.mock.mockImplementation(() => existingGroup);

    await service.importItems(
      testData.south.list[0].id,
      [{ ...testData.south.itemCommand, groupName: 'Existing Import Group', groupId: null }],
      'userTest'
    );

    assert.deepStrictEqual(southItemGroupRepository.findByNameAndSouthId.mock.calls[0].arguments, [
      'Existing Import Group',
      testData.south.list[0].id
    ]);
    assert.strictEqual(southItemGroupRepository.create.mock.calls.length, 0);
    assert.strictEqual(southConnectorRepository.saveAllItems.mock.calls.length, 1);
    assert.strictEqual(southConnectorRepository.saveAllItems.mock.calls[0].arguments[1][0].group, existingGroup);
  });

  it('should retrieve secrets from south', () => {
    const manifest = { ...testData.south.manifest, id: testData.south.list[0].type };
    assert.deepStrictEqual(service.retrieveSecretsFromSouth('southId', manifest), testData.south.list[0]);
  });

  it('should not retrieve secrets from south', () => {
    assert.deepStrictEqual(service.retrieveSecretsFromSouth(null, testData.south.manifest), null);
  });

  it('should throw error if connector not found when retrieving secrets from bad south type', () => {
    southConnectorRepository.findSouthById.mock.mockImplementation(() => testData.south.list[1]);
    assert.throws(
      () => service.retrieveSecretsFromSouth('southId', testData.south.manifest),
      new Error(`South connector "southId" (type "${testData.south.list[1].type}") must be of the type "${testData.south.manifest.id}"`)
    );
  });

  it('should properly convert to DTO', () => {
    const southEntity = testData.south.list[0];
    const southLight: SouthConnectorEntityLight = {
      id: southEntity.id,
      name: southEntity.name,
      type: southEntity.type,
      description: southEntity.description,
      enabled: southEntity.enabled,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    assert.deepStrictEqual(toSouthConnectorLightDTO(southLight, getUserInfo), {
      id: southLight.id,
      name: southLight.name,
      type: southLight.type,
      description: southLight.description,
      enabled: southLight.enabled,
      createdBy: getUserInfo(southLight.createdBy),
      updatedBy: getUserInfo(southLight.updatedBy),
      createdAt: southLight.createdAt,
      updatedAt: southLight.updatedAt
    });
    assert.deepStrictEqual(toSouthConnectorDTO(southEntity, getUserInfo), {
      id: southEntity.id,
      name: southEntity.name,
      type: southEntity.type,
      description: southEntity.description,
      enabled: southEntity.enabled,
      settings: southEntity.settings,
      createdBy: getUserInfo(southEntity.createdBy),
      updatedBy: getUserInfo(southEntity.updatedBy),
      createdAt: southEntity.createdAt,
      updatedAt: southEntity.updatedAt,
      groups: [],
      items: southEntity.items.map(item => toSouthConnectorItemDTO(item, southEntity.type, getUserInfo))
    });
  });

  it('should properly convert to DTO with non-empty groups', () => {
    const group = buildGroup({
      startTimeOffset: 5,
      maxReadInterval: 3600,
      readDelay: 200,
      createdBy: 'user1',
      updatedBy: 'user1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    });

    const result = toSouthConnectorDTO({ ...testData.south.list[0], groups: [group] }, getUserInfo);

    assert.strictEqual(result.groups.length, 1);
    assert.deepStrictEqual(result.groups[0], {
      id: group.id,
      standardSettings: {
        name: group.name,
        scanMode: toScanModeDTO(group.scanMode, getUserInfo)
      },
      historySettings: {
        startTimeOffset: group.startTimeOffset,
        endTimeOffset: group.endTimeOffset,
        maxReadInterval: group.maxReadInterval,
        readDelay: group.readDelay,
        recoveryStrategy: group.recoveryStrategy,
        emptyIntervalStrategy: group.emptyIntervalStrategy,
        cachingStrategy: group.cachingStrategy
      },
      createdBy: getUserInfo(group.createdBy),
      updatedBy: getUserInfo(group.updatedBy),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    });
  });

  describe('Group operations', () => {
    it('should get groups for a south connector', () => {
      southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [
        buildGroup(),
        buildGroup({ id: 'group2', name: 'Group 2', scanMode: testData.scanMode.list[1], startTimeOffset: 10 })
      ]);

      const groups = service.getGroups(testData.south.list[0].id);
      assert.strictEqual(groups.length, 2);
      assert.strictEqual(groups[0].id, 'group1');
      assert.strictEqual(groups[1].id, 'group2');
      assert.deepStrictEqual(southConnectorRepository.findSouthById.mock.calls[0].arguments, [testData.south.list[0].id]);
    });

    it('should get a specific group by id', () => {
      southItemGroupRepository.findById.mock.mockImplementation(() => buildGroup());

      const group = service.getGroup(testData.south.list[0].id, 'group1');
      assert.strictEqual(group.id, 'group1');
      assert.strictEqual(group.name, 'Group 1');
      assert.deepStrictEqual(southConnectorRepository.findSouthById.mock.calls[0].arguments, [testData.south.list[0].id]);
      assert.deepStrictEqual(southItemGroupRepository.findById.mock.calls[0].arguments, ['group1']);
    });

    it('should throw NotFoundError when group not found', () => {
      southItemGroupRepository.findById.mock.mockImplementation(() => null);

      assert.throws(
        () => service.getGroup(testData.south.list[0].id, 'nonExistentGroup'),
        new NotFoundError('South item group "nonExistentGroup" not found')
      );
    });

    it('should throw NotFoundError when group belongs to different south connector', () => {
      southItemGroupRepository.findById.mock.mockImplementation(() => buildGroup({ southId: 'differentSouthId' }));

      assert.throws(
        () => service.getGroup(testData.south.list[0].id, 'group1'),
        new NotFoundError(`South item group "group1" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should create a group', () => {
      southItemGroupRepository.create.mock.mockImplementation(() =>
        buildGroup({ id: 'newGroupId', name: 'New Group', startTimeOffset: 5 })
      );

      const result = service.createGroup(testData.south.list[0].id, buildGroupCommand('New Group', { startTimeOffset: 5 }), 'testUser');
      assert.strictEqual(result.id, 'newGroupId');
      assert.strictEqual(result.name, 'New Group');
      assert.strictEqual(southItemGroupRepository.create.mock.calls.length, 1);
    });

    it('should create a group with null start/end time offset', () => {
      southItemGroupRepository.create.mock.mockImplementation(() => buildGroup({ id: 'newGroupId', name: 'Group With Null Overlap' }));

      const result = service.createGroup(testData.south.list[0].id, buildGroupCommand('Group With Null Overlap'), 'testUser');
      assert.strictEqual(result.startTimeOffset, null);
      const createCall = southItemGroupRepository.create.mock.calls[0];
      assert.strictEqual(createCall.arguments[0].startTimeOffset, null);
      assert.strictEqual(createCall.arguments[1], 'testUser');
    });

    it('should create a group with maxReadInterval and readDelay', () => {
      const historySettings = { startTimeOffset: 5, maxReadInterval: 3600, readDelay: 200 };
      southItemGroupRepository.create.mock.mockImplementation(() =>
        buildGroup({ id: 'newGroupId', name: 'Group With Throttling', ...historySettings })
      );

      const result = service.createGroup(
        testData.south.list[0].id,
        buildGroupCommand('Group With Throttling', historySettings),
        'testUser'
      );
      assert.strictEqual(result.id, 'newGroupId');
      assert.strictEqual(result.maxReadInterval, 3600);
      assert.strictEqual(result.readDelay, 200);
      const entity = southItemGroupRepository.create.mock.calls[0].arguments[0];
      assert.strictEqual(entity.name, 'Group With Throttling');
      assert.strictEqual(entity.maxReadInterval, 3600);
      assert.strictEqual(entity.readDelay, 200);
    });

    it('should throw error when creating group with duplicate name', () => {
      southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [buildGroup({ id: 'existingGroupId', name: 'Existing Group' })]);

      assert.throws(
        () => service.createGroup(testData.south.list[0].id, buildGroupCommand('Existing Group'), 'testUser'),
        new OIBusValidationError('A group with name "Existing Group" already exists for this south connector')
      );
    });

    describe('when updating an existing group', () => {
      const existingGroup = buildGroup({ id: 'groupToUpdate', name: 'Original Name' });

      beforeEach(() => {
        southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [existingGroup]);
      });

      it('should update a group', async () => {
        const updatedGroup: SouthItemGroupEntity = {
          ...existingGroup,
          name: 'Updated Group',
          scanMode: testData.scanMode.list[1],
          startTimeOffset: 15,
          maxReadInterval: 3600,
          readDelay: 200
        };
        southItemGroupRepository.findById.mock.mockImplementation(
          seq(
            () => existingGroup,
            () => updatedGroup
          )
        );

        const result = await service.updateGroup(
          testData.south.list[0].id,
          'groupToUpdate',
          'testUser',
          buildGroupCommand('Updated Group', { startTimeOffset: 15, maxReadInterval: 3600, readDelay: 200 }, testData.scanMode.list[1].id)
        );
        assert.strictEqual(result.name, 'Updated Group');
        assert.strictEqual(result.scanMode.id, testData.scanMode.list[1].id);
        assert.strictEqual(result.maxReadInterval, 3600);
        assert.strictEqual(result.readDelay, 200);
        assert.strictEqual(southItemGroupRepository.update.mock.calls.length, 1);
        assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
      });

      it('should update a group with null maxReadInterval and zero readDelay', async () => {
        southItemGroupRepository.findById.mock.mockImplementation(
          seq(
            () => existingGroup,
            () => ({ ...existingGroup, name: 'Updated Name Only' })
          )
        );

        const result = await service.updateGroup(
          testData.south.list[0].id,
          'groupToUpdate',
          'testUser',
          buildGroupCommand('Updated Name Only')
        );
        assert.strictEqual(result.name, 'Updated Name Only');
        assert.strictEqual(result.maxReadInterval, null);
        assert.strictEqual(result.readDelay, 0);
        const updateCall = southItemGroupRepository.update.mock.calls[0];
        assert.strictEqual(updateCall.arguments[0], 'groupToUpdate');
        assert.strictEqual(updateCall.arguments[1].name, 'Updated Name Only');
        assert.strictEqual(updateCall.arguments[1].maxReadInterval, null);
        assert.strictEqual(updateCall.arguments[1].readDelay, 0);
        assert.strictEqual(updateCall.arguments[2], 'testUser');
        assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
      });

      it('should update a group with a non-null endTimeOffset and a null readDelay', async () => {
        southItemGroupRepository.findById.mock.mockImplementation(
          seq(
            () => existingGroup,
            () => ({ ...existingGroup, endTimeOffset: 30 })
          )
        );

        await service.updateGroup(
          testData.south.list[0].id,
          'groupToUpdate',
          'testUser',
          buildGroupCommand('Updated Group Offsets', { endTimeOffset: 30, readDelay: null })
        );

        const entity = southItemGroupRepository.update.mock.calls[0].arguments[1];
        assert.strictEqual(entity.endTimeOffset, 30);
        assert.strictEqual(entity.readDelay, 0);
      });

      it('should throw error when update fails to find updated group', async () => {
        southItemGroupRepository.findById.mock.mockImplementation(
          seq(
            () => existingGroup,
            () => null
          )
        );

        await assert.rejects(
          async () => service.updateGroup(testData.south.list[0].id, 'groupToUpdate', 'testUser', buildGroupCommand('Updated Group')),
          new NotFoundError('Failed to update south item group "groupToUpdate"')
        );
      });

      it('should throw error when updating group with duplicate name', async () => {
        southItemGroupRepository.findById.mock.mockImplementation(() => existingGroup);
        southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [
          existingGroup,
          buildGroup({ id: 'otherGroup', name: 'Existing Group' })
        ]);

        await assert.rejects(
          async () => service.updateGroup(testData.south.list[0].id, 'groupToUpdate', 'testUser', buildGroupCommand('Existing Group')),
          new OIBusValidationError('A group with name "Existing Group" already exists for this south connector')
        );
      });
    });

    it('should throw error when updating non-existent group', async () => {
      southItemGroupRepository.findById.mock.mockImplementation(() => null);

      await assert.rejects(
        async () => service.updateGroup(testData.south.list[0].id, 'nonExistentGroup', 'testUser', buildGroupCommand('Updated Group')),
        new NotFoundError('South item group "nonExistentGroup" not found')
      );
    });

    it('should throw error when updating group that belongs to different south connector', async () => {
      southItemGroupRepository.findById.mock.mockImplementation(() =>
        buildGroup({ id: 'groupFromOtherSouth', name: 'Group From Other South', southId: 'differentSouthId' })
      );

      await assert.rejects(
        async () => service.updateGroup(testData.south.list[0].id, 'groupFromOtherSouth', 'testUser', buildGroupCommand('Updated Group')),
        new NotFoundError(`South item group "groupFromOtherSouth" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should delete a group', async () => {
      const groupToDelete = buildGroup({ id: 'groupToDelete', name: 'Group To Delete' });
      southItemGroupRepository.findById.mock.mockImplementation(() => groupToDelete);

      await service.deleteGroup(testData.south.list[0].id, 'groupToDelete', 'userTest');
      assert.deepStrictEqual(southConnectorRepository.deleteGroupAndUpdateItems.mock.calls[0].arguments, [
        testData.south.list[0].id,
        groupToDelete,
        false,
        'userTest'
      ]);
      assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
    });

    it("should carry over the group's tracked instant, but not its value, to every item that was synced with a deleted group", async () => {
      // opcua (testData.south.list[2]) is NOT in SOUTH_SINGLE_ITEMS: a synced group there shares one
      // cache row, so deleting it must seed each formerly-synced item's own row from that shared row.
      const southConnector = testData.south.list[2];
      southConnectorRepository.findSouthById.mock.mockImplementation(() => southConnector);

      const groupToDelete = buildGroup({ id: 'groupToDelete', name: 'Group To Delete', southId: southConnector.id });
      const syncedItem = { ...southConnector.items[0], group: groupToDelete, syncWithGroup: true };
      const unrelatedItem = { ...southConnector.items[1], group: null, syncWithGroup: false };
      southItemGroupRepository.findById.mock.mockImplementation(() => groupToDelete);
      southConnectorRepository.findAllItemsForSouth.mock.mockImplementation(() => [syncedItem, unrelatedItem]);
      const groupCache = buildGroupCache(groupToDelete.id);
      southCacheRepository.getGroupLastValue.mock.mockImplementation(() => groupCache);

      await service.deleteGroup(southConnector.id, 'groupToDelete', 'userTest');

      assert.deepStrictEqual(southCacheRepository.getGroupLastValue.mock.calls[0].arguments, [southConnector.id, groupToDelete.id]);
      assert.strictEqual(southCacheRepository.saveItemLastValue.mock.calls.length, 1);
      assert.deepStrictEqual(southCacheRepository.saveItemLastValue.mock.calls[0].arguments, [
        southConnector.id,
        {
          itemId: syncedItem.id,
          groupId: null,
          queryTime: groupCache.queryTime,
          value: null,
          trackedInstant: groupCache.trackedInstant
        }
      ]);
    });

    it('should throw error when deleting non-existent group', async () => {
      southItemGroupRepository.findById.mock.mockImplementation(() => null);

      await assert.rejects(
        async () => service.deleteGroup(testData.south.list[0].id, 'nonExistentGroup', 'userTest'),
        new NotFoundError('South item group "nonExistentGroup" not found')
      );
    });

    it('should throw error when deleting group that belongs to different south connector', async () => {
      southItemGroupRepository.findById.mock.mockImplementation(() =>
        buildGroup({ id: 'groupFromOtherSouth', name: 'Group From Other South', southId: 'differentSouthId' })
      );

      await assert.rejects(
        async () => service.deleteGroup(testData.south.list[0].id, 'groupFromOtherSouth', 'userTest'),
        new NotFoundError(`South item group "groupFromOtherSouth" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should move items to a group', async () => {
      southItemGroupRepository.findById.mock.mockImplementation(() => buildGroup({ id: 'targetGroup', name: 'Target Group' }));

      const itemIds = [testData.south.list[0].items[0].id];
      await service.moveItemsToGroup(testData.south.list[0].id, itemIds, 'targetGroup');

      assert.deepStrictEqual(southItemGroupRepository.findById.mock.calls[0].arguments, ['targetGroup']);
      assert.deepStrictEqual(southConnectorRepository.moveItemsToGroup.mock.calls[0].arguments, [itemIds, 'targetGroup']);
      assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
      assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
    });

    it('should throw error when moving items to group that belongs to different south connector', async () => {
      southItemGroupRepository.findById.mock.mockImplementation(() =>
        buildGroup({ id: 'groupFromOtherSouth', name: 'Group From Other South', southId: 'differentSouthId' })
      );

      await assert.rejects(
        async () => service.moveItemsToGroup(testData.south.list[0].id, [testData.south.list[0].items[0].id], 'groupFromOtherSouth'),
        new NotFoundError(`South item group "groupFromOtherSouth" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should remove items from groups when groupId is null', async () => {
      const itemIds = [testData.south.list[0].items[0].id];
      await service.moveItemsToGroup(testData.south.list[0].id, itemIds, null);

      assert.deepStrictEqual(southConnectorRepository.moveItemsToGroup.mock.calls[0].arguments, [itemIds, null]);
      assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
    });

    it("should carry over the group's tracked instant, but not its value, when items are moved out of a synced group to no group", async () => {
      // opcua (testData.south.list[2]) is NOT in SOUTH_SINGLE_ITEMS: a synced group there shares one
      // cache row, so moving items out of it must seed each item's own row from that shared row.
      const southConnector = testData.south.list[2];
      southConnectorRepository.findSouthById.mock.mockImplementation(() => southConnector);
      const group = buildGroup({ southId: southConnector.id });
      const item = { ...southConnector.items[0], group, syncWithGroup: true };
      southConnectorRepository.findItemById.mock.mockImplementation(() => item);
      const groupCache = buildGroupCache(group.id);
      southCacheRepository.getGroupLastValue.mock.mockImplementation(() => groupCache);

      await service.moveItemsToGroup(southConnector.id, [item.id], null);

      assert.deepStrictEqual(southCacheRepository.getGroupLastValue.mock.calls[0].arguments, [southConnector.id, group.id]);
      assert.deepStrictEqual(southCacheRepository.saveItemLastValue.mock.calls[0].arguments, [
        southConnector.id,
        { itemId: item.id, groupId: null, queryTime: groupCache.queryTime, value: null, trackedInstant: groupCache.trackedInstant }
      ]);
    });

    it('should throw error when moving items to non-existent group', async () => {
      southItemGroupRepository.findById.mock.mockImplementation(() => null);

      await assert.rejects(
        async () => service.moveItemsToGroup(testData.south.list[0].id, [testData.south.list[0].items[0].id], 'nonExistentGroup'),
        new NotFoundError('South item group "nonExistentGroup" not found')
      );
    });

    it('should throw error when moving non-existent item', async () => {
      southConnectorRepository.findItemById.mock.mockImplementation(() => null);

      await assert.rejects(
        async () => service.moveItemsToGroup(testData.south.list[0].id, ['nonExistentItem'], null),
        new NotFoundError('South item "nonExistentItem" not found')
      );
    });

    describe('DTO conversion functions', () => {
      it('should convert SouthItemGroupEntity to SouthItemGroupDTO', () => {
        const dto = toSouthItemGroupDTO(buildGroup({ name: 'Test Group', startTimeOffset: 10 }), getUserInfo);
        assert.strictEqual(dto.id, 'group1');
        assert.strictEqual(dto.standardSettings.name, 'Test Group');
        assert.strictEqual(dto.standardSettings.scanMode.id, testData.scanMode.list[0].id);
        assert.strictEqual(dto.historySettings.startTimeOffset, 10);
      });

      it('should convert SouthItemGroupEntity with null start/end time offset to DTO', () => {
        const dto = toSouthItemGroupDTO(buildGroup({ id: 'group2', name: 'Test Group 2' }), getUserInfo);
        assert.strictEqual(dto.historySettings.startTimeOffset, null);
      });

      it('should convert item with group to DTO', () => {
        const group = buildGroup({ name: 'Test Group' });

        const itemDTO = toSouthConnectorItemDTO(buildItemEntity({ group }), testData.south.list[0].type, getUserInfo);
        assert.deepStrictEqual(itemDTO.group, toSouthItemGroupDTO(group, getUserInfo));
        assert.strictEqual(itemDTO.group!.id, 'group1');
        assert.strictEqual(itemDTO.group!.standardSettings.name, 'Test Group');
      });

      it('should convert item without group to DTO', () => {
        const itemDTO = toSouthConnectorItemDTO(
          buildItemEntity({ id: 'item2', name: 'Test Item 2' }),
          testData.south.list[0].type,
          getUserInfo
        );
        assert.strictEqual(itemDTO.group, null);
      });

      describe('copySouthItemCommandToSouthItemEntity', () => {
        /** Copies `command` (with id "testItemId") onto an empty entity and returns it */
        const copyCommand = async (
          command: Partial<Omit<SouthConnectorItemCommandDTO, 'settings'>>,
          southType = testData.south.list[0].type
        ) => {
          const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
          await copySouthItemCommandToSouthItemEntity(
            southItemEntity,
            { ...testData.south.itemCommand, id: 'testItemId', ...command },
            null,
            southType,
            testData.scanMode.list,
            [],
            false
          );
          return southItemEntity;
        };

        it('should use default value for retrieveSecretsFromSouth when undefined is passed', async () => {
          const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;

          await copySouthItemCommandToSouthItemEntity(
            southItemEntity,
            { ...testData.south.itemCommand, id: 'testItemId' },
            null,
            testData.south.list[0].type,
            testData.scanMode.list,
            [],
            undefined
          );

          assert.strictEqual(southItemEntity.id, 'testItemId');
          assert.strictEqual(southItemEntity.name, testData.south.itemCommand.name);
          assert.strictEqual(southItemEntity.enabled, testData.south.itemCommand.enabled);
        });

        it('should set historian fields and syncWithGroup from command when provided', async () => {
          const southItemEntity = await copyCommand({
            syncWithGroup: true,
            maxReadInterval: 3600,
            readDelay: 200,
            startTimeOffset: 100,
            endTimeOffset: null
          });

          assert.strictEqual(southItemEntity.syncWithGroup, true);
          assert.strictEqual(southItemEntity.maxReadInterval, 3600);
          assert.strictEqual(southItemEntity.readDelay, 200);
          assert.strictEqual(southItemEntity.startTimeOffset, 100);
        });

        it('should copy the caching-strategy fields from the command onto the entity', async () => {
          const southItemEntity = await copyCommand(
            {
              cachingStrategy: 'threshold',
              thresholdType: 'percentage',
              threshold: 5,
              rangeLow: 0,
              rangeHigh: 100,
              maxCachingInterval: 60_000
            },
            'modbus'
          );

          assert.strictEqual(southItemEntity.cachingStrategy, 'threshold');
          assert.strictEqual(southItemEntity.thresholdType, 'percentage');
          assert.strictEqual(southItemEntity.threshold, 5);
          assert.strictEqual(southItemEntity.rangeLow, 0);
          assert.strictEqual(southItemEntity.rangeHigh, 100);
          assert.strictEqual(southItemEntity.maxCachingInterval, 60_000);
        });

        it('should default all caching-strategy fields to null when not provided by the command', async () => {
          const southItemEntity = await copyCommand(
            {
              cachingStrategy: null,
              thresholdType: null,
              threshold: null,
              rangeLow: null,
              rangeHigh: null,
              maxCachingInterval: null
            },
            'modbus'
          );

          assert.strictEqual(southItemEntity.cachingStrategy, null);
          assert.strictEqual(southItemEntity.thresholdType, null);
          assert.strictEqual(southItemEntity.threshold, null);
          assert.strictEqual(southItemEntity.rangeLow, null);
          assert.strictEqual(southItemEntity.rangeHigh, null);
          assert.strictEqual(southItemEntity.maxCachingInterval, null);
        });

        it('should reject cachingStrategy "threshold" on an MQTT item', async () => {
          await assert.rejects(() => copyCommand({ cachingStrategy: 'threshold' }, 'mqtt'), OIBusValidationError);
        });

        it('should set syncWithGroup to false when command.syncWithGroup is explicitly false', async () => {
          const southItemEntity = await copyCommand({ syncWithGroup: false });

          assert.strictEqual(southItemEntity.syncWithGroup, false);
        });

        it('should reject an enabled item with neither a scan mode nor a group', async () => {
          await assert.rejects(
            () => copyCommand({ name: 'Orphan Item', scanModeId: null, scanModeName: null, groupId: null, groupName: null }),
            /Item "Orphan Item" must have a scan mode or belong to a group/
          );
        });

        it('should allow a disabled item with neither a scan mode nor a group', async () => {
          const southItemEntity = await copyCommand({
            enabled: false,
            scanModeId: null,
            scanModeName: null,
            groupId: null,
            groupName: null
          });

          assert.strictEqual(southItemEntity.scanMode, null);
          assert.strictEqual(southItemEntity.group, null);
        });

        it('should default scanMode and startTimeOffset to null when scanModeId/scanModeName/startTimeOffset are not provided', async () => {
          const southItemEntity = await copyCommand({ enabled: false, scanModeId: null, scanModeName: null, startTimeOffset: null });

          assert.strictEqual(southItemEntity.scanMode, null);
          assert.strictEqual(southItemEntity.startTimeOffset, null);
        });

        it('should default syncWithGroup to false when command.syncWithGroup is undefined', async () => {
          const southItemEntity = await copyCommand({ syncWithGroup: undefined });

          assert.strictEqual(southItemEntity.syncWithGroup, false);
        });
      });
    });
  });
});
