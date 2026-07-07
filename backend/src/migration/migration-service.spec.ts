import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrateEntities, migrateLogs, migrateMetrics, migrateCrypto, migrateSouthCache, migrateDataFolder } from './migration-service';

/**
 * Opens the sqlite db read-only and returns the names of migrations recorded in
 * knex's `migrations` bookkeeping table, proving `migrate.latest()` actually ran
 * real migration files (exercising getMigrationDirs' recursion + base case,
 * specFilteredMigrationSource's getMigrations/getMigrationName/getMigration).
 */
function appliedMigrationNames(dbPath: string, tableName = 'migrations'): Array<string> {
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db.prepare(`SELECT name FROM "${tableName}" ORDER BY name`).all() as Array<{ name: string }>;
    return rows.map(r => r.name);
  } finally {
    db.close();
  }
}

describe('migration-service', () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-migration-service-'));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('migrateEntities', () => {
    it('runs the real entity migrations against a fresh db', async () => {
      const dbPath = path.join(tmpDir, 'entities.db');
      await assert.doesNotReject(migrateEntities(dbPath));

      const applied = appliedMigrationNames(dbPath);
      assert.ok(applied.length > 0, 'expected at least one applied entity migration');
    });
  });

  describe('migrateLogs', () => {
    it('runs the real logs migrations against a fresh db', async () => {
      const dbPath = path.join(tmpDir, 'logs.db');
      await assert.doesNotReject(migrateLogs(dbPath));

      const applied = appliedMigrationNames(dbPath);
      assert.ok(applied.length > 0, 'expected at least one applied logs migration');
    });
  });

  describe('migrateMetrics', () => {
    it('runs the real metrics migrations against a fresh db', async () => {
      const dbPath = path.join(tmpDir, 'metrics.db');
      await assert.doesNotReject(migrateMetrics(dbPath));

      const applied = appliedMigrationNames(dbPath);
      assert.ok(applied.length > 0, 'expected at least one applied metrics migration');
    });
  });

  describe('migrateCrypto', () => {
    it('runs the real crypto migrations against a fresh db', async () => {
      const dbPath = path.join(tmpDir, 'crypto.db');
      await assert.doesNotReject(migrateCrypto(dbPath));

      const applied = appliedMigrationNames(dbPath);
      assert.ok(applied.length > 0, 'expected at least one applied crypto migration');
    });
  });

  describe('migrateSouthCache', () => {
    it('runs the real south-cache migrations against a fresh db', async () => {
      const dbPath = path.join(tmpDir, 'south-cache.db');
      await assert.doesNotReject(migrateSouthCache(dbPath));

      const applied = appliedMigrationNames(dbPath);
      assert.ok(applied.length > 0, 'expected at least one applied south-cache migration');
    });
  });

  describe('migrateDataFolder', () => {
    let dataFolderRoot: string;
    let previousCwd: string;

    before(async () => {
      // The data-folder migrations resolve their target paths from
      // `getCommandLineArguments().configFile`, which defaults to `path.resolve('./')`
      // i.e. the current working directory. Chdir'ing into a scratch data-folder
      // before the migrations are (lazily, via require()) loaded lets them operate
      // on a throwaway tree instead of the real repo.
      dataFolderRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-data-folder-'));
      await fs.mkdir(path.join(dataFolderRoot, 'cache'), { recursive: true });
      await fs.mkdir(path.join(dataFolderRoot, 'archive'), { recursive: true });
      await fs.mkdir(path.join(dataFolderRoot, 'error'), { recursive: true });

      previousCwd = process.cwd();
      process.chdir(dataFolderRoot);

      // The data-folder migrations are chatty by design (they log progress) — silence them.
      mock.method(console, 'info', () => undefined);
      mock.method(console, 'error', () => undefined);
    });

    after(async () => {
      mock.restoreAll();
      process.chdir(previousCwd);
      await fs.rm(dataFolderRoot, { recursive: true, force: true });
    });

    it('runs the real data-folder migrations against a fresh db', async () => {
      const dbPath = path.join(dataFolderRoot, 'data-folder.db');
      await assert.doesNotReject(migrateDataFolder(dbPath));

      const applied = appliedMigrationNames(dbPath, 'data-folder-migrations');
      assert.ok(applied.length > 0, 'expected at least one applied data-folder migration');
    });

    it('is idempotent: re-running does not reject and applies the same set of migrations', async () => {
      const dbPath = path.join(dataFolderRoot, 'data-folder.db');

      const beforeSecondRun = appliedMigrationNames(dbPath, 'data-folder-migrations');
      await assert.doesNotReject(migrateDataFolder(dbPath));
      const afterSecondRun = appliedMigrationNames(dbPath, 'data-folder-migrations');

      assert.deepStrictEqual(afterSecondRun, beforeSecondRun);
    });
  });
});

// Note on branch coverage:
// - `getMigrationDirs`' no-subdirectory base case (`return [base]`) is already exercised by
//   the tests above: every real migration tree (entity/logs/metrics/crypto/south-cache/
//   data-folder-migrations) bottoms out at leaf minor-version directories (e.g.
//   `entity-migrations/3/3.9`) that themselves contain no subdirectories, so the recursive
//   walk hits both the recursive branch and the `[base]` base case without any extra test.
// - `specFilteredMigrationSource(...).getMigrations`'s "provided loadExtensions" branch is
//   exercised because knex's migrator calls `getMigrations(loadExtensions)` with its
//   configured (non-empty) extensions list while running `migrate.latest()` above. The
//   fallback branch (`loadExtensions` empty/undefined, falling back to the hardcoded
//   `MIGRATION_EXTENSIONS`) is not reachable through the public API: `specFilteredMigrationSource`
//   is not exported, and knex always supplies a non-empty extensions array in the versions
//   used here, so this defensive fallback branch is left uncovered by design rather than
//   worked around with a private-API hack.
