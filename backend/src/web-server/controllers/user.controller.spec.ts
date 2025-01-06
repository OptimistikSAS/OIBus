import UserController from './user.controller';
import JoiValidator from './validators/joi.validator';
import KoaContextMock from '../../tests/__mocks__/koa-context.mock';
import Joi from 'joi';
import { createPageFromArray } from '../../../shared/model/types';
import testData from '../../tests/utils/test-data';
import { toUserDTO } from '../../service/user.service';

jest.mock('./validators/joi.validator');

const ctx = new KoaContextMock();
const validator = new JoiValidator();
const schema = Joi.object({});
const userController = new UserController(validator, schema);

describe('User controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('search() should return users', async () => {
    const expectedResult = createPageFromArray(testData.users.list, 25, 0);
    ctx.query.page = '10';
    ctx.query.login = 'login';
    ctx.app.userService.search.mockReturnValue(expectedResult);

    await userController.search(ctx);

    expect(ctx.app.userService.search).toHaveBeenCalledWith({ page: 10, login: 'login' });
    expect(ctx.ok).toHaveBeenCalledWith({ ...expectedResult, content: expectedResult.content.map(element => toUserDTO(element)) });
  });

  it('search() should return users when no params are provided', async () => {
    const expectedResult = createPageFromArray(testData.users.list, 25, 0);

    ctx.query = {};
    ctx.app.userService.search.mockReturnValue(expectedResult);

    await userController.search(ctx);

    expect(ctx.app.userService.search).toHaveBeenCalledWith({ page: 0, login: undefined });
    expect(ctx.ok).toHaveBeenCalledWith({ ...expectedResult, content: expectedResult.content.map(element => toUserDTO(element)) });
  });

  it('findById() should return user', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.userService.findById.mockReturnValue(testData.users.list[0]);

    await userController.findById(ctx);

    expect(ctx.app.userService.findById).toHaveBeenCalledWith(id);
    expect(ctx.ok).toHaveBeenCalledWith(toUserDTO(testData.users.list[0]));
  });

  it('findById() should return not found', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.app.userService.findById.mockReturnValue(null);

    await userController.findById(ctx);

    expect(ctx.app.userService.findById).toHaveBeenCalledWith(id);
    expect(ctx.notFound).toHaveBeenCalledWith();
  });

  it('create() should create user', async () => {
    ctx.request.body = {
      user: testData.users.command,
      password: 'password'
    };
    ctx.app.userService.create.mockReturnValue(testData.users.list[0]);

    await userController.create(ctx);

    expect(ctx.app.userService.create).toHaveBeenCalledWith(testData.users.command, 'password');
    expect(ctx.created).toHaveBeenCalledWith(toUserDTO(testData.users.list[0]));
  });

  it('create() should return bad request when validation fails', async () => {
    ctx.request.body = {
      user: testData.users.command,
      password: 'password'
    };
    ctx.app.userService.create.mockImplementationOnce(() => {
      throw new Error('invalid body');
    });

    await userController.create(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('invalid body');
  });

  it('update() should update user', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.request.body = testData.users.command;

    await userController.update(ctx);

    expect(ctx.app.userService.update).toHaveBeenCalledWith(id, testData.users.command);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('update() should return bad request', async () => {
    ctx.request.body = testData.users.command;
    ctx.app.userService.update.mockImplementationOnce(() => {
      throw new Error('invalid body');
    });

    await userController.update(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('invalid body');
  });

  it('updatePassword() should update password', async () => {
    const id = 'id';
    ctx.params.id = id;
    ctx.request.body = {
      newPassword: 'password'
    };

    await userController.updatePassword(ctx);

    expect(ctx.app.userService.updatePassword).toHaveBeenCalledWith(id, 'password');
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('updatePassword() should return bad request', async () => {
    ctx.params.id = 'id';

    ctx.app.userService.updatePassword.mockImplementationOnce(() => {
      throw new Error('Password is required');
    });
    await userController.updatePassword(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('Password is required');
  });

  it('delete() should delete user', async () => {
    const id = 'id';
    ctx.params.id = id;

    await userController.delete(ctx);

    expect(ctx.app.userService.delete).toHaveBeenCalledWith(id);
    expect(ctx.noContent).toHaveBeenCalled();
  });

  it('delete() should return not found', async () => {
    ctx.params.id = 'id';
    ctx.app.userService.delete.mockImplementationOnce(() => {
      throw new Error('User not found');
    });
    await userController.delete(ctx);

    expect(ctx.badRequest).toHaveBeenCalledWith('User not found');
  });
});
