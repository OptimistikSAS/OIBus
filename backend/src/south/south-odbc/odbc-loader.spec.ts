import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it } from 'node:test';

import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import type * as OdbcLoaderType from './odbc-loader';

const nodeRequire = createRequire(import.meta.url);

describe('odbc-loader', () => {
  let odbcLoader: typeof OdbcLoaderType;
  let cacheEntry: NodeJS.Module;

  const fakeOdbc = { connect: async () => ({ query: async () => [], close: async () => undefined }) };

  // Makes requiring 'odbc' throw, as when the native module fails to load
  const makeOdbcRequireThrow = (message: string) =>
    Object.defineProperty(cacheEntry, 'exports', {
      configurable: true,
      get() {
        throw new Error(message);
      }
    });

  before(() => {
    mockModule(nodeRequire, 'odbc', null);
    cacheEntry = nodeRequire.cache[nodeRequire.resolve('odbc')]!;
  });

  beforeEach(() => {
    // A fresh loader, with nothing cached yet
    odbcLoader = reloadModule<typeof OdbcLoaderType>(nodeRequire, './odbc-loader');
  });

  afterEach(() => {
    // Back to a missing odbc module, so tests / files are not impacted by each other
    Object.defineProperty(cacheEntry, 'exports', { configurable: true, writable: true, value: null });
  });

  it('should return null when odbc module is not installed', () => {
    assert.strictEqual(odbcLoader.importOdbc(), null);
  });

  it('should not cache a null result and import odbc again on the next load', () => {
    assert.strictEqual(odbcLoader.loadOdbc(), null);

    cacheEntry.exports = fakeOdbc;

    assert.strictEqual(odbcLoader.loadOdbc(), fakeOdbc);
  });

  it('should return null when requiring odbc throws', () => {
    makeOdbcRequireThrow('boom');

    assert.strictEqual(odbcLoader.importOdbc(), null);
  });

  it('should cache the loaded odbc module and not re-import on subsequent calls', () => {
    cacheEntry.exports = fakeOdbc;

    assert.strictEqual(odbcLoader.loadOdbc(), fakeOdbc);

    // If loadOdbc() re-imported, this would surface as null
    makeOdbcRequireThrow('should not be called again');

    assert.strictEqual(odbcLoader.loadOdbc(), fakeOdbc);
  });
});
