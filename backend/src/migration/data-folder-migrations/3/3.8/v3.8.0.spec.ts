import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import type { Knex } from 'knex';
import { mockModule, reloadModule } from '../../../../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

type MigrationModule = typeof import('./v3.8.0');

describe('Data folder migration v3.8.0', () => {
  let tmpRoot: string;
  let migration: MigrationModule;

  const NORTH_ID = 'north-test';
  const SOUTH_ID = 'south-test';

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-mig-v380-'));

    // Override getCommandLineArguments so the migration's path constants resolve under tmpRoot.
    // Spread the real utils so other exports (filesExists, etc.) remain intact.
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
    migration = reloadModule<MigrationModule>(nodeRequire, './v3.8.0');

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
    // Drop any opcua-* leftovers that might confuse the cleanup step.
    for (const entry of await fs.readdir(tmpRoot)) {
      if (entry.startsWith('opcua-')) {
        await fs.rm(path.join(tmpRoot, entry), { recursive: true, force: true });
      }
    }
  });

  async function setupNorth(): Promise<{ contentDir: string; metadataDir: string }> {
    const northCacheRoot = path.join(tmpRoot, 'cache', NORTH_ID);
    const contentDir = path.join(northCacheRoot, 'content');
    const metadataDir = path.join(northCacheRoot, 'metadata');
    await fs.mkdir(contentDir, { recursive: true });
    await fs.mkdir(metadataDir, { recursive: true });
    return { contentDir, metadataDir };
  }

  function metadataBody(contentFile: string): string {
    return JSON.stringify({
      contentFile,
      contentSize: 0,
      numberOfElement: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      contentType: 'any'
    });
  }

  describe('refactorNorthContent', () => {
    it('renames fresh metadata + content into the new format', async () => {
      const { contentDir, metadataDir } = await setupNorth();
      await fs.writeFile(path.join(metadataDir, 'abc123.json'), metadataBody('original-X.csv'));
      await fs.writeFile(path.join(contentDir, 'original-X.csv'), 'csv data');

      await migration.up({} as Knex);

      assert.deepStrictEqual(await fs.readdir(metadataDir), ['abc123']);
      assert.deepStrictEqual(await fs.readdir(contentDir), ['abc123']);
      assert.strictEqual(await fs.readFile(path.join(contentDir, 'abc123'), 'utf8'), 'csv data');
    });

    it('is idempotent: re-running preserves already-migrated entries', async () => {
      const { contentDir, metadataDir } = await setupNorth();
      await fs.writeFile(path.join(metadataDir, 'abc123.json'), metadataBody('original-X.csv'));
      await fs.writeFile(path.join(contentDir, 'original-X.csv'), 'csv data');

      // First run: migrates the entry.
      await migration.up({} as Knex);
      assert.deepStrictEqual(await fs.readdir(metadataDir), ['abc123']);
      assert.deepStrictEqual(await fs.readdir(contentDir), ['abc123']);

      // Second run: must NOT destroy the migrated data via the orphan-cleanup pass.
      await migration.up({} as Knex);
      assert.deepStrictEqual(await fs.readdir(metadataDir), ['abc123']);
      assert.deepStrictEqual(await fs.readdir(contentDir), ['abc123']);
      assert.strictEqual(await fs.readFile(path.join(contentDir, 'abc123'), 'utf8'), 'csv data');
    });

    it('survives partial completion: bare metadata + matching content from a prior run is preserved', async () => {
      // Simulates a crash AFTER both renames succeeded for "done", before processing "fresh".
      const { contentDir, metadataDir } = await setupNorth();
      // Already-migrated entry: bare metadata file, matching bare content file.
      await fs.writeFile(path.join(metadataDir, 'done'), metadataBody('original-done.csv'));
      await fs.writeFile(path.join(contentDir, 'done'), 'done-data');
      // Fresh entry queued by a later south scan.
      await fs.writeFile(path.join(metadataDir, 'fresh.json'), metadataBody('original-fresh.csv'));
      await fs.writeFile(path.join(contentDir, 'original-fresh.csv'), 'fresh-data');

      await migration.up({} as Knex);

      assert.deepStrictEqual((await fs.readdir(metadataDir)).sort(), ['done', 'fresh']);
      assert.deepStrictEqual((await fs.readdir(contentDir)).sort(), ['done', 'fresh']);
      assert.strictEqual(await fs.readFile(path.join(contentDir, 'done'), 'utf8'), 'done-data');
      assert.strictEqual(await fs.readFile(path.join(contentDir, 'fresh'), 'utf8'), 'fresh-data');
    });

    it('drops empty (0-byte) metadata files and their orphan content', async () => {
      const { contentDir, metadataDir } = await setupNorth();
      // Client's scenario: metadata files truncated to 0 bytes by a prior OOM.
      await fs.writeFile(path.join(metadataDir, 'broken1.json'), '');
      await fs.writeFile(path.join(metadataDir, 'broken2.json'), '');
      // Orphan content files with no matching metadata.
      await fs.writeFile(path.join(contentDir, 'orphan-1'), 'data');
      await fs.writeFile(path.join(contentDir, 'orphan-2'), 'data');

      await migration.up({} as Knex);

      assert.deepStrictEqual(await fs.readdir(metadataDir), []);
      assert.deepStrictEqual(await fs.readdir(contentDir), []);
    });

    it('handles a mixed batch (fresh + already-migrated + corrupt) idempotently', async () => {
      const { contentDir, metadataDir } = await setupNorth();
      await fs.writeFile(path.join(metadataDir, 'fresh.json'), metadataBody('content-fresh'));
      await fs.writeFile(path.join(contentDir, 'content-fresh'), 'fresh-data');
      await fs.writeFile(path.join(metadataDir, 'done'), metadataBody('was-content-done'));
      await fs.writeFile(path.join(contentDir, 'done'), 'done-data');
      await fs.writeFile(path.join(metadataDir, 'broken.json'), '');

      await migration.up({} as Knex);
      // Re-run to lock in idempotency.
      await migration.up({} as Knex);

      assert.deepStrictEqual((await fs.readdir(metadataDir)).sort(), ['done', 'fresh']);
      assert.deepStrictEqual((await fs.readdir(contentDir)).sort(), ['done', 'fresh']);
      assert.strictEqual(await fs.readFile(path.join(contentDir, 'fresh'), 'utf8'), 'fresh-data');
      assert.strictEqual(await fs.readFile(path.join(contentDir, 'done'), 'utf8'), 'done-data');
    });
  });

  describe('removeLegacySouthFolders', () => {
    it('removes south-* folders from cache, error and archive', async () => {
      const cacheSouth = path.join(tmpRoot, 'cache', SOUTH_ID, 'tmp');
      const errorSouth = path.join(tmpRoot, 'error', SOUTH_ID);
      const archiveSouth = path.join(tmpRoot, 'archive', SOUTH_ID);
      await fs.mkdir(cacheSouth, { recursive: true });
      await fs.mkdir(errorSouth, { recursive: true });
      await fs.mkdir(archiveSouth, { recursive: true });
      await fs.writeFile(path.join(cacheSouth, 'stuck.csv'), 'csv data');

      await migration.up({} as Knex);

      assert.strictEqual(fsSync.existsSync(path.join(tmpRoot, 'cache', SOUTH_ID)), false);
      assert.strictEqual(fsSync.existsSync(path.join(tmpRoot, 'error', SOUTH_ID)), false);
      assert.strictEqual(fsSync.existsSync(path.join(tmpRoot, 'archive', SOUTH_ID)), false);
    });

    it('leaves north-* and history-* folders alone', async () => {
      await fs.mkdir(path.join(tmpRoot, 'cache', NORTH_ID, 'content'), { recursive: true });
      await fs.mkdir(path.join(tmpRoot, 'cache', NORTH_ID, 'metadata'), { recursive: true });
      await fs.mkdir(path.join(tmpRoot, 'cache', 'history-test', 'north', 'content'), { recursive: true });
      await fs.mkdir(path.join(tmpRoot, 'cache', 'history-test', 'north', 'metadata'), { recursive: true });

      await migration.up({} as Knex);

      assert.strictEqual(fsSync.existsSync(path.join(tmpRoot, 'cache', NORTH_ID)), true);
      assert.strictEqual(fsSync.existsSync(path.join(tmpRoot, 'cache', 'history-test')), true);
    });

    it('logs and continues when removing a legacy south folder fails', async () => {
      const southCache = path.join(tmpRoot, 'cache', SOUTH_ID);
      await fs.mkdir(southCache, { recursive: true });
      await fs.writeFile(path.join(southCache, 'stuck.csv'), 'csv data');

      // Deny write+execute on the "cache" parent so removing the south-* entry inside it fails (EACCES).
      const cacheRoot = path.join(tmpRoot, 'cache');
      await fs.chmod(cacheRoot, 0o555);
      try {
        // Must not throw: the error is caught and logged internally.
        await assert.doesNotReject(migration.up({} as Knex));
      } finally {
        await fs.chmod(cacheRoot, 0o755);
      }

      // Folder removal failed, so the south folder is still present.
      assert.strictEqual(fsSync.existsSync(southCache), true);
    });
  });

  describe('north/history error and archive folders', () => {
    it('refactors a north-* folder living under the error base folder', async () => {
      const northErrorRoot = path.join(tmpRoot, 'error', NORTH_ID);
      const contentDir = path.join(northErrorRoot, 'content');
      const metadataDir = path.join(northErrorRoot, 'metadata');
      await fs.mkdir(contentDir, { recursive: true });
      await fs.mkdir(metadataDir, { recursive: true });
      await fs.writeFile(path.join(metadataDir, 'err1.json'), metadataBody('original-err.csv'));
      await fs.writeFile(path.join(contentDir, 'original-err.csv'), 'err data');

      await migration.up({} as Knex);

      assert.deepStrictEqual(await fs.readdir(metadataDir), ['err1']);
      assert.deepStrictEqual(await fs.readdir(contentDir), ['err1']);
    });

    it('refactors a north-* folder living under the archive base folder', async () => {
      const northArchiveRoot = path.join(tmpRoot, 'archive', NORTH_ID);
      const contentDir = path.join(northArchiveRoot, 'content');
      const metadataDir = path.join(northArchiveRoot, 'metadata');
      await fs.mkdir(contentDir, { recursive: true });
      await fs.mkdir(metadataDir, { recursive: true });
      await fs.writeFile(path.join(metadataDir, 'arc1.json'), metadataBody('original-arc.csv'));
      await fs.writeFile(path.join(contentDir, 'original-arc.csv'), 'arc data');

      await migration.up({} as Knex);

      assert.deepStrictEqual(await fs.readdir(metadataDir), ['arc1']);
      assert.deepStrictEqual(await fs.readdir(contentDir), ['arc1']);
    });

    it('refactors the "north" subfolder of a history-* cache folder', async () => {
      const historyNorthRoot = path.join(tmpRoot, 'cache', 'history-test', 'north');
      const contentDir = path.join(historyNorthRoot, 'content');
      const metadataDir = path.join(historyNorthRoot, 'metadata');
      await fs.mkdir(contentDir, { recursive: true });
      await fs.mkdir(metadataDir, { recursive: true });
      await fs.writeFile(path.join(metadataDir, 'hist1.json'), metadataBody('original-hist.csv'));
      await fs.writeFile(path.join(contentDir, 'original-hist.csv'), 'hist data');

      await migration.up({} as Knex);

      assert.deepStrictEqual(await fs.readdir(metadataDir), ['hist1']);
      assert.deepStrictEqual(await fs.readdir(contentDir), ['hist1']);
    });

    it('refactors the "north" subfolder of a history-* error folder', async () => {
      const historyNorthRoot = path.join(tmpRoot, 'error', 'history-test', 'north');
      const contentDir = path.join(historyNorthRoot, 'content');
      const metadataDir = path.join(historyNorthRoot, 'metadata');
      await fs.mkdir(contentDir, { recursive: true });
      await fs.mkdir(metadataDir, { recursive: true });
      await fs.writeFile(path.join(metadataDir, 'histerr1.json'), metadataBody('original-histerr.csv'));
      await fs.writeFile(path.join(contentDir, 'original-histerr.csv'), 'histerr data');

      await migration.up({} as Knex);

      assert.deepStrictEqual(await fs.readdir(metadataDir), ['histerr1']);
      assert.deepStrictEqual(await fs.readdir(contentDir), ['histerr1']);
    });

    it('refactors the "north" subfolder of a history-* archive folder', async () => {
      const historyNorthRoot = path.join(tmpRoot, 'archive', 'history-test', 'north');
      const contentDir = path.join(historyNorthRoot, 'content');
      const metadataDir = path.join(historyNorthRoot, 'metadata');
      await fs.mkdir(contentDir, { recursive: true });
      await fs.mkdir(metadataDir, { recursive: true });
      await fs.writeFile(path.join(metadataDir, 'histarc1.json'), metadataBody('original-histarc.csv'));
      await fs.writeFile(path.join(contentDir, 'original-histarc.csv'), 'histarc data');

      await migration.up({} as Knex);

      assert.deepStrictEqual(await fs.readdir(metadataDir), ['histarc1']);
      assert.deepStrictEqual(await fs.readdir(contentDir), ['histarc1']);
    });
  });

  describe('refactorNorthContent edge cases', () => {
    it('logs and continues when the north folder has no metadata subfolder at all', async () => {
      // Only the base north-* folder exists, without content/ or metadata/ subfolders.
      const northRoot = path.join(tmpRoot, 'cache', 'north-bare');
      await fs.mkdir(northRoot, { recursive: true });

      await assert.doesNotReject(migration.up({} as Knex));

      // Nothing to migrate; the folder itself is left untouched (no content/metadata folders created).
      assert.deepStrictEqual(await fs.readdir(northRoot), []);
    });

    it('logs a rename failure when the metadata JSON references a non-existent content file', async () => {
      const { contentDir, metadataDir } = await setupNorth();
      // Valid JSON, but the referenced content file was never written.
      await fs.writeFile(path.join(metadataDir, 'missing.json'), metadataBody('never-existed.csv'));

      await assert.doesNotReject(migration.up({} as Knex));

      // The rename failed, so the broken metadata entry (both json and bare forms) is cleaned up.
      assert.deepStrictEqual(await fs.readdir(metadataDir), []);
      assert.deepStrictEqual(await fs.readdir(contentDir), []);
    });

    it('logs a JSON parse failure for metadata files containing malformed (non-empty) JSON', async () => {
      const { contentDir, metadataDir } = await setupNorth();
      await fs.writeFile(path.join(metadataDir, 'malformed.json'), '{not valid json');
      await fs.writeFile(path.join(contentDir, 'orphan.csv'), 'data');

      await assert.doesNotReject(migration.up({} as Knex));

      assert.deepStrictEqual(await fs.readdir(metadataDir), []);
      assert.deepStrictEqual(await fs.readdir(contentDir), []);
    });
  });

  describe('removeOPCUATestFolders', () => {
    it('removes opcua-* folders from the data folder root', async () => {
      const opcuaFolder = path.join(tmpRoot, 'opcua-test-server');
      await fs.mkdir(opcuaFolder, { recursive: true });
      await fs.writeFile(path.join(opcuaFolder, 'leftover.txt'), 'leftover');

      await migration.up({} as Knex);

      assert.strictEqual(fsSync.existsSync(opcuaFolder), false);
    });

    it('logs and continues when removing an opcua-* folder fails', async () => {
      const opcuaFolder = path.join(tmpRoot, 'opcua-broken');
      await fs.mkdir(opcuaFolder, { recursive: true });
      await fs.writeFile(path.join(opcuaFolder, 'leftover.txt'), 'leftover');

      // Deny write+execute on the data folder root so removing the opcua-* entry inside it fails (EACCES).
      await fs.chmod(tmpRoot, 0o555);
      try {
        await assert.doesNotReject(migration.up({} as Knex));
      } finally {
        await fs.chmod(tmpRoot, 0o755);
      }

      assert.strictEqual(fsSync.existsSync(opcuaFolder), true);
      await fs.rm(opcuaFolder, { recursive: true, force: true });
    });
  });

  describe('top-level folder read failures', () => {
    let brokenTmpRootParent: string;
    let brokenTmpRoot: string;
    let brokenMigration: MigrationModule;

    before(async () => {
      // Point the migration's path constants at a directory that does not exist,
      // so every top-level fs.readdir() in up() fails and hits its catch branch.
      brokenTmpRootParent = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-mig-v380-missing-'));
      brokenTmpRoot = path.join(brokenTmpRootParent, 'does-not-exist');

      const utilsPath = '../../../../service/utils';
      const utilsActual = nodeRequire(utilsPath) as Record<string, unknown>;
      mockModule(nodeRequire, utilsPath, {
        ...utilsActual,
        getCommandLineArguments: () => ({
          configFile: brokenTmpRoot,
          version: false,
          ignoreIpFilters: false,
          ignoreRemoteUpdate: false,
          ignoreRemoteConfig: false,
          launcherVersion: 'test'
        })
      });
      brokenMigration = reloadModule<MigrationModule>(nodeRequire, './v3.8.0');
    });

    after(async () => {
      // Restore the module binding used by the rest of the suite.
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
      migration = reloadModule<MigrationModule>(nodeRequire, './v3.8.0');
      await fs.rm(brokenTmpRootParent, { recursive: true, force: true });
    });

    it('does not throw when the root/cache/error/archive folders cannot be read', async () => {
      await assert.doesNotReject(brokenMigration.up({} as Knex));
    });
  });
});
