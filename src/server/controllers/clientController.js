const koaSend = require('koa-send')

const serveClient = async (ctx) => {
  const root = `${__dirname}/../../../build`
  const { path } = ctx
  switch (path) {
    case '/bundle.js':
    case '/bundle.js.map':
    case '/favicon.ico':
      await koaSend(ctx, path, { root, index: '/index.html' })
      break
    default: await koaSend(ctx, '/index.html', { root })
  }
}

module.exports = { serveClient }
