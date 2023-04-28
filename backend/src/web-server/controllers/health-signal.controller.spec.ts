import Joi from 'joi';
import JoiValidator from '../../validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import HealthSignalController from './health-signal.controller';

jest.mock('../../validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const healthSignalController = new HealthSignalController(validator, schema);

const ctx = new KoaContextMock();

describe('Health signal controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();
  });

  it('should forward health signal', async () => {
    ctx.request.body = { field: 'my health signal' };
    await healthSignalController.healthSignal(ctx);
    expect(ctx.noContent).toHaveBeenCalled();
    expect(ctx.app.healthSignalService.forwardRequest).toHaveBeenCalledWith({ field: 'my health signal' });
  });

  it('should properly manage internal error when adding values', async () => {
    (ctx.app.healthSignalService.forwardRequest as jest.Mock).mockImplementationOnce(() => {
      throw new Error('internal error');
    });
    ctx.request.body = { field: 'my health signal' };
    await healthSignalController.healthSignal(ctx);
    expect(ctx.internalServerError).toHaveBeenCalled();
    expect(ctx.noContent).not.toHaveBeenCalled();
  });
});
