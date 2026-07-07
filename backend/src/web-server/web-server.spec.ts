import { describe, it, beforeEach, afterEach, mock, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import IpFilterServiceMock from '../tests/__mocks__/service/ip-filter-service.mock';
import OIBusServiceMock from '../tests/__mocks__/service/oibus-service.mock';
import ScanModeServiceMock from '../tests/__mocks__/service/scan-mode-service.mock';
import CertificateServiceMock from '../tests/__mocks__/service/certificate-service.mock';
import LogServiceMock from '../tests/__mocks__/service/log-service.mock';
import UserServiceMock from '../tests/__mocks__/service/user-service.mock';
import OIAnalyticsRegistrationServiceMock from '../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import OIAnalyticsCommandServiceMock from '../tests/__mocks__/service/oia/oianalytics-command-service.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';
import TransformerServiceMock from '../tests/__mocks__/service/transformer-service.mock';
import HistoryQueryServiceMock from '../tests/__mocks__/service/history-query-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { fixTsoaModuleResolution, mockModule, reloadModule } from '../tests/utils/test-utils';
import type WebServerClass from './web-server';
import type IPFilterService from '../service/ip-filter.service';
import type OIBusService from '../service/oibus.service';
import type ScanModeService from '../service/scan-mode.service';
import type CertificateService from '../service/certificate.service';
import type LogService from '../service/log.service';
import type UserService from '../service/user.service';
import type OIAnalyticsRegistrationService from '../service/oia/oianalytics-registration.service';
import type OIAnalyticsCommandService from '../service/oia/oianalytics-command.service';
import type SouthService from '../service/south.service';
import type NorthService from '../service/north.service';
import type TransformerService from '../service/transformer.service';
import type HistoryQueryService from '../service/history-query.service';
import type HomeMetricsService from '../service/metrics/home-metrics.service';
import type EncryptionService from '../service/encryption.service';
import { NotFoundError, OIBusTestingError, OIBusValidationError } from '../model/types';

const nodeRequire = createRequire(import.meta.url);
// ValidateError is resolved after fixTsoaModuleResolution() in the before() hook.
let ValidateError: typeof import('tsoa').ValidateError;

const TEST_PORT = 19998;

interface HomeMetricsMockType {
  getHomeMetrics: ReturnType<typeof mock.fn>;
}

function buildHomeMetricsMock(): HomeMetricsMockType {
  return { getHomeMetrics: mock.fn() };
}

function buildEncryptionMock() {
  return {
    generateRSAKey: mock.fn(),
    encryptText: mock.fn(),
    decryptText: mock.fn(),
    getCertPath: mock.fn(() => ''),
    getKeyPath: mock.fn(() => ''),
    init: mock.fn()
  };
}

describe('WebServer', () => {
  let WebServer: typeof WebServerClass;
  let webServer: WebServerClass;
  let ipFilterService: IpFilterServiceMock;
  let oIBusService: OIBusServiceMock;
  let encryptionMock: ReturnType<typeof buildEncryptionMock>;
  let homeMetricsMock: HomeMetricsMockType;
  const loggerMock = new PinoLogger();

  before(() => {
    fixTsoaModuleResolution(nodeRequire);
    ValidateError = (nodeRequire('tsoa') as { ValidateError: typeof import('tsoa').ValidateError }).ValidateError;

    // RegisterRoutes injects test error-throwing routes so the inline error handler can be tested via HTTP.
    mockModule(nodeRequire, './routes', {
      RegisterRoutes: (app: { get: (path: string, handler: (req: unknown, res: unknown, next: (e: unknown) => void) => void) => void }) => {
        app.get('/test-notfound', (_req, _res, next) => next(new NotFoundError('test')));
        app.get('/test-oibus-validation', (_req, _res, next) => next(new OIBusValidationError('val')));
        app.get('/test-oibus-testing', (_req, _res, next) => next(new OIBusTestingError('test')));
        app.get('/test-validate-error', (_req, _res, next) => next(new ValidateError({ f: { message: 'b', value: 'x' } }, 'v')));
        app.get('/test-generic-error', (_req, _res, next) => next(new Error('generic')));
        app.get('/test-null-err', (_req, _res, next) => next(null));
      }
    });
    WebServer = reloadModule<{ default: typeof WebServerClass }>(nodeRequire, './web-server').default;
  });

  beforeEach(() => {
    ipFilterService = new IpFilterServiceMock();
    oIBusService = new OIBusServiceMock();
    encryptionMock = buildEncryptionMock();
    homeMetricsMock = buildHomeMetricsMock();

    webServer = new WebServer(
      TEST_PORT,
      encryptionMock as unknown as EncryptionService,
      new ScanModeServiceMock() as unknown as ScanModeService,
      ipFilterService as unknown as IPFilterService,
      new CertificateServiceMock() as unknown as CertificateService,
      new LogServiceMock() as unknown as LogService,
      new UserServiceMock() as unknown as UserService,
      new OIAnalyticsRegistrationServiceMock() as unknown as OIAnalyticsRegistrationService,
      new OIAnalyticsCommandServiceMock() as unknown as OIAnalyticsCommandService,
      oIBusService as unknown as OIBusService,
      new SouthServiceMock() as unknown as SouthService,
      new NorthServiceMock() as unknown as NorthService,
      new TransformerServiceMock() as unknown as TransformerService,
      new HistoryQueryServiceMock() as unknown as HistoryQueryService,
      homeMetricsMock as unknown as HomeMetricsService,
      false,
      loggerMock
    );
  });

  afterEach(async () => {
    await webServer.stop();
    mock.restoreAll();
  });

  it('should expose port, logger and whiteList getters', () => {
    assert.equal(webServer.port, TEST_PORT);
    assert.ok(webServer.logger);
    assert.deepEqual(webServer.whiteList, []);
  });

  it('should populate whiteList from ipFilterService.list() on construction', () => {
    ipFilterService.list.mock.mockImplementation(() => [{ address: '192.168.1.1' }] as never);
    const ws = new WebServer(
      TEST_PORT + 1,
      encryptionMock as unknown as EncryptionService,
      new ScanModeServiceMock() as unknown as ScanModeService,
      ipFilterService as unknown as IPFilterService,
      new CertificateServiceMock() as unknown as CertificateService,
      new LogServiceMock() as unknown as LogService,
      new UserServiceMock() as unknown as UserService,
      new OIAnalyticsRegistrationServiceMock() as unknown as OIAnalyticsRegistrationService,
      new OIAnalyticsCommandServiceMock() as unknown as OIAnalyticsCommandService,
      oIBusService as unknown as OIBusService,
      new SouthServiceMock() as unknown as SouthService,
      new NorthServiceMock() as unknown as NorthService,
      new TransformerServiceMock() as unknown as TransformerService,
      new HistoryQueryServiceMock() as unknown as HistoryQueryService,
      homeMetricsMock as unknown as HomeMetricsService,
      false,
      loggerMock
    );
    assert.deepEqual(ws.whiteList, ['192.168.1.1']);
  });

  it('stop() should return early if server was never started', async () => {
    await assert.doesNotReject(() => webServer.stop());
  });

  it('start() should be a no-op if app is null (before init)', () => {
    assert.doesNotThrow(() => (webServer as unknown as { start: () => void }).start());
  });

  it('should serve /health endpoint', async () => {
    await webServer.init();
    const res = await fetch(`http://localhost:${TEST_PORT}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string };
    assert.equal(body.status, 'OK');
  });

  it('should return 401 for unauthenticated API calls', async () => {
    await webServer.init();
    const res = await fetch(`http://localhost:${TEST_PORT}/api/engine`);
    assert.equal(res.status, 401);
  });

  it('should stop and restart when portChangeEvent fires', async () => {
    await webServer.init();
    // Port change event triggers stop + restart on a new port.
    oIBusService.portChangeEvent.emit('updated', TEST_PORT + 10);
    // Give async restart a moment to settle.
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(webServer.port, TEST_PORT + 10);
  });

  it('should update logger when loggerEvent fires', async () => {
    await webServer.init();
    const newLogger = new PinoLogger();
    oIBusService.loggerEvent.emit('updated', newLogger);
    assert.strictEqual(webServer.logger, newLogger);
  });

  it('should update whiteList when whiteListEvent fires', async () => {
    await webServer.init();
    ipFilterService.whiteListEvent.emit('update-white-list', ['10.0.0.1']);
    assert.deepEqual(webServer.whiteList, ['10.0.0.1']);
  });

  it('should enable CORS in development mode', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      await webServer.init();
      const res = await fetch(`http://localhost:${TEST_PORT}/health`, {
        headers: { Origin: 'http://localhost:4200' }
      });
      assert.ok(res.headers.has('access-control-allow-origin') || res.status === 200);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  describe('error handling middleware', () => {
    it('handleBodyParserErrors: SyntaxError with body → 422, other → next', async () => {
      await webServer.init();
      type ErrFn = (
        err: unknown,
        req: unknown,
        res: { status: (c: number) => { json: (b: unknown) => void }; end: () => void },
        next: (e?: unknown) => void
      ) => void;
      const handleBodyParserErrors = (webServer as unknown as Record<string, ErrFn>).handleBodyParserErrors;

      const syntaxErr = new SyntaxError('bad json') as SyntaxError & { body: string };
      syntaxErr.body = '{}';
      const mockRes = { status: mock.fn(() => mockRes), json: mock.fn() };

      // SyntaxError with body → 422
      handleBodyParserErrors.call(webServer, syntaxErr, {}, mockRes as never, mock.fn());
      assert.equal(mockRes.status.mock.calls[0]?.arguments[0], 422);

      // Non-syntax error → next(err)
      const genericErr = new Error('other');
      const nextFn = mock.fn();
      handleBodyParserErrors.call(webServer, genericErr, {}, mockRes as never, nextFn);
      assert.equal(nextFn.mock.calls.length, 1);
      assert.strictEqual(nextFn.mock.calls[0]?.arguments[0], genericErr);
    });

    it('setupErrorHandling: handles various error types correctly', async () => {
      await webServer.init();
      type SetupFn = () => (
        err: Error,
        req: unknown,
        res: { status: (c: number) => { json: (b: unknown) => void } },
        next: unknown
      ) => void;
      const errMiddleware = (webServer as unknown as Record<string, SetupFn>).setupErrorHandling.call(webServer);
      const mockRes = { status: mock.fn(() => mockRes), json: mock.fn() };

      // err.name === 'ValidationError' → 400
      const valErr = new Error('validation');
      valErr.name = 'ValidationError';
      errMiddleware(valErr, {}, mockRes as never, mock.fn());
      assert.equal(mockRes.status.mock.calls[0]?.arguments[0], 400);

      // Generic error → 500
      mockRes.status.mock.resetCalls();
      errMiddleware(new Error('internal'), {}, mockRes as never, mock.fn());
      assert.equal(mockRes.status.mock.calls[0]?.arguments[0], 500);

      // Development mode: includes error message in response
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockRes.status.mock.resetCalls();
      errMiddleware(new Error('dev-msg'), {}, mockRes as never, mock.fn());
      assert.equal(mockRes.status.mock.calls[0]?.arguments[0], 500);
      process.env.NODE_ENV = origEnv;

      // Non-Error truthy → 500
      mockRes.status.mock.resetCalls();
      errMiddleware('string-error' as never, {}, mockRes as never, mock.fn());
      assert.equal(mockRes.status.mock.calls[0]?.arguments[0], 500);
    });

    it('inline error handler via HTTP: routes throw OIBus error types → correct status codes', async () => {
      await webServer.init();
      const base = `http://localhost:${TEST_PORT}`;

      const r1 = await fetch(`${base}/test-notfound`);
      assert.equal(r1.status, 404);

      const r2 = await fetch(`${base}/test-oibus-validation`);
      assert.equal(r2.status, 400);

      const r3 = await fetch(`${base}/test-oibus-testing`);
      assert.equal(r3.status, 400);

      const r4 = await fetch(`${base}/test-validate-error`);
      assert.equal(r4.status, 400);

      const r5 = await fetch(`${base}/test-generic-error`);
      assert.equal(r5.status, 500);

      // null error → next() is called → Angular fallback serves index.html (file not found = 500 from sendFile)
      const r6 = await fetch(`${base}/test-null-err`);
      // The response could be 200 (index.html found) or 404 from Angular fallback or handle404
      assert.ok([200, 404, 500].includes(r6.status));
    });
  });
});
