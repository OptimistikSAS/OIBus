import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';

import ArchiveService from './archive.service';

import { DateTime } from 'luxon';
import { createFolder } from '../utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';

import { NorthArchiveSettings } from '../../../../shared/model/north-connector.model';

jest.mock('../../service/utils');
jest.mock('node:fs/promises');
jest.mock('node:fs');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

// Method used to flush promises called in setTimeout
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);
const nowDateString = '2020-02-02T02:02:02.222Z';
let archiveService: ArchiveService;

describe('ArchiveService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
  });

  describe('with enabled service', () => {
    const settings: NorthArchiveSettings = {
      enabled: true,
      retentionDuration: 1
    };
    beforeEach(() => {
      archiveService = new ArchiveService(logger, 'myCacheFolder', settings);
    });

    it('should be properly initialized with archive enabled', async () => {
      archiveService.refreshArchiveFolder = jest.fn();
      await archiveService.start();
      expect(archiveService.archiveFolder).toEqual(path.resolve('myCacheFolder', 'archive'));
      expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'archive'));
      expect(archiveService.refreshArchiveFolder).not.toHaveBeenCalled();

      jest.advanceTimersByTime(10000);
      expect(archiveService.refreshArchiveFolder).toHaveBeenCalledTimes(1);
    });

    it('should properly stop', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      await archiveService.stop();
      expect(clearTimeoutSpy).not.toHaveBeenCalled();

      await archiveService.start();
      await archiveService.stop();
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    });

    it('should properly move file from cache to archive folder', async () => {
      (fs.rename as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => {
          throw new Error('rename error');
        });

      await archiveService.archiveOrRemoveFile('myFile.csv');
      expect(logger.debug).toHaveBeenCalledWith(
        `File "myFile.csv" moved to archive folder "${path.resolve(archiveService.archiveFolder, 'myFile.csv')}"`
      );

      await archiveService.archiveOrRemoveFile('myFile.csv');
      expect(logger.error).toHaveBeenCalledWith(`Could not move "myFile.csv" from cache: ${new Error('rename error')}`);
    });

    it('should refresh archive folder', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      (fs.readdir as jest.Mock).mockImplementationOnce(() => []).mockImplementation(() => ['myFile1', 'myFile2']);
      archiveService.removeFileIfTooOld = jest.fn();

      await archiveService.refreshArchiveFolder();
      expect(clearTimeoutSpy).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Parse archive folder to remove old files');
      expect(logger.debug).toHaveBeenCalledWith(
        `The archive folder "${path.resolve('myCacheFolder', 'archive')}" is empty. Nothing to delete`
      );

      jest.advanceTimersByTime(3600000);
      await flushPromises();

      expect(archiveService.removeFileIfTooOld).toHaveBeenCalledTimes(2);
    });

    it('should manage archive folder readdir error', async () => {
      (fs.readdir as jest.Mock).mockImplementationOnce(() => {
        throw new Error('readdir error');
      });
      archiveService.removeFileIfTooOld = jest.fn();

      await archiveService.refreshArchiveFolder();
      expect(archiveService.removeFileIfTooOld).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        `Error reading archive folder "${path.resolve('myCacheFolder', 'archive')}": ${new Error('readdir error')}`
      );
    });

    it('should remove file if too old', async () => {
      (fs.stat as jest.Mock)
        .mockImplementationOnce(() => ({ mtimeMs: new Date('2020-02-01T02:02:02.222Z').getTime() }))
        .mockImplementationOnce(() => ({ mtimeMs: new Date('2020-02-02T02:02:01.222Z').getTime() }));

      await archiveService.removeFileIfTooOld('myOldFile.csv', new Date().getTime(), 'archiveFolder');
      expect(fs.unlink).toHaveBeenCalledWith(path.resolve('archiveFolder', 'myOldFile.csv'));
      expect(logger.debug).toHaveBeenCalledWith(`File "${path.resolve('archiveFolder', 'myOldFile.csv')}" removed from archive`);
      await archiveService.removeFileIfTooOld('myNewFile.csv', new Date().getTime(), 'archiveFolder');
      expect(logger.debug).toHaveBeenCalledTimes(1);
      expect(fs.unlink).toHaveBeenCalledTimes(1);
    });

    it('should log an error if can not remove old file', async () => {
      (fs.stat as jest.Mock).mockImplementationOnce(() => ({ mtimeMs: new Date('2020-02-01T02:02:02.222Z').getTime() }));
      (fs.unlink as jest.Mock).mockImplementationOnce(() => {
        throw new Error('unlink error');
      });

      await archiveService.removeFileIfTooOld('myOldFile.csv', new Date().getTime(), 'archiveFolder');
      expect(logger.error).toHaveBeenCalledWith(
        `Could not remove old file "${path.resolve('archiveFolder', 'myOldFile.csv')}" from archive: ${new Error('unlink error')}`
      );
    });

    it('should log an error if a problem occur accessing the file', async () => {
      (fs.stat as jest.Mock).mockImplementationOnce(() => {
        throw new Error('stat error');
      });

      await archiveService.removeFileIfTooOld('myOldFile.csv', new Date().getTime(), 'archiveFolder');
      expect(fs.unlink).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        `Could not read stats from archive file "${path.resolve('archiveFolder', 'myOldFile.csv')}": ${new Error('stat error')}`
      );
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should properly change logger', async () => {
      (fs.readdir as jest.Mock).mockReturnValue([]);
      archiveService.setLogger(anotherLogger);
      await archiveService.refreshArchiveFolder();
      expect(logger.debug).not.toHaveBeenCalled();
      expect(anotherLogger.debug).toHaveBeenCalledWith('Parse archive folder to remove old files');
    });

    it('should properly get archived files', async () => {
      const fileError = new Error('error file');
      (fs.readdir as jest.Mock).mockImplementation(() => ['file1', 'file2', 'file3', 'anotherFile', 'errorFile']);
      (fs.stat as jest.Mock)
        .mockImplementationOnce(() => ({ mtimeMs: DateTime.fromISO('2020-02-02T04:02:02.222Z').toMillis(), size: 1 }))
        .mockImplementationOnce(() => ({ mtimeMs: DateTime.fromISO('2020-02-02T06:02:02.222Z').toMillis(), size: 2 }))
        .mockImplementationOnce(() => ({ mtimeMs: DateTime.fromISO('2020-02-04T02:02:02.222Z').toMillis(), size: 3 }))
        .mockImplementationOnce(() => ({ mtimeMs: DateTime.fromISO('2020-02-05T02:02:02.222Z').toMillis(), size: 4 }))
        .mockImplementationOnce(() => {
          throw fileError;
        });

      const files = await archiveService.getArchiveFiles('2020-02-02T02:02:02.222Z', '2020-02-03T02:02:02.222Z', 'file');

      expect(files).toEqual([
        { filename: 'file1', modificationDate: '2020-02-02T04:02:02.222Z', size: 1 },
        { filename: 'file2', modificationDate: '2020-02-02T06:02:02.222Z', size: 2 }
      ]);
      expect(logger.error).toHaveBeenCalledWith(
        `Error while reading in archive folder file stats "${path.resolve('myCacheFolder', 'archive', 'errorFile')}": ${fileError}`
      );
    });

    it('should properly get archived files without filtering', async () => {
      (fs.readdir as jest.Mock).mockImplementation(() => ['file1', 'file2']);
      (fs.stat as jest.Mock)
        .mockReturnValueOnce({ mtimeMs: DateTime.fromISO('2000-02-02T02:02:02.222Z').toMillis(), size: 100 })
        .mockReturnValueOnce({ mtimeMs: DateTime.fromISO('2030-02-02T02:02:02.222Z').toMillis(), size: 60 });

      const files = await archiveService.getArchiveFiles('', '', '');

      expect(files).toEqual([
        { filename: 'file1', modificationDate: '2000-02-02T02:02:02.222Z', size: 100 },
        {
          filename: 'file2',
          modificationDate: '2030-02-02T02:02:02.222Z',
          size: 60
        }
      ]);
    });

    it('should remove files from archive folder with error handling', async () => {
      const filenames = ['file1', 'file2', 'errorFile'];
      const resolvedFiles = filenames.map(file => [path.resolve('myCacheFolder', 'archive', file)]);
      const logs = resolvedFiles.map(file => [`Removing archived file "${file}`]);

      (fs.stat as jest.Mock).mockReturnValue({ size: 123 });
      (fs.unlink as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => {
          throw new Error(`Can't remove file`);
        });

      await archiveService.removeFiles(filenames);
      expect((fs.unlink as jest.Mock).mock.calls).toEqual(resolvedFiles);

      expect((logger.debug as jest.Mock).mock.calls).toEqual(logs);
      expect(logger.error).toHaveBeenCalledWith(
        `Unable to remove archived file "${path.resolve('myCacheFolder', 'archive', filenames[2])}"`
      );
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should remove all archived files', async () => {
      const filenames = ['file1', 'file2', 'file3'];
      (fs.readdir as jest.Mock).mockImplementation(() => filenames);
      archiveService.removeFiles = jest.fn(() => Promise.resolve());

      await archiveService.removeAllArchiveFiles();

      expect(archiveService.removeFiles).toHaveBeenCalledWith(filenames);
      expect(archiveService.removeFiles).toHaveBeenCalledTimes(1);

      expect(logger.debug).toHaveBeenLastCalledWith(
        `Removing ${filenames.length} files from "${path.resolve('myCacheFolder', 'archive')}"`
      );
      expect(logger.debug).toHaveBeenCalledTimes(1);
    });

    it('should properly handle removing all files when folder is empty', async () => {
      (fs.readdir as jest.Mock).mockImplementation(() => []);
      const removeFilesSpy = jest.spyOn(archiveService, 'removeFiles').mockImplementation(() => Promise.resolve());

      await archiveService.removeAllArchiveFiles();

      expect(removeFilesSpy).toHaveBeenCalledTimes(0);

      expect(logger.debug).toHaveBeenLastCalledWith(
        `The archive folder "${path.resolve('myCacheFolder', 'archive')}" is empty. Nothing to delete`
      );
      expect(logger.debug).toHaveBeenCalledTimes(1);

      removeFilesSpy.mockRestore();
    });

    it('should properly get archived file content', async () => {
      const filename = 'myFile.csv';
      (createReadStream as jest.Mock).mockImplementation(() => Promise.resolve());
      await archiveService.getArchiveFileContent(filename);

      expect(createReadStream).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'archive', filename));
    });

    it('should handle error while getting archived file content', async () => {
      const filename = 'myFile.csv';
      const error = new Error('file does not exist');
      (fs.stat as jest.Mock).mockImplementation(() => {
        throw error;
      });
      const readStream = await archiveService.getArchiveFileContent(filename);

      expect(readStream).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        `Error while reading file "${path.resolve('myCacheFolder', 'archive', filename)}": ${error}`
      );
    });
  });

  describe('with disabled service', () => {
    const settings: NorthArchiveSettings = {
      enabled: false,
      retentionDuration: 1
    };
    beforeEach(() => {
      archiveService = new ArchiveService(logger, 'myCacheFolder', settings);
    });

    it('should be properly initialized with archive disabled', async () => {
      archiveService.refreshArchiveFolder = jest.fn();
      await archiveService.start();

      jest.advanceTimersByTime(10000);
      expect(archiveService.refreshArchiveFolder).not.toHaveBeenCalled();
    });

    it('should properly remove file from cache', async () => {
      (fs.unlink as jest.Mock)
        .mockImplementationOnce(() => Promise.resolve())
        .mockImplementationOnce(() => {
          throw new Error('unlink error');
        });

      await archiveService.archiveOrRemoveFile('myFile.csv');
      expect(logger.debug).toHaveBeenCalledWith('File "myFile.csv" removed from disk');

      await archiveService.archiveOrRemoveFile('myFile.csv');
      expect(logger.error).toHaveBeenCalledWith(`Could not remove "myFile.csv" from cache: ${new Error('unlink error')}`);
    });
  });
});
