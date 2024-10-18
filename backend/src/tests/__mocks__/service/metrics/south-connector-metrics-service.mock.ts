/**
 * Create a mock object for South Connector Metrics Service
 */
export default class SouthConnectorMetricsServiceMock {
  initMetrics = jest.fn();
  updateMetrics = jest.fn();
  resetMetrics = jest.fn();
  metrics = jest.fn();
  stream = jest.fn();
}
