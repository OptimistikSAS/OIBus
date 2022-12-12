import Koa from 'koa'
import cors from '@koa/cors'
import bodyParser from 'koa-bodyparser'
import helmet from 'koa-helmet'
import respond from 'koa-respond'

import router from './routes/index.js'
import authCrypto from './middlewares/auth.js'
import ipFilter from './middlewares/ip-filter.js'
import webClient from './middlewares/web-client.js'

/**
 * Add a socket to the Koa ctx
 * @param {Object} ctx - The Koa ctx
 * @return {void}
 */
const createSocket = (ctx) => {
  ctx.request.socket.setTimeout(0)
  ctx.req.socket.setNoDelay(true)
  ctx.req.socket.setKeepAlive(true)
  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  ctx.status = 200
}

/**
 * Class Server - Provides the web client and establish socket connections.
 */
export default class Server {
  /**
   * Constructor for Server
   * @constructor
   * @param {EncryptionService} encryptionService - The encryption service
   * @param {OIBusEngine} oibusEngine - The OIBus engine
   * @param {HistoryQueryEngine} historyQueryEngine - The HistoryQuery engine
   * @param {LoggerService} loggerService - LoggerService to use to create a child logger dedicated to the web server
   * @return {void}
   */
  constructor(encryptionService, oibusEngine, historyQueryEngine, loggerService) {
    this.encryptionService = encryptionService
    // capture the engine and logger under app for reuse in routes.
    this.engine = oibusEngine
    this.historyQueryEngine = historyQueryEngine
    this.loggerService = loggerService
    this.logger = null
    this.webServer = null // store the listening web server
  }

  /**
   * Start the web server
   * @returns {Promise<void>} - The result promise
   */
  async start() {
    this.logger = this.loggerService.createChildLogger('web-server')
    // Get the config entries
    const { engineConfig } = this.engine.configService.getConfig()
    const { user, password, port, filter = ['127.0.0.1', '::1'] } = engineConfig

    this.port = port
    this.user = user
    this.user = user
    this.password = null

    if (password) {
      try {
        this.password = await this.encryptionService.decryptText(password)
      } catch (error) {
        this.logger.error(error)
        this.password = null
      }
    }

    this.app = new Koa()
    this.app.engine = this.engine
    this.app.historyQueryEngine = this.historyQueryEngine
    this.app.logger = this.logger
    this.app.use(async (ctx, next) => {
      // check https://medium.com/trabe/server-sent-events-sse-streams-with-node-and-koa-d9330677f0bf
      if (!ctx.path.endsWith('/sse')) {
        await next()
        return
      }

      if (ctx.path.startsWith('/south/')) {
        const splitString = ctx.path.split('/')
        const south = this.engine.activeSouths.find((activeSouth) => activeSouth.id === splitString[2])
        if (!south) {
          await next()
          return
        }
        createSocket(ctx)
        ctx.body = south.statusService.getDataStream()
        south.statusService.forceDataUpdate()
      } else if (ctx.path.startsWith('/north/')) {
        const splitString = ctx.path.split('/')
        const north = this.engine.activeNorths.find((activeNorth) => activeNorth.id === splitString[2])
        if (!north) {
          await next()
          return
        }
        createSocket(ctx)
        ctx.body = north.statusService.getDataStream()
        north.statusService.forceDataUpdate()
      } else if (ctx.path.startsWith('/engine/')) {
        createSocket(ctx)
        ctx.body = this.engine.statusService.getDataStream()
        this.engine.statusService.forceDataUpdate()
      } else if (ctx.path.startsWith('/history-engine/')) {
        createSocket(ctx)
        ctx.body = this.historyQueryEngine.statusService.getDataStream()
        this.historyQueryEngine.statusService.forceDataUpdate()
      } else if (ctx.path.startsWith('/history-query/') && this.historyQueryEngine.historyQuery) {
        createSocket(ctx)
        ctx.body = this.historyQueryEngine.historyQuery.statusService.getDataStream()
        this.historyQueryEngine.historyQuery.statusService.forceDataUpdate()
      } else {
        await next()
      }
    })

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
          this.logger.warn('UnauthorizedError: Bad Combination Login/Password')
        } else {
          throw err
        }
      }
    })

    // Add simple "blanket" basic auth with username / password.
    // Password protect downstream middleware
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

    // Define routes
    this.app.use(router.routes())
    this.app.use(router.allowedMethods())
    this.app.use(webClient)

    this.webServer = this.app.listen(this.port, () => {
      this.logger.info(`Web server started on ${this.port}`)
    })
  }

  /**
   * Stop the web server
   * @returns {Promise<void>} - The result promise
   */
  async stop() {
    await this.webServer?.close()
  }
}
