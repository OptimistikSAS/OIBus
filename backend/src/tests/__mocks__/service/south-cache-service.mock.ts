/**
 * Create a mock object for South Cache Service
 */
export default class SouthCacheServiceMock {
  getSouthCache = jest.fn();
  saveSouthCache = jest.fn();
  resetSouthCache = jest.fn();
  createCustomTable = jest.fn();
  getQueryOnCustomTable = jest.fn();
  runQueryOnCustomTable = jest.fn();
}
