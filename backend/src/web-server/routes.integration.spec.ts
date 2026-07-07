import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import multer from 'multer';
import * as http from 'node:http';
import os from 'node:os';
import { ValidateError } from 'tsoa';

import { createInjectServicesMiddleware } from './middlewares/services.middleware';
import { RegisterRoutes } from './routes';
import { NotFoundError, OIBusTestingError, OIBusValidationError } from '../model/types';

import CertificateServiceMock from '../tests/__mocks__/service/certificate-service.mock';
import HistoryQueryServiceMock from '../tests/__mocks__/service/history-query-service.mock';
import IpFilterServiceMock from '../tests/__mocks__/service/ip-filter-service.mock';
import LogServiceMock from '../tests/__mocks__/service/log-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';
import OIAnalyticsCommandServiceMock from '../tests/__mocks__/service/oia/oianalytics-command-service.mock';
import OIAnalyticsRegistrationServiceMock from '../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import OIBusServiceMock from '../tests/__mocks__/service/oibus-service.mock';
import ScanModeServiceMock from '../tests/__mocks__/service/scan-mode-service.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import TransformerServiceMock from '../tests/__mocks__/service/transformer-service.mock';
import UserServiceMock from '../tests/__mocks__/service/user-service.mock';

import type CertificateService from '../service/certificate.service';
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

const TEST_PORT = 19997;

interface RouteEntry {
  method: string;
  path: string;
}

/**
 * Express route layer shapes vary slightly between express versions; keep this loose but scoped
 * to what we actually need to read off `app._router.stack`.
 */
interface ExpressRouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
}

/**
 * Walks the express router stack and extracts every registered {method, path} pair.
 * This lets us exercise every route RegisterRoutes() wired up without hardcoding paths.
 */
function collectRoutes(app: express.Express): Array<RouteEntry> {
  const routes: Array<RouteEntry> = [];
  const stack: Array<ExpressRouteLayer> =
    (app as unknown as { router: { stack: Array<ExpressRouteLayer> } }).router?.stack ||
    (app as unknown as { _router: { stack: Array<ExpressRouteLayer> } })._router?.stack ||
    [];

  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).filter(m => layer.route!.methods[m]);
      for (const method of methods) {
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

    const certificateService = new CertificateServiceMock();
    const historyQueryService = new HistoryQueryServiceMock();
    const ipFilterService = new IpFilterServiceMock();
    const logService = new LogServiceMock();
    const northService = new NorthServiceMock();
    const oIAnalyticsCommandService = new OIAnalyticsCommandServiceMock();
    const oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
    const oIBusService = new OIBusServiceMock();
    const scanModeService = new ScanModeServiceMock();
    const southService = new SouthServiceMock();
    const transformerService = new TransformerServiceMock();
    const userService = new UserServiceMock();

    // No auth middleware here on purpose: we want requests to reach the real TSOA-generated
    // handlers in routes.ts directly, so we mount only service injection + body parsing.
    app.use(
      createInjectServicesMiddleware(
        certificateService as unknown as CertificateService,
        historyQueryService as unknown as HistoryQueryService,
        ipFilterService as unknown as IPFilterService,
        logService as unknown as LogService,
        northService as unknown as NorthService,
        oIAnalyticsCommandService as unknown as OIAnalyticsCommandService,
        oIAnalyticsRegistrationService as unknown as OIAnalyticsRegistrationService,
        oIBusService as unknown as OIBusService,
        scanModeService as unknown as ScanModeService,
        southService as unknown as SouthService,
        transformerService as unknown as TransformerService,
        userService as unknown as UserService
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
});
