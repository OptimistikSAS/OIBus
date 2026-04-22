import { mock } from 'node:test';

/**
 * Create a mock object for South Cache Repository
 */
export default class SouthCacheRepositoryMock {
  createItemValueTable = mock.fn();
  dropItemValueTable = mock.fn();
  getItemLastValue = mock.fn();
  saveItemLastValue = mock.fn();
  deleteItemValue = mock.fn();
}
