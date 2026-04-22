import { mock } from 'node:test';

/**
 * Create a mock object for South Connector repository
 */
export default class SouthConnectorRepositoryMock {
  findAllSouth = mock.fn();
  findSouthById = mock.fn();
  saveSouth = mock.fn();
  start = mock.fn();
  stop = mock.fn();
  deleteSouth = mock.fn();
  listItems = mock.fn();
  searchItems = mock.fn();
  findAllItemsForSouth = mock.fn();
  findItemById = mock.fn();
  saveItem = mock.fn();
  saveAllItems = mock.fn();
  deleteItem = mock.fn();
  deleteAllItemsBySouth = mock.fn();
  enableItem = mock.fn();
  disableItem = mock.fn();
  moveItemsToGroup = mock.fn();
}
