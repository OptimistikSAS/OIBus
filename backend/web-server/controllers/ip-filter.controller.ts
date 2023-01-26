import { KoaContext } from '../koa';
import { IpFilterCommandDTO, IpFilterDTO } from '../../../shared/model/ip-filter.model';
import ValidatorInterface from '../../validators/validator.interface';

export default class IpFilterController {
  constructor(private readonly validator: ValidatorInterface) {}

  async getIpFilters(ctx: KoaContext<void, Array<IpFilterDTO>>): Promise<void> {
    const ipFilters = ctx.app.repositoryService.ipFilterRepository.getIpFilters();
    ctx.ok(ipFilters);
  }

  async getIpFilter(ctx: KoaContext<void, IpFilterDTO>): Promise<void> {
    const ipFilter = ctx.app.repositoryService.ipFilterRepository.getIpFilter(ctx.params.id);
    if (ipFilter) {
      ctx.ok(ipFilter);
    } else {
      ctx.notFound();
    }
  }

  async createIpFilter(ctx: KoaContext<IpFilterCommandDTO, void>): Promise<void> {
    try {
      await this.validator.validate(ctx.request.body);
      const ipFilter = ctx.app.repositoryService.ipFilterRepository.createIpFilter(ctx.request.body as IpFilterCommandDTO);
      ctx.created(ipFilter);
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async updateIpFilter(ctx: KoaContext<IpFilterCommandDTO, void>) {
    try {
      await this.validator.validate(ctx.request.body);
      ctx.app.repositoryService.ipFilterRepository.updateIpFilter(ctx.params.id, ctx.request.body as IpFilterCommandDTO);
      ctx.noContent();
    } catch (error: any) {
      ctx.badRequest(error.message);
    }
  }

  async deleteIpFilter(ctx: KoaContext<void, void>): Promise<void> {
    const ipFilter = ctx.app.repositoryService.ipFilterRepository.getIpFilter(ctx.params.id);
    if (ipFilter) {
      ctx.app.repositoryService.ipFilterRepository.deleteIpFilter(ctx.params.id);
      ctx.noContent();
    } else {
      ctx.notFound();
    }
  }
}
