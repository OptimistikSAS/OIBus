import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { User } from '../../../../model/user.model';
import { UserCommandDTO, UserSearchParam } from '../../../../../shared/model/user.model';
import { Page } from '../../../../../shared/model/types';
import UserRepository from '../../../../repository/config/user.repository';

/**
 * Create a mock object for User repository
 */
export default class UserRepositoryMock extends UserRepository {
  constructor() {
    super({} as Database);
  }
  protected override createDefault(): void {
    return;
  }
  override list = mock.fn((): Array<User> => []);
  override search = mock.fn(
    (_searchParams: UserSearchParam): Page<User> => ({ content: [], size: 50, number: 0, totalElements: 0, totalPages: 0 })
  );
  override findById = mock.fn((_id: string): User | null => null);
  override findByLogin = mock.fn((_login: string): User | null => null);
  override getHashedPasswordByLogin = mock.fn((_login: string): string | null => null);
  override create = mock.fn(
    async (
      _command: Omit<User, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>,
      _password: string,
      _createdBy: string
    ): Promise<User> => ({}) as User
  );
  override update = mock.fn((_id: string, _command: UserCommandDTO): void => undefined);
  override updatePassword = mock.fn(async (_id: string, _password: string): Promise<void> => undefined);
  override delete = mock.fn((_id: string): void => undefined);
}
