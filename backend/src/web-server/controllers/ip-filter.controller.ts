import { KoaContext } from '../koa';
import { IpFilterCommandDTO, IpFilterDTO } from '../../../../shared/model/ip-filter.model';
import AbstractController from './abstract.controller';

export default class IpFilterController extends AbstractController {
  async findAll(ctx: KoaContext<void, Array<IpFilterDTO>>): Promise<void> {
    const ipFilters = ctx.app.repositoryService.ipFilterRepository.findAll();
    ctx.ok(ipFilters);
  }

  async findById(ctx: KoaContext<void, IpFilterDTO>): Promise<void> {
    const ipFilter = ctx.app.repositoryService.ipFilterRepository.findById(ctx.params.id);
    if (ipFilter) {
      ctx.ok(ipFilter);
    } else {
      ctx.notFound();
    }
  }

  async create(ctx: KoaContext<IpFilterCommandDTO, void>): Promise<void> {
    try {
      await this.validate(ctx.request.body);
      const ipFilter = ctx.app.repositoryService.ipFilterRepository.create(ctx.request.body as IpFilterCommandDTO);
      const ipFilters = ctx.app.repositoryService.ipFilterRepository.findAll();

      ctx.app.reloadService.proxyServer.refreshIpFilters(ipFilters.map(ip => ip.address));
      ctx.app.ipFilters = ['127.0.0.1', '::1', '::ffff:127.0.0.1', ...ipFilters.map(ip => ip.address)];
      ctx.created(ipFilter);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async update(ctx: KoaContext<IpFilterCommandDTO, void>) {
    try {
      await this.validate(ctx.request.body);
      ctx.app.repositoryService.ipFilterRepository.update(ctx.params.id, ctx.request.body as IpFilterCommandDTO);
      const ipFilters = ctx.app.repositoryService.ipFilterRepository.findAll();

      ctx.app.reloadService.proxyServer.refreshIpFilters(ipFilters.map(ip => ip.address));
      ctx.app.ipFilters = ['127.0.0.1', '::1', '::ffff:127.0.0.1', ...ipFilters.map(ip => ip.address)];
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    const ipFilter = ctx.app.repositoryService.ipFilterRepository.findById(ctx.params.id);
    if (ipFilter) {
      ctx.app.repositoryService.ipFilterRepository.delete(ctx.params.id);
      const ipFilters = ctx.app.repositoryService.ipFilterRepository.findAll();

      ctx.app.reloadService.proxyServer.refreshIpFilters(ipFilters.map(ip => ip.address));
      ctx.app.ipFilters = ['127.0.0.1', '::1', '::ffff:127.0.0.1', ...ipFilters.map(ip => ip.address)];
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }
}
