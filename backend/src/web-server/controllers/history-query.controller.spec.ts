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

  it('start() should enable History query', async () => {
    ctx.params.id = testData.historyQueries.list[0].id;

    await historyQueryController.startHistoryQuery(ctx);

    expect(ctx.app.historyQueryService.startHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
  });

  it('pauseHistoryQuery() should pause History query', async () => {
    ctx.params.id = testData.historyQueries.list[0].id;

    await historyQueryController.pauseHistoryQuery(ctx);

    expect(ctx.app.historyQueryService.pauseHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
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

  it('deleteHistoryQuery() should delete history query', async () => {
    ctx.params.id = testData.historyQueries.list[0].id;

    await historyQueryController.deleteHistoryQuery(ctx);

    expect(ctx.app.historyQueryService.deleteHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('searchSouthItems() should return South items', async () => {
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

  it('searchSouthItems() should return South items with default search params', async () => {
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

  it('deleteAllItems() should delete all South items', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;

    await historyQueryController.deleteAllItems(ctx);

    expect(ctx.app.historyQueryService.deleteAllItemsForHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('historySouthItemsToCsv() should download a csv file', async () => {
    ctx.params.southType = testData.south.list[0].type;
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

  it('exportSouthItems() should download a csv file', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.app.historyQueryService.findById.mockReturnValueOnce(testData.historyQueries.list[0]);
    (itemToFlattenedCSV as jest.Mock).mockReturnValue('csv content');
    ctx.request.body = { delimiter: ';' };

    await historyQueryController.exportSouthItems(ctx);

    expect(ctx.ok).toHaveBeenCalledWith();
    expect(ctx.body).toEqual('csv content');
  });

  it('checkImportSouthItems() should check import of items in a csv file with new history', async () => {
    ctx.params.historyQueryId = testData.historyQueries.list[0].id;
    ctx.params.southType = testData.historyQueries.list[0].southType;
    ctx.request.body = { delimiter: ',', currentItems: '[]' };
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.app.historyQueryService.checkCsvImport.mockReturnValueOnce({ items: testData.historyQueries.list[0].items, errors: [] });

    await historyQueryController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(ctx.app.historyQueryService.checkCsvImport).toHaveBeenCalledWith(
      testData.historyQueries.list[0].southType,
      ctx.request.file,
      ctx.request.body.delimiter,
      JSON.parse(ctx.request.body.currentItems)
    );
    expect(ctx.ok).toHaveBeenCalledWith({ items: testData.historyQueries.list[0].items, errors: [] });
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

  it('testSouthConnection() should test South connector settings', async () => {
    ctx.params.id = testData.historyQueries.list[0].id;
    ctx.request.body = testData.south.command;
    ctx.app.logger.child = jest.fn().mockImplementation(() => logger);

    await historyQueryController.testSouthConnection(ctx);

    expect(ctx.app.historyQueryService.testSouth).toHaveBeenCalledWith(testData.historyQueries.list[0].id, testData.south.command, logger);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testNorthConnection() should test North connector settings', async () => {
    ctx.params.id = testData.historyQueries.list[0].id;
    ctx.request.body = testData.north.command;
    ctx.app.logger.child = jest.fn().mockImplementation(() => logger);

    await historyQueryController.testNorthConnection(ctx);

    expect(ctx.app.historyQueryService.testNorth).toHaveBeenCalledWith(testData.historyQueries.list[0].id, testData.north.command, logger);
    expect(ctx.noContent).toHaveBeenCalled();
  });
});
