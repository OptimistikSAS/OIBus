import Joi from 'joi';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import OIAnalyticsRegistrationController from './oianalytics-registration.controller';
import testData from '../../tests/utils/test-data';
import { toOIAnalyticsRegistrationDTO } from '../../service/oia/oianalytics-registration.service';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const registrationController = new OIAnalyticsRegistrationController(validator, schema);

const ctx = new KoaContextMock();

describe('OIAnalytics Registration Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('get() should return registration settings', async () => {
    ctx.app.oIAnalyticsRegistrationService.getRegistrationSettings.mockReturnValue(testData.oIAnalytics.registration.completed);

    await registrationController.get(ctx);

    expect(ctx.app.oIAnalyticsRegistrationService.getRegistrationSettings).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith(toOIAnalyticsRegistrationDTO(testData.oIAnalytics.registration.completed));
  });

  it('get() should return not found', async () => {
    ctx.app.oIAnalyticsRegistrationService.getRegistrationSettings.mockReturnValue(null);

    await registrationController.get(ctx);

    expect(ctx.app.oIAnalyticsRegistrationService.getRegistrationSettings).toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('register() should update registration settings', async () => {
    ctx.request.body = testData.oIAnalytics.registration.command;

    await registrationController.register(ctx);

    expect(ctx.app.oIAnalyticsRegistrationService.register).toHaveBeenCalledWith(testData.oIAnalytics.registration.command);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateRegistrationSettings() should return bad request', async () => {
    ctx.request.body = testData.oIAnalytics.registration.command;
    const validationError = new Error('invalid body');
    ctx.app.oIAnalyticsRegistrationService.register.mockImplementationOnce(() => {
      throw validationError;
    });

    await registrationController.register(ctx);

    expect(ctx.app.oIAnalyticsRegistrationService.register).toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('editConnectionSettings() should edit registration settings', async () => {
    ctx.request.body = testData.oIAnalytics.registration.command;

    await registrationController.editConnectionSettings(ctx);

    expect(ctx.app.oIAnalyticsRegistrationService.editConnectionSettings).toHaveBeenCalledWith(testData.oIAnalytics.registration.command);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('editConnectionSettings() should return bad request', async () => {
    ctx.request.body = testData.oIAnalytics.registration.command;
    const validationError = new Error('invalid body');
    ctx.app.oIAnalyticsRegistrationService.editConnectionSettings.mockImplementationOnce(() => {
      throw validationError;
    });

    await registrationController.editConnectionSettings(ctx);

    expect(ctx.app.oIAnalyticsRegistrationService.editConnectionSettings).toHaveBeenCalled();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('unregister() should call unregister from oibus service', async () => {
    await registrationController.unregister(ctx);

    expect(ctx.app.oIAnalyticsRegistrationService.unregister).toHaveBeenCalledTimes(1);
    expect(ctx.noContent).toHaveBeenCalled();
  });
});
