import knex, { Knex } from 'knex';
import path from 'node:path';
import { existsSync, readdirSync, renameSync } from 'node:fs';

/**
 * Recursively finds all leaf directories under `base` (i.e. directories that
 * contain no further subdirectories). Migration files are placed in these
 * leaves, grouped by major → minor version: e.g. entity-migrations/3/3.8/.
 *
 * If `base` has no subdirectories at all it is returned as-is, which keeps
 * backward compatibility for any flat directory that has not been restructured.
 */
function getMigrationDirs(base: string): Array<string> {
  const entries = readdirSync(base, { withFileTypes: true });
  const subDirs = entries.filter(e => e.isDirectory()).map(e => path.join(base, e.name));
  if (subDirs.length === 0) {
    return [base];
  }
  return subDirs.flatMap(d => getMigrationDirs(d));
}

// Mirrors knex's default loadExtensions for the file types we ship migrations in.
const MIGRATION_EXTENSIONS = ['.js', '.cjs', '.mjs', '.ts'];

interface MigrationFile {
  file: string;
  directory: string;
}

/**
 * Build a knex migration source over every leaf directory under `base`, EXCLUDING
 * co-located `*.spec.*` test files.
 *
 * Migration specs live next to the migrations they cover (e.g. v3.6.0-x.ts +
 * v3.6.0-x.spec.ts in the same leaf dir). knex's default file-system source globs
 * every `.ts`/`.js` in a directory and rejects any file without up/down — so those
 * spec files would otherwise abort `migrate.latest`. This source skips them while
 * keeping knex's exact naming (filename) and ordering (lexicographic by filename),
 * so the set/order/recorded names of real migrations are unchanged — no re-runs.
 */
export function specFilteredMigrationSource(base: string): Knex.MigrationSource<MigrationFile> {
  const dirs = getMigrationDirs(base);
  return {
    getMigrations(loadExtensions?: ReadonlyArray<string>): Promise<Array<MigrationFile>> {
      const extensions = loadExtensions && loadExtensions.length > 0 ? loadExtensions : MIGRATION_EXTENSIONS;
      const migrations = dirs.flatMap(directory =>
        readdirSync(directory)
          .filter(file => extensions.includes(path.extname(file)) && !file.includes('.spec.'))
          .map(file => ({ file, directory }))
      );
      // Match knex's FsMigrations ordering: lexicographic by filename across all dirs.
      migrations.sort((a, b) => (a.file > b.file ? 1 : a.file < b.file ? -1 : 0));
      return Promise.resolve(migrations);
    },
    getMigrationName(migration: MigrationFile): string {
      return migration.file;
    },
    getMigration(migration: MigrationFile): Promise<Knex.Migration> {
      // Mirrors knex's importFile CJS path (this project compiles migrations to CommonJS).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return Promise.resolve(require(path.join(migration.directory, migration.file)) as Knex.Migration);
    }
  };
}

/**
 * Run every pending migration of `migrationsDir` against the SQLite db at `dbPath`.
 *
 * knex guards a batch with a row in `<tableName>_lock`. When a batch contains a migration declared with
 * `config.transaction = false` (e.g. logs v3.8.0, which VACUUMs), the lock is committed on its own before the
 * migrations run. If the process dies mid-batch (machine reboot during a long migration), the lock stays set and
 * every following start fails with "Migration table is already locked". A data folder is only ever owned by a
 * single OIBus process, so any lock found at startup is stale and can safely be released.
 */
async function runMigrations(dbPath: string, tableName: string, migrationsDir: string): Promise<void> {
  const knexConfig = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
    },
    useNullAsDefault: true,
    migrations: {
      tableName,
      migrationSource: specFilteredMigrationSource(path.resolve(__dirname, migrationsDir))
    }
  });
  try {
    await knexConfig.migrate.forceFreeMigrationsLock();
    await knexConfig.migrate.latest();
  } finally {
    // Always release the connection, so the db file can be moved away if the migration failed
    await knexConfig.destroy();
  }
}

export async function migrateEntities(dbPath: string): Promise<void> {
  await runMigrations(dbPath, 'migrations', 'entity-migrations');
}

/**
 * Logs are not critical: a logs database that cannot be migrated (too large, corrupted, disk full...) must not
 * prevent OIBus from starting. In that case, the database is moved aside and a fresh one is created.
 */
export async function migrateLogs(dbPath: string): Promise<void> {
  try {
    await runMigrations(dbPath, 'migrations', 'logs-migrations');
  } catch (error: unknown) {
    const backupPath = `${dbPath}-${Date.now()}.bak`;
    console.error(
      `Error while migrating logs database ${dbPath}: ${(error as Error).message}. Moving it to ${backupPath} and starting with an empty logs database`
    );
    for (const suffix of ['', '-wal', '-shm']) {
      if (existsSync(`${dbPath}${suffix}`)) {
        renameSync(`${dbPath}${suffix}`, `${backupPath}${suffix}`);
      }
    }
    await runMigrations(dbPath, 'migrations', 'logs-migrations');
  }
}

export async function migrateMetrics(dbPath: string): Promise<void> {
  await runMigrations(dbPath, 'migrations', 'metrics-migrations');
}

export async function migrateCrypto(dbPath: string): Promise<void> {
  await runMigrations(dbPath, 'migrations', 'crypto-migrations');
}

export async function migrateSouthCache(dbPath: string): Promise<void> {
  await runMigrations(dbPath, 'migrations', 'south-cache-migrations');
}

export async function migrateDataFolder(dbPath: string): Promise<void> {
  await runMigrations(dbPath, 'data-folder-migrations', 'data-folder-migrations');
}
