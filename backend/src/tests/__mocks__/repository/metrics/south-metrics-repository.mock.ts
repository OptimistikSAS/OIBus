import { mock } from 'node:test';

/**
 * Create a mock object for South Connector Metrics Repository
 */
export default class SouthMetricsRepositoryMock {
  initMetrics = mock.fn();
  getMetrics = mock.fn();
  updateMetrics = mock.fn();
  removeMetrics = mock.fn();
}
