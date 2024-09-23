import SouthConnectorController from './south-connector.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import testData from '../../tests/utils/test-data';
import { toSouthConnectorDTO, toSouthConnectorItemDTO, toSouthConnectorLightDTO } from '../../service/south.service';
import { itemToFlattenedCSV } from '../../service/utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';

jest.mock('node:fs/promises');
jest.mock('./validators/joi.validator');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();
const ctx = new KoaContextMock();
const validator = new JoiValidator();
const southConnectorController = new SouthConnectorController(validator);

describe('South connector controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('getSouthConnectorTypes() should return South connector types', async () => {
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([testData.south.manifest]);

    await southConnectorController.getSouthConnectorTypes(ctx);

    expect(ctx.ok).toHaveBeenCalledWith([
      {
        id: testData.south.manifest.id,
        category: testData.south.manifest.category,
        name: testData.south.manifest.name,
        description: testData.south.manifest.description,
        modes: testData.south.manifest.modes
      }
    ]);
  });

  it('getSouthConnectorManifest() should return South connector manifest', async () => {
    ctx.params.id = testData.south.manifest.id;
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([testData.south.manifest]);

    await southConnectorController.getSouthConnectorManifest(ctx);

    expect(ctx.ok).toHaveBeenCalledWith(testData.south.manifest);
  });

  it('getSouthConnectorManifest() should return not found', async () => {
    ctx.params.id = 'invalid';
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([testData.south.manifest]);

    await southConnectorController.getSouthConnectorManifest(ctx);

    expect(ctx.throw).toHaveBeenCalledWith(404, 'South not found');
  });

  it('findAll() should return South connectors', async () => {
    ctx.app.southService.findAll.mockReturnValue(testData.south.list);

    await southConnectorController.findAll(ctx);

    expect(ctx.app.southService.findAll).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith(testData.south.list.map(element => toSouthConnectorLightDTO(element)));
  });

  it('findById() should return South connector', async () => {
    ctx.params.id = testData.south.list[0].id;
    ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);

    await southConnectorController.findById(ctx);

    expect(ctx.app.southService.findById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(ctx.ok).toHaveBeenCalledWith(toSouthConnectorDTO(testData.south.list[0], ctx.app.encryptionService));
  });

  it('findById() should return not found when South connector not found', async () => {
    ctx.params.id = testData.south.list[0].id;
    ctx.app.southService.findById.mockReturnValueOnce(null);

    await southConnectorController.findById(ctx);

    expect(ctx.app.southService.findById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('create() should create South connector', async () => {
    ctx.request.body = testData.south.command;
    ctx.app.southService.createSouth.mockReturnValueOnce(testData.south.list[0]);

    await southConnectorController.createSouth(ctx);

    expect(ctx.app.southService.createSouth).toHaveBeenCalledWith(ctx.request.body);
    expect(ctx.created).toHaveBeenCalledWith(toSouthConnectorDTO(testData.south.list[0], ctx.app.encryptionService));
  });

  it('create() should return bad request', async () => {
    ctx.request.body = testData.south.command;
    ctx.app.southService.createSouth.mockImplementationOnce(() => {
      throw new Error('bad request');
    });

    await southConnectorController.createSouth(ctx);

    expect(ctx.app.southService.createSouth).toHaveBeenCalledWith(ctx.request.body);
    expect(ctx.created).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('update() should update South connector', async () => {
    ctx.request.body = testData.south.command;
    ctx.params.id = testData.south.list[0].id;

    await southConnectorController.updateSouth(ctx);

    expect(ctx.app.southService.updateSouth).toHaveBeenCalledWith(ctx.params.id, ctx.request.body);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('update() should return bad request', async () => {
    ctx.request.body = testData.south.command;
    ctx.params.id = testData.south.list[0].id;

    ctx.app.southService.updateSouth.mockImplementationOnce(() => {
      throw new Error('bad request');
    });

    await southConnectorController.updateSouth(ctx);

    expect(ctx.app.southService.updateSouth).toHaveBeenCalledWith(ctx.params.id, ctx.request.body);
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('delete() should delete South connector', async () => {
    ctx.params.id = testData.south.list[0].id;

    await southConnectorController.delete(ctx);

    expect(ctx.app.southService.deleteSouth).toHaveBeenCalledWith(ctx.params.id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('delete() should return bad request', async () => {
    ctx.params.id = testData.south.list[0].id;

    ctx.app.southService.deleteSouth.mockImplementationOnce(() => {
      throw new Error('bad request');
    });

    await southConnectorController.delete(ctx);

    expect(ctx.app.southService.deleteSouth).toHaveBeenCalledWith(ctx.params.id);
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('start() should enable South connector', async () => {
    ctx.params.id = 'id';

    await southConnectorController.start(ctx);

    expect(ctx.app.southService.startSouth).toHaveBeenCalledWith(ctx.params.id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('start() should return bad request', async () => {
    ctx.params.id = testData.south.list[0].id;

    ctx.app.southService.startSouth.mockImplementationOnce(() => {
      throw new Error('bad request');
    });

    await southConnectorController.start(ctx);

    expect(ctx.app.southService.startSouth).toHaveBeenCalledWith(ctx.params.id);
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('stop() should disable South connector', async () => {
    ctx.params.id = testData.south.list[0].id;

    await southConnectorController.stop(ctx);

    expect(ctx.app.southService.stopSouth).toHaveBeenCalledWith(ctx.params.id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('stop() should return bad request', async () => {
    ctx.params.id = testData.south.list[0].id;

    ctx.app.southService.stopSouth.mockImplementationOnce(() => {
      throw new Error('bad request');
    });

    await southConnectorController.stop(ctx);

    expect(ctx.app.southService.stopSouth).toHaveBeenCalledWith(ctx.params.id);
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('listSouthItems() should return all South items', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.app.southService.getSouthItems.mockReturnValue(testData.south.list[0].items);
    ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([{ ...testData.south.manifest, id: testData.south.list[0].type }]);

    await southConnectorController.listSouthItems(ctx);
    expect(ctx.app.southService.getSouthItems).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(ctx.ok).toHaveBeenCalledWith(testData.south.list[0].items);
  });

  it('searchSouthItems() should return South items', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.query = {
      page: 1,
      name: 'name'
    };
    const searchParams = {
      page: 1,
      name: 'name'
    };
    ctx.app.southService.searchSouthItems.mockReturnValue({
      content: testData.south.list[0].items.map(item =>
        toSouthConnectorItemDTO(item, testData.south.list[0].type, ctx.app.encryptionService)
      ),
      totalElements: testData.south.list[0].items.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
    ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([{ ...testData.south.manifest, id: testData.south.list[0].type }]);

    await southConnectorController.searchSouthItems(ctx);

    expect(ctx.app.southService.searchSouthItems).toHaveBeenCalledWith(testData.south.list[0].id, searchParams);
    expect(ctx.ok).toHaveBeenCalledWith({
      content: testData.south.list[0].items.map(item =>
        toSouthConnectorItemDTO(item, testData.south.list[0].type, ctx.app.encryptionService)
      ),
      totalElements: testData.south.list[0].items.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
  });

  it('getSouthItem() should return South item', async () => {
    ctx.params.id = testData.south.list[0].items[0].id;
    ctx.params.souhtId = testData.south.list[0].id;
    ctx.app.southService.findSouthConnectorItemById.mockReturnValue(testData.south.list[0].items[0]);
    ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([{ ...testData.south.manifest, id: testData.south.list[0].type }]);

    await southConnectorController.getSouthItem(ctx);

    expect(ctx.app.southService.findSouthConnectorItemById).toHaveBeenCalledWith(
      testData.south.list[0].id,
      testData.south.list[0].items[0].id
    );
    expect(ctx.ok).toHaveBeenCalledWith(testData.south.list[0].items[0]);
  });

  it('getSouthItem() should return not found when South item not found', async () => {
    ctx.params.id = testData.south.list[0].items[0].id;
    ctx.params.souhtId = testData.south.list[0].id;
    ctx.app.southService.findSouthConnectorItemById.mockReturnValue(null);
    ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([{ ...testData.south.manifest, id: testData.south.list[0].type }]);

    await southConnectorController.getSouthItem(ctx);

    expect(ctx.app.southService.findSouthConnectorItemById).toHaveBeenCalledWith(
      testData.south.list[0].id,
      testData.south.list[0].items[0].id
    );
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createSouthItem() should create South item', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.request.body = testData.south.itemCommand;
    ctx.app.southService.createItem.mockReturnValueOnce(testData.south.list[0].items[0]);
    ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([{ ...testData.south.manifest, id: testData.south.list[0].type }]);

    await southConnectorController.createSouthItem(ctx);

    expect(ctx.app.southService.createItem).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.itemCommand);
    expect(ctx.created).toHaveBeenCalledWith(testData.south.list[0].items[0]);
  });

  it('updateSouthItem() should update South item', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.params.id = testData.south.list[0].items[0].id;
    ctx.request.body = testData.south.itemCommand;

    await southConnectorController.updateSouthItem(ctx);

    expect(ctx.app.southService.updateItem).toHaveBeenCalledWith(
      testData.south.list[0].id,
      testData.south.list[0].items[0].id,
      testData.south.itemCommand
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteSouthItem() should delete South item', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.params.id = testData.south.list[0].items[0].id;

    await southConnectorController.deleteSouthItem(ctx);

    expect(ctx.app.southService.deleteItem).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('enableSouthItem() should enable South item', async () => {
    ctx.params.id = testData.south.list[0].items[0].id;
    ctx.params.southId = testData.south.list[0].id;

    await southConnectorController.enableSouthItem(ctx);

    expect(ctx.app.southService.enableItem).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('disableSouthItem() should disable South item', async () => {
    ctx.params.id = testData.south.list[0].items[0].id;
    ctx.params.southId = testData.south.list[0].id;

    await southConnectorController.disableSouthItem(ctx);

    expect(ctx.app.southService.disableItem).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteAllSouthItem() should delete all South items', async () => {
    ctx.params.southId = testData.south.list[0].id;

    await southConnectorController.deleteAllSouthItem(ctx);

    expect(ctx.app.southService.deleteAllItemsForSouthConnector).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('resetSouthMetrics() should reset South metrics', async () => {
    ctx.params.southId = testData.south.list[0].id;

    await southConnectorController.resetSouthMetrics(ctx);

    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('southItemsToCsv() should download a csv file', async () => {
    ctx.params.southType = testData.south.list[0].type;
    ctx.request.body = {
      items: testData.south.list[0].items,
      delimiter: ';'
    };
    (itemToFlattenedCSV as jest.Mock).mockReturnValue('csv content');
    ctx.app.scanModeService.findAll.mockReturnValueOnce(testData.scanMode.list);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([{ ...testData.south.manifest, id: testData.south.list[0].type }]);

    await southConnectorController.southConnectorItemsToCsv(ctx);

    expect(ctx.ok).toHaveBeenCalledWith();
    expect(ctx.body).toEqual('csv content');
  });

  it('exportSouthItems() should download a csv file', async () => {
    ctx.params.southId = testData.south.list[0].id;
    (itemToFlattenedCSV as jest.Mock).mockReturnValueOnce('csv content');
    ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);
    ctx.request.body = { delimiter: ';' };

    await southConnectorController.exportSouthItems(ctx);

    expect(ctx.ok).toHaveBeenCalledWith();
    expect(ctx.body).toEqual('csv content');
  });

  it('checkImportSouthItems() should check import of items in a csv file with new south', async () => {
    ctx.params.type = testData.south.list[0].type;
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body = { currentItems: '[]', delimiter: ',' };
    ctx.app.scanModeService.findAll.mockReturnValueOnce(testData.scanMode.list);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue(testData.south.manifest);

    await southConnectorController.checkImportSouthItems(ctx);
    expect(ctx.app.southService.checkCsvImport).toHaveBeenCalledWith(
      ctx.params.type,
      ctx.request.file,
      ctx.request.body.delimiter,
      JSON.parse(ctx.request.body.currentItems)
    );
    expect(ctx.ok).toHaveBeenCalled();
  });

  it('importSouthItems() should import south items', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.request.body = { items: testData.south.list[0].items };
    await southConnectorController.importSouthItems(ctx);
    expect(ctx.app.southService.importItems).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items);
  });

  it('testSouthConnection() should test South connector settings on connector update', async () => {
    ctx.params.id = testData.south.list[0].id;
    ctx.request.body = testData.south.command;
    ctx.app.logger.child = jest.fn().mockImplementation(() => logger);

    await southConnectorController.testSouthConnection(ctx);

    expect(ctx.app.southService.testSouth).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.command, logger);
    expect(ctx.noContent).toHaveBeenCalled();
  });
});
