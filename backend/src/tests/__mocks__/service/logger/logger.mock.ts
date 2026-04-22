import { mock } from 'node:test';

/**
 * Create a mock object for Pino logger
 */
export default class LoggerMock {
  trace = mock.fn();
  debug = mock.fn();
  info = mock.fn();
  warn = mock.fn();
  error = mock.fn();
  fatal = mock.fn();
  isLevelEnabled = mock.fn(() => true);
  child = mock.fn(() => new LoggerMock());
}
