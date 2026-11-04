import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, describe, it, mock } from 'node:test';

import { reloadModule } from '../../tests/utils/test-utils';
import type * as PiLoaderType from './pi-loader';

const nodeRequire = createRequire(import.meta.url);

describe('pi-loader', () => {
  let piLoader: typeof PiLoaderType;

  const fakePi = { PiConnection: { connect: async () => ({}) } };

  beforeEach(() => {
    // A fresh loader, with nothing cached yet
    piLoader = reloadModule<typeof PiLoaderType>(nodeRequire, './pi-loader');
  });

  it('should return the module when it can be required', () => {
    assert.strictEqual(
      piLoader.importPi(() => fakePi),
      fakePi
    );
  });

  it('should return null when the module is not installed', () => {
    assert.strictEqual(
      piLoader.importPi(() => {
        throw new Error("Cannot find module '@oibus/pi'");
      }),
      null
    );
  });

  it('should return null when the module exports nothing', () => {
    assert.strictEqual(
      piLoader.importPi(() => null),
      null
    );
  });

  it('should not cache a null result and import the module again on the next load', () => {
    assert.strictEqual(
      piLoader.loadPi(() => null),
      null
    );
    assert.strictEqual(
      piLoader.loadPi(() => fakePi),
      fakePi
    );
  });

  it('should cache the loaded module and not import it again on subsequent calls', () => {
    const load = mock.fn(() => fakePi);

    assert.strictEqual(piLoader.loadPi(load), fakePi);
    assert.strictEqual(piLoader.loadPi(load), fakePi);
    assert.strictEqual(load.mock.calls.length, 1);
  });

  it('should require @oibus/pi by default', () => {
    let expected: unknown = null;
    try {
      expected = nodeRequire('@oibus/pi');
    } catch {
      // Not installed on this platform (Windows-only optional dependency)
    }
    assert.strictEqual(piLoader.importPi(), expected);
  });
});
