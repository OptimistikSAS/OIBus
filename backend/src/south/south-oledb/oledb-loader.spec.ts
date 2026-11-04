import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, describe, it, mock } from 'node:test';

import { reloadModule } from '../../tests/utils/test-utils';
import type * as OleDbLoaderType from './oledb-loader';

const nodeRequire = createRequire(import.meta.url);

describe('oledb-loader', () => {
  let oledbLoader: typeof OleDbLoaderType;

  const fakeOleDb = { OleDbConnection: { connect: async () => ({}) } };

  beforeEach(() => {
    // A fresh loader, with nothing cached yet
    oledbLoader = reloadModule<typeof OleDbLoaderType>(nodeRequire, './oledb-loader');
  });

  it('should return the module when it can be required', () => {
    assert.strictEqual(
      oledbLoader.importOleDb(() => fakeOleDb),
      fakeOleDb
    );
  });

  it('should return null when the module is not installed', () => {
    assert.strictEqual(
      oledbLoader.importOleDb(() => {
        throw new Error("Cannot find module '@oibus/oledb'");
      }),
      null
    );
  });

  it('should return null when the module exports nothing', () => {
    assert.strictEqual(
      oledbLoader.importOleDb(() => null),
      null
    );
  });

  it('should not cache a null result and import the module again on the next load', () => {
    assert.strictEqual(
      oledbLoader.loadOleDb(() => null),
      null
    );
    assert.strictEqual(
      oledbLoader.loadOleDb(() => fakeOleDb),
      fakeOleDb
    );
  });

  it('should cache the loaded module and not import it again on subsequent calls', () => {
    const load = mock.fn(() => fakeOleDb);

    assert.strictEqual(oledbLoader.loadOleDb(load), fakeOleDb);
    assert.strictEqual(oledbLoader.loadOleDb(load), fakeOleDb);
    assert.strictEqual(load.mock.calls.length, 1);
  });

  it('should require @oibus/oledb by default', () => {
    let expected: unknown = null;
    try {
      expected = nodeRequire('@oibus/oledb');
    } catch {
      // Not installed on this platform (Windows-only optional dependency)
    }
    assert.strictEqual(oledbLoader.importOleDb(), expected);
  });
});
