import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import knexFactory, { Knex } from 'knex';

export interface MigrationFileRef {
  file: string;
  full: string;
}

/** Recursively collects every real migration `.ts` file (excluding `*.spec.ts`) under `root`. */
export function collectMigrationFiles(root: string): Array<MigrationFileRef> {
  const out: Array<MigrationFileRef> = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectMigrationFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push({ file: entry.name, full });
    }
  }
  return out;
}

/**
 * Parses the leading "vMAJOR.MINOR[.PATCH][_SEQ]" version prefix of a migration filename into a
 * fixed-shape numeric key, e.g. "v3.10.0_1.ts" -> [3, 10, 0, 1] and "v3.9.0.ts" -> [3, 9, 0, -1].
 * Comparing these numerically (see compareMigrationFilenames) instead of comparing the filenames
 * as plain strings is what makes "v3.10" sort after "v3.9" rather than right after "v3.1" — the
 * same class of bug fixed in migration-service.ts's compareVersionDirNames, applied here to
 * filenames instead of directory names.
 */
export function migrationVersionKey(filename: string): Array<number> {
  const match = filename.match(/^v(\d+(?:\.\d+)*)(?:_(\d+))?/);
  if (!match) return [0, 0, 0, -1];
  const dotted = match[1].split('.').map(Number);
  while (dotted.length < 3) {
    dotted.push(0);
  }
  const seq = match[2] !== undefined ? Number(match[2]) : -1;
  return [...dotted, seq];
}

/** Compares two migration filenames by their numeric version key (see migrationVersionKey). */
export function compareMigrationFilenames(a: string, b: string): number {
  const ka = migrationVersionKey(a);
  const kb = migrationVersionKey(b);
  const length = Math.max(ka.length, kb.length);
  for (let i = 0; i < length; i++) {
    const av = ka[i] ?? 0;
    const bv = kb[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/**
 * Runs every migration file under `root` whose filename sorts strictly before `beforeFilename`
 * (per compareMigrationFilenames), in version order. Used by migration specs to build the real
 * schema as it exists just before the migration under test.
 */
export async function buildSchemaBefore(root: string, beforeFilename: string, db: Knex): Promise<void> {
  const priorFiles = collectMigrationFiles(root)
    .filter(f => compareMigrationFilenames(f.file, beforeFilename) < 0)
    .sort((a, b) => compareMigrationFilenames(a.file, b.file));
  for (const { full } of priorFiles) {
    const migration = (await import(pathToFileURL(full).href)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

export interface MigrationSchemaHarness {
  before(): Promise<void>;
  beforeEach(): Promise<void>;
  afterEach(): Promise<void>;
  after(): Promise<void>;
  getDb(): Knex;
}

/**
 * Builds a pre-migration schema ONCE (via `buildSchema`, typically `buildSchemaBefore(...)`) and
 * hands each test an isolated SQLite SAVEPOINT (a nested knex transaction) instead of replaying
 * the whole migration history for every single test. Rolling the savepoint back in `afterEach`
 * restores the exact pre-built state for the next test, at a fraction of the cost of re-running
 * every prior migration's up() again.
 *
 * This mirrors production: knex's real migrate.latest() already wraps every migration file's
 * up()/down() in its own transaction by default (see knex's Migrator `transactionForAll`), so
 * migrations under test already run inside a transaction in real usage — this harness doesn't
 * change what is being tested, only how fast the starting fixture is built.
 *
 * NOT suitable for specs whose test bodies toggle `PRAGMA foreign_keys` directly on `db` and rely
 * on that taking effect: SQLite treats that pragma as a no-op while any transaction (including a
 * savepoint) is active, so a test that does `db.raw('PRAGMA foreign_keys = OFF')` expecting it to
 * relax constraints will behave differently under this harness than against a bare connection. Use
 * createMigrationFileCloneHarness instead for specs like that.
 *
 * `mode: 'file'` opens a real temp-file SQLite db instead of ':memory:' — needed by the handful of
 * migrations whose table-rebuild steps require a real file connection.
 */
export function createMigrationSchemaHarness(options: {
  buildSchema: (db: Knex) => Promise<void>;
  mode?: 'memory' | 'file';
}): MigrationSchemaHarness {
  const mode = options.mode ?? 'memory';
  let rootDb: Knex;
  let baseTrx: Knex.Transaction;
  let testTrx: Knex.Transaction;
  let tmpDir: string | undefined;

  return {
    async before(): Promise<void> {
      let filename = ':memory:';
      if (mode === 'file') {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-migration-spec-'));
        filename = path.join(tmpDir, 'test.db');
      }
      rootDb = knexFactory({ client: 'better-sqlite3', connection: { filename }, useNullAsDefault: true });
      baseTrx = await rootDb.transaction();
      await options.buildSchema(baseTrx);
    },
    async beforeEach(): Promise<void> {
      testTrx = await baseTrx.transaction();
    },
    async afterEach(): Promise<void> {
      await testTrx.rollback();
    },
    async after(): Promise<void> {
      await baseTrx.rollback();
      await rootDb.destroy();
      if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    },
    getDb(): Knex {
      return testTrx;
    }
  };
}

export interface MigrationFileCloneHarness {
  before(): Promise<void>;
  beforeEach(): Promise<void>;
  afterEach(): Promise<void>;
  after(): Promise<void>;
  getDb(): Knex;
}

/**
 * Builds a pre-migration schema ONCE into a template SQLite file, then hands each test a fresh,
 * ordinary (non-transactional) connection to a byte-for-byte copy of that file, instead of
 * replaying the whole migration history for every single test.
 *
 * Unlike createMigrationSchemaHarness, each test's `db` is a genuinely new connection — not a
 * shared transaction/savepoint — so specs that toggle `PRAGMA foreign_keys` mid-test (which is a
 * no-op once a transaction is active) keep working exactly as they do against today's
 * bare-connection-per-test setup. Use this harness for those specs instead.
 *
 * Building the template pays the same cost as today's per-test rebuild, but only once per file;
 * each test then pays only the cost of one small file copy. This matters most on Windows, where
 * every individual DDL statement's implicit commit against a real file is dramatically slower than
 * on Linux/macOS — collapsing dozens of migrations' worth of file commits into a single file copy
 * per test removes nearly all of that cost. Safe because better-sqlite3 defaults to the `delete`
 * (rollback) journal mode, not WAL, so a cleanly closed connection leaves the template file with no
 * sidecar `-wal`/`-shm` state that a plain file copy could miss.
 */
export function createMigrationFileCloneHarness(options: { buildSchema: (db: Knex) => Promise<void> }): MigrationFileCloneHarness {
  let tmpDir: string;
  let templateFile: string;
  let testFile: string;
  let testDb: Knex;
  let counter = 0;

  return {
    async before(): Promise<void> {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-migration-spec-'));
      templateFile = path.join(tmpDir, 'template.db');
      const templateDb = knexFactory({ client: 'better-sqlite3', connection: { filename: templateFile }, useNullAsDefault: true });
      await options.buildSchema(templateDb);
      await templateDb.destroy();
    },
    async beforeEach(): Promise<void> {
      testFile = path.join(tmpDir, `test-${counter++}.db`);
      await fs.copyFile(templateFile, testFile);
      testDb = knexFactory({ client: 'better-sqlite3', connection: { filename: testFile }, useNullAsDefault: true });
    },
    async afterEach(): Promise<void> {
      await testDb.destroy();
      await fs.rm(testFile, { force: true });
    },
    async after(): Promise<void> {
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
    getDb(): Knex {
      return testDb;
    }
  };
}
