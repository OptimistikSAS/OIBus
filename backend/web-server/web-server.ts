// @ts-ignore
import cors from '@koa/cors';
// @ts-ignore
import respond from 'koa-respond';
import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';

import router from './routes/index';
import auth from './middlewares/auth';
import ipFilter from './middlewares/ip-filter';
import webClient from './middlewares/web-client';
import sse from './middlewares/sse';
import EncryptionService from '../service/encryption.service';
import OIBusEngine from '../engine/oibus-engine';
import HistoryQueryEngine from '../engine/history-query-engine';
import LoggerService from '../service/logger/logger.service';
import RepositoryService from '../service/repository.service';
import pino from 'pino';
import * as Http from 'http';
import Koa from 'koa';
import Logger = pino.Logger;
import oibus from './middlewares/oibus';

/**
 * Class Server - Provides the web client and establish socket connections.
 */
export default class WebServer {
  private readonly encryptionService: EncryptionService;
  private readonly loggerService: LoggerService;
  private readonly repositoryService: RepositoryService;
  private logger: Logger | null = null;
  private port: number | null = null;
  private app: Koa | null = null;
  private webServer: Http.Server | null = null;

  /**
   * Constructor for Server
   * @constructor
   * @param {EncryptionService} encryptionService - The encryption service
   * @param {OIBusEngine} oibusEngine - The OIBus engine
   * @param {HistoryQueryEngine} historyQueryEngine - The HistoryQuery engine
   * @param {LoggerService} loggerService - LoggerService to use to create a child logger dedicated to the web server
   * @param {RepositoryService} repositoryService - RepositoryService used to interact with the local database
   * @return {void}
   */
  constructor(
    encryptionService: EncryptionService,
    oibusEngine: OIBusEngine,
    historyQueryEngine: HistoryQueryEngine,
    loggerService: LoggerService,
    repositoryService: RepositoryService
  ) {
    this.encryptionService = encryptionService;
    this.loggerService = loggerService;
    this.repositoryService = repositoryService;
  }

  /**
   * Start the web server
   * @returns {Promise<void>} - The result promise
   */
  async start(id: string, port = 2223) {
    this.logger = this.loggerService.createChildLogger('web-server');
    this.port = port;

    this.app = new Koa();

    this.app.use(oibus(id, this.repositoryService, this.encryptionService, this.logger));

    // koa-helmet is a wrapper for helmet to work with koa.
    // It provides important security headers to make your app more secure by default.
    this.app.use(helmet({ contentSecurityPolicy: false }));

    // Middleware for Koa that adds useful methods to the Koa context.
    this.app.use(respond());

    // filter IP addresses
    this.app.use(ipFilter());

    // Password protect middleware
    this.app.use(auth());

    this.app.use(sse());

    // CORS middleware for Koa
    this.app.use(cors());

    // A body parser for koa, base on co-body. support json, form and text type body.
    this.app.use(
      bodyParser({
        enableTypes: ['json', 'text'],
        jsonLimit: '20mb',
        strict: true,
        onerror(err, ctx) {
          ctx.throw('body parse error', 422);
        }
      })
    );

    this.app.use(router.routes());
    this.app.use(router.allowedMethods());
    this.app.use(webClient);

    this.webServer = this.app.listen(this.port, () => {
      this.logger!.info(`Web server started on ${this.port}`);
    });
  }

  /**
   * Stop the web server
   * @returns {Promise<void>} - The result promise
   */
  async stop() {
    await this.webServer?.close();
  }
}
