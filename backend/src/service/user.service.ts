import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { userSchema } from '../web-server/controllers/validators/oibus-validation-schema';
import UserRepository from '../repository/config/user.repository';
import { User } from '../model/user.model';
import { Page } from '../../shared/model/types';
import { UserDTO, UserSearchParam } from '../../shared/model/user.model';

export default class UserService {
  constructor(
    protected readonly validator: JoiValidator,
    private userRepository: UserRepository
  ) {}

  findAll(): Array<User> {
    return this.userRepository.findAll();
  }

  findById(id: string): User | null {
    return this.userRepository.findById(id);
  }

  findByLogin(login: string): User | null {
    return this.userRepository.findByLogin(login);
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
      throw new Error('Password is required');
    }
    return await this.userRepository.create(command, password);
  }

  async update(id: string, command: Omit<User, 'id'>): Promise<void> {
    const user = this.userRepository.findById(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }

    await this.validator.validate(userSchema, command);
    this.userRepository.update(id, command);
  }

  async updatePassword(id: string, newPassword: string | undefined): Promise<void> {
    const user = this.userRepository.findById(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    if (!newPassword) {
      throw new Error('Password is required');
    }

    await this.userRepository.updatePassword(id, newPassword);
  }

  delete(id: string): void {
    const user = this.userRepository.findById(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }

    this.userRepository.delete(id);
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
