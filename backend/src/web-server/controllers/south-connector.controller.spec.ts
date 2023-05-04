import SouthConnectorController from './south-connector.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from '../../validators/joi.validator';
import mqttManifest from '../../south/south-mqtt/manifest';
import csv from 'papaparse';
import fs from 'node:fs/promises';

jest.mock('../../validators/joi.validator');
jest.mock('papaparse');
jest.mock('node:fs/promises');

const ctx = new KoaContextMock();
const validator = new JoiValidator();
const southConnectorController = new SouthConnectorController(validator);
const manifestList = [
  {
    category: 'database',
    type: 'SQL',
    description: 'SQL description',
    modes: {
      subscription: false,
      lastPoint: false,
      lastFile: false,
      history: true
    }
  },
  {
    category: 'api',
    type: 'OIConnect',
    description: 'OIConnect description',
    modes: {
      subscription: false,
      lastPoint: false,
      lastFile: false,
      history: true
    }
  },
  {
    category: 'iot',
    type: 'OPCUA_HA',
    description: 'OPCUA_HA description',
    modes: {
      subscription: false,
      lastPoint: false,
      lastFile: false,
      history: true
    }
  },
  {
    category: 'iot',
    type: 'OPCUA_DA',
    description: 'OPCUA_DA description',
    modes: {
      subscription: false,
      lastPoint: true,
      lastFile: false,
      history: false
    }
  },
  {
    category: 'iot',
    type: 'OPCHDA',
    description: 'OPCHDA description',
    modes: {
      subscription: false,
      lastPoint: false,
      lastFile: false,
      history: true
    }
  },
  {
    category: 'iot',
    type: 'MQTT',
    description: 'MQTT description',
    modes: {
      subscription: true,
      lastPoint: false,
      lastFile: false,
      history: false
    }
  },
  {
    category: 'iot',
    type: 'Modbus',
    description: 'Modbus description',
    modes: {
      subscription: false,
      lastPoint: true,
      lastFile: false,
      history: false
    }
  },
  {
    category: 'file',
    type: 'FolderScanner',
    description: 'FolderScanner description',
    modes: {
      subscription: false,
      lastPoint: false,
      lastFile: true,
      history: false
    }
  },
  {
    category: 'iot',
    type: 'ADS',
    description: 'ADS description',
    modes: {
      subscription: false,
      lastPoint: true,
      lastFile: false,
      history: false
    }
  }
];

