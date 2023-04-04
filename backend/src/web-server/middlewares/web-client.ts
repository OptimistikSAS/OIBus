import koaSend from 'koa-send';
import { KoaContext } from '../koa';

const serveClient = async (ctx: KoaContext<any, any>) => {
  const root = `${__dirname}/../../../../frontend`;
  if (ctx.path?.match(/\.(js|js\.map|ico|ttf|css|png)$/)) {
    await koaSend(ctx, ctx.path, { root });
  } else {
    await koaSend(ctx, 'index.html', { root });
  }
};

export default serveClient;
