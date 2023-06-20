/**
 * Create a mock object for North Service
 */
export default jest.fn().mockImplementation(() => ({
  getHistoryQuery: jest.fn(),
  getHistoryQueryList: jest.fn(),
  getItems: jest.fn(),
  stopHistoryQuery: jest.fn()
}));
