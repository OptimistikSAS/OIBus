/**
 * Create a mock object for History Query repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    findAllHistoriesLight: jest.fn(),
    findAllHistoriesFull: jest.fn(),
    findHistoryById: jest.fn(),
    saveHistory: jest.fn(),
    updateHistoryStatus: jest.fn(),
    deleteHistory: jest.fn(),
    addOrEditTransformer: jest.fn(),
    removeTransformer: jest.fn(),
    searchItems: jest.fn(),
    listItems: jest.fn(),
    findAllItemsForHistory: jest.fn(),
    findItemById: jest.fn(),
    saveItem: jest.fn(),
    saveAllItems: jest.fn(),
    deleteItem: jest.fn(),
    deleteAllItemsByHistory: jest.fn(),
    enableItem: jest.fn(),
    disableItem: jest.fn()
  };
});
