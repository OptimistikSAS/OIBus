import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import argon2 from 'argon2';
import { Database } from 'better-sqlite3';

import { UserCommandDTO } from '../../../shared/model/api/user.model';
import { createPageFromArray } from '../../../shared/model/common/types';

import AuditService from '../../service/audit.service';
import { emptyDatabase, initDatabase } from '../../tests/utils/database-utils';
import testData from '../../tests/utils/test-data';
import { createAuditServiceMock, flushPromises, Mocked, stripAuditFields } from '../../tests/utils/test-utils';
import UserRepository from './user.repository';

const TEST_DB_PATH = 'src/tests/test-config-user.db';

let database: Database;
describe('UserRepository', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: UserRepository;
  let auditService: Mocked<AuditService>;
  let createdId: string;

  beforeEach(() => {
    mock.method(argon2, 'hash', async (password: string) => password);
    auditService = createAuditServiceMock();
    repository = new UserRepository(database, auditService);
  });

  /** The arguments of every audit record made in the test. */
  const recorded = () => auditService.record.mock.calls.map(call => call.arguments);

  afterEach(() => {
    mock.restoreAll();
  });

  it('should properly list all users', () => {
    assert.deepStrictEqual(repository.list(), testData.users.list);
  });

  it('should search users', () => {
    assert.deepStrictEqual(repository.search({ login: 'second', page: 0 }), createPageFromArray([testData.users.list[1]], 50, 0));
    assert.strictEqual(repository.search({ login: '', page: 0 }).totalElements, 2);
  });

  it('should properly find a user by its ID', () => {
    assert.deepStrictEqual(repository.findById(testData.users.list[0].id), testData.users.list[0]);
    assert.strictEqual(repository.findById('bad id'), null);
  });

  it('should properly find a user by its login', () => {
    assert.deepStrictEqual(repository.findByLogin(testData.users.list[0].login), testData.users.list[0]);
    assert.strictEqual(repository.findByLogin('bad login'), null);
  });

  it('should properly get hashed password by a user login', () => {
    assert.strictEqual(repository.getHashedPasswordByLogin(testData.users.list[0].login), 'password');
    assert.strictEqual(repository.getHashedPasswordByLogin('bad login'), null);
  });

  it('should create a user', async () => {
    const result = await repository.create(testData.users.command, 'password', testData.users.list[0].id);
    createdId = result.id;
    assert.ok(createdId);
    assert.deepStrictEqual(stripAuditFields(result), stripAuditFields({ ...testData.users.command, id: createdId }));

    assert.deepStrictEqual(recorded(), [['user', result.id, 'CREATE', null, result, testData.users.list[0].id]]);
  });

  it('should preserve a caller-supplied id when creating a user (config import)', async () => {
    const importedCommand: UserCommandDTO = { ...testData.users.command, login: 'imported-login' };
    const result = await repository.create(importedCommand, 'password', 'importUser', 'preserved-user-id');
    assert.strictEqual(result.id, 'preserved-user-id');
    assert.deepStrictEqual(repository.findById('preserved-user-id'), result);
  });

  it('should create a user with an already-hashed password (config import)', async () => {
    const importedCommand: UserCommandDTO = { ...testData.users.command, login: 'imported-login-2' };
    const result = repository.createWithHashedPassword(importedCommand, 'already-hashed-value', 'importUser', 'preserved-user-id-2');
    assert.strictEqual(result.id, 'preserved-user-id-2');
    assert.strictEqual(repository.getHashedPasswordByLogin('imported-login-2'), 'already-hashed-value');
  });

  it('should update a user', async () => {
    const newCommand: UserCommandDTO = { ...testData.users.command, login: 'new login', timezone: 'UTC' };
    const before = repository.findById(createdId);
    repository.update(createdId, newCommand, 'updaterUser');
    const result = repository.findById(createdId)!;
    assert.strictEqual(result.login, newCommand.login);
    assert.strictEqual(result.timezone, newCommand.timezone);

    assert.deepStrictEqual(recorded(), [['user', createdId, 'UPDATE', before, result, 'updaterUser']]);

    await repository.updatePassword(createdId, 'new password', 'updaterUser');

    const newPassword = repository.getHashedPasswordByLogin(newCommand.login)!;
    assert.strictEqual(newPassword, 'new password');

    // The password change is audited without ever recording the password hash
    assert.strictEqual(recorded().length, 2);
    assert.deepStrictEqual(recorded()[1], [
      'user',
      createdId,
      'UPDATE',
      { ...result, password: '' },
      { ...result, password: '<changed>' },
      'updaterUser'
    ]);
  });

  it('should delete a user', () => {
    const before = repository.findById(testData.users.list[1].id);
    repository.delete(testData.users.list[1].id, 'deleterUser');
    assert.strictEqual(repository.findById(testData.users.list[1].id), null);

    assert.deepStrictEqual(recorded(), [['user', testData.users.list[1].id, 'DELETE', before, null, 'deleterUser']]);
  });
});

describe('UserRepository with custom default credentials', () => {
  const CUSTOM_DB_PATH = 'src/tests/test-config-user-custom.db';
  let db: Database;

  before(async () => {
    db = await initDatabase('config', false, CUSTOM_DB_PATH);
  });

  after(async () => {
    db.close();
    await emptyDatabase('config', CUSTOM_DB_PATH);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should create a default user with custom login and password', async () => {
    mock.method(argon2, 'hash', async (password: string) => password);

    const repository = new UserRepository(db, createAuditServiceMock(), 'customuser', 'custompass');
    await flushPromises();

    const users = repository.list();
    assert.strictEqual(users.length, 1);
    assert.strictEqual(users[0].login, 'customuser');
    assert.strictEqual(repository.getHashedPasswordByLogin('customuser'), 'custompass');
  });

  it('should not recreate the user when the same login already exists', async () => {
    mock.method(argon2, 'hash', async (password: string) => password);

    new UserRepository(db, createAuditServiceMock(), 'customuser', 'anotherpass');
    await flushPromises();

    // Still only one user; createDefault is a no-op when the same login is already present
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    assert.strictEqual(row.count, 1);
  });
});

describe('UserRepository with empty database', () => {
  const EMPTY_DB_PATH = 'src/tests/test-config-user-empty.db';
  let db: Database;

  before(async () => {
    db = await initDatabase('config', false, EMPTY_DB_PATH);
  });

  after(async () => {
    db.close();
    await emptyDatabase('config', EMPTY_DB_PATH);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should not create a default admin user on hash error', async () => {
    mock.method(argon2, 'hash', () => {
      throw new Error('hash error');
    });
    const consoleErrorMock = mock.method(console, 'error', () => null);

    const repository = new UserRepository(db, createAuditServiceMock());

    await flushPromises();
    assert.strictEqual(repository.list().length, 0);
    assert.strictEqual(consoleErrorMock.mock.calls.length, 1);
    assert.deepStrictEqual(consoleErrorMock.mock.calls[0].arguments, ['hash error']);
  });

  it('should create a default admin user', async () => {
    mock.method(argon2, 'hash', async (password: string) => password);

    const repository = new UserRepository(db, createAuditServiceMock());

    await flushPromises();

    const users = repository.list();
    assert.strictEqual(users.length, 1);
    const user = users[0];
    assert.strictEqual(user.login, 'admin');
    assert.strictEqual(user.language, 'en');
    assert.strictEqual(user.timezone, 'Europe/Paris');
    assert.strictEqual(repository.getHashedPasswordByLogin('admin'), 'pass');
  });
});
