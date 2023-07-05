import knex from 'knex';

export default function migrate(dbPath: string) {
  const knexConfig = knex({
    client: 'better-sqlite3',
    connection: {
      filename: dbPath
    },
    migrations: {
      tableName: 'migrations'
    }
  });
  knexConfig.migrate.up({ directory: 'migrations' });
}
