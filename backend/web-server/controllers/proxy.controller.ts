import { KoaContext } from '../koa';
import { ProxyCommandDTO, ProxyDTO } from '../../../shared/model/proxy.model';

const getProxies = async (ctx: KoaContext<void, Array<ProxyDTO>>) => {
  const proxies = ctx.app.repositoryService.proxyRepository.getProxies();
  ctx.ok(proxies);
};

const getProxy = async (ctx: KoaContext<void, ProxyDTO>) => {
  const proxy = ctx.app.repositoryService.proxyRepository.getProxy(ctx.params.id);
  ctx.ok(proxy);
};

const createProxy = async (ctx: KoaContext<ProxyCommandDTO, void>) => {
  const command: ProxyCommandDTO | undefined = ctx.request.body;
  if (command) {
    const proxy = ctx.app.repositoryService.proxyRepository.createProxy(command);
    ctx.created(proxy);
  } else {
    ctx.badRequest();
  }
};

const updateProxy = async (ctx: KoaContext<ProxyCommandDTO, void>) => {
  const command: ProxyCommandDTO | undefined = ctx.request.body;
  if (command) {
    ctx.app.repositoryService.proxyRepository.updateProxy(ctx.params.id, command);
    ctx.noContent();
  } else {
    ctx.badRequest();
  }
};

const deleteProxy = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.proxyRepository.deleteProxy(ctx.params.id);
  ctx.noContent();
};

export default {
  getProxies,
  getProxy,
  createProxy,
  updateProxy,
  deleteProxy
};
