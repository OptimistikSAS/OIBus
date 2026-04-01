import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import UserRepository from './user.repository';
import { createPageFromArray } from '../../../shared/model/types';
import { UserCommandDTO } from '../../../shared/model/user.model';
import argon2 from 'argon2';

jest.mock('../../service/utils');
jest.mock('argon2');

const TEST_DB_PATH = 'src/tests/test-config-user.db';

let database: Database;
describe('UserRepository', () => {
  beforeAll(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: UserRepository;
  beforeEach(() => {
    jest.resetAllMocks();
    (argon2.hash as jest.Mock).mockImplementation(password => password);
    repository = new UserRepository(database);
  });

  it('should properly find all certificates', () => {
    expect(repository.list()).toEqual(testData.users.list);
  });

  it('should search users', () => {
    expect(
      repository.search({
        login: 'second',
        page: 0
      })
    ).toEqual(createPageFromArray([testData.users.list[1]], 50, 0));

    expect(
      repository.search({
        login: '',
        page: 0
      }).totalElements
    ).toEqual(2);
  });

  it('should search users without page', () => {
    expect(
      repository.search({
        login: 'second',
        page: 0
      })
    ).toEqual(createPageFromArray([testData.users.list[1]], 50, 0));

    expect(
      repository.search({
        login: '',
        page: 0
      }).totalElements
    ).toEqual(2);
  });

  it('should properly find a user by its ID', () => {
    expect(repository.findById(testData.users.list[0].id)).toEqual(testData.users.list[0]);
    expect(repository.findById('bad id')).toEqual(null);
  });

  it('should properly find a user by its login', () => {
    expect(repository.findByLogin(testData.users.list[0].login)).toEqual(testData.users.list[0]);
    expect(repository.findByLogin('bad login')).toEqual(null);
  });

  it('should properly get hashed password by a user login', () => {
    expect(repository.getHashedPasswordByLogin(testData.users.list[0].login)).toEqual('password'); // default password populated in tests
    expect(repository.getHashedPasswordByLogin('bad login')).toEqual(null);
  });

  it('should create a user', async () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newId');

    const result = await repository.create(testData.users.command, 'password', testData.users.list[0].id);

    expect(argon2.hash).toHaveBeenCalledWith('password');
    expect(stripAuditFields(result)).toEqual(stripAuditFields({ ...testData.users.command, id: 'newId' }));
  });

  it('should update a user', async () => {
    const newCommand: UserCommandDTO = JSON.parse(JSON.stringify(testData.users.command));
    newCommand.login = 'new login';
    newCommand.timezone = 'UTC';
    repository.update('newId', newCommand);
    const result = repository.findById('newId')!;
    expect(result.login).toEqual(newCommand.login);
    expect(result.timezone).toEqual(newCommand.timezone);

    await repository.updatePassword('newId', 'new password');

    expect(argon2.hash).toHaveBeenCalledWith('new password');

    const newPassword = repository.getHashedPasswordByLogin(newCommand.login)!;
    expect(newPassword).toEqual('new password');
  });

  it('should delete a user', () => {
    repository.delete(testData.users.list[1].id);
    expect(repository.findById(testData.users.list[1].id)).toEqual(null);
  });
});
