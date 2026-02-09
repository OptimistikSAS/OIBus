import { EventEmitter } from 'node:events';

export default jest.fn().mockImplementation(() => {
  return {
    setLogger: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    getCacheContentToSend: jest.fn(),
    removeCacheContentFromQueue: jest.fn(),
    compactQueue: jest.fn(),
    getNumberOfElementsInQueue: jest.fn(),
    getNumberOfRawFilesInQueue: jest.fn(),
    cacheIsEmpty: jest.fn(),
    cacheIsFull: jest.fn(),
    getCacheSize: jest.fn(),
    searchCacheContent: jest.fn(),
    getFileFromCache: jest.fn(),
    updateCacheContent: jest.fn(),
    addCacheContent: jest.fn(),
    removeAllCacheContent: jest.fn(),
    errorFolder: 'cache',
    archiveFolder: 'error',
    cacheFolder: 'cache',
    cacheSizeEventEmitter: new EventEmitter()
  };
});
