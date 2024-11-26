import HistoryQueryConnectorController from './history-query.controller';

import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import { historyQuerySchema } from './validators/oibus-validation-schema';
import testData from '../../tests/utils/test-data';
import { toHistoryQueryDTO, toHistoryQueryItemDTO, toHistoryQueryLightDTO } from '../../service/history-query.service';
import { itemToFlattenedCSV } from '../../service/utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';

jest.mock('node:fs/promises');
jest.mock('./validators/joi.validator');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();
const ctx = new KoaContextMock();
const validator = new JoiValidator();
const historyQueryController = new HistoryQueryConnectorController(validator, historyQuerySchema);

describe('History query controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  it('findAll() should return history queries', async () => {
    ctx.app.historyQueryService.findAll.mockReturnValueOnce(testData.historyQueries.list);

    await historyQueryController.findAll(ctx);

    expect(ctx.ok).toHaveBeenCalledWith(testData.historyQueries.list.map(element => toHistoryQueryLightDTO(element)));
  });

  it('findById() should return history query', async () => {
    ctx.params.id = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);

    await historyQueryController.findById(ctx);

    expect(ctx.app.historyQueryService.findById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.ok).toHaveBeenCalledWith(toHistoryQueryDTO(testData.historyQueries.list[0], ctx.app.encryptionService));
  });

  it('findById() should return not found when history query is not found', async () => {
    ctx.params.id = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(null);

    await historyQueryController.findById(ctx);

    expect(ctx.app.historyQueryService.findById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('create() should create History query with new connectors', async () => {
    ctx.request.body = testData.historyQueries.command;

    (ctx.app.historyQueryService.createHistoryQuery as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    await historyQueryController.createHistoryQuery(ctx);

    expect(ctx.created).toHaveBeenCalledWith(toHistoryQueryDTO(testData.historyQueries.list[0], ctx.app.encryptionService));
  });

  it('create() should throw bad request on create error', async () => {
    ctx.request.body = testData.historyQueries.command;

    (ctx.app.historyQueryService.createHistoryQuery as jest.Mock).mockImplementationOnce(() => {
      throw new Error('create error');
    });
    await historyQueryController.createHistoryQuery(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('create error');
  });

  it('start() should enable History query', async () => {
    ctx.params.id = testData.historyQueries.list[0].id;

    await historyQueryController.startHistoryQuery(ctx);

    expect(ctx.app.historyQueryService.startHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
  });

  it('start() should throw bad request on start error', async () => {
    ctx.request.id = testData.historyQueries.list[0].id;

    (ctx.app.historyQueryService.startHistoryQuery as jest.Mock).mockImplementationOnce(() => {
      throw new Error('start error');
    });
    await historyQueryController.startHistoryQuery(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('start error');
  });

  it('pauseHistoryQuery() should pause History query', async () => {
    ctx.params.id = testData.historyQueries.list[0].id;

    await historyQueryController.pauseHistoryQuery(ctx);

    expect(ctx.app.historyQueryService.pauseHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
  });

  it('pause() should throw bad request on pause error', async () => {
    ctx.request.id = testData.historyQueries.list[0].id;
    ctx.request.body = testData.south.command;

    (ctx.app.historyQueryService.pauseHistoryQuery as jest.Mock).mockImplementationOnce(() => {
      throw new Error('pause error');
    });
    await historyQueryController.pauseHistoryQuery(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('pause error');
  });

  it('testSouthConnection() should test south connection', async () => {
    ctx.request.body = testData.south.command;
    ctx.params.id = testData.historyQueries.list[0].id;

    ctx.app.logger.child.mockReturnValueOnce(logger);

    await historyQueryController.testSouthConnection(ctx);

    expect(ctx.app.historyQueryService.testSouth).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      null,
      testData.south.command,
      logger
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testSouthConnection() should return bad request', async () => {
    ctx.request.body = testData.south.command;
    ctx.params.id = testData.historyQueries.list[0].id;
    ctx.query.fromSouth = testData.south.list[0].id;

    ctx.app.logger.child.mockReturnValueOnce(logger);
    ctx.app.historyQueryService.testSouth.mockImplementationOnce(() => {
      throw new Error('test error');
    });

    await historyQueryController.testSouthConnection(ctx);

    expect(ctx.app.historyQueryService.testSouth).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.south.list[0].id,
      testData.south.command,
      logger
    );
    expect(ctx.badRequest).toHaveBeenCalledWith('test error');
  });

  it('testHistoryQueryItem() should test south item', async () => {
    ctx.request.body = {
      south: testData.south.command,
      item: testData.south.itemCommand,
      testingSettings: testData.south.itemTestingSettings
    };
    ctx.params.id = testData.historyQueries.list[0].id;
    ctx.query.fromSouth = null;

    ctx.app.logger.child.mockReturnValueOnce(logger);

    await historyQueryController.testHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.testSouthItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      null,
      testData.south.command,
      testData.south.itemCommand,
      testData.south.itemTestingSettings,
      ctx.ok,
      logger
    );
  });

  it('testHistoryQueryItem() should return bad request', async () => {
    ctx.request.body = {
      south: testData.south.command,
      item: testData.south.itemCommand,
      testingSettings: testData.south.itemTestingSettings
    };
    ctx.params.id = testData.historyQueries.list[0].id;
    ctx.query.fromSouth = testData.south.list[0].id;

    ctx.app.logger.child.mockReturnValueOnce(logger);
    ctx.app.historyQueryService.testSouthItem.mockImplementationOnce(() => {
      throw new Error('test error');
    });

    await historyQueryController.testHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.testSouthItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.south.list[0].id,
      testData.south.command,
      testData.south.itemCommand,
      testData.south.itemTestingSettings,
      ctx.ok,
      logger
    );
    expect(ctx.badRequest).toHaveBeenCalledWith('test error');
  });

  it('testNorthConnection() should test north connection', async () => {
    ctx.request.body = testData.north.command;
    ctx.params.id = testData.historyQueries.list[0].id;

    ctx.app.logger.child.mockReturnValueOnce(logger);

    await historyQueryController.testNorthConnection(ctx);

    expect(ctx.app.historyQueryService.testNorth).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      null,
      testData.north.command,
      logger
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testNorthConnection() should return bad request', async () => {
    ctx.request.body = testData.north.command;
    ctx.params.id = testData.historyQueries.list[0].id;
    ctx.query.fromNorth = testData.north.list[0].id;

    ctx.app.logger.child.mockReturnValueOnce(logger);
    ctx.app.historyQueryService.testNorth.mockImplementationOnce(() => {
      throw new Error('test error');
    });

    await historyQueryController.testNorthConnection(ctx);

    expect(ctx.app.historyQueryService.testNorth).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.north.list[0].id,
      testData.north.command,
      logger
    );
    expect(ctx.badRequest).toHaveBeenCalledWith('test error');
  });

  it('update() should update History Query', async () => {
    ctx.request.body = testData.historyQueries.command;
    ctx.params.id = testData.historyQueries.list[0].id;

    await historyQueryController.updateHistoryQuery(ctx);

    expect(ctx.app.historyQueryService.updateHistoryQuery).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.command,
      false
    );

    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('update() should throw bad request on update error', async () => {
    ctx.request.body = testData.historyQueries.command;

    (ctx.app.historyQueryService.updateHistoryQuery as jest.Mock).mockImplementationOnce(() => {
      throw new Error('update error');
    });
    await historyQueryController.updateHistoryQuery(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('update error');
  });

  it('deleteHistoryQuery() should delete history query', async () => {
    ctx.params.id = testData.historyQueries.list[0].id;

    await historyQueryController.deleteHistoryQuery(ctx);

    expect(ctx.app.historyQueryService.deleteHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('delete() should throw bad request on delete error', async () => {
    ctx.request.body = testData.historyQueries.command;

    (ctx.app.historyQueryService.deleteHistoryQuery as jest.Mock).mockImplementationOnce(() => {
      throw new Error('delete error');
    });
    await historyQueryController.deleteHistoryQuery(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('delete error');
  });

  it('searchHistoryQueryItems() should return South items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.query = {
      page: 1,
      name: 'name'
    };
    const searchParams = {
      page: 1,
      name: 'name'
    };
    ctx.app.historyQueryService.searchHistoryQueryItems.mockReturnValue({
      content: testData.historyQueries.list[0].items.map(item =>
        toHistoryQueryItemDTO(item, testData.historyQueries.list[0].southType, ctx.app.encryptionService)
      ),
      totalElements: testData.historyQueries.list[0].items.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);

    await historyQueryController.searchHistoryQueryItems(ctx);

    expect(ctx.app.historyQueryService.findById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.app.historyQueryService.searchHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, searchParams);
    expect(ctx.ok).toHaveBeenCalledWith({
      content: testData.historyQueries.list[0].items.map(item =>
        toHistoryQueryItemDTO(item, testData.historyQueries.list[0].southType, ctx.app.encryptionService)
      ),
      totalElements: testData.historyQueries.list[0].items.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
  });

  it('searchHistoryQueryItems() should return South items with default search params', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.query = {};
    const searchParams = {
      page: 0
    };
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    ctx.app.historyQueryService.searchHistoryQueryItems.mockReturnValue({
      content: testData.historyQueries.list[0].items.map(item =>
        toHistoryQueryItemDTO(item, testData.historyQueries.list[0].southType, ctx.app.encryptionService)
      ),
      totalElements: testData.historyQueries.list[0].items.length,
      size: 25,
      number: 1,
      totalPages: 1
    });

    await historyQueryController.searchHistoryQueryItems(ctx);

    expect(ctx.app.historyQueryService.findById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.app.historyQueryService.searchHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, searchParams);
    expect(ctx.ok).toHaveBeenCalledWith({
      content: testData.historyQueries.list[0].items.map(item =>
        toHistoryQueryItemDTO(item, testData.historyQueries.list[0].southType, ctx.app.encryptionService)
      ),
      totalElements: testData.historyQueries.list[0].items.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
  });

  it('searchHistoryQueryItems() should return not found if history query is not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(null);

    await historyQueryController.searchHistoryQueryItems(ctx);

    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getHistoryItem() should return item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].items[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    ctx.app.historyQueryService.findHistoryQueryItem.mockReturnValueOnce(testData.historyQueries.list[0].items[0]);

    await historyQueryController.getHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.findHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    );
    expect(ctx.ok).toHaveBeenCalledWith(testData.historyQueries.list[0].items[0]);
  });

  it('getHistoryItem() should return not found if history query is not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(null);

    await historyQueryController.getHistoryQueryItem(ctx);

    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getHistoryItem() should return not found when South item not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].items[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    ctx.app.historyQueryService.findHistoryQueryItem.mockReturnValueOnce(null);

    await historyQueryController.getHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.findHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    );
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createHistoryQueryItem() should create item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = testData.historyQueries.itemCommand;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    ctx.app.historyQueryService.createHistoryQueryItem.mockReturnValueOnce(testData.historyQueries.list[0].items[0]);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([
      { ...testData.south.manifest, id: testData.historyQueries.list[0].southType }
    ]);

    await historyQueryController.createHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.createHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.itemCommand
    );
    expect(ctx.created).toHaveBeenCalledWith(
      toHistoryQueryItemDTO(testData.historyQueries.list[0].items[0], testData.historyQueries.list[0].southType, ctx.app.encryptionService)
    );
  });

  it('createHistoryQueryItem() should return not found if history query is not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = testData.historyQueries.itemCommand;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(null);
    await historyQueryController.createHistoryQueryItem(ctx);

    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('createHistoryQueryItem() should return bad request on item creation error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = testData.historyQueries.itemCommand;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);

    ctx.app.historyQueryService.createHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('create error');
    });
    await historyQueryController.createHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('create error');
  });

  it('updateHistoryQueryItem() should update item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].items[0].id;
    ctx.request.body = testData.historyQueries.itemCommand;

    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.updateHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id,
      testData.historyQueries.itemCommand
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateHistoryQueryItem() should return bad request on item update error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].items[0].id;
    ctx.request.body = testData.historyQueries.itemCommand;

    ctx.app.historyQueryService.updateHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('update error');
    });
    await historyQueryController.updateHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('update error');
  });

  it('deleteHistoryQueryItem() should delete item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].items[0].id;

    await historyQueryController.deleteHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.deleteHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteHistoryQueryItem() should return bad request on item delete error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].items[0].id;

    ctx.app.historyQueryService.deleteHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('delete error');
    });
    await historyQueryController.deleteHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('delete error');
  });

  it('enableHistoryQueryItem() should enable History item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].items[0].id;

    await historyQueryController.enableHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.enableHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('enableHistoryQueryItem() should return bad request on item enable error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].items[0].id;

    ctx.app.historyQueryService.enableHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('enable error');
    });
    await historyQueryController.enableHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('enable error');
  });

  it('disableHistoryQueryItem() should disable History item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].items[0].id;

    await historyQueryController.disableHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.disableHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('disableHistoryQueryItem() should return bad request on item disable error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].items[0].id;

    ctx.app.historyQueryService.disableHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('disable error');
    });
    await historyQueryController.disableHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('disable error');
  });

  it('deleteAllItems() should delete all South items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;

    await historyQueryController.deleteAllItems(ctx);

    expect(ctx.app.historyQueryService.deleteAllItemsForHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteAllItems() should return bad request on delete all item error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].items[0].id;

    ctx.app.historyQueryService.deleteAllItemsForHistoryQuery.mockImplementationOnce(() => {
      throw new Error('delete all error');
    });
    await historyQueryController.deleteAllItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('delete all error');
  });

  it('historyQueryItemsToCsv() should download a csv file', async () => {
    ctx.params.southType = testData.historyQueries.list[0].southType;
    ctx.request.body = {
      items: testData.historyQueries.list[0].items,
      delimiter: ';'
    };
    (itemToFlattenedCSV as jest.Mock).mockReturnValue('csv content');
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([
      { ...testData.south.manifest, id: testData.historyQueries.list[0].southType }
    ]);

    await historyQueryController.historyQueryItemsToCsv(ctx);

    expect(ctx.ok).toHaveBeenCalledWith();
    expect(ctx.body).toEqual('csv content');
  });

  it('historyQueryItemsToCsv() should throw not found if manifest not found', async () => {
    ctx.params.southType = 'bad type';
    ctx.request.body = {
      items: testData.historyQueries.list[0].items,
      delimiter: ';'
    };
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([]);

    await historyQueryController.historyQueryItemsToCsv(ctx);

    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('exportSouthItems() should download a csv file', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    (itemToFlattenedCSV as jest.Mock).mockReturnValue('csv content');
    ctx.request.body = { delimiter: ';' };

    await historyQueryController.exportSouthItems(ctx);

    expect(ctx.ok).toHaveBeenCalledWith();
    expect(ctx.body).toEqual('csv content');
  });

  it('exportSouthItems() should return not found if history query not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(null);
    ctx.request.body = { delimiter: ';' };

    await historyQueryController.exportSouthItems(ctx);

    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('checkImportSouthItems() should check import of items in a csv file with new history', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.southType = testData.historyQueries.list[0].southType;
    ctx.request.body = { delimiter: ',', currentItems: '[]' };
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.app.historyQueryService.checkCsvFileImport.mockReturnValueOnce({ items: testData.historyQueries.list[0].items, errors: [] });

    await historyQueryController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(ctx.app.historyQueryService.checkCsvFileImport).toHaveBeenCalledWith(
      testData.historyQueries.list[0].southType,
      ctx.request.file,
      ctx.request.body.delimiter,
      JSON.parse(ctx.request.body.currentItems)
    );
    expect(ctx.ok).toHaveBeenCalledWith({ items: testData.historyQueries.list[0].items, errors: [] });
  });

  it('checkImportSouthItems() should return bad request if check csv import fails', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.southType = testData.historyQueries.list[0].southType;
    ctx.request.body = { delimiter: ',', currentItems: '[]' };
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.app.historyQueryService.checkCsvFileImport.mockImplementationOnce(() => {
      throw new Error('check import error');
    });

    await historyQueryController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('check import error');
  });

  it('importSouthItems() should import items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = { items: testData.historyQueries.list[0].items };

    await historyQueryController.importSouthItems(ctx);
    expect(ctx.app.historyQueryService.importItems).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items
    );
  });

  it('importSouthItems() should import items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = { items: testData.historyQueries.list[0].items };
    ctx.app.historyQueryService.importItems.mockImplementationOnce(() => {
      throw new Error('import items error');
    });

    await historyQueryController.importSouthItems(ctx);
    expect(ctx.app.historyQueryService.importItems).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items
    );
    expect(ctx.badRequest).toHaveBeenCalledWith('import items error');
  });
});
