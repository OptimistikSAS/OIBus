import { mockBaseFolders } from '../utils/test-utils';

/**
 * Create a mock object for Data Stream engine
 */
export default jest.fn().mockImplementation(logger => {
  return {
    cacheFolders: mockBaseFolders(''),
    start: jest.fn(),
    stop: jest.fn(),
    createNorth: jest.fn(),
    startNorth: jest.fn(),
    getNorth: jest.fn(),
    getNorthDataStream: jest.fn(),
    getNorthMetrics: jest.fn(),
    resetNorthMetrics: jest.fn(),
    reloadNorth: jest.fn(),
    stopNorth: jest.fn(),
    deleteNorth: jest.fn(),
    createSouth: jest.fn(),
    startSouth: jest.fn(),
    getSouthDataStream: jest.fn(),
    getSouthMetrics: jest.fn(),
    resetSouthMetrics: jest.fn(),
    reloadSouth: jest.fn(),
    reloadSouthItems: jest.fn(),
    stopSouth: jest.fn(),
    deleteSouth: jest.fn(),
    createHistoryQuery: jest.fn(),
    startHistoryQuery: jest.fn(),
    getHistoryQueryDataStream: jest.fn(),
    reloadHistoryQuery: jest.fn(),
    stopHistoryQuery: jest.fn(),
    resetHistoryQueryCache: jest.fn(),
    deleteHistoryQuery: jest.fn(),
    logger,
    setLogger: jest.fn(),
    addContent: jest.fn(),
    addExternalContent: jest.fn(),
    searchCacheContent: jest.fn(),
    getCacheContentFileStream: jest.fn(),
    removeCacheContent: jest.fn(),
    removeAllCacheContent: jest.fn(),
    moveCacheContent: jest.fn(),
    moveAllCacheContent: jest.fn(),
    updateScanMode: jest.fn(),
    updateNorthTransformerBySouth: jest.fn(),
    updateNorthConfiguration: jest.fn()
  };
});
