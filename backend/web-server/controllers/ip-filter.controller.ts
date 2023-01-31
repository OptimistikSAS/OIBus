import { KoaContext } from '../koa';
import { IpFilterCommandDTO, IpFilterDTO } from '../../../shared/model/ip-filter.model';

const getIpFilters = async (ctx: KoaContext<void, Array<IpFilterDTO>>) => {
  const ipFilters = ctx.app.repositoryService.ipFilterRepository.getIpFilters();
  ctx.ok(ipFilters);
};

const getIpFilter = async (ctx: KoaContext<void, IpFilterDTO>) => {
  const ipFilter = ctx.app.repositoryService.ipFilterRepository.getIpFilter(ctx.params.id);
  ctx.ok(ipFilter);
};

const createIpFilter = async (ctx: KoaContext<IpFilterCommandDTO, void>) => {
  const command: IpFilterCommandDTO | undefined = ctx.request.body;
  if (command) {
    const ipFilter = ctx.app.repositoryService.ipFilterRepository.createIpFilter(command);
    ctx.created(ipFilter);
  } else {
    ctx.badRequest();
  }
};

const updateIpFilter = async (ctx: KoaContext<IpFilterCommandDTO, void>) => {
  const command: IpFilterCommandDTO | undefined = ctx.request.body;
  if (command) {
    ctx.app.repositoryService.ipFilterRepository.updateIpFilter(ctx.params.id, command);
    ctx.noContent();
  } else {
    ctx.badRequest();
  }
};

const deleteIpFilter = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.ipFilterRepository.deleteIpFilter(ctx.params.id);
  ctx.noContent();
};

export default {
  getIpFilters,
  getIpFilter,
  createIpFilter,
  updateIpFilter,
  deleteIpFilter
};
