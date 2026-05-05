import { describe, it, before, beforeEach, afterEach, mock, type Mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import testData from '../tests/utils/test-data';
import { mockModule, reloadModule, seq } from '../tests/utils/test-utils';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import SouthMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/south-metrics-repository.mock';
import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import OIAnalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import SouthItemGroupRepositoryMock from '../tests/__mocks__/repository/config/south-item-group-repository.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import type SouthServiceType from './south.service';
import type {
  southManifestList as southManifestListType,
  toSouthConnectorDTO as toSouthConnectorDTOType,
  toSouthConnectorItemDTO as toSouthConnectorItemDTOType,
  toSouthConnectorLightDTO as toSouthConnectorLightDTOType,
  toSouthItemGroupDTO as toSouthItemGroupDTOType,
  copySouthItemCommandToSouthItemEntity as copySouthItemCommandToSouthItemEntityType
} from './south.service';
import {
  SouthConnectorEntityLight,
  SouthItemGroupEntity,
  SouthConnectorItemEntity,
  SouthConnectorEntity
} from '../model/south-connector.model';
import { SouthItemGroupCommandDTO, SouthConnectorItemCommandDTO } from '../../shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import { toScanModeDTO } from './scan-mode.service';

const nodeRequire = createRequire(import.meta.url);

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let mockBuildSouth: ReturnType<typeof mock.fn>;
let mockSouthConnectorFactory: Record<string, unknown>;

let SouthService: new (...args: Array<unknown>) => InstanceType<typeof SouthServiceType>;
let southManifestList: typeof southManifestListType;
let toSouthConnectorDTO: typeof toSouthConnectorDTOType;
let toSouthConnectorItemDTO: typeof toSouthConnectorItemDTOType;
let toSouthConnectorLightDTO: typeof toSouthConnectorLightDTOType;
let toSouthItemGroupDTO: typeof toSouthItemGroupDTOType;
let copySouthItemCommandToSouthItemEntity: typeof copySouthItemCommandToSouthItemEntityType;

before(() => {
  mockUtils = {
    checkScanMode: mock.fn(),
    checkGroups: mock.fn(),
    stringToBoolean: mock.fn(() => true)
  };

  mockBuildSouth = mock.fn();
  mockSouthConnectorFactory = { __esModule: true, buildSouth: mockBuildSouth };

  const encryptionServiceMock = new EncryptionServiceMock('', '');

  mockModule(nodeRequire, './utils', mockUtils);
  mockModule(nodeRequire, '../service/utils', mockUtils);
  mockModule(nodeRequire, '../south/south-connector-factory', mockSouthConnectorFactory);
  mockModule(nodeRequire, './encryption.service', { encryptionService: encryptionServiceMock });
  mockModule(nodeRequire, '../web-server/controllers/validators/joi.validator', {
    default: class {
      validateSettings = mock.fn(async () => undefined);
      validate = mock.fn(async () => undefined);
    }
  });
  mockModule(nodeRequire, './metrics/south-connector-metrics.service', { default: class {} });
  mockModule(nodeRequire, 'papaparse', { parse: mock.fn(() => ({ meta: { delimiter: ',' }, data: [] })) });

  const mod = reloadModule<{
    default: new (...args: Array<unknown>) => InstanceType<typeof SouthServiceType>;
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

describe('South Service', () => {
  let service: InstanceType<typeof SouthServiceType>;
  let southConnectorRepository: SouthConnectorRepositoryMock;
  let logRepository: LogRepositoryMock;
  let southMetricsRepository: SouthMetricsRepositoryMock;
  let southCacheRepository: SouthCacheRepositoryMock;
  let scanModeRepository: ScanModeRepositoryMock;
  let oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepositoryMock;
  let certificateRepository: CertificateRepositoryMock;
  let oIAnalyticsMessageService: OIAnalyticsMessageServiceMock;
  let engine: DataStreamEngineMock;
  let southItemGroupRepository: SouthItemGroupRepositoryMock;
  let mockedSouth1: SouthConnectorMock;
  let logger: PinoLogger;
  let validator: { validateSettings: ReturnType<typeof mock.fn>; validate: ReturnType<typeof mock.fn> };

  beforeEach(() => {
    logger = new PinoLogger();
    southConnectorRepository = new SouthConnectorRepositoryMock();
    logRepository = new LogRepositoryMock();
    southMetricsRepository = new SouthMetricsRepositoryMock();
    southCacheRepository = new SouthCacheRepositoryMock();
    scanModeRepository = new ScanModeRepositoryMock();
    oIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();
    certificateRepository = new CertificateRepositoryMock();
    oIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
    engine = new DataStreamEngineMock(logger);
    southItemGroupRepository = new SouthItemGroupRepositoryMock();

    validator = {
      validateSettings: mock.fn(async () => undefined),
      validate: mock.fn(async () => undefined)
    };

    mockedSouth1 = new SouthConnectorMock(testData.south.list[0]);
    mockBuildSouth.mock.resetCalls();
    mockBuildSouth.mock.mockImplementation(() => mockedSouth1);
    mockUtils.stringToBoolean.mock.resetCalls();
    mockUtils.stringToBoolean.mock.mockImplementation(() => true);
    mockUtils.checkScanMode.mock.resetCalls();
    mockUtils.checkGroups.mock.resetCalls();

    southConnectorRepository.findAllSouth.mock.mockImplementation(() => []);
    southConnectorRepository.findSouthById.mock.mockImplementation(() => testData.south.list[0]);
    southConnectorRepository.findItemById.mock.mockImplementation(() => testData.south.list[0].items[0]);
    scanModeRepository.findAll.mock.mockImplementation(() => testData.scanMode.list);

    service = new SouthService(
      validator,
      southConnectorRepository,
      logRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      oIAnalyticsMessageService,
      engine,
      southItemGroupRepository
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should retrieve a list of south manifest', () => {
    const list = service.listManifest();
    assert.ok(list !== undefined);
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
    service.retrieveSecretsFromSouth = mock.fn(() => testData.south.list[0]);

    await service.create(testData.south.command, testData.south.list[0].id, 'userTest');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual((service.retrieveSecretsFromSouth as Mock<typeof service.retrieveSecretsFromSouth>).mock.calls.length, 1);
    assert.strictEqual(engine.createSouth.mock.calls.length, 1);
    assert.strictEqual(engine.startSouth.mock.calls.length, 1);
  });

  it('should create a south connector with items having groupName and create group when it does not exist', async () => {
    service.retrieveSecretsFromSouth = mock.fn(() => null);

    const newGroup: SouthItemGroupEntity = {
      id: 'newGroupId',
      name: 'New Group',
      southId: 'newSouthId',
      scanMode: testData.scanMode.list[0],
      items: [],
      overlap: null,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    southItemGroupRepository.findByNameAndSouthId.mock.mockImplementation(() => null);
    southItemGroupRepository.create.mock.mockImplementation(() => newGroup);
    southItemGroupRepository.findById.mock.mockImplementation((id: string) => {
      if (id === 'newGroupId') {
        return newGroup;
      }
      return null;
    });

    let callCount = 0;
    southConnectorRepository.saveSouth.mock.mockImplementation((south: SouthConnectorEntity<SouthSettings, SouthItemSettings>) => {
      if (callCount === 0 && !south.id) {
        south.id = 'newSouthId';
      }
      callCount++;
    });

    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items[0].groupName = 'New Group';
    command.items[0].groupId = null;

    await service.create(command, null, 'userTest');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
  });

  it('should create a south connector with items having groupName and use existing group when it already exists', async () => {
    service.retrieveSecretsFromSouth = mock.fn(() => null);

    const existingGroup: SouthItemGroupEntity = {
      id: 'existingGroupId',
      name: 'Existing Group',
      southId: 'newSouthId',
      scanMode: testData.scanMode.list[0],
      items: [],
      overlap: null,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    let callCount = 0;
    southConnectorRepository.saveSouth.mock.mockImplementation((south: SouthConnectorEntity<SouthSettings, SouthItemSettings>) => {
      if (callCount === 0 && !south.id) {
        south.id = 'newSouthId';
      }
      callCount++;
    });

    southItemGroupRepository.findByNameAndSouthId.mock.mockImplementation(() => existingGroup);
    southItemGroupRepository.findById.mock.mockImplementation(() => existingGroup);

    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items[0].groupName = 'Existing Group';
    command.items[0].groupId = null;

    await service.create(command, null, 'userTest');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    assert.strictEqual(southItemGroupRepository.create.mock.calls.length, 0);
  });

  it('should create a south connector with retrieveSecretsFromSouth when item has no id', async () => {
    service.retrieveSecretsFromSouth = mock.fn(() => testData.south.list[0]);

    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items[0].id = null;

    await service.create(command, testData.south.list[0].id, 'userTest');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    assert.strictEqual((service.retrieveSecretsFromSouth as Mock<typeof service.retrieveSecretsFromSouth>).mock.calls.length, 1);
  });

  it('should not create south connector if disabled', async () => {
    service.retrieveSecretsFromSouth = mock.fn(() => null);

    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.enabled = false;
    await service.create(command, null, 'userTest');
    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual(engine.createSouth.mock.calls.length, 1);
    assert.strictEqual(engine.startSouth.mock.calls.length, 0);
  });

  it('should not create a south connector with duplicate name', async () => {
    service.retrieveSecretsFromSouth = mock.fn(() => null);
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

  it('should update a south connector with a new unique name', async () => {
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.name = 'Updated South Name';
    southConnectorRepository.findAllSouth.mock.mockImplementation(() => testData.south.list);

    await service.update(testData.south.list[0].id, command, 'userTest');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    assert.strictEqual(engine.reloadSouth.mock.calls.length, 1);
  });

  it('should update a south connector and set createdBy on new items', async () => {
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items[0].id = '';
    southConnectorRepository.findAllSouth.mock.mockImplementation(() => testData.south.list);

    await service.update(testData.south.list[0].id, command, 'user1');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
  });

  it('should update a south connector and not set createdBy on existing items', async () => {
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items[0].id = testData.south.list[0].items[0].id;
    southConnectorRepository.findAllSouth.mock.mockImplementation(() => testData.south.list);

    await service.update(testData.south.list[0].id, command, 'user1');

    assert.strictEqual(southConnectorRepository.saveSouth.mock.calls.length, 1);
    const savedEntity = southConnectorRepository.saveSouth.mock.calls[0].arguments[0] as {
      items: Array<{ id: string; updatedBy?: string }>;
    };
    const existingItem = savedEntity.items.find(item => item.id === testData.south.list[0].items[0].id);
    assert.ok(existingItem !== undefined);
    assert.strictEqual(existingItem!.updatedBy, 'user1');
  });

  it('should not update a south connector with duplicate name', async () => {
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.name = 'Duplicate Name';
    southConnectorRepository.findAllSouth.mock.mockImplementation(() => [
      { ...testData.south.list[0], id: 'other-id', name: 'Duplicate Name' } satisfies SouthConnectorEntityLight
    ]);

    await assert.rejects(
      async () => service.update(testData.south.list[0].id, command, 'userTest'),
      new OIBusValidationError(`South connector name "Duplicate Name" already exists`)
    );
  });

  it('should delete a south connector', async () => {
    await service.delete(testData.south.list[0].id);

    assert.deepStrictEqual(engine.deleteSouth.mock.calls[0].arguments, [testData.south.list[0]]);
    assert.deepStrictEqual(southConnectorRepository.deleteSouth.mock.calls[0].arguments, [testData.south.list[0].id]);
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

  it('should get a south data stream for metrics', () => {
    service.getSouthDataStream(testData.south.list[0].id);
    assert.deepStrictEqual(engine.getSouthSSE.mock.calls[0].arguments, [testData.south.list[0].id]);
  });

  it('should test a south connector in creation mode', async () => {
    await service.testSouth('create', testData.south.command.type, testData.south.command.settings);

    assert.strictEqual(mockBuildSouth.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.testConnection.mock.calls.length, 1);
  });

  it('should test a south connector in edit mode', async () => {
    await service.testSouth(testData.south.list[0].id, testData.south.command.type, testData.south.command.settings);

    assert.strictEqual(mockBuildSouth.mock.calls.length, 1);
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

    assert.strictEqual(mockBuildSouth.mock.calls.length, 1);
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

    assert.strictEqual(mockBuildSouth.mock.calls.length, 1);
    assert.strictEqual(mockedSouth1.testItem.mock.calls.length, 1);
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
    southConnectorRepository.findItemById.mock.mockImplementation(seq(() => null));

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
    assert.deepStrictEqual(southCacheRepository.getItemLastValue.mock.calls[0].arguments, [southId, null, itemId]);
    assert.deepStrictEqual(result, {
      groupId: null,
      groupName: '',
      itemId,
      itemName: testData.south.list[0].items[0].name,
      queryTime: cached.queryTime,
      value: cached.value,
      trackedInstant: cached.trackedInstant
    });
  });

  it('should get item last value when cache has no value', () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    southCacheRepository.getItemLastValue.mock.mockImplementation(() => null);

    const result = service.getItemLastValue(southId, itemId);

    assert.deepStrictEqual(southCacheRepository.getItemLastValue.mock.calls[0].arguments, [southId, null, itemId]);
    assert.deepStrictEqual(result, {
      groupId: null,
      groupName: '',
      itemId,
      itemName: testData.south.list[0].items[0].name,
      queryTime: null,
      value: null,
      trackedInstant: null
    });
  });

  it('should create an item', async () => {
    await service.createItem(testData.south.list[0].id, testData.south.itemCommand, 'userTest');

    assert.deepStrictEqual(southConnectorRepository.findSouthById.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  it('should create an item with null id', async () => {
    const commandWithNullId: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      id: null
    };

    await service.createItem(testData.south.list[0].id, commandWithNullId, 'userTest');

    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
    const savedItemCall = southConnectorRepository.saveItem.mock.calls[0];
    assert.strictEqual((savedItemCall.arguments[1] as { id: string }).id, '');
  });

  it('should create item with group', async () => {
    const group: SouthItemGroupEntity = {
      id: 'group1',
      name: 'Test Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      overlap: null,
      maxReadInterval: null,
      items: [],
      readDelay: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    southItemGroupRepository.findById.mock.mockImplementation(() => group);

    const commandWithGroup: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupId: 'group1'
    };

    await service.createItem(testData.south.list[0].id, commandWithGroup, 'userTest');

    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
  });

  it('should create item without group when groupId is null', async () => {
    const commandWithoutGroup: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupId: null
    };

    await service.createItem(testData.south.list[0].id, commandWithoutGroup, 'userTest');

    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
    const savedItemCall = southConnectorRepository.saveItem.mock.calls[0];
    assert.deepStrictEqual((savedItemCall.arguments[1] as { group: unknown }).group, null);
  });

  it('should create item with non-existent groupId (should set groups to empty array)', async () => {
    southItemGroupRepository.findById.mock.mockImplementation(() => null);

    const commandWithNonExistentGroup: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupId: 'non-existent-group-id'
    };

    await service.createItem(testData.south.list[0].id, commandWithNonExistentGroup, 'userTest');

    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
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
    const savedItemCall = southConnectorRepository.saveItem.mock.calls[0];
    assert.strictEqual((savedItemCall.arguments[1] as { id: string }).id, testData.south.itemCommand.id);
  });

  it('should update item with group', async () => {
    const group: SouthItemGroupEntity = {
      id: 'group2',
      name: 'Update Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      overlap: null,
      maxReadInterval: null,
      items: [],
      readDelay: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    southItemGroupRepository.findById.mock.mockImplementation(() => group);

    const commandWithGroup: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupId: 'group2'
    };

    await service.updateItem(testData.south.list[0].id, testData.south.list[0].items[0].id, commandWithGroup, 'userTest');

    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
  });

  it('should update item without group when groupId is null', async () => {
    const commandWithoutGroup: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupId: null
    };

    await service.updateItem(testData.south.list[0].id, testData.south.list[0].items[0].id, commandWithoutGroup, 'userTest');

    assert.strictEqual(southConnectorRepository.saveItem.mock.calls.length, 1);
    const savedItemCall = southConnectorRepository.saveItem.mock.calls[0];
    assert.deepStrictEqual((savedItemCall.arguments[1] as { group: unknown }).group, null);
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

  it('should enable multiple south items', async () => {
    const southConnectorId = testData.south.list[0].id;
    const itemIds = [testData.south.list[0].items[0].id, testData.south.list[0].items[1].id];

    southConnectorRepository.findItemById.mock.mockImplementation(
      seq(
        () => testData.south.list[0].items[0],
        () => testData.south.list[0].items[1]
      )
    );

    await service.enableItems(southConnectorId, itemIds);

    assert.deepStrictEqual(southConnectorRepository.enableItem.mock.calls[0].arguments, [testData.south.list[0].items[0].id]);
    assert.deepStrictEqual(southConnectorRepository.enableItem.mock.calls[1].arguments, [testData.south.list[0].items[1].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  it('should disable multiple south items', async () => {
    const southConnectorId = testData.south.list[0].id;
    const itemIds = [testData.south.list[0].items[0].id, testData.south.list[0].items[1].id];

    southConnectorRepository.findItemById.mock.mockImplementation(
      seq(
        () => testData.south.list[0].items[0],
        () => testData.south.list[0].items[1]
      )
    );

    await service.disableItems(southConnectorId, itemIds);

    assert.deepStrictEqual(southConnectorRepository.disableItem.mock.calls[0].arguments, [testData.south.list[0].items[0].id]);
    assert.deepStrictEqual(southConnectorRepository.disableItem.mock.calls[1].arguments, [testData.south.list[0].items[1].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  it('should delete an item', async () => {
    await service.deleteItem(testData.south.list[0].id, testData.south.list[0].items[0].id);

    assert.deepStrictEqual(southConnectorRepository.findItemById.mock.calls[0].arguments, [
      testData.south.list[0].id,
      testData.south.list[0].items[0].id
    ]);
    assert.deepStrictEqual(southConnectorRepository.deleteItem.mock.calls[0].arguments, [
      testData.south.list[0].id,
      testData.south.list[0].items[0].id
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  it('should delete multiple south items', async () => {
    const southConnectorId = testData.south.list[0].id;
    const itemIds = [testData.south.list[0].items[0].id, testData.south.list[0].items[1].id];

    southConnectorRepository.findItemById.mock.mockImplementation(
      seq(
        () => testData.south.list[0].items[0],
        () => testData.south.list[0].items[1]
      )
    );

    await service.deleteItems(southConnectorId, itemIds);

    assert.deepStrictEqual(southConnectorRepository.deleteItem.mock.calls[0].arguments, [
      testData.south.list[0].id,
      testData.south.list[0].items[0].id
    ]);
    assert.deepStrictEqual(southConnectorRepository.deleteItem.mock.calls[1].arguments, [
      testData.south.list[0].id,
      testData.south.list[0].items[1].id
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  it('should delete all items', async () => {
    await service.deleteAllItems(testData.south.list[0].id);

    assert.deepStrictEqual(southConnectorRepository.deleteAllItemsBySouth.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.deepStrictEqual(southCacheRepository.dropItemValueTable.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  it('should properly check items', async () => {
    const getUserInfo = (id: string) => ({ id, friendlyName: id });

    const csvData = [
      {
        name: 'item1',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name
      },
      {
        name: 'item2bis',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: 'bad scan mode'
      },
      {
        name: 'item3',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        settings_badItem: 100,
        scanMode: testData.scanMode.list[0].name
      },
      {
        name: 'item4',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 12,
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name
      },
      {
        name: 'item5',
        enabled: 'true',
        settings_regex: '',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name
      }
    ];

    // Get the papaparse mock from the module cache and update it for this test
    const papaparseMod = nodeRequire.cache[nodeRequire.resolve('papaparse')];
    if (papaparseMod) {
      (papaparseMod.exports as { parse: ReturnType<typeof mock.fn> }).parse.mock.mockImplementation(
        seq(() => ({ meta: { delimiter: ',' }, data: csvData }))
      );
    }

    validator.validateSettings.mock.mockImplementation(
      seq(
        async () => {
          throw new Error('validation error');
        }, // item4 reaches validateSettings first
        async () => undefined // item5 passes
      )
    );

    const result = await service.checkImportItems(
      testData.south.list[0].type,
      'file content',
      ',',
      testData.south.list[0].items.map(item => ({ ...item, group: null }))
    );
    assert.deepStrictEqual(result, {
      items: [
        {
          id: '',
          name: csvData[4].name,
          enabled: true,
          scanMode: toScanModeDTO(testData.scanMode.list[0], getUserInfo),
          settings: {
            ignoreModifiedDate: true,
            minAge: 100,
            preserveFiles: true,
            regex: undefined
          },
          group: null,
          maxReadInterval: 0,
          overlap: 0,
          readDelay: 0,
          syncWithGroup: true
        }
      ],
      errors: [
        {
          error: 'Item name "item1" already used',
          item: {
            name: csvData[0].name,
            enabled: 'true',
            scanMode: testData.scanMode.list[0].name,
            settings_ignoreModifiedDate: 'false',
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        },
        {
          error: 'Scan mode "bad scan mode" not found for item "item2bis"',
          item: {
            name: csvData[1].name,
            enabled: 'true',
            scanMode: 'bad scan mode',
            settings_ignoreModifiedDate: 'false',
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        },
        {
          error: 'Settings "badItem" not accepted in manifest',
          item: {
            name: csvData[2].name,
            enabled: 'true',
            scanMode: testData.scanMode.list[0].name,
            settings_badItem: 100,
            settings_ignoreModifiedDate: 'false',
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        },
        {
          error: 'validation error',
          item: {
            name: csvData[3].name,
            enabled: 'true',
            scanMode: testData.scanMode.list[0].name,
            settings_ignoreModifiedDate: 12,
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        }
      ]
    });
  });

  it('should properly check items with array or object', async () => {
    const getUserInfo = (id: string) => ({ id, friendlyName: id });

    const csvData = [
      {
        name: 'item',
        enabled: 'true',
        settings_query: 'query',
        settings_dateTimeFields: '[]',
        settings_serialization: JSON.stringify({
          type: 'csv',
          filename: 'filename',
          delimiter: 'SEMI_COLON',
          compression: true,
          outputTimestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
          outputTimezone: 'Europe/Paris'
        }),
        scanMode: testData.scanMode.list[0].name
      }
    ];

    const papaparseMod = nodeRequire.cache[nodeRequire.resolve('papaparse')];
    if (papaparseMod) {
      (papaparseMod.exports as { parse: ReturnType<typeof mock.fn> }).parse.mock.mockImplementation(
        seq(() => ({ meta: { delimiter: ',' }, data: csvData }))
      );
    }

    const result = await service.checkImportItems(
      testData.south.list[1].type,
      'file content',
      ',',
      testData.south.list[1].items.map(item => ({ ...item, group: null }))
    );
    assert.deepStrictEqual(result, {
      items: [
        {
          id: '',
          name: csvData[0].name,
          scanMode: toScanModeDTO(testData.scanMode.list[0], getUserInfo),
          enabled: true,
          settings: {
            query: 'query',
            dateTimeFields: [],
            serialization: {
              type: 'csv',
              filename: 'filename',
              delimiter: 'SEMI_COLON',
              compression: true,
              outputTimestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
              outputTimezone: 'Europe/Paris'
            }
          },
          group: null,
          maxReadInterval: 0,
          overlap: 0,
          readDelay: 0,
          syncWithGroup: true
        }
      ],
      errors: []
    });
  });

  it('should properly check items with group name from CSV', async () => {
    const getUserInfo = (id: string) => ({ id, friendlyName: id });

    const csvData = [
      {
        name: 'itemWithGroup',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name,
        group: 'Test Group'
      }
    ];

    const papaparseMod = nodeRequire.cache[nodeRequire.resolve('papaparse')];
    if (papaparseMod) {
      (papaparseMod.exports as { parse: ReturnType<typeof mock.fn> }).parse.mock.mockImplementation(
        seq(() => ({ meta: { delimiter: ',' }, data: csvData }))
      );
    }

    const result = await service.checkImportItems(
      testData.south.list[0].type,
      'file content',
      ',',
      testData.south.list[0].items.map(item => ({ ...item, group: null }))
    );
    assert.deepStrictEqual(result, {
      items: [
        {
          id: '',
          name: csvData[0].name,
          enabled: true,
          scanMode: toScanModeDTO(testData.scanMode.list[0], getUserInfo),
          settings: {
            ignoreModifiedDate: true,
            minAge: 100,
            preserveFiles: true,
            regex: '*'
          },
          group: { id: '', standardSettings: { name: 'Test Group' } },
          maxReadInterval: 0,
          overlap: 0,
          readDelay: 0,
          syncWithGroup: true
        }
      ],
      errors: []
    });
  });

  it('should throw error if delimiter does not match', async () => {
    const papaparseMod = nodeRequire.cache[nodeRequire.resolve('papaparse')];
    if (papaparseMod) {
      (papaparseMod.exports as { parse: ReturnType<typeof mock.fn> }).parse.mock.mockImplementation(
        seq(() => ({ meta: { delimiter: ';' }, data: [] }))
      );
    }

    await assert.rejects(
      async () => service.checkImportItems(testData.south.command.type, '', ',', []),
      new OIBusValidationError(`The entered delimiter "," does not correspond to the file delimiter ";"`)
    );
  });

  it('should import items', async () => {
    await service.importItems(testData.south.list[0].id, [testData.south.itemCommand], 'userTest');

    assert.strictEqual(southConnectorRepository.saveAllItems.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
  });

  it('should import items with groupName and create group when it does not exist', async () => {
    const newGroup: SouthItemGroupEntity = {
      id: 'newGroupId',
      name: 'New Import Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      overlap: null,
      maxReadInterval: null,
      items: [],
      readDelay: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    southItemGroupRepository.findByNameAndSouthId.mock.mockImplementation(() => null);
    mockUtils.checkGroups.mock.mockImplementation(() => newGroup);
    southItemGroupRepository.create.mock.mockImplementation(() => newGroup);

    const itemCommandWithGroupName: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupName: 'New Import Group',
      groupId: null
    };

    await service.importItems(testData.south.list[0].id, [itemCommandWithGroupName], 'userTest');

    assert.deepStrictEqual(southItemGroupRepository.findByNameAndSouthId.mock.calls[0].arguments, [
      'New Import Group',
      testData.south.list[0].id
    ]);
    assert.strictEqual(southItemGroupRepository.create.mock.calls.length, 1);
    assert.strictEqual(southConnectorRepository.saveAllItems.mock.calls.length, 1);
    const saveAllItemsCall = southConnectorRepository.saveAllItems.mock.calls[0];
    const savedItems = saveAllItemsCall.arguments[1] as Array<{ group: unknown }>;
    assert.deepStrictEqual(savedItems[0].group, newGroup);
  });

  it('should import items with groupName and use existing group when it exists', async () => {
    const existingGroup: SouthItemGroupEntity = {
      id: 'existingGroupId',
      name: 'Existing Import Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      overlap: null,
      maxReadInterval: null,
      items: [],
      readDelay: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    southItemGroupRepository.findByNameAndSouthId.mock.mockImplementation(() => existingGroup);

    const itemCommandWithGroupName: SouthConnectorItemCommandDTO = {
      ...testData.south.itemCommand,
      groupName: 'Existing Import Group',
      groupId: null
    };

    await service.importItems(testData.south.list[0].id, [itemCommandWithGroupName], 'userTest');

    assert.deepStrictEqual(southItemGroupRepository.findByNameAndSouthId.mock.calls[0].arguments, [
      'Existing Import Group',
      testData.south.list[0].id
    ]);
    assert.strictEqual(southItemGroupRepository.create.mock.calls.length, 0);
    assert.strictEqual(southConnectorRepository.saveAllItems.mock.calls.length, 1);
  });

  it('should retrieve secrets from south', () => {
    const manifest = JSON.parse(JSON.stringify(testData.south.manifest));
    manifest.id = testData.south.list[0].type;
    assert.deepStrictEqual(service.retrieveSecretsFromSouth('southId', manifest), testData.south.list[0]);
  });

  it('should not retrieve secrets from south', () => {
    assert.deepStrictEqual(service.retrieveSecretsFromSouth(null, testData.south.manifest), null);
  });

  it('should throw error if connector not found when retrieving secrets from bad south type', () => {
    southConnectorRepository.findSouthById.mock.mockImplementation(seq(() => testData.south.list[1]));
    assert.throws(
      () => service.retrieveSecretsFromSouth('southId', testData.south.manifest),
      new Error(`South connector "southId" (type "${testData.south.list[1].type}") must be of the type "${testData.south.manifest.id}"`)
    );
  });

  it('should properly convert to DTO', () => {
    const getUserInfo = (id: string) => ({ id, friendlyName: id });
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
    const getUserInfo = (id: string) => ({ id, friendlyName: id });
    const group: SouthItemGroupEntity = {
      id: 'group1',
      name: 'Group 1',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      overlap: 5,
      maxReadInterval: 3600,
      readDelay: 200,
      items: [],
      createdBy: 'user1',
      updatedBy: 'user1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    };
    const southEntity = { ...testData.south.list[0], groups: [group] };

    const result = toSouthConnectorDTO(southEntity, getUserInfo);

    assert.strictEqual(result.groups.length, 1);
    assert.deepStrictEqual(result.groups[0], {
      id: group.id,
      standardSettings: {
        name: group.name,
        scanMode: toScanModeDTO(group.scanMode, getUserInfo)
      },
      historySettings: {
        maxReadInterval: group.maxReadInterval,
        readDelay: group.readDelay,
        overlap: group.overlap
      },
      createdBy: getUserInfo(group.createdBy),
      updatedBy: getUserInfo(group.updatedBy),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    });
  });

  describe('Group operations', () => {
    it('should get groups for a south connector', () => {
      const mockGroups: Array<SouthItemGroupEntity> = [
        {
          id: 'group1',
          name: 'Group 1',
          southId: testData.south.list[0].id,
          scanMode: testData.scanMode.list[0],
          overlap: null,
          maxReadInterval: null,
          readDelay: 0,
          items: [],
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        {
          id: 'group2',
          name: 'Group 2',
          southId: testData.south.list[0].id,
          scanMode: testData.scanMode.list[1],
          overlap: 10,
          maxReadInterval: null,
          readDelay: 0,
          items: [],
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        }
      ];

      southItemGroupRepository.findBySouthId.mock.mockImplementation(() => mockGroups);

      const groups = service.getGroups(testData.south.list[0].id);
      assert.strictEqual(groups.length, 2);
      assert.strictEqual(groups[0].id, 'group1');
      assert.strictEqual(groups[1].id, 'group2');
      assert.deepStrictEqual(southConnectorRepository.findSouthById.mock.calls[0].arguments, [testData.south.list[0].id]);
    });

    it('should get a specific group by id', () => {
      const mockGroup: SouthItemGroupEntity = {
        id: 'group1',
        name: 'Group 1',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findById.mock.mockImplementation(() => mockGroup);

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
      const mockGroup: SouthItemGroupEntity = {
        id: 'group1',
        name: 'Group 1',
        southId: 'differentSouthId',
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findById.mock.mockImplementation(() => mockGroup);

      assert.throws(
        () => service.getGroup(testData.south.list[0].id, 'group1'),
        new NotFoundError(`South item group "group1" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should create a group', () => {
      const command: SouthItemGroupCommandDTO = {
        id: null,
        standardSettings: {
          name: 'New Group',
          scanModeId: testData.scanMode.list[0].id
        },
        historySettings: {
          overlap: 5,
          maxReadInterval: null,
          readDelay: 0
        }
      };

      const createdGroup: SouthItemGroupEntity = {
        id: 'newGroupId',
        name: 'New Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: 5,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findBySouthId.mock.mockImplementation(() => []);
      southItemGroupRepository.create.mock.mockImplementation(() => createdGroup);

      const result = service.createGroup(testData.south.list[0].id, command, 'testUser');
      assert.strictEqual(result.id, 'newGroupId');
      assert.strictEqual(result.name, 'New Group');
      assert.strictEqual(southItemGroupRepository.create.mock.calls.length, 1);
    });

    it('should create a group with null overlap', () => {
      const command: SouthItemGroupCommandDTO = {
        id: null,
        standardSettings: {
          name: 'Group With Null Overlap',
          scanModeId: testData.scanMode.list[0].id
        },
        historySettings: {
          overlap: null,
          maxReadInterval: null,
          readDelay: 0
        }
      };

      const createdGroup: SouthItemGroupEntity = {
        id: 'newGroupId',
        name: 'Group With Null Overlap',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findBySouthId.mock.mockImplementation(() => []);
      southItemGroupRepository.create.mock.mockImplementation(() => createdGroup);

      const result = service.createGroup(testData.south.list[0].id, command, 'testUser');
      assert.strictEqual(result.overlap, null);
      const createCall = southItemGroupRepository.create.mock.calls[0];
      assert.strictEqual((createCall.arguments[0] as { overlap: unknown }).overlap, null);
      assert.strictEqual(createCall.arguments[1], 'testUser');
    });

    it('should create a group with maxReadInterval and readDelay', () => {
      const command: SouthItemGroupCommandDTO = {
        id: null,
        standardSettings: {
          name: 'Group With Throttling',
          scanModeId: testData.scanMode.list[0].id
        },
        historySettings: {
          overlap: 5,
          maxReadInterval: 3600,
          readDelay: 200
        }
      };

      const createdGroup: SouthItemGroupEntity = {
        id: 'newGroupId',
        name: 'Group With Throttling',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: 5,
        maxReadInterval: 3600,
        readDelay: 200,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findBySouthId.mock.mockImplementation(() => []);
      southItemGroupRepository.create.mock.mockImplementation(() => createdGroup);

      const result = service.createGroup(testData.south.list[0].id, command, 'testUser');
      assert.strictEqual(result.id, 'newGroupId');
      assert.strictEqual(result.maxReadInterval, 3600);
      assert.strictEqual(result.readDelay, 200);
      const createCall = southItemGroupRepository.create.mock.calls[0];
      const entity = createCall.arguments[0] as { name: string; maxReadInterval: number; readDelay: number };
      assert.strictEqual(entity.name, 'Group With Throttling');
      assert.strictEqual(entity.maxReadInterval, 3600);
      assert.strictEqual(entity.readDelay, 200);
    });

    it('should throw error when creating group with duplicate name', () => {
      const command: SouthItemGroupCommandDTO = {
        id: null,
        standardSettings: {
          name: 'Existing Group',
          scanModeId: testData.scanMode.list[0].id
        },
        historySettings: {
          overlap: null,
          maxReadInterval: null,
          readDelay: 0
        }
      };

      const existingGroup: SouthItemGroupEntity = {
        id: 'existingGroupId',
        name: 'Existing Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [existingGroup]);

      assert.throws(
        () => service.createGroup(testData.south.list[0].id, command, 'testUser'),
        new OIBusValidationError('A group with name "Existing Group" already exists for this south connector')
      );
    });

    it('should update a group', () => {
      const command: SouthItemGroupCommandDTO = {
        id: null,
        standardSettings: {
          name: 'Updated Group',
          scanModeId: testData.scanMode.list[1].id
        },
        historySettings: {
          overlap: 15,
          maxReadInterval: 3600,
          readDelay: 200
        }
      };

      const existingGroup: SouthItemGroupEntity = {
        id: 'groupToUpdate',
        name: 'Original Name',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      const updatedGroup: SouthItemGroupEntity = {
        ...existingGroup,
        name: 'Updated Group',
        scanMode: testData.scanMode.list[1],
        overlap: 15,
        maxReadInterval: 3600,
        readDelay: 200
      };

      southItemGroupRepository.findById.mock.mockImplementation(
        seq(
          () => existingGroup,
          () => updatedGroup
        )
      );
      southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [existingGroup]);

      const result = service.updateGroup(testData.south.list[0].id, 'groupToUpdate', 'testUser', command);
      assert.strictEqual(result.name, 'Updated Group');
      assert.strictEqual(result.scanMode.id, testData.scanMode.list[1].id);
      assert.strictEqual(result.maxReadInterval, 3600);
      assert.strictEqual(result.readDelay, 200);
      assert.strictEqual(southItemGroupRepository.update.mock.calls.length, 1);
    });

    it('should update a group with null maxReadInterval and zero readDelay', () => {
      const command: SouthItemGroupCommandDTO = {
        id: null,
        standardSettings: {
          name: 'Updated Name Only',
          scanModeId: testData.scanMode.list[0].id
        },
        historySettings: {
          overlap: null,
          maxReadInterval: null,
          readDelay: 0
        }
      };

      const existingGroup: SouthItemGroupEntity = {
        id: 'groupToUpdateNull',
        name: 'Original Name',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      const updatedGroup: SouthItemGroupEntity = {
        ...existingGroup,
        name: 'Updated Name Only',
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };

      southItemGroupRepository.findById.mock.mockImplementation(
        seq(
          () => existingGroup,
          () => updatedGroup
        )
      );
      southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [existingGroup]);

      const result = service.updateGroup(testData.south.list[0].id, 'groupToUpdateNull', 'testUser', command);
      assert.strictEqual(result.name, 'Updated Name Only');
      assert.strictEqual(result.maxReadInterval, null);
      assert.strictEqual(result.readDelay, 0);
      const updateCall = southItemGroupRepository.update.mock.calls[0];
      assert.strictEqual(updateCall.arguments[0], 'groupToUpdateNull');
      const entity = updateCall.arguments[1] as { name: string; maxReadInterval: unknown; readDelay: number };
      assert.strictEqual(entity.name, 'Updated Name Only');
      assert.strictEqual(entity.maxReadInterval, null);
      assert.strictEqual(entity.readDelay, 0);
      assert.strictEqual(updateCall.arguments[2], 'testUser');
    });

    it('should throw error when updating non-existent group', () => {
      const command: SouthItemGroupCommandDTO = {
        id: null,
        standardSettings: {
          name: 'Updated Group',
          scanModeId: testData.scanMode.list[0].id
        },
        historySettings: {
          overlap: null,
          maxReadInterval: null,
          readDelay: 0
        }
      };

      southItemGroupRepository.findById.mock.mockImplementation(() => null);

      assert.throws(
        () => service.updateGroup(testData.south.list[0].id, 'nonExistentGroup', 'testUser', command),
        new NotFoundError('South item group "nonExistentGroup" not found')
      );
    });

    it('should throw error when updating group that belongs to different south connector', () => {
      const command: SouthItemGroupCommandDTO = {
        id: null,
        standardSettings: {
          name: 'Updated Group',
          scanModeId: testData.scanMode.list[0].id
        },
        historySettings: {
          overlap: null,
          maxReadInterval: null,
          readDelay: 0
        }
      };

      const groupFromDifferentSouth: SouthItemGroupEntity = {
        id: 'groupFromOtherSouth',
        name: 'Group From Other South',
        southId: 'differentSouthId',
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findById.mock.mockImplementation(() => groupFromDifferentSouth);

      assert.throws(
        () => service.updateGroup(testData.south.list[0].id, 'groupFromOtherSouth', 'testUser', command),
        new NotFoundError(`South item group "groupFromOtherSouth" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should throw error when update fails to find updated group', () => {
      const command: SouthItemGroupCommandDTO = {
        id: null,
        standardSettings: {
          name: 'Updated Group',
          scanModeId: testData.scanMode.list[0].id
        },
        historySettings: {
          overlap: null,
          maxReadInterval: null,
          readDelay: 0
        }
      };

      const existingGroup: SouthItemGroupEntity = {
        id: 'groupToUpdate',
        name: 'Original Name',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findById.mock.mockImplementation(
        seq(
          () => existingGroup,
          () => null
        )
      );
      southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [existingGroup]);

      assert.throws(
        () => service.updateGroup(testData.south.list[0].id, 'groupToUpdate', 'testUser', command),
        new NotFoundError('Failed to update south item group "groupToUpdate"')
      );
    });

    it('should throw error when updating group with duplicate name', () => {
      const command: SouthItemGroupCommandDTO = {
        id: null,
        standardSettings: {
          name: 'Existing Group',
          scanModeId: testData.scanMode.list[0].id
        },
        historySettings: {
          overlap: null,
          maxReadInterval: null,
          readDelay: 0
        }
      };

      const existingGroup: SouthItemGroupEntity = {
        id: 'groupToUpdate',
        name: 'Original Name',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      const otherGroup: SouthItemGroupEntity = {
        id: 'otherGroup',
        name: 'Existing Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findById.mock.mockImplementation(() => existingGroup);
      southItemGroupRepository.findBySouthId.mock.mockImplementation(() => [existingGroup, otherGroup]);

      assert.throws(
        () => service.updateGroup(testData.south.list[0].id, 'groupToUpdate', 'testUser', command),
        new OIBusValidationError('A group with name "Existing Group" already exists for this south connector')
      );
    });

    it('should delete a group', async () => {
      const groupToDelete: SouthItemGroupEntity = {
        id: 'groupToDelete',
        name: 'Group To Delete',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findById.mock.mockImplementation(() => groupToDelete);
      engine.reloadSouthItems.mock.mockImplementation(async () => undefined);

      await service.deleteGroup(testData.south.list[0].id, 'groupToDelete');
      assert.deepStrictEqual(southItemGroupRepository.delete.mock.calls[0].arguments, ['groupToDelete']);
      assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
    });

    it('should throw error when deleting non-existent group', async () => {
      southItemGroupRepository.findById.mock.mockImplementation(() => null);

      await assert.rejects(
        async () => service.deleteGroup(testData.south.list[0].id, 'nonExistentGroup'),
        new NotFoundError('South item group "nonExistentGroup" not found')
      );
    });

    it('should throw error when deleting group that belongs to different south connector', async () => {
      const groupFromDifferentSouth: SouthItemGroupEntity = {
        id: 'groupFromOtherSouth',
        name: 'Group From Other South',
        southId: 'differentSouthId',
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findById.mock.mockImplementation(() => groupFromDifferentSouth);

      await assert.rejects(
        async () => service.deleteGroup(testData.south.list[0].id, 'groupFromOtherSouth'),
        new NotFoundError(`South item group "groupFromOtherSouth" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should move items to a group', async () => {
      const group: SouthItemGroupEntity = {
        id: 'targetGroup',
        name: 'Target Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findById.mock.mockImplementation(() => group);
      southConnectorRepository.findItemById.mock.mockImplementation(() => testData.south.list[0].items[0]);
      engine.reloadSouthItems.mock.mockImplementation(async () => undefined);

      const itemIds = [testData.south.list[0].items[0].id];
      await service.moveItemsToGroup(testData.south.list[0].id, itemIds, 'targetGroup');

      assert.deepStrictEqual(southItemGroupRepository.findById.mock.calls[0].arguments, ['targetGroup']);
      assert.deepStrictEqual(southConnectorRepository.moveItemsToGroup.mock.calls[0].arguments, [itemIds, 'targetGroup']);
      assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
      assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
    });

    it('should throw error when moving items to group that belongs to different south connector', async () => {
      const groupFromDifferentSouth: SouthItemGroupEntity = {
        id: 'groupFromOtherSouth',
        name: 'Group From Other South',
        southId: 'differentSouthId',
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };

      southItemGroupRepository.findById.mock.mockImplementation(() => groupFromDifferentSouth);

      const itemIds = [testData.south.list[0].items[0].id];
      await assert.rejects(
        async () => service.moveItemsToGroup(testData.south.list[0].id, itemIds, 'groupFromOtherSouth'),
        new NotFoundError(`South item group "groupFromOtherSouth" does not belong to south connector "${testData.south.list[0].id}"`)
      );
    });

    it('should remove items from groups when groupId is null', async () => {
      southConnectorRepository.findItemById.mock.mockImplementation(() => testData.south.list[0].items[0]);
      engine.reloadSouthItems.mock.mockImplementation(async () => undefined);

      const itemIds = [testData.south.list[0].items[0].id];
      await service.moveItemsToGroup(testData.south.list[0].id, itemIds, null);

      assert.deepStrictEqual(southConnectorRepository.moveItemsToGroup.mock.calls[0].arguments, [itemIds, null]);
      assert.deepStrictEqual(engine.reloadSouthItems.mock.calls[0].arguments, [testData.south.list[0]]);
    });

    it('should throw error when moving items to non-existent group', async () => {
      southItemGroupRepository.findById.mock.mockImplementation(() => null);

      const itemIds = [testData.south.list[0].items[0].id];
      await assert.rejects(
        async () => service.moveItemsToGroup(testData.south.list[0].id, itemIds, 'nonExistentGroup'),
        new NotFoundError('South item group "nonExistentGroup" not found')
      );
    });

    it('should throw error when moving non-existent item', async () => {
      southConnectorRepository.findItemById.mock.mockImplementation(() => null);

      const itemIds = ['nonExistentItem'];
      await assert.rejects(
        async () => service.moveItemsToGroup(testData.south.list[0].id, itemIds, null),
        new NotFoundError('South item "nonExistentItem" not found')
      );
    });

    describe('DTO conversion functions', () => {
      it('should convert SouthItemGroupEntity to SouthItemGroupDTO', () => {
        const entity: SouthItemGroupEntity = {
          id: 'group1',
          name: 'Test Group',
          southId: testData.south.list[0].id,
          scanMode: testData.scanMode.list[0],
          overlap: 10,
          maxReadInterval: null,
          readDelay: 0,
          items: [],
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        };

        const dto = toSouthItemGroupDTO(entity, id => ({ id, friendlyName: id }));
        assert.strictEqual(dto.id, 'group1');
        assert.strictEqual(dto.standardSettings.name, 'Test Group');
        assert.strictEqual(dto.standardSettings.scanMode.id, testData.scanMode.list[0].id);
        assert.strictEqual(dto.historySettings.overlap, 10);
      });

      it('should convert SouthItemGroupEntity with null overlap to DTO', () => {
        const entity: SouthItemGroupEntity = {
          id: 'group2',
          name: 'Test Group 2',
          southId: testData.south.list[0].id,
          scanMode: testData.scanMode.list[0],
          overlap: null,
          maxReadInterval: null,
          readDelay: 0,
          items: [],
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        };

        const dto = toSouthItemGroupDTO(entity, id => ({ id, friendlyName: id }));
        assert.strictEqual(dto.historySettings.overlap, null);
      });

      it('should convert item with group to DTO using toSouthConnectorItemCommandDTO', () => {
        const group: SouthItemGroupEntity = {
          id: 'group1',
          name: 'Test Group',
          southId: testData.south.list[0].id,
          scanMode: testData.scanMode.list[0],
          overlap: null,
          maxReadInterval: null,
          readDelay: 0,
          items: [],
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        };

        southItemGroupRepository.findById.mock.mockImplementation(() => group);

        const itemWithGroup: SouthConnectorItemEntity<SouthItemSettings> = {
          id: 'item1',
          name: 'Test Item',
          enabled: true,
          scanMode: testData.scanMode.list[0],
          settings: {} as SouthItemSettings,
          group,
          syncWithGroup: false,
          maxReadInterval: null,
          readDelay: null,
          overlap: null,
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        };

        const itemDTO = toSouthConnectorItemDTO(itemWithGroup, testData.south.list[0].type, id => ({ id, friendlyName: id }));
        assert.ok(itemDTO.group !== null);
        assert.strictEqual(itemDTO.group!.id, 'group1');
        assert.strictEqual(itemDTO.group!.standardSettings.name, 'Test Group');
      });

      it('should convert item without group to DTO', () => {
        const itemWithoutGroup: SouthConnectorItemEntity<SouthItemSettings> = {
          id: 'item2',
          name: 'Test Item 2',
          enabled: true,
          scanMode: testData.scanMode.list[0],
          settings: {} as SouthItemSettings,
          group: null,
          syncWithGroup: false,
          maxReadInterval: null,
          readDelay: null,
          overlap: null,
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        };

        const itemDTO = toSouthConnectorItemDTO(itemWithoutGroup, testData.south.list[0].type, id => ({ id, friendlyName: id }));
        assert.strictEqual(itemDTO.group, null);
      });

      describe('copySouthItemCommandToSouthItemEntity', () => {
        it('should use default value for retrieveSecretsFromSouth when undefined is passed', async () => {
          const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
          const command: SouthConnectorItemCommandDTO = {
            ...testData.south.itemCommand,
            id: 'testItemId'
          };

          await copySouthItemCommandToSouthItemEntity(
            southItemEntity,
            command,
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
          const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
          const command: SouthConnectorItemCommandDTO = {
            ...testData.south.itemCommand,
            id: 'testItemId',
            syncWithGroup: true,
            maxReadInterval: 3600,
            readDelay: 200,
            overlap: 100
          };

          await copySouthItemCommandToSouthItemEntity(
            southItemEntity,
            command,
            null,
            testData.south.list[0].type,
            testData.scanMode.list,
            [],
            false
          );

          assert.strictEqual(southItemEntity.syncWithGroup, true);
          assert.strictEqual(southItemEntity.maxReadInterval, 3600);
          assert.strictEqual(southItemEntity.readDelay, 200);
          assert.strictEqual(southItemEntity.overlap, 100);
        });

        it('should set syncWithGroup to false when command.syncWithGroup is explicitly false', async () => {
          const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
          const command: SouthConnectorItemCommandDTO = {
            ...testData.south.itemCommand,
            id: 'testItemId',
            syncWithGroup: false
          };

          await copySouthItemCommandToSouthItemEntity(
            southItemEntity,
            command,
            null,
            testData.south.list[0].type,
            testData.scanMode.list,
            [],
            false
          );

          assert.strictEqual(southItemEntity.syncWithGroup, false);
        });

        it('should default syncWithGroup to false when command.syncWithGroup is undefined', async () => {
          const southItemEntity = {} as SouthConnectorItemEntity<SouthItemSettings>;
          const command = {
            ...testData.south.itemCommand,
            id: 'testItemId',
            syncWithGroup: undefined
          } as unknown as SouthConnectorItemCommandDTO;

          await copySouthItemCommandToSouthItemEntity(
            southItemEntity,
            command,
            null,
            testData.south.list[0].type,
            testData.scanMode.list,
            [],
            false
          );

          assert.strictEqual(southItemEntity.syncWithGroup, false);
        });
      });
    });
  });
});
