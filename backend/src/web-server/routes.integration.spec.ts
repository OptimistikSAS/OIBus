import assert from 'node:assert/strict';
import type * as http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import { after, before, describe, it, mock } from 'node:test';

import { ValidateError } from '@tsoa/runtime';
import express from 'express';
import multer from 'multer';

import { NotFoundError, OIBusTestingError, OIBusValidationError } from '../model/types';
import { createMockServices, fixTsoaModuleResolution, mockModule } from '../tests/utils/test-utils';
import { createInjectServicesMiddleware } from './middlewares/services.middleware';
import type * as Routes from './routes';

const nodeRequire = createRequire(import.meta.url);

fixTsoaModuleResolution(nodeRequire);
// The services are all mocks here, so no connector is ever built: don't load the connector factories, which load every
// connector SDK (seconds of import).
mockModule(nodeRequire, '../south/south-connector-factory', {
  buildSouth: mock.fn(),
  initSouthCache: mock.fn(),
  deleteSouthCache: mock.fn()
});
mockModule(nodeRequire, '../north/north-connector-factory', {
  buildNorth: mock.fn(),
  initNorthCache: mock.fn(),
  deleteNorthCache: mock.fn(),
  createNorthOrchestrator: mock.fn()
});
const { RegisterRoutes } = nodeRequire('./routes') as typeof Routes;

const TEST_PORT = 19997;

interface RouteEntry {
  method: string;
  path: string;
}

/**
 * Walks the express router stack and extracts every registered {method, path} pair.
 * This lets us exercise every route RegisterRoutes() wired up without hardcoding paths.
 */
function collectRoutes(app: express.Express): Array<RouteEntry> {
  const routes: Array<RouteEntry> = [];
  for (const layer of app.router.stack) {
    // express's Route has a `methods` map ({ get: true }) that its type definition does not declare
    if (layer.route && 'methods' in layer.route) {
      const methods = layer.route.methods as Record<string, boolean>;
      for (const method of Object.keys(methods).filter(m => methods[m])) {
        routes.push({ method: method.toUpperCase(), path: layer.route.path });
      }
    }
  }
  return routes;
}

/**
 * Replaces every `:paramName` path segment with a dummy value so the URL is a valid concrete path.
 */
function resolvePath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, 'test-id');
}

