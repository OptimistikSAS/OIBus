import knex, { Knex } from 'knex';
import path from 'node:path';
import { readdirSync } from 'node:fs';

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
function specFilteredMigrationSource(base: string): Knex.MigrationSource<MigrationFile> {
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

export async function migrateEntities(dbPath: string): Promise<void> {
  const knexConfig = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
    },
    useNullAsDefault: true,
    migrations: {
      tableName: 'migrations',
      migrationSource: specFilteredMigrationSource(path.resolve(__dirname, 'entity-migrations'))
    }
  });
  await knexConfig.migrate.latest();
  await knexConfig.destroy();
}

export async function migrateLogs(dbPath: string): Promise<void> {
  const knexConfig = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
    },
    useNullAsDefault: true,
    migrations: {
      tableName: 'migrations',
      migrationSource: specFilteredMigrationSource(path.resolve(__dirname, 'logs-migrations'))
    }
  });
  await knexConfig.migrate.latest();
  await knexConfig.destroy();
}

export async function migrateMetrics(dbPath: string): Promise<void> {
  const knexConfig = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
    },
    useNullAsDefault: true,
    migrations: {
      tableName: 'migrations',
      migrationSource: specFilteredMigrationSource(path.resolve(__dirname, 'metrics-migrations'))
    }
  });
  await knexConfig.migrate.latest();
  await knexConfig.destroy();
}

export async function migrateCrypto(dbPath: string): Promise<void> {
  const knexConfig = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
    },
    useNullAsDefault: true,
    migrations: {
      tableName: 'migrations',
      migrationSource: specFilteredMigrationSource(path.resolve(__dirname, 'crypto-migrations'))
    }
  });
  await knexConfig.migrate.latest();
  await knexConfig.destroy();
}

export async function migrateSouthCache(dbPath: string): Promise<void> {
  const knexConfig = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
    },
    useNullAsDefault: true,
    migrations: {
      tableName: 'migrations',
      migrationSource: specFilteredMigrationSource(path.resolve(__dirname, 'south-cache-migrations'))
    }
  });
  await knexConfig.migrate.latest();
  await knexConfig.destroy();
}

export async function migrateDataFolder(dbPath: string): Promise<void> {
  const knexConfig = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
    },
    useNullAsDefault: true,
    migrations: {
      tableName: 'data-folder-migrations',
      migrationSource: specFilteredMigrationSource(path.resolve(__dirname, 'data-folder-migrations'))
    }
  });

  await knexConfig.migrate.latest();
  await knexConfig.destroy();
}
