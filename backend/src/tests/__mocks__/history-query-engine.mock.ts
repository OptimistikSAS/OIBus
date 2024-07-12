/**
 * Create a mock object for History Query engine
 */
export default jest.fn().mockImplementation(() => {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn(),
    createHistoryQuery: jest.fn(),
    startHistoryQuery: jest.fn(),
    stopHistoryQuery: jest.fn(),
    getHistoryDataStream: jest.fn(),
    deleteHistoryQuery: jest.fn()
  };
});
