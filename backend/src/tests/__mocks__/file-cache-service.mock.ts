import { EventEmitter } from 'node:events';

/**
 * Create a mock object for File Cache Service
 */
export default class FileCacheServiceMock {
  start = jest.fn();
  stop = jest.fn();
  getErrorFiles = jest.fn(() => [
    { filename: 'file1.name', modificationDate: '', size: 1 },
    { filename: 'file2.name', modificationDate: '', size: 2 },
    { filename: 'file3.name', modificationDate: '', size: 3 }
  ]);
  cacheFile = jest.fn();
  removeFiles = jest.fn();
  retryErrorFiles = jest.fn();
  removeAllErrorFiles = jest.fn();
  retryAllErrorFiles = jest.fn();
  removeAllCacheFiles = jest.fn();
  getFileToSend = jest.fn();
  removeFileFromQueue = jest.fn();
  manageErroredFiles = jest.fn();
  isEmpty = jest.fn();
  setLogger = jest.fn();
  triggerRun: EventEmitter = {
    on: jest.fn(),
    emit: jest.fn()
  } as unknown as EventEmitter;
}
