import { mock } from 'node:test';

/**
 * Create a mock object for History Query Metrics Service
 */
export default class HistoryQueryMetricsServiceMock {
  initMetrics = mock.fn();
  updateMetrics = mock.fn();
  resetMetrics = mock.fn();
  destroy = mock.fn();
  metrics = mock.fn();
  stream = mock.fn();
}