const southConnectorCommand = {
  name: 'name',
  type: 'MQTT',
  description: 'description',
  enabled: true,
  settings: {
    field: 'value'
  }
};
const southConnector = {
  id: 'id',
  ...southConnectorCommand
};
const oibusItemCommand = {
  name: 'name',
  settings: {
    field: 'value'
  },
  scanModeId: 'scanModeId'
};
const oibusItem = {
  id: 'id',
  connectorId: 'connectorId',
  ...oibusItemCommand
};
const page = {
  content: [oibusItem],
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

    expect(ctx.ok).toHaveBeenCalledWith(manifestList);
  });

  it('getSouthConnectorManifest() should return South connector manifest', async () => {
    ctx.params.id = 'MQTT';

    await southConnectorController.getSouthConnectorManifest(ctx);

    expect(ctx.ok).toHaveBeenCalledWith(mqttManifest);
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
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(southConnector.settings, mqttManifest.settings);
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
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(southConnector.settings, mqttManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith([southConnector, null]);
  });

  it('getSouthConnector() should return South connector', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.encryptionService.filterSecrets.mockReturnValue(southConnector.settings);

    await southConnectorController.getSouthConnector(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(southConnector.settings, mqttManifest.settings);
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
      ...southConnectorCommand
    };
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(southConnectorCommand.settings);
    ctx.app.reloadService.onCreateSouth.mockReturnValue(southConnector);

    await southConnectorController.createSouthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      southConnectorCommand.settings,
      null,
      mqttManifest.settings
    );
    expect(ctx.app.reloadService.onCreateSouth).toHaveBeenCalledWith(southConnectorCommand);
    expect(ctx.created).toHaveBeenCalledWith(southConnector);
  });

  it('createSouthConnector() should return 404 when manifest not found', async () => {
    ctx.request.body = {
      ...southConnectorCommand,
      type: 'invalid'
    };

    await southConnectorController.createSouthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateSouth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('createSouthConnector() should return 404 when body is null', async () => {
    ctx.request.body = null;

    await southConnectorController.createSouthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateSouth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('createSouthConnector() should return bad request when validation fails', async () => {
    ctx.request.body = {
      ...southConnectorCommand
    };
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await southConnectorController.createSouthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.settings, southConnectorCommand.settings);
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

    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      southConnectorCommand.settings,
      southConnector.settings,
      mqttManifest.settings
    );
    expect(ctx.app.reloadService.onUpdateSouthSettings).toHaveBeenCalledWith('id', southConnectorCommand);
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
    expect(ctx.app.reloadService.onUpdateSouthSettings).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'South manifest not found');
  });

  it('updateSouthConnector() should return 404 when body is null', async () => {
    ctx.request.body = null;
    ctx.params.id = 'id';

    await southConnectorController.updateSouthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouthSettings).not.toHaveBeenCalled();
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

    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouthSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateSouthConnector() should return not found when South connector not found', async () => {
    ctx.request.body = {
      ...southConnectorCommand
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(null);

    await southConnectorController.updateSouthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.settings, southConnectorCommand.settings);
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateSouthSettings).not.toHaveBeenCalled();
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
    ctx.app.repositoryService.southItemRepository.getSouthItem.mockReturnValue(oibusItem);

    await southConnectorController.getSouthItem(ctx);

    expect(ctx.app.repositoryService.southItemRepository.getSouthItem).toHaveBeenCalledWith('id');
    expect(ctx.ok).toHaveBeenCalledWith(oibusItem);
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
      ...oibusItemCommand
    };
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.reloadService.onCreateSouthItem.mockReturnValue(oibusItem);

    await southConnectorController.createSouthItem(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.items.settings, oibusItemCommand.settings);
    expect(ctx.app.reloadService.onCreateSouthItem).toHaveBeenCalledWith('southId', oibusItemCommand);
    expect(ctx.created).toHaveBeenCalledWith(oibusItem);
  });

  it('createSouthItem() should throw 404 when South connector not found', async () => {
    ctx.request.body = {
      ...oibusItemCommand,
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
      ...oibusItemCommand
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
      ...oibusItemCommand
    };
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);

    await southConnectorController.createSouthItem(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.items.settings, oibusItemCommand.settings);
    expect(ctx.app.reloadService.onCreateSouthItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateSouthItem() should update South item', async () => {
    ctx.params.southId = 'southId';
    ctx.request.body = {
      ...oibusItemCommand
    };
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.repositoryService.southItemRepository.getSouthItem.mockReturnValue(oibusItem);

    await southConnectorController.updateSouthItem(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.southItemRepository.getSouthItem).toHaveBeenCalledWith('id');
    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.items.settings, oibusItemCommand.settings);
    expect(ctx.app.reloadService.onUpdateSouthItemsSettings).toHaveBeenCalledWith('southId', oibusItem, oibusItemCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateSouthItem() should throw 404 when South connector not found', async () => {
    ctx.params.southId = 'southId';
    ctx.request.body = {
      ...oibusItemCommand,
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
      ...oibusItemCommand
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
    ctx.app.repositoryService.southItemRepository.getSouthItem.mockReturnValue(oibusItem);
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
      ...oibusItemCommand
    };
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.app.repositoryService.southItemRepository.getSouthItem.mockReturnValue(oibusItem);

    await southConnectorController.updateSouthItem(ctx);

    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
    expect(ctx.app.repositoryService.southItemRepository.getSouthItem).toHaveBeenCalledWith('id');
    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.items.settings, oibusItemCommand.settings);
    expect(ctx.app.reloadService.onUpdateSouthItemsSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('deleteSouthItem() should delete South item', async () => {
    ctx.params.id = 'id';

    await southConnectorController.deleteSouthItem(ctx);

    expect(ctx.app.reloadService.onDeleteSouthItem).toHaveBeenCalledWith('id');
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
    ctx.app.repositoryService.southItemRepository.getSouthItems.mockReturnValueOnce([oibusItem, oibusItem]);
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    await southConnectorController.exportSouthItems(ctx);

    expect(ctx.ok).toHaveBeenCalled();
    expect(ctx.body).toEqual('csv content');
    expect(csv.unparse).toHaveBeenCalledWith([
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
    ]);
  });

  it('uploadSouthItems() should import a csv file', async () => {
    ctx.params.southId = 'id';
    ctx.app.repositoryService.southConnectorRepository.getSouthConnector.mockReturnValue(southConnector);
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.app.repositoryService.southItemRepository.getSouthItems.mockReturnValueOnce([oibusItem, oibusItem]);
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
    ctx.app.repositoryService.southItemRepository.getSouthItems.mockReturnValueOnce([oibusItem, oibusItem]);
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
    ctx.app.repositoryService.southItemRepository.getSouthItems.mockReturnValueOnce([oibusItem, oibusItem]);
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
});
