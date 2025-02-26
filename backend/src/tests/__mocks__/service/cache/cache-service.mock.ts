import { EventEmitter } from 'node:events';

export default jest.fn().mockImplementation(() => {
  return {
    setLogger: jest.fn(),
    start: jest.fn(),
    getCacheContentToSend: jest.fn(),
    addCacheContentToQueue: jest.fn(),
    removeCacheContentFromQueue: jest.fn(),
    getNumberOfElementsInQueue: jest.fn(),
    getNumberOfRawFilesInQueue: jest.fn(),
    compactQueue: jest.fn(),
    cacheIsEmpty: jest.fn(),
    searchCacheContent: jest.fn(),
    metadataFileListToCacheContentList: jest.fn(),
    getCacheContentFileStream: jest.fn(),
    readCacheMetadataFiles: jest.fn(),
    removeCacheContent: jest.fn(),
    removeAllCacheContent: jest.fn(),
    moveCacheContent: jest.fn(),
    moveAllCacheContent: jest.fn(),
    getCacheFiles: jest.fn(),
    getCacheFileContent: jest.fn(),
    updateCacheSize: jest.fn(),
    getFolder: jest.fn(),
    stop: jest.fn(),
    CONTENT_FOLDER: 'content',
    METADATA_FOLDER: 'metadata',
    errorFolder: 'cache',
    archiveFolder: 'error',
    cacheFolder: 'cache',
    cacheSizeEventEmitter: new EventEmitter()
  };
});
