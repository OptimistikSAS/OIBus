import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import argon2 from 'argon2';

import { createPageFromArray } from '../../shared/model/common/types';

import type { User } from '../model/user.model';
import type UserRepository from '../repository/config/user.repository';
import testData from '../tests/utils/test-data';
import { createMock, type Mocked } from '../tests/utils/test-utils';
import type JoiValidator from '../web-server/controllers/validators/joi.validator';
import { changePasswordSchema, userPasswordSchema, userSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import UserService, { toUserDTO } from './user.service';

const getUserInfo = (id: string) => ({ id, friendlyName: 'test' });

const expectedUserDTO = (user: User, friendlyName: string) => ({
  id: user.id,
  login: user.login,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  language: user.language,
  timezone: user.timezone,
  friendlyName,
  createdBy: getUserInfo(user.createdBy),
  updatedBy: getUserInfo(user.updatedBy),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  mustChangePassword: user.mustChangePassword
});

const changePasswordCommand = { currentPassword: 'current password', newPassword: 'new password' };

describe('User Service', () => {
  let validator: Mocked<JoiValidator>;
  let userRepository: Mocked<UserRepository>;
  let service: UserService;

  beforeEach(() => {
    validator = createMock<JoiValidator>();
    userRepository = createMock<UserRepository>();
    service = new UserService(validator, userRepository);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should list all users', () => {
    userRepository.list.mock.mockImplementationOnce(() => testData.users.list);

    const result = service.list();

    assert.strictEqual(userRepository.list.mock.calls.length, 1);
    assert.deepStrictEqual(result, testData.users.list);
  });

  it('should find a user by id', () => {
    userRepository.findById.mock.mockImplementationOnce(() => testData.users.list[0]);

    const result = service.findById(testData.users.list[0].id);

    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.deepStrictEqual(result, testData.users.list[0]);
  });

  it('should not get if the user is not found by id', () => {
    userRepository.findById.mock.mockImplementationOnce(() => null);

    assert.throws(() => service.findById(testData.users.list[0].id), {
      message: `User "${testData.users.list[0].id}" (id) not found`
    });
    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
  });

  it('should find a user by login', () => {
    userRepository.findByLogin.mock.mockImplementationOnce(() => testData.users.list[0]);

    const result = service.findByLogin(testData.users.list[0].login);

    assert.deepStrictEqual(userRepository.findByLogin.mock.calls[0].arguments, [testData.users.list[0].login]);
    assert.deepStrictEqual(result, testData.users.list[0]);
  });

  it('should not get if the user is not found by login', () => {
    userRepository.findByLogin.mock.mockImplementationOnce(() => null);

    assert.throws(() => service.findByLogin(testData.users.list[0].login), {
      message: `User "${testData.users.list[0].login}" (login) not found`
    });
    assert.deepStrictEqual(userRepository.findByLogin.mock.calls[0].arguments, [testData.users.list[0].login]);
  });

  it('should retrieve hash password of a user by login', () => {
    userRepository.getHashedPasswordByLogin.mock.mockImplementationOnce(() => 'password');

    const result = service.getHashedPasswordByLogin(testData.users.list[0].login);

    assert.deepStrictEqual(userRepository.getHashedPasswordByLogin.mock.calls[0].arguments, [testData.users.list[0].login]);
    assert.strictEqual(result, 'password');
  });

  it('should search users', () => {
    const expectedResult = createPageFromArray(testData.users.list, 25, 0);
    userRepository.search.mock.mockImplementationOnce(() => expectedResult);

    const result = service.search({ login: 'john.doe', page: 1 });

    assert.deepStrictEqual(userRepository.search.mock.calls[0].arguments, [{ login: 'john.doe', page: 1 }]);
    assert.deepStrictEqual(result, expectedResult);
  });

  it('should verify the password of a user', async () => {
    userRepository.getHashedPasswordByLogin.mock.mockImplementationOnce(() => 'hash');
    const verify = mock.method(argon2, 'verify', async () => true);
    mock.method(argon2, 'needsRehash', () => false);

    assert.strictEqual(await service.verifyPassword('admin', 'password'), true);

    assert.deepStrictEqual(verify.mock.calls[0].arguments, ['hash', 'password']);
    assert.strictEqual(userRepository.updateHashedPassword.mock.calls.length, 0);
  });

  it('should not verify a wrong password', async () => {
    userRepository.getHashedPasswordByLogin.mock.mockImplementationOnce(() => 'hash');
    mock.method(argon2, 'verify', async () => false);

    assert.strictEqual(await service.verifyPassword('admin', 'wrong'), false);
    assert.strictEqual(userRepository.updateHashedPassword.mock.calls.length, 0);
  });

  it('should verify the password of an unknown login against the same dummy hash', async () => {
    userRepository.getHashedPasswordByLogin.mock.mockImplementation(() => null);
    const hash = mock.method(argon2, 'hash', async () => 'dummy hash');
    const verify = mock.method(argon2, 'verify', async () => true);

    assert.strictEqual(await service.verifyPassword('unknown', 'password'), false);
    assert.strictEqual(await service.verifyPassword('other unknown', 'password'), false);

    assert.strictEqual(hash.mock.calls.length, 1);
    assert.deepStrictEqual(
      verify.mock.calls.map(call => call.arguments),
      [
        ['dummy hash', 'password'],
        ['dummy hash', 'password']
      ]
    );
  });

  it('should hash a verified password again when the hashing parameters changed', async () => {
    userRepository.getHashedPasswordByLogin.mock.mockImplementationOnce(() => 'old hash');
    mock.method(argon2, 'verify', async () => true);
    const needsRehash = mock.method(argon2, 'needsRehash', () => true);
    mock.method(argon2, 'hash', async () => 'new hash');

    assert.strictEqual(await service.verifyPassword('admin', 'password'), true);

    assert.deepStrictEqual(needsRehash.mock.calls[0].arguments, ['old hash']);
    assert.deepStrictEqual(userRepository.updateHashedPassword.mock.calls[0].arguments, ['admin', 'new hash']);
  });

  it('should create a user', async () => {
    userRepository.create.mock.mockImplementationOnce(async () => testData.users.list[0]);

    const result = await service.create(testData.users.command, 'password', testData.users.list[0].id);

    assert.deepStrictEqual(
      validator.validate.mock.calls.map(call => call.arguments),
      [
        [userSchema, testData.users.command],
        [userPasswordSchema, { password: 'password' }]
      ]
    );
    assert.deepStrictEqual(userRepository.create.mock.calls[0].arguments, [testData.users.command, 'password', testData.users.list[0].id]);
    assert.deepStrictEqual(result, testData.users.list[0]);
  });

  it('should not create a user if the password is invalid', async () => {
    validator.validate.mock.mockImplementation(async schema => {
      if (schema === userPasswordSchema) throw new Error('"password" length must be at least 8 characters long');
    });

    await assert.rejects(() => service.create(testData.users.command, 'short', testData.users.list[0].id), {
      message: '"password" length must be at least 8 characters long'
    });

    assert.strictEqual(userRepository.create.mock.calls.length, 0);
  });

  it('should update a user', async () => {
    userRepository.findById.mock.mockImplementationOnce(() => testData.users.list[0]);

    await service.update(testData.users.list[0].id, testData.users.command, 'updaterUser');

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [userSchema, testData.users.command]);
    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.deepStrictEqual(userRepository.update.mock.calls[0].arguments, [
      testData.users.list[0].id,
      testData.users.command,
      'updaterUser'
    ]);
  });

  it('should not update if the user is not found', async () => {
    userRepository.findById.mock.mockImplementationOnce(() => null);

    await assert.rejects(() => service.update(testData.users.list[0].id, testData.users.command, 'updaterUser'), {
      message: `User "${testData.users.list[0].id}" (id) not found`
    });

    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.strictEqual(userRepository.update.mock.calls.length, 0);
  });

  it('should update the password of a user after checking the current password of its author', async () => {
    const [user, author] = testData.users.list;
    userRepository.findById.mock.mockImplementation(id => testData.users.list.find(element => element.id === id) ?? null);
    userRepository.getHashedPasswordByLogin.mock.mockImplementation(() => 'hash');
    const verify = mock.method(argon2, 'verify', async () => true);
    mock.method(argon2, 'needsRehash', () => false);

    await service.updatePassword(user.id, changePasswordCommand, author.id);

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [changePasswordSchema, changePasswordCommand]);
    assert.deepStrictEqual(userRepository.getHashedPasswordByLogin.mock.calls[0].arguments, [author.login]);
    assert.deepStrictEqual(verify.mock.calls[0].arguments, ['hash', 'current password']);
    assert.deepStrictEqual(userRepository.updatePassword.mock.calls[0].arguments, [user.id, 'new password', author.id]);
  });

  it('should not update a user password if the current password is wrong', async () => {
    userRepository.findById.mock.mockImplementation(() => testData.users.list[0]);
    userRepository.getHashedPasswordByLogin.mock.mockImplementation(() => 'hash');
    mock.method(argon2, 'verify', async () => false);

    await assert.rejects(() => service.updatePassword(testData.users.list[0].id, changePasswordCommand, testData.users.list[0].id), {
      message: 'The current password is incorrect'
    });
    assert.strictEqual(userRepository.updatePassword.mock.calls.length, 0);
  });

  it('should not update a user password if the new password is invalid', async () => {
    userRepository.findById.mock.mockImplementationOnce(() => testData.users.list[0]);
    validator.validate.mock.mockImplementationOnce(async () => {
      throw new Error('"newPassword" length must be at least 8 characters long');
    });

    await assert.rejects(() => service.updatePassword(testData.users.list[0].id, changePasswordCommand, 'updaterUser'), {
      message: '"newPassword" length must be at least 8 characters long'
    });
    assert.strictEqual(userRepository.updatePassword.mock.calls.length, 0);
  });

  it('should not update the password if the user is not found', async () => {
    userRepository.findById.mock.mockImplementationOnce(() => null);

    await assert.rejects(() => service.updatePassword(testData.users.list[0].id, changePasswordCommand, 'updaterUser'), {
      message: `User "${testData.users.list[0].id}" (id) not found`
    });

    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.strictEqual(userRepository.updatePassword.mock.calls.length, 0);
  });

  it('should delete a user', async () => {
    userRepository.findById.mock.mockImplementationOnce(() => testData.users.list[0]);

    await service.delete(testData.users.list[0].id, 'deleterUser');

    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.deepStrictEqual(userRepository.delete.mock.calls[0].arguments, [testData.users.list[0].id, 'deleterUser']);
  });

  it('should not delete if the user is not found', () => {
    userRepository.findById.mock.mockImplementationOnce(() => null);

    assert.throws(() => service.delete(testData.users.list[0].id, 'deleterUser'), {
      message: `User "${testData.users.list[0].id}" (id) not found`
    });

    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.strictEqual(userRepository.delete.mock.calls.length, 0);
  });

  it('should properly convert to DTO', () => {
    const user = testData.users.list[0];
    assert.deepStrictEqual(toUserDTO(user, getUserInfo), expectedUserDTO(user, 'Admin'));
  });

  it('should properly convert non-admin user to DTO with firstName and lastName', () => {
    const user = testData.users.list[1];
    assert.deepStrictEqual(toUserDTO(user, getUserInfo), expectedUserDTO(user, `${user.firstName} ${user.lastName} (${user.login})`));
  });

  it('should return empty info for null userId', () => {
    assert.deepStrictEqual(service.getUserInfo(null as unknown as string), { id: '', friendlyName: '' });
  });

  it('should return OIAnalytics info for "oianalytics" userId', () => {
    assert.deepStrictEqual(service.getUserInfo('oianalytics'), { id: 'oianalytics', friendlyName: 'OIAnalytics' });
  });

  it('should return System info for "system" userId', () => {
    assert.deepStrictEqual(service.getUserInfo('system'), { id: 'system', friendlyName: 'System' });
  });

  it('should return id as friendlyName when user is not found', () => {
    userRepository.findById.mock.mockImplementationOnce(() => null);
    assert.deepStrictEqual(service.getUserInfo('unknown-id'), { id: 'unknown-id', friendlyName: 'unknown-id' });
  });

  it('should return formatted friendlyName when user is found', () => {
    userRepository.findById.mock.mockImplementationOnce(() => testData.users.list[1]);
    const result = service.getUserInfo(testData.users.list[1].id);
    assert.deepStrictEqual(result, {
      id: testData.users.list[1].id,
      friendlyName: `${testData.users.list[1].firstName} ${testData.users.list[1].lastName} (${testData.users.list[1].login})`
    });
  });

  it('should use login as name when user has no firstName or lastName', () => {
    const userNoName = { ...testData.users.list[1], login: 'noname', firstName: null, lastName: null };
    userRepository.findById.mock.mockImplementationOnce(() => userNoName);
    const result = service.getUserInfo('some-id');
    assert.deepStrictEqual(result, { id: 'some-id', friendlyName: 'noname (noname)' });
  });

  it('should convert to DTO a user with only a firstName set', () => {
    const user = { ...testData.users.list[1], login: 'onlyfirst', firstName: 'OnlyFirst', lastName: null };
    assert.deepStrictEqual(toUserDTO(user, getUserInfo), expectedUserDTO(user, 'OnlyFirst (onlyfirst)'));
  });

  it('should convert to DTO a user with only a lastName set', () => {
    const user = { ...testData.users.list[1], login: 'onlylast', firstName: null, lastName: 'OnlyLast' };
    assert.deepStrictEqual(toUserDTO(user, getUserInfo), expectedUserDTO(user, 'OnlyLast (onlylast)'));
  });
});
