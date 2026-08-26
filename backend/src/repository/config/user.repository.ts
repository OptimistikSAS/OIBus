import argon2 from 'argon2';
import { Database } from 'better-sqlite3';

import { generateRandomId } from '../../service/utils';
import { Language, Page } from '../../../shared/model/types';
import { User } from '../../model/user.model';
import { UserCommandDTO, UserSearchParam } from '../../../shared/model/user.model';
import AuditService from '../../service/audit.service';

const USERS_TABLE = 'users';
const PAGE_SIZE = 50;

const DEFAULT_USER: Omit<User, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'> = {
  login: 'admin',
  firstName: null,
  lastName: null,
  email: null,
  language: 'en',
  timezone: 'Europe/Paris'
};
const DEFAULT_PASSWORD = 'pass';

export default class UserRepository {
  constructor(
    private readonly database: Database,
    private readonly auditService: AuditService,
    defaultLogin = DEFAULT_USER.login,
    defaultPassword = DEFAULT_PASSWORD
  ) {
    this.createDefault(defaultLogin, defaultPassword);
  }

  list(): Array<User> {
    const query = `SELECT id, login, first_name, last_name, email, language, timezone, created_by, updated_by, created_at, updated_at FROM ${USERS_TABLE}`;
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
      `SELECT id, login, first_name, last_name, email, language, timezone, created_by, updated_by, created_at, updated_at FROM ${USERS_TABLE} ${whereClause}` +
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
    const query = `SELECT id, login, first_name, last_name, email, language, timezone, created_by, updated_by, created_at, updated_at FROM ${USERS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;
    return this.toUser(result as Record<string, string>);
  }

  findByLogin(login: string): User | null {
    const query = `SELECT id, login, first_name, last_name, email, language, timezone, created_by, updated_by, created_at, updated_at FROM ${USERS_TABLE} WHERE login = ?;`;
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

  /**
   * Creates a user. `id` may be supplied to preserve a specific id for the new row (used by config
   * import, which recreates users under their originally exported id) instead of always minting a
   * fresh one.
   */
  async create(
    command: Omit<User, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>,
    password: string,
    createdBy: string,
    id = generateRandomId(6)
  ): Promise<User> {
    const hash = await argon2.hash(password);
    return this.createWithHashedPassword(command, hash, createdBy, id);
  }

  /**
   * Same as `create`, but takes an already-hashed password instead of hashing one itself. Used by
   * config import: hashing must happen before the enclosing wipe+recreate transaction starts,
   * because `better-sqlite3` transactions run their callback synchronously and cannot `await` the
   * asynchronous `argon2.hash` call in the middle of it.
   */
  createWithHashedPassword(
    command: Omit<User, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>,
    hashedPassword: string,
    createdBy: string,
    id = generateRandomId(6)
  ): User {
    const insertQuery =
      `INSERT INTO ${USERS_TABLE} (id, login, password, first_name, last_name, email, language, timezone, created_by, updated_by, created_at, updated_at) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;

    const insertResult = this.database
      .prepare(insertQuery)
      .run(
        id,
        command.login,
        hashedPassword,
        command.firstName,
        command.lastName,
        command.email,
        command.language,
        command.timezone,
        createdBy,
        createdBy
      );

    const query = `SELECT id, login, first_name, last_name, email, language, timezone, created_by, updated_by, created_at, updated_at FROM ${USERS_TABLE} WHERE ROWID = ?;`;
    const result = this.toUser(this.database.prepare(query).get(insertResult.lastInsertRowid) as Record<string, string>);
    this.auditService.record('user', result.id, 'CREATE', null, this.toAuditableUser(result), createdBy);
    return result;
  }

  async updatePassword(id: string, password: string): Promise<void> {
    const hash = await argon2.hash(password);

    const queryUpdate = `UPDATE ${USERS_TABLE} SET password = ? WHERE id = ?;`;
    this.database.prepare(queryUpdate).run(hash, id);
  }

  update(id: string, command: UserCommandDTO, updatedBy: string): void {
    const before = this.findById(id);
    const queryUpdate = `UPDATE ${USERS_TABLE} SET login = ?, first_name = ?, last_name = ?, email = ?, language = ?, timezone = ? WHERE id = ?;`;
    this.database
      .prepare(queryUpdate)
      .run(command.login, command.firstName, command.lastName, command.email, command.language, command.timezone, id);
    const after = this.findById(id);
    this.auditService.record(
      'user',
      id,
      'UPDATE',
      before ? this.toAuditableUser(before) : null,
      after ? this.toAuditableUser(after) : null,
      updatedBy
    );
  }

  delete(id: string, deletedBy: string): void {
    const before = this.findById(id);
    const query = `DELETE FROM ${USERS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
    if (before) {
      this.auditService.record('user', id, 'DELETE', this.toAuditableUser(before), null, deletedBy);
    }
  }

  protected createDefault(login: string, password: string): void {
    const query = `SELECT id FROM ${USERS_TABLE} WHERE login = ?;`;
    const result = this.database.prepare(query).get(login);
    if (result) {
      return;
    }

    this.create({ ...DEFAULT_USER, login }, password, 'system').catch(err => {
      console.error(err.message);
    });
  }

  /**
   * Returns the User object as-is for the audit trail. The password hash is never included here since
   * `User`/`toUser()` never select or expose the `password` column in the first place.
   */
  private toAuditableUser(user: User): Record<string, unknown> {
    return user as unknown as Record<string, unknown>;
  }

  private toUser(result: Record<string, string>): User {
    return {
      id: result.id,
      createdBy: result.created_by,
      updatedBy: result.updated_by,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      login: result.login,
      firstName: result.first_name || null,
      lastName: result.last_name || null,
      email: result.email || null,
      language: result.language as Language,
      timezone: result.timezone
    };
  }
}
