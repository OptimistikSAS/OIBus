import { KoaContext } from '../koa';

const sse = () => {
  return async (ctx: KoaContext<unknown, unknown>, next: () => void) => {
    // check https://medium.com/trabe/server-sent-events-sse-streams-with-node-and-koa-d9330677f0bf
    if (!ctx.path.startsWith('/sse')) {
      return next();
    }
    ctx.req.socket.setKeepAlive(true);
    ctx.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    if (ctx.path.startsWith('/sse/south/')) {
      const splitString = ctx.path.split('/');
      ctx.body = ctx.app.southService.getSouthDataStream(splitString[3]);
      return ctx.ok();
    }
    if (ctx.path.startsWith('/sse/north/')) {
      const splitString = ctx.path.split('/');
      ctx.body = ctx.app.northService.getNorthDataStream(splitString[3]);
      return ctx.ok();
    }
    if (ctx.path.startsWith('/sse/engine')) {
      ctx.body = ctx.app.oIBusService.stream;
      return ctx.ok();
    }
    if (ctx.path.startsWith('/sse/home')) {
      ctx.body = ctx.app.homeMetricsService.stream;
      return ctx.ok();
    }
    if (ctx.path.startsWith('/sse/history-queries/')) {
      const splitString = ctx.path.split('/');
      ctx.body = ctx.app.historyQueryService.getHistoryQueryDataStream(splitString[3]);
      return ctx.ok();
    }
    return next();
  };
};

export default sse;
