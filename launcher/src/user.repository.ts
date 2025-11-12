import argon2 from 'argon2';
import DatabaseConstructor, { Database } from 'better-sqlite3';

type NullableString = string | null;

const USERS_TABLE = 'users';

const DEFAULT_USER: {
  login: string;
  firstName: NullableString;
  lastName: NullableString;
  email: NullableString;
  language: string;
  timezone: string;
} = {
  login: 'admin',
  firstName: null,
  lastName: null,
  email: null,
  language: 'en',
  timezone: 'Europe/Paris'
};

const DEFAULT_PASSWORD = 'pass';
const RANDOM_ID_CHARACTERS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const generateRandomId = (size = 16): string => {
  let randomId = '';
  for (let i = 0; i < size; i += 1) {
    randomId += RANDOM_ID_CHARACTERS[Math.floor(Math.random() * RANDOM_ID_CHARACTERS.length)];
  }
  return randomId;
};

interface UserRow {
  id: string;
}

export default class UserRepository {
  constructor(private readonly databasePath: string) {}

  async resetAdmin(): Promise<void> {
    const database = this.createDatabase();
    try {
      const admin = this.findByLogin(database, DEFAULT_USER.login);
      const passwordHash = await argon2.hash(DEFAULT_PASSWORD);

      if (admin) {
        this.update(database, admin.id, DEFAULT_USER, passwordHash);
      } else {
        this.create(database, DEFAULT_USER, passwordHash);
      }
    } finally {
      database.close();
    }
  }

  private createDatabase(): Database {
    return new DatabaseConstructor(this.databasePath, { fileMustExist: true });
  }

  private findByLogin(database: Database, login: string): UserRow | undefined {
    const query = `SELECT id FROM ${USERS_TABLE} WHERE login = ?;`;
    const result = database.prepare(query).get(login) as UserRow | undefined;
    return result ?? undefined;
  }

  private update(database: Database, id: string, user: typeof DEFAULT_USER, passwordHash: string): void {
    const updateQuery = `UPDATE ${USERS_TABLE}
      SET login = ?, password = ?, first_name = ?, last_name = ?, email = ?, language = ?, timezone = ?
      WHERE id = ?;`;
    database
      .prepare(updateQuery)
      .run(user.login, passwordHash, user.firstName, user.lastName, user.email, user.language, user.timezone, id);
  }

  private create(database: Database, user: typeof DEFAULT_USER, passwordHash: string): void {
    const insertQuery = `INSERT INTO ${USERS_TABLE} (id, login, password, first_name, last_name, email, language, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
    database
      .prepare(insertQuery)
      .run(generateRandomId(6), user.login, passwordHash, user.firstName, user.lastName, user.email, user.language, user.timezone);
  }
}
