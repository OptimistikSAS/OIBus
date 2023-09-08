import knex, { Knex } from 'knex';
import path from 'node:path';

export async function migrateEntities(dbPath: string): Promise<Knex> {
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
  await knexConfig.migrate.latest({ directory: path.resolve(__dirname, 'entity-migrations') });
  return knexConfig;
}

export async function migrateLogsAndMetrics(dbPath: string): Promise<Knex> {
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
  await knexConfig.migrate.latest({ directory: path.resolve(__dirname, 'logs-and-metrics-migrations') });
  return knexConfig;
}

export async function migrateCrypto(dbPath: string): Promise<Knex> {
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
  await knexConfig.migrate.latest({ directory: path.resolve(__dirname, 'crypto-migrations') });
  return knexConfig;
}

export async function migrateSouthCache(dbPath: string): Promise<Knex> {
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
  await knexConfig.migrate.latest({ directory: path.resolve(__dirname, 'south-cache-migrations') });
  return knexConfig;
}
