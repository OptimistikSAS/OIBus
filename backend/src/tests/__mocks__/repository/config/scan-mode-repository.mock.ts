import { mock } from 'node:test';

/**
 * Create a mock object for Scan Mode repository
 */
export default class ScanModeRepositoryMock {
  findAll = mock.fn();
  findById = mock.fn();
  create = mock.fn();
  update = mock.fn();
  delete = mock.fn();
}
