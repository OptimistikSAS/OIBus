/**
 * Create a mock object for OIBus engine
 */
export default jest.fn().mockImplementation(() => {
  return {
    setLogger: jest.fn(),
    startHistoryQuery: jest.fn(),
    stopHistoryQuery: jest.fn(),
    addItemToHistoryQuery: jest.fn(),
    updateItemInHistoryQuery: jest.fn(),
    deleteItemFromHistoryQuery: jest.fn()
  };
});
