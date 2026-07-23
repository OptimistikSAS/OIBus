import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import type { Knex } from 'knex';
import { mockModule, reloadModule } from '../../../../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

type MigrationModule = typeof import('./v3.5.0-change-archive-location');

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

describe('Data folder migration v3.5.0 (change archive location)', () => {
  let tmpRoot: string;
  let migration: MigrationModule;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-mig-v350-'));

    // Override getCommandLineArguments so the migration's path constants resolve under tmpRoot.
    // Spread the real utils so other exports (createFolder, etc.) remain intact.
    const utilsPath = '../../../../service/utils';
    const utilsActual = nodeRequire(utilsPath) as Record<string, unknown>;
    mockModule(nodeRequire, utilsPath, {
      ...utilsActual,
      getCommandLineArguments: () => ({
        configFile: tmpRoot,
        version: false,
        ignoreIpFilters: false,
        ignoreRemoteUpdate: false,
        ignoreRemoteConfig: false,
        launcherVersion: 'test'
      })
    });
    migration = reloadModule<MigrationModule>(nodeRequire, './v3.5.0-change-archive-location');

    // The migration is chatty — silence it for the test run.
    mock.method(console, 'info', () => undefined);
    mock.method(console, 'error', () => undefined);
  });

  after(async () => {
    mock.restoreAll();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Reset the three base subfolders before each test.
    for (const sub of ['cache', 'error', 'archive']) {
      const subPath = path.join(tmpRoot, sub);
      await fs.rm(subPath, { recursive: true, force: true });
      await fs.mkdir(subPath, { recursive: true });
    }
  });

  it('creates archive and error folders and skips when data-stream and history-query are absent', async () => {
    await migration.up({} as Knex);

    assert.strictEqual(await pathExists(path.join(tmpRoot, 'archive')), true);
    assert.strictEqual(await pathExists(path.join(tmpRoot, 'error')), true);
    // Nothing to migrate: cache stays as it was reset by beforeEach (just the empty folder itself).
    assert.deepStrictEqual(await fs.readdir(path.join(tmpRoot, 'cache')), []);
  });

  it('refactors the data-stream folder for north and south connectors, including nested subdirectories', async () => {
    const dataStreamPath = path.join(tmpRoot, 'cache', 'data-stream');

    const northPath = path.join(dataStreamPath, 'north-1');
    await fs.mkdir(path.join(northPath, 'values', 'nested'), { recursive: true });
    await fs.writeFile(path.join(northPath, 'values', 'nested', 'deep.dat'), 'deep-value');
    await fs.writeFile(path.join(northPath, 'values', 'top.dat'), 'top-value');

    await fs.mkdir(path.join(northPath, 'values-errors'), { recursive: true });
    await fs.writeFile(path.join(northPath, 'values-errors', 'err.dat'), 'err-value');

    await fs.mkdir(path.join(northPath, 'files-errors'), { recursive: true });
    await fs.writeFile(path.join(northPath, 'files-errors', 'file-err.dat'), 'file-err');

    await fs.mkdir(path.join(northPath, 'archive'), { recursive: true });
    await fs.writeFile(path.join(northPath, 'archive', 'archived.dat'), 'archived');

    const southPath = path.join(dataStreamPath, 'south-1');
    await fs.mkdir(southPath, { recursive: true });
    await fs.writeFile(path.join(southPath, 'south.dat'), 'south-value');

    await migration.up({} as Knex);

    // North: values -> cache/north-1/time-values (with nested subdirectory preserved)
    assert.strictEqual(await fs.readFile(path.join(tmpRoot, 'cache', 'north-1', 'time-values', 'top.dat'), 'utf8'), 'top-value');
    assert.strictEqual(
      await fs.readFile(path.join(tmpRoot, 'cache', 'north-1', 'time-values', 'nested', 'deep.dat'), 'utf8'),
      'deep-value'
    );

    // North: values-errors -> error/north-1/time-values
    assert.strictEqual(await fs.readFile(path.join(tmpRoot, 'error', 'north-1', 'time-values', 'err.dat'), 'utf8'), 'err-value');

    // North: files-errors -> error/north-1/files
    assert.strictEqual(await fs.readFile(path.join(tmpRoot, 'error', 'north-1', 'files', 'file-err.dat'), 'utf8'), 'file-err');

    // North: archive -> archive/north-1/files
    assert.strictEqual(await fs.readFile(path.join(tmpRoot, 'archive', 'north-1', 'files', 'archived.dat'), 'utf8'), 'archived');

    // South: data-stream/south-1 -> cache/south-1
    assert.strictEqual(await fs.readFile(path.join(tmpRoot, 'cache', 'south-1', 'south.dat'), 'utf8'), 'south-value');

    // data-stream folder removed
    assert.strictEqual(await pathExists(dataStreamPath), false);
  });

  it('refactors the history-query folder, moving north subfolder content into new locations', async () => {
    const historyQueryPath = path.join(tmpRoot, 'cache', 'history-query');
    const historyNorthPath = path.join(historyQueryPath, 'history-1', 'north');

    await fs.mkdir(path.join(historyNorthPath, 'values'), { recursive: true });
    await fs.writeFile(path.join(historyNorthPath, 'values', 'top.dat'), 'top-value');

    await fs.mkdir(path.join(historyNorthPath, 'values-errors'), { recursive: true });
    await fs.writeFile(path.join(historyNorthPath, 'values-errors', 'err.dat'), 'err-value');

    await fs.mkdir(path.join(historyNorthPath, 'files-errors'), { recursive: true });
    await fs.writeFile(path.join(historyNorthPath, 'files-errors', 'file-err.dat'), 'file-err');

    await fs.mkdir(path.join(historyNorthPath, 'archive'), { recursive: true });
    await fs.writeFile(path.join(historyNorthPath, 'archive', 'archived.dat'), 'archived');

    await migration.up({} as Knex);

    assert.strictEqual(await fs.readFile(path.join(tmpRoot, 'cache', 'history-1', 'north', 'time-values', 'top.dat'), 'utf8'), 'top-value');
    assert.strictEqual(await fs.readFile(path.join(tmpRoot, 'error', 'history-1', 'north', 'time-values', 'err.dat'), 'utf8'), 'err-value');
    assert.strictEqual(await fs.readFile(path.join(tmpRoot, 'error', 'history-1', 'north', 'files', 'file-err.dat'), 'utf8'), 'file-err');
    assert.strictEqual(await fs.readFile(path.join(tmpRoot, 'archive', 'history-1', 'north', 'files', 'archived.dat'), 'utf8'), 'archived');

    assert.strictEqual(await pathExists(historyQueryPath), false);
  });

  it('down is a no-op', async () => {
    assert.strictEqual(await migration.down(), undefined);
  });
});
