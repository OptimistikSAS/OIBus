import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import argon2 from 'argon2';
import Database from 'better-sqlite3';

import UserRepository, { generateRandomId } from './user.repository';

const USERS_TABLE_DEFINITION = `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    login TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    language TEXT,
    timezone TEXT,
    must_change_password BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
`;

const createdDirectories: Array<string> = [];

const createTemporaryDatabase = (tableDefinition = USERS_TABLE_DEFINITION): string => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-user-repo-'));
  createdDirectories.push(tempDirectory);
  const databasePath = path.join(tempDirectory, 'oibus.db');
  const database = new Database(databasePath);
  database.exec(tableDefinition);
  database.close();
  return databasePath;
};

afterEach(() => {
  while (createdDirectories.length > 0) {
    const directory = createdDirectories.pop();
    if (directory) {
      try {
        fs.rmSync(directory, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
});

describe('UserRepository', () => {
  it('resets an existing admin user with default parameters', async () => {
    const databasePath = createTemporaryDatabase();
    const database = new Database(databasePath);
    const hashedPassword = await argon2.hash('previousPassword');
    database
      .prepare(
        `INSERT INTO users (id, login, password, first_name, last_name, email, language, timezone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`
      )
      .run('existing-id', 'admin', hashedPassword, 'John', 'Doe', 'admin@example.com', 'fr', 'UTC');
    database.close();

    const repository = new UserRepository(databasePath);
    await repository.resetAdmin();

    const verificationDatabase = new Database(databasePath);
    const admin = verificationDatabase
      .prepare(
        `SELECT login, password, first_name as firstName, last_name as lastName, email, language, timezone, must_change_password as mustChangePassword FROM users WHERE login = ?;`
      )
      .get('admin') as {
      login: string;
      password: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      language: string;
      timezone: string;
      mustChangePassword: number;
    } | null;
    verificationDatabase.close();

    assert.notStrictEqual(admin, null);
    assert.strictEqual(admin?.login, 'admin');
    assert.strictEqual(admin?.firstName, null);
    assert.strictEqual(admin?.lastName, null);
    assert.strictEqual(admin?.email, null);
    assert.strictEqual(admin?.language, 'en');
    assert.strictEqual(admin?.timezone, 'Europe/Paris');
    assert.strictEqual(await argon2.verify(admin!.password, 'pass'), true);
    assert.strictEqual(admin?.mustChangePassword, 1);
  });

  it('resets the admin user of a database not migrated to 4.0 yet, without the password change flag', async () => {
    const databasePath = createTemporaryDatabase(
      USERS_TABLE_DEFINITION.replace('    must_change_password BOOLEAN NOT NULL DEFAULT 0,\n', '')
    );
    const repository = new UserRepository(databasePath);

    await repository.resetAdmin();

    const database = new Database(databasePath);
    const admin = database.prepare('SELECT password FROM users WHERE login = ?;').get('admin') as { password: string };
    database.close();
    assert.strictEqual(await argon2.verify(admin.password, 'pass'), true);
  });

  it('creates an admin user when it does not exist', async () => {
    const databasePath = createTemporaryDatabase();
    const repository = new UserRepository(databasePath);

    await repository.resetAdmin();

    const database = new Database(databasePath);
    const userCount = database.prepare('SELECT COUNT(*) as count FROM users WHERE login = ?;').get('admin') as {
      count: number;
    } | null;
    const admin = database
      .prepare(
        `SELECT login, password, first_name as firstName, last_name as lastName, email, language, timezone, must_change_password as mustChangePassword FROM users WHERE login = ?;`
      )
      .get('admin') as {
      login: string;
      password: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      language: string;
      timezone: string;
      mustChangePassword: number;
    } | null;
    database.close();

    assert.strictEqual(userCount?.count, 1);
    assert.notStrictEqual(admin, null);
    assert.strictEqual(await argon2.verify(admin!.password, 'pass'), true);
    assert.strictEqual(admin?.language, 'en');
    assert.strictEqual(admin?.timezone, 'Europe/Paris');
    assert.strictEqual(admin?.mustChangePassword, 1);
  });
});

describe('generateRandomId', () => {
  it('generates random ID with default size', () => {
    const id = generateRandomId();
    assert.strictEqual(id.length, 16);
    assert.match(id, /^[0-9a-zA-Z]{16}$/);
  });

  it('generates random ID with custom size', () => {
    const id = generateRandomId(6);
    assert.strictEqual(id.length, 6);
    assert.match(id, /^[0-9a-zA-Z]{6}$/);
  });
});
