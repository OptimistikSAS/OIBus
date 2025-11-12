import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
`;

const createdDirectories: Array<string> = [];

const createTemporaryDatabase = (): string => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-user-repo-'));
  createdDirectories.push(tempDirectory);
  const databasePath = path.join(tempDirectory, 'oibus.db');
  const database = new Database(databasePath);
  database.exec(USERS_TABLE_DEFINITION);
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
        `SELECT login, password, first_name as firstName, last_name as lastName, email, language, timezone FROM users WHERE login = ?;`
      )
      .get('admin') as {
      login: string;
      password: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      language: string;
      timezone: string;
    } | null;
    verificationDatabase.close();

    expect(admin).not.toBeNull();
    expect(admin?.login).toBe('admin');
    expect(admin?.firstName).toBeNull();
    expect(admin?.lastName).toBeNull();
    expect(admin?.email).toBeNull();
    expect(admin?.language).toBe('en');
    expect(admin?.timezone).toBe('Europe/Paris');
    expect(await argon2.verify(admin!.password, 'pass')).toBe(true);
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
        `SELECT login, password, first_name as firstName, last_name as lastName, email, language, timezone FROM users WHERE login = ?;`
      )
      .get('admin') as {
      login: string;
      password: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      language: string;
      timezone: string;
    } | null;
    database.close();

    expect(userCount?.count).toBe(1);
    expect(admin).not.toBeNull();
    expect(await argon2.verify(admin!.password, 'pass')).toBe(true);
    expect(admin?.language).toBe('en');
    expect(admin?.timezone).toBe('Europe/Paris');
  });
});

describe('generateRandomId', () => {
  it('generates random ID with default size', () => {
    const id = generateRandomId();
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[0-9a-zA-Z]{16}$/);
  });

  it('generates random ID with custom size', () => {
    const id = generateRandomId(6);
    expect(id).toHaveLength(6);
    expect(id).toMatch(/^[0-9a-zA-Z]{6}$/);
  });
});
