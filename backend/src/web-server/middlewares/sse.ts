import { KoaContext } from '../koa';

const sse = () => {
  return async (ctx: KoaContext<any, any>, next: () => Promise<any>) => {
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
      ctx.body = ctx.app.reloadService.oibusEngine.getSouthDataStream(splitString[3]);
      return ctx.ok();
    }
    if (ctx.path.startsWith('/sse/north/')) {
      const splitString = ctx.path.split('/');
      ctx.body = ctx.app.reloadService.oibusEngine.getNorthDataStream(splitString[3]);
      return ctx.ok();
    }
    if (ctx.path.startsWith('/sse/engine/')) {
      console.warn('TODO: send status for engine');

      // createSocket(ctx);
      // ctx.body = this.engine.statusService.getDataStream();
      // this.engine.statusService.forceDataUpdate();
      return next();
    }
    if (ctx.path.startsWith('/sse/history-engine/')) {
      console.warn('TODO: send status for history engine');
      // createSocket(ctx);
      // ctx.body = this.historyQueryEngine.statusService.getDataStream();
      // this.historyQueryEngine.statusService.forceDataUpdate();
      return next();
    }
    if (ctx.path.startsWith('/sse/history-query/')) {
      console.warn('TODO: send status for history query');

      // createSocket(ctx);
      // ctx.body = this.historyQueryEngine.historyQuery.statusService.getDataStream();
      // this.historyQueryEngine.historyQuery.statusService.forceDataUpdate();
      return next();
    }
    return next();
  };
};

export default sse;
