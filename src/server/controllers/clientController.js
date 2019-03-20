const koaSend = require('koa-send')
const fs = require('fs')

const serveClient = (ctx) => {
  const root = `${__dirname}/../../../build`

  let { path } = ctx
  if ((path === '/') || !fs.existsSync(`${root}${path}`)) {
    path = 'index.html'
  }

  return koaSend(ctx, path, { root })
}

module.exports = { serveClient }
