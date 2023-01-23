import { KoaContext, KoaError } from '../koa';
import { IpFilterCommandDTO, IpFilterDTO } from '../../../shared/model/ip-filter.model';
import oibusSchema from '../../engine/oibus-validation-schema';

const getIpFilters = async (ctx: KoaContext<void, Array<IpFilterDTO>>) => {
  const ipFilters = ctx.app.repositoryService.ipFilterRepository.getIpFilters();
  ctx.ok(ipFilters);
};

const getIpFilter = async (ctx: KoaContext<void, IpFilterDTO>) => {
  const ipFilter = ctx.app.repositoryService.ipFilterRepository.getIpFilter(ctx.params.id);
  if (ipFilter) {
    ctx.ok(ipFilter);
  } else {
    ctx.notFound();
  }
};

const createIpFilter = async (ctx: KoaContext<IpFilterCommandDTO, void>) => {
  try {
    const ipFilterCommandDTO: IpFilterCommandDTO = await oibusSchema.ipFilterSchema.validateAsync(ctx.request.body);
    const ipFilter = ctx.app.repositoryService.ipFilterRepository.createIpFilter(ipFilterCommandDTO);
    ctx.created(ipFilter);
  } catch (error: any) {
    ctx.badRequest(error.message);
  }
};

const updateIpFilter = async (ctx: KoaContext<IpFilterCommandDTO, void>) => {
  try {
    const ipFilterCommandDTO: IpFilterCommandDTO = await oibusSchema.ipFilterSchema.validateAsync(ctx.request.body);
    ctx.app.repositoryService.ipFilterRepository.updateIpFilter(ctx.params.id, ipFilterCommandDTO);
    ctx.noContent();
  } catch (error: any) {
    ctx.badRequest(error.message);
  }
};

const deleteIpFilter = async (ctx: KoaContext<void, void>) => {
  const ipFilter = ctx.app.repositoryService.ipFilterRepository.getIpFilter(ctx.params.id);
  if (ipFilter) {
    ctx.app.repositoryService.ipFilterRepository.deleteIpFilter(ctx.params.id);
    ctx.noContent();
  } else {
    ctx.notFound();
  }
};

export default {
  getIpFilters,
  getIpFilter,
  createIpFilter,
  updateIpFilter,
  deleteIpFilter
};
