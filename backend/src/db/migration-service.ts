import knex, { Knex } from 'knex';
import path from 'node:path';

export default async function migrate(dbPath: string): Promise<Knex> {
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
  await knexConfig.migrate.up({ directory: path.resolve(__dirname, 'migrations') });
  return knexConfig;
}
