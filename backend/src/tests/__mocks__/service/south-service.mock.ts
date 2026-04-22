import { mock } from 'node:test';

/**
 * Create a mock object for South Service
 */
export default class SouthServiceMock {
  listManifest = mock.fn();
  getManifest = mock.fn();
  list = mock.fn();
  findById = mock.fn();
  create = mock.fn();
  update = mock.fn();
  delete = mock.fn();
  start = mock.fn();
  stop = mock.fn();
  getSouthDataStream = mock.fn();
  testSouth = mock.fn(async () => ({ items: [] }));
  testItem = mock.fn();
  listItems = mock.fn();
  searchItems = mock.fn();
  findItemById = mock.fn();
  createItem = mock.fn();
  updateItem = mock.fn();
  enableItem = mock.fn();
  disableItem = mock.fn();
  enableItems = mock.fn();
  disableItems = mock.fn();
  deleteItem = mock.fn();
  deleteItems = mock.fn();
  deleteAllItems = mock.fn();
  getItemLastValue = mock.fn();
  checkImportItems = mock.fn();
  importItems = mock.fn();
  retrieveSecretsFromSouth = mock.fn();
  getGroups = mock.fn();
  getGroup = mock.fn();
  createGroup = mock.fn();
  updateGroup = mock.fn();
  deleteGroup = mock.fn();
  moveItemsToGroup = mock.fn();
}
