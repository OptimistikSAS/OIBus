import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import multer from 'multer';
import { ValidateError } from 'tsoa';
import { NotFoundError, OIBusTestingError, OIBusValidationError } from '../model/types';

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
    this._whiteList = this.ipFilterService.list().map(filter => filter.address);
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

    // Helmet for Express with Content Security Policy
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-eval'"], // unsafe-eval required for Monaco Editor
            styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline required for Monaco Editor
            imgSrc: ["'self'", 'data:'], // data: required for SVG in styles
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            workerSrc: ["'self'", 'blob:'] // blob: required for Monaco Editor workers
          }
        }
      })
    );
    this.app.disable('x-powered-by'); // Remove X-Powered-By header

    this.app.use(this.setupRequestLogging());

    // IP filter middleware
    const ipFilter = new IpFilterMiddleware(this.whiteList, this.logger, this.ignoreIpFilters);
    this.app.use(ipFilter.middleware());

    this.app.use(
      createInjectServicesMiddleware(
        this.certificateService,
        this.historyQueryService,
        this.ipFilterService,
        this.logService,
        this.northService,
        this.oIAnalyticsCommandService,
        this.oIAnalyticsRegistrationService,
        this.oIBusService,
        this.scanModeService,
        this.southService,
        this.transformerService,
        this.userService
      )
    );

    // Static files for web client
    this.app.use(express.static(path.join(__dirname, '../../../frontend/browser')));

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

    // Create a function to check if a path is an API route
    const isApiRoute = (path: string) => {
      return path.startsWith('/api/');
    };

    // Create a function to check if a path is a static file
    const isStaticFile = (path: string) => {
      return path.startsWith('/assets/') || path === '/favicon.ico';
    };

    // Rate limiting for configuration API endpoints
    const apiRateLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      limit: 5_000, // max 100 requests per windowMs per IP
      message: { error: 'Too many requests, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
      skip: req => {
        // Skip rate limiting for:
        // - Content endpoints (unpredictable call frequency)
        // - SSE endpoints (long-lived connections)
        // - Non-API routes
        return req.path.startsWith('/api/content') || req.path.startsWith('/sse') || !req.path.startsWith('/api/');
      }
    });

    this.app.use(apiRateLimiter);

    // Authentication middleware for API routes only
    this.app.use((req, res, next) => {
      if (isApiRoute(req.path)) {
        return authMiddleware(this.userService, this.encryptionService)(req, res, next);
      }
      return next();
    });

    // SSE middleware
    this.app.use(sseMiddleware(this.southService, this.northService, this.oIBusService, this.homeMetricsService, this.historyQueryService));

    // Routes
    this.app.get('/health', this.healthCheck.bind(this));
    this.setupRoutes(this.app);
    this.app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err instanceof NotFoundError) {
        // Not Found Error trigger by OIBus at the service layer if an entity is not found
        return res.status(404).json({ error: err.message });
      }
      if (err instanceof OIBusValidationError) {
        // Validation Error trigger by OIBus at the service layer
        return res.status(400).json({
          message: 'Validation Failed',
          details: err.message
        });
      }
      if (err instanceof OIBusTestingError) {
        // Validation Error trigger by OIBus at the service layer
        return res.status(400).json({
          message: err.message,
          details: 'Error while testing connection'
        });
      }
      if (err instanceof ValidateError) {
        // Validation Error trigger by tsoa at the HTTP layer
        return res.status(422).json({
          message: 'Validation Failed',
          details: err.fields
        });
      }
      if (err) {
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        return res.status(500).json({ error: message });
      }
      return next();
    });

    // Final middleware to serve Angular routes
    this.app.use((req, res, next) => {
      if (!isApiRoute(req.path) && !isStaticFile(req.path)) {
        return res.sendFile(path.join(__dirname, '../../../frontend/browser', 'index.html'));
      }
      return next();
    });

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
    const isDevelopment = process.env.NODE_ENV === 'development';

    const corsOptions = {
      origin: isDevelopment ? ['http://localhost:4200', 'http://127.0.0.1:4200'] : false,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      credentials: true,
      maxAge: 86400 // 24 hours
    };
    return cors(corsOptions);
  }

  private setupRoutes(app: Express): void {
    // Routes are generated with the npm run generate:openapi command
    RegisterRoutes(app, {
      multer: multer({
        limits: {
          fieldNameSize: 120
          // any other multer config
        }
      })
    });
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
    if (!this.webServer) return;

    try {
      this.webServer.closeAllConnections();
      await new Promise<void>(resolve => {
        this.webServer!.close(() => resolve());
        setTimeout(() => resolve(), 5000);
      });
    } catch (error) {
      this.logger.error(error);
    }
  }
}
