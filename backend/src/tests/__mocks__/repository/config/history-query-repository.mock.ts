import { mock } from 'node:test';

/**
 * Create a mock object for History Query repository
 */
export default class HistoryQueryRepositoryMock {
  findAllHistoriesLight = mock.fn();
  findAllHistoriesFull = mock.fn();
  findHistoryById = mock.fn();
  saveHistory = mock.fn();
  updateHistoryStatus = mock.fn();
  deleteHistory = mock.fn();
  addOrEditTransformer = mock.fn();
  removeTransformer = mock.fn();
  removeTransformersByTransformerId = mock.fn();
  searchItems = mock.fn();
  listItems = mock.fn();
  findAllItemsForHistory = mock.fn();
  findItemById = mock.fn();
  saveItem = mock.fn();
  saveAllItems = mock.fn();
  deleteItem = mock.fn();
  deleteAllItemsByHistory = mock.fn();
  enableItem = mock.fn();
  disableItem = mock.fn();
}
