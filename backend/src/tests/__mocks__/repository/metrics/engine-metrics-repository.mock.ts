import { mock } from 'node:test';

/**
 * Create a mock object for Engine Metrics Repository
 */
export default class EngineMetricsRepositoryMock {
  initMetrics = mock.fn();
  getMetrics = mock.fn();
  updateMetrics = mock.fn();
  removeMetrics = mock.fn();
}
