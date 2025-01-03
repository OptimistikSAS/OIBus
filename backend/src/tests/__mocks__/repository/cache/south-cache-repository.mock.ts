/**
 * Create a mock object for South Cache Repositoru
 */
export default jest.fn().mockImplementation(() => ({
  getSouthCache: jest.fn(),
  save: jest.fn(),
  getLatestMaxInstants: jest.fn(),
  delete: jest.fn(),
  deleteAllBySouthConnector: jest.fn(),
  deleteAllBySouthItem: jest.fn(),
  deleteAllByScanMode: jest.fn(),
  createCustomTable: jest.fn(),
  runQueryOnCustomTable: jest.fn(),
  getQueryOnCustomTable: jest.fn()
}));
