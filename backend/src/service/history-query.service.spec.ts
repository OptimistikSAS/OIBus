import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type { TransformerDTO } from '../../shared/model/api/transformer.model';

import type DataStreamEngine from '../engine/data-stream-engine';
import type { HistoryQueryEntityLight } from '../model/histor-query.model';
import type { HistoryTransformerWithOptions } from '../model/transformer.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import type HistoryQueryRepository from '../repository/config/history-query.repository';
import type NorthConnectorRepository from '../repository/config/north-connector.repository';
import type ScanModeRepository from '../repository/config/scan-mode.repository';
import type SouthConnectorRepository from '../repository/config/south-connector.repository';
import type LogRepository from '../repository/logs/log.repository';
import type HistoryQueryMetricsRepository from '../repository/metrics/history-query-metrics.repository';
import manifest from '../south/south-mssql/manifest';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule, seq } from '../tests/utils/test-utils';
import type JoiValidator from '../web-server/controllers/validators/joi.validator';
import type HistoryQueryServiceType from './history-query.service';
import type {
  toHistoryQueryDTO as toHistoryQueryDTOType,
  toHistoryQueryItemDTO as toHistoryQueryItemDTOType,
  toHistoryQueryLightDTO as toHistoryQueryLightDTOType
} from './history-query.service';
import type NorthService from './north.service';
import { northManifestList } from './north-manifests';
import type OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { toScanModeDTO } from './scan-mode.service';
import type SouthService from './south.service';
import { southManifestList } from './south-manifests';
import type TransformerService from './transformer.service';
import type * as Utils from './utils';

const nodeRequire = createRequire(import.meta.url);

// Looked up by id rather than by position: northManifestList order shifts whenever a connector is added.
const fileWriterManifest = northManifestList.find(northManifest => northManifest.id === 'file-writer')!;
const mssqlManifest = southManifestList.find(southManifest => southManifest.id === 'mssql')!;

const realUtils: typeof Utils = nodeRequire('./utils');
// Only the CSV parsing is controlled by the tests
const createParseCsvImportMock = () => mock.fn((_fileContent: string, _delimiter: string): Array<Record<string, unknown>> => []);
const utilsExports = { ...realUtils, parseCsvImport: createParseCsvImportMock() };
const toTransformerDTO = mock.fn((transformer: unknown, _getUserInfo: unknown) => transformer);
const getUserInfo = (id: string) => ({ id, friendlyName: id });

