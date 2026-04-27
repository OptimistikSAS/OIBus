import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthItemGroupDTO,
  SouthItemGroupCommandDTO
} from '../../../shared/model/south-connector.model';
import { ScanModeDTO } from '../../../shared/model/scan-mode.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution } from '../../tests/utils/test-utils';
import SouthServiceMock from '../../tests/__mocks__/service/south-service.mock';
import ScanModeServiceMock from '../../tests/__mocks__/service/scan-mode-service.mock';
import OIBusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import UserServiceMock from '../../tests/__mocks__/service/user-service.mock';
import { OIBusContent } from '../../../shared/model/engine.model';
import { OIBusTestingError } from '../../model/types';
import type { SouthConnectorController as SouthConnectorControllerShape } from './south-connector.controller';

const nodeRequire = createRequire(import.meta.url);

let mockSouthServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let mockUtilsModule: Record<string, ReturnType<typeof mock.fn>>;
let SouthConnectorController: typeof SouthConnectorControllerShape;

const toScanModeDTO = (sm: (typeof testData.scanMode.list)[0]): ScanModeDTO => ({
  ...sm,
  createdBy: { id: sm.createdBy, friendlyName: sm.createdBy },
  updatedBy: { id: sm.updatedBy, friendlyName: sm.updatedBy }
});

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockSouthServiceModule = {
    toSouthConnectorDTO: mock.fn((connector: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return connector;
    }),
    toSouthConnectorLightDTO: mock.fn((connector: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return connector;
    }),
    toSouthConnectorItemDTO: mock.fn((item: unknown, southType: unknown, getUserInfo?: (id: string) => void) => {
      if (getUserInfo) getUserInfo('');
      return item;
    }),
    toSouthItemGroupDTO: mock.fn((group: unknown, getUserInfo?: (id: string) => void) => {
      if (getUserInfo) getUserInfo('');
      return group;
    })
  };
  mockUtilsModule = { itemToFlattenedCSV: mock.fn(() => 'csv content') };
  mockModule(nodeRequire, '../../service/south.service', mockSouthServiceModule);
  mockModule(nodeRequire, '../../service/utils', mockUtilsModule);
  const mod = reloadModule<{ SouthConnectorController: typeof SouthConnectorControllerShape }>(nodeRequire, './south-connector.controller');
  SouthConnectorController = mod.SouthConnectorController;
});

