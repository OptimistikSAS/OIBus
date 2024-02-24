/**
 * Create a mock object for South Cache Repositoru
 */
export default jest.fn().mockImplementation(() => ({
  createOrUpdateCacheScanMode: jest.fn(),
  getSouthCacheScanMode: jest.fn(),
  deleteCacheScanMode: jest.fn(),
  deleteAllCacheScanModes: jest.fn(),
  resetSouthCacheDatabase: jest.fn(),
  createCustomTable: jest.fn(),
  runQueryOnCustomTable: jest.fn(),
  getQueryOnCustomTable: jest.fn()
}));
