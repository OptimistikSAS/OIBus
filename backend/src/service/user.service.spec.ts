import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { userSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import testData from '../tests/utils/test-data';
import UserService from './user.service';
import UserRepositoryMock from '../tests/__mocks__/repository/config/user-repository.mock';
import UserRepository from '../repository/config/user.repository';
import { createPageFromArray } from '../../shared/model/types';

jest.mock('./utils');
jest.mock('../web-server/controllers/validators/joi.validator');

const validator = new JoiValidator();
const userRepository: UserRepository = new UserRepositoryMock();

let service: UserService;
describe('User Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    service = new UserService(validator, userRepository);
  });

  it('findAll() should find all users', () => {
    (userRepository.findAll as jest.Mock).mockReturnValueOnce(testData.users.list);

    const result = service.findAll();

    expect(userRepository.findAll).toHaveBeenCalled();
    expect(result).toEqual(testData.users.list);
  });

  it('findById() should find a user by id', () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    const result = service.findById(testData.users.list[0].id);

    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(result).toEqual(testData.users.list[0]);
  });

  it('findByLogin() should find a user by login', () => {
    (userRepository.findByLogin as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    const result = service.findByLogin(testData.users.list[0].login);

    expect(userRepository.findByLogin).toHaveBeenCalledWith(testData.users.list[0].login);
    expect(result).toEqual(testData.users.list[0]);
  });

  it('getHashedPasswordByLogin() should retrieve hash password of a user by login', () => {
    (userRepository.getHashedPasswordByLogin as jest.Mock).mockReturnValueOnce('password');

    const result = service.getHashedPasswordByLogin(testData.users.list[0].login);

    expect(userRepository.getHashedPasswordByLogin).toHaveBeenCalledWith(testData.users.list[0].login);
    expect(result).toEqual('password');
  });

  it('search() should search users', () => {
    const expectedResult = createPageFromArray(testData.users.list, 25, 0);
    (userRepository.search as jest.Mock).mockReturnValueOnce(expectedResult);

    const result = service.search({
      login: 'john.doe',
      page: 1
    });

    expect(userRepository.search).toHaveBeenCalledWith({
      login: 'john.doe',
      page: 1
    });
    expect(result).toEqual(expectedResult);
  });

  it('create() should create a user', async () => {
    (userRepository.create as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    const result = await service.create(testData.users.command, 'password');

    expect(validator.validate).toHaveBeenCalledWith(userSchema, testData.users.command);
    expect(userRepository.create).toHaveBeenCalledWith(testData.users.command, 'password');
    expect(result).toEqual(testData.users.list[0]);
  });

  it('create() should not create if the password is not provided', async () => {
    await expect(service.create(testData.users.command, undefined)).rejects.toThrow(new Error(`Password is required`));

    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('update() should update a user', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    await service.update(testData.users.list[0].id, testData.users.command);

    expect(validator.validate).toHaveBeenCalledWith(userSchema, testData.users.command);
    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.update).toHaveBeenCalledWith(testData.users.list[0].id, testData.users.command);
  });

  it('update() should not update if the user is not found', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.update(testData.users.list[0].id, testData.users.command)).rejects.toThrow(
      new Error(`User "${testData.users.list[0].id}" (id) not found`)
    );

    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('updatePassword() should update a user password', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    await service.updatePassword(testData.users.list[0].id, 'new password');

    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.updatePassword).toHaveBeenCalledWith(testData.users.list[0].id, 'new password');
  });

  it('updatePassword() should not update a user password if the password is not provided', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    await expect(service.updatePassword(testData.users.list[0].id, undefined)).rejects.toThrow(new Error(`Password is required`));
    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.updatePassword).not.toHaveBeenCalled();
  });

  it('updatePassword() should not update the password if the user is not found', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.updatePassword(testData.users.list[0].id, 'new password')).rejects.toThrow(
      new Error(`User "${testData.users.list[0].id}" (id) not found`)
    );

    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.updatePassword).not.toHaveBeenCalled();
  });

  it('delete() should delete a user', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    await service.delete(testData.users.list[0].id);

    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.delete).toHaveBeenCalledWith(testData.users.list[0].id);
  });

  it('delete() should not delete if the user is not found', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.delete(testData.users.list[0].id)).toThrow(new Error(`User "${testData.users.list[0].id}" (id) not found`));

    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.delete).not.toHaveBeenCalled();
  });
});
