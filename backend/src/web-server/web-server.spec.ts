import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import * as forge from 'node-forge';

import { WebServerHttpsSettings } from '../../shared/model/domain/engine.model';

import { NotFoundError, OIBusTestingError, OIBusValidationError } from '../model/types';
import type AuditService from '../service/audit.service';
import type CertificateService from '../service/certificate.service';
import type ConfigImportService from '../service/config-transfer/config-import.service';
import { ConfigImportError } from '../service/config-transfer/config-import.service';
import type ConfigTransferService from '../service/config-transfer/config-transfer.service';
import type ConfigurationWorkflowService from '../service/configuration-workflow.service';
import type ConfigurationWorkflowRunService from '../service/configuration-workflow-run.service';
import type EncryptionService from '../service/encryption.service';
import type HistoryQueryService from '../service/history-query.service';
import type IPFilterService from '../service/ip-filter.service';
import type LogService from '../service/log.service';
import type NorthService from '../service/north.service';
import type OIAnalyticsCommandService from '../service/oia/oianalytics-command.service';
import type OIAnalyticsRegistrationService from '../service/oia/oianalytics-registration.service';
import type OIBusService from '../service/oibus.service';
import type ScanModeService from '../service/scan-mode.service';
import type SouthService from '../service/south.service';
import type TransformerService from '../service/transformer.service';
import type UserService from '../service/user.service';
import AuditServiceMock from '../tests/__mocks__/service/audit-service.mock';
import CertificateServiceMock from '../tests/__mocks__/service/certificate-service.mock';
import ConfigImportServiceMock from '../tests/__mocks__/service/config-import-service.mock';
import ConfigTransferServiceMock from '../tests/__mocks__/service/config-transfer-service.mock';
import ConfigurationWorkflowRunServiceMock from '../tests/__mocks__/service/configuration-workflow-run-service.mock';
import ConfigurationWorkflowServiceMock from '../tests/__mocks__/service/configuration-workflow-service.mock';
import HistoryQueryServiceMock from '../tests/__mocks__/service/history-query-service.mock';
import IpFilterServiceMock from '../tests/__mocks__/service/ip-filter-service.mock';
import LogServiceMock from '../tests/__mocks__/service/log-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';
import OIAnalyticsCommandServiceMock from '../tests/__mocks__/service/oia/oianalytics-command-service.mock';
import OIAnalyticsRegistrationServiceMock from '../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import OIBusServiceMock from '../tests/__mocks__/service/oibus-service.mock';
import ScanModeServiceMock from '../tests/__mocks__/service/scan-mode-service.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import TransformerServiceMock from '../tests/__mocks__/service/transformer-service.mock';
import UserServiceMock from '../tests/__mocks__/service/user-service.mock';
import testData from '../tests/utils/test-data';
import { fixTsoaModuleResolution, mockModule, reloadModule } from '../tests/utils/test-utils';
import type WebServerClass from './web-server';

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
// A script of the frontend build, named with the hash of its content. Only ever created/deleted by its exact filename, in
// case the frontend has been built for real.
const frontendChunkPath = path.join(frontendIndexDir, 'chunk-TEST1234.js');
const frontendChunk = "export const chunk = 'test';";

// The embedded documentation site is served statically from this same relative location
// (mirroring the frontend's dist layout). Unlike frontend/browser, this relative path resolves
// to the repo's real top-level `documentation/` directory when tests run from source (not dist),
// so the placeholder MUST be a uniquely-named file we only ever create/delete by exact filename -
// never mkdir/rmSync the directory itself, since that directory already exists for real.
const documentationDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../documentation');
const documentationMarkerPath = path.join(documentationDir, '__oibus_test_placeholder__.html');
const documentationMarker = '<!doctype html><html><body>documentation placeholder</body></html>';
let createdDocumentationMarker = false;

const HTTPS_SETTINGS: WebServerHttpsSettings = {
  enabled: true,
  certificateSource: 'file',
  certificateId: null,
  certificatePath: 'oibus.crt',
  privateKeyPath: 'oibus.key'
};

