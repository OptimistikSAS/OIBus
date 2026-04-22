import { mock } from 'node:test';

/**
 * Create a mock object for OIAnalytics Message repository
 */
export default class OianalyticsMessageRepositoryMock {
  search = mock.fn();
  list = mock.fn();
  create = mock.fn();
  delete = mock.fn();
  markAsCompleted = mock.fn();
  markAsErrored = mock.fn();
}
