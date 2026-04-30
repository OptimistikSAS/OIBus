import { mock } from 'node:test';

/**
 * Create a mock object for IP Filter repository
 */
export default class IpFilterRepositoryMock {
  list = mock.fn();
  findById = mock.fn();
  create = mock.fn();
  update = mock.fn();
  delete = mock.fn();
}
