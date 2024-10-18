/**
 * Create a mock object for North Connector Metrics Service
 */
export default class NorthConnectorMetricsServiceMock {
  initMetrics = jest.fn();
  updateMetrics = jest.fn();
  resetMetrics = jest.fn();
  metrics = jest.fn();
  stream = jest.fn();
}
