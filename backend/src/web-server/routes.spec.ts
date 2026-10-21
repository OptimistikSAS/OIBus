/**
 * Smoke test for routes.ts — calling RegisterRoutes provides coverage for the
 * TSOA-generated route registration code without testing individual controllers.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { before, describe, it, mock } from 'node:test';

import express from 'express';

import { fixTsoaModuleResolution, mockModule } from '../tests/utils/test-utils';
import type * as Routes from './routes';

const nodeRequire = createRequire(import.meta.url);

describe('routes (TSOA-generated)', () => {
  let RegisterRoutes: typeof Routes.RegisterRoutes;

  before(() => {
    fixTsoaModuleResolution(nodeRequire);
    // The controllers load the services, which load the connector factories and, through them, every connector SDK
    // (seconds of import): nothing builds a connector while registering the routes.
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
    RegisterRoutes = (nodeRequire('./routes') as typeof Routes).RegisterRoutes;
  });

  it('RegisterRoutes registers all API routes on an express app without errors (no multer opt)', () => {
    const app = express();
    assert.doesNotThrow(() => RegisterRoutes(app));
  });

  it('RegisterRoutes works with an explicit undefined multer (uses default)', () => {
    const app = express();
    // Pass options without multer so the fallback path is exercised.
    assert.doesNotThrow(() => RegisterRoutes(app, {}));
  });
});
