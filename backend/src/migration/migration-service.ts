import knex, { Knex } from 'knex';
import path from 'node:path';
import { existsSync, readdirSync, renameSync } from 'node:fs';
import { compareVersions as compareVersionDirNames } from '../service/config-transfer/settings-upgrades/version-compare';

/**
 * Recursively finds all leaf directories under `base` (i.e. directories that
 * contain no further subdirectories). Migration files are placed in these
 * leaves, grouped by major → minor version: e.g. entity-migrations/3/3.8/.
 *
 * Subdirectories at each level are visited in numeric version order (via
 * compareVersionDirNames), so leaf directories come back ordered "3.9" before
 * "3.10" — the order getMigrations relies on to run migrations minor-version
 * by minor-version.
 *
 * If `base` has no subdirectories at all it is returned as-is, which keeps
 * backward compatibility for any flat directory that has not been restructured.
 */
function getMigrationDirs(base: string): Array<string> {
  const entries = readdirSync(base, { withFileTypes: true });
  const subDirs = entries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort(compareVersionDirNames)
    .map(name => path.join(base, name));
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
 * keeping the set of real migrations unchanged (so recorded names/no re-runs are
 * unaffected) and ordering them minor-version directory first (numerically, via
 * getMigrationDirs), then lexicographically by filename within each directory —
 * NOT lexicographically by filename across the whole tree, which would sort a
 * directory like "3.10" ahead of "3.2"..."3.9".
 */
export function specFilteredMigrationSource(base: string): Knex.MigrationSource<MigrationFile> {
  const dirs = getMigrationDirs(base);
  return {
    getMigrations(loadExtensions?: ReadonlyArray<string>): Promise<Array<MigrationFile>> {
      const extensions = loadExtensions && loadExtensions.length > 0 ? loadExtensions : MIGRATION_EXTENSIONS;
      const migrations = dirs.flatMap(directory =>
        readdirSync(directory)
          .filter(file => extensions.includes(path.extname(file)) && !file.includes('.spec.'))
          .sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
          .map(file => ({ file, directory }))
      );
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
