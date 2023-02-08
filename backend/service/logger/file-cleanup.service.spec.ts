import fs from 'node:fs/promises';
import path from 'node:path';
import PinoLogger from '../../tests/__mocks__/logger.mock';

import FileCleanupService from './file-cleanup.service';
import { filesExists } from '../utils';
import pino from 'pino';

jest.mock('node:fs/promises');
jest.mock('../utils');

let fileCleanupService: FileCleanupService;

const logger: pino.Logger = new PinoLogger();

describe('FileCleanupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    fileCleanupService = new FileCleanupService('logFolder', logger, 'journal.log', 2);
  });

  it('should properly start and stop', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    fileCleanupService.cleanUpLogFiles = jest.fn();

    await fileCleanupService.start();
    expect(fileCleanupService.cleanUpLogFiles).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(12 * 3600 * 1000); // Advance by half a day
    expect(fileCleanupService.cleanUpLogFiles).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(12 * 3600 * 1000); // Advance by half a day
    expect(fileCleanupService.cleanUpLogFiles).toHaveBeenCalledTimes(2);

    fileCleanupService.stop();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('should properly stop without interval', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    fileCleanupService.stop();
    expect(logger.trace).toHaveBeenCalledWith('Stopping file cleanup service.');
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });

  it('should properly clean up folder', async () => {
    (filesExists as jest.Mock).mockReturnValue(true);
    (fs.readdir as jest.Mock).mockImplementation(() => [
      'journal.log.1',
      'journal.log.2',
      'journal.log.233',
      'journal.log.0.backup',
      'journal.db',
      'migration-journal.log'
    ]);

    (fs.stat as jest.Mock)
      .mockImplementationOnce(() => ({ mtimeMs: 2 }))
      .mockImplementationOnce(() => ({ mtimeMs: 1 }))
      .mockImplementationOnce(() => ({ mtimeMs: 5 }));

    await fileCleanupService.cleanUpLogFiles();
    expect(fs.readdir).toHaveBeenCalledWith(path.resolve('logFolder'));
    expect(logger.trace).toHaveBeenCalledWith(
      'Found 3 log files with RegExp /^journal.log\\.[0-9]*$/ ' + `in folder "${path.resolve('logFolder')}".`
    );
    expect(logger.trace).toHaveBeenCalledWith('Removing 1 log files.');
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('logFolder', 'journal.log.2'));
  });

  it('should not clean up folder if not enough files', async () => {
    (filesExists as jest.Mock).mockReturnValue(true);
    (fs.readdir as jest.Mock).mockImplementation(() => ['journal.log.1', 'journal.log.2']);

    await fileCleanupService.cleanUpLogFiles();
    expect(fs.readdir).toHaveBeenCalledWith(path.resolve('logFolder'));
    expect(logger.trace).toHaveBeenCalledWith(
      'Found 2 log files with RegExp /^journal.log\\.[0-9]*$/ ' + `in folder "${path.resolve('logFolder')}".`
    );
    expect(fs.stat).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('should properly manage file access errors', async () => {
    (filesExists as jest.Mock).mockReturnValue(true);
    (fs.readdir as jest.Mock).mockImplementation(() => [
      'journal.log.1',
      'journal.log.2',
      'journal.log.233',
      'journal.log.3',
      'journal.log.4',
      'journal.log.0.backup',
      'journal.db',
      'migration-journal.log'
    ]);

    (fs.stat as jest.Mock)
      .mockImplementationOnce(() => ({ mtimeMs: 2 }))
      .mockImplementationOnce(() => ({ mtimeMs: 1 }))
      .mockImplementationOnce(() => ({ mtimeMs: 5 }))
      .mockImplementationOnce(() => {
        throw new Error('stat error');
      })
      .mockImplementationOnce(() => ({ mtimeMs: 9 }));

    (fs.unlink as jest.Mock)
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => {
        throw new Error('unlink error');
      });
    await fileCleanupService.cleanUpLogFiles();
    expect(fs.readdir).toHaveBeenCalledWith(path.resolve('logFolder'));
    expect(logger.trace).toHaveBeenCalledWith(
      'Found 5 log files with RegExp /^journal.log\\.[0-9]*$/ ' + `in folder "${path.resolve('logFolder')}".`
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error while reading log file ' + `"${path.resolve('logFolder', 'journal.log.3')}": ${new Error('stat error')}`
    );
    expect(logger.trace).toHaveBeenCalledWith('Removing 2 log files.');
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('logFolder', 'journal.log.2'));
    expect(logger.error).toHaveBeenCalledWith(
      'Error while removing log file ' + `"${path.resolve('logFolder', 'journal.log.1')}": ${new Error('unlink error')}`
    );
  });

  it('should properly return if folder does not exist', async () => {
    (filesExists as jest.Mock).mockReturnValue(false);
    await fileCleanupService.cleanUpLogFiles();
    expect(filesExists).toHaveBeenCalledWith(path.resolve('logFolder'));
    expect(logger.trace).not.toHaveBeenCalled();
  });

  it('should properly catch readdir error', async () => {
    (filesExists as jest.Mock).mockReturnValue(true);
    (fs.readdir as jest.Mock).mockImplementation(() => {
      throw new Error('readdir error');
    });
    await fileCleanupService.cleanUpLogFiles();
    expect(filesExists).toHaveBeenCalledWith(path.resolve('logFolder'));
    expect(logger.trace).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'));
  });
});
