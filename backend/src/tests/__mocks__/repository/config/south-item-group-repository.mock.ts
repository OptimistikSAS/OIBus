import { mock } from 'node:test';

/**
 * Create a mock object for South Item Group Repository
 */
export default class SouthItemGroupRepositoryMock {
  findById = mock.fn();
  findBySouthId = mock.fn();
  findByNameAndSouthId = mock.fn();
  findAll = mock.fn();
  create = mock.fn();
  update = mock.fn();
  delete = mock.fn();
}
