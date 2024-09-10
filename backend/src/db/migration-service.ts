import knex from 'knex';
import path from 'node:path';

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
  await knexConfig.migrate.latest({ directory: path.resolve(__dirname, 'entity-migrations') });
  await knexConfig.destroy();
}

export async function migrateLogsAndMetrics(dbPath: string): Promise<void> {
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
  await knexConfig.migrate.latest({ directory: path.resolve(__dirname, 'crypto-migrations') });
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
  await knexConfig.migrate.latest({ directory: path.resolve(__dirname, 'south-cache-migrations') });
  await knexConfig.destroy();
}
