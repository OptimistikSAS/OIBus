import Joi from 'joi';

import ExternalSourceController from './external-source.controller';
import JoiValidator from '../../validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';

jest.mock('../../validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const externalSourceController = new ExternalSourceController(validator, schema);

const ctx = new KoaContextMock();
const externalSourceCommand = {
  reference: 'reference',
  description: 'description'
};
const externalSource = {
  id: '1',
  ...externalSourceCommand
};

describe('External source controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('getExternalSources() should return external sources', async () => {
    ctx.app.repositoryService.externalSourceRepository.getExternalSources.mockReturnValue([externalSource]);

    await externalSourceController.getExternalSources(ctx);

    expect(ctx.app.repositoryService.externalSourceRepository.getExternalSources).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith([externalSource]);
  });

  it('getExternalSource() should return external source', async () => {
    const id = 'id';

    ctx.params.id = id;
    ctx.app.repositoryService.externalSourceRepository.getExternalSource.mockReturnValue(externalSource);

    await externalSourceController.getExternalSource(ctx);

    expect(ctx.app.repositoryService.externalSourceRepository.getExternalSource).toHaveBeenCalledWith(id);
    expect(ctx.ok).toHaveBeenCalledWith(externalSource);
  });

  it('getExternalSource() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.externalSourceRepository.getExternalSource.mockReturnValue(null);

    await externalSourceController.getExternalSource(ctx);

    expect(ctx.app.repositoryService.externalSourceRepository.getExternalSource).toHaveBeenCalledWith(id);
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('createExternalSource() should create external source', async () => {
    ctx.request.body = externalSourceCommand;
    ctx.app.repositoryService.externalSourceRepository.createExternalSource.mockReturnValue(externalSource);

    await externalSourceController.createExternalSource(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, externalSourceCommand);
    expect(ctx.app.repositoryService.externalSourceRepository.createExternalSource).toHaveBeenCalledWith(externalSourceCommand);
    expect(ctx.created).toHaveBeenCalledWith(externalSource);
  });

  it('createExternalSource() should return bad request', async () => {
    ctx.request.body = externalSourceCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await externalSourceController.createExternalSource(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, externalSourceCommand);
    expect(ctx.app.repositoryService.externalSourceRepository.createExternalSource).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateExternalSource() should update external source', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.request.body = externalSourceCommand;

    await externalSourceController.updateExternalSource(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, externalSourceCommand);
    expect(ctx.app.repositoryService.externalSourceRepository.updateExternalSource).toHaveBeenCalledWith(id, externalSourceCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateExternalSource() should return bad request', async () => {
    ctx.request.body = externalSourceCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await externalSourceController.updateExternalSource(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, externalSourceCommand);
    expect(ctx.app.repositoryService.externalSourceRepository.updateExternalSource).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('deleteExternalSource() should delete external source', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.externalSourceRepository.getExternalSource.mockReturnValue(externalSource);

    await externalSourceController.deleteExternalSource(ctx);

    expect(ctx.app.repositoryService.externalSourceRepository.getExternalSource).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.externalSourceRepository.deleteExternalSource).toHaveBeenCalledWith(id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteExternalSource() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.externalSourceRepository.getExternalSource.mockReturnValue(null);

    await externalSourceController.deleteExternalSource(ctx);

    expect(ctx.app.repositoryService.externalSourceRepository.getExternalSource).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.externalSourceRepository.deleteExternalSource).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });
});
