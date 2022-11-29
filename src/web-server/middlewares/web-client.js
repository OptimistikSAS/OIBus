import koaSend from 'koa-send'

const serveClient = async (ctx) => {
  const root = `${__dirname}/../../../web-client`
  if (ctx.path?.match(/\.(js|js\.map|ico|ttf)$/)) {
    await koaSend(ctx, ctx.path, { root, index: '/index.html' })
  } else {
    await koaSend(ctx, '/index.html', { root })
  }
}

export default serveClient
