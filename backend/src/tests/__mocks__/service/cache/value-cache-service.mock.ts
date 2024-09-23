import { EventEmitter } from 'node:events';

/**
 * Create a mock object for Value Cache Service
 */
export default class ValueCacheServiceMock {
  triggerRun = new EventEmitter();
  valueFolder = 'valueFolder';
  start = jest.fn();
  getValuesToSend = jest.fn();
  removeSentValues = jest.fn();
  removeAllValues = jest.fn();
  manageErroredValues = jest.fn();
  cacheValues = jest.fn();
  isEmpty = jest.fn();
  getQueuedFilesMetadata = jest.fn();
  getErrorValueFiles = jest.fn();
  removeErrorValues = jest.fn();
  removeAllErrorValues = jest.fn();
  retryErrorValues = jest.fn();
  retryAllErrorValues = jest.fn();
  stop = jest.fn();
  setLogger = jest.fn();
}
