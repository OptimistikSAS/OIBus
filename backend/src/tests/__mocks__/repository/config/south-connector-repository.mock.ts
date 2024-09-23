/**
 * Create a mock object for South Connector repository
 */
export default jest.fn().mockImplementation(() => {
  return {
    findAllSouth: jest.fn(),
    findSouthById: jest.fn(),
    saveSouthConnector: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    deleteSouth: jest.fn(),
    listItems: jest.fn(),
    searchItems: jest.fn(),
    findAllItemsForSouth: jest.fn(),
    findItemById: jest.fn(),
    saveItem: jest.fn(),
    saveAllItems: jest.fn(),
    deleteItem: jest.fn(),
    deleteAllItemsBySouth: jest.fn(),
    enableItem: jest.fn(),
    disableItem: jest.fn()
  };
});
