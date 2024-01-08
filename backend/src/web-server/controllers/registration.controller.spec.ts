import Joi from 'joi';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import { RegistrationSettingsCommandDTO, RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import RegistrationController from './registration.controller';

jest.mock('./validators/joi.validator');
jest.mock('../../service/utils');

const validator = new JoiValidator();
const schema = Joi.object({});
const registrationController = new RegistrationController(validator, schema);

const ctx = new KoaContextMock();

describe('Registration controller', () => {
  let registrationCommand: RegistrationSettingsCommandDTO;
  let registrationSettings: RegistrationSettingsDTO;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    registrationCommand = {
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false
    };
    registrationSettings = {
      id: '1',
      host: 'http://localhost:4200',
      acceptUnauthorized: false,
      useProxy: false,
      activationCode: '1234',
      status: 'NOT_REGISTERED',
      activationDate: '2020-01-01T00:00:00.000Z',
      activationExpirationDate: '2020-01-01T00:00:00.000Z'
    };
  });

  it('getRegistrationSettings() should return registration settings', async () => {
    ctx.app.oibusService.getRegistrationSettings.mockReturnValue(registrationSettings);

    await registrationController.getRegistrationSettings(ctx);

    expect(ctx.app.oibusService.getRegistrationSettings).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith(registrationSettings);
  });

  it('getRegistrationSettings() should return not found', async () => {
    ctx.app.oibusService.getRegistrationSettings.mockReturnValue(null);

    await registrationController.getRegistrationSettings(ctx);

    expect(ctx.app.oibusService.getRegistrationSettings).toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('updateRegistrationSettings() should update registration settings', async () => {
    ctx.request.body = registrationCommand;

    await registrationController.updateRegistrationSettings(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, registrationCommand);
    expect(ctx.app.oibusService.updateRegistrationSettings).toHaveBeenCalledWith(registrationCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateRegistrationSettings() should return bad request', async () => {
    ctx.request.body = registrationCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await registrationController.updateRegistrationSettings(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, registrationCommand);
    expect(ctx.app.oibusService.updateRegistrationSettings).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('unregister() should call unregister from oibus service', async () => {
    await registrationController.unregister(ctx);

    expect(ctx.app.oibusService.unregister).toHaveBeenCalledTimes(1);
    expect(ctx.noContent).toHaveBeenCalled();
  });
});
