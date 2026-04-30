import { mock } from 'node:test';

/**
 * Create a mock object for History Query Service
 */
export default class HistoryQueryServiceMock {
  list = mock.fn();
  findById = mock.fn();
  create = mock.fn();
  update = mock.fn();
  delete = mock.fn();
  start = mock.fn();
  pause = mock.fn();
  getHistoryDataStream = mock.fn();
  getHistoryMetrics = mock.fn();
  getAllHistoryMetrics = mock.fn();
  testNorth = mock.fn(async () => ({ items: [] }));
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
  checkImportItems = mock.fn();
  importItems = mock.fn();
  addOrEditTransformer = mock.fn();
  removeTransformer = mock.fn();
  retrieveSecrets = mock.fn();
}
