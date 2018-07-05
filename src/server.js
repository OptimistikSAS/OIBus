const Koa = require('koa')
const Router = require('koa-router')
const auth = require('koa-basic-auth')
const logger = require('koa-logger')
const cors = require('@koa/cors')
const bodyParser = require('koa-bodyparser')
const helmet = require('koa-helmet')
const respond = require('koa-respond')

const app = new Koa()
const router = new Router()


// Development style logging middleware
// Recommended that you .use() this middleware near the top
//  to "wrap" all subsequent middleware.
if (process.env.NODE_ENV === 'development') {
  app.use(logger())
}
// koa-helmet is a wrapper for helmet to work with koa.
// It provides important security headers to make your app more secure by default.
app.use(helmet())

// custom 401 handling
app.use(async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    if (err.status === 401) {
      ctx.status = 401
      ctx.set('WWW-Authenticate', 'Basic')
      ctx.body = 'access was not authorized'
    } else {
      throw err
    }
  }
})

// Add simple "blanket" basic auth with username / password.
// Password protect downstream middleware:
app.use(auth({ name: 'jf', pass: 'jfhjfh' }))

// CORS middleware for Koa
app.use(cors())

// A body parser for koa, base on co-body. support json, form and text type body.
app.use(bodyParser({
  enableTypes: ['json'],
  jsonLimit: '5mb',
  strict: true,
  onerror(err, ctx) {
    ctx.throw('body parse error', 422)
  },
}))

// Middleware for Koa that adds useful methods to the Koa context.
app.use(respond())

// API routes
// Router middleware for koa
// Express-style routing using app.get, app.put, app.post, etc.
// Named URL parameters.
// Named routes with URL generation.
// Responds to OPTIONS requests with allowed methods.
// Support for 405 Method Not Allowed and 501 Not Implemented.
// Multiple route middleware.
// Multiple routers.
// Nestable routers.
// ES7 async/await support.
require('./routes')(router)

app.use(router.routes())
app.use(router.allowedMethods())

module.exports = app
