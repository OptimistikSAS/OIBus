import knex, { Knex } from 'knex';
import path from 'node:path';
import { readdirSync } from 'node:fs';

/**
 * Compares two directory names component-by-component as dot-separated numbers
 * (e.g. "3.10" vs "3.9") instead of as plain strings, so "3.10" sorts after "3.9"
 * rather than before it (a plain string compare puts "3.10" right after "3.1",
 * since '0' < '2' at the first differing character). Any non-numeric component
 * falls back to a string comparison so unexpected directory names still sort
 * deterministically instead of throwing.
 */
function compareVersionDirNames(a: string, b: string): number {
  const aParts = a.split('.');
  const bParts = b.split('.');
  const length = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < length; i++) {
    const aPart = aParts[i] ?? '';
    const bPart = bParts[i] ?? '';
    const aNum = Number(aPart);
    const bNum = Number(bPart);
    if (aPart !== '' && bPart !== '' && Number.isFinite(aNum) && Number.isFinite(bNum)) {
      if (aNum !== bNum) {
        return aNum - bNum;
      }
    } else if (aPart !== bPart) {
      return aPart > bPart ? 1 : -1;
    }
  }
  return 0;
}

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
