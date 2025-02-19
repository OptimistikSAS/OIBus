/**
 * Create a mock object for History Query repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    findAllHistoryQueriesLight: jest.fn(),
    findAllHistoryQueriesFull: jest.fn(),
    findHistoryQueryById: jest.fn(),
    saveHistoryQuery: jest.fn(),
    updateHistoryQueryStatus: jest.fn(),
    deleteHistoryQuery: jest.fn(),
    searchSouthHistoryQueryItems: jest.fn(),
    searchNorthHistoryQueryItems: jest.fn(),
    listSouthHistoryQueryItems: jest.fn(),
    listNorthHistoryQueryItems: jest.fn(),
    findAllSouthItemsForHistoryQuery: jest.fn(),
    findAllNorthItemsForHistoryQuery: jest.fn(),
    findSouthHistoryQueryItemById: jest.fn(),
    findNorthHistoryQueryItemById: jest.fn(),
    saveSouthHistoryQueryItem: jest.fn(),
    saveNorthHistoryQueryItem: jest.fn(),
    saveAllSouthItems: jest.fn(),
    saveAllNorthItems: jest.fn(),
    deleteSouthHistoryQueryItem: jest.fn(),
    deleteNorthHistoryQueryItem: jest.fn(),
    deleteAllSouthHistoryQueryItemsByHistoryQuery: jest.fn(),
    deleteAllNorthHistoryQueryItemsByHistoryQuery: jest.fn(),
    enableSouthHistoryQueryItem: jest.fn(),
    enableNorthHistoryQueryItem: jest.fn(),
    disableSouthHistoryQueryItem: jest.fn(),
    disableNorthHistoryQueryItem: jest.fn(),
    findAllTransformersForHistory: jest.fn()
  };
});
