import Joi from 'joi';

import OibusController from './oibus.controller';
import JoiValidator from '../../validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import { OIBusInfo } from '../../../../shared/model/engine.model';

jest.mock('../../validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const oibusController = new OibusController(validator, schema);

const ctx = new KoaContextMock();
const engineCommand = {
  name: 'name',
  port: 8080,
  logParameters: {},
  healthSignal: {}
};
const engine = {
  id: '1',
  ...engineCommand
};

describe('Oibus controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();
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

  it('updateEngineSettings() should update engine settings', async () => {
    ctx.request.body = engineCommand;
    const newEngine = { ...engine, name: 'new name' };
    ctx.app.repositoryService.engineRepository.getEngineSettings.mockReturnValueOnce(engine).mockReturnValueOnce(newEngine);

    await oibusController.updateEngineSettings(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, engineCommand);
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
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    await oibusController.restart(ctx);
    jest.runAllTimers();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(ctx.app.logger.info).toHaveBeenCalledWith('Restarting OIBus');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('shutdown() should shutdown oibus', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    await oibusController.shutdown(ctx);
    jest.runAllTimers();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(ctx.app.logger.info).toHaveBeenCalledWith('Shutting down OIBus');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('should get OIBus info', async () => {
    (ctx.app.oibusService.getOIBusInfo as jest.Mock).mockReturnValue({ version: '3.0' } as OIBusInfo);
    await oibusController.getOIBusInfo(ctx);
    expect(ctx.ok).toHaveBeenCalledWith({ version: '3.0' });
  });
});
