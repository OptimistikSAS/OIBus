import { KoaContext } from "../koa";
import { IpFilterCommandDTO, IpFilterDTO } from "../../model/ip-filter.model";

const getIpFilters = async (ctx: KoaContext<void, Array<IpFilterDTO>>) => {
  const ipFilters = ctx.app.repositoryService.ipFilterRepository.getIpFilters();
  ctx.ok(ipFilters);
};

const getIpFilter = async (ctx: KoaContext<void, IpFilterDTO>) => {
  const ipFilter = ctx.app.repositoryService.ipFilterRepository.getIpFilter(
    ctx.params.id
  );
  ctx.ok(ipFilter);
};

const createIpFilter = async (ctx: KoaContext<IpFilterCommandDTO, void>) => {
  const ipFilter = ctx.app.repositoryService.ipFilterRepository.createIpFilter(
    ctx.request.body
  );
  ctx.ok(ipFilter);
};

const updateIpFilter = async (ctx: KoaContext<IpFilterCommandDTO, void>) => {
  ctx.app.repositoryService.ipFilterRepository.updateIpFilter(
    ctx.params.id,
    ctx.request.body
  );
  ctx.ok();
};

const deleteIpFilter = async (ctx: KoaContext<void, void>) => {
  ctx.app.repositoryService.ipFilterRepository.deleteIpFilter(ctx.params.id);
  ctx.ok();
};

export default {
  getIpFilters,
  getIpFilter,
  createIpFilter,
  updateIpFilter,
  deleteIpFilter,
};
