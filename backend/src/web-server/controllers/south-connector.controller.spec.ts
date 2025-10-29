import SouthConnectorController from './south-connector.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import testData from '../../tests/utils/test-data';
import { toSouthConnectorDTO, toSouthConnectorItemDTO, toSouthConnectorLightDTO } from '../../service/south.service';
import { itemToFlattenedCSV } from '../../service/utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import fs from 'node:fs/promises';
import { toScanModeDTO } from '../../service/scan-mode.service';

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

    ctx.app.southService.exportArrayToCSV = jest.fn();
    ctx.app.southService.checkArrayCSVImport = jest.fn();
    ctx.app.southService.importArrayField = jest.fn();
  });

  it('getSouthConnectorTypes() should return South connector types', async () => {
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([testData.south.manifest]);

    await southConnectorController.getSouthConnectorTypes(ctx);

    expect(ctx.ok).toHaveBeenCalledWith([
      {
        id: testData.south.manifest.id,
        category: testData.south.manifest.category,
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
    expect(ctx.ok).toHaveBeenCalledWith(toSouthConnectorDTO(testData.south.list[0]));
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

    expect(ctx.app.southService.createSouth).toHaveBeenCalledWith(ctx.request.body, null);
    expect(ctx.created).toHaveBeenCalledWith(toSouthConnectorDTO(testData.south.list[0]));
  });

  it('create() should return bad request', async () => {
    ctx.request.body = testData.south.command;
    ctx.query.duplicate = 'southId';
    ctx.app.southService.createSouth.mockImplementationOnce(() => {
      throw new Error('bad request');
    });

    await southConnectorController.createSouth(ctx);

    expect(ctx.app.southService.createSouth).toHaveBeenCalledWith(ctx.request.body, 'southId');
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
    expect(ctx.ok).toHaveBeenCalledWith(
      testData.south.list[0].items.map(item => ({
        id: item.id,
        enabled: item.enabled,
        name: item.name,
        settings: item.settings,
        scanMode: toScanModeDTO(item.scanMode)
      }))
    );
  });

  it('listSouthItems() should return not found', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.app.southService.findById.mockReturnValueOnce(null);

    await southConnectorController.listSouthItems(ctx);
    expect(ctx.notFound).toHaveBeenCalled();
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
      content: testData.south.list[0].items,
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
      content: testData.south.list[0].items.map(item => toSouthConnectorItemDTO(item, testData.south.list[0].type)),
      totalElements: testData.south.list[0].items.length,
      size: 25,
      number: 1,
      totalPages: 1
    });
  });

  it('searchSouthItems() without page should return South items', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.query = {
      name: 'name'
    };
    const searchParams = {
      page: 0,
      name: 'name'
    };
    ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);
    ctx.app.southService.searchSouthItems.mockReturnValue({
      content: testData.south.list[0].items,
      totalElements: testData.south.list[0].items.length,
      size: 25,
      number: 0,
      totalPages: 1
    });
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([{ ...testData.south.manifest, id: testData.south.list[0].type }]);

    await southConnectorController.searchSouthItems(ctx);

    expect(ctx.app.southService.searchSouthItems).toHaveBeenCalledWith(testData.south.list[0].id, searchParams);
    expect(ctx.ok).toHaveBeenCalledWith({
      content: testData.south.list[0].items.map(item => toSouthConnectorItemDTO(item, testData.south.list[0].type)),
      totalElements: testData.south.list[0].items.length,
      size: 25,
      number: 0,
      totalPages: 1
    });
  });

  it('searchSouthItems() should return not found', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.app.southService.findById.mockReturnValueOnce(null);

    await southConnectorController.searchSouthItems(ctx);
    expect(ctx.notFound).toHaveBeenCalled();
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
    expect(ctx.ok).toHaveBeenCalledWith({
      id: testData.south.list[0].items[0].id,
      enabled: testData.south.list[0].items[0].enabled,
      name: testData.south.list[0].items[0].name,
      settings: testData.south.list[0].items[0].settings,
      scanMode: toScanModeDTO(testData.south.list[0].items[0].scanMode)
    });
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

  it('getSouthItem() should return not found', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.app.southService.findById.mockReturnValueOnce(null);

    await southConnectorController.getSouthItem(ctx);
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
    expect(ctx.created).toHaveBeenCalledWith({
      id: testData.south.list[0].items[0].id,
      enabled: testData.south.list[0].items[0].enabled,
      name: testData.south.list[0].items[0].name,
      settings: testData.south.list[0].items[0].settings,
      scanMode: toScanModeDTO(testData.south.list[0].items[0].scanMode)
    });
  });

  it('createSouthItem() should return bad request', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);
    ctx.app.southService.createItem.mockImplementationOnce(() => {
      throw new Error('create error');
    });
    await southConnectorController.createSouthItem(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('create error');
  });

  it('createSouthItem() should return not found', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.app.southService.findById.mockReturnValueOnce(null);

    await southConnectorController.createSouthItem(ctx);
    expect(ctx.notFound).toHaveBeenCalled();
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

  it('updateSouthItem() should return bad request', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.params.id = testData.south.list[0].items[0].id;
    ctx.request.body = testData.south.itemCommand;
    ctx.app.southService.updateItem.mockImplementationOnce(() => {
      throw new Error('update error');
    });

    await southConnectorController.updateSouthItem(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('update error');
  });

  it('deleteSouthItem() should delete South item', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.params.id = testData.south.list[0].items[0].id;

    await southConnectorController.deleteSouthItem(ctx);

    expect(ctx.app.southService.deleteItem).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteSouthItem() should return bad request', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.params.id = testData.south.list[0].items[0].id;
    ctx.app.southService.deleteItem.mockImplementationOnce(() => {
      throw new Error('delete error');
    });

    await southConnectorController.deleteSouthItem(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('delete error');
  });

  it('enableSouthItem() should enable South item', async () => {
    ctx.params.id = testData.south.list[0].items[0].id;
    ctx.params.southId = testData.south.list[0].id;

    await southConnectorController.enableSouthItem(ctx);

    expect(ctx.app.southService.enableItem).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('enableSouthItem() should return bad request', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.params.id = testData.south.list[0].items[0].id;
    ctx.app.southService.enableItem.mockImplementationOnce(() => {
      throw new Error('enable error');
    });

    await southConnectorController.enableSouthItem(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('enable error');
  });

  it('disableSouthItem() should disable South item', async () => {
    ctx.params.id = testData.south.list[0].items[0].id;
    ctx.params.southId = testData.south.list[0].id;

    await southConnectorController.disableSouthItem(ctx);

    expect(ctx.app.southService.disableItem).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('disableSouthItem() should return bad request', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.params.id = testData.south.list[0].items[0].id;
    ctx.app.southService.disableItem.mockImplementationOnce(() => {
      throw new Error('disable error');
    });

    await southConnectorController.disableSouthItem(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('disable error');
  });

  it('deleteAllSouthItem() should delete all South items', async () => {
    ctx.params.southId = testData.south.list[0].id;

    await southConnectorController.deleteAllSouthItem(ctx);

    expect(ctx.app.southService.deleteAllItemsForSouthConnector).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteAllSouthItem() should return bad request', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.app.southService.deleteAllItemsForSouthConnector.mockImplementationOnce(() => {
      throw new Error('delete all error');
    });

    await southConnectorController.deleteAllSouthItem(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('delete all error');
  });

  it('resetSouthMetrics() should reset South metrics', async () => {
    ctx.params.southId = testData.south.list[0].id;

    await southConnectorController.resetSouthMetrics(ctx);
    expect(ctx.app.oIBusService.resetSouthConnectorMetrics).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('southItemsToCsv() should download a csv file', async () => {
    ctx.params.southType = testData.south.list[0].type;
    ctx.request.body = {
      delimiter: ';'
    };
    ctx.request.files = {
      items: [
        {
          path: 'items.json',
          mimetype: 'text/plain'
        }
      ]
    };
    (itemToFlattenedCSV as jest.Mock).mockReturnValue('csv content');
    ctx.app.scanModeService.findAll.mockReturnValueOnce(testData.scanMode.list);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([{ ...testData.south.manifest, id: testData.south.list[0].type }]);
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(testData.south.list[0].items));

    await southConnectorController.southConnectorItemsToCsv(ctx);

    expect(ctx.ok).toHaveBeenCalledWith();
    expect(ctx.body).toEqual('csv content');
  });

  it('southItemsToCsv() should throw if manifest not found', async () => {
    ctx.params.southType = 'bad';
    ctx.request.body = {
      delimiter: ';'
    };
    ctx.request.files = {
      items: [
        {
          path: 'items.json',
          mimetype: 'text/plain'
        }
      ]
    };
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([{ ...testData.south.manifest, id: testData.south.list[0].type }]);

    await southConnectorController.southConnectorItemsToCsv(ctx);

    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('southItemsToCsv() should throw if file not found', async () => {
    ctx.request.body = {
      delimiter: ';'
    };
    ctx.request.files = {};
    ctx.app.southService.getInstalledSouthManifests.mockReturnValueOnce([{ ...testData.south.manifest, id: testData.south.list[0].type }]);

    await southConnectorController.southConnectorItemsToCsv(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('Missing files "items"');
  });

  it('exportSouthItems() should download a csv file', async () => {
    ctx.params.southType = testData.south.list[0].type;
    ctx.params.southId = testData.south.list[0].id;
    (itemToFlattenedCSV as jest.Mock).mockReturnValueOnce('csv content');
    ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);
    ctx.request.body = { delimiter: ';' };

    await southConnectorController.exportSouthItems(ctx);

    expect(ctx.ok).toHaveBeenCalledWith();
    expect(ctx.body).toEqual('csv content');
  });

  it('exportSouthItems() should return not found', async () => {
    ctx.params.southType = testData.south.list[0].type;
    ctx.params.southId = testData.south.list[0].id;
    ctx.request.body = { delimiter: ';' };
    ctx.app.southService.findById.mockReturnValueOnce(null);

    await southConnectorController.exportSouthItems(ctx);

    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('checkImportSouthItems() should check import of items in a csv file with new south', async () => {
    ctx.params.southType = testData.south.list[0].type;
    ctx.request.files = {
      file: [
        {
          path: 'myFile.csv',
          mimetype: 'text/csv'
        }
      ],
      currentItems: [
        {
          path: 'currentItems.json',
          mimetype: 'text/plain'
        }
      ]
    };
    ctx.request.body = { delimiter: ',' };
    ctx.app.scanModeService.findAll.mockReturnValueOnce(testData.scanMode.list);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue(testData.south.manifest);

    await southConnectorController.checkImportSouthItems(ctx);
    expect(ctx.app.southService.checkCsvFileImport).toHaveBeenCalledWith(
      testData.south.list[0].type,
      { mimetype: 'text/csv', path: 'myFile.csv' },
      ctx.request.body.delimiter,
      { mimetype: 'text/plain', path: 'currentItems.json' }
    );
    expect(ctx.ok).toHaveBeenCalled();
  });

  it('checkImportSouthItems() should return bad request', async () => {
    ctx.params.southType = testData.south.list[0].type;
    ctx.request.body = { delimiter: ',' };
    ctx.request.files = {
      file: [
        {
          path: 'myFile.csv',
          mimetype: 'text/csv'
        }
      ],
      currentItems: [
        {
          path: 'currentItems.json',
          mimetype: 'text/plain'
        }
      ]
    };
    ctx.app.southService.checkCsvFileImport.mockImplementationOnce(() => {
      throw new Error('bad items');
    });

    await southConnectorController.checkImportSouthItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('bad items');
  });

  it('checkImportSouthItems() should return bad request if file is missing', async () => {
    ctx.params.southType = testData.south.list[0].type;
    ctx.request.body = { delimiter: ',' };
    ctx.request.files = {};

    await southConnectorController.checkImportSouthItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('Missing files "file" or "currentItems"');
  });

  it('importSouthItems() should import south items', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.request.files = {
      items: [
        {
          path: 'currentItems.json',
          mimetype: 'text/plain'
        }
      ]
    };
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(testData.south.list[0].items));

    await southConnectorController.importSouthItems(ctx);
    expect(ctx.app.southService.importItems).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('importSouthItems() should return bad request', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.request.files = {
      items: [
        {
          path: 'currentItems.json',
          mimetype: 'text/plain'
        }
      ]
    };
    ctx.app.southService.importItems.mockImplementationOnce(() => {
      throw new Error('bad import');
    });
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(testData.south.list[0].items));

    await southConnectorController.importSouthItems(ctx);
    expect(ctx.app.southService.importItems).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items);
    expect(ctx.badRequest).toHaveBeenCalledWith('bad import');
  });

  it('importSouthItems() should return bad request if file is missing', async () => {
    ctx.params.southId = testData.south.list[0].id;
    ctx.request.files = {};

    await southConnectorController.importSouthItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('Missing file "items"');
  });

  it('testSouthConnection() should test South connector settings', async () => {
    ctx.params.id = testData.south.list[0].id;
    ctx.request.body = testData.south.command.settings;
    ctx.query.southType = testData.south.command.type;
    ctx.app.logger.child.mockReturnValueOnce(logger);
    ctx.app.southService.testSouth.mockResolvedValueOnce(undefined);

    await southConnectorController.testSouthConnection(ctx);

    expect(ctx.app.logger.child).toHaveBeenCalledWith(
      {
        scopeType: 'south',
        scopeId: 'test',
        scopeName: 'test'
      },
      { level: 'silent' }
    );
    expect(ctx.app.southService.testSouth).toHaveBeenCalledWith(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.command.settings,
      logger
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testSouthConnection() should return not found when South connector not found', async () => {
    ctx.params.id = testData.south.list[0].id;
    ctx.request.body = testData.south.command.settings;
    ctx.query.southType = testData.south.command.type;
    ctx.app.logger.child.mockReturnValueOnce(logger);
    ctx.app.southService.testSouth.mockImplementationOnce(() => {
      throw new Error('South connector testId1 not found');
    });

    await southConnectorController.testSouthConnection(ctx);

    expect(ctx.app.logger.child).toHaveBeenCalledWith(
      {
        scopeType: 'south',
        scopeId: 'test',
        scopeName: 'test'
      },
      { level: 'silent' }
    );
    expect(ctx.app.southService.testSouth).toHaveBeenCalledWith(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.command.settings,
      logger
    );
    expect(ctx.badRequest).toHaveBeenCalledWith('South connector testId1 not found');
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('testSouthConnection() should throw bad request when validation fails', async () => {
    ctx.params.id = testData.south.list[0].id;
    ctx.request.body = testData.south.command.settings;
    ctx.query.southType = testData.south.command.type;
    ctx.app.logger.child.mockReturnValueOnce(logger);
    ctx.app.southService.testSouth.mockImplementationOnce(() => {
      throw new Error('validation error');
    });

    await southConnectorController.testSouthConnection(ctx);

    expect(ctx.app.logger.child).toHaveBeenCalledWith(
      {
        scopeType: 'south',
        scopeId: 'test',
        scopeName: 'test'
      },
      { level: 'silent' }
    );
    expect(ctx.app.southService.testSouth).toHaveBeenCalledWith(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.command.settings,
      logger
    );
    expect(ctx.badRequest).toHaveBeenCalledWith('validation error');
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('testSouthConnection() should throw bad request when manifest not found', async () => {
    ctx.params.id = testData.south.list[0].id;
    ctx.request.body = testData.south.command.settings;
    ctx.query.southType = testData.south.command.type;
    ctx.app.logger.child.mockReturnValueOnce(logger);
    ctx.app.southService.testSouth.mockImplementationOnce(() => {
      throw new Error(`South manifest folder-scanner not found`);
    });

    await southConnectorController.testSouthConnection(ctx);

    expect(ctx.app.logger.child).toHaveBeenCalledWith(
      {
        scopeType: 'south',
        scopeId: 'test',
        scopeName: 'test'
      },
      { level: 'silent' }
    );
    expect(ctx.app.southService.testSouth).toHaveBeenCalledWith(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.command.settings,
      logger
    );
    expect(ctx.badRequest).toHaveBeenCalledWith(`South manifest folder-scanner not found`);
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('testSouthItem() should test South connector settings on connector update', async () => {
    ctx.params.id = testData.south.list[0].id;
    ctx.request.body = {
      southSettings: testData.south.command.settings,
      itemSettings: testData.south.itemCommand.settings,
      testingSettings: testData.south.itemTestingSettings
    };
    ctx.query.southType = testData.south.command.type;
    ctx.app.logger.child = jest.fn().mockImplementation(() => logger);

    await southConnectorController.testSouthItem(ctx);

    expect(ctx.app.southService.testSouthItem).toHaveBeenCalledWith(
      testData.south.list[0].id,
      testData.south.command.type,
      '',
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings,
      ctx.ok,
      logger
    );
  });

  it('testSouthItem() should throw bad request if test fails', async () => {
    ctx.params.id = testData.south.list[0].id;
    ctx.request.body = {
      southSettings: testData.south.command.settings,
      itemSettings: testData.south.itemCommand.settings,
      testingSettings: testData.south.itemTestingSettings
    };
    ctx.query.southType = testData.south.command.type;
    ctx.query.itemName = testData.south.itemCommand.name;
    ctx.app.logger.child = jest.fn().mockImplementation(() => logger);
    (ctx.app.southService.testSouthItem as jest.Mock).mockImplementation(() => {
      throw new Error('test error');
    });
    await southConnectorController.testSouthItem(ctx);

    expect(ctx.app.southService.testSouthItem).toHaveBeenCalledWith(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings,
      ctx.ok,
      logger
    );
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('test error');
  });

  describe('Array export/import functionality', () => {
    const mockArrayData = [{ name: 'test1' }, { name: 'test2' }];
    const mockCsvContent = 'name\ntest1\ntest2';
    const mockArrayKey = 'items';
    const mockDelimiter = ',';

    beforeEach(() => {
      ctx.params.southId = testData.south.list[0].id;
      ctx.params.arrayKey = mockArrayKey;
      ctx.request.body = {
        delimiter: mockDelimiter,
        arrayKey: mockArrayKey
      };
    });

    describe('exportArrayField', () => {
      it('should export array field from main connector settings', async () => {
        const mockSouthConnector = {
          ...testData.south.list[0],
          settings: {
            ...testData.south.list[0].settings,
            [mockArrayKey]: mockArrayData
          }
        };
        ctx.app.southService.findById.mockReturnValueOnce(mockSouthConnector);
        ctx.app.southService.exportArrayToCSV.mockReturnValueOnce(mockCsvContent);

        await southConnectorController.exportArrayField(ctx);

        expect(ctx.app.southService.exportArrayToCSV).toHaveBeenCalledWith(mockArrayData, mockDelimiter, mockArrayKey);
        expect(ctx.body).toBe(mockCsvContent);
        expect(ctx.set).toHaveBeenCalledWith('Content-Type', 'text/csv');
        expect(ctx.set).toHaveBeenCalledWith('Content-Disposition', `attachment; filename="${mockArrayKey}-export.csv"`);
        expect(ctx.ok).toHaveBeenCalled();
      });

      it('should export array field from item settings', async () => {
        const mockSouthConnector = {
          ...testData.south.list[0],
          settings: {
            ...testData.south.list[0].settings
          }
        };
        const mockItems = [
          {
            id: 'item1',
            settings: {
              [mockArrayKey]: mockArrayData
            }
          }
        ];
        ctx.app.southService.findById.mockReturnValueOnce(mockSouthConnector);
        ctx.app.southService.getSouthItems.mockReturnValueOnce(mockItems);
        ctx.app.southService.exportArrayToCSV.mockReturnValueOnce(mockCsvContent);

        await southConnectorController.exportArrayField(ctx);

        expect(ctx.app.southService.exportArrayToCSV).toHaveBeenCalledWith(mockArrayData, mockDelimiter, mockArrayKey);
        expect(ctx.body).toBe(mockCsvContent);
        expect(ctx.ok).toHaveBeenCalled();
      });

      it('should return bad request if south connector not found', async () => {
        ctx.app.southService.findById.mockReturnValueOnce(null);

        await southConnectorController.exportArrayField(ctx);

        expect(ctx.badRequest).toHaveBeenCalledWith('South connector not found');
      });

      it('should return bad request if export fails', async () => {
        ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);
        ctx.app.southService.exportArrayToCSV.mockImplementation(() => {
          throw new Error('Export failed');
        });

        await southConnectorController.exportArrayField(ctx);

        expect(ctx.badRequest).toHaveBeenCalledWith('Export failed');
      });
    });

    describe('checkImportArrayField', () => {
      beforeEach(() => {
        ctx.request.files = {
          file: [{ path: '/tmp/test.csv' }]
        };
      });

      it('should check import array field', async () => {
        const mockResult = {
          items: mockArrayData,
          errors: []
        };
        ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);
        ctx.app.southService.checkArrayCSVImport.mockResolvedValueOnce(mockResult);

        await southConnectorController.checkImportArrayField(ctx);

        expect(ctx.app.southService.checkArrayCSVImport).toHaveBeenCalledWith(ctx.request.files.file[0], mockDelimiter, mockArrayKey);
        expect(ctx.ok).toHaveBeenCalledWith(mockResult);
      });

      it('should return bad request if file missing', async () => {
        ctx.request.files = {};

        await southConnectorController.checkImportArrayField(ctx);

        expect(ctx.badRequest).toHaveBeenCalledWith('Missing file "file"');
      });

      it('should return bad request if south connector not found', async () => {
        ctx.app.southService.findById.mockReturnValueOnce(null);

        await southConnectorController.checkImportArrayField(ctx);

        expect(ctx.badRequest).toHaveBeenCalledWith('South connector not found');
      });

      it('should return bad request if check fails', async () => {
        ctx.app.southService.findById.mockReturnValueOnce(testData.south.list[0]);
        ctx.app.southService.checkArrayCSVImport.mockRejectedValueOnce(new Error('Check failed'));

        await southConnectorController.checkImportArrayField(ctx);

        expect(ctx.badRequest).toHaveBeenCalledWith('Check failed');
      });
    });

    describe('importArrayField', () => {
      beforeEach(() => {
        ctx.request.files = {
          items: [{ path: '/tmp/items.json' }]
        };
        ctx.request.body = { arrayKey: mockArrayKey };
        (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockArrayData));
      });

      it('should import array field', async () => {
        ctx.app.southService.importArrayField.mockResolvedValueOnce(undefined);

        await southConnectorController.importArrayField(ctx);

        expect(fs.readFile).toHaveBeenCalledWith('/tmp/items.json');
        expect(ctx.app.southService.importArrayField).toHaveBeenCalledWith(testData.south.list[0].id, mockArrayKey, mockArrayData);
        expect(ctx.noContent).toHaveBeenCalled();
      });

      it('should return bad request if items file missing', async () => {
        ctx.request.files = {};

        await southConnectorController.importArrayField(ctx);

        expect(ctx.badRequest).toHaveBeenCalledWith('Missing file "items"');
      });

      it('should return bad request if import fails', async () => {
        ctx.app.southService.importArrayField.mockRejectedValueOnce(new Error('Import failed'));

        await southConnectorController.importArrayField(ctx);

        expect(ctx.badRequest).toHaveBeenCalledWith('Import failed');
      });
    });
  });
});
