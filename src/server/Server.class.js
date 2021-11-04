const Koa = require('koa')
const cors = require('@koa/cors')
const bodyParser = require('koa-bodyparser')
const helmet = require('koa-helmet')
const respond = require('koa-respond')
const json = require('koa-json')
const { PassThrough } = require('stream')

const authCrypto = require('./middlewares/auth') // ./auth
const ipFilter = require('./middlewares/ipFilter')
const clientController = require('./controllers/clientController')
const Logger = require('../engine/Logger.class')

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

    // eslint-disable-next-line consistent-return
    this.app.use(async (ctx, next) => {
      // check https://medium.com/trabe/server-sent-events-sse-streams-with-node-and-koa-d9330677f0bf
      if (!ctx.path.endsWith('/sse')) {
        // eslint-disable-next-line no-return-await
        return await next()
      }
      if (!this.app.engine.eventEmitters[ctx.path]) {
        // eslint-disable-next-line no-return-await
        return await next()
      }

      ctx.request.socket.setTimeout(0)
      ctx.req.socket.setNoDelay(true)
      ctx.req.socket.setKeepAlive(true)
      ctx.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })

      ctx.status = 200
      this.app.engine.eventEmitters[ctx.path].stream = new PassThrough()
      ctx.body = this.app.engine.eventEmitters[ctx.path].stream
      this.app.engine.eventEmitters[ctx.path].events.emit('data', null)
    })

    // capture the engine and logger under app for reuse in routes.
    this.app.engine = engine
    this.app.logger = Logger.getDefaultLogger()

    // Get the config entries
    const { engineConfig } = engine.configService.getConfig()
    const { user, password, port, filter = ['127.0.0.1', '::1'] } = engineConfig

    this.port = port
    this.user = user

    if (password) {
      this.password = engine.encryptionService.decryptText(password)
      if (this.password == null) {
        this.app.logger.error('Error decrypting admin password. Falling back to default')
      }
    } else {
      this.password = null
    }

    // koa-helmet is a wrapper for helmet to work with koa.
    // It provides important security headers to make your app more secure by default.
    this.app.use(helmet({ contentSecurityPolicy: false }))

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
          this.app.logger.error('UnauthorizedError: Bad Combination Login/Password')
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
        jsonLimit: '20mb',
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
    this.app.use(clientController.serveClient)
  }

  listen() {
    this.app.listen(this.port, () => this.app.logger.info(`Server started on ${this.port}`))
  }
}

module.exports = Server
