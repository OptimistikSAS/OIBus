import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import authMiddleware from './middlewares/auth.middleware';
import sseMiddleware from './middlewares/sse.middleware';
import EncryptionService from '../service/encryption.service';
import pino from 'pino';
import * as Http from 'http';
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
import { Express } from 'express-serve-static-core';
import IpFilterMiddleware from './middlewares/ip-filter.middleware';
import { createInjectServicesMiddleware } from './middlewares/services.middleware';
import { RegisterRoutes } from './routes';
import path from 'path';

/**
 * OIBus web server - using express
 */
export default class WebServer {
  private _logger: pino.Logger;
  private readonly _id: string;
  private _port: number;
  private _whiteList: Array<string> = [];
  private app: Express | null = null;
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
    this._whiteList = this.ipFilterService.findAll().map(filter => filter.address);
  }

  get logger(): pino.Logger {
    return this._logger;
  }

  get port(): number {
    return this._port;
  }

  get whiteList(): Array<string> {
    return this._whiteList;
  }

  async init(): Promise<void> {
    this.app = express();

    // Helmet for Express
    this.app.use(helmet({ contentSecurityPolicy: false }));
    this.app.disable('x-powered-by'); // Remove X-Powered-By header

    this.app.use(this.setupRequestLogging());

    // IP filter middleware
    const ipFilter = new IpFilterMiddleware(this.whiteList, this.logger, this.ignoreIpFilters);
    this.app.use(ipFilter.middleware());

    this.app.use(createInjectServicesMiddleware(this.scanModeService, this.certificateService));

    // Static files for web client
    this.app.use(express.static(path.join(__dirname, '../../../frontend/browser')));

    // Password protection middleware
    this.app.use(authMiddleware(this.userService, this.encryptionService));

    // CORS middleware
    this.app.use(this.setupCors());

    // Body parser for Express
    this.app.use(
      bodyParser.json({
        limit: '20mb',
        strict: true
      })
    );
    this.app.use(
      bodyParser.text({
        limit: '20mb'
      })
    );
    this.app.use(express.json({ limit: '20mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '20mb' }));

    // SSE middleware
    this.app.use(sseMiddleware(this.southService, this.northService, this.oIBusService, this.homeMetricsService, this.historyQueryService));

    // Routes
    this.app.get('/health', this.healthCheck.bind(this));
    this.setupRoutes(this.app);

    // Error handling
    this.app.use(this.handle404.bind(this));
    this.app.use(this.handleBodyParserErrors.bind(this));
    this.app.use(this.setupErrorHandling());

    await this.start();
  }

  private setupRequestLogging(): express.RequestHandler {
    return (req, res, next) => {
      this.logger.trace(`${req.method} ${req.path}`);
      return next();
    };
  }

  private setupCors(): express.RequestHandler {
    const corsOptions = {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      credentials: true,
      maxAge: 86400 // 24 hours
    };
    return cors(corsOptions);
  }

  private setupRoutes(app: Express): void {
    // Routes are generated with the npm run generate:openapi command
    RegisterRoutes(app);
  }

  private healthCheck(_req: express.Request, res: express.Response): void {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString()
    });
  }

  private handle404(req: express.Request, res: express.Response): void {
    res.status(404).json({
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.path}`
    });
  }

  private handleBodyParserErrors(err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction): void {
    if (err instanceof SyntaxError && 'body' in err) {
      this.logger.warn(`Body parse error: ${err.message}`);
      res.status(422).json({
        error: 'Unprocessable Entity',
        message: 'Invalid JSON payload'
      });
    } else {
      next(err);
    }
  }

  private setupErrorHandling(): express.ErrorRequestHandler {
    return (err: Error, req: express.Request, res: express.Response) => {
      this.logger.error(`Unhandled error: ${err.stack}`);

      // Handle specific error types
      if (err.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation Error',
          message: err.message
        });
      }

      // Default to 500 server error
      return res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    };
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
      this._whiteList = newWhiteList;
    });

    if (!this.app) return;

    this.webServer = this.app.listen(this.port, () => {
      this.logger.info(`OIBus web server started on ${this.port}`);
    });
  }

  async stop(): Promise<void> {
    if (this.webServer) {
      await new Promise<void>((resolve, reject) => {
        this.webServer?.close(err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }
}
