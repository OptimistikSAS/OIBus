/**
 * Create a mock object for North Connector Metrics Service
 */
export default jest.fn().mockImplementation(() => ({
  initMetrics: jest.fn(),
  updateMetrics: jest.fn(),
  resetMetrics: jest.fn(),
  metrics: {},
  stream: jest.fn()
}));
