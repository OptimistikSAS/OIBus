import { mock } from 'node:test';

/**
 * Create a mock object for North Connector Metrics Repository
 */
export default class NorthMetricsRepositoryMock {
  initMetrics = mock.fn();
  getMetrics = mock.fn();
  updateMetrics = mock.fn();
  removeMetrics = mock.fn();
}
