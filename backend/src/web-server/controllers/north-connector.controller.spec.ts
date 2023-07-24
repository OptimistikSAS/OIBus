import NorthConnectorController, { northManifests } from './north-connector.controller';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import JoiValidator from '../../validators/joi.validator';
import mqttManifest from '../../north/north-mqtt/manifest';

jest.mock('../../validators/joi.validator');

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
  type: 'mqtt',
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
    jest.resetAllMocks();
  });

  it('getNorthConnectorTypes() should return North connector types', async () => {
    await northConnectorController.getNorthConnectorTypes(ctx);

    expect(ctx.ok).toHaveBeenCalledWith(
      northManifests.map(manifest => ({
        category: manifest.category,
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        modes: manifest.modes
      }))
    );
  });

  it('getNorthConnectorManifest() should return North connector manifest', async () => {
    ctx.params.id = 'mqtt';

    await northConnectorController.getNorthConnectorManifest(ctx);

    expect(ctx.ok).toHaveBeenCalledWith(mqttManifest);
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
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(northConnector.settings, mqttManifest.settings);
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
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(northConnector.settings, mqttManifest.settings);
    expect(ctx.ok).toHaveBeenCalledWith([northConnector, null]);
  });

  it('getNorthConnector() should return North connector', async () => {
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.encryptionService.filterSecrets.mockReturnValue(northConnector.settings);

    await northConnectorController.getNorthConnector(ctx);

    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.filterSecrets).toHaveBeenCalledWith(northConnector.settings, mqttManifest.settings);
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
      ...northConnectorCommand
    };
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);
    ctx.app.reloadService.onCreateNorth.mockReturnValue(northConnector);

    await northConnectorController.createNorthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      northConnectorCommand.settings,
      null,
      mqttManifest.settings
    );
    expect(ctx.app.reloadService.onCreateNorth).toHaveBeenCalledWith(northConnectorCommand);
    expect(ctx.created).toHaveBeenCalledWith(northConnector);
  });

  it('createNorthConnector() should return 404 when manifest not found', async () => {
    ctx.request.body = {
      ...northConnectorCommand,
      type: 'invalid'
    };

    await northConnectorController.createNorthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('createNorthConnector() should return 404 when body is null', async () => {
    ctx.request.body = null;

    await northConnectorController.createNorthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorth).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
  });

  it('createNorthConnector() should return bad request when validation fails', async () => {
    ctx.request.body = {
      ...northConnectorCommand
    };
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await northConnectorController.createNorthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onCreateNorth).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateNorthConnector() should update North connector', async () => {
    ctx.request.body = {
      ...northConnectorCommand
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(northConnector);
    ctx.app.encryptionService.encryptConnectorSecrets.mockReturnValue(northConnectorCommand.settings);

    await northConnectorController.updateNorthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).toHaveBeenCalledWith(
      northConnectorCommand.settings,
      northConnector.settings,
      mqttManifest.settings
    );
    expect(ctx.app.reloadService.onUpdateNorthSettings).toHaveBeenCalledWith('id', northConnectorCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateNorthConnector() should throw 404 when manifest not found', async () => {
    ctx.request.body = {
      ...northConnectorCommand,
      type: 'invalid'
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
      ...northConnectorCommand
    };
    ctx.params.id = 'id';
    const validationError = new Error('invalid body');
    validator.validateSettings = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await northConnectorController.updateNorthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateNorthSettings).not.toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateNorthConnector() should return not found when North connector not found', async () => {
    ctx.request.body = {
      ...northConnectorCommand
    };
    ctx.params.id = 'id';
    ctx.app.repositoryService.northConnectorRepository.getNorthConnector.mockReturnValue(null);

    await northConnectorController.updateNorthConnector(ctx);

    expect(validator.validateSettings).toHaveBeenCalledWith(mqttManifest.settings, northConnectorCommand.settings);
    expect(ctx.app.repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('id');
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateNorthSettings).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('updateNorthConnector() should return 404 when body is null', async () => {
    ctx.request.body = null;
    ctx.params.id = 'id';

    await northConnectorController.updateNorthConnector(ctx);

    expect(validator.validateSettings).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.southConnectorRepository.getSouthConnector).not.toHaveBeenCalled();
    expect(ctx.app.encryptionService.encryptConnectorSecrets).not.toHaveBeenCalled();
    expect(ctx.app.reloadService.onUpdateNorthSettings).not.toHaveBeenCalled();
    expect(ctx.throw).toHaveBeenCalledWith(404, 'North manifest not found');
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
});
