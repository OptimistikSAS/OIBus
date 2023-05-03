/**
 * Create a mock object for OIBus engine
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn(),
    startHistoryQuery: jest.fn(),
    stopHistoryQuery: jest.fn(),
    addItemToHistoryQuery: jest.fn(),
    updateItemInHistoryQuery: jest.fn(),
    deleteItemFromHistoryQuery: jest.fn(),
    deleteAllItemsFromHistoryQuery: jest.fn()
  };
});
