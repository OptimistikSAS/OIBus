import { mock } from 'node:test';
import type { ILogger } from '../../../../model/logger.model';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: Array<any>) => any;

export default class LoggerMock implements ILogger {
  trace = mock.fn<AnyFn>();
  debug = mock.fn<AnyFn>();
  info = mock.fn<AnyFn>();
  warn = mock.fn<AnyFn>();
  error = mock.fn<AnyFn>();
  fatal = mock.fn<AnyFn>();
  child = mock.fn((_bindings: Record<string, unknown>, _options?: Record<string, unknown>): ILogger => new LoggerMock());
}
