import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import UserRepository from './user.repository';
import { createPageFromArray } from '../../../shared/model/types';
import { UserCommandDTO } from '../../../shared/model/user.model';
import argon2 from 'argon2';

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
  let createdId: string;

  beforeEach(() => {
    mock.method(argon2, 'hash', async (password: string) => password);
    repository = new UserRepository(database);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should properly find all certificates', () => {
    assert.deepStrictEqual(repository.list(), testData.users.list);
  });

  it('should search users', () => {
    assert.deepStrictEqual(
      repository.search({ login: 'second', page: 0 }),
      createPageFromArray([testData.users.list[1]], 50, 0)
    );
    assert.strictEqual(repository.search({ login: '', page: 0 }).totalElements, 2);
  });

  it('should search users without page', () => {
    assert.deepStrictEqual(
      repository.search({ login: 'second', page: 0 }),
      createPageFromArray([testData.users.list[1]], 50, 0)
    );
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
  });

  it('should update a user', async () => {
    const newCommand: UserCommandDTO = JSON.parse(JSON.stringify(testData.users.command));
    newCommand.login = 'new login';
    newCommand.timezone = 'UTC';
    repository.update(createdId, newCommand);
    const result = repository.findById(createdId)!;
    assert.strictEqual(result.login, newCommand.login);
    assert.strictEqual(result.timezone, newCommand.timezone);

    await repository.updatePassword(createdId, 'new password');

    const newPassword = repository.getHashedPasswordByLogin(newCommand.login)!;
    assert.strictEqual(newPassword, 'new password');
  });

  it('should delete a user', () => {
    repository.delete(testData.users.list[1].id);
    assert.strictEqual(repository.findById(testData.users.list[1].id), null);
  });
});
