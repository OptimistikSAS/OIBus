import Database from 'better-sqlite3';
import { migrateEntities } from '../../db/migration-service';
import path from 'node:path';

export const TEST_DATABASE = path.resolve('src', 'tests', 'oibus-test.db');

export const initDatabase = async () => {
  resetDatabase();
  await migrateEntities(TEST_DATABASE);
  return new Database(TEST_DATABASE);
};

export const emptyDatabase = () => {
  const db = new Database(TEST_DATABASE);
  const transaction = db.transaction(() => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as Array<{ name: string }>;

    tables.forEach(table => {
      // Skip SQLite internal tables
      if (table.name !== 'sqlite_sequence') {
        db.prepare(`DELETE FROM ${table.name};`).run();
      }
    });
  });

  transaction();
  db.close();
};

export const resetDatabase = () => {
  const db = new Database(TEST_DATABASE);
  const transaction = db.transaction(() => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all() as Array<{ name: string }>;

    tables.forEach(table => {
      // Skip SQLite internal tables
      if (table.name !== 'sqlite_sequence') {
        db.prepare(`DROP TABLE IF EXISTS ${table.name};`).run();
      }
    });
  });

  transaction();
  db.close();
};
