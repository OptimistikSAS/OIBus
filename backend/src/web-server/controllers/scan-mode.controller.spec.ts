import Joi from 'joi';

import ScanModeController from './scan-mode.controller';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import { validateCronExpression } from '../../service/utils';
import { ValidatedCronExpression } from '../../../../shared/model/scan-mode.model';

jest.mock('./validators/joi.validator');
jest.mock('../../service/utils');

const validator = new JoiValidator();
const schema = Joi.object({});
const scanModeController = new ScanModeController(validator, schema);

const ctx = new KoaContextMock();
const scanModeCommand = {
  address: 'address',
  description: 'description'
};
const scanMode = {
  id: '1',
  ...scanModeCommand
};

describe('Scan mode controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('findAll() should return scan modes', async () => {
    ctx.app.repositoryService.scanModeRepository.findAll.mockReturnValue([scanMode]);

    await scanModeController.findAll(ctx);

    expect(ctx.app.repositoryService.scanModeRepository.findAll).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith([scanMode]);
  });

  it('findById() should return scan mode', async () => {
    const id = 'id';

    ctx.params.id = id;
    ctx.app.repositoryService.scanModeRepository.findById.mockReturnValue(scanMode);

    await scanModeController.findById(ctx);

    expect(ctx.app.repositoryService.scanModeRepository.findById).toHaveBeenCalledWith(id);
    expect(ctx.ok).toHaveBeenCalledWith(scanMode);
  });

  it('findById() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.scanModeRepository.findById.mockReturnValue(null);

    await scanModeController.findById(ctx);

    expect(ctx.app.repositoryService.scanModeRepository.findById).toHaveBeenCalledWith(id);
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('verifyScanMode() should return validated cron expression', async () => {
    const cron = '* * * * * *';
    const validatedCronExpression: ValidatedCronExpression = { nextExecutions: [], humanReadableForm: '' };
    ctx.request.body = { cron };
    (validateCronExpression as jest.Mock).mockReturnValue(validatedCronExpression);

    await scanModeController.verifyScanMode(ctx);

    expect(ctx.ok).toHaveBeenCalledWith(validatedCronExpression);
  });

  it('verifyScanMode() should return bad request for no cron expression', async () => {
    ctx.request.body = {};
    await scanModeController.verifyScanMode(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('Cron expression is required');

    ctx.request = {};
    await scanModeController.verifyScanMode(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('Cron expression is required');
  });

  it('verifyScanMode() should return bad request for invalid cron expression', async () => {
    const cron = '* * *';
    const validationError = new Error('invalid cron expression');
    ctx.request.body = { cron };
    (validateCronExpression as jest.Mock).mockImplementationOnce(() => {
      throw validationError;
    });

    await scanModeController.verifyScanMode(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('create() should create scan mode', async () => {
    ctx.request.body = scanModeCommand;
    ctx.app.scanModeConfigService.create.mockReturnValue(scanMode);

    await scanModeController.create(ctx);

    expect(ctx.app.scanModeConfigService.create).toHaveBeenCalledWith(scanModeCommand);
    expect(ctx.created).toHaveBeenCalledWith(scanMode);
  });

  it('update() should update scan mode', async () => {
    ctx.params.id = 'id';
    ctx.request.body = scanModeCommand;

    await scanModeController.update(ctx);

    expect(ctx.app.scanModeConfigService.update).toHaveBeenCalledWith('id', scanModeCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('delete() should delete scan mode', async () => {
    const id = 'id';
    ctx.params.id = id;

    await scanModeController.delete(ctx);

    expect(ctx.app.scanModeConfigService.delete).toHaveBeenCalledWith(id);
    expect(ctx.noContent).toHaveBeenCalled();
  });
});
