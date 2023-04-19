import { KoaContext } from '../koa';

const sse = () => {
  return async (ctx: KoaContext<any, any>, next: () => Promise<any>) => {
    // check https://medium.com/trabe/server-sent-events-sse-streams-with-node-and-koa-d9330677f0bf
    if (!ctx.path.startsWith('/sse')) {
      return next();
    }
    ctx.req.socket.setKeepAlive(true);
    ctx.set({
      'Content-Type': 'text/event-stream'
    });

    if (ctx.path.startsWith('/sse/south/')) {
      const splitString = ctx.path.split('/');
      ctx.body = ctx.app.reloadService.oibusEngine.getSouthDataStream(splitString[3]);
      // ctx.app.reloadService.oibusEngine.updateStream(splitString[3]); // force an update of the data stream to receive it on the frontend
      return ctx.ok();
    }
    if (ctx.path.startsWith('/sse/north/')) {
      const splitString = ctx.path.split('/');
      console.warn('TODO: send status for north', splitString[2]);
      // const north = this.engine.activeNorths.find(activeNorth => activeNorth.id === splitString[2]);
      // createSocket(ctx);
      // ctx.body = north.statusService.getDataStream();
      // north.statusService.forceDataUpdate();
      return next();
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

// /**
//  * Add a socket to the Koa ctx
//  * @param {Object} ctx - The Koa ctx
//  * @return {void}
//  */
// const createSocket = (ctx: KoaContext<any, any>) => {
//   ctx.request.socket.setTimeout(0);
//   ctx.req.socket.setNoDelay(true);
//   ctx.req.socket.setKeepAlive(true);
//   ctx.set({
//     'Content-Type': 'text/event-stream',
//     'Cache-Control': 'no-cache',
//     Connection: 'keep-alive'
//   });
//   ctx.status = 200;
// };

export default sse;
