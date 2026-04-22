import { mock } from 'node:test';

/**
 * Create a mock object for OIAnalytics Command repository
 */
export default class OianalyticsCommandRepositoryMock {
  findAll = mock.fn();
  search = mock.fn();
  list = mock.fn();
  findById = mock.fn();
  create = mock.fn();
  cancel = mock.fn();
  markAsCompleted = mock.fn();
  markAsErrored = mock.fn();
  markAsRunning = mock.fn();
  markAsAcknowledged = mock.fn();
  delete = mock.fn();
}
