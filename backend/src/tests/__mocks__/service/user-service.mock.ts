import { mock } from 'node:test';

/**
 * Create a mock object for User Service
 */
export default class UserServiceMock {
  findAll = mock.fn();
  findById = mock.fn();
  findByLogin = mock.fn();
  getHashedPasswordByLogin = mock.fn();
  getUserInfo = mock.fn();
  search = mock.fn();
  create = mock.fn();
  update = mock.fn();
  updatePassword = mock.fn();
  delete = mock.fn();
}
