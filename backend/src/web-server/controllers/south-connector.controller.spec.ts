import SouthConnectorController, { southManifests } from './south-connector.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import folderScannerManifest from '../../south/south-folder-scanner/manifest';
import sqliteManifest from '../../south/south-sqlite/manifest';
import csv from 'papaparse';
import fs from 'node:fs/promises';
import {
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO
} from '../../../../shared/model/south-connector.model';
import {
  SouthFolderScannerItemSettings,
  SouthFolderScannerSettings,
  SouthSQLiteSettings
} from '../../../../shared/model/south-settings.model';

jest.mock('./validators/joi.validator');
jest.mock('papaparse');
jest.mock('node:fs/promises');

const ctx = new KoaContextMock();
const validator = new JoiValidator();
const southConnectorController = new SouthConnectorController(validator);

const sqliteConnectorCommand: SouthConnectorCommandDTO<SouthSQLiteSettings> = {
  name: 'name',
  type: 'sqlite',
  description: 'description',
  enabled: true,
  settings: {
    databasePath: 'databasePath.db'
  },
  history: {
    maxInstantPerItem: true,
    maxReadInterval: 0,
    readDelay: 0
  }
};
const southConnectorCommand: SouthConnectorCommandDTO<SouthFolderScannerSettings> = {
  name: 'name',
  type: 'folder-scanner',
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
    readDelay: 0
  }
};
const southConnector: SouthConnectorDTO<SouthFolderScannerSettings> = {
  id: 'id',
  ...southConnectorCommand
};
const itemCommand: SouthConnectorItemCommandDTO<SouthFolderScannerItemSettings> = {
  name: 'name',
  settings: {
    regex: '.*'
  },
  scanModeId: 'scanModeId'
};
const item: SouthConnectorItemDTO<SouthFolderScannerItemSettings> = {
  id: 'id',
  connectorId: 'connectorId',
  enabled: true,
  ...itemCommand
};
const page = {
  content: [item],
  size: 10,
  number: 1,
  totalElements: 1,
  totalPages: 1
};

