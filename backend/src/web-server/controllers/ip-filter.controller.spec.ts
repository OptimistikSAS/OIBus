import Joi from 'joi';

import IpFilterController from './ip-filter.controller';
import JoiValidator from '../../validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';

jest.mock('../../validators/joi.validator');

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

  it('getIpFilters() should return ip filters', async () => {
    ctx.app.repositoryService.ipFilterRepository.getIpFilters.mockReturnValue([ipFilter]);

    await ipFilterController.getIpFilters(ctx);

    expect(ctx.app.repositoryService.ipFilterRepository.getIpFilters).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith([ipFilter]);
  });

  it('getIpFilter() should return ip filter', async () => {
    const id = 'id';

    ctx.params.id = id;
    ctx.app.repositoryService.ipFilterRepository.getIpFilter.mockReturnValue(ipFilter);

    await ipFilterController.getIpFilter(ctx);

    expect(ctx.app.repositoryService.ipFilterRepository.getIpFilter).toHaveBeenCalledWith(id);
    expect(ctx.ok).toHaveBeenCalledWith(ipFilter);
  });

  it('getIpFilter() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.ipFilterRepository.getIpFilter.mockReturnValue(null);

    await ipFilterController.getIpFilter(ctx);

    expect(ctx.app.repositoryService.ipFilterRepository.getIpFilter).toHaveBeenCalledWith(id);
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('createIpFilter() should create ip filter', async () => {
    ctx.request.body = ipFilterCommand;
    ctx.app.repositoryService.ipFilterRepository.createIpFilter.mockReturnValue(ipFilter);

    await ipFilterController.createIpFilter(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, ipFilterCommand);
    expect(ctx.app.repositoryService.ipFilterRepository.createIpFilter).toHaveBeenCalledWith(ipFilterCommand);
    expect(ctx.created).toHaveBeenCalledWith(ipFilter);
  });

  it('createIpFilter() should return bad request', async () => {
    ctx.request.body = ipFilterCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await ipFilterController.createIpFilter(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, ipFilterCommand);
    expect(ctx.app.repositoryService.ipFilterRepository.createIpFilter).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateIpFilter() should update ip filter', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.request.body = ipFilterCommand;

    await ipFilterController.updateIpFilter(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, ipFilterCommand);
    expect(ctx.app.repositoryService.ipFilterRepository.updateIpFilter).toHaveBeenCalledWith(id, ipFilterCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateIpFilter() should return bad request', async () => {
    ctx.request.body = ipFilterCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await ipFilterController.updateIpFilter(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, ipFilterCommand);
    expect(ctx.app.repositoryService.ipFilterRepository.updateIpFilter).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('deleteIpFilter() should delete ip filter', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.ipFilterRepository.getIpFilter.mockReturnValue(ipFilter);

    await ipFilterController.deleteIpFilter(ctx);

    expect(ctx.app.repositoryService.ipFilterRepository.getIpFilter).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.ipFilterRepository.deleteIpFilter).toHaveBeenCalledWith(id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteIpFilter() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.ipFilterRepository.getIpFilter.mockReturnValue(null);

    await ipFilterController.deleteIpFilter(ctx);

    expect(ctx.app.repositoryService.ipFilterRepository.getIpFilter).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.ipFilterRepository.deleteIpFilter).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });
});
