import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type express from 'express';

import { HistoryQueryCommandDTO, HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '../../../shared/model/api/history-query.model';
import { HistoryTransformerDTOWithOptions, TransformerDTO } from '../../../shared/model/api/transformer.model';
import { OIBusContent } from '../../../shared/model/common/content.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/connector/south-settings.model';
import { CacheContentUpdateCommand, CacheSearchResult, FileCacheContent } from '../../../shared/model/domain/engine.model';
import { HistoryQueryItemSearchParam } from '../../../shared/model/domain/history-query.model';

import { OIBusTestingError } from '../../model/types';
import type ConfigurationWorkflowRunService from '../../service/configuration-workflow-run.service';
import type HistoryQueryService from '../../service/history-query.service';
import type OIBusService from '../../service/oibus.service';
import type SouthService from '../../service/south.service';
import type UserService from '../../service/user.service';
import testData from '../../tests/utils/test-data';
import { createMock, createMockServices, fixTsoaModuleResolution, Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import { CustomExpressRequest } from '../express';
import type { HistoryQueryController as HistoryQueryControllerShape } from './history-query.controller';

interface HistorySouthItemTestRequest {
  southSettings: SouthSettings;
  itemSettings: SouthItemSettings;
  testingSettings: {
    history: {
      startTime: string;
      endTime: string;
    };
  };
}

const nodeRequire = createRequire(import.meta.url);

// The DTO mappers return the entity as is, after asking for the user info like the real ones
const createHistoryQueryServiceModuleMocks = () => ({
  toHistoryQueryDTO: mock.fn((query: unknown, getUserInfo: (id: string) => void) => {
    getUserInfo('');
    return query;
  }),
  toHistoryQueryLightDTO: mock.fn((query: unknown, getUserInfo: (id: string) => void) => {
    getUserInfo('');
    return query;
  }),
  toHistoryQueryItemDTO: mock.fn((item: unknown, _southType: unknown, getUserInfo: (id: string) => void) => {
    getUserInfo('');
    return item;
  })
});
// Same objects for the whole file (the controller keeps them): their functions are replaced in beforeEach
const historyQueryServiceModule = createHistoryQueryServiceModuleMocks();
const utilsModule = { itemToFlattenedCSV: mock.fn(() => 'csv content') };
let HistoryQueryController: typeof HistoryQueryControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockModule(nodeRequire, '../../service/history-query.service', historyQueryServiceModule);
  mockModule(nodeRequire, '../../service/utils', utilsModule);
  const mod = reloadModule<{ HistoryQueryController: typeof HistoryQueryControllerShape }>(nodeRequire, './history-query.controller');
  HistoryQueryController = mod.HistoryQueryController;
});

