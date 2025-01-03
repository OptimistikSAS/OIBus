import HistoryQueryConnectorController from './history-query.controller';

import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import { historyQuerySchema } from './validators/oibus-validation-schema';
import testData from '../../tests/utils/test-data';
import {
  toHistoryQueryDTO,
  toHistoryQueryLightDTO,
  toNorthHistoryQueryItemDTO,
  toSouthHistoryQueryItemDTO
} from '../../service/history-query.service';
import { northItemToFlattenedCSV, southItemToFlattenedCSV } from '../../service/utils';
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

    await historyQueryController.testSouthHistoryQueryItem(ctx);

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

    await historyQueryController.testSouthHistoryQueryItem(ctx);

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

  it('searchSouthHistoryQueryItems() should return South items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.query = {
      page: 1,
      name: 'name'
    };
    const searchParams = {
      page: 1,
      name: 'name'
    };
    ctx.app.historyQueryService.searchSouthHistoryQueryItems.mockReturnValue({
      content: testData.historyQueries.list[0].southItems.map(item =>
        toSouthHistoryQueryItemDTO(item, testData.historyQueries.list[0].southType, ctx.app.encryptionService)
      ),
      totalElements: testData.historyQueries.list[0].southItems.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);

    await historyQueryController.searchSouthHistoryQueryItems(ctx);

    expect(ctx.app.historyQueryService.findById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.app.historyQueryService.searchSouthHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, searchParams);
    expect(ctx.ok).toHaveBeenCalledWith({
      content: testData.historyQueries.list[0].southItems.map(item =>
        toSouthHistoryQueryItemDTO(item, testData.historyQueries.list[0].southType, ctx.app.encryptionService)
      ),
      totalElements: testData.historyQueries.list[0].southItems.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
  });

  it('searchSouthHistoryQueryItems() should return South items with default search params', async () => {
    ctx.params.historyQueryId = 'id';
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.query = {};
    const searchParams = {
      page: 0
    };
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    ctx.app.historyQueryService.searchSouthHistoryQueryItems.mockReturnValue({
      content: testData.historyQueries.list[0].southItems.map(item =>
        toSouthHistoryQueryItemDTO(item, testData.historyQueries.list[0].southType, ctx.app.encryptionService)
      ),
      totalElements: testData.historyQueries.list[0].southItems.length,
      size: 25,
      number: 1,
      totalPages: 1
    });

    await historyQueryController.searchSouthHistoryQueryItems(ctx);

    expect(ctx.app.historyQueryService.findById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.app.historyQueryService.searchSouthHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, searchParams);
    expect(ctx.ok).toHaveBeenCalledWith({
      content: testData.historyQueries.list[0].southItems.map(item =>
        toSouthHistoryQueryItemDTO(item, testData.historyQueries.list[0].southType, ctx.app.encryptionService)
      ),
      totalElements: testData.historyQueries.list[0].southItems.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
  });

  it('searchSouthHistoryQueryItems() should return not found if history query is not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(null);

    await historyQueryController.searchSouthHistoryQueryItems(ctx);

    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getSouthHistoryQueryItem() should return item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].southItems[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    ctx.app.historyQueryService.findSouthHistoryQueryItem.mockReturnValueOnce(testData.historyQueries.list[0].southItems[0]);

    await historyQueryController.getSouthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.findSouthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].southItems[0].id
    );
    expect(ctx.ok).toHaveBeenCalledWith(testData.historyQueries.list[0].southItems[0]);
  });

  it('getSouthHistoryQueryItem() should return not found if history query is not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(null);

    await historyQueryController.getSouthHistoryQueryItem(ctx);

    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getSouthHistoryQueryItem() should return not found when South item not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].southItems[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    ctx.app.historyQueryService.findSouthHistoryQueryItem.mockReturnValueOnce(null);

    await historyQueryController.getSouthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.findSouthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].southItems[0].id
    );
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createSouthHistoryQueryItem() should create item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = testData.historyQueries.southItemCommand;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    ctx.app.historyQueryService.createSouthHistoryQueryItem.mockReturnValueOnce(testData.historyQueries.list[0].southItems[0]);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([
      { ...testData.south.manifest, id: testData.historyQueries.list[0].southType }
    ]);

    await historyQueryController.createSouthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.createSouthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.southItemCommand
    );
    expect(ctx.created).toHaveBeenCalledWith(
      toSouthHistoryQueryItemDTO(
        testData.historyQueries.list[0].southItems[0],
        testData.historyQueries.list[0].southType,
        ctx.app.encryptionService
      )
    );
  });

  it('createSouthHistoryQueryItem() should return not found if history query is not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = testData.historyQueries.southItemCommand;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(null);
    await historyQueryController.createSouthHistoryQueryItem(ctx);

    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('createSouthHistoryQueryItem() should return bad request on item creation error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = testData.historyQueries.southItemCommand;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);

    ctx.app.historyQueryService.createSouthHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('create error');
    });
    await historyQueryController.createSouthHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('create error');
  });

  it('updateSouthHistoryQueryItem() should update item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].southItems[0].id;
    ctx.request.body = testData.historyQueries.southItemCommand;

    await historyQueryController.updateSouthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.updateSouthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].southItems[0].id,
      testData.historyQueries.southItemCommand
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateSouthHistoryQueryItem() should return bad request on item update error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].southItems[0].id;
    ctx.request.body = testData.historyQueries.southItemCommand;

    ctx.app.historyQueryService.updateSouthHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('update error');
    });
    await historyQueryController.updateSouthHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('update error');
  });

  it('deleteSouthHistoryQueryItem() should delete item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].southItems[0].id;

    await historyQueryController.deleteSouthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.deleteSouthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].southItems[0].id
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteSouthHistoryQueryItem() should return bad request on item delete error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].southItems[0].id;

    ctx.app.historyQueryService.deleteSouthHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('delete error');
    });
    await historyQueryController.deleteSouthHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('delete error');
  });

  it('enableSouthHistoryQueryItem() should enable History item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].southItems[0].id;

    await historyQueryController.enableSouthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.enableSouthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].southItems[0].id
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('enableSouthHistoryQueryItem() should return bad request on item enable error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].southItems[0].id;

    ctx.app.historyQueryService.enableSouthHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('enable error');
    });
    await historyQueryController.enableSouthHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('enable error');
  });

  it('disableSouthHistoryQueryItem() should disable History item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].southItems[0].id;

    await historyQueryController.disableSouthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.disableSouthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].southItems[0].id
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('disableSouthHistoryQueryItem() should return bad request on item disable error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].southItems[0].id;

    ctx.app.historyQueryService.disableSouthHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('disable error');
    });
    await historyQueryController.disableSouthHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('disable error');
  });

  it('deleteAllSouthItems() should delete all South items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;

    await historyQueryController.deleteAllSouthItems(ctx);

    expect(ctx.app.historyQueryService.deleteAllSouthItemsForHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteAllSouthItems() should return bad request on delete all item error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].southItems[0].id;

    ctx.app.historyQueryService.deleteAllSouthItemsForHistoryQuery.mockImplementationOnce(() => {
      throw new Error('delete all error');
    });
    await historyQueryController.deleteAllSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('delete all error');
  });

  it('historyQuerySouthItemsToCsv() should download a csv file', async () => {
    ctx.params.southType = testData.historyQueries.list[0].southType;
    ctx.request.body = {
      items: testData.historyQueries.list[0].southItems,
      delimiter: ';'
    };
    (southItemToFlattenedCSV as jest.Mock).mockReturnValue('csv content');
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([
      { ...testData.south.manifest, id: testData.historyQueries.list[0].southType }
    ]);

    await historyQueryController.historyQuerySouthItemsToCsv(ctx);

    expect(ctx.ok).toHaveBeenCalledWith();
    expect(ctx.body).toEqual('csv content');
  });

  it('historyQuerySouthItemsToCsv() should throw not found if manifest not found', async () => {
    ctx.params.southType = 'bad type';
    ctx.request.body = {
      items: testData.historyQueries.list[0].southItems,
      delimiter: ';'
    };
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([]);

    await historyQueryController.historyQuerySouthItemsToCsv(ctx);

    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('exportSouthItems() should download a csv file', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    (southItemToFlattenedCSV as jest.Mock).mockReturnValue('csv content');
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
    ctx.app.historyQueryService.checkSouthCsvFileImport.mockReturnValueOnce({
      items: testData.historyQueries.list[0].southItems,
      errors: []
    });

    await historyQueryController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(ctx.app.historyQueryService.checkSouthCsvFileImport).toHaveBeenCalledWith(
      testData.historyQueries.list[0].southType,
      ctx.request.file,
      ctx.request.body.delimiter,
      JSON.parse(ctx.request.body.currentItems)
    );
    expect(ctx.ok).toHaveBeenCalledWith({ items: testData.historyQueries.list[0].southItems, errors: [] });
  });

  it('checkImportSouthItems() should return bad request if check csv import fails', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.southType = testData.historyQueries.list[0].southType;
    ctx.request.body = { delimiter: ',', currentItems: '[]' };
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.app.historyQueryService.checkSouthCsvFileImport.mockImplementationOnce(() => {
      throw new Error('check import error');
    });

    await historyQueryController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('check import error');
  });

  it('importSouthItems() should import items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = { items: testData.historyQueries.list[0].southItems };

    await historyQueryController.importSouthItems(ctx);
    expect(ctx.app.historyQueryService.importSouthItems).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].southItems
    );
  });

  it('importSouthItems() should import items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = { items: testData.historyQueries.list[0].southItems };
    ctx.app.historyQueryService.importSouthItems.mockImplementationOnce(() => {
      throw new Error('import items error');
    });

    await historyQueryController.importSouthItems(ctx);
    expect(ctx.app.historyQueryService.importSouthItems).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].southItems
    );
    expect(ctx.badRequest).toHaveBeenCalledWith('import items error');
  });

  it('searchNorthHistoryQueryItems() should return North items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.query = {
      page: 1,
      name: 'name'
    };
    const searchParams = {
      page: 1,
      name: 'name'
    };
    ctx.app.historyQueryService.searchNorthHistoryQueryItems.mockReturnValue({
      content: testData.historyQueries.list[0].northItems.map(item =>
        toNorthHistoryQueryItemDTO(item, testData.historyQueries.list[0].northType, ctx.app.encryptionService)
      ),
      totalElements: testData.historyQueries.list[0].northItems.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);

    await historyQueryController.searchNorthHistoryQueryItems(ctx);

    expect(ctx.app.historyQueryService.findById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.app.historyQueryService.searchNorthHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, searchParams);
    expect(ctx.ok).toHaveBeenCalledWith({
      content: testData.historyQueries.list[0].northItems.map(item =>
        toNorthHistoryQueryItemDTO(item, testData.historyQueries.list[0].northType, ctx.app.encryptionService)
      ),
      totalElements: testData.historyQueries.list[0].northItems.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
  });

  it('searchNorthHistoryQueryItems() should return North items with default search params', async () => {
    ctx.params.historyQueryId = 'id';
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.query = {};
    const searchParams = {
      page: 0
    };
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    ctx.app.historyQueryService.searchNorthHistoryQueryItems.mockReturnValue({
      content: testData.historyQueries.list[0].northItems.map(item =>
        toNorthHistoryQueryItemDTO(item, testData.historyQueries.list[0].northType, ctx.app.encryptionService)
      ),
      totalElements: testData.historyQueries.list[0].northItems.length,
      size: 25,
      number: 1,
      totalPages: 1
    });

    await historyQueryController.searchNorthHistoryQueryItems(ctx);

    expect(ctx.app.historyQueryService.findById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.app.historyQueryService.searchNorthHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, searchParams);
    expect(ctx.ok).toHaveBeenCalledWith({
      content: testData.historyQueries.list[0].northItems.map(item =>
        toNorthHistoryQueryItemDTO(item, testData.historyQueries.list[0].northType, ctx.app.encryptionService)
      ),
      totalElements: testData.historyQueries.list[0].northItems.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
  });

  it('searchNorthHistoryQueryItems() should return not found if history query is not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(null);

    await historyQueryController.searchNorthHistoryQueryItems(ctx);

    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getNorthHistoryQueryItem() should return item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].northItems[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    ctx.app.historyQueryService.findNorthHistoryQueryItem.mockReturnValueOnce(testData.historyQueries.list[0].northItems[0]);

    await historyQueryController.getNorthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.findNorthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].northItems[0].id
    );
    expect(ctx.ok).toHaveBeenCalledWith(testData.historyQueries.list[0].northItems[0]);
  });

  it('getNorthHistoryQueryItem() should return not found if history query is not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(null);

    await historyQueryController.getNorthHistoryQueryItem(ctx);

    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getNorthHistoryQueryItem() should return not found when North item not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].northItems[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    ctx.app.historyQueryService.findNorthHistoryQueryItem.mockReturnValueOnce(null);

    await historyQueryController.getNorthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.findNorthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].northItems[0].id
    );
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createNorthHistoryQueryItem() should create item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = testData.historyQueries.northItemCommand;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    ctx.app.historyQueryService.createNorthHistoryQueryItem.mockReturnValueOnce(testData.historyQueries.list[0].northItems[0]);
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([
      { ...testData.north.manifest, id: testData.historyQueries.list[0].northType }
    ]);

    await historyQueryController.createNorthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.createNorthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.northItemCommand
    );
    expect(ctx.created).toHaveBeenCalledWith(
      toNorthHistoryQueryItemDTO(
        testData.historyQueries.list[0].northItems[0],
        testData.historyQueries.list[0].northType,
        ctx.app.encryptionService
      )
    );
  });

  it('createNorthHistoryQueryItem() should return not found if history query is not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = testData.historyQueries.northItemCommand;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(null);
    await historyQueryController.createNorthHistoryQueryItem(ctx);

    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('createNorthHistoryQueryItem() should return bad request on item creation error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = testData.historyQueries.northItemCommand;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);

    ctx.app.historyQueryService.createNorthHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('create error');
    });
    await historyQueryController.createNorthHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('create error');
  });

  it('updateNorthHistoryQueryItem() should update item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].northItems[0].id;
    ctx.request.body = testData.historyQueries.northItemCommand;

    await historyQueryController.updateNorthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.updateNorthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].northItems[0].id,
      testData.historyQueries.northItemCommand
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateNorthHistoryQueryItem() should return bad request on item update error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].northItems[0].id;
    ctx.request.body = testData.historyQueries.northItemCommand;

    ctx.app.historyQueryService.updateNorthHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('update error');
    });
    await historyQueryController.updateNorthHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('update error');
  });

  it('deleteNorthHistoryQueryItem() should delete item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].northItems[0].id;

    await historyQueryController.deleteNorthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.deleteNorthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].northItems[0].id
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteNorthHistoryQueryItem() should return bad request on item delete error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].northItems[0].id;

    ctx.app.historyQueryService.deleteNorthHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('delete error');
    });
    await historyQueryController.deleteNorthHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('delete error');
  });

  it('enableNorthHistoryQueryItem() should enable History item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].northItems[0].id;

    await historyQueryController.enableNorthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.enableNorthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].northItems[0].id
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('enableNorthHistoryQueryItem() should return bad request on item enable error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].northItems[0].id;

    ctx.app.historyQueryService.enableNorthHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('enable error');
    });
    await historyQueryController.enableNorthHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('enable error');
  });

  it('disableNorthHistoryQueryItem() should disable History item', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].northItems[0].id;

    await historyQueryController.disableNorthHistoryQueryItem(ctx);

    expect(ctx.app.historyQueryService.disableNorthHistoryQueryItem).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].northItems[0].id
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('disableNorthHistoryQueryItem() should return bad request on item disable error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].northItems[0].id;

    ctx.app.historyQueryService.disableNorthHistoryQueryItem.mockImplementationOnce(() => {
      throw new Error('disable error');
    });
    await historyQueryController.disableNorthHistoryQueryItem(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('disable error');
  });

  it('deleteAllNorthItems() should delete all North items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;

    await historyQueryController.deleteAllNorthItems(ctx);

    expect(ctx.app.historyQueryService.deleteAllNorthItemsForHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteAllNorthItems() should return bad request on delete all item error', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.id = testData.historyQueries.list[0].northItems[0].id;

    ctx.app.historyQueryService.deleteAllNorthItemsForHistoryQuery.mockImplementationOnce(() => {
      throw new Error('delete all error');
    });
    await historyQueryController.deleteAllNorthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('delete all error');
  });

  it('historyQueryNorthItemsToCsv() should download a csv file', async () => {
    ctx.params.northType = testData.historyQueries.list[0].northType;
    ctx.request.body = {
      items: testData.historyQueries.list[0].northItems,
      delimiter: ';'
    };
    (northItemToFlattenedCSV as jest.Mock).mockReturnValue('csv content');
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([
      { ...testData.north.manifest, id: testData.historyQueries.list[0].northType }
    ]);

    await historyQueryController.historyQueryNorthItemsToCsv(ctx);

    expect(ctx.ok).toHaveBeenCalledWith();
    expect(ctx.body).toEqual('csv content');
  });

  it('historyQueryNorthItemsToCsv() should throw not found if manifest not found', async () => {
    ctx.params.northType = 'bad type';
    ctx.request.body = {
      items: testData.historyQueries.list[0].northItems,
      delimiter: ';'
    };
    ctx.app.northService.getInstalledNorthManifests.mockReturnValueOnce([]);

    await historyQueryController.historyQueryNorthItemsToCsv(ctx);

    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('exportNorthItems() should download a csv file', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    (northItemToFlattenedCSV as jest.Mock).mockReturnValue('csv content');
    ctx.request.body = { delimiter: ';' };

    await historyQueryController.exportNorthItems(ctx);

    expect(ctx.ok).toHaveBeenCalledWith();
    expect(ctx.body).toEqual('csv content');
  });

  it('exportNorthItems() should return not found if history query not found', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(null);
    ctx.request.body = { delimiter: ';' };

    await historyQueryController.exportNorthItems(ctx);

    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('checkImportNorthItems() should check import of items in a csv file with new history', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.northType = testData.historyQueries.list[0].northType;
    ctx.request.body = { delimiter: ',', currentItems: '[]' };
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.app.historyQueryService.checkNorthCsvFileImport.mockReturnValueOnce({
      items: testData.historyQueries.list[0].northItems,
      errors: []
    });

    await historyQueryController.checkImportNorthItems(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(ctx.app.historyQueryService.checkNorthCsvFileImport).toHaveBeenCalledWith(
      testData.historyQueries.list[0].northType,
      ctx.request.file,
      ctx.request.body.delimiter,
      JSON.parse(ctx.request.body.currentItems)
    );
    expect(ctx.ok).toHaveBeenCalledWith({ items: testData.historyQueries.list[0].northItems, errors: [] });
  });

  it('checkImportNorthItems() should return bad request if check csv import fails', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.northType = testData.historyQueries.list[0].northType;
    ctx.request.body = { delimiter: ',', currentItems: '[]' };
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.app.historyQueryService.checkNorthCsvFileImport.mockImplementationOnce(() => {
      throw new Error('check import error');
    });

    await historyQueryController.checkImportNorthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('check import error');
  });

  it('importNorthItems() should import items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = { items: testData.historyQueries.list[0].northItems };

    await historyQueryController.importNorthItems(ctx);
    expect(ctx.app.historyQueryService.importNorthItems).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].northItems
    );
  });

  it('importNorthItems() should import items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.request.body = { items: testData.historyQueries.list[0].northItems };
    ctx.app.historyQueryService.importNorthItems.mockImplementationOnce(() => {
      throw new Error('import items error');
    });

    await historyQueryController.importNorthItems(ctx);
    expect(ctx.app.historyQueryService.importNorthItems).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].northItems
    );
    expect(ctx.badRequest).toHaveBeenCalledWith('import items error');
  });
});
