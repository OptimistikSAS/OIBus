import { KoaContext } from '../koa';

/**
 * Filter connection based on IP addresses. IPv4 and IPv6 are both accepted
 * Return ipFilter middleware
 */
const ipFilter = (ignoreIpFilters: boolean) => async (ctx: KoaContext<unknown, unknown>, next: () => Promise<void>) => {
  const allowed =
    ignoreIpFilters ||
    ctx.app.whiteList.some(ipToTest => {
      const formattedRegext = `^${ipToTest.replace(/\\/g, '\\\\').replace(/\./g, '\\.').replace(/\*$/g, '.*')}$`;
      return new RegExp(formattedRegext).test(ctx.request.ip);
    });
  if (allowed) {
    await next();
  } else {
    ctx.app.logger.error(new Error(`IP address ${ctx.request.ip} is not authorized.`));
    ctx.throw(401, 'Access denied ', `IP ADDRESS UNAUTHORIZED`);
  }
};

export default ipFilter;
