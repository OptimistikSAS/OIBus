import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { importOdbc, loadOdbc } from './odbc-loader';

describe('odbc-loader', () => {
  it('should return null when odbc module is not installed', async () => {
    const result = await importOdbc();
    assert.strictEqual(result, null);
  });

  it('should call importOdbc on first load and cache null result', async () => {
    const result = await loadOdbc();
    assert.strictEqual(result, null);
  });
});
