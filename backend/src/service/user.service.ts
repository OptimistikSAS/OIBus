import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { userSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import UserRepository from '../repository/config/user.repository';
import { User } from '../model/user.model';
import { Page } from '../../shared/model/types';
import { UserCommandDTO, UserDTO, UserSearchParam } from '../../shared/model/user.model';
import { NotFoundError, OIBusValidationError } from '../model/types';

export default class UserService {
  constructor(
    protected readonly validator: JoiValidator,
    private userRepository: UserRepository
  ) {}

  list(): Array<User> {
    return this.userRepository.list();
  }

  findById(userId: string): User {
    const user = this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(`User "${userId}" (id) not found`);
    }
    return user;
  }

  findByLogin(login: string): User {
    const user = this.userRepository.findByLogin(login);
    if (!user) {
      throw new NotFoundError(`User "${login}" (login) not found`);
    }
    return user;
  }

  getHashedPasswordByLogin(login: string): string | null {
    return this.userRepository.getHashedPasswordByLogin(login);
  }

  search(searchParams: UserSearchParam): Page<User> {
    return this.userRepository.search(searchParams);
  }

  async create(command: Omit<User, 'id'>, password: string | undefined): Promise<User> {
    await this.validator.validate(userSchema, command);
    if (!password) {
      throw new OIBusValidationError('Password is required');
    }
    return await this.userRepository.create(command, password);
  }

  async update(userId: string, command: UserCommandDTO): Promise<void> {
    const user = this.findById(userId);
    await this.validator.validate(userSchema, command);
    this.userRepository.update(user.id, command);
  }

  async updatePassword(userId: string, newPassword: string | undefined): Promise<void> {
    const user = this.findById(userId);
    if (!newPassword) {
      throw new OIBusValidationError('Password is required');
    }
    await this.userRepository.updatePassword(user.id, newPassword);
  }

  delete(userId: string): void {
    const user = this.findById(userId);
    this.userRepository.delete(user.id);
  }
}

export const toUserDTO = (user: User): UserDTO => {
  return {
    id: user.id,
    login: user.login,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    language: user.language,
    timezone: user.timezone,
    friendlyName: `${user.firstName} ${user.lastName}`
  };
};
