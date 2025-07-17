import { mockBaseFolders } from '../utils/test-utils';

/**
 * Create a mock object for Data Stream engine
 */
export default jest.fn().mockImplementation(logger => {
  return {
    logger,
    baseFolders: mockBaseFolders(''),
    start: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn(),
    createSouth: jest.fn(),
    startSouth: jest.fn(),
    reloadSouth: jest.fn(),
    reloadItems: jest.fn(),
    stopSouth: jest.fn(),
    createNorth: jest.fn(),
    startNorth: jest.fn(),
    reloadNorth: jest.fn(),
    stopNorth: jest.fn(),
    getNorth: jest.fn(),
    getSouth: jest.fn(),
    isConnectionUsed: jest.fn(),
    updateNorthConnectorSubscriptions: jest.fn(),
    onSouthItemsChange: jest.fn(),
    addContent: jest.fn(),
    addExternalContent: jest.fn(),
    searchCacheContent: jest.fn(),
    getCacheContentFileStream: jest.fn(),
    removeCacheContent: jest.fn(),
    removeAllCacheContent: jest.fn(),
    moveCacheContent: jest.fn(),
    moveAllCacheContent: jest.fn(),
    updateScanMode: jest.fn(),
    updateSubscriptions: jest.fn(),
    updateSubscription: jest.fn(),
    deleteSouth: jest.fn(),
    deleteNorth: jest.fn(),
    getNorthConnectorMetrics: jest.fn(),
    getSouthConnectorMetrics: jest.fn(),
    getNorthDataStream: jest.fn(),
    getSouthDataStream: jest.fn(),
    resetNorthConnectorMetrics: jest.fn(),
    resetSouthConnectorMetrics: jest.fn()
  };
});
