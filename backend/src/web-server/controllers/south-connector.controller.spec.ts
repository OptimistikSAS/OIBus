import SouthConnectorController from './south-connector.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import csv from 'papaparse';
import fs from 'node:fs/promises';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO
} from '../../../../shared/model/south-connector.model';
import { southTestManifest } from '../../tests/__mocks__/service/south-service.mock';
import { TransformerDTO, TransformerFilterDTO } from '../../../../shared/model/transformer.model';

jest.mock('./validators/joi.validator');
jest.mock('papaparse');
jest.mock('node:fs/promises');

let ctx = new KoaContextMock();
const validator = new JoiValidator();
const southConnectorController = new SouthConnectorController(validator);

const southConnectorCommand: SouthConnectorCommandDTO = {
  name: 'name',
  type: 'south-test',
  description: 'description',
  enabled: true,
  settings: {
    inputFolder: '/tmp',
    minAge: 10,
    ignoreModifiedDate: false,
    compression: false,
    preserveFiles: false
  },
  history: {
    maxInstantPerItem: true,
    maxReadInterval: 0,
    readDelay: 0,
    overlap: 0
  }
};
const southConnector: SouthConnectorDTO = {
  id: 'id',
  ...southConnectorCommand
};
const itemCommand: SouthConnectorItemCommandDTO = {
  name: 'name',
  enabled: true,
  settings: {
    regex: '.*'
  },
  scanModeId: 'scanModeId'
};
const item: SouthConnectorItemDTO = {
  id: 'id',
  connectorId: 'connectorId',
  enabled: true,
  name: 'name',
  settings: {
    regex: '.*'
  },
  scanModeId: 'scanModeId'
};
const page = {
  content: [item],
  size: 10,
  number: 1,
  totalElements: 1,
  totalPages: 1
};
const transformer: TransformerDTO = {
  id: 'transformerId',
  name: 'Transformer',
  description: 'Transformer description',
  code: 'code',
  inputType: 'time-values',
  outputType: 'values',
  fileRegex: null
};

