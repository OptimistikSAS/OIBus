import argon2 from 'argon2';
import { Database } from 'better-sqlite3';

import { generateRandomId } from '../../service/utils';
import { Page } from '../../../../shared/model/types';
import { User } from '../../model/user.model';
import { UserSearchParam } from '../../../../shared/model/user.model';

const USERS_TABLE = 'users';
const PAGE_SIZE = 50;

const DEFAULT_USER: Omit<User, 'id'> = {
  login: 'admin',
  firstName: null,
  lastName: null,
  email: null,
  language: 'en',
  timezone: 'Europe/Paris'
};
const DEFAULT_PASSWORD = 'pass';

/**
 * Repository used for Users
 */
export default class UserRepository {
  constructor(private readonly database: Database) {
    this.createDefault();
  }

  findAll(): Array<User> {
    const query = `SELECT id, login, first_name, last_name, email, language, timezone FROM ${USERS_TABLE}`;
    return this.database
      .prepare(query)
      .all()
      .map(result => this.toUser(result as Record<string, string>));
  }

  search(searchParams: UserSearchParam): Page<User> {
    const queryParams = [];
    let whereClause = '';

    if (searchParams.login) {
      whereClause += `WHERE login like '%' || ? || '%'`;
      queryParams.push(searchParams.login);
    }
    const query =
      `SELECT id, login, first_name, last_name, email, language, timezone FROM ${USERS_TABLE} ${whereClause}` +
      ` LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * searchParams.page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toUser(result as Record<string, string>));
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${USERS_TABLE} ${whereClause}`).get(...queryParams) as { count: number }
    ).count;
    const totalPages = Math.ceil(totalElements / PAGE_SIZE);

    return {
      content: results,
      size: PAGE_SIZE,
      number: searchParams.page,
      totalElements,
      totalPages
    };
  }

  findById(id: string): User | null {
    const query = `SELECT id, login, first_name, last_name, email, language, timezone FROM ${USERS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;
    return this.toUser(result as Record<string, string>);
  }

  findByLogin(login: string): User | null {
    const query = `SELECT id, login, first_name, last_name, email, language, timezone FROM ${USERS_TABLE} WHERE login = ?;`;
    const result = this.database.prepare(query).get(login);
    if (!result) return null;
    return this.toUser(result as Record<string, string>);
  }

  getHashedPasswordByLogin(login: string): string | null {
    const query = `SELECT password FROM ${USERS_TABLE} WHERE login = ?;`;
    const result: { password: string } | null = this.database.prepare(query).get(login) as { password: string } | null;
    if (!result) {
      return null;
    }
    return result.password;
  }

  async create(command: Omit<User, 'id'>, password: string): Promise<User> {
    const id = generateRandomId(6);
    const insertQuery =
      `INSERT INTO ${USERS_TABLE} (id, login, password, first_name, last_name, email, language, timezone) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;

    const hash = await argon2.hash(password);
    const insertResult = this.database
      .prepare(insertQuery)
      .run(id, command.login, hash, command.firstName, command.lastName, command.email, command.language, command.timezone);

    const query = `SELECT id, login, first_name, last_name, email, language, timezone FROM ${USERS_TABLE} WHERE ROWID = ?;`;
    return this.toUser(this.database.prepare(query).get(insertResult.lastInsertRowid) as Record<string, string>);
  }

  async updatePassword(id: string, password: string): Promise<void> {
    const hash = await argon2.hash(password);

    const queryUpdate = `UPDATE ${USERS_TABLE} SET password = ? WHERE id = ?;`;
    this.database.prepare(queryUpdate).run(hash, id);
  }

  update(id: string, command: Omit<User, 'id'>): void {
    const queryUpdate = `UPDATE ${USERS_TABLE} SET login = ?, first_name = ?, last_name = ?, email = ?, language = ?, timezone = ? WHERE id = ?;`;
    this.database
      .prepare(queryUpdate)
      .run(command.login, command.firstName, command.lastName, command.email, command.language, command.timezone, id);
  }

  delete(id: string): void {
    const query = `DELETE FROM ${USERS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  private createDefault(): void {
    const query = `SELECT id FROM ${USERS_TABLE} WHERE login = ?;`;
    const result = this.database.prepare(query).get(DEFAULT_USER.login);
    if (result) {
      return;
    }

    this.create(DEFAULT_USER, DEFAULT_PASSWORD).catch(err => {
      console.error(err.message);
    });
  }

  private toUser(result: Record<string, string>): User {
    return {
      id: result.id,
      login: result.login,
      firstName: result.first_name || null,
      lastName: result.last_name || null,
      email: result.email || null,
      language: result.language,
      timezone: result.timezone
    };
  }
}