describe('South connector controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('getSouthConnectorTypes() should return South connector types', async () => {
    await southConnectorController.getSouthConnectorTypes(ctx);

    expect(ctx.ok).toHaveBeenCalledWith(
      southManifests.map(manifest => ({
        category: manifest.category,
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        modes: manifest.modes
      }))
    );
  });

  it('getSouthConnectorManifest() should return South connector manifest', async () => {
    ctx.params.id = 'folder-scanner';

    await southConnectorController.getSouthConnectorManifest(ctx);

    expect(ctx.ok).toHaveBeenCalledWith(folderScannerManifest);
  });

  it('getSouthConnectorManifest() should return not found', async () => {
    ctx.params.id = 'invalid';

    await southConnectorController.getSouthConnectorManifest(ctx);

    expect(ctx.throw).toHaveBeenCalledWith(404, 'South not found');
  });

  it('getSouthConnectors() should return South connectors', async () => {
    ctx.app.repositoryService.southConnectorRepository.getSouthConnectors.mockReturnValue([southConnector]);
    ctx.app.encryptionService.filterSecrets.mockReturnValue(southConnector.settings);

    await southConnectorController.getSouthConnectors(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnectors).toHaveBeenCalled();
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(southConnector.settings, folderScannerManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith([southConnector]);
  });

  it('getSouthConnectors() should return null when manifest is missing', async () => {
    const invalidSouthConnector = {
      ...southConnector,
      type: 'invalid'
    };
    ctx.app.repositoryService.southConnectorRepository.getSouthConnectors.mockReturnValue([southConnector, invalidSouthConnector]);
    ctx.app.encryptionService.filterSecrets.mockReturnValue(southConnector.settings);

    await southConnectorController.getSouthConnectors(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnectors).toHaveBeenCalled();
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(southConnector.settings, folderScannerManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith([southConnector, null]);
  });

  it('getSouthConnector() should return South connector', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.encryptionService.filterSecrets.mockReturnValue(southConnector.settings);

    await southConnectorController.getSouthConnector(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(southConnector.settings, folderScannerManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith(southConnector);
  });

  it('getSouthConnector() should return not found when South connector not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);

    await southConnectorController.getSouthConnector(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('getSouthConnector() should return not found when manifest not found', async () => {
    ctx.params.id = 'id';
    const invalidSouthConnector = {
      ...southConnector,
      type: 'invalid'
    };
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(invalidSouthConnector);

    await southConnectorController.getSouthConnector(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South type not found');
  });

  it('createSouthConnector() should create South connector', async () => {
    ctx.request.body = {
      south: southConnectorCommand,
      items: []
    };
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);
    ctx.app.reloadService.onCreateSouth.mockReturnValue(southConnector);

    await southConnectorController.createSouthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(folderScannerManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      southConnectorCommand.settings,
      null,
      folderScannerManifest.settings
    );
    expect(ctx.app.reloadService.onCreateSouth).toHaveBeenCalledWith(southConnectorCommand);
    expect(ctx.created).toHaveBeenCalledWith(southConnector);
  });

  it('createSouthConnector() should create South connector with forceMaxInstantPerItem', async () => {
    ctx.request.body = {
      south: sqliteConnectorCommand,
      items: [{}]
    };
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(sqliteConnectorCommand.settings);
    ctx.app.reloadService.onCreateSouth.mockReturnValue(southConnector);

    await southConnectorController.createSouthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(sqliteManifest.settings, sqliteConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      sqliteConnectorCommand.settings,
      null,
      sqliteManifest.settings
    );
    expect(ctx.app.reloadService.onCreateSouth).toHaveBeenCalledWith(sqliteConnectorCommand);
    expect(ctx.created).toHaveBeenCalledWith(southConnector);
  });

  it('createSouthConnector() should return 404 when manifest not found', async () => {
    ctx.request.body = {
      south: sqliteConnectorCommand,
      items: []
    };
    ctx.request.body.south.type = 'invalid';

    await southConnectorController.createSouthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateSouth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('createSouthConnector() should return 404 when body is null', async () => {
    ctx.request.body = { south: {}, items: null };

    await southConnectorController.createSouthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateSouth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('createSouthConnector() should return bad request when validation fails', async () => {
    ctx.request.body = { south: southConnectorCommand, items: [] };

    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await southConnectorController.createSouthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(folderScannerManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateSouth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateSouthConnector() should update South connector', async () => {
    ctx.request.body = {
      ...southConnectorCommand
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);

    await southConnectorController.updateSouthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(folderScannerManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      southConnectorCommand.settings,
      southConnector.settings,
      folderScannerManifest.settings
    );
    expect(ctx.app.reloadService.onUpdateSouth).toHaveBeenCalledWith('id', southConnectorCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateSouthConnector() should throw 404 when manifest not found', async () => {
    ctx.request.body = {
      ...southConnectorCommand,
      type: 'invalid'
    };
    ctx.params.id = 'id';

    await southConnectorController.updateSouthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('updateSouthConnector() should return 404 when body is null', async () => {
    ctx.request.body = null;
    ctx.params.id = 'id';

    await southConnectorController.updateSouthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('updateSouthConnector() should return bad request when validation fails', async () => {
    ctx.request.body = {
      ...southConnectorCommand
    };
    ctx.params.id = 'id';
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await southConnectorController.updateSouthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(folderScannerManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateSouthConnector() should return not found when South connector not found', async () => {
    ctx.request.body = {
      ...southConnectorCommand
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);

    await southConnectorController.updateSouthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(folderScannerManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouth).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('deleteSouthConnector() should delete South connector', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);

    await southConnectorController.deleteSouthConnector(ctx);

    expect(ctx.app.reloadService.onDeleteSouth).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteSouthConnector() should return not found when South connector not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);

    await southConnectorController.deleteSouthConnector(ctx);

    expect(ctx.app.reloadService.onDeleteSouth).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('startSouthConnector() should enable South connector', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);

    await southConnectorController.startSouthConnector(ctx);

    expect(ctx.app.reloadService.onStartSouth).toHaveBeenCalledTimes(1);
    expect(ctx.badRequest).not.toHaveBeenCalled();
  });

  it('startSouthConnector() should throw badRequest if fail to enable', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);

    ctx.app.reloadService.onStartSouth.mockImplementation(() => {
      throw new Error('bad');
    });

    await southConnectorController.startSouthConnector(ctx);

    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('startSouthConnector() should return not found if South not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);

    await southConnectorController.startSouthConnector(ctx);

    expect(ctx.app.reloadService.onStartSouth).not.toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('stopSouthConnector() should enable South connector', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);

    await southConnectorController.stopSouthConnector(ctx);

    expect(ctx.app.reloadService.onStopSouth).toHaveBeenCalledTimes(1);
    expect(ctx.badRequest).not.toHaveBeenCalled();
  });

  it('stopSouthConnector() should throw badRequest if fail to enable', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);

    ctx.app.reloadService.onStopSouth.mockImplementation(() => {
      throw new Error('bad');
    });

    await southConnectorController.stopSouthConnector(ctx);

    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('stopSouthConnector() should return not found if South not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);

    await southConnectorController.stopSouthConnector(ctx);

    expect(ctx.app.reloadService.onStopSouth).not.toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('listSouthItems() should return all South items', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southItemRepository.listSouthItems.mockReturnValue([item]);

    await southConnectorController.listSouthItems(ctx);
    expect(ctx.app.repositoryService.southItemRepository.listSouthItems).toHaveBeenCalledWith('id');
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
    ctx.app.repositoryService.southItemRepository.searchSouthItems.mockReturnValue(page);

    await southConnectorController.searchSouthItems(ctx);

    expect(ctx.app.repositoryService.southItemRepository.searchSouthItems).toHaveBeenCalledWith('id', searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('searchSouthItems() should return South items with default search params', async () => {
    ctx.params.southId = 'id';
    ctx.query = {};
    const searchParams = {
      page: 0,
      name: null
    };
    ctx.app.repositoryService.southItemRepository.searchSouthItems.mockReturnValue(page);

    await southConnectorController.searchSouthItems(ctx);

    expect(ctx.app.repositoryService.southItemRepository.searchSouthItems).toHaveBeenCalledWith('id', searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('getSouthItem() should return South item', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southItemRepository.getSouthItem.mockReturnValue(item);

    await southConnectorController.getSouthItem(ctx);

    expect(ctx.app.repositoryService.southItemRepository.getSouthItem).toHaveBeenCalledWith('id');
    expect(ctx.ok).toHaveBeenCalledWith(item);
  });

  it('getSouthItem() should return not found when South item not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southItemRepository.getSouthItem.mockReturnValue(null);

    await southConnectorController.getSouthItem(ctx);

    expect(ctx.app.repositoryService.southItemRepository.getSouthItem).toHaveBeenCalledWith('id');
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('createSouthItem() should create South item', async () => {
    ctx.params.southId = 'southId';
    ctx.request.body = {
      ...itemCommand
    };
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.reloadService.onCreateSouthItem.mockReturnValue(item);

    await southConnectorController.createSouthItem(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(folderScannerManifest.items.settings, itemCommand.settings);
    expect(ctx.app.reloadService.onCreateSouthItem).toHaveBeenCalledWith('southId', itemCommand);
    expect(ctx.created).toHaveBeenCalledWith(item);
  });

  it('createSouthItem() should throw 404 when South connector not found', async () => {
    ctx.request.body = {
      ...itemCommand,
      type: 'invalid'
    };
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);

    await southConnectorController.createSouthItem(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateSouthItem).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South not found');
  });

  it('createSouthItem() should throw 404 when manifest not found', async () => {
    ctx.request.body = {
      ...itemCommand
    };
    const invalidSouthConnector = {
      ...southConnector,
      type: 'invalid'
    };
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(invalidSouthConnector);

    await southConnectorController.createSouthItem(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateSouthItem).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('createSouthItem() should return bad request when body is missing', async () => {
    ctx.request.body = null;
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await southConnectorController.createSouthItem(ctx);

    expect(validator.validateSettings).toHaveBeenCalledTimes(1);
    expect(ctx.app.reloadService.onCreateSouthItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('createSouthItem() should return bad request when validation fails', async () => {
    ctx.request.body = {
      ...itemCommand
    };
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);

    await southConnectorController.createSouthItem(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(folderScannerManifest.items.settings, itemCommand.settings);
    expect(ctx.app.reloadService.onCreateSouthItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateSouthItem() should update South item', async () => {
    ctx.params.southId = 'southId';
    ctx.request.body = {
      ...itemCommand
    };
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.repositoryService.southItemRepository.getSouthItem.mockReturnValue(item);

    await southConnectorController.updateSouthItem(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.southItemRepository.getSouthItem).toHaveBeenCalledWith('id');
    expect(validator.validateSettings).toHaveBeenCalledWith(folderScannerManifest.items.settings, itemCommand.settings);
    expect(ctx.app.reloadService.onUpdateSouthItemsSettings).toHaveBeenCalledWith('southId', item, itemCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateSouthItem() should throw 404 when South connector not found', async () => {
    ctx.params.southId = 'southId';
    ctx.request.body = {
      ...itemCommand,
      type: 'invalid'
    };
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);

    await southConnectorController.updateSouthItem(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.southItemRepository.getSouthItem).not.toHaveBeenCalled();
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouthItemsSettings).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South not found');
  });

  it('updateSouthItem() should throw 404 when manifest not found', async () => {
    ctx.params.southId = 'southId';
    ctx.request.body = {
      ...itemCommand
    };
    const invalidSouthConnector = {
      ...southConnector,
      type: 'invalid'
    };
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(invalidSouthConnector);

    await southConnectorController.updateSouthItem(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.southItemRepository.getSouthItem).not.toHaveBeenCalled();
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouthItemsSettings).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('updateSouthItem() should return not found when South item is not found', async () => {
    ctx.params.southId = 'id';
    ctx.params.southId = 'southId';
    ctx.request.body = null;
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.repositoryService.southItemRepository.getSouthItem.mockReturnValue(null);

    await southConnectorController.updateSouthItem(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.southItemRepository.getSouthItem).toHaveBeenCalledWith('id');
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouthItemsSettings).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('updateSouthItem() should return bad request when body is missing', async () => {
    ctx.params.southId = 'southId';
    ctx.request.body = null;
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.repositoryService.southItemRepository.getSouthItem.mockReturnValue(item);
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await southConnectorController.updateSouthItem(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.southItemRepository.getSouthItem).toHaveBeenCalledWith('id');
    expect(validator.validateSettings).toHaveBeenCalledTimes(1);
    expect(ctx.app.reloadService.onUpdateSouthItemsSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('updateSouthItem() should return bad request when validation fails', async () => {
    ctx.params.southId = 'southId';
    ctx.request.body = {
      ...itemCommand
    };
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.repositoryService.southItemRepository.getSouthItem.mockReturnValue(item);

    await southConnectorController.updateSouthItem(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.southItemRepository.getSouthItem).toHaveBeenCalledWith('id');
    expect(validator.validateSettings).toHaveBeenCalledWith(folderScannerManifest.items.settings, itemCommand.settings);
    expect(ctx.app.reloadService.onUpdateSouthItemsSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('deleteSouthItem() should delete South item', async () => {
    ctx.params.id = 'id';

    await southConnectorController.deleteSouthItem(ctx);

    expect(ctx.app.reloadService.onDeleteSouthItem).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('enableSouthItem() should enable South item', async () => {
    ctx.params.id = 'id';

    await southConnectorController.enableSouthItem(ctx);

    expect(ctx.app.reloadService.onEnableSouthItem).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('disableSouthItem() should disable South item', async () => {
    ctx.params.id = 'id';

    await southConnectorController.disableSouthItem(ctx);

    expect(ctx.app.reloadService.onDisableSouthItem).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteAllSouthItem() should delete all South items', async () => {
    ctx.params.southId = 'id';

    await southConnectorController.deleteAllSouthItem(ctx);

    expect(ctx.app.reloadService.onDeleteAllSouthItems).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('resetSouthMetrics() should reset South metrics', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);

    await southConnectorController.resetSouthMetrics(ctx);

    expect(ctx.app.reloadService.oibusEngine.resetSouthMetrics).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('resetSouthMetrics() should not reset South metrics if not found', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValueOnce(null);

    await southConnectorController.resetSouthMetrics(ctx);

    expect(ctx.app.reloadService.oibusEngine.resetSouthMetrics).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('exportSouthItems() should download a csv file', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southItemRepository.getSouthItems.mockReturnValueOnce([item, item]);
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    await southConnectorController.exportSouthItems(ctx);

    expect(ctx.ok).toHaveBeenCalled();
    expect(ctx.body).toEqual('csv content');
    expect(csv.unparse).toHaveBeenCalledWith([
      {
        id: 'id',
        name: 'name',
        enabled: true,
        scanModeId: 'scanModeId',
        settings_regex: '.*'
      },
      {
        id: 'id',
        name: 'name',
        enabled: true,
        scanModeId: 'scanModeId',
        settings_regex: '.*'
      }
    ]);
  });

  it('uploadSouthItems() should import a csv file', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.app.repositoryService.southItemRepository.getSouthItems.mockReturnValueOnce([item, item]);
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (csv.parse as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'id',
          name: 'name',
          scanModeId: 'scanModeId',
          settings_field: 'value'
        },
        {
          id: 'id',
          name: 'name',
          scanModeId: 'scanModeId',
          settings_field: 'value'
        }
      ]
    });

    await southConnectorController.uploadSouthItems(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(validator.validateSettings).toHaveBeenCalledTimes(2);
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).toHaveBeenCalledTimes(1);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('uploadSouthItems() should throw not found connector', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValueOnce(null);

    await southConnectorController.uploadSouthItems(ctx);

    expect(csv.parse).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledTimes(1);
  });

  it('uploadSouthItems() should throw not found manifest', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValueOnce({ type: 'bad type' });

    await southConnectorController.uploadSouthItems(ctx);

    expect(csv.parse).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledTimes(1);
  });

  it('uploadSouthItems() should reject bad file type', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.request.file = { path: 'myFile.txt', mimetype: 'bad type' };

    await southConnectorController.uploadSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledTimes(1);
    expect(csv.parse).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();
  });

  it('uploadSouthItems() should throw badRequest when file not parsed', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.app.repositoryService.southItemRepository.getSouthItems.mockReturnValueOnce([item, item]);
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (csv.parse as jest.Mock).mockImplementationOnce(() => {
      throw new Error('parsing error');
    });

    await southConnectorController.uploadSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('parsing error');
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('uploadSouthItems() should send bad request when fail to save in database', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.app.repositoryService.southItemRepository.getSouthItems.mockReturnValueOnce([item, item]);
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (csv.parse as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'id',
          name: 'name',
          scanModeId: 'scanModeId',
          settings_field: 'value'
        },
        {
          id: 'id',
          name: 'name',
          scanModeId: 'scanModeId',
          settings_field: 'value'
        }
      ]
    });
    (ctx.app.reloadService.onCreateOrUpdateSouthItems as jest.Mock).mockImplementationOnce(() => {
      throw new Error('save error');
    });

    await southConnectorController.uploadSouthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledTimes(1);
    expect(ctx.throw).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(validator.validateSettings).toHaveBeenCalledTimes(2);
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.app.reloadService.onCreateOrUpdateSouthItems).toHaveBeenCalledTimes(1);
  });

  it('testSouthConnection() should test South connector settings on connector update', async () => {
    const createdSouth = {
      testConnection: jest.fn()
    };
    ctx.request.body = {
      ...southConnectorCommand
    };
    ctx.params.id = 'id1';
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    (ctx.app.southService.createSouth as jest.Mock).mockReturnValue(createdSouth);

    await southConnectorController.testSouthConnection(ctx);
    await southConnectorController.addValues('id1', []);
    await southConnectorController.addFile('id1', 'filename');
    expect(validator.validateSettings).toHaveBeenCalledWith(folderScannerManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      southConnectorCommand.settings,
      southConnector.settings,
      folderScannerManifest.settings
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
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);

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
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);

    await southConnectorController.testSouthConnection(ctx);

    expect(validator.validateSettings).toHaveBeenCalledTimes(1);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      southConnectorCommand.settings,
      null,
      folderScannerManifest.settings
    );
    expect(ctx.notFound).not.toHaveBeenCalled();
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
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await southConnectorController.testSouthConnection(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(folderScannerManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.oibusEngine.testSouth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });
});