describe('South connector controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Resetting context to prevent variables set in one test to pass into others
    ctx = new KoaContextMock();
  });

  it('getSouthConnectorTypes() should return South connector types', async () => {
    await southConnectorController.getSouthConnectorTypes(ctx);

    expect(ctx.ok).toHaveBeenCalledWith([
      {
        id: 'south-test',
        category: 'debug',
        name: 'Test',
        description: '',
        modes: {
          subscription: true,
          lastPoint: true,
          lastFile: true,
          history: true,
          forceMaxInstantPerItem: true
        }
      }
    ]);
  });

  it('getSouthConnectorManifest() should return South connector manifest', async () => {
    ctx.params.id = 'south-test';

    await southConnectorController.getSouthConnectorManifest(ctx);

    expect(ctx.ok).toHaveBeenCalledWith(southTestManifest);
  });

  it('getSouthConnectorManifest() should return not found', async () => {
    ctx.params.id = 'invalid';

    await southConnectorController.getSouthConnectorManifest(ctx);

    expect(ctx.throw).toHaveBeenCalledWith(404, 'South not found');
  });

  it('findAll() should return South connectors', async () => {
    ctx.app.repositoryService.southConnectorRepository.findAll.mockReturnValue([southConnector]);
    ctx.app.encryptionService.filterSecrets.mockReturnValue(southConnector.settings);

    await southConnectorController.findAll(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findAll).toHaveBeenCalled();
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(southConnector.settings, southTestManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith([southConnector]);
  });

  it('findAll() should return null when manifest is missing', async () => {
    const invalidSouthConnector = {
      ...southConnector,
      type: 'invalid'
    };
    ctx.app.repositoryService.southConnectorRepository.findAll.mockReturnValue([southConnector, invalidSouthConnector]);
    ctx.app.encryptionService.filterSecrets.mockReturnValue(southConnector.settings);

    await southConnectorController.findAll(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findAll).toHaveBeenCalled();
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(southConnector.settings, southTestManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith([southConnector, null]);
  });

  it('findById() should return South connector', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.encryptionService.filterSecrets.mockReturnValue(southConnector.settings);

    await southConnectorController.findById(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(southConnector.settings, southTestManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith(southConnector);
  });

  it('findById() should return not found when South connector not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(null);

    await southConnectorController.findById(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('findById() should return not found when manifest not found', async () => {
    ctx.params.id = 'id';
    const invalidSouthConnector = {
      ...southConnector,
      type: 'invalid'
    };
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(invalidSouthConnector);

    await southConnectorController.findById(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South type not found');
  });

  it('create() should create South connector', async () => {
    ctx.request.body = {
      south: southConnectorCommand,
      items: []
    };
    ctx.app.southConnectorConfigService.create.mockReturnValueOnce(southConnector);

    await southConnectorController.create(ctx);

    expect(ctx.app.southConnectorConfigService.create).toHaveBeenCalledWith(ctx.request.body);
    expect(ctx.created).toHaveBeenCalledWith(southConnector);
  });

  it('create() should return 404 when south is null', async () => {
    ctx.request.body = { south: null, items: null };

    await southConnectorController.create(ctx);

    expect(ctx.app.southConnectorConfigService.create).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('update() should update South connector', async () => {
    ctx.request.body = { south: { ...southConnectorCommand }, items: [] };
    ctx.params.id = 'id';

    await southConnectorController.update(ctx);

    expect(ctx.app.southConnectorConfigService.update).toHaveBeenCalledWith(ctx.params.id, ctx.request.body);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('update() should return 400 when south is null', async () => {
    ctx.request.body = { south: null, items: null };
    ctx.params.id = 'id';

    await southConnectorController.update(ctx);

    expect(ctx.app.southConnectorConfigService.update).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('delete() should delete South connector', async () => {
    ctx.params.id = 'id';

    await southConnectorController.delete(ctx);

    expect(ctx.app.southConnectorConfigService.delete).toHaveBeenCalledWith(ctx.params.id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('start() should enable South connector', async () => {
    ctx.params.id = 'id';

    await southConnectorController.start(ctx);

    expect(ctx.app.southConnectorConfigService.start).toHaveBeenCalledWith(ctx.params.id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('stop() should disable South connector', async () => {
    ctx.params.id = 'id';

    await southConnectorController.stop(ctx);

    expect(ctx.app.southConnectorConfigService.stop).toHaveBeenCalledWith(ctx.params.id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('listSouthItems() should return all South items', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southItemRepository.list.mockReturnValue([item]);

    await southConnectorController.listSouthItems(ctx);
    expect(ctx.app.repositoryService.southItemRepository.list).toHaveBeenCalledWith('id', {});
    expect(ctx.ok).toHaveBeenCalledWith([item]);
  });

  it('searchSouthItems() should return South items', async () => {
    ctx.params.southId = 'id';
    ctx.query = {
      page: 1,
      name: 'name'
    };
    const searchParams = {
      page: 1,
      name: 'name'
    };
    ctx.app.repositoryService.southItemRepository.search.mockReturnValue(page);

    await southConnectorController.searchSouthItems(ctx);

    expect(ctx.app.repositoryService.southItemRepository.search).toHaveBeenCalledWith('id', searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('searchSouthItems() should return South items with default search params', async () => {
    ctx.params.southId = 'id';
    ctx.query = {};
    const searchParams = {
      page: 0
    };
    ctx.app.repositoryService.southItemRepository.search.mockReturnValue(page);

    await southConnectorController.searchSouthItems(ctx);

    expect(ctx.app.repositoryService.southItemRepository.search).toHaveBeenCalledWith('id', searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('getSouthItem() should return South item', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southItemRepository.findById.mockReturnValue(item);

    await southConnectorController.getSouthItem(ctx);

    expect(ctx.app.repositoryService.southItemRepository.findById).toHaveBeenCalledWith('id');
    expect(ctx.ok).toHaveBeenCalledWith(item);
  });

  it('getSouthItem() should return not found when South item not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southItemRepository.findById.mockReturnValue(null);

    await southConnectorController.getSouthItem(ctx);

    expect(ctx.app.repositoryService.southItemRepository.findById).toHaveBeenCalledWith('id');
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createSouthItem() should create South item', async () => {
    ctx.params.southId = 'southId';
    ctx.request.body = {
      ...itemCommand
    };
    ctx.app.southConnectorConfigService.createItem.mockReturnValueOnce(item);

    await southConnectorController.createSouthItem(ctx);

    expect(ctx.app.southConnectorConfigService.createItem).toHaveBeenCalledWith('southId', itemCommand);
    expect(ctx.created).toHaveBeenCalledWith(item);
  });

  it('createSouthItem() should return bad request when body is missing', async () => {
    ctx.request.body = null;

    await southConnectorController.createSouthItem(ctx);

    expect(ctx.app.southConnectorConfigService.createItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('updateSouthItem() should update South item', async () => {
    ctx.params.id = 'id';
    ctx.params.southId = 'southId';
    ctx.request.body = {
      ...itemCommand
    };

    await southConnectorController.updateSouthItem(ctx);

    expect(ctx.app.southConnectorConfigService.updateItem).toHaveBeenCalledWith(ctx.params.southId, ctx.params.id, itemCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateSouthItem() should return bad request when body is missing', async () => {
    ctx.request.body = null;

    await southConnectorController.updateSouthItem(ctx);

    expect(ctx.app.southConnectorConfigService.updateItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('deleteSouthItem() should delete South item', async () => {
    ctx.params.id = 'id';
    ctx.params.southId = 'southId';

    await southConnectorController.deleteSouthItem(ctx);

    expect(ctx.app.southConnectorConfigService.deleteItem).toHaveBeenCalledWith(ctx.params.southId, ctx.params.id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('enableSouthItem() should enable South item', async () => {
    ctx.params.id = 'id';

    await southConnectorController.enableSouthItem(ctx);

    expect(ctx.app.southConnectorConfigService.enableItem).toHaveBeenCalledWith(ctx.params.id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('disableSouthItem() should disable South item', async () => {
    ctx.params.id = 'id';

    await southConnectorController.disableSouthItem(ctx);

    expect(ctx.app.southConnectorConfigService.disableItem).toHaveBeenCalledWith(ctx.params.id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteAllSouthItem() should delete all South items', async () => {
    ctx.params.southId = 'id';

    await southConnectorController.deleteAllSouthItem(ctx);

    expect(ctx.app.southConnectorConfigService.deleteAllItems).toHaveBeenCalledWith(ctx.params.southId);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('resetSouthMetrics() should reset South metrics', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);

    await southConnectorController.resetSouthMetrics(ctx);

    expect(ctx.app.reloadService.oibusEngine.resetSouthMetrics).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('resetSouthMetrics() should not reset South metrics if not found', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValueOnce(null);

    await southConnectorController.resetSouthMetrics(ctx);

    expect(ctx.app.reloadService.oibusEngine.resetSouthMetrics).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('southItemsToCsv() should download a csv file', async () => {
    ctx.params.southId = 'id';
    ctx.request.body = {
      items: [
        item,
        {
          id: 'id2',
          name: 'item2',
          scanModeId: 'scanModeId2',
          enabled: true,
          settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
        }
      ],
      delimiter: ';'
    };
    (csv.unparse as jest.Mock).mockReturnValue('csv content');
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValueOnce([{ id: 'scanModeId', name: 'scanMode' }]);

    await southConnectorController.southItemsToCsv(ctx);

    expect(ctx.ok).toHaveBeenCalled();
    expect(ctx.body).toEqual('csv content');
    expect(csv.unparse).toHaveBeenCalledWith(
      [
        {
          name: 'name',
          enabled: true,
          scanMode: 'scanMode',
          settings_regex: '.*'
        },
        {
          name: 'item2',
          enabled: true,
          scanMode: '',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        }
      ],
      {
        delimiter: ';'
      }
    );
  });

  it('exportSouthItems() should download a csv file', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValueOnce([{ id: 'scanModeId', name: 'scanMode' }]);
    ctx.app.repositoryService.southItemRepository.findAllForSouthConnector.mockReturnValueOnce([
      item,
      {
        id: 'id2',
        name: 'item2',
        scanModeId: 'badScanModeId',
        enabled: true,
        settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
      }
    ]);
    ctx.request.body = { delimiter: ';' };
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    await southConnectorController.exportSouthItems(ctx);

    expect(ctx.ok).toHaveBeenCalled();
    expect(ctx.body).toEqual('csv content');
    expect(csv.unparse).toHaveBeenCalledWith(
      [
        {
          name: 'name',
          enabled: true,
          scanMode: 'scanMode',
          settings_regex: '.*'
        },
        {
          name: 'item2',
          enabled: true,
          scanMode: '',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        }
      ],
      {
        columns: [
          'name',
          'enabled',
          'scanMode',
          'settings_regex',
          'settings_objectSettings',
          'settings_objectArray',
          'settings_objectValue'
        ],
        delimiter: ';'
      }
    );
  });

  it('checkImportSouthItems() should check import of items in a csv file with new south', async () => {
    ctx.params.southType = 'south-test';
    ctx.params.southId = 'create';
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValueOnce([{ id: 'scanModeId', name: 'scanMode' }]);

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body = { itemIdsToDelete: '[]', delimiter: ',' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (validator.validateSettings as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('validation fail');
      })
      .mockImplementationOnce(() => {
        return true;
      });
    (csv.parse as jest.Mock).mockReturnValue({
      meta: {
        delimiter: ','
      },
      data: [
        {
          name: 'item1',
          enabled: 'false',
          scanMode: 'badScanMode'
        },
        {
          name: 'item2',
          enabled: 'true',
          scanMode: 'scanMode',
          settings_badField: 'badField'
        },
        {
          name: 'item3',
          enabled: 'true',
          scanMode: 'scanMode',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        },
        {
          name: 'item4',
          enabled: 'true',
          scanMode: 'scanMode',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        }
      ],
      errors: []
    });

    await southConnectorController.checkImportSouthItems(ctx);
    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(validator.validateSettings).toHaveBeenCalledTimes(2);
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.ok).toHaveBeenCalledWith({
      items: [
        {
          id: '',
          name: 'item4',
          connectorId: '',
          enabled: true,
          scanModeId: 'scanModeId',
          settings: {
            objectArray: [],
            objectSettings: {},
            objectValue: 1
          }
        }
      ],
      errors: [
        {
          item: {
            id: '',
            name: 'item1',
            enabled: false,
            connectorId: '',
            scanModeId: '',
            settings: {}
          },
          message: 'Scan mode "badScanMode" not found for item item1'
        },
        {
          item: {
            id: '',
            name: 'item2',
            enabled: true,
            connectorId: '',
            scanModeId: '',
            settings: {}
          },
          message: 'Settings "badField" not accepted in manifest'
        },
        {
          item: {
            id: '',
            name: 'item3',
            enabled: true,
            connectorId: '',
            scanModeId: 'scanModeId',
            settings: {
              objectArray: [],
              objectSettings: {},
              objectValue: 1
            }
          },
          message: 'validation fail'
        }
      ]
    });
  });

  it('checkImportSouthItems() should check import of items in a csv file with existing south', async () => {
    ctx.params.southType = 'south-test';
    ctx.params.southId = 'southId';
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValueOnce([{ id: 'scanModeId', name: 'scanMode' }]);
    ctx.app.repositoryService.southItemRepository.findAllForSouthConnector.mockReturnValueOnce([
      { id: 'id1', name: 'existingItem' },
      { id: 'itemIdToDelete', name: 'willBeDeleted' }
    ]);

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body = { itemIdsToDelete: JSON.stringify(['itemIdToDelete']), delimiter: ',' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (validator.validateSettings as jest.Mock).mockImplementationOnce(() => {
      return true;
    });
    (csv.parse as jest.Mock).mockReturnValue({
      meta: {
        delimiter: ','
      },
      data: [
        {
          name: 'existingItem',
          enabled: 'true',
          scanMode: 'scanMode',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        },
        {
          name: 'newItem',
          enabled: 'true',
          scanMode: 'scanMode',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        },
        {
          name: 'willBeDeleted',
          enabled: 'true',
          scanMode: 'scanMode',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        }
      ],
      errors: []
    });

    await southConnectorController.checkImportSouthItems(ctx);
    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(validator.validateSettings).toHaveBeenCalledTimes(2);
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.ok).toHaveBeenCalledWith({
      items: [
        {
          id: '',
          name: 'newItem',
          connectorId: 'southId',
          enabled: true,
          scanModeId: 'scanModeId',
          settings: {
            objectArray: [],
            objectSettings: {},
            objectValue: 1
          }
        },
        {
          id: '',
          name: 'willBeDeleted',
          connectorId: 'southId',
          enabled: true,
          scanModeId: 'scanModeId',
          settings: {
            objectArray: [],
            objectSettings: {},
            objectValue: 1
          }
        }
      ],
      errors: [
        {
          item: {
            id: '',
            name: 'existingItem',
            enabled: true,
            connectorId: 'southId',
            scanModeId: '',
            settings: {
              objectArray: [],
              objectSettings: {},
              objectValue: 1
            }
          },
          message: 'Item name "existingItem" already used'
        }
      ]
    });
  });

  it('checkImportSouthItems() should check import of items in a csv file with UndetectableDelimiter', async () => {
    ctx.params.southType = 'south-test';
    ctx.params.southId = 'create';
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValueOnce([{ id: 'scanModeId', name: 'scanMode' }]);

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body = { itemIdsToDelete: '[]', delimiter: '/' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (validator.validateSettings as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('validation fail');
      })
      .mockImplementationOnce(() => {
        return true;
      });
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: {
        delimiter: ','
      },
      data: [],
      errors: [{ code: 'UndetectableDelimiter' }]
    });
    (csv.parse as jest.Mock).mockReturnValue({
      meta: {
        delimiter: '/'
      },
      data: [
        {
          name: 'item1',
          enabled: 'false',
          scanMode: 'badScanMode'
        }
      ],
      errors: []
    });

    await southConnectorController.checkImportSouthItems(ctx);
    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.ok).toHaveBeenCalledWith({
      items: [],
      errors: [
        {
          item: {
            id: '',
            name: 'item1',
            enabled: false,
            connectorId: '',
            scanModeId: '',
            settings: {}
          },
          message: 'Scan mode "badScanMode" not found for item item1'
        }
      ]
    });
  });

  it('checkImportSouthItems() should throw not found connector', async () => {
    ctx.params.southType = 'id';
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);

    await southConnectorController.checkImportSouthItems(ctx);

    expect(csv.parse).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('checkImportSouthItems() should throw badRequest when file not parsed', async () => {
    ctx.params.southType = 'south-test';
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body = { itemIdsToDelete: '[]' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    ctx.app.repositoryService.southItemRepository.findAllForSouthConnector.mockReturnValueOnce([]);
    (csv.parse as jest.Mock).mockImplementationOnce(() => {
      throw new Error('parsing error');
    });

    await southConnectorController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('parsing error');
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('checkImportSouthItems() should throw when itemIdsToDelete not parsed', async () => {
    ctx.params.southType = 'south-test';
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body = { itemIdsToDelete: 'not json' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    ctx.app.repositoryService.southItemRepository.findAllForSouthConnector.mockReturnValueOnce([]);

    await southConnectorController.checkImportSouthItems(ctx);

    expect(ctx.throw).toHaveBeenCalledWith(400, 'Could not parse item ids to delete array');

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(csv.parse).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('checkImportSouthItems() should throw badRequest when delimiter not the same in file and entered', async () => {
    ctx.params.southType = 'south-test';
    ctx.params.southId = 'create';
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValueOnce([{ id: 'scanModeId', name: 'scanMode' }]);

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body = { itemIdsToDelete: '[]', delimiter: ';' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (csv.parse as jest.Mock).mockReturnValue({
      meta: {
        delimiter: ','
      },
      data: [],
      errors: []
    });

    await southConnectorController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('The entered delimiter does not correspond to the file delimiter');
    expect(ctx.throw).not.toHaveBeenCalled();
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('checkImportSouthItems() should throw badRequest when errors in csv parse', async () => {
    ctx.params.southType = 'south-test';
    ctx.params.southId = 'create';
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValueOnce([{ id: 'scanModeId', name: 'scanMode' }]);

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body = { itemIdsToDelete: '[]', delimiter: ';' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (csv.parse as jest.Mock).mockReturnValue({
      meta: {
        delimiter: ','
      },
      data: [],
      errors: [{ message: 'Trailing quote on quoted field is malformed' }]
    });

    await southConnectorController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('Trailing quote on quoted field is malformed');
    expect(ctx.throw).not.toHaveBeenCalled();
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('checkImportSouthItems() should throw badRequest whith UndetectableDelimiter', async () => {
    ctx.params.southType = 'south-test';
    ctx.params.southId = 'create';
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValueOnce([{ id: 'scanModeId', name: 'scanMode' }]);

    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body = { itemIdsToDelete: '[]', delimiter: ';' };
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: {
        delimiter: ','
      },
      data: [{ data: 'yes' }],
      errors: [{ code: 'UndetectableDelimiter' }]
    });
    (csv.parse as jest.Mock).mockReturnValue({
      meta: {
        delimiter: '/'
      },
      data: [{ data: 'yes' }],
      errors: []
    });

    await southConnectorController.checkImportSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('The entered delimiter does not correspond to the file delimiter');
    expect(ctx.throw).not.toHaveBeenCalled();
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('importSouthItems() should throw not found if connector not found', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(null);
    await southConnectorController.importSouthItems(ctx);
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South not found');
  });

  it('importSouthItems() should throw not found if manifest not found', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([]);
    await southConnectorController.importSouthItems(ctx);
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('importSouthItems() should throw error on validation fail', async () => {
    ctx.params.southId = 'id';
    ctx.request.body = {
      items: [
        item,
        {
          id: 'id2',
          name: 'item2',
          scanModeId: 'scanModeId',
          enabled: true,
          settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
        }
      ]
    };
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    (validator.validateSettings as jest.Mock).mockImplementation(() => {
      throw new Error('validation fail');
    });
    await southConnectorController.importSouthItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('validation fail');
  });

  it('importSouthItems() should throw error on creation fail', async () => {
    ctx.params.southId = 'id';
    ctx.request.body = {
      items: [
        item,
        {
          id: 'id2',
          name: 'item2',
          scanModeId: 'scanModeId',
          enabled: true,
          settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
        }
      ]
    };
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    (validator.validateSettings as jest.Mock).mockImplementation(() => {
      return true;
    });
    ctx.app.reloadService.onCreateOrUpdateSouthItems.mockImplementation(() => {
      throw new Error('onCreateOrUpdateSouthItems error');
    });
    await southConnectorController.importSouthItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('onCreateOrUpdateSouthItems error');
  });

  it('importSouthItems() should import items', async () => {
    ctx.params.southId = 'id';
    ctx.request.body = {
      items: [
        item,
        {
          id: 'id2',
          name: 'item2',
          scanModeId: 'scanModeId',
          enabled: true,
          settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
        }
      ]
    };
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    (validator.validateSettings as jest.Mock).mockImplementation(() => {
      return true;
    });
    ctx.app.reloadService.onCreateOrUpdateSouthItems.mockImplementation(() => {
      return true;
    });
    await southConnectorController.importSouthItems(ctx);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('importSouthItems() should import items with scanModeName', async () => {
    ctx.params.southId = 'id';
    ctx.request.body = {
      items: [
        item,
        {
          id: 'id2',
          name: 'item2',
          scanModeName: 'scanModeName',
          enabled: true,
          settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
        }
      ]
    };
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValue([
      {
        name: 'scanModeName',
        description: '',
        cron: 'cron'
      }
    ]);
    (validator.validateSettings as jest.Mock).mockImplementation(() => {
      return true;
    });
    ctx.app.reloadService.onCreateOrUpdateSouthItems.mockImplementation(() => {
      return true;
    });
    await southConnectorController.importSouthItems(ctx);
    expect(ctx.app.repositoryService.scanModeRepository.findAll).toHaveBeenCalled();
    expect(validator.validateSettings).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('importSouthItems() should fail to import items without scanMode', async () => {
    ctx.params.southId = 'id';
    ctx.request.body = {
      items: [
        item,
        {
          id: 'id2',
          name: 'item2',
          scanModeName: 'bad scan mode',
          enabled: true,
          settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
        }
      ]
    };
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValue([
      {
        name: 'scanModeName',
        description: '',
        cron: 'cron'
      }
    ]);
    (validator.validateSettings as jest.Mock).mockImplementation(() => {
      return true;
    });
    ctx.app.reloadService.onCreateOrUpdateSouthItems.mockImplementation(() => {
      return true;
    });
    await southConnectorController.importSouthItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('Scan mode bad scan mode not found for item item2');

    ctx.request.body = {
      items: [
        item,
        {
          id: 'id2',
          name: 'item2',
          enabled: true,
          settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
        }
      ]
    };
    await southConnectorController.importSouthItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('Scan mode not specified for item item2');
  });

  it('testSouthConnection() should test South connector settings on connector update', async () => {
    const createdSouth = {
      testConnection: jest.fn()
    };
    ctx.request.body = {
      ...southConnectorCommand
    };
    ctx.params.id = 'id1';
    ctx.app.southService.getInstalledSouthManifests.mockReturnValue([southTestManifest]);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    (ctx.app.southService.createSouth as jest.Mock).mockReturnValue(createdSouth);

    await southConnectorController.testSouthConnection(ctx);
    await southConnectorController.addContent('id1', { type: 'time-values', content: [] });
    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      southConnectorCommand.settings,
      southConnector.settings,
      southTestManifest.settings
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testSouthConnection() should throw 404 when manifest not found', async () => {
    ctx.request.body = {
      ...southConnectorCommand,
      type: 'invalid'
    };

    await southConnectorController.testSouthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.oibusEngine.testSouth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('testSouthConnection() should return 404 when south connector is not found', async () => {
    ctx.request.body = {
      ...southConnectorCommand
    };
    ctx.params.id = 'id1';
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(null);

    await southConnectorController.testSouthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.oibusEngine.testSouth).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('testSouthConnection() should test connector on connector creation', async () => {
    ctx.request.body = {
      ...southConnectorCommand
    };
    ctx.params.id = 'create';
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(null);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);

    await southConnectorController.testSouthConnection(ctx);

    expect(validator.validateSettings).toHaveBeenCalledTimes(1);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      southConnectorCommand.settings,
      undefined,
      southTestManifest.settings
    );
    expect(ctx.notFound).not.toHaveBeenCalled();
  });

  it('testSouthConnection() should test connector on connector creation with duplicate', async () => {
    ctx.request.body = {
      ...southConnectorCommand
    };
    ctx.params.id = 'create';
    ctx.query.duplicateId = 'duplicateId';
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);

    await southConnectorController.testSouthConnection(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('duplicateId');
    expect(validator.validateSettings).toHaveBeenCalledTimes(1);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      southConnectorCommand.settings,
      southConnector.settings,
      southTestManifest.settings
    );
    expect(ctx.notFound).not.toHaveBeenCalled();
    ctx.query.duplicateId = null;
  });

  it('testSouthConnection() should return 404 when duplicate is not found', async () => {
    ctx.request.body = {
      ...southConnectorCommand
    };
    ctx.params.id = 'create';
    ctx.query.duplicateId = 'duplicateId';
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(null);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);

    await southConnectorController.testSouthConnection(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('duplicateId');
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
    ctx.query.duplicateId = null;
  });

  it('testSouthConnection() should return 404 when body is null', async () => {
    ctx.request.body = null;

    await southConnectorController.testSouthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.oibusEngine.testSouth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('testSouthConnection() should return bad request when validation fails', async () => {
    ctx.request.body = {
      ...southConnectorCommand
    };
    ctx.params.id = 'id1';
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await southConnectorController.testSouthConnection(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(southTestManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.oibusEngine.testSouth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('addTransformer() should add a transformer to the south connector', async () => {
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.repositoryService.transformerRepository.getTransformer.mockReturnValue(transformer);
    ctx.params.southId = 'southId';
    ctx.params.transformerId = 'transformerId';

    await southConnectorController.addTransformer(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.transformerRepository.getTransformer).toHaveBeenCalledWith('transformerId');
    expect(ctx.app.repositoryService.southTransformerRepository.addTransformer).toHaveBeenCalledWith('southId', 'transformerId');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('addTransformer() should not add a transformer to the south connector when south connector is not found', async () => {
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(null);
    ctx.params.southId = 'southId';

    await southConnectorController.addTransformer(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.transformerRepository.getTransformer).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.southTransformerRepository.addTransformer).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South not found');
  });

  it('addTransformer() should not add a transformer to the south connector when transformer is not found', async () => {
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.repositoryService.transformerRepository.getTransformer.mockReturnValue(null);
    ctx.params.southId = 'southId';
    ctx.params.transformerId = 'transformerId';

    await southConnectorController.addTransformer(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.transformerRepository.getTransformer).toHaveBeenCalledWith('transformerId');
    expect(ctx.app.repositoryService.southTransformerRepository.addTransformer).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'Transformer not found');
  });

  it('addTransformer() should not add transformer to the south connector when error is thrown', async () => {
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.repositoryService.transformerRepository.getTransformer.mockReturnValue(transformer);
    ctx.app.repositoryService.southTransformerRepository.addTransformer.mockImplementationOnce(() => {
      throw new Error('SQL Duplicate key constraint failed');
    });
    ctx.params.southId = 'southId';
    ctx.params.transformerId = 'transformerId';

    await southConnectorController.addTransformer(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.transformerRepository.getTransformer).toHaveBeenCalledWith('transformerId');
    expect(ctx.app.repositoryService.southTransformerRepository.addTransformer).toHaveBeenCalledWith('southId', 'transformerId');
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('SQL Duplicate key constraint failed');
  });

  it('getTransformers() should return transformers added to the south connector', async () => {
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.repositoryService.southTransformerRepository.getTransformers.mockReturnValue([transformer]);
    ctx.params.southId = 'southId';
    const filter = {};

    await southConnectorController.getTransformers(ctx);
    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.southTransformerRepository.getTransformers).toHaveBeenCalledWith('southId', filter);
    expect(ctx.ok).toHaveBeenCalledWith([transformer]);
  });

  it('getTransformers() should return transformers added to the south connector with filters', async () => {
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.repositoryService.southTransformerRepository.getTransformers.mockReturnValue([transformer]);
    ctx.params.southId = 'southId';
    ctx.query.inputType = 'time-values';
    ctx.query.outputType = 'values';
    ctx.query.name = 'name';
    const filter: TransformerFilterDTO = {
      inputType: 'time-values',
      outputType: 'values',
      name: 'name'
    };

    await southConnectorController.getTransformers(ctx);
    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.southTransformerRepository.getTransformers).toHaveBeenCalledWith('southId', filter);
    expect(ctx.ok).toHaveBeenCalledWith([transformer]);
  });

  it('getTransformers() should not return transformers added to the south connector when south connector is not found', async () => {
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(null);
    ctx.params.southId = 'southId';

    await southConnectorController.getTransformers(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.southTransformerRepository.getTransformers).not.toHaveBeenCalled();
    expect(ctx.ok).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South not found');
  });

  it('getTransformers() should not return transformers added to the south connector when error is thrown', async () => {
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.repositoryService.southTransformerRepository.getTransformers.mockImplementationOnce(() => {
      throw new Error('Unexpected filter value');
    });
    ctx.params.southId = 'southId';
    const filter = {};

    await southConnectorController.getTransformers(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.southTransformerRepository.getTransformers).toHaveBeenCalledWith('southId', filter);
    expect(ctx.ok).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Unexpected filter value');
  });

  it('removeTransformer() should remove a transformer from the south connector', async () => {
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.repositoryService.transformerRepository.getTransformer.mockReturnValue(transformer);
    ctx.params.southId = 'southId';
    ctx.params.transformerId = 'transformerId';

    await southConnectorController.removeTransformer(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.transformerRepository.getTransformer).toHaveBeenCalledWith('transformerId');
    expect(ctx.app.repositoryService.southTransformerRepository.removeTransformer).toHaveBeenCalledWith('southId', 'transformerId');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('removeTransformer() should not remove a transformer from the south connector when south connector is not found', async () => {
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(null);
    ctx.params.southId = 'southId';

    await southConnectorController.removeTransformer(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.transformerRepository.getTransformer).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.southTransformerRepository.removeTransformer).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South not found');
  });

  it('removeTransformer() should not remove a transformer from the south connector when transformer is not found', async () => {
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.repositoryService.transformerRepository.getTransformer.mockReturnValue(null);
    ctx.params.southId = 'southId';
    ctx.params.transformerId = 'transformerId';

    await southConnectorController.removeTransformer(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.transformerRepository.getTransformer).toHaveBeenCalledWith('transformerId');
    expect(ctx.app.repositoryService.southTransformerRepository.removeTransformer).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'Transformer not found');
  });

  it('removeTransformer() should not remove a transformer from the south connector when error is thrown', async () => {
    ctx.app.repositoryService.southConnectorRepository.findById.mockReturnValue(southConnector);
    ctx.app.repositoryService.transformerRepository.getTransformer.mockReturnValue(transformer);
    ctx.app.repositoryService.southTransformerRepository.removeTransformer.mockImplementationOnce(() => {
      throw new Error('Unexpected error occurred');
    });
    ctx.params.southId = 'southId';
    ctx.params.transformerId = 'transformerId';

    await southConnectorController.removeTransformer(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.findById).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.transformerRepository.getTransformer).toHaveBeenCalledWith('transformerId');
    expect(ctx.app.repositoryService.southTransformerRepository.removeTransformer).toHaveBeenCalledWith('southId', 'transformerId');
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith('Unexpected error occurred');
  });
});