const buildHistoryQueryLight = (): HistoryQueryEntityLight => {
  const historyQuery = testData.historyQueries.list[0];
  return {
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
};

let HistoryQueryService: typeof HistoryQueryServiceType;
let toHistoryQueryDTO: typeof toHistoryQueryDTOType;
let toHistoryQueryItemDTO: typeof toHistoryQueryItemDTOType;
let toHistoryQueryLightDTO: typeof toHistoryQueryLightDTOType;

describe('History Query service', () => {
  let validator: Mocked<JoiValidator>;
  let historyQueryRepository: Mocked<HistoryQueryRepository>;
  let historyQueryMetricsRepository: Mocked<HistoryQueryMetricsRepository>;
  let southService: Mocked<SouthService>;
  let northService: Mocked<NorthService>;
  let transformerService: Mocked<TransformerService>;
  let oIAnalyticsMessageService: Mocked<OIAnalyticsMessageService>;
  let engine: Mocked<DataStreamEngine>;
  let service: HistoryQueryServiceType;

  before(() => {
    mockModule(nodeRequire, './utils', utilsExports);
    mockModule(nodeRequire, './encryption.service', { encryptionService: new EncryptionServiceMock('', '') });
    mockModule(nodeRequire, './transformer.service', { default: class {}, toTransformerDTO });

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
    utilsExports.parseCsvImport = createParseCsvImportMock();
    validator = createMock<JoiValidator>();
    historyQueryRepository = createMock<HistoryQueryRepository>({
      findHistoryById: () => testData.historyQueries.list[0],
      findItemById: () => testData.historyQueries.list[0].items[0],
      findAllHistoriesLight: () => []
    });
    historyQueryMetricsRepository = createMock<HistoryQueryMetricsRepository>();
    southService = createMock<SouthService>({
      getManifest: () => southManifestList[0], // folder-scanner
      findById: () => testData.south.list[0]
    });
    northService = createMock<NorthService>({
      getManifest: () => fileWriterManifest,
      findById: () => testData.north.list[0]
    });
    transformerService = createMock<TransformerService>({ findAll: () => testData.transformers.list });
    oIAnalyticsMessageService = createMock<OIAnalyticsMessageService>();
    engine = createMock<DataStreamEngine>({ logger: new PinoLogger() });

    service = new HistoryQueryService(
      validator,
      historyQueryRepository,
      createMock<NorthConnectorRepository>(),
      createMock<SouthConnectorRepository>(),
      createMock<ScanModeRepository>({ findAll: () => testData.scanMode.list }),
      createMock<LogRepository>(),
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
    const retrieveSecrets = mock.method(service, 'retrieveSecrets', () => null);

    await service.create(testData.historyQueries.command, testData.south.list[0].id, undefined, undefined, 'userTest');
    assert.strictEqual(retrieveSecrets.mock.calls.length, 1);
    assert.strictEqual(historyQueryRepository.saveHistory.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual(engine.createHistoryQuery.mock.calls.length, 1);
  });

  it('should fail to create a history query when transformer is not found', async () => {
    transformerService.findAll.mock.mockImplementationOnce(() => []);
    mock.method(service, 'retrieveSecrets', () => null);

    await assert.rejects(
      async () => service.create(testData.historyQueries.command, undefined, undefined, undefined, 'userTest'),
      new Error(`Could not find OIBus transformer "${testData.transformers.list[0].id}"`)
    );
  });

  it('should not create a history query with duplicate name', async () => {
    mock.method(service, 'retrieveSecrets', () => null);
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

  it('should create a history query with a null south item id and resolve a non-temp northTransformer item', async () => {
    mock.method(service, 'retrieveSecrets', () => null);
    const command = JSON.parse(JSON.stringify(testData.historyQueries.command));
    command.items[0].id = null;
    command.northTransformers = [
      {
        id: 'historyTransformerId3',
        transformerId: testData.transformers.list[0].id,
        options: {},
        items: [{ id: '', name: 'item4', enabled: true }]
      }
    ];

    await service.create(command, undefined, undefined, undefined, 'userTest');

    assert.strictEqual(historyQueryRepository.saveHistory.mock.calls.length, 1);
    const savedHistoryQuery = historyQueryRepository.saveHistory.mock.calls[0].arguments[0];
    assert.strictEqual(savedHistoryQuery.items[0].id, '');
    assert.strictEqual(savedHistoryQuery.northTransformers[0].items[0].id, '');
    assert.strictEqual(savedHistoryQuery.northTransformers[0].items[0].createdBy, 'userTest');
  });

  it('should fail to create a history query when a non-temp northTransformer item is not found among the history items', async () => {
    mock.method(service, 'retrieveSecrets', () => null);
    const command = JSON.parse(JSON.stringify(testData.historyQueries.command));
    command.items[0].id = 'existingItem1';
    command.northTransformers = [
      {
        id: 'historyTransformerId3',
        transformerId: testData.transformers.list[0].id,
        options: {},
        items: [{ id: 'missing-item-id', name: 'missing item', enabled: true }]
      }
    ];

    await assert.rejects(
      async () => service.create(command, undefined, undefined, undefined, 'userTest'),
      new NotFoundError('Could not find History item "missing item" (missing-item-id)')
    );
  });

  it('should update a history query', async () => {
    historyQueryRepository.findAllHistoriesLight.mock.mockImplementation(() => testData.historyQueries.listLight);
    await service.update(testData.historyQueries.list[0].id, testData.historyQueries.command, false, 'userTest');

    // The new settings are checked, not the stored ones
    assert.deepStrictEqual(validator.validateSettings.mock.calls[0].arguments[1], testData.historyQueries.command.northSettings);
    assert.deepStrictEqual(validator.validateSettings.mock.calls[1].arguments[1], testData.historyQueries.command.southSettings);
    assert.deepStrictEqual(validator.validateSettings.mock.calls[2].arguments[1], testData.historyQueries.command.items[0].settings);
    assert.strictEqual(historyQueryRepository.saveHistory.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual(engine.reloadHistoryQuery.mock.calls.length, 1);
  });

  it('should not update a history query whose settings do not match the manifest', async () => {
    validator.validateSettings.mock.mockImplementationOnce(async () => {
      throw new Error('"outputFolder" is required');
    });

    await assert.rejects(
      service.update(testData.historyQueries.list[0].id, testData.historyQueries.command, false, 'userTest'),
      new Error('"outputFolder" is required')
    );
    assert.strictEqual(historyQueryRepository.saveHistory.mock.calls.length, 0);
  });

  it('should update a history query without changing the name', async () => {
    const command = JSON.parse(JSON.stringify(testData.historyQueries.command));
    command.name = testData.historyQueries.list[0].name;

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

  it('should update a history query with a null south item id and resolve a non-temp northTransformer item', async () => {
    const command = JSON.parse(JSON.stringify(testData.historyQueries.command));
    command.items[0].id = null;
    command.northTransformers = [
      {
        id: 'historyTransformerId3',
        transformerId: testData.transformers.list[0].id,
        options: {},
        items: [{ id: '', name: 'item4', enabled: true }]
      }
    ];

    await service.update(testData.historyQueries.list[0].id, command, false, 'userTest');

    assert.strictEqual(historyQueryRepository.saveHistory.mock.calls.length, 1);
    const savedHistoryQuery = historyQueryRepository.saveHistory.mock.calls[0].arguments[0];
    assert.strictEqual(savedHistoryQuery.items[0].id, '');
    assert.strictEqual(savedHistoryQuery.items[0].createdBy, 'userTest');
    assert.strictEqual(savedHistoryQuery.northTransformers[0].items[0].id, '');
  });

  it('should fail to update a history query when a non-temp northTransformer item is not found among the history items', async () => {
    const command = JSON.parse(JSON.stringify(testData.historyQueries.command));
    command.items[0].id = 'existingItem1';
    command.northTransformers = [
      {
        id: 'historyTransformerId3',
        transformerId: testData.transformers.list[0].id,
        options: {},
        items: [{ id: 'missing-item-id', name: 'missing item', enabled: true }]
      }
    ];

    await assert.rejects(
      async () => service.update(testData.historyQueries.list[0].id, command, false, 'userTest'),
      new NotFoundError('Could not find History item "missing item" (missing-item-id)')
    );
  });

  it('should delete history query', async () => {
    await service.delete(testData.historyQueries.list[0].id, 'userTest');

    assert.deepStrictEqual(engine.deleteHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0]]);
    assert.deepStrictEqual(historyQueryRepository.deleteHistory.mock.calls[0].arguments, [testData.historyQueries.list[0].id, 'userTest']);
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

  it('should give the south settings to test, validated', async () => {
    const settings = await service.southSettingsToTest(
      testData.historyQueries.list[0].id,
      testData.south.command.type,
      undefined,
      testData.south.command.settings
    );

    assert.deepStrictEqual(settings, testData.south.command.settings);
    assert.strictEqual(validator.validateSettings.mock.calls.length, 1);
  });

  it('should start an explore session in creation mode', async () => {
    await service.startExplore('create', testData.south.command.type, undefined, testData.south.command.settings);

    assert.deepStrictEqual(southService.startExplore.mock.calls[0].arguments, [
      'history',
      testData.south.command.type,
      testData.south.command.settings
    ]);
  });

  it('should start an explore session in creation mode and retrieve secrets', async () => {
    await service.startExplore('create', testData.south.command.type, testData.south.list[0].id, testData.south.command.settings);

    assert.deepStrictEqual(southService.startExplore.mock.calls[0].arguments, [
      'history',
      testData.south.command.type,
      testData.south.command.settings
    ]);
  });

  it('should start an explore session in edit mode', async () => {
    await service.startExplore(testData.historyQueries.list[0].id, testData.south.command.type, undefined, testData.south.command.settings);

    assert.deepStrictEqual(southService.startExplore.mock.calls[0].arguments, [
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
      testData.south.itemTestingSettings,
      undefined
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
      testData.south.itemTestingSettings,
      undefined
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
    // the history query is the connector the item is tested for
    assert.strictEqual(southService.testItem.mock.calls[0].arguments[6], testData.historyQueries.list[0].name);
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
    await service.deleteItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id, 'userTest');

    assert.deepStrictEqual(historyQueryRepository.findItemById.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    ]);
    assert.deepStrictEqual(historyQueryRepository.deleteItem.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id,
      'userTest'
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

    await service.deleteItems(historyQueryId, itemIds, 'userTest');

    assert.deepStrictEqual(historyQueryRepository.deleteItem.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id,
      'userTest'
    ]);
    assert.deepStrictEqual(historyQueryRepository.deleteItem.mock.calls[1].arguments, [
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[1].id,
      'userTest'
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0], false]);
  });

  it('should delete all items', async () => {
    await service.deleteAllItems(testData.historyQueries.list[0].id, 'userTest');

    assert.deepStrictEqual(historyQueryRepository.deleteAllItemsByHistory.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      'userTest'
    ]);
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
        description: 'item5 description',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100
      }
    ];
    utilsExports.parseCsvImport.mock.mockImplementationOnce(() => csvData);
    validator.validateSettings.mock.mockImplementationOnce(async () => {
      throw new Error('validation error');
    });

    const result = await service.checkImportItems(
      testData.historyQueries.command.southType,
      'file content',
      ',',
      testData.historyQueries.list[0].items
    );
    assert.deepStrictEqual(result, {
      items: [
        {
          id: '',
          name: csvData[3].name,
          description: 'item5 description',
          enabled: true,
          settings: {
            ignoreModifiedDate: false, // converted from 'false'
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

  it('should convert number settings when checking items', async () => {
    const csvData: Array<Record<string, unknown>> = [
      {
        name: 'numberItem',
        enabled: 'true',
        settings_regex: '*',
        settings_minAge: '100'
      },
      {
        name: 'emptyNumberItem',
        enabled: 'true',
        settings_regex: '*',
        settings_minAge: ''
      }
    ];
    utilsExports.parseCsvImport.mock.mockImplementationOnce(() => csvData);

    const result = await service.checkImportItems(testData.historyQueries.command.southType, 'file content', ',', []);

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
    southService.getManifest.mock.mockImplementationOnce(() => manifest);
    const csvData: Array<Record<string, unknown>> = [
      {
        name: 'item',
        enabled: 'true',
        settings_query: 'query',
        settings_trackingInstant: JSON.stringify({ trackInstant: false })
      }
    ];
    utilsExports.parseCsvImport.mock.mockImplementationOnce(() => csvData);
    const result = await service.checkImportItems(
      testData.historyQueries.command.southType,
      'file content',
      ',',
      testData.historyQueries.list[1].items
    );
    assert.deepStrictEqual(result, {
      items: [
        {
          id: '',
          name: csvData[0].name,
          description: null,
          enabled: String(csvData[0].enabled).toLowerCase() === 'true',
          settings: {
            query: 'query',
            trackingInstant: { trackInstant: false }
          }
        }
      ],
      errors: []
    });
  });

  it('should throw error if delimiter does not match', async () => {
    utilsExports.parseCsvImport.mock.mockImplementationOnce(() => {
      throw new OIBusValidationError(`The entered delimiter "," does not correspond to the file delimiter ";"`);
    });

    await assert.rejects(
      async () => service.checkImportItems(testData.historyQueries.command.southType, 'file content', ',', []),
      new OIBusValidationError(`The entered delimiter "," does not correspond to the file delimiter ";"`)
    );
    assert.deepStrictEqual(utilsExports.parseCsvImport.mock.calls[0].arguments, ['file content', ',']);
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

    await service.addOrEditTransformer(testData.historyQueries.list[0].id, transformerWithOptions, 'userTest');

    assert.deepStrictEqual(historyQueryRepository.addOrEditTransformer.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      transformerWithOptions,
      'userTest'
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.stopHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
  });

  it('should remove transformer', async () => {
    await service.removeTransformer(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].northTransformers[0].id,
      'userTest'
    );

    assert.deepStrictEqual(historyQueryRepository.removeTransformer.mock.calls[0].arguments, [
      testData.historyQueries.list[0].northTransformers[0].id,
      'userTest'
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.stopHistoryQuery.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
  });

  it('should retrieve secrets from history query', () => {
    const historySource = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    historySource.southType = mssqlManifest.id;
    historySource.northType = fileWriterManifest.id;
    historyQueryRepository.findHistoryById.mock.mockImplementationOnce(() => historySource);
    const result = service.retrieveSecrets(undefined, undefined, testData.historyQueries.list[0].id, mssqlManifest, fileWriterManifest);
    assert.deepStrictEqual(historyQueryRepository.findHistoryById.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
    assert.deepStrictEqual(result, historySource);
  });

  it('should throw an error if history query south type does not match manifest', () => {
    const historySource = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    historySource.southType = 'bad';
    historyQueryRepository.findHistoryById.mock.mockImplementationOnce(() => historySource);

    assert.throws(
      () => service.retrieveSecrets(undefined, undefined, testData.historyQueries.list[0].id, mssqlManifest, fileWriterManifest),
      new Error(
        `History query "${historySource.id}" (South type "${historySource.southType}") must be of the South type "${mssqlManifest.id}"`
      )
    );
  });

  it('should throw an error if history query north type does not match manifest', () => {
    const historySource = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    historySource.southType = mssqlManifest.id;
    historySource.northType = 'bad';
    historyQueryRepository.findHistoryById.mock.mockImplementationOnce(() => historySource);

    assert.throws(
      () => service.retrieveSecrets(undefined, undefined, testData.historyQueries.list[0].id, mssqlManifest, fileWriterManifest),
      new Error(
        `History query "${historySource.id}" (North type "${historySource.northType}") must be of the North type "${fileWriterManifest.id}"`
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
      mssqlManifest,
      fileWriterManifest
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

    const result = service.retrieveSecrets(testData.south.list[1].id, undefined, undefined, mssqlManifest, fileWriterManifest);

    assert.deepStrictEqual(result, {
      southType: testData.south.list[1].type,
      southSettings: testData.south.list[1].settings,
      items: testData.south.list[1].items
    });
  });

  it('should retrieve secrets from north only', () => {
    const result = service.retrieveSecrets(undefined, testData.north.list[0].id, undefined, mssqlManifest, fileWriterManifest);

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
      () => service.retrieveSecrets(testData.south.list[0].id, testData.north.list[0].id, undefined, mssqlManifest, fileWriterManifest),
      new Error(`South connector "${testData.south.list[0].id}" (type "${south.type}") must be of the type "${mssqlManifest.id}"`)
    );
  });

  it('should fail to retrieve secrets from north if does not match type', () => {
    southService.findById.mock.mockImplementationOnce(() => testData.south.list[1]); // retrieve the mssql connector

    const north = JSON.parse(JSON.stringify(testData.north.list[0]));
    north.type = 'bad';
    northService.findById.mock.mockImplementationOnce(() => north);

    assert.throws(
      () => service.retrieveSecrets(testData.north.list[0].id, testData.north.list[0].id, undefined, mssqlManifest, fileWriterManifest),
      new Error(`North connector "${testData.north.list[0].id}" (type "${north.type}") must be of the type "${fileWriterManifest.id}"`)
    );
  });

  it('should return null', () => {
    assert.strictEqual(service.retrieveSecrets(undefined, undefined, undefined, mssqlManifest, fileWriterManifest), null);
  });

  it('should properly convert to DTO', () => {
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
        transformer: toTransformerDTO(transformerWithOptions.transformer, getUserInfo),
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
    const historyQueryLight = buildHistoryQueryLight();
    assert.deepStrictEqual(toHistoryQueryLightDTO(historyQueryLight, getUserInfo), {
      id: historyQuery.id,
      name: historyQuery.name,
      description: historyQuery.description,
      status: historyQuery.status,
      startTime: historyQuery.queryTimeRange.startTime,
      endTime: historyQuery.queryTimeRange.endTime,
      southType: historyQuery.southType,
      northType: historyQuery.northType,
      currentItemNumber: undefined,
      numberOfItems: undefined,
      createdBy: getUserInfo(historyQueryLight.createdBy),
      updatedBy: getUserInfo(historyQueryLight.updatedBy),
      createdAt: historyQueryLight.createdAt,
      updatedAt: historyQueryLight.updatedAt
    });
  });

  it('should include current item progress in light DTO when the history query is currently running', () => {
    const historyQueryLight = buildHistoryQueryLight();
    const runningMetrics = {
      ...testData.historyQueries.metrics,
      historyMetrics: {
        ...testData.historyQueries.metrics.historyMetrics,
        running: true,
        currentItemNumber: 2,
        numberOfItems: 5
      }
    };
    const getHistoryMetrics = mock.fn((_historyId: string) => runningMetrics);

    const result = toHistoryQueryLightDTO(historyQueryLight, getUserInfo, getHistoryMetrics);

    assert.deepStrictEqual(getHistoryMetrics.mock.calls[0].arguments, [historyQueryLight.id]);
    assert.strictEqual(result.currentItemNumber, 2);
    assert.strictEqual(result.numberOfItems, 5);
  });

  it('should omit current item progress in light DTO when the history query is not currently running', () => {
    const historyQueryLight = buildHistoryQueryLight();
    const notRunningMetrics = {
      ...testData.historyQueries.metrics,
      historyMetrics: {
        ...testData.historyQueries.metrics.historyMetrics,
        running: false,
        currentItemNumber: 2,
        numberOfItems: 5
      }
    };
    const getHistoryMetrics = mock.fn((_historyId: string) => notRunningMetrics);

    const result = toHistoryQueryLightDTO(historyQueryLight, getUserInfo, getHistoryMetrics);

    assert.strictEqual(result.currentItemNumber, undefined);
    assert.strictEqual(result.numberOfItems, undefined);
  });

  it('should omit current item progress in light DTO when the engine has no metrics for the history query', () => {
    const historyQueryLight = buildHistoryQueryLight();
    const getHistoryMetrics = mock.fn((_historyId: string) => null);

    const result = toHistoryQueryLightDTO(historyQueryLight, getUserInfo, getHistoryMetrics);

    assert.strictEqual(result.currentItemNumber, undefined);
    assert.strictEqual(result.numberOfItems, undefined);
  });
});
