import NorthConnectorController from './north-connector.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import { northTestManifest, northTestManifestWithItems } from '../../tests/__mocks__/north-service.mock';
import { NorthConnectorItemCommandDTO, NorthConnectorItemDTO } from '../../../../shared/model/north-connector.model';
import csv from 'papaparse';
import fs from 'node:fs/promises';

jest.mock('./validators/joi.validator');
jest.mock('papaparse');
jest.mock('node:fs/promises');

const ctx = new KoaContextMock();
const validator = new JoiValidator();
const northConnectorController = new NorthConnectorController(validator);

const northCacheSettings = {
  scanModeId: 'scanModeId',
  retryInterval: 1000,
  retryCount: 3,
  groupCount: 100,
  maxSendCount: 1000,
  timeout: 10000
};
const northArchiveSettings = {
  enabled: true,
  retentionDuration: 1000
};
const northConnectorCommand = {
  name: 'name',
  type: 'north-test',
  description: 'description',
  enabled: true,
  settings: {
    field: 'value'
  },
  caching: northCacheSettings,
  archive: northArchiveSettings
};
const northConnector = {
  id: 'id',
  ...northConnectorCommand
};
const northConnectorWithItems = {
  id: 'id',
  ...northConnectorCommand,
  type: 'north-test-with-items'
};
const itemCommand: NorthConnectorItemCommandDTO = {
  name: 'name',
  enabled: true,
  settings: {
    regex: '.*'
  }
};
const item: NorthConnectorItemDTO = {
  id: 'id',
  connectorId: 'connectorId',
  ...itemCommand
};
const page = {
  content: [item],
  size: 10,
  number: 1,
  totalElements: 1,
  totalPages: 1
};
let getManifestWithItemsModeSpy: jest.SpyInstance;

