import { KoaContext } from '../koa';
import { ProxyCommandDTO, ProxyDTO } from '../../../shared/model/proxy.model';
import ValidatorInterface from '../../validators/validator.interface';

export default class ProxyController {
  constructor(private readonly validator: ValidatorInterface) {}

  async getProxies(ctx: KoaContext<void, Array<ProxyDTO>>): Promise<void> {
    const proxies = ctx.app.repositoryService.proxyRepository.getProxies();
    ctx.ok(proxies);
  }

  async getProxy(ctx: KoaContext<void, ProxyDTO>): Promise<void> {
    const proxy = ctx.app.repositoryService.proxyRepository.getProxy(ctx.params.id);
    if (proxy) {
      ctx.ok(proxy);
    } else {
      ctx.notFound();
    }
  }

  async createProxy(ctx: KoaContext<ProxyCommandDTO, void>): Promise<void> {
    try {
      await this.validator.validate(ctx.request.body);
      const proxy = ctx.app.repositoryService.proxyRepository.createProxy(ctx.request.body as ProxyCommandDTO);
      ctx.created(proxy);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateProxy(ctx: KoaContext<ProxyCommandDTO, void>): Promise<void> {
    try {
      await this.validator.validate(ctx.request.body);
      ctx.app.repositoryService.proxyRepository.updateProxy(ctx.params.id, ctx.request.body as ProxyCommandDTO);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteProxy(ctx: KoaContext<void, void>): Promise<void> {
    const proxy = ctx.app.repositoryService.proxyRepository.getProxy(ctx.params.id);
    if (proxy) {
      ctx.app.repositoryService.proxyRepository.deleteProxy(ctx.params.id);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }
}