function buildSelfSignedCredentials(): { cert: string; key: string } {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  cert.setSubject([{ shortName: 'CN', value: 'localhost' }]);
  cert.setIssuer([{ shortName: 'CN', value: 'localhost' }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert: forge.pki.certificateToPem(cert), key: forge.pki.privateKeyToPem(keys.privateKey) };
}

// Status of a GET over HTTPS, accepting the self-signed certificate of the test
function httpsGetStatus(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { rejectUnauthorized: false }, res => {
        res.resume();
        resolve(res.statusCode!);
      })
      .on('error', reject);
  });
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
  const loggerMock = new PinoLogger();

  before(() => {
    if (!fs.existsSync(frontendIndexPath)) {
      fs.mkdirSync(frontendIndexDir, { recursive: true });
      fs.writeFileSync(frontendIndexPath, '<!doctype html><html><body>test placeholder</body></html>');
      createdFrontendIndex = true;
    }
    fs.writeFileSync(frontendChunkPath, frontendChunk);

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
        app.get('/test-config-import-error', (_req, _res, next) =>
          next(new ConfigImportError('import failed', [{ scope: 'south', entityId: 'id1', message: 'bad' }]))
        );
        app.get('/test-non-error-throw', (_req, _res, next) => next('a plain string, not an Error instance'));
        app.get('/test-null-err', (_req, _res, next) => next(null));
      }
    });
    WebServer = reloadModule<{ default: typeof WebServerClass }>(nodeRequire, './web-server').default;
  });

  after(() => {
    fs.rmSync(frontendChunkPath, { force: true });
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
  function buildWebServer(port: number, httpsSettings = testData.engine.settings.webServer.https): WebServerClass {
    return new WebServer(
      { ...testData.engine.settings.webServer, port, https: httpsSettings },
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
      new ConfigurationWorkflowServiceMock() as unknown as ConfigurationWorkflowService,
      new ConfigurationWorkflowRunServiceMock() as unknown as ConfigurationWorkflowRunService,
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
      { ...testData.engine.settings.webServer, port: TEST_PORT + 1 },
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
      new ConfigurationWorkflowServiceMock() as unknown as ConfigurationWorkflowService,
      new ConfigurationWorkflowRunServiceMock() as unknown as ConfigurationWorkflowRunService,
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

  it('start() should be a no-op if app is null (before init)', async () => {
    await assert.doesNotReject(() => webServer.start());
  });

  it('should return 401 for unauthenticated API calls', async () => {
    await webServer.init();
    const res = await fetch(`http://localhost:${TEST_PORT}/api/engine`);
    assert.equal(res.status, 401);
  });

  it('should stop and restart when webServerChangeEvent fires', async () => {
    await webServer.init();
    // Web server change event triggers stop + restart on a new port.
    const settings = { ...testData.engine.settings.webServer, port: TEST_PORT + 10 };
    oIBusService.webServerChangeEvent.emit('updated', settings);
    // Give async restart a moment to settle.
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(webServer.port, TEST_PORT + 10);
    assert.strictEqual(webServer.settings, settings);
  });

  it('should serve HTTPS with the certificate of its settings', async () => {
    const localPort = TEST_PORT + 22;
    const credentials = buildSelfSignedCredentials();
    oIBusService.getWebServerCredentials.mock.mockImplementation(async () => credentials);
    const localServer = buildWebServer(localPort, HTTPS_SETTINGS);
    try {
      await localServer.init();
      await new Promise(resolve => setTimeout(resolve, 50));

      assert.equal(await httpsGetStatus(`https://localhost:${localPort}/api/engine`), 401);
      assert.deepStrictEqual(oIBusService.getWebServerCredentials.mock.calls[0].arguments, [HTTPS_SETTINGS]);
      assert.deepStrictEqual(loggerMock.info.mock.calls.at(-1)?.arguments, [`OIBus web server started on ${localPort} (HTTPS)`]);
    } finally {
      await localServer.stop();
    }
  });

  it('should fall back to HTTP when the HTTPS certificate cannot be loaded', async () => {
    const localPort = TEST_PORT + 23;
    oIBusService.getWebServerCredentials.mock.mockImplementation(async () => {
      throw new OIBusValidationError('Certificate "certificateId" not found');
    });
    const localServer = buildWebServer(localPort, HTTPS_SETTINGS);
    try {
      await localServer.init();

      const res = await fetch(`http://localhost:${localPort}/api/engine`);
      assert.equal(res.status, 401);
      assert.ok(
        loggerMock.error.mock.calls.some(
          call =>
            call.arguments[0] ===
            'Could not load the HTTPS certificate, the web server falls back to HTTP: Certificate "certificateId" not found'
        )
      );
    } finally {
      await localServer.stop();
    }
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

    it('still serves the Angular index.html fallback for a route that merely starts with the word "documentation"', async () => {
      // isStaticFile() must anchor on the '/documentation' path segment, not just the string
      // prefix - otherwise a route like '/documentation-settings' would be misclassified as
      // already-served-by-static-middleware and 404 instead of falling through to the Angular
      // SPA shell.
      await webServer.init();
      const res = await fetch(`http://localhost:${TEST_PORT}/documentation-settings`);
      assert.equal(res.status, 200);
      const body = await res.text();
      assert.equal(body, '<!doctype html><html><body>test placeholder</body></html>');
    });
  });

  describe('web client cache', () => {
    // Own port + own server instance for each test (see buildWebServer's comment)
    async function fetchFromOwnServer(port: number, route: string): Promise<Response> {
      const localServer = buildWebServer(port);
      try {
        await localServer.init();
        const res = await fetch(`http://localhost:${port}${route}`);
        await res.arrayBuffer();
        return res;
      } finally {
        await localServer.stop();
      }
    }

    it('lets the browser keep a hashed file of the build', async () => {
      const res = await fetchFromOwnServer(TEST_PORT + 30, '/chunk-TEST1234.js');
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    });

    it('makes the browser revalidate index.html, served directly or as the Angular fallback', async () => {
      for (const [index, route] of ['/', '/index.html', '/some-angular-route'].entries()) {
        const res = await fetchFromOwnServer(TEST_PORT + 31 + index, route);
        assert.equal(res.status, 200, route);
        assert.equal(res.headers.get('cache-control'), 'public, max-age=0', route);
      }
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
      const mockRes = { status: mock.fn((_code: number) => mockRes), json: mock.fn() };

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
      const mockRes = { status: mock.fn((_code: number) => mockRes), json: mock.fn() };

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

      const r5b = await fetch(`${base}/test-config-import-error`);
      assert.equal(r5b.status, 400);
      const configImportBody = (await r5b.json()) as { message: string; validationErrors: Array<{ scope: string }> };
      assert.equal(configImportBody.message, 'import failed');
      assert.deepEqual(configImportBody.validationErrors, [{ scope: 'south', entityId: 'id1', message: 'bad' }]);

      const r5c = await fetch(`${base}/test-non-error-throw`);
      assert.equal(r5c.status, 500);
      const nonErrorBody = (await r5c.json()) as { error: string };
      assert.equal(nonErrorBody.error, 'Internal Server Error');

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

  it('start(): logs an error when the server cannot listen', async () => {
    const localPort = TEST_PORT + 24;
    const occupyingServer = http.createServer();
    await new Promise<void>(resolve => occupyingServer.listen(localPort, resolve));
    const localServer = buildWebServer(localPort);
    try {
      await localServer.init();
      await new Promise(resolve => setTimeout(resolve, 50));

      assert.ok(
        loggerMock.error.mock.calls.some(call =>
          String(call.arguments[0]).startsWith(`Could not start server on port ${localPort}: listen`)
        )
      );
    } finally {
      await localServer.stop();
      await new Promise(resolve => occupyingServer.close(resolve));
    }
  });

  it('stop(): clears the fallback timer once the server is closed', async () => {
    const setTimeoutSpy = mock.method(globalThis, 'setTimeout');
    const clearTimeoutSpy = mock.method(globalThis, 'clearTimeout');
    await webServer.init();

    await webServer.stop();

    const fallbackTimer = setTimeoutSpy.mock.calls.find(call => call.arguments[1] === 5000)!.result;
    assert.ok(clearTimeoutSpy.mock.calls.some(call => call.arguments[0] === fallbackTimer));
  });

  it('stop(): resolves after 5 s if the server never finishes closing', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    // A fake server, as below: a real one would be orphaned. Removed at the end so that afterEach's stop() doesn't wait for it
    const fakeServerHolder = webServer as unknown as { webServer: { closeAllConnections: () => void; close: () => void } | null };
    fakeServerHolder.webServer = { closeAllConnections: mock.fn(), close: mock.fn() };
    let stopped = false;
    const stopPromise = webServer.stop().then(() => (stopped = true));

    mock.timers.tick(4999);
    await Promise.resolve();
    assert.equal(stopped, false);
    mock.timers.tick(1);
    await stopPromise;
    assert.equal(stopped, true);
    fakeServerHolder.webServer = null;
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
