import koaSend from 'koa-send'

const serveClient = async (ctx) => {
  const legacy = `${__dirname}/../../../web-client`
  const root = `${__dirname}/../../../`
  if (ctx.path?.match(/^\/frontend\/*/)) {
    if (ctx.path?.match(/\.(js|js\.map|ico|ttf|css|png)$/)) {
      await koaSend(ctx, ctx.path, { root })
    } else {
      await koaSend(ctx, 'frontend/index.html', { root })
    }
  } else if (ctx.path?.match(/\.(js|js\.map|ico|ttf)$/)) {
    await koaSend(ctx, ctx.path, { root: legacy, index: '/index.html' })
  } else {
    await koaSend(ctx, '/index.html', { root: legacy })
  }
}

export default serveClient
