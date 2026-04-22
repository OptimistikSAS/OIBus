import { mock } from 'node:test';

/**
 * Create a mock object for Logger Service
 */
export default class LoggerServiceMock {
  start = mock.fn();
  createChildLogger = mock.fn();
  stop = mock.fn();
}