describe('routes.ts integration (real RegisterRoutes over HTTP)', () => {
  let app: express.Express;
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    app = express();

    // No auth middleware here on purpose: we want requests to reach the real TSOA-generated
    // handlers in routes.ts directly, so we mount only service injection + body parsing.
    const services = createMockServices();
    app.use(
      createInjectServicesMiddleware(
        services.auditService,
        services.certificateService,
        services.configImportService,
        services.configTransferService,
        services.configurationWorkflowRunService,
        services.configurationWorkflowService,
        services.historyQueryService,
        services.ipFilterService,
        services.logService,
        services.northService,
        services.oIAnalyticsCommandService,
        services.oIAnalyticsRegistrationService,
        services.oIBusService,
        services.scanModeService,
        services.southService,
        services.transformerService,
        services.userService
      )
    );

    app.use(express.json({ limit: '20mb' }));
    app.use(express.urlencoded({ extended: true, limit: '20mb' }));

    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, os.tmpdir()),
      filename: (_req, file, cb) => cb(null, file.originalname)
    });

    RegisterRoutes(app, { multer: multer({ storage, limits: { fieldNameSize: 255 } }) });

    // Minimal error handler mirroring web-server.ts, so controller-thrown domain errors turn into
    // deterministic HTTP responses instead of hanging/crashing the request.
    app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err instanceof NotFoundError) {
        return res.status(404).json({ error: err.message });
      }
      if (err instanceof OIBusValidationError || err instanceof OIBusTestingError) {
        return res.status(400).json({ message: err.message });
      }
      if (err instanceof ValidateError) {
        return res.status(400).json({ message: err.fields });
      }
      if (err) {
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        return res.status(500).json({ error: message });
      }
      return next();
    });

    await new Promise<void>(resolve => {
      server = app.listen(TEST_PORT, () => resolve());
    });
    baseUrl = `http://localhost:${TEST_PORT}`;
  });

  after(async () => {
    await new Promise<void>(resolve => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    });
  });

  it('registers a substantial number of routes', () => {
    const routes = collectRoutes(app);
    assert.ok(routes.length >= 100, `expected at least 100 registered routes, got ${routes.length}`);
  });

  it('exercises every registered route with a real HTTP request', async () => {
    const routes = collectRoutes(app);
    assert.ok(routes.length > 0, 'no routes were collected from the router stack');

    const results: Array<{ method: string; path: string; status: number | null; error?: string }> = [];

    for (const { method, path } of routes) {
      const resolved = resolvePath(path);
      const url = `${baseUrl}${resolved}`;
      const init: RequestInit = { method };

      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify({});
      }

      try {
        const res = await fetch(url, init);
        // Drain the body so the connection can be reused/closed cleanly.
        await res.text();
        results.push({ method, path, status: res.status });
      } catch (error) {
        results.push({ method, path, status: null, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const failed = results.filter(r => r.status === null);
    assert.deepEqual(failed, [], `some routes could not be reached at all: ${JSON.stringify(failed)}`);

    // Every route should have produced *some* HTTP response (2xx/4xx/5xx) — that's enough to prove
    // the TSOA handler wrapper (validation + controller dispatch) executed.
    for (const result of results) {
      assert.ok(
        typeof result.status === 'number' && result.status >= 200 && result.status < 600,
        `unexpected status for ${result.method} ${result.path}: ${result.status}`
      );
    }
  });

  it('handles /api/content/file without a multipart file (validation error path)', async () => {
    const res = await fetch(`${baseUrl}/api/content/file?northId=n1&dataSourceId=d1`, { method: 'POST' });
    // No file attached -> the multer/tsoa/controller path runs and returns some status.
    // We only assert the handler executed and produced an HTTP response (any status).
    assert.ok(res.status >= 200 && res.status < 600);
  });

  it('handles /api/content/content with a JSON body', async () => {
    const res = await fetch(`${baseUrl}/api/content/content?northId=n1&dataSourceId=d1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ some: 'value' })
    });
    assert.ok(res.status >= 200 && res.status < 500);
  });

  // The following routes have a required @Body() or a query/path param backed by an enum ref.
  // TSOA's generated handler wraps `getValidatedArgs` + `apiHandler` in a try/catch that forwards
  // to `next(err)` on failure (the routes.ts "outer catch"). Since `apiHandler` itself swallows any
  // controller-level error and calls `next` directly (never rethrowing), the only way to reach that
  // outer catch is a synchronous validation failure inside `getValidatedArgs` — i.e. a required
  // parameter that is missing/invalid before the controller is even invoked. Sending a POST/PUT
  // request with no body at all (no Content-Type) leaves `req.body` as `undefined`, which trips the
  // "'<name>' is required" check; an unmatched value against an enum ref does the same for query/path.
  describe('routes.ts outer catch: validation failures reach next(err)', () => {
    it('UserController_create: missing body', async () => {
      const res = await fetch(`${baseUrl}/api/users`, { method: 'POST' });
      assert.equal(res.status, 400);
    });

    it('UserController_update: missing body', async () => {
      const res = await fetch(`${baseUrl}/api/users/test-id`, { method: 'PUT' });
      assert.equal(res.status, 400);
    });

    it('UserController_updatePassword: missing body', async () => {
      const res = await fetch(`${baseUrl}/api/users/test-id/password`, { method: 'POST' });
      assert.equal(res.status, 400);
    });

    it('TransformerController_search: invalid enum value for "type"', async () => {
      const res = await fetch(`${baseUrl}/api/transformers/search?type=not-a-real-type`);
      assert.equal(res.status, 400);
    });

    it('TransformerController_create: missing body', async () => {
      const res = await fetch(`${baseUrl}/api/transformers`, { method: 'POST' });
      assert.equal(res.status, 400);
    });

    it('TransformerController_update: missing body', async () => {
      const res = await fetch(`${baseUrl}/api/transformers/test-id`, { method: 'PUT' });
      assert.equal(res.status, 400);
    });

    it('TransformerController_test: missing body', async () => {
      const res = await fetch(`${baseUrl}/api/transformers/test`, { method: 'POST' });
      assert.equal(res.status, 400);
    });

    it('TransformerController_testTransformer: missing body', async () => {
      const res = await fetch(`${baseUrl}/api/transformers/test-id/test`, { method: 'POST' });
      assert.equal(res.status, 400);
    });

    it('SouthConnectorController_getManifest: invalid enum value for "type"', async () => {
      const res = await fetch(`${baseUrl}/api/south/manifests/not-a-real-south-type`);
      assert.equal(res.status, 400);
    });

    it('SouthConnectorController_create: missing body', async () => {
      const res = await fetch(`${baseUrl}/api/south`, { method: 'POST' });
      assert.equal(res.status, 400);
    });

    it('SouthConnectorController_update: missing body', async () => {
      const res = await fetch(`${baseUrl}/api/south/test-id`, { method: 'PUT' });
      assert.equal(res.status, 400);
    });

    it('SouthConnectorController_testConnection: missing body', async () => {
      const res = await fetch(`${baseUrl}/api/south/test-id/test/connection`, { method: 'POST' });
      assert.equal(res.status, 400);
    });

    it('SouthConnectorController_testItem: missing body', async () => {
      const res = await fetch(`${baseUrl}/api/south/test-id/items/test`, { method: 'POST' });
      assert.equal(res.status, 400);
    });

    it('SouthConnectorController_startExplore: missing body', async () => {
      const res = await fetch(`${baseUrl}/api/south/test-id/explore`, { method: 'POST' });
      assert.equal(res.status, 400);
    });
  });
});
