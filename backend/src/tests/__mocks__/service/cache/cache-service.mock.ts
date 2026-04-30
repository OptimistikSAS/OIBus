import { EventEmitter } from 'node:events';
import { mock } from 'node:test';

/**
 * Create a mock object for Cache Service
 */
export default class CacheServiceMock {
  setLogger = mock.fn();
  start = mock.fn();
  stop = mock.fn();
  getCacheContentToSend = mock.fn();
  removeCacheContentFromQueue = mock.fn();
  compactQueue = mock.fn();
  getNumberOfElementsInQueue = mock.fn();
  getNumberOfRawFilesInQueue = mock.fn();
  cacheIsEmpty = mock.fn();
  cacheIsFull = mock.fn();
  getCacheSize = mock.fn();
  searchCacheContent = mock.fn();
  getFileFromCache = mock.fn();
  updateCacheContent = mock.fn();
  addCacheContent = mock.fn();
  removeAllCacheContent = mock.fn();
  errorFolder = 'cache';
  archiveFolder = 'error';
  cacheFolder = 'cache';
  cacheSizeEventEmitter = new EventEmitter();
}
