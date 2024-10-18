/**
 * Create a mock object for South Connector Metrics Repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    initMetrics: jest.fn(),
    getMetrics: jest.fn(),
    updateMetrics: jest.fn(),
    removeMetrics: jest.fn()
  };
});
