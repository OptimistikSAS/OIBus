/**
 * Create a mock object for History Query Service
 */
export default jest.fn().mockImplementation(() => ({
  runHistoryQuery: jest.fn(),
  testNorth: jest.fn(),
  testSouth: jest.fn(),
  testSouthItem: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  createHistoryQuery: jest.fn(),
  updateHistoryQuery: jest.fn(),
  deleteHistoryQuery: jest.fn(),
  startHistoryQuery: jest.fn(),
  pauseHistoryQuery: jest.fn(),
  listItems: jest.fn(),
  searchHistoryQueryItems: jest.fn(),
  findAllItemsForHistoryQuery: jest.fn(),
  findHistoryQueryItem: jest.fn(),
  createHistoryQueryItem: jest.fn(),
  updateHistoryQueryItem: jest.fn(),
  deleteHistoryQueryItem: jest.fn(),
  deleteAllItemsForHistoryQuery: jest.fn(),
  enableHistoryQueryItem: jest.fn(),
  disableHistoryQueryItem: jest.fn(),
  checkCsvImport: jest.fn(),
  importItems: jest.fn()
}));
