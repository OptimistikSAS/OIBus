// @ts-ignore
import cors from '@koa/cors';
// @ts-ignore
import respond from 'koa-respond';
import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';

import router from './routes';
import auth from './middlewares/auth';
import ipFilter from './middlewares/ip-filter';
import webClient from './middlewares/web-client';
import sse from './middlewares/sse';
import EncryptionService from '../service/encryption.service';
import RepositoryService from '../service/repository.service';
import pino from 'pino';
import * as Http from 'http';
import Koa from 'koa';
import oibus from './middlewares/oibus';
import ReloadService from '../service/reload.service';
import { KoaApplication } from './koa';
import SouthService from '../service/south.service';
import OIBusService from '../service/oibus.service';
import NorthService from '../service/north.service';

/**
 * Class Server - Provides the web client and establish socket connections.
 */
export default class WebServer {
  private _logger: pino.Logger;
  private _id: string;
  private _port: number;
  private app: KoaApplication | null = null;
  private webServer: Http.Server | null = null;

  constructor(
    id: string,
    port: number,
    private readonly encryptionService: EncryptionService,
    private readonly reloadService: ReloadService,
    private readonly repositoryService: RepositoryService,
    private readonly southService: SouthService,
    private readonly northService: NorthService,
    private readonly oibusService: OIBusService,
    logger: pino.Logger
  ) {
    this._id = id;
    this._port = port;
    this._logger = logger;
  }

  get logger(): pino.Logger {
    return this._logger;
  }

  async setLogger(value: pino.Logger): Promise<void> {
    this._logger = value;
    await this.stop();
    await this.init();
  }

  get port(): number {
    return this._port;
  }

  async setPort(value: number): Promise<void> {
    this._port = value;
    await this.stop();
    await this.start();
  }

  /**
   * Initialise the web server services and middlewares
   */
  async init(): Promise<void> {
    this.app = new Koa() as KoaApplication;

    this.app.use(
      oibus(
        this._id,
        this.repositoryService,
        this.reloadService,
        this.encryptionService,
        this.southService,
        this.northService,
        this.oibusService,
        this.logger
      )
    );

    // koa-helmet is a wrapper for helmet to work with koa.
    // It provides important security headers to make your app more secure by default.
    this.app.use(helmet({ contentSecurityPolicy: false }));

    // Middleware for Koa that adds useful methods to the Koa context.
    this.app.use(respond());

    // filter IP addresses
    this.app.use(ipFilter());

    this.app.use(webClient);

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

    await this.start();
    this.reloadService.setWebServerChangeLogger(this.setLogger.bind(this));
    this.reloadService.setWebServerChangePort(this.setPort.bind(this));
  }

  async start(): Promise<void> {
    if (!this.app) return;
    this.webServer = this.app.listen(this.port, () => {
      this.logger.info(`OIBus web server started on ${this.port}`);
    });
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    await this.webServer?.close();
  }
}
