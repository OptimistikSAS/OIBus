import koaSend from 'koa-send';
import { KoaContext } from '../koa';

const serveClient = async (ctx: KoaContext<any, any>, next: () => Promise<any>) => {
  const root = `${__dirname}/../../../../frontend`;
  if (ctx.path?.match(/\.(js|js\.map|ico|ttf|css|css\.map|png|svg)$/)) {
    return await koaSend(ctx, ctx.path, { root });
  } else if (!ctx.path?.startsWith('/api/')) {
    return await koaSend(ctx, 'index.html', { root });
  }
  return next();
};

export default serveClient;