describe('SouthConnectorController', () => {
  let controller: SouthConnectorControllerShape;
  let southService: SouthServiceMock;
  let scanModeService: ScanModeServiceMock;
  let oIBusService: OIBusServiceMock;
  let userService: UserServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;
  let mockRes: {
    attachment: ReturnType<typeof mock.fn>;
    contentType: ReturnType<typeof mock.fn>;
    status: ReturnType<typeof mock.fn>;
    send: ReturnType<typeof mock.fn>;
  };

  beforeEach(() => {
    southService = new SouthServiceMock();
    scanModeService = new ScanModeServiceMock();
    oIBusService = new OIBusServiceMock();
    userService = new UserServiceMock();
    mockRes = {
      attachment: mock.fn(),
      contentType: mock.fn(),
      send: mock.fn(),
      status: mock.fn()
    };
    mockRes.status = mock.fn(() => mockRes);
    mockRequest = {
      services: { southService, scanModeService, oIBusService, userService },
      user: { id: 'test', login: 'testUser' },
      res: mockRes as unknown as import('express').Response // partial mock of express.Response — only used properties are defined
    } as Partial<CustomExpressRequest>;
    // Reset module-level mock fns
    mockSouthServiceModule.toSouthConnectorDTO = mock.fn((connector: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return connector;
    });
    mockSouthServiceModule.toSouthConnectorLightDTO = mock.fn((connector: unknown, getUserInfo: (id: string) => void) => {
      getUserInfo('');
      return connector;
    });
    mockSouthServiceModule.toSouthConnectorItemDTO = mock.fn((item: unknown, southType: unknown, getUserInfo?: (id: string) => void) => {
      if (getUserInfo) getUserInfo('');
      return item;
    });
    mockSouthServiceModule.toSouthItemGroupDTO = mock.fn((group: unknown, getUserInfo?: (id: string) => void) => {
      if (getUserInfo) getUserInfo('');
      return group;
    });
    mockUtilsModule.itemToFlattenedCSV = mock.fn(() => 'csv content');
    controller = new SouthConnectorController();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should return south connector types', async () => {
    const mockManifests = [testData.south.manifest];
    southService.listManifest = mock.fn(() => mockManifests);

    const result = await controller.listManifest(mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.listManifest.mock.calls.length, 1);
    assert.deepStrictEqual(result, [
      {
        id: testData.south.manifest.id,
        category: testData.south.manifest.category,
        modes: testData.south.manifest.modes
      }
    ]);
  });

  it('should return a south connector manifest', async () => {
    const mockManifest = testData.south.manifest;
    const type = testData.south.manifest.id;
    southService.getManifest = mock.fn(() => mockManifest);

    const result = await controller.getManifest(type, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.getManifest.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockManifest);
  });

  it('should return a list of south connectors', async () => {
    const mockSouthConnectors = testData.south.list;
    southService.list = mock.fn(() => mockSouthConnectors);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.list.mock.calls.length, 1);
    assert.deepStrictEqual(result, mockSouthConnectors);
  });

  it('should return a south connector by ID', async () => {
    const mockSouthConnector = testData.south.list[0];
    const southId = mockSouthConnector.id;
    southService.findById = mock.fn(() => mockSouthConnector);

    const result = await controller.findById(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.deepStrictEqual(result, mockSouthConnector);
  });

  it('should create a new south connector', async () => {
    const command: SouthConnectorCommandDTO = testData.south.command;
    const createdSouthConnector = testData.south.list[0];
    southService.create = mock.fn(async () => createdSouthConnector);

    const result = await controller.create(command, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.create.mock.calls.length, 1);
    assert.deepStrictEqual(southService.create.mock.calls[0].arguments, [command, null, 'test']);
    assert.deepStrictEqual(result, createdSouthConnector);
  });

  it('should update an existing south connector', async () => {
    const southId = testData.south.list[0].id;
    const command: SouthConnectorCommandDTO = testData.south.command;
    southService.update = mock.fn(async () => undefined);

    await controller.update(southId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.update.mock.calls.length, 1);
    assert.deepStrictEqual(southService.update.mock.calls[0].arguments, [southId, command, 'test']);
  });

  it('should delete a south connector', async () => {
    const southId = testData.south.list[0].id;
    southService.delete = mock.fn(async () => undefined);

    await controller.delete(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(southService.delete.mock.calls[0].arguments[0], southId);
  });

  it('should start a south connector', async () => {
    const southId = testData.south.list[0].id;
    southService.start = mock.fn(async () => undefined);

    await controller.start(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.start.mock.calls.length, 1);
    assert.deepStrictEqual(southService.start.mock.calls[0].arguments[0], southId);
  });

  it('should stop a south connector', async () => {
    const southId = testData.south.list[0].id;
    southService.stop = mock.fn(async () => undefined);

    await controller.stop(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.stop.mock.calls.length, 1);
    assert.deepStrictEqual(southService.stop.mock.calls[0].arguments[0], southId);
  });

  it('should reset south connector metrics', async () => {
    const southId = testData.south.list[0].id;
    oIBusService.resetSouthMetrics = mock.fn(async () => undefined);

    await controller.resetSouthMetrics(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(oIBusService.resetSouthMetrics.mock.calls.length, 1);
    assert.deepStrictEqual(oIBusService.resetSouthMetrics.mock.calls[0].arguments[0], southId);
  });

  it('should test south connection', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const settings = testData.south.command.settings;
    southService.testSouth = mock.fn(async () => ({ items: [] }));

    await controller.testConnection(southId, southType, settings, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.testSouth.mock.calls.length, 1);
    assert.deepStrictEqual(southService.testSouth.mock.calls[0].arguments, [southId, southType, settings]);
  });

  it('should wrap errors when testing south connection', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const settings = testData.south.command.settings;
    southService.testSouth = mock.fn(async () => {
      throw new Error('South connection failure');
    });

    try {
      await controller.testConnection(southId, southType, settings, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual((error as OIBusTestingError).message, 'South connection failure');
    }
    assert.strictEqual(southService.testSouth.mock.calls.length, 1);
    assert.deepStrictEqual(southService.testSouth.mock.calls[0].arguments, [southId, southType, settings]);
  });

  it('should test a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const itemName = testData.south.itemCommand.name;
    const requestBody = {
      southSettings: testData.south.command.settings,
      itemSettings: testData.south.itemCommand.settings,
      testingSettings: testData.south.itemTestingSettings
    };

    const mockContent: OIBusContent = {
      type: 'any',
      filePath: '/path/to/file.json',
      content: '{"key": "value"}'
    };
    southService.testItem = mock.fn(() => mockContent);

    const result = await controller.testItem(southId, southType, itemName, requestBody, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.testItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.testItem.mock.calls[0].arguments, [
      southId,
      southType,
      itemName,
      requestBody.southSettings,
      requestBody.itemSettings,
      requestBody.testingSettings
    ]);
    assert.deepStrictEqual(result, mockContent);
  });

  it('should wrap errors when testing a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const itemName = testData.south.itemCommand.name;
    const requestBody = {
      southSettings: testData.south.command.settings,
      itemSettings: testData.south.itemCommand.settings,
      testingSettings: testData.south.itemTestingSettings
    };
    southService.testItem = mock.fn(async () => {
      throw new Error('South item failure');
    });

    try {
      await controller.testItem(southId, southType, itemName, requestBody, mockRequest as CustomExpressRequest);
      assert.fail('Expected error to be thrown');
    } catch (error) {
      assert.ok(error instanceof OIBusTestingError);
      assert.strictEqual((error as OIBusTestingError).message, 'South item failure');
    }
    assert.strictEqual(southService.testItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.testItem.mock.calls[0].arguments, [
      southId,
      southType,
      itemName,
      requestBody.southSettings,
      requestBody.itemSettings,
      requestBody.testingSettings
    ]);
  });

  it('should return a list of south connector items', async () => {
    const southId = testData.south.list[0].id;
    const mockItems = testData.south.list[0].items;
    southService.findById = mock.fn(() => testData.south.list[0]);
    southService.listItems = mock.fn(() => mockItems);

    const result = await controller.listItems(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.strictEqual(southService.listItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.listItems.mock.calls[0].arguments[0], southId);
    assert.deepStrictEqual(result, mockItems);
  });

  it('should search south connector items', async () => {
    const southId = testData.south.list[0].id;
    const page = 1;
    const name = 'test';
    const scanModeId = 'scanModeId';
    const enabled = false;

    const searchParams: SouthConnectorItemSearchParam = {
      name,
      scanModeId,
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
    southService.findById = mock.fn(() => testData.south.list[0]);
    southService.searchItems = mock.fn(async () => mockPageResult);

    const result = await controller.searchItems(southId, name, scanModeId, enabled, page, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.strictEqual(southService.searchItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.searchItems.mock.calls[0].arguments, [southId, searchParams]);
    assert.deepStrictEqual(result, mockPageResult);
  });

  it('should search south connector items with default parameters', async () => {
    const southId = testData.south.list[0].id;

    const mockPageResult = {
      content: testData.south.list[0].items,
      totalElements: testData.south.list[0].items.length,
      size: 25,
      number: 0,
      totalPages: 1
    };
    southService.findById = mock.fn(() => testData.south.list[0]);
    southService.searchItems = mock.fn(async () => mockPageResult);

    const result = await controller.searchItems(southId, undefined, undefined, undefined, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.strictEqual(southService.searchItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.searchItems.mock.calls[0].arguments, [
      southId,
      { page: 0, name: undefined, scanModeId: undefined, enabled: undefined }
    ]);
    assert.deepStrictEqual(result, {
      ...mockPageResult,
      content: mockPageResult.content
    });
  });

  it('should return a specific south connector item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    const mockItem = testData.south.list[0].items[0];

    southService.findById = mock.fn(() => testData.south.list[0]);
    southService.findItemById = mock.fn(() => mockItem);

    const result = await controller.findItemById(southId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.strictEqual(southService.findItemById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findItemById.mock.calls[0].arguments, [southId, itemId]);
    assert.deepStrictEqual(result, mockItem);
  });

  it('should get item last value', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    const mockLastValue = {
      itemId,
      itemName: testData.south.list[0].items[0].name,
      queryTime: '2024-01-01T00:00:00.000Z',
      value: { temperature: 42 },
      trackedInstant: '2024-01-02T00:00:00.000Z'
    };
    southService.getItemLastValue = mock.fn(() => mockLastValue);

    const result = await controller.getItemLastValue(southId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.getItemLastValue.mock.calls.length, 1);
    assert.deepStrictEqual(southService.getItemLastValue.mock.calls[0].arguments, [southId, itemId]);
    assert.deepStrictEqual(result, mockLastValue);
  });

  it('should create a new south connector item', async () => {
    const southId = testData.south.list[0].id;
    const command: SouthConnectorItemCommandDTO = testData.south.itemCommand;
    const createdItem = testData.south.list[0].items[0];

    southService.findById = mock.fn(() => testData.south.list[0]);
    southService.createItem = mock.fn(async () => createdItem);

    const result = await controller.createItem(southId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.strictEqual(southService.createItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.createItem.mock.calls[0].arguments, [southId, command, 'test']);
    assert.deepStrictEqual(result, createdItem);
  });

  it('should update a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    const command: SouthConnectorItemCommandDTO = testData.south.itemCommand;
    southService.updateItem = mock.fn(async () => undefined);

    await controller.updateItem(southId, itemId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.updateItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.updateItem.mock.calls[0].arguments, [southId, itemId, command, 'test']);
  });

  it('should enable a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    southService.enableItem = mock.fn(async () => undefined);

    await controller.enableItem(southId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.enableItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.enableItem.mock.calls[0].arguments, [southId, itemId]);
  });

  it('should disable a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    southService.disableItem = mock.fn(async () => undefined);

    await controller.disableItem(southId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.disableItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.disableItem.mock.calls[0].arguments, [southId, itemId]);
  });

  it('should enable a list of items', async () => {
    const southId = testData.south.list[0].id;
    const itemIds = testData.south.list[0].items.map(item => item.id);
    southService.enableItems = mock.fn(async () => undefined);

    await controller.enableItems(southId, { itemIds }, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.enableItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.enableItems.mock.calls[0].arguments, [southId, itemIds]);
  });

  it('should disable a list of items', async () => {
    const southId = testData.south.list[0].id;
    const itemIds = testData.south.list[0].items.map(item => item.id);
    southService.disableItems = mock.fn(async () => undefined);

    await controller.disableItems(southId, { itemIds }, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.disableItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.disableItems.mock.calls[0].arguments, [southId, itemIds]);
  });

  it('should delete a list of items', async () => {
    const southId = testData.south.list[0].id;
    const itemIds = testData.south.list[0].items.map(item => item.id);
    southService.deleteItems = mock.fn(async () => undefined);

    await controller.deleteItems(southId, { itemIds }, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.deleteItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.deleteItems.mock.calls[0].arguments, [southId, itemIds]);
  });

  it('should delete an item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    southService.deleteItem = mock.fn(async () => undefined);

    await controller.deleteItem(southId, itemId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.deleteItem.mock.calls.length, 1);
    assert.deepStrictEqual(southService.deleteItem.mock.calls[0].arguments, [southId, itemId]);
  });

  it('should delete all items from a south connector', async () => {
    const southId = testData.south.list[0].id;
    southService.deleteAllItems = mock.fn(async () => undefined);

    await controller.deleteAllItems(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.deleteAllItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.deleteAllItems.mock.calls[0].arguments[0], southId);
  });

  it('should convert items to CSV', async () => {
    const southType = testData.south.manifest.id;
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
    const southId = testData.south.list[0].id;
    const delimiter = ',';
    const command = { delimiter };

    southService.findById = mock.fn(() => testData.south.list[0]);
    scanModeService.list = mock.fn(() => []);

    await controller.exportItems(southId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(southService.findById.mock.calls[0].arguments[0], southId);
    assert.deepStrictEqual(mockRes.attachment.mock.calls[0].arguments[0], 'items.csv');
    assert.deepStrictEqual(mockRes.contentType.mock.calls[0].arguments[0], 'text/csv; charset=utf-8');
    assert.deepStrictEqual(mockRes.status.mock.calls[0].arguments[0], 200);
    assert.deepStrictEqual(mockRes.send.mock.calls[0].arguments[0], 'csv content');
  });

  it('should check CSV import and return validation results', async () => {
    const southType = testData.south.manifest.id;
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
      items: [{ id: '1', name: 'item1' }] as Array<SouthConnectorItemDTO>,
      errors: []
    };
    southService.checkImportItems = mock.fn(() => mockResult);

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
    assert.strictEqual(southService.checkImportItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.checkImportItems.mock.calls[0].arguments, [
      southType,
      csvContent,
      delimiter,
      JSON.parse(jsonContent)
    ]);
    assert.deepStrictEqual(result, mockResult);
    assert.strictEqual(unlinkMock.mock.calls.length, 2);
  });

  it('should throw an error if itemsToImport or currentItems files are missing in checkImportItems', async () => {
    const southType = testData.south.manifest.id;
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
    const southId = testData.south.list[0].id;
    const itemsFile = {
      path: 'myFile.json'
    } as Express.Multer.File;

    southService.importItems = mock.fn(async () => undefined);
    mock.method(fs, 'readFile', async () => JSON.stringify([{ id: '1', name: 'item1', scanModeName: 'scan1' }]));
    mock.method(fs, 'unlink', async () => undefined);

    await controller.importItems(southId, itemsFile, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.importItems.mock.calls.length, 1);
    assert.deepStrictEqual(southService.importItems.mock.calls[0].arguments, [
      southId,
      [{ id: '1', name: 'item1', scanModeName: 'scan1' }],
      'test'
    ]);
  });

  it('should throw an error if items file is missing in importItems', async () => {
    const southId = testData.south.list[0].id;

    await assert.rejects(controller.importItems(southId, undefined!, mockRequest as CustomExpressRequest), {
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

  it('should list groups for a south connector', async () => {
    const southId = testData.south.list[0].id;
    const mockGroups: Array<SouthItemGroupDTO> = [
      {
        id: 'group1',
        createdBy: { id: '', friendlyName: '' },
        updatedBy: { id: '', friendlyName: '' },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        standardSettings: {
          name: 'Group 1',
          scanMode: toScanModeDTO(testData.scanMode.list[0])
        },
        historySettings: {
          overlap: null,
          maxReadInterval: null,
          readDelay: 0
        }
      }
    ];
    southService.getGroups = mock.fn(() => mockGroups);

    const result = await controller.listGroups(southId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.getGroups.mock.calls.length, 1);
    assert.deepStrictEqual(southService.getGroups.mock.calls[0].arguments[0], southId);
    assert.deepStrictEqual(result, mockGroups);
  });

  it('should get a specific group by id', async () => {
    const southId = testData.south.list[0].id;
    const groupId = 'group1';
    const mockGroup: SouthItemGroupDTO = {
      id: 'group1',
      createdBy: { id: '', friendlyName: '' },
      updatedBy: { id: '', friendlyName: '' },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      standardSettings: {
        name: 'Group 1',
        scanMode: toScanModeDTO(testData.scanMode.list[0])
      },
      historySettings: {
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      }
    };
    southService.getGroup = mock.fn(() => mockGroup);

    const result = await controller.getGroup(southId, groupId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.getGroup.mock.calls.length, 1);
    assert.deepStrictEqual(southService.getGroup.mock.calls[0].arguments, [southId, groupId]);
    assert.deepStrictEqual(result, mockGroup);
  });

  it('should create a group', async () => {
    const southId = testData.south.list[0].id;
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
    const mockCreatedGroup: SouthItemGroupDTO = {
      id: 'newGroupId',
      createdBy: { id: '', friendlyName: '' },
      updatedBy: { id: '', friendlyName: '' },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      standardSettings: {
        name: 'New Group',
        scanMode: toScanModeDTO(testData.scanMode.list[0])
      },
      historySettings: {
        overlap: 5,
        maxReadInterval: null,
        readDelay: 0
      }
    };
    southService.createGroup = mock.fn(() => mockCreatedGroup);

    const result = await controller.createGroup(southId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.createGroup.mock.calls.length, 1);
    assert.deepStrictEqual(southService.createGroup.mock.calls[0].arguments, [southId, command, 'test']);
    assert.deepStrictEqual(result, mockCreatedGroup);
  });

  it('should update a group', async () => {
    const southId = testData.south.list[0].id;
    const groupId = 'group1';
    const command: SouthItemGroupCommandDTO = {
      id: null,
      standardSettings: {
        name: 'Updated Group',
        scanModeId: testData.scanMode.list[1].id
      },
      historySettings: {
        overlap: 10,
        maxReadInterval: null,
        readDelay: 0
      }
    };
    southService.updateGroup = mock.fn(async () => undefined);

    await controller.updateGroup(southId, groupId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.updateGroup.mock.calls.length, 1);
    assert.deepStrictEqual(southService.updateGroup.mock.calls[0].arguments, [southId, groupId, 'test', command]);
  });

  it('should delete a group', async () => {
    const southId = testData.south.list[0].id;
    const groupId = 'group1';
    southService.deleteGroup = mock.fn(async () => undefined);

    await controller.deleteGroup(southId, groupId, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.deleteGroup.mock.calls.length, 1);
    assert.deepStrictEqual(southService.deleteGroup.mock.calls[0].arguments, [southId, groupId]);
  });

  it('should move items to a group', async () => {
    const southId = testData.south.list[0].id;
    const body = {
      itemIds: [testData.south.list[0].items[0].id, testData.south.list[0].items[1].id],
      groupId: 'group1'
    };
    southService.moveItemsToGroup = mock.fn(async () => undefined);

    await controller.moveItemsToGroup(southId, body, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.moveItemsToGroup.mock.calls.length, 1);
    assert.deepStrictEqual(southService.moveItemsToGroup.mock.calls[0].arguments, [southId, body.itemIds, body.groupId]);
  });

  it('should remove items from groups when groupId is null', async () => {
    const southId = testData.south.list[0].id;
    const body = {
      itemIds: [testData.south.list[0].items[0].id],
      groupId: null
    };
    southService.moveItemsToGroup = mock.fn(async () => undefined);

    await controller.moveItemsToGroup(southId, body, mockRequest as CustomExpressRequest);

    assert.strictEqual(southService.moveItemsToGroup.mock.calls.length, 1);
    assert.deepStrictEqual(southService.moveItemsToGroup.mock.calls[0].arguments, [southId, body.itemIds, null]);
  });
});
