import { SouthConnectorController } from './south-connector.controller';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam
} from '../../../shared/model/south-connector.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import SouthServiceMock from '../../tests/__mocks__/service/south-service.mock';
import { OIBusContent } from '../../../shared/model/engine.model';
import ScanModeServiceMock from '../../tests/__mocks__/service/scan-mode-service.mock';
import OibusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import { OIBusTestingError } from '../../model/types';

// Mock the services
jest.mock('../../service/south.service', () => ({
  toSouthConnectorDTO: jest.fn().mockImplementation(connector => connector),
  toSouthConnectorLightDTO: jest.fn().mockImplementation(connector => connector),
  toSouthConnectorItemDTO: jest.fn().mockImplementation(item => item)
}));

jest.mock('../../service/utils', () => ({
  itemToFlattenedCSV: jest.fn().mockReturnValue('csv content')
}));

describe('SouthConnectorController', () => {
  let controller: SouthConnectorController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      southService: new SouthServiceMock(),
      scanModeService: new ScanModeServiceMock(),
      oIBusService: new OibusServiceMock()
    },
    res: {
      attachment: jest.fn(),
      contentType: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    }
  } as unknown as CustomExpressRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new SouthConnectorController();
  });

  it('should return south connector types', async () => {
    const mockManifests = [testData.south.manifest];
    (mockRequest.services!.southService.listManifest as jest.Mock).mockReturnValue(mockManifests);

    const result = await controller.listManifest(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.listManifest).toHaveBeenCalled();
    expect(result).toEqual([
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
    (mockRequest.services!.southService.getManifest as jest.Mock).mockReturnValue(mockManifest);

    const result = await controller.getManifest(type, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.getManifest).toHaveBeenCalled();
    expect(result).toEqual(mockManifest);
  });

  it('should return a list of south connectors', async () => {
    const mockSouthConnectors = testData.south.list;
    (mockRequest.services!.southService.list as jest.Mock).mockReturnValue(mockSouthConnectors);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.list).toHaveBeenCalled();
    expect(result).toEqual(mockSouthConnectors);
  });

  it('should return a south connector by ID', async () => {
    const mockSouthConnector = testData.south.list[0];
    const southId = mockSouthConnector.id;
    (mockRequest.services!.southService.findById as jest.Mock).mockReturnValue(mockSouthConnector);

    const result = await controller.findById(southId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.findById).toHaveBeenCalledWith(southId);
    expect(result).toEqual(mockSouthConnector);
  });

  it('should create a new south connector', async () => {
    const command: SouthConnectorCommandDTO = testData.south.command;
    const createdSouthConnector = testData.south.list[0];
    (mockRequest.services!.southService.create as jest.Mock).mockResolvedValue(createdSouthConnector);

    const result = await controller.create(command, undefined, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.create).toHaveBeenCalledWith(command, null);
    expect(result).toEqual(createdSouthConnector);
  });

  it('should update an existing south connector', async () => {
    const southId = testData.south.list[0].id;
    const command: SouthConnectorCommandDTO = testData.south.command;
    (mockRequest.services!.southService.update as jest.Mock).mockResolvedValue(undefined);

    await controller.update(southId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.update).toHaveBeenCalledWith(southId, command);
  });

  it('should delete a south connector', async () => {
    const southId = testData.south.list[0].id;
    (mockRequest.services!.southService.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete(southId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.delete).toHaveBeenCalledWith(southId);
  });

  it('should start a south connector', async () => {
    const southId = testData.south.list[0].id;
    (mockRequest.services!.southService.start as jest.Mock).mockResolvedValue(undefined);

    await controller.start(southId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.start).toHaveBeenCalledWith(southId);
  });

  it('should stop a south connector', async () => {
    const southId = testData.south.list[0].id;
    (mockRequest.services!.southService.stop as jest.Mock).mockResolvedValue(undefined);

    await controller.stop(southId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.stop).toHaveBeenCalledWith(southId);
  });

  it('should reset south connector metrics', async () => {
    const southId = testData.south.list[0].id;
    (mockRequest.services!.oIBusService.resetSouthMetrics as jest.Mock).mockResolvedValue(undefined);

    await controller.resetSouthMetrics(southId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.oIBusService.resetSouthMetrics).toHaveBeenCalledWith(southId);
  });

  it('should test south connection', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const settings = testData.south.command.settings;

    (mockRequest.services!.southService.testSouth as jest.Mock).mockResolvedValue(undefined);

    await controller.testConnection(southId, southType, settings, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.testSouth).toHaveBeenCalledWith(southId, southType, settings);
  });

  it('should throw OIBusTestingError when testing south connection fails', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const settings = testData.south.command.settings;
    const error = new Error('south connection failed');
    (mockRequest.services!.southService.testSouth as jest.Mock).mockRejectedValue(error);

    await controller.testConnection(southId, southType, settings, mockRequest as CustomExpressRequest).catch(caughtError => {
      expect(caughtError).toBeInstanceOf(OIBusTestingError);
      expect((caughtError as Error).message).toBe('south connection failed');
    });
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
    (mockRequest.services!.southService.testItem as jest.Mock).mockReturnValueOnce(mockContent);

    const result = await controller.testItem(southId, southType, itemName, requestBody, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.testItem).toHaveBeenCalledWith(
      southId,
      southType,
      itemName,
      requestBody.southSettings,
      requestBody.itemSettings,
      requestBody.testingSettings
    );
    expect(result).toEqual(mockContent);
  });

  it('should throw OIBusTestingError when testing a south connector item fails', async () => {
    const southId = testData.south.list[0].id;
    const southType = testData.south.command.type;
    const itemName = testData.south.itemCommand.name;
    const requestBody = {
      southSettings: testData.south.command.settings,
      itemSettings: testData.south.itemCommand.settings,
      testingSettings: testData.south.itemTestingSettings
    };
    const error = new Error('south item test failed');
    (mockRequest.services!.southService.testItem as jest.Mock).mockRejectedValue(error);

    await controller.testItem(southId, southType, itemName, requestBody, mockRequest as CustomExpressRequest).catch(caughtError => {
      expect(caughtError).toBeInstanceOf(OIBusTestingError);
      expect((caughtError as Error).message).toBe('south item test failed');
    });
  });

  it('should return a list of south connector items', async () => {
    const southId = testData.south.list[0].id;
    const mockItems = testData.south.list[0].items;
    (mockRequest.services!.southService.findById as jest.Mock).mockReturnValue(testData.south.list[0]);
    (mockRequest.services!.southService.listItems as jest.Mock).mockReturnValue(mockItems);

    const result = await controller.listItems(southId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.findById).toHaveBeenCalledWith(southId);
    expect(mockRequest.services!.southService.listItems).toHaveBeenCalledWith(southId);
    expect(result).toEqual(mockItems);
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
    (mockRequest.services!.southService.findById as jest.Mock).mockReturnValue(testData.south.list[0]);
    (mockRequest.services!.southService.searchItems as jest.Mock).mockResolvedValue(mockPageResult);

    const result = await controller.searchItems(southId, name, scanModeId, enabled, page, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.findById).toHaveBeenCalledWith(southId);
    expect(mockRequest.services!.southService.searchItems).toHaveBeenCalledWith(southId, searchParams);
    expect(result).toEqual(mockPageResult);
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
    (mockRequest.services!.southService.findById as jest.Mock).mockReturnValue(testData.south.list[0]);
    (mockRequest.services!.southService.searchItems as jest.Mock).mockResolvedValue(mockPageResult);

    const result = await controller.searchItems(southId, undefined, undefined, undefined, undefined, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.findById).toHaveBeenCalledWith(southId);
    expect(mockRequest.services!.southService.searchItems).toHaveBeenCalledWith(southId, { page: 0 });
    expect(result).toEqual({
      ...mockPageResult,
      content: mockPageResult.content
    });
  });

  it('should return a specific south connector item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    const mockItem = testData.south.list[0].items[0];

    (mockRequest.services!.southService.findById as jest.Mock).mockReturnValue(testData.south.list[0]);
    (mockRequest.services!.southService.findItemById as jest.Mock).mockReturnValue(mockItem);

    const result = await controller.findItemById(southId, itemId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.findById).toHaveBeenCalledWith(southId);
    expect(mockRequest.services!.southService.findItemById).toHaveBeenCalledWith(southId, itemId);
    expect(result).toEqual(mockItem);
  });

  it('should create a new south connector item', async () => {
    const southId = testData.south.list[0].id;
    const command: SouthConnectorItemCommandDTO = testData.south.itemCommand;
    const createdItem = testData.south.list[0].items[0];

    (mockRequest.services!.southService.findById as jest.Mock).mockReturnValue(testData.south.list[0]);
    (mockRequest.services!.southService.createItem as jest.Mock).mockResolvedValue(createdItem);

    const result = await controller.createItem(southId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.findById).toHaveBeenCalledWith(southId);
    expect(mockRequest.services!.southService.createItem).toHaveBeenCalledWith(southId, command);
    expect(result).toEqual(createdItem);
  });

  it('should update a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    const command: SouthConnectorItemCommandDTO = testData.south.itemCommand;

    (mockRequest.services!.southService.updateItem as jest.Mock).mockResolvedValue(undefined);

    await controller.updateItem(southId, itemId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.updateItem).toHaveBeenCalledWith(southId, itemId, command);
  });

  it('should enable a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;

    (mockRequest.services!.southService.enableItem as jest.Mock).mockResolvedValue(undefined);

    await controller.enableItem(southId, itemId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.enableItem).toHaveBeenCalledWith(southId, itemId);
  });

  it('should disable a south connector item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;

    (mockRequest.services!.southService.disableItem as jest.Mock).mockResolvedValue(undefined);

    await controller.disableItem(southId, itemId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.disableItem).toHaveBeenCalledWith(southId, itemId);
  });

  it('should enable a list of items', async () => {
    const southId = testData.south.list[0].id;
    const itemIds = testData.south.list[0].items.map(item => item.id);

    (mockRequest.services!.southService.enableItems as jest.Mock).mockResolvedValue(undefined);

    await controller.enableItems(southId, { itemIds }, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.enableItems).toHaveBeenCalledWith(southId, itemIds);
  });

  it('should disable a list of items', async () => {
    const southId = testData.south.list[0].id;
    const itemIds = testData.south.list[0].items.map(item => item.id);

    (mockRequest.services!.southService.disableItems as jest.Mock).mockResolvedValue(undefined);

    await controller.disableItems(southId, { itemIds }, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.disableItems).toHaveBeenCalledWith(southId, itemIds);
  });

  it('should delete a list of items', async () => {
    const southId = testData.south.list[0].id;
    const itemIds = testData.south.list[0].items.map(item => item.id);

    (mockRequest.services!.southService.deleteItems as jest.Mock).mockResolvedValue(undefined);

    await controller.deleteItems(southId, { itemIds }, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.deleteItems).toHaveBeenCalledWith(southId, itemIds);
  });

  it('should delete a item', async () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;

    (mockRequest.services!.southService.deleteItem as jest.Mock).mockResolvedValue(undefined);

    await controller.deleteItem(southId, itemId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.deleteItem).toHaveBeenCalledWith(southId, itemId);
  });

  it('should delete all items from a south connector', async () => {
    const southId = testData.south.list[0].id;

    (mockRequest.services!.southService.deleteAllItems as jest.Mock).mockResolvedValue(undefined);

    await controller.deleteAllItems(southId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.deleteAllItems).toHaveBeenCalledWith(southId);
  });

  it('should convert items to CSV', async () => {
    const southType = testData.south.manifest.id;
    const delimiter = ',';
    const itemsFile = {
      buffer: Buffer.from(JSON.stringify([{ id: '1', name: 'item1', scanModeName: 'scan1' }]))
    } as Express.Multer.File;

    await controller.itemsToCsv(southType, delimiter, itemsFile, mockRequest as CustomExpressRequest);

    expect(mockRequest.res!.attachment).toHaveBeenCalledWith('items.csv');
    expect(mockRequest.res!.contentType).toHaveBeenCalledWith('text/csv; charset=utf-8');
    expect(mockRequest.res!.status).toHaveBeenCalledWith(200);
    expect(mockRequest.res!.send).toHaveBeenCalledWith('csv content');
  });

  it('should export items to CSV', async () => {
    const southId = testData.south.list[0].id;
    const delimiter = ',';
    const command = { delimiter };

    (mockRequest.services!.southService.findById as jest.Mock).mockReturnValue(testData.south.list[0]);
    (mockRequest.services!.scanModeService.list as jest.Mock).mockReturnValue([]);

    await controller.exportItems(southId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.findById).toHaveBeenCalledWith(southId);
    expect(mockRequest.res!.attachment).toHaveBeenCalledWith('items.csv');
    expect(mockRequest.res!.contentType).toHaveBeenCalledWith('text/csv; charset=utf-8');
    expect(mockRequest.res!.status).toHaveBeenCalledWith(200);
    expect(mockRequest.res!.send).toHaveBeenCalledWith('csv content');
  });

  it('should check CSV import and return validation results', async () => {
    const southType = testData.south.manifest.id;
    const delimiter = ',';
    const itemsToImportFile = {
      buffer: Buffer.from('id,name\n1,item1')
    } as Express.Multer.File;
    const currentItemsFile = {
      buffer: Buffer.from(JSON.stringify([{ id: '1', name: 'item1' }]))
    } as Express.Multer.File;

    const mockResult = {
      items: [{ id: '1', name: 'item1' }] as Array<SouthConnectorItemDTO>,
      errors: []
    };

    (mockRequest.services!.southService.checkImportItems as jest.Mock).mockReturnValue(mockResult);

    const result = await controller.checkImportItems(
      southType,
      delimiter,
      itemsToImportFile,
      currentItemsFile,
      mockRequest as CustomExpressRequest
    );

    expect(mockRequest.services!.southService.checkImportItems).toHaveBeenCalledWith(
      southType,
      itemsToImportFile.buffer.toString('utf8'),
      delimiter,
      JSON.parse(currentItemsFile.buffer.toString('utf8'))
    );
    expect(result).toEqual(mockResult);
  });

  it('should throw an error if itemsToImport or currentItems files are missing in checkImportItems', async () => {
    const southType = testData.south.manifest.id;
    const delimiter = ',';
    const itemsToImportFile = {
      buffer: Buffer.from('id,name\n1,item1')
    } as Express.Multer.File;

    await expect(
      controller.checkImportItems(southType, delimiter, itemsToImportFile, undefined!, mockRequest as CustomExpressRequest)
    ).rejects.toThrow('Missing "itemsToImport" or "currentItems"');
  });

  it('should import items from CSV', async () => {
    const southId = testData.south.list[0].id;
    const itemsFile = {
      buffer: Buffer.from(JSON.stringify([{ id: '1', name: 'item1' }]))
    } as Express.Multer.File;

    (mockRequest.services!.southService.importItems as jest.Mock).mockResolvedValue(undefined);

    await controller.importItems(southId, itemsFile, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.southService.importItems).toHaveBeenCalledWith(southId, JSON.parse(itemsFile.buffer.toString('utf8')));
  });

  it('should throw an error if items file is missing in importItems', async () => {
    const southId = testData.south.list[0].id;

    await expect(controller.importItems(southId, undefined!, mockRequest as CustomExpressRequest)).rejects.toThrow('Missing file "items"');
  });
});
