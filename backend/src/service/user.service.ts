import crypto from 'node:crypto';

import argon2 from 'argon2';

import { ChangePasswordCommand, UserCommandDTO, UserDTO } from '../../shared/model/api/user.model';
import { GetUserInfo, Language, Page, UserInfo } from '../../shared/model/common/types';
import { UserSearchParam } from '../../shared/model/domain/user.model';

import { NotFoundError, OIBusValidationError } from '../model/types';
import { User } from '../model/user.model';
import UserRepository from '../repository/config/user.repository';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { changePasswordSchema, userPasswordSchema, userSchema } from '../web-server/controllers/validators/oibus-validation-schema';

export default class UserService {
  // Hash of a random password, verified for an unknown login: computed on first use, with the current hashing parameters
  private dummyHash: Promise<string> | null = null;

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

  /**
   * Checks the password of a user. An unknown login is verified against a dummy hash, so that it takes as long as a known
   * one and does not tell which logins exist. Once verified, the password is hashed again if the hashing parameters
   * changed since it was hashed.
   */
  async verifyPassword(login: string, password: string): Promise<boolean> {
    const hashedPassword = this.userRepository.getHashedPasswordByLogin(login);
    this.dummyHash ??= argon2.hash(crypto.randomUUID());
    const verified = await argon2.verify(hashedPassword ?? (await this.dummyHash), password);
    if (!hashedPassword || !verified) {
      return false;
    }
    if (argon2.needsRehash(hashedPassword)) {
      this.userRepository.updateHashedPassword(login, await argon2.hash(password));
    }
    return true;
  }

  search(searchParams: UserSearchParam): Page<User> {
    return this.userRepository.search(searchParams);
  }

  async create(command: UserCommandDTO, password: string, createdBy: string): Promise<User> {
    await this.validator.validate(userSchema, command);
    await this.validator.validate(userPasswordSchema, { password });
    return await this.userRepository.create(command, password, createdBy);
  }

  async update(userId: string, command: UserCommandDTO, updatedBy: string): Promise<void> {
    const user = this.findById(userId);
    await this.validator.validate(userSchema, command);
    this.userRepository.update(user.id, command, updatedBy);
  }

  /**
   * Changes the password of a user. The current password checked is the one of the user changing it (`updatedBy`): their
   * own password when they change it, and theirs too when they change the password of another user.
   */
  async updatePassword(userId: string, command: ChangePasswordCommand, updatedBy: string): Promise<void> {
    const user = this.findById(userId);
    await this.validator.validate(changePasswordSchema, command);
    const author = this.findById(updatedBy);
    if (!(await this.verifyPassword(author.login, command.currentPassword))) {
      throw new OIBusValidationError('The current password is incorrect');
    }
    await this.userRepository.updatePassword(user.id, command.newPassword, updatedBy);
  }

  delete(userId: string, deletedBy: string): void {
    const user = this.findById(userId);
    this.userRepository.delete(user.id, deletedBy);
  }

  getUserInfo(userId: string): UserInfo {
    if (!userId) return { id: '', friendlyName: '' };
    if (userId === 'oianalytics') return { id: userId, friendlyName: 'OIAnalytics' };
    if (userId === 'system') return { id: userId, friendlyName: 'System' };
    const user = this.userRepository.findById(userId);
    if (!user) return { id: userId, friendlyName: userId };
    return computeUserInfo(userId, user);
  }
}

const computeUserInfo = (id: string, user: User): UserInfo => {
  if (user.login === 'admin') return { id, friendlyName: 'Admin' };
  const nameParts = [user.firstName, user.lastName].filter(Boolean);
  const name = nameParts.length > 0 ? nameParts.join(' ') : user.login;
  return { id, friendlyName: `${name} (${user.login})` };
};

export const toUserDTO = (user: User, getUserInfo: GetUserInfo): UserDTO => {
  return {
    id: user.id,
    login: user.login,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    language: user.language as Language,
    timezone: user.timezone,
    friendlyName: computeUserInfo(user.id, user).friendlyName,
    createdBy: getUserInfo(user.createdBy),
    updatedBy: getUserInfo(user.updatedBy),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    mustChangePassword: user.mustChangePassword
  };
};
