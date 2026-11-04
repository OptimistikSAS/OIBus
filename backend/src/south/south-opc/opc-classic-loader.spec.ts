import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, describe, it, mock } from 'node:test';

import { reloadModule } from '../../tests/utils/test-utils';
import type * as OpcClassicLoaderType from './opc-classic-loader';

const nodeRequire = createRequire(import.meta.url);

describe('opc-classic-loader', () => {
  let opcClassicLoader: typeof OpcClassicLoaderType;

  const fakeOpcClassic = { OpcConnection: { connect: async () => ({}) } };

  beforeEach(() => {
    // A fresh loader, with nothing cached yet
    opcClassicLoader = reloadModule<typeof OpcClassicLoaderType>(nodeRequire, './opc-classic-loader');
  });

  it('should return the module when it can be required', () => {
    assert.strictEqual(
      opcClassicLoader.importOpcClassic(() => fakeOpcClassic),
      fakeOpcClassic
    );
  });

  it('should return null when the module is not installed', () => {
    assert.strictEqual(
      opcClassicLoader.importOpcClassic(() => {
        throw new Error("Cannot find module '@oibus/opc-classic'");
      }),
      null
    );
  });

  it('should return null when the module exports nothing', () => {
    assert.strictEqual(
      opcClassicLoader.importOpcClassic(() => null),
      null
    );
  });

  it('should not cache a null result and import the module again on the next load', () => {
    assert.strictEqual(
      opcClassicLoader.loadOpcClassic(() => null),
      null
    );
    assert.strictEqual(
      opcClassicLoader.loadOpcClassic(() => fakeOpcClassic),
      fakeOpcClassic
    );
  });

  it('should cache the loaded module and not import it again on subsequent calls', () => {
    const load = mock.fn(() => fakeOpcClassic);

    assert.strictEqual(opcClassicLoader.loadOpcClassic(load), fakeOpcClassic);
    assert.strictEqual(opcClassicLoader.loadOpcClassic(load), fakeOpcClassic);
    assert.strictEqual(load.mock.calls.length, 1);
  });

  it('should require @oibus/opc-classic by default', () => {
    let expected: unknown = null;
    try {
      expected = nodeRequire('@oibus/opc-classic');
    } catch {
      // Not installed on this platform (Windows-only optional dependency)
    }
    assert.strictEqual(opcClassicLoader.importOpcClassic(), expected);
  });
});