describe('North connector controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('getNorthConnectorTypes() should return North connector types', async () => {
    await northConnectorController.getNorthConnectorTypes(ctx);

    expect(ctx.ok).toHaveBeenCalledWith([
      {
        id: 'north-test',
        category: 'debug',
        name: 'Test',
        description: '',
        modes: {
          files: true,
          points: true,
          items: false
        }
      },
      {
        id: 'north-test-with-items',
        category: 'debug',
        name: 'Test',
        description: '',
        modes: {
          files: true,
          points: true,
          items: true
        }
      }
    ]);
  });

  it('getNorthConnectorManifest() should return North connector manifest', async () => {
    ctx.params.id = 'north-test';

    await northConnectorController.getNorthConnectorManifest(ctx);

    expect(ctx.ok).toHaveBeenCalledWith(northTestManifest);
  });

  it('getNorthConnectorManifest() should return not found', async () => {
    ctx.params.id = 'invalid';

    await northConnectorController.getNorthConnectorManifest(ctx);

    expect(ctx.throw).toHaveBeenCalledWith(404, 'North not found');
  });

  it('getNorthConnectors() should return North connectors', async () => {
    ctx.app.repositoryService.northConnectorRepository.getNorthConnectors.mockReturnValue([northConnector]);
    ctx.app.encryptionService.filterSecrets.mockReturnValue(northConnector.settings);

    await northConnectorController.getNorthConnectors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnectors).toHaveBeenCalled();
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(northConnector.settings, northTestManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith([northConnector]);
  });

  it('getNorthConnectors() should return null when manifest is missing', async () => {
    const invalidNorthConnector = {
      ...northConnector,
      type: 'invalid'
    };
    ctx.app.repositoryService.northConnectorRepository.getNorthConnectors.mockReturnValue([northConnector, invalidNorthConnector]);
    ctx.app.encryptionService.filterSecrets.mockReturnValue(northConnector.settings);

    await northConnectorController.getNorthConnectors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnectors).toHaveBeenCalled();
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(northConnector.settings, northTestManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith([northConnector, null]);
  });

  it('getNorthConnector() should return North connector', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.encryptionService.filterSecrets.mockReturnValue(northConnector.settings);

    await northConnectorController.getNorthConnector(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(northConnector.settings, northTestManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith(northConnector);
  });

  it('getNorthConnector() should return found when North connector not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.getNorthConnector(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('getNorthConnector() should return not found when manifest not found', async () => {
    ctx.params.id = 'id';
    const invalidNorthConnector = {
      ...northConnector,
      type: 'invalid'
    };
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(invalidNorthConnector);

    await northConnectorController.getNorthConnector(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North type not found');
  });

  it('createNorthConnector() should create North connector', async () => {
    ctx.request.body = {
      north: { ...northConnectorCommand },
      subscriptions: [
        { type: 'south', subscription: { id: 'id1' } },
        { type: 'external-source', externalSubscription: { id: 'id2' } }
      ]
    };
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.reloadService.onCreateNorth.mockReturnValue(northConnector);

    await northConnectorController.createNorthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      northConnectorCommand.settings,
      undefined,
      northTestManifest.settings
    );
    expect(ctx.app.reloadService.onCreateNorth).toHaveBeenCalledWith(northConnectorCommand);
    expect(ctx.app.reloadService.onStartNorth).toHaveBeenCalledWith('id');
    expect(ctx.created).toHaveBeenCalledWith(northConnector);
  });

  it('createNorthConnector() should create North connector and not start it', async () => {
    ctx.request.body = {
      north: { ...northConnectorCommand, enabled: false },
      subscriptions: [
        { type: 'south', subscription: { id: 'id1' } },
        { type: 'external-source', externalSubscription: { id: 'id2' } }
      ]
    };
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.reloadService.onCreateNorth.mockReturnValue(northConnector);

    await northConnectorController.createNorthConnector(ctx);

    expect(ctx.app.reloadService.onCreateNorth).toHaveBeenCalledWith({ ...northConnectorCommand, enabled: false });
    expect(ctx.app.reloadService.onStartNorth).not.toHaveBeenCalled();
    expect(ctx.created).toHaveBeenCalledWith(northConnector);
  });

  it('createNorthConnector() should create North connector with duplicate', async () => {
    ctx.request.body = {
      north: { ...northConnectorCommand, enabled: false },
      subscriptions: [
        { type: 'south', subscription: { id: 'id1' } },
        { type: 'external-source', externalSubscription: { id: 'id2' } }
      ]
    };
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.reloadService.onCreateNorth.mockReturnValue(northConnector);
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValueOnce(northConnector);
    ctx.query.duplicateId = 'duplicateId';

    await northConnectorController.createNorthConnector(ctx);

    expect(ctx.app.reloadService.onCreateNorth).toHaveBeenCalledWith({ ...northConnectorCommand, enabled: false });
    expect(ctx.app.reloadService.onStartNorth).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('duplicateId');
    expect(ctx.created).toHaveBeenCalledWith(northConnector);
    ctx.query.duplicateId = null;
  });

  it('createNorthConnector() should throw not found when creating North connector with undefined duplicate', async () => {
    ctx.request.body = {
      north: { ...northConnectorCommand, enabled: false },
      subscriptions: [
        { type: 'south', subscription: { id: 'id1' } },
        { type: 'external-source', externalSubscription: { id: 'id2' } }
      ]
    };
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.reloadService.onCreateNorth.mockReturnValue(northConnector);
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValueOnce(null);
    ctx.query.duplicateId = 'bad';

    await northConnectorController.createNorthConnector(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('bad');
    expect(ctx.app.reloadService.onCreateNorth).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onStartNorth).not.toHaveBeenCalled();
    expect(ctx.created).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
    ctx.query.duplicateId = null;
  });

  it('createNorthConnector() should return 404 when manifest not found', async () => {
    ctx.request.body = {
      north: {
        ...northConnectorCommand,
        type: 'invalid'
      },
      subscriptions: []
    };

    await northConnectorController.createNorthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('createNorthConnector() should return bad request when north body is null', async () => {
    ctx.request.body = {
      subscriptions: [],
      north: null
    };

    await northConnectorController.createNorthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('createNorthConnector() should return bad request when validation fails', async () => {
    ctx.request.body = {
      north: { ...northConnectorCommand },
      subscriptions: []
    };
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await northConnectorController.createNorthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateNorthConnector() should update North connector', async () => {
    ctx.request.body = {
      north: { ...northConnectorCommand },
      subscriptions: [
        { type: 'south', subscription: { id: 'id1' } },
        { type: 'south', subscription: { id: 'id2' } }
      ],
      subscriptionsToDelete: [{ type: 'south', subscription: { id: 'id5' } }]
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.repositoryService.subscriptionRepository.getNorthSubscriptions.mockReturnValue(['id1']);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);

    await northConnectorController.updateNorthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.repositoryService.subscriptionRepository.getNorthSubscriptions).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      northConnectorCommand.settings,
      northConnector.settings,
      northTestManifest.settings
    );
    expect(ctx.app.repositoryService.subscriptionRepository.createNorthSubscription).toHaveBeenCalledWith('id', 'id2');
    expect(ctx.app.repositoryService.subscriptionRepository.deleteNorthSubscription).toHaveBeenCalledWith('id', 'id5');
    expect(ctx.app.reloadService.onUpdateNorthSettings).toHaveBeenCalledWith('id', northConnectorCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateNorthConnector() should throw 404 when manifest not found', async () => {
    ctx.request.body = {
      north: { ...northConnectorCommand, type: 'invalid' },
      subscriptions: [],
      subscriptionsToDelete: []
    };
    ctx.params.id = 'id';

    await northConnectorController.updateNorthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateNorthSettings).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('updateNorthConnector() should return bad request when validation fails', async () => {
    ctx.request.body = {
      north: { ...northConnectorCommand },
      subscriptions: [],
      subscriptionsToDelete: []
    };
    ctx.params.id = 'id';
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await northConnectorController.updateNorthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateNorthSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateNorthConnector() should return not found when North connector not found', async () => {
    ctx.request.body = {
      north: { ...northConnectorCommand },
      subscriptions: [],
      subscriptionsToDelete: []
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.updateNorthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateNorthSettings).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('updateNorthConnector() should return bad request when body is null', async () => {
    ctx.request.body = {
      north: null,
      subscriptions: [],
      subscriptionsToDelete: []
    };
    ctx.params.id = 'id';

    await northConnectorController.updateNorthConnector(ctx);

    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('deleteNorthConnector() should delete North connector', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.deleteNorthConnector(ctx);

    expect(ctx.app.repositoryService.subscriptionRepository.deleteNorthSubscriptions).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.onDeleteNorth).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteNorthConnector() should return not found when North connector not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.deleteNorthConnector(ctx);

    expect(ctx.app.repositoryService.subscriptionRepository.deleteNorthSubscriptions).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onDeleteNorth).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('startNorthConnector() should enable North connector', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.startNorthConnector(ctx);

    expect(ctx.app.reloadService.onStartNorth).toHaveBeenCalledTimes(1);
    expect(ctx.badRequest).not.toHaveBeenCalled();
  });

  it('startNorthConnector() should throw badRequest if fail to enable', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    ctx.app.reloadService.onStartNorth.mockImplementation(() => {
      throw new Error('bad');
    });

    await northConnectorController.startNorthConnector(ctx);

    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('startNorthConnector() should return not found if North not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.startNorthConnector(ctx);

    expect(ctx.app.reloadService.onStartNorth).not.toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('stopNorthConnector() should enable North connector', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.stopNorthConnector(ctx);

    expect(ctx.app.reloadService.onStopNorth).toHaveBeenCalledTimes(1);
    expect(ctx.badRequest).not.toHaveBeenCalled();
  });

  it('stopNorthConnector() should throw badRequest if fail to enable', async () => {
    ctx.params.enable = true;
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    ctx.app.reloadService.onStopNorth.mockImplementation(() => {
      throw new Error('bad');
    });

    await northConnectorController.stopNorthConnector(ctx);

    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('stopNorthConnector() should return not found if North not found', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.stopNorthConnector(ctx);

    expect(ctx.app.reloadService.onStopNorth).not.toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('resetNorthMetrics() should reset North metrics', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.resetNorthMetrics(ctx);

    expect(ctx.app.reloadService.oibusEngine.resetNorthMetrics).toHaveBeenCalledWith('id');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('resetNorthMetrics() should not reset North metrics if not found', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.resetNorthMetrics(ctx);

    expect(ctx.app.reloadService.oibusEngine.resetNorthMetrics).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('getFileErrors() should return North connector error files', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getErrorFiles.mockReturnValue([]);

    await northConnectorController.getFileErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getErrorFiles).toHaveBeenCalledWith(northConnector.id, '', '', 'file');
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getFileErrors() should return North connector error files with no file name provided', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = null;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getErrorFiles.mockReturnValue([]);

    await northConnectorController.getFileErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getErrorFiles).toHaveBeenCalledWith(northConnector.id, '', '', '');
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getFileErrors() should not return North connector error files if not found', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.getFileErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getErrorFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getFileErrorContent() should return North connector error file content', async () => {
    ctx.params.northId = 'id';
    ctx.params.filename = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getErrorFileContent.mockReturnValue('content');
    ctx.attachment = jest.fn();

    await northConnectorController.getFileErrorContent(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getErrorFileContent).toHaveBeenCalledWith(northConnector.id, 'file');
    expect(ctx.ok).toHaveBeenCalledWith('content');
  });

  it('getFileErrorContent() should not return North connector error file content if not found', async () => {
    ctx.params.northId = 'id';
    ctx.params.filename = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.getFileErrorContent(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getErrorFileContent).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getFullFileErrorContent() should not return North connector error file content if file not found', async () => {
    ctx.params.northId = 'id';
    ctx.params.filename = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getErrorFileContent.mockReturnValue(null);
    ctx.attachment = jest.fn();

    await northConnectorController.getFileErrorContent(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getErrorFileContent).toHaveBeenCalledWith(northConnector.id, 'file');
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('removeFileErrors() should remove error file', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeFileErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeErrorFiles).toHaveBeenCalledWith(northConnector.id, ['file1', 'file2']);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('removeFileErrors() should not remove error file if not found', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.removeFileErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeErrorFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('removeFileErrors() should not remove error file if invalid body', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = 'invalid body';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeFileErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeErrorFiles).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(400, 'Invalid file list');
  });

  it('retryErrorFiles() should retry error file', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.retryErrorFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryErrorFiles).toHaveBeenCalledWith(northConnector.id, ['file1', 'file2']);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('retryErrorFiles() should not retry error file if not found', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.retryErrorFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryErrorFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('retryErrorFiles() should not retry error file if invalid body', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = 'invalid body';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.retryErrorFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryErrorFiles).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(400, 'Invalid file list');
  });

  it('removeAllErrorFiles() should remove all error file', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeAllErrorFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeAllErrorFiles).toHaveBeenCalledWith(northConnector.id);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('removeAllErrorFiles() should not remove all error file if not found', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.removeAllErrorFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeAllErrorFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('retryAllErrorFiles() should retry all error file', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.retryAllErrorFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryAllErrorFiles).toHaveBeenCalledWith(northConnector.id);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('retryAllErrorFiles() should not retry all error file if not found', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.retryAllErrorFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryAllErrorFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getCacheFiles() should return North connector cache files', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getCacheFiles.mockReturnValue([]);

    await northConnectorController.getCacheFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getCacheFiles).toHaveBeenCalledWith(northConnector.id, '', '', 'file');
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getCacheFiles() should return North connector cache files with no file name provided', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = null;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getCacheFiles.mockReturnValue([]);

    await northConnectorController.getCacheFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getCacheFiles).toHaveBeenCalledWith(northConnector.id, '', '', '');
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getCacheFiles() should not return North connector cache files if not found', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.getCacheFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getCacheFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getCacheFileContent() should return North connector cache file content', async () => {
    ctx.params.northId = 'id';
    ctx.params.filename = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getCacheFileContent.mockReturnValue('content');
    ctx.attachment = jest.fn();

    await northConnectorController.getCacheFileContent(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getCacheFileContent).toHaveBeenCalledWith(northConnector.id, 'file');
    expect(ctx.ok).toHaveBeenCalledWith('content');
  });

  it('getCacheFileContent() should not return North connector cache file content if not found', async () => {
    ctx.params.northId = 'id';
    ctx.params.filename = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.getCacheFileContent(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getCacheFileContent).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getFullCacheFileContent() should not return North connector cache file content if file not found', async () => {
    ctx.params.northId = 'id';
    ctx.params.filename = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getCacheFileContent.mockReturnValue(null);
    ctx.attachment = jest.fn();

    await northConnectorController.getCacheFileContent(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getCacheFileContent).toHaveBeenCalledWith(northConnector.id, 'file');
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('removeCacheFiles() should remove cache file', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeCacheFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeCacheFiles).toHaveBeenCalledWith(northConnector.id, ['file1', 'file2']);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('removeCacheFiles() should not remove cache file if not found', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.removeCacheFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeCacheFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('removeCacheFiles() should not remove cache file if invalid body', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = 'invalid body';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeCacheFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeCacheFiles).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(400, 'Invalid file list');
  });

  it('archiveCacheFiles() should remove cache file', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.archiveCacheFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.archiveCacheFiles).toHaveBeenCalledWith(northConnector.id, ['file1', 'file2']);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('archiveCacheFiles() should not remove cache file if not found', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.archiveCacheFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.archiveCacheFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('archiveCacheFiles() should not remove cache file if invalid body', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = 'invalid body';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.archiveCacheFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.archiveCacheFiles).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(400, 'Invalid file list');
  });

  it('getArchiveFiles() should return North connector archive files', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getArchiveFiles.mockReturnValue([]);

    await northConnectorController.getArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getArchiveFiles).toHaveBeenCalledWith(northConnector.id, '', '', 'file');
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getArchiveFiles() should return North connector archive files with no file name provided', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = null;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getArchiveFiles.mockReturnValue([]);

    await northConnectorController.getArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getArchiveFiles).toHaveBeenCalledWith(northConnector.id, '', '', '');
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getArchiveFiles() should not return North connector archive files if not found', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.getArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getArchiveFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getArchiveFileContent() should return North connector archive file content', async () => {
    ctx.params.northId = 'id';
    ctx.params.filename = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getArchiveFileContent.mockReturnValue('content');
    ctx.attachment = jest.fn();

    await northConnectorController.getArchiveFileContent(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getArchiveFileContent).toHaveBeenCalledWith(northConnector.id, 'file');
    expect(ctx.ok).toHaveBeenCalledWith('content');
  });

  it('getArchiveFileContent() should not return North connector archive file content if not found', async () => {
    ctx.params.northId = 'id';
    ctx.params.filename = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.getArchiveFileContent(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getArchiveFileContent).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getFullArchiveFileContent() should not return North connector archive file content if file not found', async () => {
    ctx.params.northId = 'id';
    ctx.params.filename = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getArchiveFileContent.mockReturnValue(null);
    ctx.attachment = jest.fn();

    await northConnectorController.getArchiveFileContent(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getArchiveFileContent).toHaveBeenCalledWith(northConnector.id, 'file');
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('removeArchiveFiles() should remove archive file', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeArchiveFiles).toHaveBeenCalledWith(northConnector.id, ['file1', 'file2']);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('removeArchiveFiles() should not remove archive file if not found', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.removeArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeArchiveFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('removeArchiveFiles() should not remove archive file if invalid body', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = 'invalid body';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeArchiveFiles).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(400, 'Invalid file list');
  });

  it('retryArchiveFiles() should retry archive file', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.retryArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryArchiveFiles).toHaveBeenCalledWith(northConnector.id, ['file1', 'file2']);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('retryArchiveFiles() should not retry archive file if not found', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.retryArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryArchiveFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('retryArchiveFiles() should not retry archive file if invalid body', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = 'invalid body';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.retryArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryArchiveFiles).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(400, 'Invalid file list');
  });

  it('removeAllArchiveFiles() should remove all archive file', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeAllArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeAllArchiveFiles).toHaveBeenCalledWith(northConnector.id);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('removeAllArchiveFiles() should not remove all archive file if not found', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.removeAllArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeAllArchiveFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('retryAllArchiveFiles() should retry all archive file', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.retryAllArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryAllArchiveFiles).toHaveBeenCalledWith(northConnector.id);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('retryAllArchiveFiles() should not retry all archive file if not found', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.retryAllArchiveFiles(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryAllArchiveFiles).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getCacheValues() should return North connector cache values', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getCacheValues.mockReturnValue([]);

    await northConnectorController.getCacheValues(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getCacheValues).toHaveBeenCalledWith(northConnector.id, 'file');
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getCacheValues() should return North connector cache values with no file name provided', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = null;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getCacheValues.mockReturnValue([]);

    await northConnectorController.getCacheValues(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getCacheValues).toHaveBeenCalledWith(northConnector.id, '');
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getCacheValues() should not return North connector cache values if not found', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.getCacheValues(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getCacheValues).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('removeCacheValues() should remove cache values', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeCacheValues(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeCacheValues).toHaveBeenCalledWith(northConnector.id, ['file1', 'file2']);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('removeCacheValues() should not remove cache values if not found', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.removeCacheValues(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeCacheValues).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('removeCacheValues() should not remove cache values if invalid body', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = 'invalid body';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeCacheValues(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeCacheValues).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(400, 'Invalid file list');
  });

  it('removeAllCacheValues() should remove all cache values', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeAllCacheValues(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeAllCacheValues).toHaveBeenCalledWith(northConnector.id);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('removeAllCacheValues() should not remove all cache values if not found', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.removeAllCacheValues(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeAllCacheValues).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('getValueErrors() should return North connector cache value errors', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getValueErrors.mockReturnValue([]);

    await northConnectorController.getValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getValueErrors).toHaveBeenCalledWith(northConnector.id, '', '', 'file');
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getValueErrors() should return North connector cache value errors with no file name provided', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = null;
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.reloadService.oibusEngine.getValueErrors.mockReturnValue([]);

    await northConnectorController.getValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getValueErrors).toHaveBeenCalledWith(northConnector.id, '', '', '');
    expect(ctx.ok).toHaveBeenCalledWith([]);
  });

  it('getValueErrors() should not return North connector cache value errors if not found', async () => {
    ctx.params.northId = 'id';
    ctx.query.fileNameContains = 'file';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.getValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.getValueErrors).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('removeValueErrors() should remove cache value errors', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeValueErrors).toHaveBeenCalledWith(northConnector.id, ['file1', 'file2']);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('removeValueErrors() should not remove cache value errors if not found', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.removeValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeValueErrors).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('removeValueErrors() should not remove cache value errors if invalid body', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = 'invalid body';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeValueErrors).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(400, 'Invalid file list');
  });

  it('removeAllValueErrors() should remove all cache value errors', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.removeAllValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeAllValueErrors).toHaveBeenCalledWith(northConnector.id);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('removeAllValueErrors() should not remove all cache value errors if not found', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.removeAllValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.removeAllValueErrors).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('retryValueErrors() should retry cache value errors', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.retryValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryValueErrors).toHaveBeenCalledWith(northConnector.id, ['file1', 'file2']);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('retryValueErrors() should not retry cache value errors if not found', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = ['file1', 'file2'];
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.retryValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryValueErrors).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('retryValueErrors() should not retry cache value errors if invalid body', async () => {
    ctx.params.northId = 'id';
    ctx.request.body = 'invalid body';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.retryValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryValueErrors).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(400, 'Invalid file list');
  });

  it('retryAllValueErrors() should retry all cache value errors', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    await northConnectorController.retryAllValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryAllValueErrors).toHaveBeenCalledWith(northConnector.id);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('retryAllValueErrors() should not retry all cache value errors if not found', async () => {
    ctx.params.northId = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.retryAllValueErrors(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.reloadService.oibusEngine.retryAllValueErrors).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('testNorthConnection() should test North connector settings on connector update', async () => {
    const createdNorth = {
      testConnection: jest.fn()
    };
    ctx.request.body = {
      ...northConnectorCommand
    };
    ctx.params.id = 'id';
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    (ctx.app.northService.createNorth as jest.Mock).mockReturnValue(createdNorth);

    await northConnectorController.testNorthConnection(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      northConnectorCommand.settings,
      northConnector.settings,
      northTestManifest.settings
    );
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('testNorthConnection() should throw 404 when manifest not found', async () => {
    ctx.request.body = {
      ...northConnectorCommand,
      type: 'invalid'
    };

    await northConnectorController.testNorthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.northService.createNorth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('testNorthConnection() should return 404 when North connector is not found', async () => {
    ctx.request.body = {
      ...northConnectorCommand
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.testNorthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.northService.createNorth).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledTimes(1);
  });

  it('testNorthConnection() should test connector on connector creation', async () => {
    ctx.request.body = {
      ...northConnectorCommand
    };
    ctx.params.id = 'create';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);

    await northConnectorController.testNorthConnection(ctx);

    expect(validator.validateSettings).toHaveBeenCalledTimes(1);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      northConnectorCommand.settings,
      undefined,
      northTestManifest.settings
    );
    expect(ctx.notFound).not.toHaveBeenCalled();
  });

  it('testNorthConnection() should test connector with duplicate', async () => {
    ctx.request.body = {
      ...northConnectorCommand
    };
    ctx.params.id = 'create';
    ctx.query.duplicateId = 'duplicateId';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);

    await northConnectorController.testNorthConnection(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('duplicateId');
    expect(validator.validateSettings).toHaveBeenCalledTimes(1);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      northConnectorCommand.settings,
      northConnector.settings,
      northTestManifest.settings
    );
    expect(ctx.notFound).not.toHaveBeenCalled();
    ctx.query.duplicateId = null;
  });

  it('testNorthConnection() should test connector with not found duplicate', async () => {
    ctx.request.body = {
      ...northConnectorCommand
    };
    ctx.params.id = 'create';
    ctx.query.duplicateId = 'bad';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);

    await northConnectorController.testNorthConnection(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('bad');
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
    ctx.query.duplicateId = null;
  });

  it('testNorthConnection() should return 404 when body is null', async () => {
    ctx.request.body = null;

    await northConnectorController.testNorthConnection(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.northService.createNorth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('testNorthConnection() should return bad request when validation fails', async () => {
    ctx.request.body = {
      ...northConnectorCommand
    };
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await northConnectorController.testNorthConnection(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.northService.createNorth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });
});

describe('North connector controller with items', () => {
  const throwError = () => {
    throw new Error('jest mock error');
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    ctx.params.northId = 'northId';
    ctx.params.id = 'itemId';
    ctx.request.body = {};

    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnectorWithItems);
    ctx.app.repositoryService.northItemRepository.getNorthItem.mockReturnValue(item);
    ctx.app.reloadService.onCreateNorthItem.mockReturnValue(item);

    getManifestWithItemsModeSpy = jest
      .spyOn(northConnectorController as any, 'getManifestWithItemsMode')
      .mockReturnValue(northTestManifestWithItems);
  });

  it('private getManifestWithItemsMode() should return manifest', () => {
    getManifestWithItemsModeSpy.mockRestore();
    const manifest = northConnectorController['getManifestWithItemsMode'](ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('northId');
    expect(ctx.app.northService.getInstalledNorthManifests).toHaveBeenCalled();
    expect(manifest).toEqual(northTestManifestWithItems);
  });

  it('private getManifestWithItemsMode() should return manifest for new north', () => {
    ctx.params.northId = 'create';
    ctx.params.northType = 'north-test-with-items';
    getManifestWithItemsModeSpy.mockRestore();
    const manifest = northConnectorController['getManifestWithItemsMode'](ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).not.toHaveBeenCalled();
    expect(ctx.app.northService.getInstalledNorthManifests).toHaveBeenCalled();
    expect(manifest).toEqual(northTestManifestWithItems);
  });

  it('private getManifestWithItemsMode() should throw on north connector not found', () => {
    getManifestWithItemsModeSpy.mockRestore();
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    try {
      northConnectorController['getManifestWithItemsMode'](ctx);
    } catch (error) {
      expect(ctx.throw).toHaveBeenCalledWith(404, 'North not found');
    }
  });

  it('private getManifestWithItemsMode() should throw on north connector does not have items mode', () => {
    getManifestWithItemsModeSpy.mockRestore();
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);

    try {
      northConnectorController['getManifestWithItemsMode'](ctx);
    } catch (error) {
      expect(ctx.throw).toHaveBeenCalledWith(404, 'North does not support items');
    }
  });

  it('listNorthItems() should return all north items', async () => {
    ctx.app.repositoryService.northItemRepository.listNorthItems.mockReturnValue([item]);

    await northConnectorController.listNorthItems(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.repositoryService.northItemRepository.listNorthItems).toHaveBeenCalledWith('northId');
    expect(ctx.ok).toHaveBeenCalledWith([item]);
  });

  it('listNorthItems() should return bad request when north connector or manifest not found', async () => {
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    try {
      await northConnectorController.listNorthItems(ctx);
    } catch (error) {
      expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
      expect(ctx.app.repositoryService.northItemRepository.listNorthItems).not.toHaveBeenCalled();
      expect(ctx.ok).not.toHaveBeenCalled();
      expect(error).toEqual(new Error('jest mock error'));
    }
  });

  it('searchNorthItems() should return north items', async () => {
    ctx.query = {
      page: 1,
      name: 'name'
    };
    const searchParams = {
      page: 1,
      name: 'name'
    };
    ctx.app.repositoryService.northItemRepository.searchNorthItems.mockReturnValue(page);

    await northConnectorController.searchNorthItems(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.repositoryService.northItemRepository.searchNorthItems).toHaveBeenCalledWith('northId', searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('searchNorthItems() should return north items with default search params', async () => {
    ctx.query = {};
    const searchParams = {
      page: 0,
      name: null
    };
    ctx.app.repositoryService.northItemRepository.searchNorthItems.mockReturnValue(page);

    await northConnectorController.searchNorthItems(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.repositoryService.northItemRepository.searchNorthItems).toHaveBeenCalledWith('northId', searchParams);
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('searchNorthItems() should return bad request when north connector or manifest not found', async () => {
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    try {
      await northConnectorController.searchNorthItems(ctx);
    } catch (error) {
      expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
      expect(ctx.app.repositoryService.northItemRepository.searchNorthItems).not.toHaveBeenCalled();
      expect(ctx.ok).not.toHaveBeenCalled();
      expect(error).toEqual(new Error('jest mock error'));
    }
  });

  it('getnorthItem() should return north item', async () => {
    await northConnectorController.getNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.repositoryService.northItemRepository.getNorthItem).toHaveBeenCalledWith('itemId');
    expect(ctx.ok).toHaveBeenCalledWith(item);
  });

  it('getnorthItem() should return not found when north item not found', async () => {
    ctx.app.repositoryService.northItemRepository.getNorthItem.mockReturnValue(null);

    await northConnectorController.getNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.repositoryService.northItemRepository.getNorthItem).toHaveBeenCalledWith('itemId');
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('getnorthItem() should return bad request when north connector or manifest not found', async () => {
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    try {
      await northConnectorController.getNorthItem(ctx);
    } catch (error) {
      expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
      expect(ctx.app.repositoryService.northItemRepository.getNorthItem).not.toHaveBeenCalled();
      expect(ctx.ok).not.toHaveBeenCalled();
      expect(error).toEqual(new Error('jest mock error'));
    }
  });

  it('createNorthItem() should create north item', async () => {
    ctx.request.body = {
      ...itemCommand
    };

    await northConnectorController.createNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifestWithItems.items.settings, itemCommand.settings);
    expect(ctx.app.reloadService.onCreateNorthItem).toHaveBeenCalledWith('northId', itemCommand);
    expect(ctx.created).toHaveBeenCalledWith(item);
  });

  it('createNorthItem() should return bad request when north connector or manifest not found', async () => {
    ctx.request.body = {
      ...itemCommand
    };
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    await northConnectorController.createNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorthItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('createNorthItem() should return bad request when validation fails', async () => {
    ctx.request.body = {
      ...itemCommand
    };
    const validationError = new Error('invalid settings');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await northConnectorController.createNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifestWithItems.items.settings, itemCommand.settings);
    expect(ctx.app.reloadService.onCreateNorthItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('createNorthItem() should return bad request when validation fails due to missing body', async () => {
    ctx.request.body = undefined;

    await northConnectorController.createNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).not.toHaveBeenCalled();
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorthItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('createNorthItem() should return bad request when validation fails due to missing settings', async () => {
    ctx.request.body = {};

    await northConnectorController.createNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).not.toHaveBeenCalled();
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorthItem).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('updateNorthItem() should update north item', async () => {
    ctx.request.body = {
      ...itemCommand
    };

    await northConnectorController.updateNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.repositoryService.northItemRepository.getNorthItem).toHaveBeenCalledWith('itemId');
    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifestWithItems.items.settings, itemCommand.settings);
    expect(ctx.app.reloadService.onUpdateNorthItemsSettings).toHaveBeenCalledWith('northId', item, itemCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateNorthItem() should return bad request when north connector or manifest not found', async () => {
    ctx.request.body = {
      ...itemCommand,
      type: 'invalid'
    };
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    await northConnectorController.updateNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.repositoryService.northItemRepository.getNorthItem).not.toHaveBeenCalled();
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateNorthItemsSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('updateNorthItem() should return bad request when validation fails', async () => {
    ctx.request.body = {
      ...itemCommand
    };
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await northConnectorController.updateNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.repositoryService.northItemRepository.getNorthItem).toHaveBeenCalledWith('itemId');
    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifestWithItems.items.settings, itemCommand.settings);
    expect(ctx.app.reloadService.onUpdateNorthItemsSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateNorthItem() should return not found when north item is not found', async () => {
    ctx.request.body = {
      ...itemCommand
    };
    ctx.app.repositoryService.northItemRepository.getNorthItem.mockReturnValue(null);

    await northConnectorController.updateNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.repositoryService.northItemRepository.getNorthItem).toHaveBeenCalledWith('itemId');
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateNorthItemsSettings).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('updateNorthItem() should return bad request when validation fails due to missing body', async () => {
    ctx.request.body = undefined;

    await northConnectorController.updateNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.northItemRepository.getNorthItem).not.toHaveBeenCalled();
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateNorthItemsSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('updateNorthItem() should return bad request when validation fails due to missing settings', async () => {
    ctx.request.body = {};

    await northConnectorController.updateNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.northItemRepository.getNorthItem).not.toHaveBeenCalled();
    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateNorthItemsSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalled();
  });

  it('deleteNorthItem() should delete north item', async () => {
    await northConnectorController.deleteNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.reloadService.onDeleteNorthItem).toHaveBeenCalledWith('itemId');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteNorthItem() should return bad request when north connector or manifest not found', async () => {
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    try {
      await northConnectorController.deleteNorthItem(ctx);
    } catch (error) {
      expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
      expect(ctx.app.reloadService.onDeleteNorthItem).not.toHaveBeenCalled();
      expect(ctx.noContent).not.toHaveBeenCalled();
      expect(error).toEqual(new Error('jest mock error'));
    }
  });

  it('enableNorthItem() should enable north item', async () => {
    await northConnectorController.enableNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.reloadService.onEnableNorthItem).toHaveBeenCalledWith('itemId');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('enableNorthItem() should return bad request when north connector or manifest not found', async () => {
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    try {
      await northConnectorController.enableNorthItem(ctx);
    } catch (error) {
      expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
      expect(ctx.app.reloadService.onEnableNorthItem).not.toHaveBeenCalled();
      expect(ctx.noContent).not.toHaveBeenCalled();
      expect(error).toEqual(new Error('jest mock error'));
    }
  });

  it('disableNorthItem() should disable north item', async () => {
    await northConnectorController.disableNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.reloadService.onDisableNorthItem).toHaveBeenCalledWith('itemId');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('disableNorthItem() should return bad request when north connector or manifest not found', async () => {
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    try {
      await northConnectorController.disableNorthItem(ctx);
    } catch (error) {
      expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
      expect(ctx.app.reloadService.onDisableNorthItem).not.toHaveBeenCalled();
      expect(ctx.noContent).not.toHaveBeenCalled();
      expect(error).toEqual(new Error('jest mock error'));
    }
  });

  it('deleteAllNorthItem() should delete all north items', async () => {
    await northConnectorController.deleteAllNorthItem(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.app.reloadService.onDeleteAllNorthItems).toHaveBeenCalledWith('northId');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteAllNorthItem() should return bad request when north connector or manifest not found', async () => {
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    try {
      await northConnectorController.deleteAllNorthItem(ctx);
    } catch (error) {
      expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
      expect(ctx.app.reloadService.onDeleteAllNorthItems).not.toHaveBeenCalled();
      expect(ctx.noContent).not.toHaveBeenCalled();
      expect(error).toEqual(new Error('jest mock error'));
    }
  });

  it('northItemsToCsv() should download a csv file', async () => {
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
    (csv.unparse as jest.Mock).mockReturnValueOnce('csv content');

    await northConnectorController.northItemsToCsv(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalled();
    expect(ctx.body).toEqual('csv content');
    expect(csv.unparse).toHaveBeenCalledWith([
      {
        name: 'name',
        enabled: true,
        settings_regex: '.*'
      },
      {
        name: 'item2',
        enabled: true,
        settings_objectArray: '[]',
        settings_objectSettings: '{}',
        settings_objectValue: 1
      }
    ]);
  });

  it('northItemsToCsv() should return bad request when north connector or manifest not found', async () => {
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    try {
      await northConnectorController.northItemsToCsv(ctx);
    } catch (error) {
      expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
      expect(ctx.ok).not.toHaveBeenCalled();
      expect(csv.unparse).not.toHaveBeenCalled();
      expect(error).toEqual(new Error('jest mock error'));
    }
  });

  it('exportNorthItems() should download a csv file', async () => {
    ctx.app.repositoryService.northItemRepository.getNorthItems.mockReturnValueOnce([
      item,
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: { objectSettings: {}, objectArray: [], objectValue: 1 }
      }
    ]);
    (csv.unparse as jest.Mock).mockReturnValueOnce('csv content');

    await northConnectorController.exportNorthItems(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalled();
    expect(ctx.body).toEqual('csv content');
    expect(csv.unparse).toHaveBeenCalledWith([
      {
        name: 'name',
        enabled: true,
        settings_regex: '.*'
      },
      {
        name: 'item2',
        enabled: true,
        settings_objectArray: '[]',
        settings_objectSettings: '{}',
        settings_objectValue: 1
      }
    ]);
  });

  it('exportNorthItems() should return bad request when north connector or manifest not found', async () => {
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    try {
      await northConnectorController.exportNorthItems(ctx);
    } catch (error) {
      expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
      expect(ctx.ok).not.toHaveBeenCalled();
      expect(csv.unparse).not.toHaveBeenCalled();
      expect(error).toEqual(new Error('jest mock error'));
    }
  });

  it('checkImportNorthItems() should check import of items in a csv file with new north', async () => {
    ctx.params.northId = 'create';
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body.itemIdsToDelete = '[]';
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (validator.validateSettings as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('validation fail');
      })
      .mockImplementationOnce(() => {
        return true;
      });
    (csv.parse as jest.Mock).mockReturnValue({
      data: [
        {
          name: 'item1',
          settings_badField: 'badField'
        },
        {
          name: 'item2',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        },
        {
          name: 'item3',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        }
      ]
    });
    getManifestWithItemsModeSpy.mockReturnValueOnce(northTestManifestWithItems);

    await northConnectorController.checkImportNorthItems(ctx);

    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(validator.validateSettings).toHaveBeenCalledTimes(2);
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.ok).toHaveBeenCalledWith({
      items: [
        {
          id: '',
          name: 'item3',
          connectorId: '',
          enabled: true,
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
            enabled: true,
            connectorId: '',
            settings: {}
          },
          message: 'Settings "badField" not accepted in manifest'
        },
        {
          item: {
            id: '',
            name: 'item2',
            enabled: true,
            connectorId: '',
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

  it('checkImportNorthItems() should check import of items in a csv file with existing north', async () => {
    ctx.app.repositoryService.northItemRepository.getNorthItems.mockReturnValueOnce([{ id: 'id1', name: 'existingItem' }]);
    getManifestWithItemsModeSpy.mockReturnValueOnce(northTestManifestWithItems);

    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body.itemIdsToDelete = JSON.stringify(['itemIdToDelete']);
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    (validator.validateSettings as jest.Mock).mockImplementationOnce(() => {
      return true;
    });
    (csv.parse as jest.Mock).mockReturnValue({
      data: [
        {
          name: 'existingItem',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        },
        {
          name: 'newItem',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        },
        {
          name: 'willBeDeleted',
          settings_objectArray: '[]',
          settings_objectSettings: '{}',
          settings_objectValue: 1
        }
      ]
    });

    await northConnectorController.checkImportNorthItems(ctx);

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
          connectorId: 'northId',
          enabled: true,
          settings: {
            objectArray: [],
            objectSettings: {},
            objectValue: 1
          }
        },
        {
          id: '',
          name: 'willBeDeleted',
          connectorId: 'northId',
          enabled: true,
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
            connectorId: 'northId',
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

  it('checkImportNorthItems() should reject bad file type', async () => {
    ctx.request.file = { path: 'myFile.txt', mimetype: 'bad type' };
    ctx.request.body.itemIdsToDelete = '[]';

    await northConnectorController.checkImportNorthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledTimes(1);
    expect(csv.parse).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateOrUpdateNorthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.throw).not.toHaveBeenCalled();
  });

  it('checkImportNorthItems() should throw badRequest when file not parsed', async () => {
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body.itemIdsToDelete = '[]';
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    ctx.app.repositoryService.northItemRepository.getNorthItems.mockReturnValueOnce([]);
    (csv.parse as jest.Mock).mockImplementationOnce(() => {
      throw new Error('parsing error');
    });

    await northConnectorController.checkImportNorthItems(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('parsing error');
    expect(ctx.throw).not.toHaveBeenCalled();

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(csv.parse).toHaveBeenCalledWith('file content', { header: true });
    expect(fs.readFile).toHaveBeenCalledWith('myFile.csv');
    expect(ctx.app.reloadService.onCreateOrUpdateNorthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('checkImportNorthItems() should return bad request when north connector or manifest not found', async () => {
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    try {
      await northConnectorController.checkImportNorthItems(ctx);
    } catch (error) {
      expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
      expect(ctx.ok).not.toHaveBeenCalled();
      expect(csv.unparse).not.toHaveBeenCalled();
      expect(error).toEqual(new Error('jest mock error'));
    }
  });

  it('checkImportNorthItems() should throw when itemIdsToDelete not parsed', async () => {
    ctx.params.northType = 'north-test';
    ctx.request.file = { path: 'myFile.csv', mimetype: 'text/csv' };
    ctx.request.body.itemIdsToDelete = 'not json';
    (fs.readFile as jest.Mock).mockReturnValue('file content');
    ctx.app.repositoryService.northItemRepository.getNorthItems.mockReturnValueOnce([]);

    await northConnectorController.checkImportNorthItems(ctx);

    expect(ctx.throw).toHaveBeenCalledWith(400, 'Could not parse item ids to delete array');

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(csv.parse).not.toHaveBeenCalled();
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateOrUpdateNorthItems).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('importNorthItems() should import items', async () => {
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
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnectorWithItems);
    (validator.validateSettings as jest.Mock).mockImplementation(() => {
      return true;
    });
    ctx.app.reloadService.onCreateOrUpdateNorthItems.mockImplementation(() => {
      return true;
    });
    await northConnectorController.importNorthItems(ctx);
    expect(ctx.noContent).toHaveBeenCalledTimes(1);
  });

  it('importNorthItems() should throw error on creation fail', async () => {
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
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnectorWithItems);
    (validator.validateSettings as jest.Mock).mockImplementation(() => {
      return true;
    });
    ctx.app.reloadService.onCreateOrUpdateNorthItems.mockImplementation(() => {
      throw new Error('onCreateOrUpdateNorthItems error');
    });
    await northConnectorController.importNorthItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('onCreateOrUpdateNorthItems error');
  });

  it('importNorthItems() should throw error on validation fail', async () => {
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
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnectorWithItems);
    (validator.validateSettings as jest.Mock).mockImplementation(() => {
      throw new Error('validation fail');
    });
    await northConnectorController.importNorthItems(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith('validation fail');
  });

  it('importNorthItems() should return bad request when north connector or manifest not found', async () => {
    getManifestWithItemsModeSpy.mockImplementationOnce(throwError);

    try {
      await northConnectorController.importNorthItems(ctx);
    } catch (error) {
      expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
      expect(ctx.noContent).not.toHaveBeenCalled();
      expect(error).toEqual(new Error('jest mock error'));
    }
  });

  it('importNorthItems() should return not found when north connector is not found', async () => {
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.importNorthItems(ctx);

    expect(getManifestWithItemsModeSpy).toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North not found');
  });
});
