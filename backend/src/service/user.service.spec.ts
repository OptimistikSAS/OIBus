import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { userSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import testData from '../tests/utils/test-data';
import UserService, { toUserDTO } from './user.service';
import UserRepositoryMock from '../tests/__mocks__/repository/config/user-repository.mock';
import UserRepository from '../repository/config/user.repository';
import { createPageFromArray } from '../../shared/model/types';
import { NotFoundError, OIBusValidationError } from '../model/types';

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

  it('should list all users', () => {
    (userRepository.list as jest.Mock).mockReturnValueOnce(testData.users.list);

    const result = service.list();

    expect(userRepository.list).toHaveBeenCalled();
    expect(result).toEqual(testData.users.list);
  });

  it('should find a user by id', () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    const result = service.findById(testData.users.list[0].id);

    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(result).toEqual(testData.users.list[0]);
  });

  it('should not get if the user is not found by id', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.findById(testData.users.list[0].id)).toThrow(
      new NotFoundError(`User "${testData.users.list[0].id}" (id) not found`)
    );
    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
  });

  it('should find a user by login', () => {
    (userRepository.findByLogin as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    const result = service.findByLogin(testData.users.list[0].login);

    expect(userRepository.findByLogin).toHaveBeenCalledWith(testData.users.list[0].login);
    expect(result).toEqual(testData.users.list[0]);
  });

  it('should not get if the user is not found by login', async () => {
    (userRepository.findByLogin as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.findByLogin(testData.users.list[0].login)).toThrow(
      new NotFoundError(`User "${testData.users.list[0].login}" (login) not found`)
    );
    expect(userRepository.findByLogin).toHaveBeenCalledWith(testData.users.list[0].login);
  });

  it('should retrieve hash password of a user by login', () => {
    (userRepository.getHashedPasswordByLogin as jest.Mock).mockReturnValueOnce('password');

    const result = service.getHashedPasswordByLogin(testData.users.list[0].login);

    expect(userRepository.getHashedPasswordByLogin).toHaveBeenCalledWith(testData.users.list[0].login);
    expect(result).toEqual('password');
  });

  it('should search users', () => {
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

  it('should create a user', async () => {
    (userRepository.create as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    const result = await service.create(testData.users.command, 'password');

    expect(validator.validate).toHaveBeenCalledWith(userSchema, testData.users.command);
    expect(userRepository.create).toHaveBeenCalledWith(testData.users.command, 'password');
    expect(result).toEqual(testData.users.list[0]);
  });

  it('should not create if the password is not provided', async () => {
    await expect(service.create(testData.users.command, undefined)).rejects.toThrow(new OIBusValidationError('Password is required'));

    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('should update a user', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    await service.update(testData.users.list[0].id, testData.users.command);

    expect(validator.validate).toHaveBeenCalledWith(userSchema, testData.users.command);
    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.update).toHaveBeenCalledWith(testData.users.list[0].id, testData.users.command);
  });

  it('should not update if the user is not found', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.update(testData.users.list[0].id, testData.users.command)).rejects.toThrow(
      new NotFoundError(`User "${testData.users.list[0].id}" (id) not found`)
    );

    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('should update a user password', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    await service.updatePassword(testData.users.list[0].id, 'new password');

    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.updatePassword).toHaveBeenCalledWith(testData.users.list[0].id, 'new password');
  });

  it('should not update a user password if the password is not provided', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    await expect(service.updatePassword(testData.users.list[0].id, undefined)).rejects.toThrow(new Error(`Password is required`));
    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.updatePassword).not.toHaveBeenCalled();
  });

  it('should not update the password if the user is not found', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.updatePassword(testData.users.list[0].id, 'new password')).rejects.toThrow(
      new NotFoundError(`User "${testData.users.list[0].id}" (id) not found`)
    );

    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.updatePassword).not.toHaveBeenCalled();
  });

  it('should delete a user', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(testData.users.list[0]);

    await service.delete(testData.users.list[0].id);

    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.delete).toHaveBeenCalledWith(testData.users.list[0].id);
  });

  it('should not delete if the user is not found', async () => {
    (userRepository.findById as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.delete(testData.users.list[0].id)).toThrow(
      new NotFoundError(`User "${testData.users.list[0].id}" (id) not found`)
    );

    expect(userRepository.findById).toHaveBeenCalledWith(testData.users.list[0].id);
    expect(userRepository.delete).not.toHaveBeenCalled();
  });

  it('should properly convert to DTO', () => {
    const user = testData.users.list[0];
    expect(toUserDTO(user)).toEqual({
      id: user.id,
      login: user.login,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      language: user.language,
      timezone: user.timezone,
      friendlyName: `${user.firstName} ${user.lastName}`
    });
  });
});
