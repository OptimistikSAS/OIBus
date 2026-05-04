import { mock } from 'node:test';
import type { ILogger } from '../../../../model/logger.model';

/**
 * Create a mock object for OIAnalytics Message Service
 */
export default class OIAnalyticsMessageServiceMock {
  start = mock.fn((): void => undefined);
  run = mock.fn(async (): Promise<void> => undefined);
  stop = mock.fn(async (): Promise<void> => undefined);
  setLogger = mock.fn((_logger: ILogger): void => undefined);
  createFullConfigMessageIfNotPending = mock.fn((): void => undefined);
  createFullHistoryQueriesMessageIfNotPending = mock.fn((): void => undefined);
}
