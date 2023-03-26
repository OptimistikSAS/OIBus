import Joi from 'joi';

import ProxyController from './proxy.controller';
import JoiValidator from '../../validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';

jest.mock('../../validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const proxyController = new ProxyController(validator, schema);

const ctx = new KoaContextMock();
const proxyCommand = {
  address: 'address',
  description: 'description'
};
const proxy = {
  id: '1',
  ...proxyCommand
};

describe('Proxy controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('getProxies() should return proxies', async () => {
    ctx.app.repositoryService.proxyRepository.getProxies.mockReturnValue([proxy]);

    await proxyController.getProxies(ctx);

    expect(ctx.app.repositoryService.proxyRepository.getProxies).toHaveBeenCalled();
    expect(ctx.ok).toHaveBeenCalledWith([proxy]);
  });

  it('getProxy() should return proxy', async () => {
    const id = 'id';

    ctx.params.id = id;
    ctx.app.repositoryService.proxyRepository.getProxy.mockReturnValue(proxy);

    await proxyController.getProxy(ctx);

    expect(ctx.app.repositoryService.proxyRepository.getProxy).toHaveBeenCalledWith(id);
    expect(ctx.ok).toHaveBeenCalledWith(proxy);
  });

  it('getProxy() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.proxyRepository.getProxy.mockReturnValue(null);

    await proxyController.getProxy(ctx);

    expect(ctx.app.repositoryService.proxyRepository.getProxy).toHaveBeenCalledWith(id);
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('createProxy() should create proxy', async () => {
    ctx.request.body = proxyCommand;
    ctx.app.repositoryService.proxyRepository.createProxy.mockReturnValue(proxy);

    await proxyController.createProxy(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, proxyCommand);
    expect(ctx.app.repositoryService.proxyRepository.createProxy).toHaveBeenCalledWith(proxyCommand);
    expect(ctx.created).toHaveBeenCalledWith(proxy);
  });

  it('createProxy() should return bad request', async () => {
    ctx.request.body = proxyCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await proxyController.createProxy(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, proxyCommand);
    expect(ctx.app.repositoryService.proxyRepository.createProxy).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('updateProxy() should update proxy', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.request.body = proxyCommand;

    await proxyController.updateProxy(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, proxyCommand);
    expect(ctx.app.repositoryService.proxyRepository.updateProxy).toHaveBeenCalledWith(id, proxyCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateProxy() should return bad request', async () => {
    ctx.request.body = proxyCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await proxyController.updateProxy(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, proxyCommand);
    expect(ctx.app.repositoryService.proxyRepository.updateProxy).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('deleteProxy() should delete proxy', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.proxyRepository.getProxy.mockReturnValue(proxy);

    await proxyController.deleteProxy(ctx);

    expect(ctx.app.repositoryService.proxyRepository.getProxy).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.proxyRepository.deleteProxy).toHaveBeenCalledWith(id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteProxy() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.proxyRepository.getProxy.mockReturnValue(null);

    await proxyController.deleteProxy(ctx);

    expect(ctx.app.repositoryService.proxyRepository.getProxy).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.proxyRepository.deleteProxy).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });
});
