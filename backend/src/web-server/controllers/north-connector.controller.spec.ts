import NorthConnectorController from './north-connector.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from './validators/joi.validator';
import { northTestManifest } from '../../tests/__mocks__/north-service.mock';
import { ScanModeDTO } from '../../../../shared/model/scan-mode.model';

jest.mock('./validators/joi.validator');

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
          points: true
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

  it('createNorthConnector() should throw an error if scan mode not specifiec', async () => {
    ctx.request.body = {
      north: JSON.parse(JSON.stringify(northConnectorCommand)),
      subscriptions: [
        { type: 'south', subscription: { id: 'id1' } },
        { type: 'external-source', externalSubscription: { id: 'id2' } }
      ]
    };
    delete ctx.request.body.north.caching.scanModeId;
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.reloadService.onCreateNorth.mockReturnValue(northConnector);

    await northConnectorController.createNorthConnector(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('Scan mode not specified');
  });

  it('createNorthConnector() should throw an error if scan mode not found', async () => {
    ctx.request.body = {
      north: JSON.parse(JSON.stringify(northConnectorCommand)),
      subscriptions: [
        { type: 'south', subscription: { id: 'id1' } },
        { type: 'external-source', externalSubscription: { id: 'id2' } }
      ]
    };
    delete ctx.request.body.north.caching.scanModeId;
    ctx.request.body.north.caching.scanModeName = 'invalid';
    const scanMode: ScanModeDTO = {
      id: '1',
      name: 'scan mode',
      description: 'description',
      cron: '* * * * *'
    };
    ctx.app.repositoryService.scanModeRepository.getScanModes.mockReturnValue([scanMode]);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.reloadService.onCreateNorth.mockReturnValue(northConnector);

    await northConnectorController.createNorthConnector(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('Scan mode invalid not found');
  });

  it('createNorthConnector() should create North connector with found scan mode', async () => {
    ctx.request.body = {
      north: JSON.parse(JSON.stringify(northConnectorCommand)),
      subscriptions: [
        { type: 'south', subscription: { id: 'id1' } },
        { type: 'external-source', externalSubscription: { id: 'id2' } }
      ]
    };
    delete ctx.request.body.north.caching.scanModeId;
    ctx.request.body.north.caching.scanModeName = 'scan mode';
    const scanMode: ScanModeDTO = {
      id: '1',
      name: 'scan mode',
      description: 'description',
      cron: '* * * * *'
    };
    ctx.app.repositoryService.scanModeRepository.getScanModes.mockReturnValue([scanMode]);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.reloadService.onCreateNorth.mockReturnValue(northConnector);

    await northConnectorController.createNorthConnector(ctx);

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
        { type: 'south', subscription: { id: 'id2' } },
        { type: 'external-source', externalSubscription: { id: 'id3' } },
        { type: 'external-source', externalSubscription: { id: 'id4' } }
      ],
      subscriptionsToDelete: [
        { type: 'south', subscription: { id: 'id5' } },
        { type: 'external-source', externalSubscription: { id: 'id6' } }
      ]
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.repositoryService.subscriptionRepository.getNorthSubscriptions.mockReturnValue(['id1']);
    ctx.app.repositoryService.subscriptionRepository.getExternalNorthSubscriptions.mockReturnValue(['id3']);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);

    await northConnectorController.updateNorthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(northTestManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.repositoryService.subscriptionRepository.getNorthSubscriptions).toHaveBeenCalledWith('id');
    expect(ctx.app.repositoryService.subscriptionRepository.getExternalNorthSubscriptions).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      northConnectorCommand.settings,
      northConnector.settings,
      northTestManifest.settings
    );
    expect(ctx.app.repositoryService.subscriptionRepository.createNorthSubscription).toHaveBeenCalledWith('id', 'id2');
    expect(ctx.app.repositoryService.subscriptionRepository.createExternalNorthSubscription).toHaveBeenCalledWith('id', 'id4');
    expect(ctx.app.repositoryService.subscriptionRepository.deleteNorthSubscription).toHaveBeenCalledWith('id', 'id5');
    expect(ctx.app.repositoryService.subscriptionRepository.deleteExternalNorthSubscription).toHaveBeenCalledWith('id', 'id6');
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
    expect(ctx.app.repositoryService.subscriptionRepository.deleteExternalNorthSubscriptions).toHaveBeenCalledWith('id');
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
