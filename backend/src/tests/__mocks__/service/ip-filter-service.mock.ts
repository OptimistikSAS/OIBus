import { EventEmitter } from 'node:events';
import { mock } from 'node:test';

/**
 * Create a mock object for IP Filter Service
 */
export default class IpFilterServiceMock {
  list = mock.fn();
  findById = mock.fn();
  create = mock.fn();
  update = mock.fn();
  delete = mock.fn();
  whiteListEvent = new EventEmitter();
}
