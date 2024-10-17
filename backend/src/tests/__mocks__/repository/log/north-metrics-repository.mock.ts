/**
 * Create a mock object for North Connector Metrics repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    initMetrics: jest.fn(),
    getMetrics: jest.fn(),
    updateMetrics: jest.fn(),
    removeMetrics: jest.fn()
  };
});
