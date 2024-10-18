/**
 * Create a mock object for Engine Metrics Repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    initMetrics: jest.fn(),
    getMetrics: jest.fn(),
    updateMetrics: jest.fn(),
    removeMetrics: jest.fn()
  };
});
