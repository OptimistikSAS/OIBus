import { EventEmitter } from 'node:events';

/**
 * Create a mock object for Archive Service
 */
export default class ArchiveServiceMock {
  start = jest.fn();
  stop = jest.fn();
  archiveOrRemoveFile = jest.fn();
  refreshArchiveFolder = jest.fn();
  removeFileIfTooOld = jest.fn();
  getArchiveFiles = jest.fn(() => [
    { filename: 'file1.name', modificationDate: '', size: 1 },
    { filename: 'file2.name', modificationDate: '', size: 2 },
    { filename: 'file3.name', modificationDate: '', size: 3 }
  ]);
  removeFiles = jest.fn();
  removeAllArchiveFiles = jest.fn();
  setLogger = jest.fn();
  triggerRun: EventEmitter = {
    on: jest.fn(),
    emit: jest.fn()
  } as unknown as EventEmitter;
}
