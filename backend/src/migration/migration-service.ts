import knex from 'knex';
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

export async function migrateEntities(dbPath: string): Promise<void> {
  const knexConfig = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
    },
    useNullAsDefault: true,
    migrations: {
      tableName: 'migrations'
    }
  });
  await knexConfig.migrate.latest({ directory: getMigrationDirs(path.resolve(__dirname, 'entity-migrations')) });
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
      tableName: 'migrations'
    }
  });
  await knexConfig.migrate.latest({ directory: getMigrationDirs(path.resolve(__dirname, 'logs-migrations')) });
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
      tableName: 'migrations'
    }
  });
  await knexConfig.migrate.latest({ directory: getMigrationDirs(path.resolve(__dirname, 'metrics-migrations')) });
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
      tableName: 'migrations'
    }
  });
  await knexConfig.migrate.latest({ directory: getMigrationDirs(path.resolve(__dirname, 'crypto-migrations')) });
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
      tableName: 'migrations'
    }
  });
  await knexConfig.migrate.latest({ directory: getMigrationDirs(path.resolve(__dirname, 'south-cache-migrations')) });
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
      tableName: 'data-folder-migrations'
    }
  });

  await knexConfig.migrate.latest({ directory: getMigrationDirs(path.resolve(__dirname, 'data-folder-migrations')) });
}
