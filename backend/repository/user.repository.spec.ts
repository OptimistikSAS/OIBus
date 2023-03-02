import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import argon2 from 'argon2';

import { generateRandomId } from '../service/utils';
import { User, UserCommandDTO, UserLight } from '../../shared/model/user.model';
import { Page } from '../../shared/model/types';
import { Database } from 'better-sqlite3';
import UserRepository from './user.repository';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));
jest.mock('argon2', () => ({
  hash: jest.fn((pass: string) => pass),
  verify: jest.fn(() => true)
}));

let database: Database;
let repository: UserRepository;
describe('User repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    get.mockReturnValue({
      login: 'admin',
      firstName: '',
      lastName: '',
      email: '',
      language: 'en',
      timezone: 'Europe/Paris'
    });

    repository = new UserRepository(database);
  });

  it('should properly init user table', async () => {
    expect(database.prepare).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, login TEXT UNIQUE, password TEXT, first_name TEXT, last_name TEXT, email TEXT, language TEXT, timezone TEXT);'
    );
    // Once for creation of the table
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should properly search users', () => {
    const expectedValue: Page<UserLight> = {
      content: [
        {
          id: 'id1',
          login: 'user1',
          friendlyName: 'John Doe'
        },
        {
          id: 'id2',
          login: 'user2',
          friendlyName: 'Jane Doe'
        }
      ],
      size: 50,
      number: 2,
      totalElements: 2,
      totalPages: 1
    };

    all.mockReturnValueOnce([
      {
        id: 'id1',
        login: 'user1',
        firstName: 'John',
        lastName: 'Doe'
      },
      {
        id: 'id2',
        login: 'user2',
        firstName: 'Jane',
        lastName: 'Doe'
      }
    ]);
    get.mockReturnValueOnce({ count: 2 });

    const users = repository.searchUsers({ login: 'user', page: 2 });
    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT id, login, first_name as firstName, last_name as lastName FROM user WHERE login like '%user%' LIMIT 50 OFFSET 100;"
    );
    expect(users).toEqual(expectedValue);
  });

  it('should properly get a user based on a specific ID', () => {
    const expectedValue: User = {
      id: 'id1',
      login: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      timezone: 'Etc/UTC',
      email: 'john.doe@optimistik.com',
      language: 'EN',
      friendlyName: 'John Doe'
    };
    get.mockReturnValueOnce({
      id: 'id1',
      login: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      timezone: 'Etc/UTC',
      email: 'john.doe@optimistik.com',
      language: 'EN'
    });
    const user = repository.getUserById('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, login, first_name as firstName, last_name as lastName, email, language, timezone FROM user WHERE id = ?;'
    );
    expect(get).toHaveBeenCalledWith('id1');
    expect(user).toEqual(expectedValue);
  });

  it('should properly get a user based on a specific login', () => {
    const expectedValue: User = {
      id: 'id1',
      login: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      timezone: 'Etc/UTC',
      email: 'john.doe@optimistik.com',
      language: 'EN',
      friendlyName: 'John Doe'
    };
    get.mockReturnValueOnce({
      id: 'id1',
      login: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      timezone: 'Etc/UTC',
      email: 'john.doe@optimistik.com',
      language: 'EN'
    });
    const user = repository.getUserByLogin('user1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, login, first_name as firstName, last_name as lastName, email, language, timezone FROM user WHERE login = ?;'
    );
    expect(get).toHaveBeenCalledWith('user1');
    expect(user).toEqual(expectedValue);
  });

  it('should create a user', async () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce({});

    const command: UserCommandDTO = {
      login: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      timezone: 'Etc/UTC',
      email: 'john.doe@optimistik.com',
      language: 'EN'
    };
    await repository.createUser(command, 'pass');
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      'INSERT INTO user (id, login, password, first_name, last_name, email, language, timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?);'
    );
    expect(run).toHaveBeenCalledWith(
      '123456',
      command.login,
      'pass',
      command.firstName,
      command.lastName,
      command.email,
      command.language,
      command.timezone
    );
    expect(get).toHaveBeenCalledWith(1);

    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, login, first_name as firstName, last_name as lastName, email, language, timezone FROM user WHERE ROWID = ?;'
    );
  });

  it('should update password', async () => {
    await repository.updatePassword('id1', 'password');
    expect(argon2.hash).toHaveBeenCalledWith('password');
    expect(run).toHaveBeenCalledWith('password', 'id1');
  });

  it('should delete a user', () => {
    repository.deleteUser('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM user WHERE id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });

  it('should return null when user by login is not found', () => {
    get.mockReturnValueOnce(null);
    const hashedPassword = repository.getHashedPasswordByLogin('user1');
    expect(database.prepare).toHaveBeenCalledWith('SELECT password FROM user WHERE login = ?;');

    expect(hashedPassword).toBeNull();
  });

  it('should return hashed password when user by login is found', () => {
    get.mockReturnValueOnce({ password: 'hashedPassword' });
    const hashedPassword = repository.getHashedPasswordByLogin('user1');
    expect(database.prepare).toHaveBeenCalledWith('SELECT password FROM user WHERE login = ?;');

    expect(hashedPassword).toEqual('hashedPassword');
  });

  it('should update a user', () => {
    get
      .mockReturnValueOnce({
        id: 'id1',
        login: 'user1',
        password: 'originalPassword',
        firstName: 'John',
        lastName: 'Doe',
        timezone: 'Etc/UTC',
        email: 'john.doe@optimistik.com',
        language: 'EN'
      })
      .mockReturnValue(null);

    const command: UserCommandDTO = {
      login: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      timezone: 'Etc/UTC',
      email: 'john.doe@optimistik.com',
      language: 'EN'
    };
    repository.updateUser('id1', command);
    expect(database.prepare).toHaveBeenCalledWith(
      'UPDATE user SET login = ?, first_name = ?, last_name = ?, email = ?, language = ?, timezone = ? WHERE id = ?;'
    );
    expect(run).toHaveBeenCalledWith(
      command.login,
      command.firstName,
      command.lastName,
      command.email,
      command.language,
      command.timezone,
      'id1'
    );
  });

  it('should log error if create default user fail', async () => {
    get.mockReturnValue(null);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    (argon2.hash as jest.Mock).mockImplementationOnce(() => {
      throw new Error('create user error');
    });
    await repository.createDefaultUser();
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(new Error('create user error'));
  });
});
