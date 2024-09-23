import { EventEmitter } from 'node:events';

/**
 * Create a mock object for Archive Service
 */
export default class ArchiveServiceMock {
  triggerRun = new EventEmitter();
  start = jest.fn();
  stop = jest.fn();
  archiveOrRemoveFile = jest.fn();
  refreshArchiveFolder = jest.fn();
  removeFileIfTooOld = jest.fn();
  getArchiveFiles = jest.fn();
  getArchiveFileContent = jest.fn();
  removeFiles = jest.fn();
  removeAllArchiveFiles = jest.fn();
  setLogger = jest.fn();
}
