import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import type { Knex } from 'knex';
import { mockModule, reloadModule } from '../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

type MigrationModule = typeof import('./data-folder-migrations/3/3.5/v3.5.0-change-archive-location');

describe('Data folder migration v3.5.0 (change archive location)', () => {
  let tmpRoot: string;
  let migration: MigrationModule;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-mig-v350-'));

    const utilsPath = '../service/utils';
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
    migration = reloadModule<MigrationModule>(nodeRequire, './data-folder-migrations/3/3.5/v3.5.0-change-archive-location');

    mock.method(console, 'info', () => undefined);
    mock.method(console, 'error', () => undefined);
  });

  after(async () => {
    mock.restoreAll();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    for (const sub of ['cache', 'error', 'archive']) {
      await fs.rm(path.join(tmpRoot, sub), { recursive: true, force: true });
      await fs.mkdir(path.join(tmpRoot, sub), { recursive: true });
    }
  });

  it('down() resolves without errors', async () => {
    await assert.doesNotReject(() => migration.down());
  });

  describe('refactorDataStream', () => {
    it('skips when cache/data-stream does not exist (folderExists=false branch)', async () => {
      // No data-stream folder — migration is a no-op.
      await assert.doesNotReject(() => migration.up({} as Knex));
    });

    it('moves north-* and south-* folders and removes data-stream', async () => {
      const dataStream = path.join(tmpRoot, 'cache', 'data-stream');

      // North folder with files and a nested subdir (covers moveContents: file + dir branches).
      const northSrc = path.join(dataStream, 'north-n1');
      await fs.mkdir(path.join(northSrc, 'values', 'sub'), { recursive: true });
      await fs.writeFile(path.join(northSrc, 'values', 'v.csv'), 'csv');
      await fs.writeFile(path.join(northSrc, 'values', 'sub', 'nested.csv'), 'n');
      await fs.mkdir(path.join(northSrc, 'values-errors'), { recursive: true });
      await fs.mkdir(path.join(northSrc, 'files-errors'), { recursive: true });
      await fs.mkdir(path.join(northSrc, 'archive'), { recursive: true });

      // South folder (no sub-structure required).
      const southSrc = path.join(dataStream, 'south-s1');
      await fs.mkdir(southSrc, { recursive: true });
      await fs.writeFile(path.join(southSrc, 'data.bin'), 'bin');

      await migration.up({} as Knex);

      // data-stream is removed.
      assert.strictEqual(fsSync.existsSync(dataStream), false);

      // North folder landed in /cache/north-n1 with values renamed to time-values.
      const northDest = path.join(tmpRoot, 'cache', 'north-n1');
      assert.strictEqual(fsSync.existsSync(northDest), true);
      // time-values were moved from values/.
      assert.strictEqual(fsSync.existsSync(path.join(northDest, 'time-values', 'v.csv')), true);

      // South folder landed in /cache/south-s1.
      assert.strictEqual(fsSync.existsSync(path.join(tmpRoot, 'cache', 'south-s1', 'data.bin')), true);
    });

    it('moveFolder is a no-op when source does not exist (folderExists=false in moveFolder)', async () => {
      // A north folder with NO values, values-errors, files-errors, or archive subdirs.
      const dataStream = path.join(tmpRoot, 'cache', 'data-stream');
      const northSrc = path.join(dataStream, 'north-n2');
      await fs.mkdir(northSrc, { recursive: true });

      await assert.doesNotReject(() => migration.up({} as Knex));

      // north-n2 is moved to cache/north-n2 (the main moveFolder call succeeds).
      assert.strictEqual(fsSync.existsSync(path.join(tmpRoot, 'cache', 'north-n2')), true);
    });
  });

  describe('refactorHistoryQuery', () => {
    it('skips when cache/history-query does not exist (folderExists=false branch)', async () => {
      await assert.doesNotReject(() => migration.up({} as Knex));
    });

    it('moves history-* folder structure and removes history-query', async () => {
      const historyQuery = path.join(tmpRoot, 'cache', 'history-query');
      const historySrc = path.join(historyQuery, 'history-h1');
      await fs.mkdir(path.join(historySrc, 'north', 'values'), { recursive: true });
      await fs.writeFile(path.join(historySrc, 'north', 'values', 'hv.csv'), 'hcsv');
      await fs.mkdir(path.join(historySrc, 'north', 'values-errors'), { recursive: true });
      await fs.mkdir(path.join(historySrc, 'north', 'files-errors'), { recursive: true });
      await fs.mkdir(path.join(historySrc, 'north', 'archive'), { recursive: true });

      await migration.up({} as Knex);

      assert.strictEqual(fsSync.existsSync(historyQuery), false);
      const historyDest = path.join(tmpRoot, 'cache', 'history-h1');
      assert.strictEqual(fsSync.existsSync(historyDest), true);
      assert.strictEqual(fsSync.existsSync(path.join(historyDest, 'north', 'time-values', 'hv.csv')), true);
    });
  });
});
