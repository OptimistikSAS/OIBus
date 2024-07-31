/**
 * Create a mock object for South Cache Repositoru
 */
export default jest.fn().mockImplementation(() => ({
  getScanMode: jest.fn(),
  createOrUpdate: jest.fn(),
  getLatestMaxInstants: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  reset: jest.fn(),
  createCustomTable: jest.fn(),
  runQueryOnCustomTable: jest.fn(),
  getQueryOnCustomTable: jest.fn(),
  deleteAllBySouthConnector: jest.fn(),
  deleteAllBySouthItem: jest.fn(),
  deleteAllByScanMode: jest.fn()
}));
