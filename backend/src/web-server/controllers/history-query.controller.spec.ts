import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { HistoryQueryCommandDTO, HistoryQueryItemCommandDTO, HistoryQueryItemSearchParam } from '../../../shared/model/history-query.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution } from '../../tests/utils/test-utils';
import HistoryQueryServiceMock from '../../tests/__mocks__/service/history-query-service.mock';
import OIBusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import UserServiceMock from '../../tests/__mocks__/service/user-service.mock';
import { CacheContentUpdateCommand, CacheMetadata, OIBusContent } from '../../../shared/model/engine.model';
import { HistoryTransformerDTOWithOptions, TransformerDTO } from '../../../shared/model/transformer.model';
import { OIBusTestingError } from '../../model/types';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
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

let mockHistoryQueryServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let mockUtilsModule: Record<string, ReturnType<typeof mock.fn>>;
let HistoryQueryController: typeof HistoryQueryControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockHistoryQueryServiceModule = {
    toHistoryQueryDTO: mock.fn((query: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return query;
    }),
    toHistoryQueryLightDTO: mock.fn((query: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return query;
    }),
    toHistoryQueryItemDTO: mock.fn((item: unknown, southType: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return item;
    })
  };
  mockUtilsModule = {
    itemToFlattenedCSV: mock.fn(() => 'csv content')
  };
  mockModule(nodeRequire, '../../service/history-query.service', mockHistoryQueryServiceModule);
  mockModule(nodeRequire, '../../service/utils', mockUtilsModule);
  const mod = reloadModule<{ HistoryQueryController: typeof HistoryQueryControllerShape }>(nodeRequire, './history-query.controller');
  HistoryQueryController = mod.HistoryQueryController;
});

