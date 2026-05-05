import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ChangePasswordCommand, UserCommandDTO, UserSearchParam } from '../../../shared/model/user.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, fixTsoaModuleResolution } from '../../tests/utils/test-utils';
import UserServiceMock from '../../tests/__mocks__/service/user-service.mock';
import { createPageFromArray } from '../../../shared/model/types';
import type { UserController as UserControllerShape } from './user.controller';

const nodeRequire = createRequire(import.meta.url);

let mockUserServiceModule: Record<string, ReturnType<typeof mock.fn>>;
let UserController: typeof UserControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  mockUserServiceModule = { toUserDTO: mock.fn((user: unknown) => user) };
  mockModule(nodeRequire, '../../service/user.service', mockUserServiceModule);
  const mod = reloadModule<{ UserController: typeof UserControllerShape }>(nodeRequire, './user.controller');
  UserController = mod.UserController;
});

describe('UserController', () => {
  let controller: UserControllerShape;
  let userService: UserServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    userService = new UserServiceMock();
    mockRequest = {
      user: { id: testData.users.list[0].id, login: testData.users.list[0].login },
      services: Object.assign({} as CustomExpressRequest['services'], { userService })
    } as Partial<CustomExpressRequest>;
    mockUserServiceModule.toUserDTO = mock.fn((user: unknown) => user);
    controller = new UserController();
  });

  it('should search for users with login parameter', async () => {
    const login = 'login';
    const page = 10;
    const searchParams: UserSearchParam = { page, login };
    const expectedResult = createPageFromArray(testData.users.list, 25, page);
    userService.search = mock.fn(() => expectedResult);

    const result = await controller.search(login, page, mockRequest as CustomExpressRequest);

    assert.strictEqual(userService.search.mock.calls.length, 1);
    assert.deepStrictEqual(userService.search.mock.calls[0].arguments[0], searchParams);
    assert.deepStrictEqual(result, { ...expectedResult, content: expectedResult.content });
  });

  it('should search for users with default parameters', async () => {
    const searchParams: UserSearchParam = { page: 0, login: undefined };
    const expectedResult = createPageFromArray(testData.users.list, 25, 0);
    userService.search = mock.fn(() => expectedResult);

    const result = await controller.search(undefined, undefined, mockRequest as CustomExpressRequest);

    assert.strictEqual(userService.search.mock.calls.length, 1);
    assert.deepStrictEqual(userService.search.mock.calls[0].arguments[0], searchParams);
    assert.deepStrictEqual(result, { ...expectedResult, content: expectedResult.content });
  });

  it('should return a user by ID', async () => {
    const mockUser = testData.users.list[0];
    const userId = mockUser.id;
    userService.findById = mock.fn(() => mockUser);

    const result = await controller.findById(userId, mockRequest as CustomExpressRequest);

    assert.strictEqual(userService.findById.mock.calls.length, 1);
    assert.deepStrictEqual(userService.findById.mock.calls[0].arguments[0], userId);
    assert.deepStrictEqual(result, mockUser);
  });

  it('should create a new user', async () => {
    const command: UserCommandDTO = testData.users.command;
    const userWithPassword = { user: command, password: 'password' };
    const createdUser = testData.users.list[0];
    userService.create = mock.fn(async () => createdUser);

    const result = await controller.create(userWithPassword, mockRequest as CustomExpressRequest);

    assert.strictEqual(userService.create.mock.calls.length, 1);
    assert.deepStrictEqual(userService.create.mock.calls[0].arguments, [command, 'password', testData.users.list[0].id]);
    assert.deepStrictEqual(result, createdUser);
  });

  it('should update an existing user', async () => {
    const userId = testData.users.list[0].id;
    const command: UserCommandDTO = testData.users.command;
    userService.update = mock.fn(async () => undefined);

    await controller.update(userId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(userService.update.mock.calls.length, 1);
    assert.deepStrictEqual(userService.update.mock.calls[0].arguments, [userId, command]);
  });

  it('should update user password', async () => {
    const userId = testData.users.list[0].id;
    const command: ChangePasswordCommand = {
      newPassword: 'newPassword',
      currentPassword: 'currentPassword'
    };
    userService.updatePassword = mock.fn(async () => undefined);

    await controller.updatePassword(userId, command, mockRequest as CustomExpressRequest);

    assert.strictEqual(userService.updatePassword.mock.calls.length, 1);
    assert.deepStrictEqual(userService.updatePassword.mock.calls[0].arguments, [userId, 'newPassword']);
  });

  it('should delete a user', async () => {
    const userId = testData.users.list[0].id;
    userService.delete = mock.fn(async () => undefined);

    await controller.delete(userId, mockRequest as CustomExpressRequest);

    assert.strictEqual(userService.delete.mock.calls.length, 1);
    assert.deepStrictEqual(userService.delete.mock.calls[0].arguments[0], userId);
  });
});
