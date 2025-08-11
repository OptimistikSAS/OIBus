import { KoaContext } from '../koa';
import { testIPOnFilter } from '../../service/utils';

/**
 * Filter connection based on IP addresses. IPv4 and IPv6 are both accepted
 * Return ipFilter middleware
 */
const ipFilter = (ignoreIpFilters: boolean) => async (ctx: KoaContext<unknown, unknown>, next: () => Promise<void>) => {
  if (ignoreIpFilters) {
    return await next();
  }
  if (testIPOnFilter(ctx.app.whiteList, ctx.request.ip)) {
    return await next();
  }
  ctx.app.logger.error(new Error(`IP address ${ctx.request.ip} is not authorized.`));
  ctx.throw(401, 'Access denied ', `IP ADDRESS ${ctx.request.ip} UNAUTHORIZED`);
};

export default ipFilter;
