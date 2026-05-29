/**
 * Smoke test for routes.ts — calling RegisterRoutes provides coverage for the
 * TSOA-generated route registration code without testing individual controllers.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import express from 'express';
import { fixTsoaModuleResolution } from '../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

describe('routes (TSOA-generated)', () => {
  before(() => {
    fixTsoaModuleResolution(nodeRequire);
  });

  it('RegisterRoutes registers all API routes on an express app without errors (no multer opt)', () => {
    const { RegisterRoutes } = nodeRequire('./routes') as { RegisterRoutes: (app: unknown, opts?: unknown) => void };
    const app = express();
    assert.doesNotThrow(() => RegisterRoutes(app));
  });

  it('RegisterRoutes works with an explicit undefined multer (uses default)', () => {
    const { RegisterRoutes } = nodeRequire('./routes') as { RegisterRoutes: (app: unknown, opts?: unknown) => void };
    const app = express();
    // Pass options without multer so the fallback path is exercised.
    assert.doesNotThrow(() => RegisterRoutes(app, {}));
  });
});
