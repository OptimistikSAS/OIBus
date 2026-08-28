import { describe, it, beforeEach, afterEach, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AuditServiceMock from '../tests/__mocks__/service/audit-service.mock';
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
import ConfigTransferServiceMock from '../tests/__mocks__/service/config-transfer-service.mock';
import ConfigImportServiceMock from '../tests/__mocks__/service/config-import-service.mock';
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
import type ConfigTransferService from '../service/config-transfer/config-transfer.service';
import type ConfigImportService from '../service/config-transfer/config-import.service';
import type HomeMetricsService from '../service/metrics/home-metrics.service';
import type EncryptionService from '../service/encryption.service';
import type AuditService from '../service/audit.service';
import { NotFoundError, OIBusTestingError, OIBusValidationError } from '../model/types';
import os from 'node:os';

const nodeRequire = createRequire(import.meta.url);
// ValidateError is resolved after fixTsoaModuleResolution() in the before() hook.
let ValidateError: typeof import('tsoa').ValidateError;

const TEST_PORT = 19998;

// The Angular catch-all in web-server.ts's init() serves this file for any non-API/non-static
// path. It doesn't exist in a test environment (the frontend isn't built), so res.sendFile()
// always takes its ENOENT error path - whose exact timing/outcome (200 vs 404 vs 500, or worse,
// an indefinitely-pending response under heavy coverage instrumentation) is not reliable. Creating
// a real placeholder file here makes every test that (deliberately or incidentally) falls through
// to this path deterministic and fast instead.
const frontendIndexDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../frontend/browser');
const frontendIndexPath = path.join(frontendIndexDir, 'index.html');
let createdFrontendIndex = false;

// The embedded documentation site is served statically from this same relative location
// (mirroring the frontend's dist layout). Unlike frontend/browser, this relative path resolves
// to the repo's real top-level `documentation/` directory when tests run from source (not dist),
// so the placeholder MUST be a uniquely-named file we only ever create/delete by exact filename -
// never mkdir/rmSync the directory itself, since that directory already exists for real.
const documentationDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../documentation');
const documentationMarkerPath = path.join(documentationDir, '__oibus_test_placeholder__.html');
const documentationMarker = '<!doctype html><html><body>documentation placeholder</body></html>';
let createdDocumentationMarker = false;

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
    if (!fs.existsSync(frontendIndexPath)) {
      fs.mkdirSync(frontendIndexDir, { recursive: true });
      fs.writeFileSync(frontendIndexPath, '<!doctype html><html><body>test placeholder</body></html>');
      createdFrontendIndex = true;
    }

    if (!fs.existsSync(documentationMarkerPath)) {
      // Never recursive/removed: this directory is the repo's real documentation/ folder when
      // running from source, so only ever touch our own uniquely-named marker file below.
      fs.mkdirSync(documentationDir, { recursive: true });
      fs.writeFileSync(documentationMarkerPath, documentationMarker);
      createdDocumentationMarker = true;
    }

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

  after(() => {
    if (createdFrontendIndex) {
      fs.rmSync(frontendIndexDir, { recursive: true, force: true });
    }
    if (createdDocumentationMarker) {
      // Only remove the single marker file we created - never rmSync the directory, which is
      // the repo's real documentation/ folder when tests run from source.
      fs.rmSync(documentationMarkerPath, { force: true });
    }
  });

  // Builds an independent WebServer bound to its own port, for tests that need a real listen
  // cycle but must not share TEST_PORT with the shared `webServer`/other such tests - reusing the
  // same port across many sequential real listen/close cycles in one process is a known source of
  // bind races once close() is slowed down (e.g. under coverage instrumentation).
  function buildWebServer(port: number): WebServerClass {
    return new WebServer(
      port,
      encryptionMock as unknown as EncryptionService,
      new AuditServiceMock() as unknown as AuditService,
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
      new ConfigTransferServiceMock() as unknown as ConfigTransferService,
      new ConfigImportServiceMock() as unknown as ConfigImportService,
      false,
      loggerMock
    );
  }

  beforeEach(() => {
    ipFilterService = new IpFilterServiceMock();
    oIBusService = new OIBusServiceMock();
    encryptionMock = buildEncryptionMock();
    homeMetricsMock = buildHomeMetricsMock();

    webServer = buildWebServer(TEST_PORT);
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
      new AuditServiceMock() as unknown as AuditService,
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
      new ConfigTransferServiceMock() as unknown as ConfigTransferService,
      new ConfigImportServiceMock() as unknown as ConfigImportService,
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
      // Use a static-looking path (handled by the fast, filesystem-free handle404 middleware)
      // rather than an arbitrary path that falls through to the Angular catch-all's res.sendFile()
      // - that call targets a frontend build that doesn't exist in the test environment, and its
      // error-callback timing is not reliable under heavy coverage instrumentation.
      const res = await fetch(`http://localhost:${TEST_PORT}/assets/does-not-exist.png`, {
        headers: { Origin: 'http://localhost:4200' }
      });
      assert.ok(res.headers.has('access-control-allow-origin') || res.status === 200);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  describe('embedded documentation static mount', () => {
    it('serves files under /documentation via the static middleware, not the Angular fallback', async () => {
      await webServer.init();
      const res = await fetch(`http://localhost:${TEST_PORT}/documentation/__oibus_test_placeholder__.html`);
      assert.equal(res.status, 200);
      const body = await res.text();
      assert.equal(body, documentationMarker);
    });

    it('still serves the Angular index.html fallback for an unknown, non-documentation route', async () => {
      await webServer.init();
      const res = await fetch(`http://localhost:${TEST_PORT}/some-angular-route`);
      assert.equal(res.status, 200);
      const body = await res.text();
      assert.equal(body, '<!doctype html><html><body>test placeholder</body></html>');
    });

    it('leaves /api/ routes handled as API routes, unaffected by the /documentation static mount', async () => {
      await webServer.init();
      const res = await fetch(`http://localhost:${TEST_PORT}/api/engine`);
      // Unauthenticated API call: rejected by auth middleware, never reaches static/Angular handling.
      assert.equal(res.status, 401);
    });
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
      // Express's own app.handle() always schedules a final onerror(err) via finalhandler
      // regardless of our own error middleware having already responded to the request —
      // that callback does `console.error(err.stack)` unconditionally outside of app.get('env')
      // === 'test'. The /test-null-err case below deliberately hits the missing-index.html
      // path, so silence console.error for this test rather than fighting Express's internals.
      mock.method(console, 'error', () => undefined);
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
      // finalhandler's onerror logging is scheduled via setImmediate, so it can still fire
      // after this test function returns (and afterEach's mock.restoreAll() has already run).
      // Give it a tick to flush now, while console.error is still mocked.
      await new Promise(resolve => setImmediate(resolve));
    });
  });

  it('handle404: unmatched static-file-looking path falls through to 404 JSON handler', async () => {
    // Own port + own server instance so this doesn't add another real listen/close cycle on the
    // shared TEST_PORT (see buildWebServer's comment).
    const localPort = TEST_PORT + 20;
    const localServer = buildWebServer(localPort);
    try {
      await localServer.init();
      const res = await fetch(`http://localhost:${localPort}/assets/does-not-exist.png`);
      assert.equal(res.status, 404);
      const body = (await res.json()) as { error: string; message: string };
      assert.equal(body.error, 'Not Found');
      assert.match(body.message, /Cannot GET \/assets\/does-not-exist\.png/);
    } finally {
      await localServer.stop();
    }
  });

  it('setupRoutes: multer diskStorage destination/filename callbacks', async () => {
    const localPort = TEST_PORT + 21;
    const localServer = buildWebServer(localPort);
    const multerLib = nodeRequire('multer') as { diskStorage: (opts: unknown) => unknown };
    let capturedOptions:
      | {
          destination: (req: unknown, file: unknown, cb: (err: unknown, dest: string) => void) => void;
          filename: (req: unknown, file: { originalname: string }, cb: (err: unknown, name: string) => void) => void;
        }
      | undefined;
    mock.method(multerLib, 'diskStorage', (opts: typeof capturedOptions) => {
      capturedOptions = opts;
      return { _handleFile: mock.fn(), _removeFile: mock.fn() };
    });

    try {
      await localServer.init();

      const destCb = mock.fn();
      capturedOptions!.destination({}, {}, destCb);
      assert.deepStrictEqual(destCb.mock.calls[0]?.arguments, [null, os.tmpdir()]);

      const fileCb = mock.fn();
      capturedOptions!.filename({}, { originalname: 'test.txt' }, fileCb);
      assert.deepStrictEqual(fileCb.mock.calls[0]?.arguments, [null, 'test.txt']);
    } finally {
      await localServer.stop();
    }
  });

  it('start(): logs an error when the underlying listen callback reports one', () => {
    const fakeServer = { closeAllConnections: mock.fn(), close: mock.fn((cb: () => void) => cb()) };
    let listenCallback: ((error?: Error) => void) | undefined;
    (webServer as unknown as { app: { listen: (port: number, cb: (error?: Error) => void) => unknown } }).app = {
      listen: (_port: number, cb: (error?: Error) => void) => {
        listenCallback = cb;
        return fakeServer;
      }
    };

    webServer.start();
    listenCallback!(new Error('listen failed'));

    assert.deepStrictEqual(loggerMock.error.mock.calls.at(-1)?.arguments, [
      `Could not start server on port ${webServer.port}: listen failed`
    ]);
  });

  it('stop(): logs an error if closing the server throws', async () => {
    // Deliberately skip webServer.init() - it would create a real listening socket, and
    // immediately replacing `this.webServer` below would orphan that socket forever (nothing
    // would ever be able to close it). Only `this.webServer` needs to be truthy for stop() to
    // proceed into its try/catch.
    const closeError = new Error('close failed');
    (webServer as unknown as { webServer: { closeAllConnections: () => void; close: () => void } }).webServer = {
      closeAllConnections: () => {
        throw closeError;
      },
      close: mock.fn()
    };

    await webServer.stop();

    assert.ok(loggerMock.error.mock.calls.some(call => call.arguments[0] === closeError));
  });
});
