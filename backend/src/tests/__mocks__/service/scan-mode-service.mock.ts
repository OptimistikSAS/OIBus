import { mock } from 'node:test';

/**
 * Create a mock object for Scan Mode Service
 */
export default class ScanModeServiceMock {
  list = mock.fn();
  findById = mock.fn();
  create = mock.fn();
  update = mock.fn();
  delete = mock.fn();
  verifyCron = mock.fn();
}
