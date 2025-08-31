/**
 * Create a mock object for History Query Metrics Service
 */
export default jest.fn().mockImplementation(() => ({
  initMetrics: jest.fn(),
  updateMetrics: jest.fn(),
  resetMetrics: jest.fn(),
  metrics: jest.fn(),
  stream: jest.fn()
}));
