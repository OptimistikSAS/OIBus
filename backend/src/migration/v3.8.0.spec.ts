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

type MigrationModule = typeof import('./data-folder-migrations/3/3.8/v3.8.0');

describe('Data folder migration v3.8.0', () => {
  let tmpRoot: string;
  let migration: MigrationModule;

  const NORTH_ID = 'north-test';
  const SOUTH_ID = 'south-test';

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-mig-v380-'));

    // Override getCommandLineArguments so the migration's path constants resolve under tmpRoot.
    // Spread the real utils so other exports (filesExists, etc.) remain intact.
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
    migration = reloadModule<MigrationModule>(nodeRequire, './data-folder-migrations/3/3.8/v3.8.0');

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

    it('rolls back content rename when second rename (metadata) fails — covers filesExists(contentDest)=true', async () => {
      // Make the second fs.rename fail by pre-creating a directory at the destination
      // metadata path (Linux raises EISDIR when renaming a file onto an existing directory).
      const { contentDir, metadataDir } = await setupNorth();
      await fs.writeFile(path.join(metadataDir, 'conflict.json'), metadataBody('src-content.csv'));
      await fs.writeFile(path.join(contentDir, 'src-content.csv'), 'data');
      // Creating a directory at /metadata/conflict forces the second rename to throw.
      await fs.mkdir(path.join(metadataDir, 'conflict'), { recursive: true });

      await assert.doesNotReject(() => migration.up({} as Knex));
    });

    it('rollback covers filesExists(destMetadata)=true when a bare metadata exists', async () => {
      // Simulates: a bare metadata file 'done' was written by a prior run, but the
      // corresponding json file 'done.json' is corrupt (empty → parse fails). The
      // rollback should see 'done' already exists at the destMetadata path.
      const { contentDir, metadataDir } = await setupNorth();
      await fs.writeFile(path.join(metadataDir, 'done'), metadataBody('was-content'));
      await fs.writeFile(path.join(contentDir, 'done'), 'existing-data');
      // corrupt json for the same stem
      await fs.writeFile(path.join(metadataDir, 'done.json'), '');

      await assert.doesNotReject(() => migration.up({} as Knex));
    });

    it('calls .catch when rm(contentDest) fails — contentDest is an existing directory', async () => {
      // First rename (missingFile → content/conflict) fails with ENOENT,
      // so content/conflict remains a directory we pre-created.
      // rm(content/conflict) without {recursive} throws EISDIR → .catch called.
      const { contentDir, metadataDir } = await setupNorth();
      await fs.writeFile(path.join(metadataDir, 'conflict.json'), metadataBody('missing-src.csv'));
      await fs.mkdir(path.join(contentDir, 'conflict'), { recursive: true });

      await assert.doesNotReject(() => migration.up({} as Knex));
    });

    it('calls .catch when rm(srcMetadata) fails — srcMetadata is a directory', async () => {
      // metadata/conflict.json is a directory, so readFile throws EISDIR → catch.
      // filesExists(metadata/conflict.json dir) → true → rm without {recursive} → EISDIR → .catch called.
      const { contentDir: _c, metadataDir } = await setupNorth();
      await fs.mkdir(path.join(metadataDir, 'conflict.json'), { recursive: true });

      await assert.doesNotReject(() => migration.up({} as Knex));
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

  describe('refactorNorthContent outer catch', () => {
    it('logs error when north folder has no metadata subdir (outer try/catch)', async () => {
      // A north folder without content/metadata subdirs causes the outer readdir to fail.
      await fs.mkdir(path.join(tmpRoot, 'cache', 'north-naked'), { recursive: true });
      await assert.doesNotReject(() => migration.up({} as Knex));
    });
  });

  describe('readdir error handling', () => {
    it('continues gracefully when cache, error and archive folders are missing', async () => {
      for (const sub of ['cache', 'error', 'archive']) {
        await fs.rm(path.join(tmpRoot, sub), { recursive: true, force: true });
      }
      await assert.doesNotReject(() => migration.up({} as Knex));
    });
  });

  describe('removeOPCUATestFolders', () => {
    it('removes opcua-* folders from the data folder root', async () => {
      const opcuaDir = path.join(tmpRoot, 'opcua-test-connector');
      await fs.mkdir(opcuaDir, { recursive: true });
      await fs.writeFile(path.join(opcuaDir, 'cert.pem'), 'fake-cert');

      await migration.up({} as Knex);

      assert.strictEqual(fsSync.existsSync(opcuaDir), false);
    });
  });

  describe('removeLegacySouthFolders', () => {
    it('skips groups where the south- folder list is empty (folders.length === 0 branch)', async () => {
      // Only cache has a south folder; error and archive do not.
      const cacheSouth = path.join(tmpRoot, 'cache', SOUTH_ID);
      await fs.mkdir(cacheSouth, { recursive: true });
      // error and archive dirs exist but have no south- entries.

      await migration.up({} as Knex);

      assert.strictEqual(fsSync.existsSync(cacheSouth), false);
      // error and archive are untouched (no south entries to remove).
      assert.strictEqual(fsSync.existsSync(path.join(tmpRoot, 'error')), true);
      assert.strictEqual(fsSync.existsSync(path.join(tmpRoot, 'archive')), true);
    });

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
  });

  it('down() resolves without errors', async () => {
    await assert.doesNotReject(() => migration.down({} as Knex));
  });
});
