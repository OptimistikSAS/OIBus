import Joi from 'joi';

import OibusController from './oibus.controller';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import { EngineSettingsCommandDTO, EngineSettingsDTO, OIBusInfo } from '../../../../shared/model/engine.model';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const oibusController = new OibusController(validator, schema);

const ctx = new KoaContextMock();

describe('Oibus controller', () => {
  let engineCommand: EngineSettingsCommandDTO;
  let engine: EngineSettingsDTO;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    engineCommand = {
      name: 'name',
      port: 8080,
      logParameters: {
        loki: {
          username: 'user',
          password: 'pass'
        }
      }
    } as EngineSettingsCommandDTO;
    engine = {
      id: '1',
      ...engineCommand
    };
  });

  it('getEngineSettings() should return engine settings', async () => {
    ctx.app.repositoryService.engineRepository.getEngineSettings.mockReturnValue(engine);

    await oibusController.getEngineSettings(ctx);

    expect(ctx.app.repositoryService.engineRepository.getEngineSettings).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith(engine);
  });

  it('getEngineSettings() should return not found', async () => {
    ctx.app.repositoryService.engineRepository.getEngineSettings.mockReturnValue(null);

    await oibusController.getEngineSettings(ctx);

    expect(ctx.app.repositoryService.engineRepository.getEngineSettings).toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('updateEngineSettings() should update engine settings with loki password change', async () => {
    ctx.request.body = engineCommand;
    const newEngine = { ...engine, name: 'new name' };
    ctx.app.repositoryService.engineRepository.getEngineSettings.mockReturnValueOnce(engine).mockReturnValueOnce(newEngine);

    await oibusController.updateEngineSettings(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, engineCommand);
    expect(ctx.app.encryptionService.encryptText).toHaveBeenCalledWith('pass');
    expect(ctx.app.repositoryService.engineRepository.getEngineSettings).toHaveBeenCalledTimes(2);
    expect(ctx.app.repositoryService.engineRepository.updateEngineSettings).toHaveBeenCalledWith(engineCommand);
    await expect(ctx.app.reloadService.onUpdateOibusSettings).toHaveBeenCalledWith(engine, newEngine);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateEngineSettings() should update engine settings without password change', async () => {
    ctx.request.body = JSON.parse(JSON.stringify(engineCommand));
    ctx.request.body.logParameters.loki.password = '';
    const newEngine = { ...engine, name: 'new name' };
    ctx.app.repositoryService.engineRepository.getEngineSettings.mockReturnValueOnce(engine).mockReturnValueOnce(newEngine);

    await oibusController.updateEngineSettings(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, engineCommand);
    expect(ctx.app.encryptionService.encryptText).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.engineRepository.getEngineSettings).toHaveBeenCalledTimes(2);
    expect(ctx.app.repositoryService.engineRepository.updateEngineSettings).toHaveBeenCalledWith(engineCommand);
    await expect(ctx.app.reloadService.onUpdateOibusSettings).toHaveBeenCalledWith(engine, newEngine);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateEngineSettings() should return bad request', async () => {
    ctx.request.body = engineCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await oibusController.updateEngineSettings(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, engineCommand);
    expect(ctx.app.repositoryService.engineRepository.getEngineSettings).not.toHaveBeenCalledWith();
    expect(ctx.app.repositoryService.engineRepository.updateEngineSettings).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('restart() should restart oibus', async () => {
    await oibusController.restart(ctx);
    expect(ctx.app.logger.info).toHaveBeenCalledWith('Restarting OIBus');
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.app.oibusService.restartOIBus).toHaveBeenCalled();
  });

  it('shutdown() should shutdown oibus', async () => {
    await oibusController.shutdown(ctx);
    expect(ctx.app.logger.info).toHaveBeenCalledWith('Shutting down OIBus');
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.app.oibusService.stopOIBus).toHaveBeenCalled();
  });

  it('should get OIBus info', async () => {
    (ctx.app.oibusService.getOIBusInfo as jest.Mock).mockReturnValue({ version: '3.0' } as OIBusInfo);
    await oibusController.getOIBusInfo(ctx);
    expect(ctx.ok).toHaveBeenCalledWith({ version: '3.0' });
  });

  it('should reset metrics', async () => {
    (ctx.app.engineMetricsService.resetMetrics as jest.Mock).mockReturnValue({ version: '3.0' } as OIBusInfo);
    await oibusController.resetEngineMetrics(ctx);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('should add values', async () => {
    ctx.request.body = [{ field: 'my value' }];
    ctx.request.query = { name: 'source' };
    ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference.mockReturnValue({
      id: '1',
      reference: 'source',
      description: 'description'
    });
    await oibusController.addValues(ctx);
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.app.oibusService.addValues).toHaveBeenCalledWith('1', [{ field: 'my value' }]);
  });

  it('should add values with null as external source', async () => {
    ctx.request.body = [{ field: 'my value' }];
    ctx.request.query = { name: 'source' };
    ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference.mockReturnValue(null);
    await oibusController.addValues(ctx);
    expect(ctx.badRequest).toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.app.oibusService.addValues).not.toHaveBeenCalled();
  });

  it('should not add values if no source name provided', async () => {
    ctx.request.body = [{ field: 'my value' }];
    ctx.request.query = { name: '' };
    await oibusController.addValues(ctx);
    expect(ctx.badRequest).toHaveBeenCalled();
    expect(ctx.app.oibusService.addValues).not.toHaveBeenCalled();
  });

  it('should properly manage internal error when adding values', async () => {
    (ctx.app.oibusService.addValues as jest.Mock).mockImplementationOnce(() => {
      throw new Error('internal error');
    });
    ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference.mockReturnValue({
      id: '1',
      reference: 'source',
      description: 'description'
    });
    ctx.request.body = [{ field: 'my value' }];
    ctx.request.query = { name: 'source' };
    await oibusController.addValues(ctx);
    expect(ctx.internalServerError).toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
  });

  it('should add file', async () => {
    ctx.request.query = { name: 'source' };
    ctx.request.file = { path: 'filePath' };
    ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference.mockReturnValue({
      id: '1',
      reference: 'source',
      description: 'description'
    });
    await oibusController.addFile(ctx);
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.app.oibusService.addFile).toHaveBeenCalledWith('1', 'filePath');
  });

  it('should add file with null as external source', async () => {
    ctx.request.query = { name: 'source' };
    ctx.request.file = { path: 'filePath' };
    ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference.mockReturnValue(null);
    await oibusController.addFile(ctx);
    expect(ctx.badRequest).toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
    expect(ctx.app.oibusService.addFile).not.toHaveBeenCalled();
  });

  it('should not add file if no source name provided', async () => {
    ctx.request.file = { path: 'filePath' };
    ctx.request.query = { name: '' };
    await oibusController.addFile(ctx);
    expect(ctx.badRequest).toHaveBeenCalled();
    expect(ctx.app.oibusService.addFile).not.toHaveBeenCalled();
  });

  it('should properly manage internal error when adding file', async () => {
    (ctx.app.oibusService.addFile as jest.Mock).mockImplementationOnce(() => {
      throw new Error('internal error');
    });
    ctx.app.repositoryService.externalSourceRepository.findExternalSourceByReference.mockReturnValue({
      id: '1',
      reference: 'source',
      description: 'description'
    });
    ctx.request.query = { name: 'source' };
    ctx.request.file = { path: 'filePath' };
    await oibusController.addFile(ctx);
    expect(ctx.internalServerError).toHaveBeenCalled();
    expect(ctx.badRequest).not.toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
  });
});
