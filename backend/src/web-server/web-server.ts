// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import respond from 'koa-respond';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';

import router from './routes';
import auth from './middlewares/auth';
import ipFilter from './middlewares/ip-filter';
import webClient from './middlewares/web-client';
import sse from './middlewares/sse';
import EncryptionService from '../service/encryption.service';
import pino from 'pino';
import * as Http from 'http';
import Koa from 'koa';
import oibus from './middlewares/oibus';
import { KoaApplication } from './koa';
import SouthService from '../service/south.service';
import OIBusService from '../service/oibus.service';
import NorthService from '../service/north.service';
import ScanModeService from '../service/scan-mode.service';
import IPFilterService from '../service/ip-filter.service';
import OIAnalyticsCommandService from '../service/oia/oianalytics-command.service';
import OIAnalyticsRegistrationService from '../service/oia/oianalytics-registration.service';
import HistoryQueryService from '../service/history-query.service';
import HomeMetricsService from '../service/metrics/home-metrics.service';
import CertificateService from '../service/certificate.service';
import UserService from '../service/user.service';
import LogService from '../service/log.service';
import TransformerService from '../service/transformer.service';

/**
 * Class Server - Provides the web client and establish socket connections.
 */
export default class WebServer {
  private _logger: pino.Logger;
  private readonly _id: string;
  private _port: number;
  private app: KoaApplication | null = null;
  private webServer: Http.Server | null = null;

  constructor(
    id: string,
    port: number,
    private readonly encryptionService: EncryptionService,
    private readonly scanModeService: ScanModeService,
    private readonly ipFilterService: IPFilterService,
    private readonly certificateService: CertificateService,
    private readonly logService: LogService,
    private readonly userService: UserService,
    private readonly oIAnalyticsRegistrationService: OIAnalyticsRegistrationService,
    private readonly oIAnalyticsCommandService: OIAnalyticsCommandService,
    private readonly oIBusService: OIBusService,
    private readonly southService: SouthService,
    private readonly northService: NorthService,
    private readonly transformerService: TransformerService,
    private readonly historyQueryService: HistoryQueryService,
    private readonly homeMetricsService: HomeMetricsService,
    private readonly ignoreIpFilters: boolean,
    logger: pino.Logger
  ) {
    this._id = id;
    this._port = port;
    this._logger = logger;
  }

  get logger(): pino.Logger {
    return this._logger;
  }

  get port(): number {
    return this._port;
  }

  /**
   * Initialise the web server services and middlewares
   */
  async init(): Promise<void> {
    this.app = new Koa() as KoaApplication;

    this.app.whiteList = ['127.0.0.1', '::1', '::ffff:127.0.0.1', ...this.ipFilterService.findAll().map(filter => filter.address)];

    this.app.use(
      oibus(
        this._id,
        this.scanModeService,
        this.ipFilterService,
        this.certificateService,
        this.logService,
        this.oIAnalyticsRegistrationService,
        this.oIAnalyticsCommandService,
        this.oIBusService,
        this.southService,
        this.northService,
        this.transformerService,
        this.historyQueryService,
        this.homeMetricsService,
        this.encryptionService,
        this.userService,
        this.logger
      )
    );

    // koa-helmet is a wrapper for helmet to work with koa.
    // It provides important security headers to make your app more secure by default.
    this.app.use(helmet({ contentSecurityPolicy: false }));

    // Middleware for Koa that adds useful methods to the Koa context.
    this.app.use(respond());

    // filter IP addresses
    this.app.use(ipFilter(this.ignoreIpFilters));

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
  }

  async start(): Promise<void> {
    this.oIBusService.loggerEvent.on('updated', (logger: pino.Logger) => {
      this._logger = logger;
    });
    this.oIBusService.portChangeEvent.on('updated', async (value: number) => {
      this._port = value;
      await this.stop();
      await this.start();
    });
    this.ipFilterService.whiteListEvent.on('update-white-list', (newWhiteList: Array<string>) => {
      if (this.app) {
        this.app.whiteList = newWhiteList;
      }
    });
    if (!this.app) return;
    this.webServer = this.app.listen(this.port, () => {
      this.logger.info(`OIBus web server started on ${this.port}`);
    });
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    this.webServer?.close();
  }
}
