import Joi from 'joi';

import ScanModeController from './scan-mode.controller';
import JoiValidator from '../../validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';

jest.mock('../../validators/joi.validator');

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

  it('getScanModes() should return scan modes', async () => {
    ctx.app.repositoryService.scanModeRepository.getScanModes.mockReturnValue([scanMode]);

    await scanModeController.getScanModes(ctx);

    expect(ctx.app.repositoryService.scanModeRepository.getScanModes).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith([scanMode]);
  });

  it('getScanMode() should return scan mode', async () => {
    const id = 'id';

    ctx.params.id = id;
    ctx.app.repositoryService.scanModeRepository.getScanMode.mockReturnValue(scanMode);

    await scanModeController.getScanMode(ctx);

    expect(ctx.app.repositoryService.scanModeRepository.getScanMode).toHaveBeenCalledWith(id);
    expect(ctx.ok).toHaveBeenCalledWith(scanMode);
  });

  it('getScanMode() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.scanModeRepository.getScanMode.mockReturnValue(null);

    await scanModeController.getScanMode(ctx);

    expect(ctx.app.repositoryService.scanModeRepository.getScanMode).toHaveBeenCalledWith(id);
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('createScanMode() should create scan mode', async () => {
    ctx.request.body = scanModeCommand;
    ctx.app.repositoryService.scanModeRepository.createScanMode.mockReturnValue(scanMode);

    await scanModeController.createScanMode(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, scanModeCommand);
    expect(ctx.app.repositoryService.scanModeRepository.createScanMode).toHaveBeenCalledWith(scanModeCommand);
    expect(ctx.created).toHaveBeenCalledWith(scanMode);
  });

  it('createScanMode() should return bad request', async () => {
    ctx.request.body = scanModeCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await scanModeController.createScanMode(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, scanModeCommand);
    expect(ctx.app.repositoryService.scanModeRepository.createScanMode).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateScanMode() should update scan mode', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.request.body = scanModeCommand;

    await scanModeController.updateScanMode(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, scanModeCommand);
    expect(ctx.app.repositoryService.scanModeRepository.updateScanMode).toHaveBeenCalledWith(id, scanModeCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateScanMode() should return bad request', async () => {
    ctx.request.body = scanModeCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await scanModeController.updateScanMode(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, scanModeCommand);
    expect(ctx.app.repositoryService.scanModeRepository.updateScanMode).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('deleteScanMode() should delete scan mode', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.scanModeRepository.getScanMode.mockReturnValue(scanMode);

    await scanModeController.deleteScanMode(ctx);

    expect(ctx.app.repositoryService.scanModeRepository.getScanMode).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.scanModeRepository.deleteScanMode).toHaveBeenCalledWith(id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteScanMode() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.scanModeRepository.getScanMode.mockReturnValue(null);

    await scanModeController.deleteScanMode(ctx);

    expect(ctx.app.repositoryService.scanModeRepository.getScanMode).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.scanModeRepository.deleteScanMode).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });
});
