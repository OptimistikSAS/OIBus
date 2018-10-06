const Koa = require('koa')
const Router = require('koa-router')
const auth = require('koa-basic-auth')
const logger = require('koa-logger')
const cors = require('@koa/cors')
const bodyParser = require('koa-bodyparser')
const helmet = require('koa-helmet')
const respond = require('koa-respond')

const Controller = require('./info')

/**
 * Class Server : provides general attributes and methods for protocols.
 */
class Server {
  /**
   * @constructor for Protocol
   * @param {Object} engine
   */
  constructor(engine) {
    this.app = new Koa()
    // capture the engine under app for reuse in routes.
    this.app.engine = engine
    const router = new Router()
    // Get the config entries
    const { debug = false, port = 3333, filter = ['127.0.0.1', '::1'] } = engine.config.engine

    this.debug = debug
    this.port = port
    // Development style logging middleware
    // Recommended that you .use() this middleware near the top
    //  to "wrap" all subsequent middleware.
    if (this.debug === 'debug') {
      this.app.use(logger())
    }

    // koa-helmet is a wrapper for helmet to work with koa.
    // It provides important security headers to make your app more secure by default.
    this.app.use(helmet())
    // filter IP adresses
    this.app.use(async (ctx, next) => {
      const { ip } = ctx.request
      if (filter.includes(ip)) {
        await next()
      } else {
        console.error(`${ip} is not authorized`)
        ctx.throw(401, 'access denied ', `${ip} is not authorized`)
      }
    })

    // custom 401 handling
    this.app.use(async (ctx, next) => {
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
    /** @todo: we need to think about the authorization process. in the first version, the program
     * need to be secured from the operating system and firewall should not allow to access the API.
     */
    this.app.use(auth({ name: 'admin', pass: 'admin' }))

    // CORS middleware for Koa
    this.app.use(cors())

    // A body parser for koa, base on co-body. support json, form and text type body.
    this.app.use(
      bodyParser({
        enableTypes: ['json'],
        jsonLimit: '5mb',
        strict: true,
        onerror(err, ctx) {
          ctx.throw('body parse error', 422)
        },
      }),
    )

    // Middleware for Koa that adds useful methods to the Koa context.
    this.app.use(respond())

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
    router.prefix('/v0')

    router
      .get('/', (ctx, _next) => {
        ctx.ok({ comment: ' fTbus' })
      })
      .get('/infos', Controller.getInfo)
    // .put('/users/:id', (ctx, next) => {
    //  // ...
    // })

    this.app.use(router.routes())
    this.app.use(router.allowedMethods())
  }

  listen() {
    this.app.listen(this.port, () => console.info(`Server started on ${this.port}`))
  }
}

module.exports = Server
