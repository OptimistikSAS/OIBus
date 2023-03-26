import Joi from 'joi';

import UserController from './user.controller';
import JoiValidator from '../../validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';

jest.mock('../../validators/joi.validator');

const validator = new JoiValidator();
const schema = Joi.object({});
const userController = new UserController(validator, schema);

const ctx = new KoaContextMock();
const userCommand = {
  login: 'login',
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  language: 'language',
  timezone: 'timezone'
};
const user = {
  id: '1',
  friendlyName: 'friendlyName',
  ...userCommand
};
const userLight = {
  id: '1',
  login: 'login',
  friendlyName: 'friendlyName'
};
const page = {
  content: [userLight],
  size: 10,
  number: 1,
  totalElements: 1,
  totalPages: 1
};

describe('User controller', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('searchUsers() should return users', async () => {
    ctx.query.page = '10';
    ctx.query.login = 'login';
    ctx.app.repositoryService.userRepository.searchUsers.mockReturnValue(page);

    await userController.searchUsers(ctx);

    expect(ctx.app.repositoryService.userRepository.searchUsers).toHaveBeenCalledWith({ page: 10, login: 'login' });
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('searchUsers() should return users when no params are provided', async () => {
    ctx.query = {};
    ctx.app.repositoryService.userRepository.searchUsers.mockReturnValue(page);

    await userController.searchUsers(ctx);

    expect(ctx.app.repositoryService.userRepository.searchUsers).toHaveBeenCalledWith({ page: 0, login: null });
    expect(ctx.ok).toHaveBeenCalledWith(page);
  });

  it('getUser() should return proxy', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.userRepository.getUserById.mockReturnValue(user);

    await userController.getUser(ctx);

    expect(ctx.app.repositoryService.userRepository.getUserById).toHaveBeenCalledWith(id);
    expect(ctx.ok).toHaveBeenCalledWith(user);
  });

  it('getUser() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.userRepository.getUserById.mockReturnValue(null);

    await userController.getUser(ctx);

    expect(ctx.app.repositoryService.userRepository.getUserById).toHaveBeenCalledWith(id);
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('createUser() should create user', async () => {
    ctx.request.body = {
      user: userCommand,
      password: 'password'
    };
    ctx.app.repositoryService.userRepository.createUser.mockReturnValue(user);

    await userController.createUser(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, userCommand);
    expect(ctx.app.repositoryService.userRepository.createUser).toHaveBeenCalledWith(userCommand, 'password');
    expect(ctx.created).toHaveBeenCalledWith(user);
  });

  it('createUser() should return bad request when validation fails', async () => {
    ctx.request.body = {
      user: userCommand,
      password: 'password'
    };
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await userController.createUser(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, userCommand);
    expect(ctx.app.repositoryService.userRepository.createUser).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('createUser() should return bad request when missing password', async () => {
    ctx.request.body = {
      user: userCommand
    };
    ctx.app.repositoryService.userRepository.createUser.mockReturnValue(user);

    await userController.createUser(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, userCommand);
    expect(ctx.app.repositoryService.userRepository.createUser).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith('No password provided');
  });

  it('updateUser() should update user', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.request.body = userCommand;

    await userController.updateUser(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, userCommand);
    expect(ctx.app.repositoryService.userRepository.updateUser).toHaveBeenCalledWith(id, userCommand);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updateUser() should return bad request', async () => {
    ctx.request.body = userCommand;
    const validationError = new Error('invalid body');
    validator.validate = jest.fn().mockImplementationOnce(() => {
      throw validationError;
    });

    await userController.updateUser(ctx);

    expect(validator.validate).toHaveBeenCalledWith(schema, userCommand);
    expect(ctx.app.repositoryService.userRepository.updateUser).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith(validationError.message);
  });

  it('changePassword() should change password', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.request.body = 'password';

    await userController.changePassword(ctx);

    expect(ctx.app.repositoryService.userRepository.updatePassword).toHaveBeenCalledWith(id, 'password');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('changePassword() should return bad request', async () => {
    ctx.params.id = 'id';
    ctx.request.body = null;

    await userController.changePassword(ctx);

    expect(ctx.app.repositoryService.userRepository.updatePassword).not.toHaveBeenCalledWith();
    expect(ctx.badRequest).toHaveBeenCalledWith('No password provided');
  });

  it('changePassword() should return bad request when exception occurs', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.request.body = 'password';
    const error = new Error('error');
    ctx.app.repositoryService.userRepository.updatePassword = jest.fn().mockImplementationOnce(() => {
      throw error;
    });

    await userController.changePassword(ctx);

    expect(ctx.app.repositoryService.userRepository.updatePassword).toHaveBeenCalledWith(id, 'password');
    expect(ctx.badRequest).toHaveBeenCalledWith(error.message);
  });

  it('deleteUser() should delete proxy', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.userRepository.getUserById.mockReturnValue(user);

    await userController.deleteUser(ctx);

    expect(ctx.app.repositoryService.userRepository.getUserById).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.userRepository.deleteUser).toHaveBeenCalledWith(id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('deleteUser() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.repositoryService.userRepository.getUserById.mockReturnValue(null);

    await userController.deleteUser(ctx);

    expect(ctx.app.repositoryService.userRepository.getUserById).toHaveBeenCalledWith(id);
    expect(ctx.app.repositoryService.userRepository.deleteUser).not.toHaveBeenCalled();
    expect(ctx.notFound).toHaveBeenCalled();
  });
});
