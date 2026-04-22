import { mock } from 'node:test';

/**
 * Create a mock object for OIAnalytics Message Service
 */
export default class OIAnalyticsMessageServiceMock {
  start = mock.fn();
  run = mock.fn();
  stop = mock.fn();
  setLogger = mock.fn();
  createFullConfigMessageIfNotPending = mock.fn();
  createFullHistoryQueriesMessageIfNotPending = mock.fn();
}
