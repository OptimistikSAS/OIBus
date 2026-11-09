import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { reloadModule } from '../../tests/utils/test-utils';
import type * as OdbcLoaderType from './odbc-loader';

const nodeRequire = createRequire(import.meta.url);

interface ModuleWithLoad {
  _load: (request: string, ...args: Array<unknown>) => unknown;
}

describe('odbc-loader', () => {
  let odbcLoader: typeof OdbcLoaderType;
  // What require('odbc') does: returns the module, or throws (not installed, or native module failing to load)
  let requireOdbc: () => unknown;

  const fakeOdbc = { connect: async () => ({ query: async () => [], close: async () => undefined }) };
  const notInstalled = () => {
    throw new Error("Cannot find module 'odbc'");
  };

  beforeEach(() => {
    requireOdbc = notInstalled;
    // Intercept require('odbc') so the tests do not depend on the optional native module being installed
    const moduleLoader = Module as unknown as ModuleWithLoad;
    const originalLoad = moduleLoader._load;
    mock.method(moduleLoader, '_load', function (this: unknown, request: string, ...args: Array<unknown>) {
      return request === 'odbc' ? requireOdbc() : originalLoad.call(this, request, ...args);
    });
    // A fresh loader, with nothing cached yet
    odbcLoader = reloadModule<typeof OdbcLoaderType>(nodeRequire, './odbc-loader');
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should return null when odbc module is not installed', () => {
    assert.strictEqual(odbcLoader.importOdbc(), null);
  });

  it('should not cache a null result and import odbc again on the next load', () => {
    assert.strictEqual(odbcLoader.loadOdbc(), null);

    requireOdbc = () => fakeOdbc;

    assert.strictEqual(odbcLoader.loadOdbc(), fakeOdbc);
  });

  it('should return null when requiring odbc throws', () => {
    requireOdbc = () => {
      throw new Error('boom');
    };

    assert.strictEqual(odbcLoader.importOdbc(), null);
  });

  it('should cache the loaded odbc module and not re-import on subsequent calls', () => {
    requireOdbc = () => fakeOdbc;

    assert.strictEqual(odbcLoader.loadOdbc(), fakeOdbc);

    // If loadOdbc() re-imported, this would surface as null
    requireOdbc = () => {
      throw new Error('should not be called again');
    };

    assert.strictEqual(odbcLoader.loadOdbc(), fakeOdbc);
  });
});
