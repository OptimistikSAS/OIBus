const koaSend = require('koa-send')

const serveClient = async (ctx) => {
  const root = `${__dirname}/../../../build/web-client`
  const { path } = ctx
  if (path?.match(/\.(js|js\.map|ico|ttf)$/)) {
    await koaSend(ctx, path, { root, index: '/index.html' })
  } else {
    await koaSend(ctx, '/index.html', { root })
  }
}

module.exports = { serveClient }