describe('HistoryQueryController', () => {
  let controller: HistoryQueryControllerShape;
  let historyQueryService: HistoryQueryServiceMock;
  let oIBusService: OIBusServiceMock;
  let userService: UserServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;
  let mockRes: {
    attachment: ReturnType<typeof mock.fn>;
    contentType: ReturnType<typeof mock.fn>;
    status: ReturnType<typeof mock.fn>;
    send: ReturnType<typeof mock.fn>;
    setHeader: ReturnType<typeof mock.fn>;
    pipe: ReturnType<typeof mock.fn>;
  };

  beforeEach(() => {
    historyQueryService = new HistoryQueryServiceMock();
    oIBusService = new OIBusServiceMock();
    userService = new UserServiceMock();
    mockRes = {
      attachment: mock.fn(),
      contentType: mock.fn(),
      send: mock.fn(),
      setHeader: mock.fn(),
      pipe: mock.fn(),
      status: mock.fn()
    };
    mockRes.status = mock.fn(() => mockRes);
    mockRequest = {
      services: {
        historyQueryService,
        southService: {
          getInstalledSouthManifests: mock.fn(() => [{ ...testData.south.manifest, id: testData.historyQueries.list[0].southType }])
        },
        oIBusService,
        userService
      },
      user: { id: 'test', login: 'testUser' },
      res: mockRes as unknown as import('express').Response // partial mock of express.Response — only used properties are defined
    } as Partial<CustomExpressRequest>;
    mockHistoryQueryServiceModule.toHistoryQueryDTO = mock.fn((query: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return query;
    });
    mockHistoryQueryServiceModule.toHistoryQueryLightDTO = mock.fn((query: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return query;
    });
    mockHistoryQueryServiceModule.toHistoryQueryItemDTO = mock.fn(
      (item: unknown, southType: unknown, getUserInfo: (id: string) => void) => {
        getUserInfo('');
        return item;
      }
    );
    mockUtilsModule.itemToFlattenedCSV = mock.fn(() => 'csv content');
    controller = new HistoryQueryController();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should return a list of history queries', async () => {
    const mockHistoryQueries = testData.historyQueries.list;
    historyQueryService.list = mock.fn(() => mockHistoryQueries);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.list.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockHistoryQueries);
  });

  it('should return a history query by ID', async () => {
    const mockHistoryQuery = testData.historyQueries.list[0];
    const historyId = mockHistoryQuery.id;
    historyQueryService.findById = mock.fn(() => mockHistoryQuery);

    const result = await controller.findById(historyId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.findById.mock.calls[0].arguments[0], historyId);
    assert.deepStrictEqual(result, mockHistoryQuery);
  });

  it('should create a new history query', async () => {
    const command: HistoryQueryCommandDTO = testData.historyQueries.command;
    const createdHistoryQuery = testData.historyQueries.list[0];
    historyQueryService.create = mock.fn(async () => createdHistoryQuery);

    const result = await controller.create(command, undefined, undefined, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.create.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.create.mock.calls[0].arguments, [command, undefined, undefined, undefined, 'test']);
    assert.deepStrictEqual(result, createdHistoryQuery);
  });

  it('should update an existing history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const command: HistoryQueryCommandDTO = testData.historyQueries.command;
    historyQueryService.update = mock.fn(async () => undefined);

    await controller.update(historyId, command, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.update.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.update.mock.calls[0].arguments, [historyId, command, false, 'test']);
  });

  it('should delete a history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    historyQueryService.delete = mock.fn(async () => undefined);

    await controller.delete(historyId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.delete.mock.calls[0].arguments[0], historyId);
  });

  it('should start a history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    historyQueryService.start = mock.fn(async () => undefined);

    await controller.start(historyId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.start.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.start.mock.calls[0].arguments[0], historyId);
  });

  it('should pause a history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    historyQueryService.pause = mock.fn(async () => undefined);

    await controller.pause(historyId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.pause.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.pause.mock.calls[0].arguments[0], historyId);
  });

  it('should test north connection', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const northType = testData.north.command.type;
    const fromNorth = testData.north.list[0].id;
    const settings = testData.north.command.settings;
    historyQueryService.testNorth = mock.fn(async () => ({ items: [] }));

    await controller.testNorth(historyId, northType, fromNorth, settings, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.testNorth.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.testNorth.mock.calls[0].arguments, [historyId, northType, fromNorth, settings]);
  });

  it('should wrap errors when testing north connection', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const northType = testData.north.command.type;
    const fromNorth = testData.north.list[0].id;
    const settings = testData.north.command.settings;
    historyQueryService.testNorth = mock.fn(async () => {
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
    historyQueryService.testNorth = mock.fn(async () => {
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
    historyQueryService.testSouth = mock.fn(async () => ({ items: [] }));

    await controller.testSouth(historyId, southType, fromSouth, settings, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.testSouth.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.testSouth.mock.calls[0].arguments, [historyId, southType, fromSouth, settings]);
  });

  it('should wrap errors when testing south connection', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const southType = testData.south.command.type;
    const fromSouth = testData.south.list[0].id;
    const settings = testData.south.command.settings;
    historyQueryService.testSouth = mock.fn(async () => {
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

    const mockContent: OIBusContent = {
      type: 'any',
      filePath: '/path/to/file.json',
      content: '{"key": "value"}'
    };
    historyQueryService.testItem = mock.fn(() => mockContent);

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
    assert.deepStrictEqual(result, mockContent);
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
    historyQueryService.testItem = mock.fn(async () => {
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
    historyQueryService.findById = mock.fn(() => testData.historyQueries.list[0]);
    historyQueryService.listItems = mock.fn(() => mockItems);

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
    historyQueryService.findById = mock.fn(() => testData.historyQueries.list[0]);
    historyQueryService.searchItems = mock.fn(async () => mockPageResult);

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
    historyQueryService.findById = mock.fn(() => testData.historyQueries.list[0]);
    historyQueryService.searchItems = mock.fn(async () => mockPageResult);

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

    historyQueryService.findById = mock.fn(() => testData.historyQueries.list[0]);
    historyQueryService.findItemById = mock.fn(() => mockItem);

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

    historyQueryService.findById = mock.fn(() => testData.historyQueries.list[0]);
    historyQueryService.createItem = mock.fn(async () => createdItem);

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
    historyQueryService.updateItem = mock.fn(async () => undefined);

    await controller.updateItem(historyId, itemId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.updateItem.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.updateItem.mock.calls[0].arguments, [historyId, itemId, command, 'test']);
  });

  it('should enable a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;
    historyQueryService.enableItem = mock.fn(async () => undefined);

    await controller.enableItem(historyId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.enableItem.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.enableItem.mock.calls[0].arguments, [historyId, itemId]);
  });

  it('should disable a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;
    historyQueryService.disableItem = mock.fn(async () => undefined);

    await controller.disableItem(historyId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.disableItem.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.disableItem.mock.calls[0].arguments, [historyId, itemId]);
  });

  it('should enable a list of history query items', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemIds = testData.historyQueries.list[0].items.map(item => item.id);
    historyQueryService.enableItems = mock.fn(async () => undefined);

    await controller.enableItems(historyId, { itemIds }, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.enableItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.enableItems.mock.calls[0].arguments, [historyId, itemIds]);
  });

  it('should disable a list of history query items', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemIds = testData.historyQueries.list[0].items.map(item => item.id);
    historyQueryService.disableItems = mock.fn(async () => undefined);

    await controller.disableItems(historyId, { itemIds }, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.disableItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.disableItems.mock.calls[0].arguments, [historyId, itemIds]);
  });

  it('should delete a list of history query items', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemIds = testData.historyQueries.list[0].items.map(item => item.id);
    historyQueryService.deleteItems = mock.fn(async () => undefined);

    await controller.deleteItems(historyId, { itemIds }, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.deleteItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.deleteItems.mock.calls[0].arguments, [historyId, itemIds]);
  });

  it('should delete a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;
    historyQueryService.deleteItem = mock.fn(async () => undefined);

    await controller.deleteItem(historyId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.deleteItem.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.deleteItem.mock.calls[0].arguments, [historyId, itemId]);
  });

  it('should delete all items from a history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    historyQueryService.deleteAllItems = mock.fn(async () => undefined);

    await controller.deleteAllItems(historyId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.deleteAllItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.deleteAllItems.mock.calls[0].arguments[0], historyId);
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

    historyQueryService.findById = mock.fn(() => testData.historyQueries.list[0]);

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
      items: [testData.historyQueries.itemCommand],
      errors: []
    };

    historyQueryService.checkImportItems = mock.fn(() => mockResult);

    const result = await controller.checkImportItems(
      southType,
      delimiter,
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
      controller.checkImportItems(southType, delimiter, itemsToImportFile, undefined!, mockRequest as CustomExpressRequest),
      { message: 'Missing "itemsToImport" or "currentItems"' }
    );
  });

  it('should import items from CSV', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemsFile = {
      path: 'myFile.json'
    } as Express.Multer.File;

    historyQueryService.importItems = mock.fn(async () => undefined);
    mock.method(fs, 'readFile', async () => JSON.stringify([{ id: '1', name: 'item1', scanModeName: 'scan1' }]));
    mock.method(fs, 'unlink', async () => undefined);

    await controller.importItems(historyId, itemsFile, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.importItems.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.importItems.mock.calls[0].arguments, [
      historyId,
      [{ id: '1', name: 'item1', scanModeName: 'scan1' }],
      'test'
    ]);
  });

  it('should throw an error if items file is missing in importItems', async () => {
    const historyId = testData.historyQueries.list[0].id;

    await assert.rejects(controller.importItems(historyId, undefined!, mockRequest as CustomExpressRequest), {
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

    await assert.doesNotReject(controller.importItems('southId', itemsFile, mockRequest as CustomExpressRequest));
  });

  it('should add or edit a transformer', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const command: HistoryTransformerDTOWithOptions = {
      id: 'historyTransformerId1',
      transformer: testData.transformers.list[0] as TransformerDTO,
      options: {},
      items: []
    };
    historyQueryService.addOrEditTransformer = mock.fn(async () => undefined);

    await controller.addOrEditTransformer(historyId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.addOrEditTransformer.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.addOrEditTransformer.mock.calls[0].arguments, [historyId, command]);
  });

  it('should remove a transformer', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const transformerId = testData.transformers.list[0].id;
    historyQueryService.removeTransformer = mock.fn(async () => undefined);

    await controller.removeTransformer(historyId, transformerId, mockRequest as CustomExpressRequest);

    assert.strictEqual(historyQueryService.removeTransformer.mock.calls.length, 1);
    assert.deepStrictEqual(historyQueryService.removeTransformer.mock.calls[0].arguments, [historyId, transformerId]);
  });

  it('should search cache content with default params', async () => {
    const northId = testData.north.list[0].id;

    const mockCacheMetadata: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];
    oIBusService.searchCacheContent = mock.fn(async () => mockCacheMetadata);

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
    assert.deepStrictEqual(result, mockCacheMetadata);
  });

  it('should search cache content with parameters', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const nameContains = 'test';
    const start = '2023-01-01';
    const end = '2023-01-02';

    const mockMetadata: CacheMetadata = {
      contentFile: '/path/to/content.json',
      contentSize: 1024,
      numberOfElement: 10,
      createdAt: '2023-01-01T00:00:00Z',
      contentType: 'time-values'
    };
    const mockResult = [
      {
        metadataFilename: 'metadata.json',
        metadata: mockMetadata
      }
    ];

    oIBusService.searchCacheContent = mock.fn(async () => mockResult);

    const result = await controller.searchCacheContent(historyId, nameContains, start, end, 1000, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.searchCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.searchCacheContent.mock.calls[0].arguments, [
      'history',
      historyId,
      { start, end, nameContains, maxNumberOfFilesReturned: 1000 }
    ]);
    assert.deepStrictEqual(result, mockResult);
  });

  it('should get cache file content', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const filename = 'test.json';
    const folder = 'cache';

    const mockStream = { pipe: mock.fn() };
    oIBusService.getFileFromCache = mock.fn(async () => mockStream);

    await controller.getCacheFileContent(historyId, filename, folder, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.getFileFromCache.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.getFileFromCache.mock.calls[0].arguments, ['history', historyId, folder, filename]);
  });

  it('should update cache content', async () => {
    const historyId = testData.historyQueries.list[0].id;
    oIBusService.updateCacheContent = mock.fn(async () => undefined);

    await controller.updateCacheContent(historyId, {} as CacheContentUpdateCommand, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.updateCacheContent.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.updateCacheContent.mock.calls[0].arguments, ['history', historyId, {}]);
  });
});
