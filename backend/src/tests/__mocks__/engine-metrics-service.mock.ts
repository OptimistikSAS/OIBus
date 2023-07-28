/**
 * Create a mock object for Engine Metrics Service
 */
export default jest.fn().mockImplementation(() => ({
  setLogger: jest.fn(),
  resetMetrics: jest.fn(),
  updateMetrics: jest.fn()
}));
