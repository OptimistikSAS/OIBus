import { KoaContext } from "../koa";
import { ProxyCommandDTO, ProxyDTO } from "../../model/proxy.model";

const getProxies = async (ctx: KoaContext<void, Array<ProxyDTO>>) => {
  const proxies = ctx.app.repositoryService.proxyRepository.getProxies();
  ctx.ok(proxies);
};

const getProxy = async (ctx: KoaContext<void, ProxyDTO>) => {
  const proxy = ctx.app.repositoryService.proxyRepository.getProxy(
    ctx.params.id
  );
  ctx.ok(proxy);
};

const createProxy = async (ctx: KoaContext<ProxyCommandDTO, void>) => {
  const proxy = ctx.app.repositoryService.proxyRepository.createProxy(
    ctx.request.body
  );
  ctx.ok(proxy);
};

const updateProxy = async (ctx: KoaContext<ProxyCommandDTO, void>) => {
  ctx.app.repositoryService.proxyRepository.updateProxy(
    ctx.params.id,
    ctx.request.body
  );

  ctx.ok();
};

const deleteProxy = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.proxyRepository.deleteProxy(ctx.params.id);
  ctx.ok();
};

export default {
  getProxies,
  getProxy,
  createProxy,
  updateProxy,
  deleteProxy,
};
