import { mock } from 'node:test';

/**
 * Create a mock object for South Cache Service
 */
export default class SouthCacheServiceMock {
  getSouthCache = mock.fn();
  saveSouthCache = mock.fn();
  dropItemValueTable = mock.fn();
  createCustomTable = mock.fn();
  createItemValueTable = mock.fn();
  getQueryOnCustomTable = mock.fn();
  runQueryOnCustomTable = mock.fn();
  getItemLastValue = mock.fn();
  saveItemLastValue = mock.fn();
}
