import koaSend from 'koa-send'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serveClient = async (ctx) => {
  const dirName = path.dirname(fileURLToPath(import.meta.url))

  const root = `${dirName}/../../../build`
  if (ctx.path?.match(/\.(js|js\.map|ico|ttf)$/)) {
    await koaSend(ctx, ctx.path, { root, index: '/index.html' })
  } else {
    await koaSend(ctx, '/index.html', { root })
  }
}

export default serveClient
