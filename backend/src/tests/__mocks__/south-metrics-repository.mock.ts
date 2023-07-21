export const getMetrics = jest.fn();

/**
 * Create a mock object for South Connector Metrics repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    initMetrics: jest.fn(),
    createCacheHistoryTable: jest.fn(),
    createOrUpdateCacheScanMode: jest.fn(),
    getSouthCacheScanMode: jest.fn(),
    resetDatabase: jest.fn(),
    getMetrics,
    updateMetrics: jest.fn(),
    removeMetrics: jest.fn()
  };
});
