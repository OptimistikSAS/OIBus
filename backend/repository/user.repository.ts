import bcrypt from 'bcrypt';
import { Database } from 'better-sqlite3';

import { generateRandomId, SALT } from './utils';
import { User, UserCommandDTO, UserLight, UserSearchParam } from '../../shared/model/user.model';
import { Page } from '../../shared/model/types';

const USER_TABLE = 'user';
const PAGE_SIZE = 50;

const DEFAULT_USER: UserCommandDTO = {
  login: 'admin',
  password: 'pass',
  firstName: '',
  lastName: '',
  email: '',
  language: 'en',
  timezone: 'Europe/Paris'
};

/**
 * Repository used for Users
 */
export default class UserRepository {
  private readonly database: Database;
  constructor(database: Database) {
    this.database = database;
    const query = `CREATE TABLE IF NOT EXISTS ${USER_TABLE} (id TEXT PRIMARY KEY, login TEXT UNIQUE, password TEXT, first_name TEXT, last_name TEXT, email TEXT, language TEXT, timezone TEXT);`;
    this.database.prepare(query).run();
    this.createDefaultUser();
  }

  /**
   * Retrieve users based on search params
   */
  searchUsers(searchParams: UserSearchParam): Page<UserLight> {
    const queryParams = [];
    let whereClause = '';

    if (searchParams.login) {
      whereClause += `WHERE login like '%${searchParams.login}%'`;
      queryParams.push(searchParams.login);
    }
    const query =
      `SELECT id, login, first_name as firstName, last_name as lastName FROM ${USER_TABLE} ${whereClause}` +
      ` LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * searchParams.page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => ({
        id: result.id,
        login: result.login,
        friendlyName: `${result.firstName} ${result.lastName}`
      }));
    const totalElements = this.database.prepare(`SELECT COUNT(*) as count FROM ${USER_TABLE} ${whereClause}`).get().count;
    const totalPages = Math.ceil(totalElements / PAGE_SIZE);

    return {
      content: results,
      size: PAGE_SIZE,
      number: searchParams.page,
      totalElements,
      totalPages
    };
  }

  /**
   * Retrieve a user by its id
   */
  getUser(id: string): User {
    const query = `SELECT id, login, first_name as firstName, last_name as lastName, email, language, timezone FROM ${USER_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return {
      id: result.id,
      login: result.login,
      firstName: result.firstName,
      lastName: result.lastName,
      email: result.email,
      language: result.language,
      timezone: result.timezone,
      friendlyName: `${result.firstName} ${result.lastName}`
    };
  }

  /**
   * Retrieve a user by the login to authenticate the user in middleware
   */
  getUserByLogin(login: string): User | null {
    const query = `SELECT id, login, password, first_name as firstName, last_name as lastName, email, language, timezone FROM ${USER_TABLE} WHERE login = ?;`;
    const result = this.database.prepare(query).get(login);
    if (!result) {
      return null;
    }

    return {
      id: result.id,
      login: result.login,
      password: result.password,
      firstName: result.firstName,
      lastName: result.lastName,
      email: result.email,
      language: result.language,
      timezone: result.timezone,
      friendlyName: `${result.firstName} ${result.lastName}`
    };
  }

  /**
   * Create a User with a random generated ID
   */
  async createUser(command: UserCommandDTO): Promise<User> {
    const id = generateRandomId(6);
    const insertQuery =
      `INSERT INTO ${USER_TABLE} (id, login, password, first_name, last_name, email, language, timezone) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;

    const password = await bcrypt.hash(command.password!, SALT);
    const insertResult = this.database
      .prepare(insertQuery)
      .run(id, command.login, password, command.firstName, command.lastName, command.email, command.language, command.timezone);

    const query = `SELECT id, login, first_name as firstName, last_name as lastName, email, language, timezone FROM ${USER_TABLE} WHERE ROWID = ?;`;
    const result = this.database.prepare(query).get(insertResult.lastInsertRowid);
    return {
      id: result.id,
      login: result.login,
      firstName: result.firstName,
      lastName: result.lastName,
      email: result.email,
      language: result.language,
      timezone: result.timezone,
      friendlyName: `${result.firstName} ${result.lastName}`
    };
  }

  /**
   * Update a User by its ID
   */
  async updateUser(id: string, command: UserCommandDTO): Promise<void> {
    const queryUser = `SELECT password FROM ${USER_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(queryUser).get(id);

    let password = '';
    if (command.password) {
      password = await bcrypt.hash(command.password, SALT);
    } else {
      password = result.password;
    }
    const queryUpdate = `UPDATE ${USER_TABLE} SET login = ?, password = ?, first_name = ?, last_name = ?, email = ?, language = ?, timezone = ? WHERE id = ?;`;
    this.database
      .prepare(queryUpdate)
      .run(command.login, password, command.firstName, command.lastName, command.email, command.language, command.timezone, id);
  }

  /**
   * Delete a User by its ID
   */
  deleteUser(id: string): void {
    const query = `DELETE FROM ${USER_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  createDefaultUser(): void {
    if (this.getUserByLogin(DEFAULT_USER.login)) {
      return;
    }

    this.createUser(DEFAULT_USER).catch(err => {
      console.error(err);
    });
  }
}
