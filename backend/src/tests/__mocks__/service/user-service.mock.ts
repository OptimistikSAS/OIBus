import { mock } from 'node:test';
import { User } from '../../../model/user.model';
import { UserCommandDTO, UserSearchParam } from '../../../../shared/model/user.model';
import { Page } from '../../../../shared/model/types';

/**
 * Create a mock object for User Service
 */
export default class UserServiceMock {
  findAll = mock.fn((): Array<User> => []);
  list = mock.fn((): Array<User> => []);
  findById = mock.fn((_userId: string): User => ({}) as User);
  findByLogin = mock.fn((_login: string): User => ({}) as User);
  getHashedPasswordByLogin = mock.fn((_login: string): string | null => null);
  getUserInfo = mock.fn((_userId: string): unknown => ({}));
  search = mock.fn(
    (_searchParams: UserSearchParam): Page<User> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  create = mock.fn(async (_command: UserCommandDTO, _password: string | undefined, _createdBy: string): Promise<User> => ({}) as User);
  update = mock.fn(async (_userId: string, _command: UserCommandDTO): Promise<void> => undefined);
  updatePassword = mock.fn(async (_userId: string, _newPassword: string | undefined): Promise<void> => undefined);
  delete = mock.fn((_userId: string): void => undefined);
}
