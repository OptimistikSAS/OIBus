import { mock } from 'node:test';

/**
 * Create a mock object for History Query Metrics Repository
 */
export default class HistoryQueryMetricsRepositoryMock {
  initMetrics = mock.fn();
  getMetrics = mock.fn();
  updateMetrics = mock.fn();
  removeMetrics = mock.fn();
}
