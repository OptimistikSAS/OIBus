import { mock } from 'node:test';
import { User } from '../../../../model/user.model';
import { UserCommandDTO, UserSearchParam } from '../../../../../shared/model/user.model';
import { Page } from '../../../../../shared/model/types';

/**
 * Create a mock object for User repository
 */
export default class UserRepositoryMock {
  list = mock.fn((): Array<User> => []);
  search = mock.fn((_searchParams: UserSearchParam): Page<User> => ({ content: [], size: 50, number: 0, totalElements: 0, totalPages: 0 }));
  findById = mock.fn((_id: string): User | null => null);
  findByLogin = mock.fn((_login: string): User | null => null);
  getHashedPasswordByLogin = mock.fn((_login: string): string | null => null);
  create = mock.fn(
    async (
      _command: Omit<User, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>,
      _password: string,
      _createdBy: string
    ): Promise<User> => ({}) as User
  );
  update = mock.fn((_id: string, _command: UserCommandDTO): void => undefined);
  updatePassword = mock.fn(async (_id: string, _password: string): Promise<void> => undefined);
  delete = mock.fn((_id: string): void => undefined);
}
