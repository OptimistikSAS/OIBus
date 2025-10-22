import { HistoryQueryController } from './history-query.controller';
import { HistoryQueryCommandDTO, HistoryQueryItemCommandDTO, HistoryQueryItemSearchParam } from '../../../shared/model/history-query.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import HistoryQueryServiceMock from '../../tests/__mocks__/service/history-query-service.mock';
import { CacheMetadata, OIBusContent } from '../../../shared/model/engine.model';
import { TransformerDTO, TransformerDTOWithOptions } from '../../../shared/model/transformer.model';

// Mock the services
jest.mock('../../service/history-query.service', () => ({
  toHistoryQueryDTO: jest.fn().mockImplementation(query => query),
  toHistoryQueryLightDTO: jest.fn().mockImplementation(query => query),
  toHistoryQueryItemDTO: jest.fn().mockImplementation(item => item)
}));

jest.mock('../../service/utils', () => ({
  itemToFlattenedCSV: jest.fn().mockReturnValue('csv content')
}));

describe('HistoryQueryController', () => {
  let controller: HistoryQueryController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      historyQueryService: new HistoryQueryServiceMock(),
      southService: {
        getInstalledSouthManifests: jest
          .fn()
          .mockReturnValue([{ ...testData.south.manifest, id: testData.historyQueries.list[0].southType }])
      }
    },
    res: {
      attachment: jest.fn(),
      contentType: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      setHeader: jest.fn(),
      pipe: jest.fn()
    }
  } as unknown as CustomExpressRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new HistoryQueryController();
  });

  it('should return a list of history queries', async () => {
    const mockHistoryQueries = testData.historyQueries.list;
    (mockRequest.services!.historyQueryService.list as jest.Mock).mockReturnValue(mockHistoryQueries);

    const result = await controller.list(mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.list).toHaveBeenCalled();
    expect(result).toEqual(mockHistoryQueries);
  });

  it('should return a history query by ID', async () => {
    const mockHistoryQuery = testData.historyQueries.list[0];
    const historyId = mockHistoryQuery.id;
    (mockRequest.services!.historyQueryService.findById as jest.Mock).mockReturnValue(mockHistoryQuery);

    const result = await controller.findById(historyId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.findById).toHaveBeenCalledWith(historyId);
    expect(result).toEqual(mockHistoryQuery);
  });

  it('should create a new history query', async () => {
    const command: HistoryQueryCommandDTO = testData.historyQueries.command;
    const createdHistoryQuery = testData.historyQueries.list[0];
    (mockRequest.services!.historyQueryService.create as jest.Mock).mockResolvedValue(createdHistoryQuery);

    const result = await controller.create(command, undefined, undefined, undefined, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.create).toHaveBeenCalledWith(command, undefined, undefined, undefined);
    expect(result).toEqual(createdHistoryQuery);
  });

  it('should update an existing history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const command: HistoryQueryCommandDTO = testData.historyQueries.command;
    (mockRequest.services!.historyQueryService.update as jest.Mock).mockResolvedValue(undefined);

    await controller.update(historyId, command, undefined, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.update).toHaveBeenCalledWith(historyId, command, false);
  });

  it('should delete a history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    (mockRequest.services!.historyQueryService.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete(historyId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.delete).toHaveBeenCalledWith(historyId);
  });

  it('should start a history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    (mockRequest.services!.historyQueryService.start as jest.Mock).mockResolvedValue(undefined);

    await controller.start(historyId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.start).toHaveBeenCalledWith(historyId);
  });

  it('should pause a history query', async () => {
    const historyId = testData.historyQueries.list[0].id;
    (mockRequest.services!.historyQueryService.pause as jest.Mock).mockResolvedValue(undefined);

    await controller.pause(historyId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.pause).toHaveBeenCalledWith(historyId);
  });

  it('should test north connection', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const northType = testData.north.command.type;
    const fromNorth = testData.north.list[0].id;
    const settings = testData.north.command.settings;

    (mockRequest.services!.historyQueryService.testNorth as jest.Mock).mockResolvedValue(undefined);

    await controller.testNorth(historyId, northType, fromNorth, settings, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.testNorth).toHaveBeenCalledWith(historyId, northType, fromNorth, settings);
  });

  it('should test south connection', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const southType = testData.south.command.type;
    const fromSouth = testData.south.list[0].id;
    const settings = testData.south.command.settings;

    (mockRequest.services!.historyQueryService.testSouth as jest.Mock).mockResolvedValue(undefined);

    await controller.testSouth(historyId, southType, fromSouth, settings, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.testSouth).toHaveBeenCalledWith(historyId, southType, fromSouth, settings);
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
    (mockRequest.services!.historyQueryService.testItem as jest.Mock).mockImplementation(
      (_historyQueryId, _southType, _itemName, _retrieveSecretsFromSouth, _southSettings, _itemSettings, _testingSettings, callback) => {
        callback(mockContent);
      }
    );

    const result = await controller.testItem(historyId, southType, itemName, fromSouth, requestBody, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.testItem).toHaveBeenCalledWith(
      historyId,
      southType,
      itemName || '',
      fromSouth,
      requestBody.southSettings,
      requestBody.itemSettings,
      requestBody.testingSettings,
      expect.any(Function)
    );
    expect(result).toEqual(mockContent);
  });

  it('should return a list of history query items', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const mockItems = testData.historyQueries.list[0].items;
    (mockRequest.services!.historyQueryService.findById as jest.Mock).mockReturnValue(testData.historyQueries.list[0]);
    (mockRequest.services!.historyQueryService.listItems as jest.Mock).mockReturnValue(mockItems);

    const result = await controller.listItems(historyId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.findById).toHaveBeenCalledWith(historyId);
    expect(mockRequest.services!.historyQueryService.listItems).toHaveBeenCalledWith(historyId);
    expect(result).toEqual(mockItems);
  });

  it('should search history query items', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const page = 1;
    const name = 'test';

    const searchParams: HistoryQueryItemSearchParam = {
      page: page,
      name: name
    };

    const mockPageResult = {
      content: testData.south.list[0].items,
      totalElements: testData.south.list[0].items.length,
      size: 25,
      number: page,
      totalPages: 1
    };
    (mockRequest.services!.historyQueryService.findById as jest.Mock).mockReturnValue(testData.historyQueries.list[0]);
    (mockRequest.services!.historyQueryService.searchItems as jest.Mock).mockResolvedValue(mockPageResult);

    const result = await controller.searchItems(historyId, name, page, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.findById).toHaveBeenCalledWith(historyId);
    expect(mockRequest.services!.historyQueryService.searchItems).toHaveBeenCalledWith(historyId, searchParams);
    expect(result).toEqual(mockPageResult);
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
    (mockRequest.services!.historyQueryService.findById as jest.Mock).mockReturnValue(testData.historyQueries.list[0]);
    (mockRequest.services!.historyQueryService.searchItems as jest.Mock).mockResolvedValue(mockPageResult);

    const result = await controller.searchItems(historyId, undefined, undefined, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.findById).toHaveBeenCalledWith(historyId);
    expect(mockRequest.services!.historyQueryService.searchItems).toHaveBeenCalledWith(historyId, { page: 0 });
    expect(result).toEqual(mockPageResult);
  });

  it('should return a specific history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;
    const mockItem = testData.historyQueries.list[0].items[0];

    (mockRequest.services!.historyQueryService.findById as jest.Mock).mockReturnValue(testData.historyQueries.list[0]);
    (mockRequest.services!.historyQueryService.findItemById as jest.Mock).mockReturnValue(mockItem);

    const result = await controller.findItemById(historyId, itemId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.findById).toHaveBeenCalledWith(historyId);
    expect(mockRequest.services!.historyQueryService.findItemById).toHaveBeenCalledWith(historyId, itemId);
    expect(result).toEqual(mockItem);
  });

  it('should create a new history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const command: HistoryQueryItemCommandDTO = testData.historyQueries.itemCommand;
    const createdItem = testData.historyQueries.list[0].items[0];

    (mockRequest.services!.historyQueryService.findById as jest.Mock).mockReturnValue(testData.historyQueries.list[0]);
    (mockRequest.services!.historyQueryService.createItem as jest.Mock).mockResolvedValue(createdItem);

    const result = await controller.createItem(historyId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.findById).toHaveBeenCalledWith(historyId);
    expect(mockRequest.services!.historyQueryService.createItem).toHaveBeenCalledWith(historyId, command);
    expect(result).toEqual(createdItem);
  });

  it('should update a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;
    const command: HistoryQueryItemCommandDTO = testData.historyQueries.itemCommand;

    (mockRequest.services!.historyQueryService.updateItem as jest.Mock).mockResolvedValue(undefined);

    await controller.updateItem(historyId, itemId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.updateItem).toHaveBeenCalledWith(historyId, itemId, command);
  });

  it('should enable a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;

    (mockRequest.services!.historyQueryService.enableItem as jest.Mock).mockResolvedValue(undefined);

    await controller.enableItem(historyId, itemId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.enableItem).toHaveBeenCalledWith(historyId, itemId);
  });

  it('should disable a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;

    (mockRequest.services!.historyQueryService.disableItem as jest.Mock).mockResolvedValue(undefined);

    await controller.disableItem(historyId, itemId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.disableItem).toHaveBeenCalledWith(historyId, itemId);
  });

  it('should delete a history query item', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;

    (mockRequest.services!.historyQueryService.deleteItem as jest.Mock).mockResolvedValue(undefined);

    await controller.deleteItem(historyId, itemId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.deleteItem).toHaveBeenCalledWith(historyId, itemId);
  });

  it('should delete all items from a history query', async () => {
    const historyId = testData.historyQueries.list[0].id;

    (mockRequest.services!.historyQueryService.deleteAllItems as jest.Mock).mockResolvedValue(undefined);

    await controller.deleteAllItems(historyId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.deleteAllItems).toHaveBeenCalledWith(historyId);
  });

  it('should convert items to CSV', async () => {
    const southType = testData.historyQueries.list[0].southType;
    const delimiter = ',';
    const itemsFile = {
      buffer: Buffer.from(JSON.stringify([{ id: '1', name: 'item1' }]))
    } as Express.Multer.File;

    await controller.itemsToCsv(southType, delimiter, itemsFile, mockRequest as CustomExpressRequest);

    expect(mockRequest.res!.attachment).toHaveBeenCalledWith('items.csv');
    expect(mockRequest.res!.contentType).toHaveBeenCalledWith('text/csv; charset=utf-8');
    expect(mockRequest.res!.status).toHaveBeenCalledWith(200);
    expect(mockRequest.res!.send).toHaveBeenCalledWith('csv content');
  });

  it('should export items to CSV', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const delimiter = ',';
    const command = { delimiter };

    (mockRequest.services!.historyQueryService.findById as jest.Mock).mockReturnValue(testData.historyQueries.list[0]);

    await controller.exportItems(historyId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.findById).toHaveBeenCalledWith(historyId);
    expect(mockRequest.res!.attachment).toHaveBeenCalledWith('items.csv');
    expect(mockRequest.res!.contentType).toHaveBeenCalledWith('text/csv; charset=utf-8');
    expect(mockRequest.res!.status).toHaveBeenCalledWith(200);
    expect(mockRequest.res!.send).toHaveBeenCalledWith('csv content');
  });

  it('should check CSV import and return validation results', async () => {
    const southType = testData.historyQueries.list[0].southType;
    const delimiter = ',';
    const itemsToImportFile = {
      buffer: Buffer.from('id,name\n1,item1')
    } as Express.Multer.File;
    const currentItemsFile = {
      buffer: Buffer.from(JSON.stringify([{ id: '1', name: 'item1' }]))
    } as Express.Multer.File;

    const mockResult = {
      items: [testData.historyQueries.itemCommand],
      errors: []
    };

    (mockRequest.services!.historyQueryService.checkImportItems as jest.Mock).mockReturnValue(mockResult);

    const result = await controller.checkImportItems(
      southType,
      delimiter,
      itemsToImportFile,
      currentItemsFile,
      mockRequest as CustomExpressRequest
    );

    expect(mockRequest.services!.historyQueryService.checkImportItems).toHaveBeenCalledWith(
      southType,
      itemsToImportFile.buffer.toString('utf8'),
      delimiter,
      JSON.parse(currentItemsFile.buffer.toString('utf8'))
    );
    expect(result).toEqual(mockResult);
  });

  it('should throw an error if itemsToImport or currentItems files are missing in checkImportItems', async () => {
    const southType = testData.historyQueries.list[0].southType;
    const delimiter = ',';
    const itemsToImportFile = {
      buffer: Buffer.from('id,name\n1,item1')
    } as Express.Multer.File;

    await expect(
      controller.checkImportItems(southType, delimiter, itemsToImportFile, undefined!, mockRequest as CustomExpressRequest)
    ).rejects.toThrow('Missing "itemsToImport" or "currentItems"');
  });

  it('should import items from CSV', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemsFile = {
      buffer: Buffer.from(JSON.stringify([testData.historyQueries.itemCommand]))
    } as Express.Multer.File;

    (mockRequest.services!.historyQueryService.importItems as jest.Mock).mockResolvedValue(undefined);

    await controller.importItems(historyId, itemsFile, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.importItems).toHaveBeenCalledWith(
      historyId,
      JSON.parse(itemsFile.buffer.toString('utf8'))
    );
  });

  it('should throw an error if items file is missing in importItems', async () => {
    const historyId = testData.historyQueries.list[0].id;

    await expect(controller.importItems(historyId, undefined!, mockRequest as CustomExpressRequest)).rejects.toThrow(
      'Missing file "items"'
    );
  });

  it('should add or edit a transformer', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const command: TransformerDTOWithOptions = {
      transformer: testData.transformers.list[0] as TransformerDTO,
      inputType: 'any',
      options: {}
    };

    (mockRequest.services!.historyQueryService.addOrEditTransformer as jest.Mock).mockResolvedValue(undefined);

    await controller.addOrEditTransformer(historyId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.addOrEditTransformer).toHaveBeenCalledWith(historyId, command);
  });

  it('should remove a transformer', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const transformerId = testData.transformers.list[0].id;

    (mockRequest.services!.historyQueryService.removeTransformer as jest.Mock).mockResolvedValue(undefined);

    await controller.removeTransformer(historyId, transformerId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.removeTransformer).toHaveBeenCalledWith(historyId, transformerId);
  });

  it('should search cache content', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const nameContains = 'test';
    const start = '2023-01-01';
    const end = '2023-01-02';
    const folder: 'cache' | 'archive' | 'error' = 'cache';

    const mockMetadata: CacheMetadata = {
      contentFile: '/path/to/content.json',
      contentSize: 1024,
      numberOfElement: 10,
      createdAt: '2023-01-01T00:00:00Z',
      contentType: 'time-values',
      source: 'south1',
      options: {
        key1: 'value1',
        key2: 100
      }
    };
    const mockResult = [
      {
        metadataFilename: 'metadata.json',
        metadata: mockMetadata
      }
    ];

    (mockRequest.services!.historyQueryService.searchCacheContent as jest.Mock).mockResolvedValue(mockResult);

    const result = await controller.searchCacheContent(historyId, nameContains, start, end, folder, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.searchCacheContent).toHaveBeenCalledWith(
      historyId,
      { start, end, nameContains },
      folder
    );
    expect(result).toEqual(mockResult);
  });

  it('should get cache file content', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const filename = 'test.json';
    const folder = 'cache';

    const mockStream = { pipe: jest.fn() };
    (mockRequest.services!.historyQueryService.getCacheFileContent as jest.Mock).mockResolvedValue(mockStream);

    await controller.getCacheFileContent(historyId, filename, folder, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.getCacheFileContent).toHaveBeenCalledWith(historyId, folder, filename);
    expect(mockRequest.res!.setHeader).toHaveBeenCalledWith('Content-Disposition', `attachment; filename="${filename}"`);
    expect(mockStream.pipe).toHaveBeenCalledWith(mockRequest.res!);
  });

  it('should remove cache content', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const folder: 'cache' | 'archive' | 'error' = 'cache';
    const filenames = ['test1.json', 'test2.json'];

    (mockRequest.services!.historyQueryService.removeCacheContent as jest.Mock).mockResolvedValue(undefined);

    await controller.removeCacheContent(historyId, folder, filenames, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.removeCacheContent).toHaveBeenCalledWith(historyId, folder, filenames);
  });

  it('should remove all cache content', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const folder: 'cache' | 'archive' | 'error' = 'cache';

    (mockRequest.services!.historyQueryService.removeAllCacheContent as jest.Mock).mockResolvedValue(undefined);

    await controller.removeAllCacheContent(historyId, folder, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.removeAllCacheContent).toHaveBeenCalledWith(historyId, folder);
  });

  it('should move cache content', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const originFolder: 'cache' | 'archive' | 'error' = 'cache';
    const destinationFolder: 'cache' | 'archive' | 'error' = 'archive';
    const filenames = ['test1.json', 'test2.json'];

    (mockRequest.services!.historyQueryService.moveCacheContent as jest.Mock).mockResolvedValue(undefined);

    await controller.moveCacheContent(historyId, originFolder, destinationFolder, filenames, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.moveCacheContent).toHaveBeenCalledWith(
      historyId,
      originFolder,
      destinationFolder,
      filenames
    );
  });

  it('should move all cache content', async () => {
    const historyId = testData.historyQueries.list[0].id;
    const originFolder: 'cache' | 'archive' | 'error' = 'cache';
    const destinationFolder: 'cache' | 'archive' | 'error' = 'archive';

    (mockRequest.services!.historyQueryService.moveAllCacheContent as jest.Mock).mockResolvedValue(undefined);

    await controller.moveAllCacheContent(historyId, originFolder, destinationFolder, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.historyQueryService.moveAllCacheContent).toHaveBeenCalledWith(historyId, originFolder, destinationFolder);
  });

  it('enableHistoryQueryItems() should enable multiple History query items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = { itemIds: [testData.historyQueries.list[0].items[0].id, testData.historyQueries.list[0].items[1].id] };

    await historyQueryController.enableHistoryQueryItems(ctx);

    expect(ctx.app.historyQueryService.enableHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, [
      testData.historyQueries.list[0].items[0].id,
      testData.historyQueries.list[0].items[1].id
    ]);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('enableHistoryQueryItems() should return bad request', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = { itemIds: [testData.historyQueries.list[0].items[0].id] };
    ctx.app.historyQueryService.enableHistoryQueryItems.mockImplementationOnce(() => {
      throw new Error('enable history query items error');
    });

    await historyQueryController.enableHistoryQueryItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('enable history query items error');
  });

  it('disableHistoryQueryItems() should disable multiple History query items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = { itemIds: [testData.historyQueries.list[0].items[0].id, testData.historyQueries.list[0].items[1].id] };

    await historyQueryController.disableHistoryQueryItems(ctx);

    expect(ctx.app.historyQueryService.disableHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, [
      testData.historyQueries.list[0].items[0].id,
      testData.historyQueries.list[0].items[1].id
    ]);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('disableHistoryQueryItems() should return bad request', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = { itemIds: [testData.historyQueries.list[0].items[0].id] };
    ctx.app.historyQueryService.disableHistoryQueryItems.mockImplementationOnce(() => {
      throw new Error('disable history query items error');
    });

    await historyQueryController.disableHistoryQueryItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('disable history query items error');
  });

  it('deleteHistoryQueryItems() should delete multiple History query items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = { itemIds: [testData.historyQueries.list[0].items[0].id, testData.historyQueries.list[0].items[1].id] };

    await historyQueryController.deleteHistoryQueryItems(ctx);

    expect(ctx.app.historyQueryService.deleteHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, [
      testData.historyQueries.list[0].items[0].id,
      testData.historyQueries.list[0].items[1].id
    ]);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteHistoryQueryItems() should return bad request', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = { itemIds: [testData.historyQueries.list[0].items[0].id] };
    ctx.app.historyQueryService.deleteHistoryQueryItems.mockImplementationOnce(() => {
      throw new Error('delete history query items error');
    });

    await historyQueryController.deleteHistoryQueryItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('delete history query items error');
  });
});
