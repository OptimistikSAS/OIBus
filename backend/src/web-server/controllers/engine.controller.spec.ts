import Joi from 'joi';

import EngineController from './engine.controller';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import testData from '../../tests/utils/test-data';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const engineController = new EngineController(validator, schema);

const ctx = new KoaContextMock();

describe('Engine controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('getEngineSettings() should return engine settings', async () => {
    ctx.app.oIBusService.getEngineSettings.mockReturnValue(testData.engine.settings);

    await engineController.getEngineSettings(ctx);

    expect(ctx.app.oIBusService.getEngineSettings).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith(testData.engine.dto);
  });

  it('updateEngineSettings() should update engine settings with loki password change', async () => {
    ctx.request.body = testData.engine.command;

    await engineController.updateEngineSettings(ctx);

    expect(ctx.app.oIBusService.updateEngineSettings).toHaveBeenCalledWith(testData.engine.command);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('restart() should restart oibus', async () => {
    await engineController.restart(ctx);

    expect(ctx.app.oIBusService.restartOIBus).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('shutdown() should shutdown oibus', async () => {
    await engineController.shutdown(ctx);

    expect(ctx.app.oIBusService.stopOIBus).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('getOIBusInfo() should get OIBus info', async () => {
    ctx.app.oIBusService.getOIBusInfo.mockReturnValueOnce(testData.engine.oIBusInfo);

    await engineController.getOIBusInfo(ctx);

    expect(ctx.app.oIBusService.getOIBusInfo).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith(testData.engine.oIBusInfo);
  });

  it('should get OIBus status', async () => {
    await engineController.getStatus(ctx);
    expect(ctx.ok).toHaveBeenCalledWith();
  });

  it('should reset metrics', async () => {
    await engineController.resetEngineMetrics(ctx);

    expect(ctx.app.oIBusService.resetMetrics).toHaveBeenCalled();
    expect(ctx.noContent).toHaveBeenCalled();
  });
});
