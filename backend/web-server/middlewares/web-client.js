import koaSend from 'koa-send'

const serveClient = async (ctx) => {
  const root = `${__dirname}/../../../`
  if (ctx.path?.match(/\.(js|js\.map|ico|ttf|css|png)$/)) {
    await koaSend(ctx, ctx.path, { root })
  } else {
    await koaSend(ctx, 'frontend/index.html', { root })
  }
}

export default serveClient
