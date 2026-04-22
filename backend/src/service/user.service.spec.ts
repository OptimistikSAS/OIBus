import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { userSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import testData from '../tests/utils/test-data';
import UserService, { toUserDTO } from './user.service';
import UserRepositoryMock from '../tests/__mocks__/repository/config/user-repository.mock';
import UserRepository from '../repository/config/user.repository';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { createPageFromArray } from '../../shared/model/types';

let validator: { validate: ReturnType<typeof mock.fn> };
let userRepository: UserRepositoryMock;
let service: UserService;

describe('User Service', () => {
  beforeEach(() => {
    validator = { validate: mock.fn() };
    userRepository = new UserRepositoryMock();
    service = new UserService(validator as unknown as JoiValidator, userRepository as unknown as UserRepository);
  });

  it('should list all users', () => {
    userRepository.list.mock.mockImplementationOnce(() => testData.users.list);

    const result = service.list();

    assert.ok(userRepository.list.mock.calls.length > 0);
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

  it('should create a user', async () => {
    userRepository.create.mock.mockImplementationOnce(() => testData.users.list[0]);

    const result = await service.create(testData.users.command, 'password', testData.users.list[0].id);

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [userSchema, testData.users.command]);
    assert.deepStrictEqual(userRepository.create.mock.calls[0].arguments, [testData.users.command, 'password', testData.users.list[0].id]);
    assert.deepStrictEqual(result, testData.users.list[0]);
  });

  it('should not create if the password is not provided', async () => {
    await assert.rejects(() => service.create(testData.users.command, undefined, testData.users.list[0].id), {
      message: 'Password is required'
    });

    assert.strictEqual(userRepository.create.mock.calls.length, 0);
  });

  it('should update a user', async () => {
    userRepository.findById.mock.mockImplementationOnce(() => testData.users.list[0]);

    await service.update(testData.users.list[0].id, testData.users.command);

    assert.deepStrictEqual(validator.validate.mock.calls[0].arguments, [userSchema, testData.users.command]);
    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.deepStrictEqual(userRepository.update.mock.calls[0].arguments, [testData.users.list[0].id, testData.users.command]);
  });

  it('should not update if the user is not found', async () => {
    userRepository.findById.mock.mockImplementationOnce(() => null);

    await assert.rejects(() => service.update(testData.users.list[0].id, testData.users.command), {
      message: `User "${testData.users.list[0].id}" (id) not found`
    });

    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.strictEqual(userRepository.update.mock.calls.length, 0);
  });

  it('should update a user password', async () => {
    userRepository.findById.mock.mockImplementationOnce(() => testData.users.list[0]);

    await service.updatePassword(testData.users.list[0].id, 'new password');

    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.deepStrictEqual(userRepository.updatePassword.mock.calls[0].arguments, [testData.users.list[0].id, 'new password']);
  });

  it('should not update a user password if the password is not provided', async () => {
    userRepository.findById.mock.mockImplementationOnce(() => testData.users.list[0]);

    await assert.rejects(() => service.updatePassword(testData.users.list[0].id, undefined), { message: `Password is required` });
    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.strictEqual(userRepository.updatePassword.mock.calls.length, 0);
  });

  it('should not update the password if the user is not found', async () => {
    userRepository.findById.mock.mockImplementationOnce(() => null);

    await assert.rejects(() => service.updatePassword(testData.users.list[0].id, 'new password'), {
      message: `User "${testData.users.list[0].id}" (id) not found`
    });

    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.strictEqual(userRepository.updatePassword.mock.calls.length, 0);
  });

  it('should delete a user', async () => {
    userRepository.findById.mock.mockImplementationOnce(() => testData.users.list[0]);

    await service.delete(testData.users.list[0].id);

    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.deepStrictEqual(userRepository.delete.mock.calls[0].arguments, [testData.users.list[0].id]);
  });

  it('should not delete if the user is not found', () => {
    userRepository.findById.mock.mockImplementationOnce(() => null);

    assert.throws(() => service.delete(testData.users.list[0].id), {
      message: `User "${testData.users.list[0].id}" (id) not found`
    });

    assert.deepStrictEqual(userRepository.findById.mock.calls[0].arguments, [testData.users.list[0].id]);
    assert.strictEqual(userRepository.delete.mock.calls.length, 0);
  });

  it('should properly convert to DTO', () => {
    const user = testData.users.list[0];
    assert.deepStrictEqual(
      toUserDTO(user, id => ({ id, friendlyName: 'test' })),
      {
        id: user.id,
        login: user.login,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        language: user.language,
        timezone: user.timezone,
        friendlyName: 'Admin',
        createdBy: { id: user.createdBy, friendlyName: 'test' },
        updatedBy: { id: user.updatedBy, friendlyName: 'test' },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    );
  });

  it('should properly convert non-admin user to DTO with firstName and lastName', () => {
    const user = testData.users.list[1];
    assert.deepStrictEqual(
      toUserDTO(user, id => ({ id, friendlyName: 'test' })),
      {
        id: user.id,
        login: user.login,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        language: user.language,
        timezone: user.timezone,
        friendlyName: `${user.firstName} ${user.lastName} (${user.login})`,
        createdBy: { id: user.createdBy, friendlyName: 'test' },
        updatedBy: { id: user.updatedBy, friendlyName: 'test' },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    );
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
});
