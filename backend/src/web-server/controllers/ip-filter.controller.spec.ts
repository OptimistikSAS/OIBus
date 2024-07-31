import Joi from 'joi';

import IpFilterController from './ip-filter.controller';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';

jest.mock('./validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const ipFilterController = new IpFilterController(validator, schema);

const ctx = new KoaContextMock();
const ipFilterCommand = {
  address: 'address',
  description: 'description'
};
const ipFilter = {
  id: '1',
  ...ipFilterCommand
};

describe('IP filter controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('findAll() should return ip filters', async () => {
    ctx.app.repositoryService.ipFilterRepository.findAll.mockReturnValue([ipFilter]);

    await ipFilterController.findAll(ctx);

    expect(ctx.app.repositoryService.ipFilterRepository.findAll).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith([ipFilter]);
  });

  it('findById() should return ip filter', async () => {
    const id = 'id';

    ctx.params.id = id;
    ctx.app.repositoryService.ipFilterRepository.findById.mockReturnValue(ipFilter);

    await ipFilterController.findById(ctx);

    expect(ctx.app.repositoryService.ipFilterRepository.findById).toHaveBeenCalledWith(id);
    expect(ctx.ok).toHaveBeenCalledWith(ipFilter);
  });

  it('findById() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.ipFilterRepository.findById.mockReturnValue(null);

    await ipFilterController.findById(ctx);

    expect(ctx.app.repositoryService.ipFilterRepository.findById).toHaveBeenCalledWith(id);
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('create() should create ip filter', async () => {
    ctx.request.body = ipFilterCommand;
    ctx.app.repositoryService.ipFilterRepository.create.mockReturnValue(ipFilter);
    ctx.app.repositoryService.ipFilterRepository.findAll.mockReturnValue([ipFilter]);

    await ipFilterController.create(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, ipFilterCommand);
    expect(ctx.app.repositoryService.ipFilterRepository.create).toHaveBeenCalledWith(ipFilterCommand);
    expect(ctx.created).toHaveBeenCalledWith(ipFilter);
  });

  it('create() should return bad request', async () => {
    ctx.request.body = ipFilterCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await ipFilterController.create(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, ipFilterCommand);
    expect(ctx.app.repositoryService.ipFilterRepository.create).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('update() should update ip filter', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.request.body = ipFilterCommand;
    ctx.app.repositoryService.ipFilterRepository.findAll.mockReturnValue([ipFilter]);

    await ipFilterController.update(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, ipFilterCommand);
    expect(ctx.app.repositoryService.ipFilterRepository.update).toHaveBeenCalledWith(id, ipFilterCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('update() should return bad request', async () => {
    ctx.request.body = ipFilterCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await ipFilterController.update(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, ipFilterCommand);
    expect(ctx.app.repositoryService.ipFilterRepository.update).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('delete() should delete ip filter', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.ipFilterRepository.findById.mockReturnValue(ipFilter);
    ctx.app.repositoryService.ipFilterRepository.findAll.mockReturnValue([ipFilter]);

    await ipFilterController.delete(ctx);

    expect(ctx.app.repositoryService.ipFilterRepository.findById).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.ipFilterRepository.delete).toHaveBeenCalledWith(id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('delete() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.ipFilterRepository.findById.mockReturnValue(null);

    await ipFilterController.delete(ctx);

    expect(ctx.app.repositoryService.ipFilterRepository.findById).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.ipFilterRepository.delete).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });
});
