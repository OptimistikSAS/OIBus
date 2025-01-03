import { mockBaseFolders } from '../utils/test-utils';

/**
 * Create a mock object for History Query engine
 */
export default jest.fn().mockImplementation(logger => {
  return {
    logger,
    baseFolders: mockBaseFolders(''),
    start: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn(),
    createHistoryQuery: jest.fn(),
    startHistoryQuery: jest.fn(),
    stopHistoryQuery: jest.fn(),
    getHistoryQueryDataStream: jest.fn(),
    deleteHistoryQuery: jest.fn(),
    reloadHistoryQuery: jest.fn()
  };
});
