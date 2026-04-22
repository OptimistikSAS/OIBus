import { mock } from 'node:test';

/**
 * Create a mock object for User repository
 */
export default class UserRepositoryMock {
  list = mock.fn();
  search = mock.fn();
  findById = mock.fn();
  findByLogin = mock.fn();
  getHashedPasswordByLogin = mock.fn();
  create = mock.fn();
  update = mock.fn();
  updatePassword = mock.fn();
  delete = mock.fn();
}
