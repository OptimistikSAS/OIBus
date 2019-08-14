const Koa = require('koa')
const logger = require('koa-logger')
const cors = require('@koa/cors')
const bodyParser = require('koa-bodyparser')
const helmet = require('koa-helmet')
const respond = require('koa-respond')
const json = require('koa-json')

const authCrypto = require('./middlewares/auth') // ./auth
const ipFilter = require('./middlewares/ipFilter')

const router = require('./routes')

/**
 * Class Server - Provides general attributes and methods for protocols.
 */
class Server {
  /**
   * Constructor for Protocol
   * @constructor
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(engine) {
    this.app = new Koa()
    // capture the engine and logger under app for reuse in routes.
    this.app.engine = engine
    this.app.logger = engine.logger
    // Get the config entries
    const { engineConfig } = engine.configService.getConfig()
    const { debug = false, user, password, port, filter = ['127.0.0.1', '::1'] } = engineConfig

    this.logger = engine.logger
    this.debug = debug
    this.port = port
    this.user = user
    this.password = password

    // Development style logging middleware
    // Recommended that you .use() this middleware near the top
    //  to "wrap" all subsequent middleware.
    if (this.debug === 'debug') {
      this.app.use(logger())
    }

    // koa-helmet is a wrapper for helmet to work with koa.
    // It provides important security headers to make your app more secure by default.
    this.app.use(helmet())

    // filter IP addresses
    this.app.use(ipFilter(filter))

    // custom 401 handling
    this.app.use(async (ctx, next) => {
      try {
        await next()
      } catch (err) {
        if (err.status === 401) {
          ctx.status = 401
          ctx.set('WWW-Authenticate', 'Basic')
          console.error(err)
          ctx.body = JSON.stringify(err)
        } else {
          throw err
        }
      }
    })

    // Add simple "blanket" basic auth with username / password.
    // Password protect downstream middleware:
    // @todo: we need to think about the authorization process. in the first version, the program
    // need to be secured from the operating system and firewall should not allow to access the API.
    this.app.use(authCrypto({ name: this.user, pass: this.password }))

    // CORS middleware for Koa
    this.app.use(cors())

    // A body parser for koa, base on co-body. support json, form and text type body.
    this.app.use(
      bodyParser({
        enableTypes: ['json', 'text'],
        jsonLimit: '5mb',
        strict: true,
        onerror(err, ctx) {
          ctx.throw('body parse error', 422)
        },
      }),
    )

    // Middleware for Koa that adds useful methods to the Koa context.
    this.app.use(respond())

    // Middleware for beautiful JSON
    this.app.use(json())

    // Define routes
    this.app.use(router.routes())
    this.app.use(router.allowedMethods())
  }

  listen() {
    this.app.listen(this.port, () => this.logger.info(`Server started on ${this.port}`))
  }
}

module.exports = Server
