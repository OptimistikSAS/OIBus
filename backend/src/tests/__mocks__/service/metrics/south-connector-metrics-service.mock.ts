import { mock } from 'node:test';

/**
 * Create a mock object for South Connector Metrics Service
 */
export default class SouthConnectorMetricsServiceMock {
  initMetrics = mock.fn();
  updateMetrics = mock.fn();
  resetMetrics = mock.fn();
  destroy = mock.fn();
  metrics = {};
  stream = mock.fn();
}
