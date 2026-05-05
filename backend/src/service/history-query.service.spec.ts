import { describe, it, before, beforeEach, afterEach, mock, type Mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import testData from '../tests/utils/test-data';
import { mockModule, reloadModule, seq } from '../tests/utils/test-utils';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import HistoryQueryRepositoryMock from '../tests/__mocks__/repository/config/history-query-repository.mock';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import HistoryQueryMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/history-query-metrics-repository.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/config/north-connector-repository.mock';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import TransformerServiceMock from '../tests/__mocks__/service/transformer-service.mock';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import { southManifestList } from './south-manifests';
import { northManifestList } from './north-manifests';
import manifest from '../south/south-mssql/manifest';
import type HistoryQueryServiceType from './history-query.service';
import type {
  toHistoryQueryDTO as toHistoryQueryDTOType,
  toHistoryQueryItemDTO as toHistoryQueryItemDTOType,
  toHistoryQueryLightDTO as toHistoryQueryLightDTOType
} from './history-query.service';
import type { HistoryQueryItemDTO } from '../../shared/model/history-query.model';
import type { HistoryQueryEntityLight } from '../model/histor-query.model';
import type { TransformerDTO } from '../../shared/model/transformer.model';
import type { HistoryTransformerWithOptions } from '../model/transformer.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import { toScanModeDTO } from './scan-mode.service';

const nodeRequire = createRequire(import.meta.url);

const logger = new PinoLogger();
const historyQueryRepository = new HistoryQueryRepositoryMock();
const northConnectorRepository = new NorthConnectorRepositoryMock();
const southConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository = new ScanModeRepositoryMock();
const logRepository = new LogRepositoryMock();
const historyQueryMetricsRepository = new HistoryQueryMetricsRepositoryMock();
const southService = new SouthServiceMock();
const northService = new NorthServiceMock();
const oIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const engine = new DataStreamEngineMock(logger);
const transformerService = new TransformerServiceMock();

const encryptionService = new EncryptionServiceMock('', '');

const validatorMock = {
  validateSettings: mock.fn(async () => undefined),
  validate: mock.fn(async () => undefined)
};

const mockPapaparse = {
  parse: mock.fn((): { meta: { delimiter: string }; data: Array<Record<string, unknown>> } => ({ meta: { delimiter: ',' }, data: [] }))
};

const mockUtils = {
  stringToBoolean: mock.fn(() => true),
  checkScanMode: mock.fn((): (typeof testData.scanMode.list)[0] => testData.scanMode.list[0]),
  checkGroups: mock.fn()
};

const mockTransformerService = {
  toTransformerDTO: mock.fn((transformer: unknown, _getUserInfo: unknown) => transformer)
};

let HistoryQueryService: typeof HistoryQueryServiceType;
let toHistoryQueryDTO: typeof toHistoryQueryDTOType;
let toHistoryQueryItemDTO: typeof toHistoryQueryItemDTOType;
let toHistoryQueryLightDTO: typeof toHistoryQueryLightDTOType;

describe('History Query service', () => {
  let service: InstanceType<typeof HistoryQueryServiceType>;

  before(() => {
    mockModule(nodeRequire, 'papaparse', mockPapaparse);
    mockModule(nodeRequire, '../service/utils', mockUtils);
    mockModule(nodeRequire, './utils', mockUtils);
    mockModule(nodeRequire, '../web-server/controllers/validators/joi.validator', {
      default: class {
        validateSettings = validatorMock.validateSettings;
        validate = validatorMock.validate;
      }
    });
    mockModule(nodeRequire, './encryption.service', {
      encryptionService
    });
    mockModule(nodeRequire, './transformer.service', {
      default: class {},
      toTransformerDTO: mockTransformerService.toTransformerDTO
    });

    const mod = reloadModule<{
      default: typeof HistoryQueryServiceType;
      toHistoryQueryDTO: typeof toHistoryQueryDTOType;
      toHistoryQueryItemDTO: typeof toHistoryQueryItemDTOType;
      toHistoryQueryLightDTO: typeof toHistoryQueryLightDTOType;
    }>(nodeRequire, './history-query.service');
    HistoryQueryService = mod.default;
    toHistoryQueryDTO = mod.toHistoryQueryDTO;
    toHistoryQueryItemDTO = mod.toHistoryQueryItemDTO;
    toHistoryQueryLightDTO = mod.toHistoryQueryLightDTO;
  });

  beforeEach(() => {
    // Reset all mock calls
    historyQueryRepository.findAllHistoriesLight.mock.resetCalls();
    historyQueryRepository.findHistoryById.mock.resetCalls();
    historyQueryRepository.findItemById.mock.resetCalls();
    historyQueryRepository.saveHistory.mock.resetCalls();
    historyQueryRepository.updateHistoryStatus.mock.resetCalls();
    historyQueryRepository.deleteHistory.mock.resetCalls();
    historyQueryRepository.saveItem.mock.resetCalls();
    historyQueryRepository.saveAllItems.mock.resetCalls();
    historyQueryRepository.deleteItem.mock.resetCalls();
    historyQueryRepository.deleteAllItemsByHistory.mock.resetCalls();
    historyQueryRepository.enableItem.mock.resetCalls();
    historyQueryRepository.disableItem.mock.resetCalls();
    historyQueryRepository.findAllItemsForHistory.mock.resetCalls();
    historyQueryRepository.searchItems.mock.resetCalls();
    historyQueryRepository.addOrEditTransformer.mock.resetCalls();
    historyQueryRepository.removeTransformer.mock.resetCalls();
    historyQueryMetricsRepository.removeMetrics.mock.resetCalls();
    oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.resetCalls();
    engine.createHistoryQuery.mock.resetCalls();
    engine.reloadHistoryQuery.mock.resetCalls();
    engine.stopHistoryQuery.mock.resetCalls();
    engine.deleteHistoryQuery.mock.resetCalls();
    engine.getHistoryQuerySSE.mock.resetCalls();
    engine.getHistoryMetrics.mock.resetCalls();
    northService.getManifest.mock.resetCalls();
    northService.findById.mock.resetCalls();
    northService.testNorth.mock.resetCalls();
    southService.getManifest.mock.resetCalls();
    southService.findById.mock.resetCalls();
    southService.testSouth.mock.resetCalls();
    southService.testItem.mock.resetCalls();
    transformerService.findAll.mock.resetCalls();
    scanModeRepository.findAll.mock.resetCalls();
    validatorMock.validateSettings.mock.resetCalls();
    mockPapaparse.parse.mock.resetCalls();
    mockUtils.stringToBoolean.mock.resetCalls();
    mockUtils.checkScanMode.mock.resetCalls();
    logRepository.deleteLogsByScopeId.mock.resetCalls();

    // Default implementations
    northService.getManifest.mock.mockImplementation(() => northManifestList[4]); // file-writer
    northService.findById.mock.mockImplementation(() => testData.north.list[0]);
    southService.getManifest.mock.mockImplementation(() => southManifestList[0]); // folder-scanner
    southService.findById.mock.mockImplementation(() => testData.south.list[0]);
    historyQueryRepository.findHistoryById.mock.mockImplementation(() => testData.historyQueries.list[0]);
    historyQueryRepository.findItemById.mock.mockImplementation(() => testData.historyQueries.list[0].items[0]);
    historyQueryRepository.findAllHistoriesLight.mock.mockImplementation(() => []);
    transformerService.findAll.mock.mockImplementation(() => testData.transformers.list);
    scanModeRepository.findAll.mock.mockImplementation(() => testData.scanMode.list);
    mockUtils.stringToBoolean.mock.mockImplementation(() => true);
    mockUtils.checkScanMode.mock.mockImplementation(() => testData.scanMode.list[0]);
    validatorMock.validateSettings.mock.mockImplementation(async () => undefined);
    encryptionService.encryptConnectorSecrets.mock.mockImplementation(async <T>(secrets: T): Promise<T> => secrets);
    encryptionService.decryptConnectorSecrets.mock.mockImplementation(async <T>(secrets: T): Promise<T> => secrets);
    encryptionService.filterSecrets.mock.mockImplementation(<T>(secrets: T, _formSettings: unknown): T => secrets);

    service = new HistoryQueryService(
      validatorMock as unknown as InstanceType<typeof HistoryQueryServiceType>['validator' extends keyof InstanceType<
        typeof HistoryQueryServiceType
      >
        ? never
        : never],
      historyQueryRepository,
      northConnectorRepository,
      southConnectorRepository,
      scanModeRepository,
      logRepository,
      historyQueryMetricsRepository,
      southService,
      northService,
      transformerService,
      oIAnalyticsMessageService,
      engine
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should get all History queries', () => {
    historyQueryRepository.findAllHistoriesLight.mock.mockImplementationOnce(() => []);
    const result = service.list();
    assert.strictEqual(historyQueryRepository.findAllHistoriesLight.mock.calls.length, 1);
    assert.deepStrictEqual(result, []);
  });

  it('should get a History query', () => {
    const result = service.findById(testData.historyQueries.list[0].id);
    assert.strictEqual(historyQueryRepository.findHistoryById.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryRepository.findHistoryById.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
    assert.deepStrictEqual(result, testData.historyQueries.list[0]);
  });

  it('should throw not found error if history query does not exist', () => {
    historyQueryRepository.findHistoryById.mock.mockImplementationOnce(() => null);

    assert.throws(
      () => service.findById(testData.historyQueries.list[0].id),
      new NotFoundError(`History query "${testData.historyQueries.list[0].id}" not found`)
    );
    assert.deepStrictEqual(historyQueryRepository.findHistoryById.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
  });

  it('should create a history query', async () => {
    service.retrieveSecrets = mock.fn(() => null);

    await service.create(testData.historyQueries.command, testData.south.list[0].id, undefined, undefined, 'userTest');
    assert.strictEqual((service.retrieveSecrets as Mock<typeof service.retrieveSecrets>).mock.calls.length, 1);
    assert.strictEqual(historyQueryRepository.saveHistory.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual(engine.createHistoryQuery.mock.calls.length, 1);
  });

  it('should fail to create a history query when transformer is not found', async () => {
    transformerService.findAll.mock.mockImplementationOnce(() => []);
    service.retrieveSecrets = mock.fn(() => null);

    await assert.rejects(
      async () => service.create(testData.historyQueries.command, undefined, undefined, undefined, 'userTest'),
      new Error(`Could not find OIBus transformer "${testData.transformers.list[0].id}"`)
    );
  });

  it('should not create a history query with duplicate name', async () => {
    service.retrieveSecrets = mock.fn(() => null);
    historyQueryRepository.findAllHistoriesLight.mock.mockImplementation(() => [
      {
        ...testData.historyQueries.listLight[0],
        id: 'existing-id',
        name: testData.historyQueries.command.name
      } satisfies HistoryQueryEntityLight
    ]);

    await assert.rejects(
      async () => service.create(testData.historyQueries.command, undefined, undefined, undefined, 'userTest'),
      new OIBusValidationError(`History query name "${testData.historyQueries.command.name}" already exists`)
    );
  });

  it('should update a history query', async () => {
    historyQueryRepository.findAllHistoriesLight.mock.mockImplementation(() => testData.historyQueries.listLight);
    await service.update(testData.historyQueries.list[0].id, testData.historyQueries.command, false, 'userTest');

    assert.strictEqual(historyQueryRepository.saveHistory.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual(engine.reloadHistoryQuery.mock.calls.length, 1);
  });

  it('should update a history query without changing the name', async () => {
    const command = JSON.parse(JSON.stringify(testData.historyQueries.command));
    command.name = testData.historyQueries.list[0].name;
    historyQueryRepository.findAllHistoriesLight.mock.resetCalls();

    await service.update(testData.historyQueries.list[0].id, command, false, 'userTest');

    assert.strictEqual(historyQueryRepository.saveHistory.mock.calls.length, 1);
    assert.strictEqual(engine.reloadHistoryQuery.mock.calls.length, 1);
    assert.strictEqual(historyQueryRepository.findAllHistoriesLight.mock.calls.length, 0);
  });

  it('should update a history query and preserve createdBy for existing items', async () => {
    const command = JSON.parse(JSON.stringify(testData.historyQueries.command));
    command.items[0].id = testData.historyQueries.list[0].items[0].id;

    await service.update(testData.historyQueries.list[0].id, command, false, 'user1');

    assert.strictEqual(historyQueryRepository.saveHistory.mock.calls.length, 1);
  });

  it('should update a history query with an item id not found in previous settings', async () => {
    const command = JSON.parse(JSON.stringify(testData.historyQueries.command));
    command.items[0].id = 'non-existent-item-id';

    await service.update(testData.historyQueries.list[0].id, command, false, 'userTest');

    assert.strictEqual(historyQueryRepository.saveHistory.mock.calls.length, 1);
  });

  it('should update a history query with a new unique name', async () => {
    const command = JSON.parse(JSON.stringify(testData.historyQueries.command));
    command.name = 'Updated History Query Name';
    historyQueryRepository.findAllHistoriesLight.mock.mockImplementation(() => testData.historyQueries.listLight);

    await service.update(testData.historyQueries.list[0].id, command, false, 'userTest');

    assert.strictEqual(historyQueryRepository.saveHistory.mock.calls.length, 1);
    assert.strictEqual(engine.reloadHistoryQuery.mock.calls.length, 1);
  });

  it('should not update a history query with duplicate name', async () => {
    const command = JSON.parse(JSON.stringify(testData.historyQueries.command));
    command.name = 'Duplicate Name';
    historyQueryRepository.findAllHistoriesLight.mock.mockImplementation(() => [
      { ...testData.historyQueries.listLight[0], id: 'other-id', name: 'Duplicate Name' } satisfies HistoryQueryEntityLight
    ]);

    await assert.rejects(
      async () => service.update(testData.historyQueries.list[0].id, command, false, 'userTest'),
      new OIBusValidationError(`History query name "Duplicate Name" already exists`)
    );
  });

  it('should not update a history query with not found transformer', async () => {
    const command = JSON.parse(JSON.stringify(testData.historyQueries.command));
    command.name = 'New Name';
    command.northTransformers = [{ transformerId: 'bad-id' }];

    await assert.rejects(
      async () => service.update(testData.historyQueries.list[0].id, command, false, 'userTest'),
      new NotFoundError(`Could not find OIBus transformer "bad-id"`)
    );
  });

  it('should delete history query', async () => {
    await service.delete(testData.historyQueries.list[0].id);

    assert.deepStrictEqual(engine.deleteHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0]]);
    assert.deepStrictEqual(historyQueryRepository.deleteHistory.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
    assert.deepStrictEqual(historyQueryMetricsRepository.removeMetrics.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
  });

  it('should start history query', async () => {
    await service.start(testData.historyQueries.list[0].id);

    assert.deepStrictEqual(historyQueryRepository.updateHistoryStatus.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      'RUNNING'
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
  });

  it('should pause history query', async () => {
    await service.pause(testData.historyQueries.list[0].id);

    assert.deepStrictEqual(historyQueryRepository.updateHistoryStatus.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      'PAUSED'
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.stopHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
  });

  it('should get history query data stream', () => {
    service.getHistoryDataStream(testData.historyQueries.list[0].id);
    assert.deepStrictEqual(engine.getHistoryQuerySSE.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
  });

  it('should get history query metric', () => {
    service.getHistoryMetric(testData.historyQueries.list[0].id);
    assert.deepStrictEqual(engine.getHistoryMetrics.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
  });

  it('should test north connection in creation mode', async () => {
    await service.testNorth('create', testData.north.command.type, undefined, testData.north.command.settings);

    assert.deepStrictEqual(northService.testNorth.mock.calls[0].arguments, [
      'history',
      testData.north.command.type,
      testData.north.command.settings
    ]);
  });

  it('should test north connection in creation mode and retrieve secrets', async () => {
    await service.testNorth('create', testData.north.command.type, testData.north.list[0].id, testData.north.command.settings);

    assert.deepStrictEqual(northService.testNorth.mock.calls[0].arguments, [
      'history',
      testData.north.command.type,
      testData.north.command.settings
    ]);
  });

  it('should test north connection in edit mode', async () => {
    await service.testNorth(testData.historyQueries.list[0].id, testData.north.command.type, undefined, testData.north.command.settings);

    assert.deepStrictEqual(northService.testNorth.mock.calls[0].arguments, [
      'history',
      testData.north.command.type,
      testData.north.command.settings
    ]);
  });

  it('should test south connection in creation mode', async () => {
    await service.testSouth('create', testData.south.command.type, undefined, testData.south.command.settings);

    assert.deepStrictEqual(southService.testSouth.mock.calls[0].arguments, [
      'history',
      testData.south.command.type,
      testData.south.command.settings
    ]);
  });

  it('should test south connection in creation mode and retrieve secrets', async () => {
    await service.testSouth('create', testData.south.command.type, testData.south.list[0].id, testData.south.command.settings);

    assert.deepStrictEqual(southService.testSouth.mock.calls[0].arguments, [
      'history',
      testData.south.command.type,
      testData.south.command.settings
    ]);
  });

  it('should test south connection in edit mode', async () => {
    await service.testSouth(testData.historyQueries.list[0].id, testData.south.command.type, undefined, testData.south.command.settings);

    assert.deepStrictEqual(southService.testSouth.mock.calls[0].arguments, [
      'history',
      testData.south.command.type,
      testData.south.command.settings
    ]);
  });

  it('should test item in creation mode', async () => {
    await service.testItem(
      'create',
      testData.south.command.type,
      testData.south.itemCommand.name,
      undefined,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    );

    assert.deepStrictEqual(southService.testItem.mock.calls[0].arguments, [
      'history',
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    ]);
  });

  it('should test item in creation mode and retrieve secrets', async () => {
    await service.testItem(
      'create',
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.list[0].id,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    );

    assert.deepStrictEqual(southService.testItem.mock.calls[0].arguments, [
      'history',
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    ]);
  });

  it('should test item in edit mode', async () => {
    await service.testItem(
      testData.historyQueries.list[0].id,
      testData.south.command.type,
      testData.south.itemCommand.name,
      undefined,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    );

    assert.strictEqual(southService.testItem.mock.calls.length, 1);
  });

  it('should list items', async () => {
    service.listItems(testData.historyQueries.list[0].id);
    assert.deepStrictEqual(historyQueryRepository.findAllItemsForHistory.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
  });

  it('should search items', async () => {
    service.searchItems(testData.historyQueries.list[0].id, { name: undefined, enabled: undefined, page: 0 });
    assert.deepStrictEqual(historyQueryRepository.searchItems.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      { name: undefined, enabled: undefined, page: 0 }
    ]);
  });

  it('should find an item', async () => {
    service.findItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id);

    assert.deepStrictEqual(historyQueryRepository.findItemById.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    ]);
  });

  it('should throw not found error if item does not exist', async () => {
    historyQueryRepository.findItemById.mock.mockImplementationOnce(() => null);

    assert.throws(
      () => service.findItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id),
      new NotFoundError(`Item "${testData.historyQueries.list[0].items[0].id}" not found`)
    );

    assert.deepStrictEqual(historyQueryRepository.findItemById.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    ]);
  });

  it('should create an item', async () => {
    await service.createItem(testData.historyQueries.list[0].id, testData.historyQueries.itemCommand, 'userTest');

    assert.deepStrictEqual(historyQueryRepository.findHistoryById.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
    assert.strictEqual(historyQueryRepository.saveItem.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
  });

  it('should update an item', async () => {
    await service.updateItem(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id,
      testData.historyQueries.itemCommand,
      'userTest'
    );

    assert.deepStrictEqual(historyQueryRepository.findItemById.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    ]);
    assert.strictEqual(historyQueryRepository.saveItem.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
  });

  it('should enable an item', async () => {
    await service.enableItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id);

    assert.deepStrictEqual(historyQueryRepository.findItemById.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    ]);
    assert.deepStrictEqual(historyQueryRepository.enableItem.mock.calls[0].arguments, [testData.historyQueries.list[0].items[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
  });

  it('should disable an item', async () => {
    await service.disableItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id);

    assert.deepStrictEqual(historyQueryRepository.findItemById.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    ]);
    assert.deepStrictEqual(historyQueryRepository.disableItem.mock.calls[0].arguments, [testData.historyQueries.list[0].items[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
  });

  it('should enable multiple history query items', async () => {
    const historyQueryId = testData.historyQueries.list[0].id;
    const itemIds = [testData.historyQueries.list[0].items[0].id, testData.historyQueries.list[0].items[1].id];

    historyQueryRepository.findHistoryById.mock.mockImplementation(() => testData.historyQueries.list[0]);
    historyQueryRepository.findItemById.mock.mockImplementation(
      seq(
        () => testData.historyQueries.list[0].items[0],
        () => testData.historyQueries.list[0].items[1]
      )
    );

    await service.enableItems(historyQueryId, itemIds);

    assert.deepStrictEqual(historyQueryRepository.enableItem.mock.calls[0].arguments, [testData.historyQueries.list[0].items[0].id]);
    assert.deepStrictEqual(historyQueryRepository.enableItem.mock.calls[1].arguments, [testData.historyQueries.list[0].items[1].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
  });

  it('should disable multiple history query items', async () => {
    const historyQueryId = testData.historyQueries.list[0].id;
    const itemIds = [testData.historyQueries.list[0].items[0].id, testData.historyQueries.list[0].items[1].id];

    historyQueryRepository.findItemById.mock.mockImplementation(
      seq(
        () => testData.historyQueries.list[0].items[0],
        () => testData.historyQueries.list[0].items[1]
      )
    );

    await service.disableItems(historyQueryId, itemIds);

    assert.deepStrictEqual(historyQueryRepository.disableItem.mock.calls[0].arguments, [testData.historyQueries.list[0].items[0].id]);
    assert.deepStrictEqual(historyQueryRepository.disableItem.mock.calls[1].arguments, [testData.historyQueries.list[0].items[1].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
  });

  it('should delete an item', async () => {
    await service.deleteItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id);

    assert.deepStrictEqual(historyQueryRepository.findItemById.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    ]);
    assert.deepStrictEqual(historyQueryRepository.deleteItem.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
  });

  it('should delete multiple history query items', async () => {
    const historyQueryId = testData.historyQueries.list[0].id;
    const itemIds = [testData.historyQueries.list[0].items[0].id, testData.historyQueries.list[0].items[1].id];

    historyQueryRepository.findItemById.mock.mockImplementation(
      seq(
        () => testData.historyQueries.list[0].items[0],
        () => testData.historyQueries.list[0].items[1]
      )
    );

    await service.deleteItems(historyQueryId, itemIds);

    assert.deepStrictEqual(historyQueryRepository.deleteItem.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    ]);
    assert.deepStrictEqual(historyQueryRepository.deleteItem.mock.calls[1].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[1].id
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
  });

  it('should delete all items', async () => {
    await service.deleteAllItems(testData.historyQueries.list[0].id);

    assert.deepStrictEqual(historyQueryRepository.deleteAllItemsByHistory.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], true]);
  });

  it('should properly check items', async () => {
    const csvData: Array<Record<string, unknown>> = [
      {
        name: 'item1',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100
      },
      {
        name: 'item3',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        settings_badItem: 100
      },
      {
        name: 'item4',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 12, // bad type
        settings_minAge: 100
      },
      {
        name: 'item5',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100
      }
    ];
    mockPapaparse.parse.mock.mockImplementationOnce(() => ({
      meta: { delimiter: ',' },
      data: csvData
    }));
    validatorMock.validateSettings.mock.mockImplementationOnce(async () => {
      throw new Error('validation error');
    });

    const result = await service.checkImportItems(
      testData.historyQueries.command.southType,
      'file content',
      ',',
      testData.historyQueries.list[0].items as unknown as Array<HistoryQueryItemDTO>
    );
    assert.deepStrictEqual(result, {
      items: [
        {
          id: '',
          name: csvData[3].name,
          enabled: true,
          settings: {
            ignoreModifiedDate: true,
            minAge: 100,
            preserveFiles: true,
            regex: '*'
          }
        }
      ],
      errors: [
        {
          error: 'Item name "item1" already used',
          item: {
            name: csvData[0].name,
            enabled: 'true',
            settings_ignoreModifiedDate: 'false',
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        },
        {
          error: 'Settings "badItem" not accepted in manifest',
          item: {
            name: csvData[1].name,
            enabled: 'true',
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
            name: csvData[2].name,
            enabled: 'true',
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
    southService.getManifest.mock.mockImplementationOnce(() => manifest);
    const csvData: Array<Record<string, unknown>> = [
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
        })
      }
    ];
    mockPapaparse.parse.mock.mockImplementationOnce(() => ({
      meta: { delimiter: ',' },
      data: csvData
    }));
    const result = await service.checkImportItems(
      testData.historyQueries.command.southType,
      'file content',
      ',',
      testData.historyQueries.list[1].items as unknown as Array<HistoryQueryItemDTO>
    );
    assert.deepStrictEqual(result, {
      items: [
        {
          id: '',
          name: csvData[0].name,
          enabled: String(csvData[0].enabled).toLowerCase() === 'true',
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
          }
        }
      ],
      errors: []
    });
  });

  it('should throw error if delimiter does not match', async () => {
    mockPapaparse.parse.mock.mockImplementationOnce(() => ({
      meta: { delimiter: ';' },
      data: []
    }));

    await assert.rejects(
      async () => service.checkImportItems(testData.historyQueries.command.southType, '', ',', []),
      new OIBusValidationError(`The entered delimiter "," does not correspond to the file delimiter ";"`)
    );
  });

  it('should import items', async () => {
    await service.importItems(testData.historyQueries.list[0].id, [testData.historyQueries.itemCommand], 'userTest');

    assert.strictEqual(historyQueryRepository.saveAllItems.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
  });

  it('should add or edit transformer', async () => {
    const transformerWithOptions = {
      id: 'historyTransformerId1',
      inputType: 'input',
      transformer: testData.transformers.list[0] as TransformerDTO,
      options: {},
      items: []
    } as HistoryTransformerWithOptions;

    await service.addOrEditTransformer(testData.historyQueries.list[0].id, transformerWithOptions);

    assert.deepStrictEqual(historyQueryRepository.addOrEditTransformer.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      transformerWithOptions
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.stopHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
  });

  it('should remove transformer', async () => {
    await service.removeTransformer(testData.historyQueries.list[0].id, testData.historyQueries.list[0].northTransformers[0].id);

    assert.deepStrictEqual(historyQueryRepository.removeTransformer.mock.calls[0].arguments, [
      testData.historyQueries.list[0].northTransformers[0].id
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.stopHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
  });

  it('should retrieve secrets from history query', () => {
    const historySource = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    historySource.southType = southManifestList[4].id;
    historySource.northType = northManifestList[4].id;
    historyQueryRepository.findHistoryById.mock.mockImplementationOnce(() => historySource);
    const result = service.retrieveSecrets(
      undefined,
      undefined,
      testData.historyQueries.list[0].id,
      southManifestList[4],
      northManifestList[4]
    );
    assert.deepStrictEqual(historyQueryRepository.findHistoryById.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
    assert.deepStrictEqual(result, historySource);
  });

  it('should throw an error if history query south type does not match manifest', () => {
    const historySource = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    historySource.southType = 'bad';
    historyQueryRepository.findHistoryById.mock.mockImplementationOnce(() => historySource);

    assert.throws(
      () => service.retrieveSecrets(undefined, undefined, testData.historyQueries.list[0].id, southManifestList[4], northManifestList[4]),
      new Error(
        `History query "${historySource.id}" (South type "${historySource.southType}") must be of the South type "${southManifestList[4].id}"`
      )
    );
  });

  it('should throw an error if history query north type does not match manifest', () => {
    const historySource = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    historySource.southType = southManifestList[4].id;
    historySource.northType = 'bad';
    historyQueryRepository.findHistoryById.mock.mockImplementationOnce(() => historySource);

    assert.throws(
      () => service.retrieveSecrets(undefined, undefined, testData.historyQueries.list[0].id, southManifestList[4], northManifestList[4]),
      new Error(
        `History query "${historySource.id}" (North type "${historySource.northType}") must be of the North type "${northManifestList[4].id}"`
      )
    );
    assert.deepStrictEqual(historyQueryRepository.findHistoryById.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
  });

  it('should retrieve secrets from south and north connectors', () => {
    southService.findById.mock.mockImplementationOnce(() => testData.south.list[1]); // retrieve the mssql connector
    const result = service.retrieveSecrets(
      testData.south.list[1].id,
      testData.north.list[0].id,
      undefined,
      southManifestList[4],
      northManifestList[4]
    );

    assert.deepStrictEqual(result, {
      southType: testData.south.list[1].type,
      southSettings: testData.south.list[1].settings,
      items: testData.south.list[1].items,
      northType: testData.north.list[0].type,
      northSettings: testData.north.list[0].settings
    });
  });

  it('should retrieve secrets from south only', () => {
    southService.findById.mock.mockImplementationOnce(() => testData.south.list[1]); // retrieve the mssql connector

    const result = service.retrieveSecrets(testData.south.list[1].id, undefined, undefined, southManifestList[4], northManifestList[4]);

    assert.deepStrictEqual(result, {
      southType: testData.south.list[1].type,
      southSettings: testData.south.list[1].settings,
      items: testData.south.list[1].items
    });
  });

  it('should retrieve secrets from north only', () => {
    const result = service.retrieveSecrets(undefined, testData.north.list[0].id, undefined, southManifestList[4], northManifestList[4]);

    assert.deepStrictEqual(result, {
      items: [],
      northType: testData.north.list[0].type,
      northSettings: testData.north.list[0].settings
    });
  });

  it('should fail to retrieve secrets from south if does not match type', () => {
    const south = JSON.parse(JSON.stringify(testData.south.list[0]));
    south.type = 'bad';
    southService.findById.mock.mockImplementationOnce(() => south);

    assert.throws(
      () =>
        service.retrieveSecrets(
          testData.south.list[0].id,
          testData.north.list[0].id,
          undefined,
          southManifestList[4],
          northManifestList[4]
        ),
      new Error(`South connector "${testData.south.list[0].id}" (type "${south.type}") must be of the type "${southManifestList[4].id}"`)
    );
  });

  it('should fail to retrieve secrets from north if does not match type', () => {
    southService.findById.mock.mockImplementationOnce(() => testData.south.list[1]); // retrieve the mssql connector

    const north = JSON.parse(JSON.stringify(testData.north.list[0]));
    north.type = 'bad';
    northService.findById.mock.mockImplementationOnce(() => north);

    assert.throws(
      () =>
        service.retrieveSecrets(
          testData.north.list[0].id,
          testData.north.list[0].id,
          undefined,
          southManifestList[4],
          northManifestList[4]
        ),
      new Error(`North connector "${testData.north.list[0].id}" (type "${north.type}") must be of the type "${northManifestList[4].id}"`)
    );
  });

  it('should return null', () => {
    assert.strictEqual(service.retrieveSecrets(undefined, undefined, undefined, southManifestList[4], northManifestList[4]), null);
  });

  it('should properly convert to DTO', () => {
    const getUserInfo = (id: string) => ({ id, friendlyName: id });
    const historyQuery = testData.historyQueries.list[0];
    assert.deepStrictEqual(toHistoryQueryDTO(historyQuery, getUserInfo), {
      id: historyQuery.id,
      name: historyQuery.name,
      description: historyQuery.description,
      status: historyQuery.status,
      queryTimeRange: {
        startTime: historyQuery.queryTimeRange.startTime,
        endTime: historyQuery.queryTimeRange.endTime,
        maxReadInterval: historyQuery.queryTimeRange.maxReadInterval,
        readDelay: historyQuery.queryTimeRange.readDelay
      },
      southType: historyQuery.southType,
      northType: historyQuery.northType,
      southSettings: historyQuery.southSettings,
      northSettings: historyQuery.northSettings,
      caching: {
        trigger: {
          scanMode: toScanModeDTO(historyQuery.caching.trigger.scanMode, getUserInfo),
          numberOfElements: historyQuery.caching.trigger.numberOfElements,
          numberOfFiles: historyQuery.caching.trigger.numberOfFiles
        },
        throttling: {
          runMinDelay: historyQuery.caching.throttling.runMinDelay,
          maxSize: historyQuery.caching.throttling.maxSize,
          maxNumberOfElements: historyQuery.caching.throttling.maxNumberOfElements
        },
        error: {
          retryInterval: historyQuery.caching.error.retryInterval,
          retryCount: historyQuery.caching.error.retryCount,
          retentionDuration: historyQuery.caching.error.retentionDuration
        },
        archive: {
          enabled: historyQuery.caching.archive.enabled,
          retentionDuration: historyQuery.caching.archive.retentionDuration
        }
      },
      items: historyQuery.items.map(item => toHistoryQueryItemDTO(item, historyQuery.southType, getUserInfo)),
      northTransformers: historyQuery.northTransformers.map(transformerWithOptions => ({
        id: transformerWithOptions.id,
        transformer: mockTransformerService.toTransformerDTO(transformerWithOptions.transformer, getUserInfo),
        options: transformerWithOptions.options,
        items: transformerWithOptions.items.map(item => ({
          id: item.id,
          name: item.name,
          enabled: item.enabled,
          createdBy: getUserInfo(item.createdBy),
          updatedBy: getUserInfo(item.updatedBy),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }))
      })),
      createdBy: getUserInfo(historyQuery.createdBy),
      updatedBy: getUserInfo(historyQuery.updatedBy),
      createdAt: historyQuery.createdAt,
      updatedAt: historyQuery.updatedAt
    });
    const historyQueryLight: HistoryQueryEntityLight = {
      id: historyQuery.id,
      name: historyQuery.name,
      description: historyQuery.description,
      status: historyQuery.status,
      startTime: historyQuery.queryTimeRange.startTime,
      endTime: historyQuery.queryTimeRange.endTime,
      southType: historyQuery.southType,
      northType: historyQuery.northType,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    assert.deepStrictEqual(toHistoryQueryLightDTO(historyQueryLight, getUserInfo), {
      id: historyQuery.id,
      name: historyQuery.name,
      description: historyQuery.description,
      status: historyQuery.status,
      startTime: historyQuery.queryTimeRange.startTime,
      endTime: historyQuery.queryTimeRange.endTime,
      southType: historyQuery.southType,
      northType: historyQuery.northType,
      createdBy: getUserInfo(historyQueryLight.createdBy),
      updatedBy: getUserInfo(historyQueryLight.updatedBy),
      createdAt: historyQueryLight.createdAt,
      updatedAt: historyQueryLight.updatedAt
    });
  });
});
