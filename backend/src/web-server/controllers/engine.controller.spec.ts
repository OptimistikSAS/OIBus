import Joi from 'joi';

import EngineController from './engine.controller';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import { EngineSettingsCommandDTO, EngineSettingsDTO, OIBusInfo } from '../../../../shared/model/engine.model';
import { getOIBusInfo } from '../../service/utils';

jest.mock('./validators/joi.validator');
jest.mock('../../service/utils');

const validator = new JoiValidator();
const schema = Joi.object({});
const engineController = new EngineController(validator, schema);

const ctx = new KoaContextMock();

describe('Engine controller', () => {
  let engineCommand: EngineSettingsCommandDTO;
  let engine: EngineSettingsDTO;

  beforeEach(async () => {
    jest.clearAllMocks();
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
      version: '3.3.4',
      ...engineCommand
    };
  });

  it('getEngineSettings() should return engine settings', async () => {
    ctx.app.repositoryService.engineRepository.get.mockReturnValue(engine);

    await engineController.getEngineSettings(ctx);

    expect(ctx.app.repositoryService.engineRepository.get).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith(engine);
  });

  it('getEngineSettings() should return not found', async () => {
    ctx.app.repositoryService.engineRepository.get.mockReturnValue(null);

    await engineController.getEngineSettings(ctx);

    expect(ctx.app.repositoryService.engineRepository.get).toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('updateEngineSettings() should update engine settings with loki password change', async () => {
    ctx.request.body = engineCommand;
    const newEngine = { ...engine, name: 'new name' };
    ctx.app.repositoryService.engineRepository.get.mockReturnValueOnce(engine).mockReturnValueOnce(newEngine);

    await engineController.updateEngineSettings(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, engineCommand);
    expect(ctx.app.encryptionService.encryptText).toHaveBeenCalledWith('pass');
    expect(ctx.app.repositoryService.engineRepository.get).toHaveBeenCalledTimes(2);
    expect(ctx.app.repositoryService.engineRepository.update).toHaveBeenCalledWith(engineCommand);
    await expect(ctx.app.reloadService.onUpdateOIBusSettings).toHaveBeenCalledWith(engine, newEngine);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateEngineSettings() should update engine settings without password change', async () => {
    ctx.request.body = JSON.parse(JSON.stringify(engineCommand));
    ctx.request.body.logParameters.loki.password = '';
    const newEngine = { ...engine, name: 'new name' };
    ctx.app.repositoryService.engineRepository.get.mockReturnValueOnce(engine).mockReturnValueOnce(newEngine);

    await engineController.updateEngineSettings(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, engineCommand);
    expect(ctx.app.encryptionService.encryptText).not.toHaveBeenCalled();
    expect(ctx.app.repositoryService.engineRepository.get).toHaveBeenCalledTimes(2);
    expect(ctx.app.repositoryService.engineRepository.update).toHaveBeenCalledWith(engineCommand);
    await expect(ctx.app.reloadService.onUpdateOIBusSettings).toHaveBeenCalledWith(engine, newEngine);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateEngineSettings() should return bad request', async () => {
    ctx.request.body = engineCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await engineController.updateEngineSettings(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, engineCommand);
    expect(ctx.app.repositoryService.engineRepository.get).not.toHaveBeenCalledWith();
    expect(ctx.app.repositoryService.engineRepository.update).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('restart() should restart oibus', async () => {
    await engineController.restart(ctx);
    expect(ctx.app.logger.info).toHaveBeenCalledWith('Restarting OIBus');
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.app.oibusService.restartOIBus).toHaveBeenCalled();
  });

  it('shutdown() should shutdown oibus', async () => {
    await engineController.shutdown(ctx);
    expect(ctx.app.logger.info).toHaveBeenCalledWith('Shutting down OIBus');
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.app.oibusService.stopOIBus).toHaveBeenCalled();
  });

  it('should get OIBus info', async () => {
    (getOIBusInfo as jest.Mock).mockReturnValue({ version: '3.0' } as OIBusInfo);
    ctx.app.repositoryService.engineRepository.get.mockReturnValueOnce(engine);
    await engineController.getOIBusInfo(ctx);
    expect(getOIBusInfo).toHaveBeenCalledTimes(1);
    expect(ctx.ok).toHaveBeenCalledWith({ version: '3.0' });
  });

  it('should reset metrics', async () => {
    (ctx.app.engineMetricsService.resetMetrics as jest.Mock).mockReturnValue({ version: '3.0' } as OIBusInfo);
    await engineController.resetEngineMetrics(ctx);
    expect(ctx.noContent).toHaveBeenCalled();
  });
});
