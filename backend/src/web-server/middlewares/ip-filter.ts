import { KoaContext } from '../koa';

/**
 * Filter connection based on IP addresses. IPv4 and IPv6 are both accepted
 * Return ipFilter middleware
 */
const ipFilter = () => async (ctx: KoaContext<any, any>, next: () => Promise<any>) => {
  const filterToTest = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    ...ctx.app.repositoryService.ipFilterRepository.getIpFilters().map(filter => filter.address)
  ];

  const allowed = filterToTest.some(ipToTest => {
    const formattedRegext = `^${ipToTest.replace(/\./g, '\\.').replace(/\*$/g, '.*')}$`;
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
