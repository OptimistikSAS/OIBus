import { KoaContext } from '../koa';
import { IPFilterCommandDTO, IPFilterDTO } from '../../../shared/model/ip-filter.model';
import AbstractController from './abstract.controller';
import { toIPFilterDTO } from '../../service/ip-filter.service';

export default class IpFilterController extends AbstractController {
  async findAll(ctx: KoaContext<void, Array<IPFilterDTO>>): Promise<void> {
    const ipFilters = ctx.app.ipFilterService.findAll().map(ipFilter => toIPFilterDTO(ipFilter));
    ctx.ok(ipFilters);
  }

  async findById(ctx: KoaContext<void, IPFilterDTO>): Promise<void> {
    const ipFilter = ctx.app.ipFilterService.findById(ctx.params.id);
    if (ipFilter) {
      ctx.ok(toIPFilterDTO(ipFilter));
    } else {
      ctx.notFound();
    }
  }

  async create(ctx: KoaContext<IPFilterCommandDTO, IPFilterDTO>): Promise<void> {
    try {
      const ipFilter = await ctx.app.ipFilterService.create(ctx.request.body!, ctx.app.ipFilters);
      ctx.created(toIPFilterDTO(ipFilter));
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async update(ctx: KoaContext<IPFilterCommandDTO, void>): Promise<void> {
    try {
      await ctx.app.ipFilterService.update(ctx.params.id, ctx.request.body!, ctx.app.ipFilters);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }

  async delete(ctx: KoaContext<void, void>): Promise<void> {
    try {
      await ctx.app.ipFilterService.delete(ctx.params.id!, ctx.app.ipFilters);
      ctx.noContent();
    } catch (error: unknown) {
      ctx.badRequest((error as Error).message);
    }
  }
}
