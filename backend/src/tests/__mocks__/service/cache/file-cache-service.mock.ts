import { EventEmitter } from 'node:events';

/**
 * Create a mock object for File Cache Service
 */
export default class FileCacheServiceMock {
  triggerRun = new EventEmitter();
  start = jest.fn();
  getFileToSend = jest.fn();
  removeFileFromQueue = jest.fn();
  cacheFile = jest.fn();
  manageErroredFiles = jest.fn();
  isEmpty = jest.fn();
  getErrorFiles = jest.fn();
  getErrorFileContent = jest.fn();
  removeFiles = jest.fn();
  retryErrorFiles = jest.fn();
  removeAllCacheFiles = jest.fn();
  removeAllErrorFiles = jest.fn();
  retryAllErrorFiles = jest.fn();
  getCacheFiles = jest.fn();
  getCacheFileContent = jest.fn();
  retryFiles = jest.fn();
  retryAllFiles = jest.fn();
  stop = jest.fn();
  setLogger = jest.fn();
}
