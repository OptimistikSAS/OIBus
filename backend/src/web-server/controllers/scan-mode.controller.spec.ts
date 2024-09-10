import Joi from 'joi';

import ScanModeController from './scan-mode.controller';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import { ValidatedCronExpression } from '../../../../shared/model/scan-mode.model';
import testData from '../../tests/utils/test-data';

jest.mock('./validators/joi.validator');
jest.mock('../../service/utils');

const validator = new JoiValidator();
const schema = Joi.object({});
const scanModeController = new ScanModeController(validator, schema);

const ctx = new KoaContextMock();

describe('Scan Mode Controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('findAll() should return scan modes', async () => {
    ctx.app.scanModeService.findAll.mockReturnValueOnce(testData.scanMode.list);

    await scanModeController.findAll(ctx);

    expect(ctx.app.scanModeService.findAll).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith(testData.scanMode.dto);
  });

  it('findById() should return a scan mode', async () => {
    const id = 'id';

    ctx.params.id = id;
    ctx.app.scanModeService.findById.mockReturnValueOnce(testData.scanMode.list[0]);

    await scanModeController.findById(ctx);

    expect(ctx.app.scanModeService.findById).toHaveBeenCalledWith(id);
    expect(ctx.ok).toHaveBeenCalledWith(testData.scanMode.dto[0]);
  });

  it('findById() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.scanModeService.findById.mockReturnValueOnce(null);

    await scanModeController.findById(ctx);

    expect(ctx.app.scanModeService.findById).toHaveBeenCalledWith(id);
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('create() should create a scan mode', async () => {
    ctx.request.body = testData.scanMode.command;
    ctx.app.scanModeService.create.mockReturnValueOnce(testData.scanMode.list[0]);

    await scanModeController.create(ctx);

    expect(ctx.app.scanModeService.create).toHaveBeenCalledWith(testData.scanMode.command);
    expect(ctx.created).toHaveBeenCalledWith(testData.scanMode.dto[0]);
  });

  it('create() should throw bad request', async () => {
    ctx.request.body = testData.scanMode.command;
    ctx.app.scanModeService.create.mockImplementationOnce(() => {
      throw Error('bad request');
    });

    await scanModeController.create(ctx);

    expect(ctx.app.scanModeService.create).toHaveBeenCalledWith(testData.scanMode.command);
    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('update() should update a scan mode', async () => {
    ctx.params.id = 'id';
    ctx.request.body = testData.scanMode.command;

    await scanModeController.update(ctx);

    expect(ctx.app.scanModeService.update).toHaveBeenCalledWith('id', testData.scanMode.command);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('update() should throw bad request', async () => {
    ctx.params.id = 'id';
    ctx.request.body = testData.scanMode.command;
    ctx.app.scanModeService.update.mockImplementationOnce(() => {
      throw Error('bad request');
    });

    await scanModeController.update(ctx);

    expect(ctx.app.scanModeService.update).toHaveBeenCalledWith('id', testData.scanMode.command);
    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('delete() should delete a scan mode', async () => {
    const id = 'id';
    ctx.params.id = id;

    await scanModeController.delete(ctx);

    expect(ctx.app.scanModeService.delete).toHaveBeenCalledWith(id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('delete() should delete a scan mode', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.scanModeService.delete.mockImplementationOnce(() => {
      throw Error('bad request');
    });

    await scanModeController.delete(ctx);

    expect(ctx.app.scanModeService.delete).toHaveBeenCalledWith(id);
    expect(ctx.badRequest).toHaveBeenCalledWith('bad request');
  });

  it('verifyCron() should return validated cron expression', async () => {
    ctx.request.body = testData.scanMode.command;
    const validatedCronExpression: ValidatedCronExpression = { nextExecutions: [], humanReadableForm: '' };
    ctx.app.scanModeService.verifyCron.mockReturnValueOnce(validatedCronExpression);

    await scanModeController.verifyCron(ctx);

    expect(ctx.app.scanModeService.verifyCron).toHaveBeenCalledWith(testData.scanMode.command);
    expect(ctx.ok).toHaveBeenCalledWith(validatedCronExpression);
  });

  it('verifyCron() should return bad request when validation fails', async () => {
    ctx.request.body = null;
    ctx.app.scanModeService.verifyCron.mockImplementationOnce(() => {
      throw new Error('invalid cron');
    });

    await scanModeController.verifyCron(ctx);

    expect(ctx.app.scanModeService.verifyCron).toHaveBeenCalledWith(null);
    expect(ctx.badRequest).toHaveBeenCalledWith('invalid cron');
  });
});
