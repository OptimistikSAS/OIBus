import { EventEmitter } from 'node:events';

/**
 * Create a mock object for File Cache Service
 */
export default class FileCacheServiceMock {
  triggerRun = new EventEmitter();
  setLogger = jest.fn();
  start = jest.fn();
  getFileToSend = jest.fn();
  removeFileFromQueue = jest.fn();
  cacheFile = jest.fn();
  manageErroredFiles = jest.fn();
  archiveOrRemoveFile = jest.fn();
  isEmpty = jest.fn();
  getErrorFiles = jest.fn();
  getErrorFileContent = jest.fn();
  getArchiveFiles = jest.fn();
  getArchiveFileContent = jest.fn();
  removeCacheFiles = jest.fn();
  removeErrorFiles = jest.fn();
  removeFileFromArchiveIfTooOld = jest.fn();
  refreshArchiveFolder = jest.fn();
  removeArchiveFiles = jest.fn();
  retryArchiveFiles = jest.fn();
  retryErrorFiles = jest.fn();
  removeAllCacheFiles = jest.fn();
  removeAllErrorFiles = jest.fn();
  removeAllArchiveFiles = jest.fn();
  retryAllArchiveFiles = jest.fn();
  retryAllErrorFiles = jest.fn();
  getCacheFiles = jest.fn();
  getCacheFileContent = jest.fn();
  stop = jest.fn();
}
