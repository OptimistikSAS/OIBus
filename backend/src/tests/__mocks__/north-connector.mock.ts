/**
 * Create a mock object for North Connector
 */
export default jest.fn().mockImplementation(settings => {
  return {
    start: jest.fn().mockImplementation(() => Promise.resolve()),
    isEnabled: jest.fn(),
    updateConnectorSubscription: jest.fn(),
    connect: jest.fn(),
    createCronJob: jest.fn(),
    addToQueue: jest.fn(),
    createDeferredPromise: jest.fn(),
    resolveDeferredPromise: jest.fn(),
    run: jest.fn(),
    handleContentWrapper: jest.fn(),
    handleValuesWrapper: jest.fn(),
    handleFilesWrapper: jest.fn(),
    createOIBusError: jest.fn(),
    cacheValues: jest.fn(),
    cacheFile: jest.fn(),
    isSubscribed: jest.fn(),
    isCacheEmpty: jest.fn(),
    disconnect: jest.fn(),
    stop: jest.fn(),
    setLogger: jest.fn(),
    updateScanMode: jest.fn(),
    getErrorFiles: jest.fn(),
    getErrorFileContent: jest.fn(),
    removeErrorFiles: jest.fn(),
    retryErrorFiles: jest.fn(),
    removeAllErrorFiles: jest.fn(),
    retryAllErrorFiles: jest.fn(),
    getCacheFiles: jest.fn(),
    getCacheFileContent: jest.fn(),
    removeCacheFiles: jest.fn(),
    archiveCacheFiles: jest.fn(),
    getArchiveFiles: jest.fn(),
    getArchiveFileContent: jest.fn(),
    removeArchiveFiles: jest.fn(),
    retryArchiveFiles: jest.fn(),
    removeAllArchiveFiles: jest.fn(),
    retryAllArchiveFiles: jest.fn(),
    getMetricsDataStream: jest.fn(),
    resetMetrics: jest.fn(),
    resetCache: jest.fn(),
    getCacheValues: jest.fn(),
    removeCacheValues: jest.fn(),
    removeAllCacheValues: jest.fn(),
    getValueErrors: jest.fn(),
    removeValueErrors: jest.fn(),
    removeAllValueErrors: jest.fn(),
    retryValueErrors: jest.fn(),
    retryAllValueErrors: jest.fn(),
    settings: settings
  };
});
