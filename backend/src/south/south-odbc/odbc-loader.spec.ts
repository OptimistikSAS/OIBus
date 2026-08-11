import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import type * as OdbcLoaderType from './odbc-loader';

const nodeRequire = createRequire(import.meta.url);

describe('odbc-loader', () => {
  let odbcLoader: typeof OdbcLoaderType;

  before(() => {
    mockModule(nodeRequire, 'odbc', null);
    odbcLoader = reloadModule<typeof OdbcLoaderType>(nodeRequire, './odbc-loader');
  });

  it('should return null when odbc module is not installed', async () => {
    const result = await odbcLoader.importOdbc();
    assert.strictEqual(result, null);
  });

  it('should call importOdbc on first load and cache null result', async () => {
    const result = await odbcLoader.loadOdbc();
    assert.strictEqual(result, null);
  });

  it('should return null when requiring odbc throws', () => {
    const resolved = nodeRequire.resolve('odbc');
    const cacheEntry = nodeRequire.cache[resolved]!;
    Object.defineProperty(cacheEntry, 'exports', {
      configurable: true,
      get() {
        throw new Error('boom');
      }
    });

    const result = odbcLoader.importOdbc();
    assert.strictEqual(result, null);

    // restore so subsequent tests / files aren't impacted
    Object.defineProperty(cacheEntry, 'exports', { configurable: true, writable: true, value: null });
  });

  it('should cache the loaded odbc module and not re-import on subsequent calls', () => {
    const freshOdbcLoader = reloadModule<typeof OdbcLoaderType>(nodeRequire, './odbc-loader');
    const resolved = nodeRequire.resolve('odbc');
    const cacheEntry = nodeRequire.cache[resolved]!;
    const fakeOdbc = { connect: async () => ({ query: async () => [], close: async () => undefined }) };
    cacheEntry.exports = fakeOdbc;

    const first = freshOdbcLoader.loadOdbc();
    assert.strictEqual(first, fakeOdbc);

    // Make a subsequent import throw - if loadOdbc() re-imported, this would surface as null or throw.
    Object.defineProperty(cacheEntry, 'exports', {
      configurable: true,
      get() {
        throw new Error('should not be called again');
      }
    });

    const second = freshOdbcLoader.loadOdbc();
    assert.strictEqual(second, fakeOdbc);

    // restore
    Object.defineProperty(cacheEntry, 'exports', { configurable: true, writable: true, value: null });
  });
});
