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

type MigrationModule = typeof import('./data-folder-migrations/3/3.6/v3.6.0-change-cache-content');

describe('Data folder migration v3.6.0 (change cache content)', () => {
  let tmpRoot: string;
  let migration: MigrationModule;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-mig-v360-'));

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
    migration = reloadModule<MigrationModule>(nodeRequire, './data-folder-migrations/3/3.6/v3.6.0-change-cache-content');

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

  it('is a no-op when no north- or history- folders exist', async () => {
    await assert.doesNotReject(() => migration.up({} as Knex));
  });

  describe('refactorNorthFolder with files/ content', () => {
    it('migrates files in cache/north-*/files into content/ with metadata', async () => {
      const northCache = path.join(tmpRoot, 'cache', 'north-n1');
      const filesDir = path.join(northCache, 'files');
      await fs.mkdir(filesDir, { recursive: true });
      await fs.writeFile(path.join(filesDir, 'payload.bin'), 'binary-data');

      await migration.up({} as Knex);

      const contentDir = path.join(northCache, 'content');
      const metadataDir = path.join(northCache, 'metadata');

      // files/ folder is removed.
      assert.strictEqual(fsSync.existsSync(filesDir), false);
      // content/ and metadata/ were created and have one entry each.
      const contentFiles = await fs.readdir(contentDir);
      const metadataFiles = await fs.readdir(metadataDir);
      assert.strictEqual(contentFiles.length, 1);
      assert.strictEqual(metadataFiles.length, 1);
    });

    it('handles rename failure in files/ loop (inner try/catch)', async () => {
      // Pre-create the rename destination (content/payload.bin) as a DIRECTORY.
      // When the migration tries to rename files/payload.bin → content/payload.bin,
      // it fails with EISDIR on Linux because the destination is a directory.
      const northCache = path.join(tmpRoot, 'cache', 'north-n2');
      const filesDir = path.join(northCache, 'files');
      const contentDir = path.join(northCache, 'content');
      await fs.mkdir(filesDir, { recursive: true });
      await fs.writeFile(path.join(filesDir, 'payload.bin'), 'data');
      await fs.mkdir(path.join(contentDir, 'payload.bin'), { recursive: true });

      await assert.doesNotReject(() => migration.up({} as Knex));
    });
  });

  describe('refactorNorthFolder with time-values/ content', () => {
    it('migrates time-values JSON files into content/ with metadata', async () => {
      const northCache = path.join(tmpRoot, 'cache', 'north-n3');
      const timeValuesDir = path.join(northCache, 'time-values');
      await fs.mkdir(timeValuesDir, { recursive: true });
      const payload = JSON.stringify([{ pointId: 'p1', timestamp: '2026-01-01T00:00:00Z', data: { value: 42 } }]);
      await fs.writeFile(path.join(timeValuesDir, 'tv.json'), payload);

      await migration.up({} as Knex);

      const contentDir = path.join(northCache, 'content');
      const metadataFiles = await fs.readdir(path.join(northCache, 'metadata'));
      const contentFiles = await fs.readdir(contentDir);
      assert.strictEqual(contentFiles.length, 1);
      assert.strictEqual(metadataFiles.length, 1);
      // Original time-values dir is removed.
      assert.strictEqual(fsSync.existsSync(timeValuesDir), false);
    });

    it('handles error reading a time-values file (inner try/catch)', async () => {
      const northCache = path.join(tmpRoot, 'cache', 'north-n4');
      const timeValuesDir = path.join(northCache, 'time-values');
      await fs.mkdir(timeValuesDir, { recursive: true });
      // A directory inside time-values/ — iterating it will cause readFile/JSON.parse to fail.
      await fs.mkdir(path.join(timeValuesDir, 'not-a-json-file'), { recursive: true });

      await assert.doesNotReject(() => migration.up({} as Knex));
    });
  });

  describe('refactorCacheStructure with history- folders', () => {
    it('processes history-*/north/ sub-structure in cache/', async () => {
      const historyNorth = path.join(tmpRoot, 'cache', 'history-h1', 'north');
      const filesDir = path.join(historyNorth, 'files');
      await fs.mkdir(filesDir, { recursive: true });
      await fs.writeFile(path.join(filesDir, 'h-payload.bin'), 'data');

      await migration.up({} as Knex);

      const contentDir = path.join(historyNorth, 'content');
      const contentFiles = await fs.readdir(contentDir);
      assert.strictEqual(contentFiles.length, 1);
    });
  });

  describe('folderExists branches', () => {
    it('skips files/ processing when files/ does not exist (folderExists=false)', async () => {
      // North folder with NO files/ dir — only time-values/ is present.
      const northCache = path.join(tmpRoot, 'cache', 'north-n5');
      const timeValuesDir = path.join(northCache, 'time-values');
      await fs.mkdir(timeValuesDir, { recursive: true });
      await fs.writeFile(path.join(timeValuesDir, 'tv.json'), JSON.stringify([]));

      await assert.doesNotReject(() => migration.up({} as Knex));
    });

    it('skips time-values/ processing when time-values/ does not exist (folderExists=false)', async () => {
      // North folder with NO time-values/ dir — only files/ present.
      const northCache = path.join(tmpRoot, 'cache', 'north-n6');
      const filesDir = path.join(northCache, 'files');
      await fs.mkdir(filesDir, { recursive: true });
      await fs.writeFile(path.join(filesDir, 'f.bin'), 'b');

      await assert.doesNotReject(() => migration.up({} as Knex));
    });
  });
});
