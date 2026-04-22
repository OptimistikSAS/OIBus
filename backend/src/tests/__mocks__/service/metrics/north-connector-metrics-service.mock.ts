import { mock } from 'node:test';

/**
 * Create a mock object for North Connector Metrics Service
 */
export default class NorthConnectorMetricsServiceMock {
  initMetrics = mock.fn();
  updateMetrics = mock.fn();
  resetMetrics = mock.fn();
  destroy = mock.fn();
  metrics = {};
  stream = mock.fn();
}