describe('HistoryQueryController', () => {
  let controller: HistoryQueryControllerShape;
  let historyQueryService: Mocked<HistoryQueryService>;
  let oIBusService: Mocked<OIBusService>;
  let userService: Mocked<UserService>;
  let mockRequest: Partial<CustomExpressRequest>;
  let southService: Mocked<SouthService>;
  let configurationWorkflowRunService: Mocked<ConfigurationWorkflowRunService>;
  let mockRes: Mocked<express.Response>;

  beforeEach(() => {
    historyQueryService = createMock<HistoryQueryService>();
    oIBusService = createMock<OIBusService>();
    userService = createMock<UserService>();
    southService = createMock<SouthService>({ getManifest: () => testData.south.manifest });
    configurationWorkflowRunService = createMock<ConfigurationWorkflowRunService>();
    mockRes = createMock<express.Response>();
    mockRes.status.mock.mockImplementation(() => mockRes);
    mockRequest = {
      services: createMockServices({ historyQueryService, southService, oIBusService, userService, configurationWorkflowRunService }),
      user: { id: 'test', login: 'testUser' },
      res: mockRes
    };
    Object.assign(historyQueryServiceModule, createHistoryQueryServiceModuleMocks());
    utilsModule.itemToFlattenedCSV = mock.fn(() => 'csv content');
    controller = new HistoryQueryController();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should return a list of history queries', async () => {
    const mockHistoryQueries = testData.historyQueries.listLight;
    historyQueryService.list.mock.mockImplementation(() => mockHistoryQueries);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.list.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockHistoryQueries);
  });

  it('should return a history query by ID', async () => {
    const mockHistoryQuery = testData.historyQueries.list[0];
    const historyId = mockHistoryQuery.id;
    historyQueryService.findById.mock.mockImplementation(() => mockHistoryQuery);

    const result = await controller.findById(historyId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.findById.mock.calls[0].arguments[0], historyId);
    assert.deepStrictEqual(result, mockHistoryQuery);
  });

  it('should create a new history query', async () => {
    const command: HistoryQueryCommandDTO = testData.historyQueries.command;
    const createdHistoryQuery = testData.historyQueries.list[0];
    historyQueryService.create.mock.mockImplementation(async () => createdHistoryQuery);

    const result = await controller.create(command, undefined, undefined, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.create.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.create.mock.calls[0].arguments, [command, undefined, undefined, undefined, 'test']);
    assert.deepStrictEqual(result, createdHistoryQuery);
  });

  it('should update an existing history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const command: HistoryQueryCommandDTO = testData.historyQueries.command;
    historyQueryService.update.mock.mockImplementation(async () => undefined);

    await controller.update(historyId, command, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.update.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.update.mock.calls[0].arguments, [historyId, command, false, 'test']);
  });

  it('should delete a history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    historyQueryService.delete.mock.mockImplementation(async () => undefined);

    await controller.delete(historyId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.delete.mock.calls[0].arguments, [historyId, 'test']);
  });

  it('should start a history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    historyQueryService.start.mock.mockImplementation(async () => undefined);

    await controller.start(historyId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.start.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.start.mock.calls[0].arguments[0], historyId);
  });

  it('should pause a history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    historyQueryService.pause.mock.mockImplementation(async () => undefined);

    await controller.pause(historyId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.pause.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.pause.mock.calls[0].arguments[0], historyId);
  });

  it('should get history query metrics', async () => {
    const historyId = testData.historyQueries.list[0].id;
    historyQueryService.getHistoryMetric.mock.mockImplementation(() => testData.historyQueries.metrics);

    const result = controller.getMetrics(historyId, mockRequest as CustomExpressRequest);

    assert.deepStrictEqual(historyQueryService.getHistoryMetric.mock.calls[0].arguments, [historyId]);
    assert.deepStrictEqual(result, testData.historyQueries.metrics);
  });

  it('should test north connection', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const northType = testData.north.command.type;
    const fromNorth = testData.north.list[0].id;
    const settings = testData.north.command.settings;
    historyQueryService.testNorth.mock.mockImplementation(async () => ({ items: [] }));

    await controller.testNorth(historyId, northType, fromNorth, settings, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.testNorth.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.testNorth.mock.calls[0].arguments, [historyId, northType, fromNorth, settings]);
  });

  it('should wrap errors when testing north connection', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const northType = testData.north.command.type;
    const fromNorth = testData.north.list[0].id;
    const settings = testData.north.command.settings;
    historyQueryService.testNorth.mock.mockImplementation(async () => {
      throw new Error('North test failure');
    });

    try {
      await controller.testNorth(historyId, northType, fromNorth, settings, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual(error.message, 'North test failure');
    }
    assert.strictEqual(historyQueryService.testNorth.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.testNorth.mock.calls[0].arguments, [historyId, northType, fromNorth, settings]);
  });

  it('should throw OIBusTestingError when testing north connection fails', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const northType = testData.north.command.type;
    const fromNorth = testData.north.list[0].id;
    const settings = testData.north.command.settings;
    historyQueryService.testNorth.mock.mockImplementation(async () => {
      throw new Error('north test failed');
    });

    try {
      await controller.testNorth(historyId, northType, fromNorth, settings, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual((error as OIBusTestingError).message, 'north test failed');
    }
  });

  it('should test south connection', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const southType = testData.south.command.type;
    const fromSouth = testData.south.list[0].id;
    const settings = testData.south.command.settings;
    historyQueryService.testSouth.mock.mockImplementation(async () => ({ items: [] }));

    await controller.testSouth(historyId, southType, fromSouth, settings, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.testSouth.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.testSouth.mock.calls[0].arguments, [historyId, southType, fromSouth, settings]);
  });

  it('should wrap errors when testing south connection', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const southType = testData.south.command.type;
    const fromSouth = testData.south.list[0].id;
    const settings = testData.south.command.settings;
    historyQueryService.testSouth.mock.mockImplementation(async () => {
      throw new Error('South test failure');
    });

    try {
      await controller.testSouth(historyId, southType, fromSouth, settings, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual((error as OIBusTestingError).message, 'South test failure');
    }
    assert.strictEqual(historyQueryService.testSouth.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.testSouth.mock.calls[0].arguments, [historyId, southType, fromSouth, settings]);
  });

  it('should start an explore session', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const southType = testData.south.command.type;
    const fromSouth = testData.south.list[0].id;
    const settings = testData.south.command.settings;
    const mockResult = { sessionId: 'sessionId', entries: [] };
    historyQueryService.startExplore.mock.mockImplementation(async () => mockResult);

    const result = await controller.startExplore(historyId, southType, fromSouth, settings, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.startExplore.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.startExplore.mock.calls[0].arguments, [historyId, southType, fromSouth, settings]);
    assert.deepStrictEqual(result, mockResult);
  });

  it('should wrap errors when starting an explore session', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const southType = testData.south.command.type;
    const fromSouth = testData.south.list[0].id;
    const settings = testData.south.command.settings;
    historyQueryService.startExplore.mock.mockImplementation(async () => {
      throw new Error('Explore start failure');
    });

    try {
      await controller.startExplore(historyId, southType, fromSouth, settings, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual((error as OIBusTestingError).message, 'Explore start failure');
    }
  });

  it('should map the records discovered against the south settings to new items', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const southType = testData.south.command.type;
    const fromSouth = testData.south.list[0].id;
    const command = {
      southSettings: testData.south.command.settings,
      discoveryScope: { nodeIds: ['node1'] },
      itemFieldMapping: { name: '{{name}}' }
    };
    const resolvedSettings = { ...testData.south.command.settings };
    const discovered = [testData.south.itemCommand];
    historyQueryService.southSettingsToTest.mock.mockImplementation(async () => resolvedSettings);
    configurationWorkflowRunService.discoverItems.mock.mockImplementation(async () => discovered);

    const result = await controller.discoverItems(historyId, southType, fromSouth, command, mockRequest as CustomExpressRequest);

    assert.deepStrictEqual(historyQueryService.southSettingsToTest.mock.calls[0].arguments, [
      historyId,
      southType,
      fromSouth,
      command.southSettings
    ]);
    assert.deepStrictEqual(configurationWorkflowRunService.discoverItems.mock.calls[0].arguments, [
      'history',
      southType,
      resolvedSettings,
      command.discoveryScope,
      command.itemFieldMapping
    ]);
    assert.deepStrictEqual(result, discovered);
  });

  it('should wrap errors when discovering items', async () => {
    historyQueryService.southSettingsToTest.mock.mockImplementation(async () => {
      throw new Error('Invalid settings');
    });

    await assert.rejects(
      controller.discoverItems(
        'create',
        testData.south.command.type,
        undefined,
        { southSettings: testData.south.command.settings, discoveryScope: {}, itemFieldMapping: {} },
        mockRequest as CustomExpressRequest
      ),
      new OIBusTestingError('Invalid settings')
    );
  });

  it('should browse an explore session', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const sessionId = 'sessionId';
    const mockResult = { entries: [] };
    southService.browseExplore.mock.mockImplementation(async () => mockResult);

    const result = await controller.browseExplore(historyId, sessionId, { parentId: null }, mockRequest as CustomExpressRequest);

    assert.deepStrictEqual(southService.browseExplore.mock.calls[0].arguments, [sessionId, null]);
    assert.deepStrictEqual(result, mockResult);
  });

  it('should wrap errors when browsing an explore session', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const sessionId = 'sessionId';
    southService.browseExplore.mock.mockImplementation(async () => {
      throw new Error('Browse failure');
    });

    try {
      await controller.browseExplore(historyId, sessionId, { parentId: null }, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual((error as OIBusTestingError).message, 'Browse failure');
    }
  });

  it('should close an explore session', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const sessionId = 'sessionId';

    await controller.closeExplore(historyId, sessionId, mockRequest as CustomExpressRequest);

    assert.deepStrictEqual(southService.closeExplore.mock.calls[0].arguments, [sessionId]);
  });

  it('should test a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const southType = testData.south.command.type;
    const itemName = testData.south.itemCommand.name;
    const fromSouth = testData.south.list[0].id;
    const requestBody = {
      southSettings: testData.south.command.settings,
      itemSettings: testData.south.itemCommand.settings,
      testingSettings: {
        history: {
          startTime: testData.constants.dates.DATE_1,
          endTime: testData.constants.dates.DATE_2
        }
      }
    };

    const mockResult = {
      raw: { type: 'any', filePath: '/path/to/file.json', content: '{"key": "value"}' } as OIBusContent,
      transformed: null,
      connectionDuration: 12,
      queryDuration: 34
    };
    historyQueryService.testItem.mock.mockImplementation(async () => mockResult);

    const result = await controller.testItem(
      historyId,
      southType,
      itemName,
      fromSouth,
      {
        southSettings: requestBody.southSettings,
        itemSettings: requestBody.itemSettings,
        testingSettings: requestBody.testingSettings
      } as HistorySouthItemTestRequest,
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(historyQueryService.testItem.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.testItem.mock.calls[0].arguments, [
      historyId,
      southType,
      itemName,
      fromSouth,
      requestBody.southSettings,
      requestBody.itemSettings,
      requestBody.testingSettings
    ]);
    assert.deepStrictEqual(result, mockResult);
  });

  it('should wrap errors when testing a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const southType = testData.south.command.type;
    const itemName = testData.south.itemCommand.name;
    const fromSouth = testData.south.list[0].id;
    const requestBody = {
      southSettings: testData.south.command.settings,
      itemSettings: testData.south.itemCommand.settings,
      testingSettings: {
        history: {
          startTime: testData.constants.dates.DATE_1,
          endTime: testData.constants.dates.DATE_2
        }
      }
    };
    historyQueryService.testItem.mock.mockImplementation(async () => {
      throw new Error('Item test failure');
    });

    try {
      await controller.testItem(historyId, southType, itemName, fromSouth, requestBody, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual((error as OIBusTestingError).message, 'Item test failure');
    }
    assert.strictEqual(historyQueryService.testItem.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.testItem.mock.calls[0].arguments, [
      historyId,
      southType,
      itemName,
      fromSouth,
      requestBody.southSettings,
      requestBody.itemSettings,
      requestBody.testingSettings
    ]);
  });

  it('should return a list of history query items', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const mockItems = testData.historyQueries.list[0].items;
    historyQueryService.findById.mock.mockImplementation(() => testData.historyQueries.list[0]);
    historyQueryService.listItems.mock.mockImplementation(() => mockItems);

    const result = await controller.listItems(historyId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.findById.mock.calls[0].arguments[0], historyId);
    assert.strictEqual(historyQueryService.listItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.listItems.mock.calls[0].arguments[0], historyId);
    assert.deepStrictEqual(result, mockItems);
  });

  it('should search history query items', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const page = 1;
    const name = 'test';
    const enabled = false;

    const searchParams: HistoryQueryItemSearchParam = {
      name,
      enabled,
      page
    };

    const mockPageResult = {
      content: testData.south.list[0].items,
      totalElements: testData.south.list[0].items.length,
      size: 25,
      number: page,
      totalPages: 1
    };
    historyQueryService.findById.mock.mockImplementation(() => testData.historyQueries.list[0]);
    historyQueryService.searchItems.mock.mockImplementation(() => mockPageResult);

    const result = await controller.searchItems(historyId, name, enabled, page, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.findById.mock.calls[0].arguments[0], historyId);
    assert.strictEqual(historyQueryService.searchItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.searchItems.mock.calls[0].arguments, [historyId, searchParams]);
    assert.deepStrictEqual(result, mockPageResult);
  });

  it('should search history query items with default params', async () => {
    const historyId = testData.historyQueries.list[0].id;

    const mockPageResult = {
      content: testData.south.list[0].items,
      totalElements: testData.south.list[0].items.length,
      size: 25,
      number: 0,
      totalPages: 1
    };
    historyQueryService.findById.mock.mockImplementation(() => testData.historyQueries.list[0]);
    historyQueryService.searchItems.mock.mockImplementation(() => mockPageResult);

    const result = await controller.searchItems(historyId, undefined, undefined, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.findById.mock.calls[0].arguments[0], historyId);
    assert.strictEqual(historyQueryService.searchItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.searchItems.mock.calls[0].arguments, [
      historyId,
      { page: 0, name: undefined, enabled: undefined }
    ]);
    assert.deepStrictEqual(result, mockPageResult);
  });

  it('should return a specific history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;
    const mockItem = testData.historyQueries.list[0].items[0];

    historyQueryService.findById.mock.mockImplementation(() => testData.historyQueries.list[0]);
    historyQueryService.findItemById.mock.mockImplementation(() => mockItem);

    const result = await controller.findItemById(historyId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.findById.mock.calls[0].arguments[0], historyId);
    assert.strictEqual(historyQueryService.findItemById.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.findItemById.mock.calls[0].arguments, [historyId, itemId]);
    assert.deepStrictEqual(result, mockItem);
  });

  it('should create a new history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const command: HistoryQueryItemCommandDTO = testData.historyQueries.itemCommand;
    const createdItem = testData.historyQueries.list[0].items[0];

    historyQueryService.findById.mock.mockImplementation(() => testData.historyQueries.list[0]);
    historyQueryService.createItem.mock.mockImplementation(async () => createdItem);

    const result = await controller.createItem(historyId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.findById.mock.calls[0].arguments[0], historyId);
    assert.strictEqual(historyQueryService.createItem.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.createItem.mock.calls[0].arguments, [historyId, command, 'test']);
    assert.deepStrictEqual(result, createdItem);
  });

  it('should update a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;
    const command: HistoryQueryItemCommandDTO = testData.historyQueries.itemCommand;
    historyQueryService.updateItem.mock.mockImplementation(async () => undefined);

    await controller.updateItem(historyId, itemId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.updateItem.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.updateItem.mock.calls[0].arguments, [historyId, itemId, command, 'test']);
  });

  it('should enable a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;
    historyQueryService.enableItem.mock.mockImplementation(async () => undefined);

    await controller.enableItem(historyId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.enableItem.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.enableItem.mock.calls[0].arguments, [historyId, itemId]);
  });

  it('should disable a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;
    historyQueryService.disableItem.mock.mockImplementation(async () => undefined);

    await controller.disableItem(historyId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.disableItem.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.disableItem.mock.calls[0].arguments, [historyId, itemId]);
  });

  it('should enable a list of history query items', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemIds = testData.historyQueries.list[0].items.map(item => item.id);
    historyQueryService.enableItems.mock.mockImplementation(async () => undefined);

    await controller.enableItems(historyId, { itemIds }, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.enableItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.enableItems.mock.calls[0].arguments, [historyId, itemIds]);
  });

  it('should disable a list of history query items', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemIds = testData.historyQueries.list[0].items.map(item => item.id);
    historyQueryService.disableItems.mock.mockImplementation(async () => undefined);

    await controller.disableItems(historyId, { itemIds }, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.disableItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.disableItems.mock.calls[0].arguments, [historyId, itemIds]);
  });

  it('should delete a list of history query items', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemIds = testData.historyQueries.list[0].items.map(item => item.id);
    historyQueryService.deleteItems.mock.mockImplementation(async () => undefined);

    await controller.deleteItems(historyId, { itemIds }, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.deleteItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.deleteItems.mock.calls[0].arguments, [historyId, itemIds, 'test']);
  });

  it('should delete a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;
    historyQueryService.deleteItem.mock.mockImplementation(async () => undefined);

    await controller.deleteItem(historyId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.deleteItem.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.deleteItem.mock.calls[0].arguments, [historyId, itemId, 'test']);
  });

  it('should delete all items from a history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    historyQueryService.deleteAllItems.mock.mockImplementation(async () => undefined);

    await controller.deleteAllItems(historyId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.deleteAllItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.deleteAllItems.mock.calls[0].arguments, [historyId, 'test']);
  });

  it('should convert items to CSV', async () => {
    const southType = testData.historyQueries.list[0].southType;
    const delimiter = ',';
    const itemsFile = {
      path: 'myFile.csv'
    } as Express.Multer.File;

    const readFileMock = mock.method(fs, 'readFile', async () => JSON.stringify([{ id: '1', name: 'item1', scanModeName: 'scan1' }]));
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

    await controller.itemsToCsv(southType, delimiter, itemsFile, mockRequest as CustomExpressRequest);

    assert.strictEqual(readFileMock.mock.calls.length, 1);
    assert.deepStrictEqual(readFileMock.mock.calls[0].arguments[0], 'myFile.csv');
    assert.deepStrictEqual(readFileMock.mock.calls[0].arguments[1], 'utf8');
    assert.deepStrictEqual(mockRes.attachment.mock.calls[0].arguments[0], 'items.csv');
    assert.deepStrictEqual(mockRes.contentType.mock.calls[0].arguments[0], 'text/csv; charset=utf-8');
    assert.deepStrictEqual(mockRes.status.mock.calls[0].arguments[0], 200);
    assert.deepStrictEqual(mockRes.send.mock.calls[0].arguments[0], 'csv content');
    assert.strictEqual(unlinkMock.mock.calls.length, 1);
  });

  it('should not throw an error if items files unlink fails', async () => {
    const southType = testData.south.manifest.id;
    const delimiter = ',';
    const itemsFile = {
      path: 'myFile.csv'
    } as Express.Multer.File;

    mock.method(fs, 'readFile', async () => JSON.stringify([{ id: '1', name: 'item1', scanModeName: 'scan1' }]));
    mock.method(fs, 'unlink', async () => {
      throw new Error('unlink error');
    });

    await assert.doesNotReject(controller.itemsToCsv(southType, delimiter, itemsFile, mockRequest as CustomExpressRequest));
  });

  it('should throw an error if items files is missing', async () => {
    const southType = testData.south.manifest.id;
    const delimiter = ',';

    await assert.rejects(controller.itemsToCsv(southType, delimiter, undefined!, mockRequest as CustomExpressRequest), {
      message: 'Missing "items" file'
    });
  });

  it('should export items to CSV', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const delimiter = ',';
    const command = { delimiter };

    historyQueryService.findById.mock.mockImplementation(() => testData.historyQueries.list[0]);

    await controller.exportItems(historyId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.findById.mock.calls[0].arguments[0], historyId);
    assert.deepStrictEqual(mockRes.attachment.mock.calls[0].arguments[0], 'items.csv');
    assert.deepStrictEqual(mockRes.contentType.mock.calls[0].arguments[0], 'text/csv; charset=utf-8');
    assert.deepStrictEqual(mockRes.status.mock.calls[0].arguments[0], 200);
    assert.deepStrictEqual(mockRes.send.mock.calls[0].arguments[0], 'csv content');
  });

  it('should check CSV import and return validation results', async () => {
    const southType = testData.historyQueries.list[0].southType;
    const delimiter = ',';
    const itemsToImportFile = {
      path: 'myFile.csv'
    } as Express.Multer.File;
    const currentItemsFile = {
      path: 'myFile.json'
    } as Express.Multer.File;

    const csvContent = 'id,name\n1,item1';
    const jsonContent = JSON.stringify([{ id: '1', name: 'item1' }]);
    let readCallCount = 0;
    const readFileMock = mock.method(fs, 'readFile', async () => {
      readCallCount++;
      return readCallCount === 1 ? csvContent : jsonContent;
    });
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

    const mockResult = {
      items: [testData.historyQueries.itemCommand as HistoryQueryItemDTO],
      errors: []
    };

    historyQueryService.checkImportItems.mock.mockImplementation(async () => mockResult);

    const result = await controller.checkImportItems(
      southType,
      delimiter,
      'false',
      itemsToImportFile,
      currentItemsFile,
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(readFileMock.mock.calls.length, 2);
    assert.deepStrictEqual(readFileMock.mock.calls[0].arguments[0], 'myFile.csv');
    assert.deepStrictEqual(readFileMock.mock.calls[0].arguments[1], 'utf8');
    assert.deepStrictEqual(readFileMock.mock.calls[1].arguments[0], 'myFile.json');
    assert.deepStrictEqual(readFileMock.mock.calls[1].arguments[1], 'utf8');
    assert.strictEqual(historyQueryService.checkImportItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.checkImportItems.mock.calls[0].arguments, [
      southType,
      csvContent,
      delimiter,
      JSON.parse(jsonContent)
    ]);
    assert.deepStrictEqual(result, mockResult);
    assert.strictEqual(unlinkMock.mock.calls.length, 2);
  });

  it('should throw an error if itemsToImport or currentItems files are missing in checkImportItems', async () => {
    const southType = testData.historyQueries.list[0].southType;
    const delimiter = ',';
    const itemsToImportFile = {
      buffer: Buffer.from('id,name\n1,item1')
    } as Express.Multer.File;

    await assert.rejects(
      controller.checkImportItems(southType, delimiter, 'false', itemsToImportFile, undefined!, mockRequest as CustomExpressRequest),
      { message: 'Missing "itemsToImport" or "currentItems"' }
    );
  });

  it('should check CSV import with an empty existing items list when deleteItemsNotPresent is true', async () => {
    const southType = testData.historyQueries.list[0].southType;
    const delimiter = ',';
    const itemsToImportFile = {
      path: 'myFile.csv'
    } as Express.Multer.File;
    const currentItemsFile = {
      path: 'myFile.json'
    } as Express.Multer.File;

    const csvContent = 'id,name\n1,item1';
    const readFileMock = mock.method(fs, 'readFile', async () => csvContent);
    const unlinkMock = mock.method(fs, 'unlink', async () => undefined);

    const mockResult = {
      items: [testData.historyQueries.itemCommand as HistoryQueryItemDTO],
      errors: []
    };
    historyQueryService.checkImportItems.mock.mockImplementation(async () => mockResult);

    const result = await controller.checkImportItems(
      southType,
      delimiter,
      'true',
      itemsToImportFile,
      currentItemsFile,
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(readFileMock.mock.calls.length, 1);
    assert.strictEqual(historyQueryService.checkImportItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.checkImportItems.mock.calls[0].arguments, [southType, csvContent, delimiter, []]);
    assert.deepStrictEqual(result, mockResult);
    assert.strictEqual(unlinkMock.mock.calls.length, 2);
  });

  it('should not throw an error if the unlink calls fail in checkImportItems', async () => {
    const southType = testData.historyQueries.list[0].southType;
    const delimiter = ',';
    const itemsToImportFile = {
      path: 'myFile.csv'
    } as Express.Multer.File;
    const currentItemsFile = {
      path: 'myFile.json'
    } as Express.Multer.File;

    mock.method(fs, 'readFile', async () => JSON.stringify([{ id: '1', name: 'item1' }]));
    mock.method(fs, 'unlink', async () => {
      throw new Error('unlink error');
    });
    historyQueryService.checkImportItems.mock.mockImplementation(async () => ({ items: [], errors: [] }));

    await assert.doesNotReject(
      controller.checkImportItems(southType, delimiter, 'false', itemsToImportFile, currentItemsFile, mockRequest as CustomExpressRequest)
    );
  });

  it('should import items from CSV', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemsFile = {
      path: 'myFile.json'
    } as Express.Multer.File;

    historyQueryService.importItems.mock.mockImplementation(async () => undefined);
    mock.method(fs, 'readFile', async () => JSON.stringify([{ id: '1', name: 'item1', scanModeName: 'scan1' }]));
    mock.method(fs, 'unlink', async () => undefined);

    await controller.importItems(historyId, itemsFile, 'false', mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.importItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.importItems.mock.calls[0].arguments, [
      historyId,
      [{ id: '1', name: 'item1', scanModeName: 'scan1' }],
      'test',
      false
    ]);
  });

  it('should throw an error if items file is missing in importItems', async () => {
    const historyId = testData.historyQueries.list[0].id;

    await assert.rejects(controller.importItems(historyId, undefined!, 'false', mockRequest as CustomExpressRequest), {
      message: 'Missing file "items"'
    });
  });

  it('should not throw an error if items files unlink fails when importing items', async () => {
    const itemsFile = {
      path: 'myFile.csv'
    } as Express.Multer.File;

    mock.method(fs, 'readFile', async () => JSON.stringify([{ id: '1', name: 'item1', scanModeName: 'scan1' }]));
    mock.method(fs, 'unlink', async () => {
      throw new Error('unlink error');
    });

    await assert.doesNotReject(controller.importItems('southId', itemsFile, 'false', mockRequest as CustomExpressRequest));
  });

  it('should add or edit a transformer', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const command: HistoryTransformerDTOWithOptions = {
      id: 'historyTransformerId1',
      transformer: testData.transformers.list[0] as TransformerDTO,
      options: {},
      items: []
    };
    historyQueryService.addOrEditTransformer.mock.mockImplementation(async () => undefined);

    await controller.addOrEditTransformer(historyId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.addOrEditTransformer.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.addOrEditTransformer.mock.calls[0].arguments, [historyId, command, 'test']);
  });

  it('should remove a transformer', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const transformerId = testData.transformers.list[0].id;
    historyQueryService.removeTransformer.mock.mockImplementation(async () => undefined);

    await controller.removeTransformer(historyId, transformerId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.removeTransformer.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.removeTransformer.mock.calls[0].arguments, [historyId, transformerId, 'test']);
  });

  it('should search cache content with default params', async () => {
    const northId = testData.north.list[0].id;

    const mockCacheResult: CacheSearchResult = {} as CacheSearchResult;
    oIBusService.searchCacheContent.mock.mockImplementation(async () => mockCacheResult);

    const result = await controller.searchCacheContent(
      northId,
      undefined,
      undefined,
      undefined,
      undefined,
      mockRequest as CustomExpressRequest
    );

    assert.strictEqual(oIBusService.searchCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.searchCacheContent.mock.calls[0].arguments, [
      'history',
      northId,
      { start: undefined, end: undefined, nameContains: undefined, maxNumberOfFilesReturned: 0 }
    ]);
    assert.deepStrictEqual(result, mockCacheResult);
  });

  it('should search cache content with parameters', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const nameContains = 'test';
    const start = '2023-01-01';
    const end = '2023-01-02';

    const mockCacheResult: CacheSearchResult = {} as CacheSearchResult;
    oIBusService.searchCacheContent.mock.mockImplementation(async () => mockCacheResult);

    const result = await controller.searchCacheContent(historyId, nameContains, start, end, 1000, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.searchCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.searchCacheContent.mock.calls[0].arguments, [
      'history',
      historyId,
      { start, end, nameContains, maxNumberOfFilesReturned: 1000 }
    ]);
    assert.deepStrictEqual(result, mockCacheResult);
  });

  it('should get cache file content', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const filename = 'test.json';
    const folder = 'cache';

    const mockFileContent: FileCacheContent = {} as FileCacheContent;
    oIBusService.getFileFromCache.mock.mockImplementation(async () => mockFileContent);

    await controller.getCacheFileContent(historyId, filename, folder, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.getFileFromCache.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.getFileFromCache.mock.calls[0].arguments, ['history', historyId, folder, filename]);
  });

  it('should update cache content', async () => {
    const historyId = testData.historyQueries.list[0].id;
    oIBusService.updateCacheContent.mock.mockImplementation(async () => undefined);

    await controller.updateCacheContent(historyId, {} as CacheContentUpdateCommand, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.updateCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.updateCacheContent.mock.calls[0].arguments, ['history', historyId, {}]);
  });
});
