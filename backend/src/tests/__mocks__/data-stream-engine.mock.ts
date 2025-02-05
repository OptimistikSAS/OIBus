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
    updateNorthConnectorSubscriptions: jest.fn(),
    onSouthItemsChange: jest.fn(),
    addContent: jest.fn(),
    addExternalContent: jest.fn(),
    getErrorFiles: jest.fn(),
    getErrorFileContent: jest.fn(),
    removeErrorFiles: jest.fn(),
    retryErrorFiles: jest.fn(),
    removeAllErrorFiles: jest.fn(),
    retryAllErrorFiles: jest.fn(),
    getCacheFiles: jest.fn(),
    getCacheFileContent: jest.fn(),
    removeCacheFiles: jest.fn(),
    removeAllCacheFiles: jest.fn(),
    archiveCacheFiles: jest.fn(),
    getArchiveFiles: jest.fn(),
    getArchiveFileContent: jest.fn(),
    removeArchiveFiles: jest.fn(),
    retryArchiveFiles: jest.fn(),
    removeAllArchiveFiles: jest.fn(),
    retryAllArchiveFiles: jest.fn(),
    getCacheValues: jest.fn(),
    removeCacheValues: jest.fn(),
    removeAllCacheValues: jest.fn(),
    getErrorValues: jest.fn(),
    removeAllErrorValues: jest.fn(),
    removeErrorValues: jest.fn(),
    retryErrorValues: jest.fn(),
    retryAllErrorValues: jest.fn(),
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
