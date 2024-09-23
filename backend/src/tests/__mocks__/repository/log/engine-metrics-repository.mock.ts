export const getMetrics = jest.fn();

/**
 * Create a mock object for Engine Metrics repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    initMetrics: jest.fn(),
    getMetrics,
    updateMetrics: jest.fn(),
    removeMetrics: jest.fn()
  };
});
