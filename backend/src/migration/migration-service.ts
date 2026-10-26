import { readdirSync } from 'node:fs';
import path from 'node:path';

import knex, { Knex } from 'knex';

import { compareVersions as compareVersionDirNames } from '../service/config-transfer/config-upgrades/version-compare';

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

/**
 * Orders the migration files of a directory by their numbers, compared numerically, the rest of their name as text:
 * "v3.10.0.ts", "v3.10.0_1.ts", "v3.10.0_2.ts" ... "v3.10.0_10.ts" (as text, "_10" would run before "_2").
 */
export function compareMigrationFilenames(a: string, b: string): number {
  const tokensOf = (name: string) => name.match(/\d+|\D+/g) ?? [];
  const tokensA = tokensOf(a);
  const tokensB = tokensOf(b);
  for (let i = 0; i < Math.min(tokensA.length, tokensB.length); i++) {
    const [tokenA, tokenB] = [tokensA[i], tokensB[i]];
    if (tokenA === tokenB) continue;
    const bothNumbers = /^\d/.test(tokenA) && /^\d/.test(tokenB);
    if (bothNumbers && Number(tokenA) !== Number(tokenB)) return Number(tokenA) - Number(tokenB);
    return tokenA < tokenB ? -1 : 1;
  }
  return tokensA.length - tokensB.length;
}

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
 * getMigrationDirs), then by filename within each directory, its numbers compared
 * numerically (see compareMigrationFilenames) — NOT lexicographically by filename
 * across the whole tree, which would sort a directory like "3.10" ahead of
 * "3.2"..."3.9".
 */
export function specFilteredMigrationSource(base: string): Knex.MigrationSource<MigrationFile> {
  const dirs = getMigrationDirs(base);
  return {
    getMigrations(loadExtensions?: ReadonlyArray<string>): Promise<Array<MigrationFile>> {
      const extensions = loadExtensions && loadExtensions.length > 0 ? loadExtensions : MIGRATION_EXTENSIONS;
      const migrations = dirs.flatMap(directory =>
        readdirSync(directory)
          .filter(file => extensions.includes(path.extname(file)) && !file.includes('.spec.'))
          .sort(compareMigrationFilenames)
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
