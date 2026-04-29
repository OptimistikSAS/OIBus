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
});
