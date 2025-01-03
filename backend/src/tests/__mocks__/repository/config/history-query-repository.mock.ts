/**
 * Create a mock object for History Query repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    findAllHistoryQueries: jest.fn(),
    findHistoryQueryById: jest.fn(),
    saveHistoryQuery: jest.fn(),
    updateHistoryQueryStatus: jest.fn(),
    deleteHistoryQuery: jest.fn(),
    searchHistoryQueryItems: jest.fn(),
    listHistoryQueryItems: jest.fn(),
    findAllItemsForHistoryQuery: jest.fn(),
    findHistoryQueryItemById: jest.fn(),
    saveHistoryQueryItem: jest.fn(),
    saveAllItems: jest.fn(),
    deleteHistoryQueryItem: jest.fn(),
    deleteAllHistoryQueryItemsByHistoryQuery: jest.fn(),
    enableHistoryQueryItem: jest.fn(),
    disableHistoryQueryItem: jest.fn()
  };
});
