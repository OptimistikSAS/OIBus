import { UserController } from './user.controller';
import { ChangePasswordCommand, UserCommandDTO, UserSearchParam } from '../../../shared/model/user.model';
import { CustomExpressRequest } from '../express';
import testData from '../../tests/utils/test-data';
import UserServiceMock from '../../tests/__mocks__/service/user-service.mock';
import { createPageFromArray } from '../../../shared/model/types';

// Mock the services
jest.mock('../../service/user.service', () => ({
  toUserDTO: jest.fn().mockImplementation(user => user)
}));

describe('UserController', () => {
  let controller: UserController;
  const mockRequest: Partial<CustomExpressRequest> = {
    services: {
      userService: new UserServiceMock()
    }
  } as CustomExpressRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UserController();
  });

  it('should search for users with login parameter', async () => {
    const login = 'login';
    const page = 10;

    const searchParams: UserSearchParam = {
      page: page,
      login: login
    };

    const expectedResult = createPageFromArray(testData.users.list, 25, page);
    (mockRequest.services!.userService.search as jest.Mock).mockReturnValue(expectedResult);

    const result = await controller.search(login, page, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.userService.search).toHaveBeenCalledWith(searchParams);
    expect(result).toEqual({
      ...expectedResult,
      content: expectedResult.content
    });
  });

  it('should search for users with default parameters', async () => {
    const searchParams: UserSearchParam = {
      page: 0,
      login: undefined
    };

    const expectedResult = createPageFromArray(testData.users.list, 25, 0);
    (mockRequest.services!.userService.search as jest.Mock).mockReturnValue(expectedResult);

    const result = await controller.search(undefined, undefined, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.userService.search).toHaveBeenCalledWith(searchParams);
    expect(result).toEqual({
      ...expectedResult,
      content: expectedResult.content
    });
  });

  it('should return a user by ID', async () => {
    const mockUser = testData.users.list[0];
    const userId = mockUser.id;
    (mockRequest.services!.userService.findById as jest.Mock).mockReturnValue(mockUser);

    const result = await controller.findById(userId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.userService.findById).toHaveBeenCalledWith(userId);
    expect(result).toEqual(mockUser);
  });

  it('should create a new user', async () => {
    const command: UserCommandDTO = testData.users.command;
    const userWithPassword = {
      user: command,
      password: 'password'
    };
    const createdUser = testData.users.list[0];
    (mockRequest.services!.userService.create as jest.Mock).mockResolvedValue(createdUser);

    const result = await controller.create(userWithPassword, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.userService.create).toHaveBeenCalledWith(command, 'password');
    expect(result).toEqual(createdUser);
  });

  it('should update an existing user', async () => {
    const userId = testData.users.list[0].id;
    const command: UserCommandDTO = testData.users.command;
    (mockRequest.services!.userService.update as jest.Mock).mockResolvedValue(undefined);

    await controller.update(userId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.userService.update).toHaveBeenCalledWith(userId, command);
  });

  it('should update user password', async () => {
    const userId = testData.users.list[0].id;
    const command: ChangePasswordCommand = {
      newPassword: 'newPassword',
      currentPassword: 'currentPassword'
    };
    (mockRequest.services!.userService.updatePassword as jest.Mock).mockResolvedValue(undefined);

    await controller.updatePassword(userId, command, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.userService.updatePassword).toHaveBeenCalledWith(userId, 'newPassword');
  });

  it('should delete a user', async () => {
    const userId = testData.users.list[0].id;
    (mockRequest.services!.userService.delete as jest.Mock).mockResolvedValue(undefined);

    await controller.delete(userId, mockRequest as CustomExpressRequest);

    expect(mockRequest.services!.userService.delete).toHaveBeenCalledWith(userId);
  });
});
