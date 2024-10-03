import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';

import FileCache from './file-cache.service';
import { createFolder, getFilesFiltered } from '../utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';

import { flushPromises, mockBaseFolders } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthItemSettings, NorthSettings } from '../../../shared/model/north-settings.model';

jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

describe('FileCacheService without sendFileImmediately', () => {
  let settings: NorthConnectorEntity<NorthSettings, NorthItemSettings>;
  let service: FileCache;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    settings = testData.north.list[0];

    service = new FileCache(
      logger,
      mockBaseFolders('northId').cache,
      mockBaseFolders('northId').error,
      mockBaseFolders('northId').archive,
      settings
    );
  });

  it('should be properly initialized with files in cache', async () => {
    (fs.readdir as jest.Mock).mockImplementation(() => ['file1', 'file2']);
    (fs.stat as jest.Mock).mockImplementationOnce(() => ({ ctimeMs: 2 })).mockImplementationOnce(() => ({ ctimeMs: 1 }));
    service.settings = settings;
    await service.start();
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'files'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').error, 'files'));
    expect(logger.debug).toHaveBeenCalledWith('2 files in cache');
    expect(logger.warn).toHaveBeenCalledWith('2 files in error cache');
  });

  it('should be properly initialized with files in cache but none in error', async () => {
    (fs.readdir as jest.Mock).mockImplementationOnce(() => ['file1', 'file2']).mockImplementationOnce(() => []);
    (fs.stat as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('stat error');
      })
      .mockImplementationOnce(() => ({ ctimeMs: 1 }));

    await service.start();
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'files'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').error, 'files'));

    expect(logger.debug).toHaveBeenCalledWith('1 files in cache');
    expect(logger.error).toHaveBeenCalledWith(
      'Error while reading cache file ' + `"${path.resolve(mockBaseFolders('northId').cache, 'files', 'file1')}": stat error`
    );
  });

  it('should be properly initialized without files in cache', async () => {
    (fs.readdir as jest.Mock).mockImplementation(() => []);
    await service.start();
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'files'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').error, 'files'));

    expect(logger.debug).toHaveBeenCalledWith('No files in cache');
    expect(logger.debug).toHaveBeenCalledWith('No error file in cache');
  });

  it('should properly cache file', async () => {
    (fs.stat as jest.Mock).mockImplementation(() => ({ size: 123 }));

    await service.cacheFile('myFile.csv');

    expect(fs.copyFile).toHaveBeenCalledWith(
      'myFile.csv',
      path.resolve(mockBaseFolders('northId').cache, 'files', 'myFile-1609545600000.csv')
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `File "myFile.csv" cached in "${path.resolve(mockBaseFolders('northId').cache, 'files', 'myFile-1609545600000.csv')}"`
    );
  });

  it('should properly cache file without appending timestamp', async () => {
    (fs.stat as jest.Mock).mockImplementation(() => ({ size: 123 }));

    // When retrying an archived file, it will already have a timestamp, so we skip adding another
    await service.cacheFile('myFile-1609545600000.csv', false);
    const cacheFilePath = path.resolve(mockBaseFolders('northId').cache, 'files', 'myFile-1609545600000.csv');

    expect(fs.copyFile).toHaveBeenCalledWith('myFile-1609545600000.csv', cacheFilePath);
    expect(logger.debug).toHaveBeenCalledWith(`File "myFile-1609545600000.csv" cached in "${cacheFilePath}"`);
  });

  it('should properly managed cache file error', async () => {
    (fs.copyFile as jest.Mock).mockImplementation(() => {
      throw new Error('copy file');
    });

    let error;
    try {
      await service.cacheFile('myFile.csv');
    } catch (copyError) {
      error = copyError;
    }

    expect(error).toEqual(new Error('copy file'));
  });

  it('should check if cache is empty', async () => {
    (fs.readdir as jest.Mock)
      .mockImplementationOnce(() => [])
      .mockImplementationOnce(() => ['myFile1', 'myFile2'])
      .mockImplementationOnce(() => {
        throw new Error('readdir error');
      });
    const empty = await service.isEmpty();
    expect(empty).toBeTruthy();
    const notEmpty = await service.isEmpty();
    expect(notEmpty).toBeFalsy();

    const emptyBecauseOfError = await service.isEmpty();
    expect(emptyBecauseOfError).toBeTruthy();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'));
  });

  it('should properly manage error files', async () => {
    (fs.rename as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('rename error');
      });
    service.removeFileFromQueue = jest.fn();

    await service.manageErroredFiles('myFile.csv', 1);
    expect(logger.warn).toHaveBeenCalledWith(
      `File "myFile.csv" moved to "${path.resolve(mockBaseFolders('northId').error, 'files', 'myFile.csv')}" after 1 errors`
    );
    expect(service.removeFileFromQueue).toHaveBeenCalledWith('myFile.csv');
    expect(service.removeFileFromQueue).toHaveBeenCalledTimes(1);

    await service.manageErroredFiles('myFile.csv', 1);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while moving file "myFile.csv" to "${path.resolve(mockBaseFolders('northId').error, 'files', 'myFile.csv')}": rename error`
    );
    expect(service.removeFileFromQueue).toHaveBeenCalledTimes(2);
  });

  it('should retry files from error folder', async () => {
    // Used to retry files from error and archive folders
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    const cacheFileArgs = filenames.map(filename => [path.resolve(mockBaseFolders('northId').error, 'files', filename), false]);
    const removeFilesArgs = filenames.map(filename => [[filename]]);
    const loggerArgs = filenames.map(filename => {
      const fromFilePath = path.resolve(mockBaseFolders('northId').error, 'files', filename);
      const cacheFilePath = path.resolve(mockBaseFolders('northId').cache, 'files', filename);
      return [`Moving file "${fromFilePath}" back to cache "${cacheFilePath}"`];
    });
    service.cacheFile = jest.fn();
    service.removeErrorFiles = jest.fn();

    await service.retryErrorFiles(filenames);

    expect((service.cacheFile as jest.Mock).mock.calls).toEqual(cacheFileArgs);
    expect((service.removeErrorFiles as jest.Mock).mock.calls).toEqual(removeFilesArgs);
    expect((logger.debug as jest.Mock).mock.calls).toEqual(loggerArgs);
  });

  it('should retry all files from error folder', async () => {
    // Used to retry all files from error and archive folders
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    (fs.readdir as jest.Mock).mockImplementationOnce(() => filenames);
    service.retryErrorFiles = jest.fn();

    await service.retryAllErrorFiles();

    expect(fs.readdir).toHaveBeenCalledWith(service.errorFolder);
    expect(service.retryErrorFiles).toHaveBeenCalledWith(filenames);
    expect(service.retryErrorFiles).toHaveBeenCalledTimes(1);
  });

  it('should retry files from archive folder', async () => {
    // Used to retry files from error and archive folders
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    const cacheFileArgs = filenames.map(filename => [path.resolve(mockBaseFolders('northId').archive, 'files', filename), false]);
    const removeFilesArgs = filenames.map(filename => [[filename]]);
    const loggerArgs = filenames.map(filename => {
      const fromFilePath = path.resolve(mockBaseFolders('northId').archive, 'files', filename);
      const cacheFilePath = path.resolve(mockBaseFolders('northId').cache, 'files', filename);
      return [`Moving file "${fromFilePath}" back to cache "${cacheFilePath}"`];
    });
    service.cacheFile = jest.fn();
    service.removeArchiveFiles = jest.fn();

    await service.retryArchiveFiles(filenames);

    expect((service.cacheFile as jest.Mock).mock.calls).toEqual(cacheFileArgs);
    expect((service.removeArchiveFiles as jest.Mock).mock.calls).toEqual(removeFilesArgs);
    expect((logger.debug as jest.Mock).mock.calls).toEqual(loggerArgs);
  });

  it('should retry all files from archive folder', async () => {
    // Used to retry all files from error and archive folders
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    (fs.readdir as jest.Mock).mockImplementationOnce(() => filenames);
    service.retryArchiveFiles = jest.fn();

    await service.retryAllArchiveFiles();

    expect(fs.readdir).toHaveBeenCalledWith(service.archiveFolder);
    expect(service.retryArchiveFiles).toHaveBeenCalledWith(filenames);
    expect(service.retryArchiveFiles).toHaveBeenCalledTimes(1);
  });

  it('should handle retrying all files when archive folder is empty', async () => {
    (fs.readdir as jest.Mock).mockImplementationOnce(() => []);

    await service.retryAllArchiveFiles();

    expect(logger.debug).toHaveBeenCalledWith(
      `The folder "${path.resolve(mockBaseFolders('northId').archive, 'files')}" is empty. Nothing to delete`
    );
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });

  it('should handle retrying all files when folder is empty', async () => {
    (fs.readdir as jest.Mock).mockImplementationOnce(() => []);

    await service.retryAllErrorFiles();

    expect(logger.debug).toHaveBeenCalledWith(
      `The folder "${path.resolve(mockBaseFolders('northId').error, 'files')}" is empty. Nothing to delete`
    );
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });

  it('should remove error files from folder', async () => {
    // Used to remove files from error and archive folders
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    fs.stat = jest
      .fn()
      .mockImplementationOnce(() => ({ size: 1 }))
      .mockImplementationOnce(() => ({ size: 2 }))
      .mockImplementationOnce(() => ({ size: 3 }));
    (fs.unlink as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('unlink error');
      });

    await service.removeErrorFiles(filenames);

    expect(fs.unlink).toHaveBeenNthCalledWith(1, path.join(path.resolve(mockBaseFolders('northId').error, 'files'), filenames[0]));
    expect(fs.unlink).toHaveBeenNthCalledWith(2, path.join(path.resolve(mockBaseFolders('northId').error, 'files'), filenames[1]));
    expect(fs.unlink).toHaveBeenNthCalledWith(3, path.join(path.resolve(mockBaseFolders('northId').error, 'files'), filenames[2]));
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing error file "${path.resolve(mockBaseFolders('northId').error, 'files', 'file3.name')}": unlink error`
    );
  });

  it('should remove all error files when the error folder is not empty', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve(filenames));
    service.removeErrorFiles = jest.fn();

    await service.removeAllErrorFiles();
    expect(service.removeErrorFiles).toHaveBeenCalledWith(filenames);
  });

  it('should not remove any error file when the error folder is empty', async () => {
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve([]));
    service.removeErrorFiles = jest.fn();

    await service.removeAllErrorFiles();
    expect(service.removeErrorFiles).not.toHaveBeenCalled();
  });

  it('should remove all cache files when the folder is not empty', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve(filenames));
    service.removeCacheFiles = jest.fn();

    await service.removeAllCacheFiles();
    expect(service.removeCacheFiles).toHaveBeenCalledWith(filenames);
  });

  it('should not remove any cache file when the folder is empty', async () => {
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve([]));
    service.removeCacheFiles = jest.fn();

    await service.removeAllCacheFiles();
    expect(service.removeCacheFiles).not.toHaveBeenCalled();
  });

  it('should remove cache files', async () => {
    (fs.stat as jest.Mock).mockReturnValueOnce({ size: 123 }).mockReturnValueOnce({ size: 123 });
    (fs.unlink as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('unlink error');
      });
    await service.removeCacheFiles(['file1', 'file2']);
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve(service.cacheFolder, 'file1'));
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve(service.cacheFolder, 'file2'));
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing cache file "${path.resolve(service.cacheFolder, 'file2')}": unlink error`
    );
  });

  it('should not remove any error file when the error folder is empty', async () => {
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve([]));
    service.retryErrorFiles = jest.fn();

    await service.retryAllErrorFiles();
    expect(service.retryErrorFiles).not.toHaveBeenCalled();
  });

  it('should properly get and remove file from queue', async () => {
    (fs.stat as jest.Mock).mockImplementation(() => ({ size: 123 }));
    (fs.copyFile as jest.Mock).mockImplementation(() => Promise.resolve());

    const noFile = service.getFileToSend();

    expect(noFile).toBeNull();

    await service.cacheFile('myFile.csv');
    const file = service.getFileToSend();

    expect(file).toEqual(path.resolve(mockBaseFolders('northId').cache, 'files', 'myFile-1609545600000.csv'));

    service.removeFileFromQueue();
    const noMoreFile = service.getFileToSend();
    expect(noMoreFile).toBeNull();
  });

  it('should properly remove a specific file from queue', async () => {
    (fs.stat as jest.Mock).mockImplementation(() => ({ size: 123 }));

    const noFile = service.getFileToSend();

    expect(noFile).toBeNull();

    await service.cacheFile('myFile1.csv');
    await service.cacheFile('myFile2.csv');
    await service.cacheFile('myFile3.csv');
    await service.cacheFile('myFile4.csv');

    service.removeFileFromQueue(path.resolve(mockBaseFolders('northId').cache, 'files', 'myFile3-1609545600000.csv'));
    expect(service['filesQueue']).toEqual([
      path.resolve(mockBaseFolders('northId').cache, 'files', 'myFile1-1609545600000.csv'),
      path.resolve(mockBaseFolders('northId').cache, 'files', 'myFile2-1609545600000.csv'),
      path.resolve(mockBaseFolders('northId').cache, 'files', 'myFile4-1609545600000.csv')
    ]);
  });

  it('should properly get error files', async () => {
    await service.getErrorFiles('2020-02-02T02:02:02.222Z', '2020-02-03T02:02:02.222Z', 'file');
    expect(getFilesFiltered).toHaveBeenCalled();
  });

  it('should properly get cache files', async () => {
    await service.getCacheFiles('2020-02-02T02:02:02.222Z', '2020-02-03T02:02:02.222Z', 'file');
    expect(getFilesFiltered).toHaveBeenCalled();
  });

  it('should properly change logger', async () => {
    (fs.readdir as jest.Mock).mockReturnValue([]);
    service.setLogger(anotherLogger);
    await service.start();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(anotherLogger.debug).toHaveBeenCalledWith(`No files in cache`);
  });

  it('should properly get error file content', async () => {
    const filename = 'myFile.csv';
    (createReadStream as jest.Mock).mockImplementation(() => Promise.resolve());
    await service.getErrorFileContent(filename);

    expect(createReadStream).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').error, 'files', filename));
  });

  it('should handle error when getting error file content', async () => {
    const filename = 'myFile.csv';
    const error = new Error('file does not exist');
    (fs.stat as jest.Mock).mockImplementation(() => {
      throw error;
    });
    await service.getErrorFileContent(filename);

    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${path.resolve(mockBaseFolders('northId').error, 'files', filename)}": ${error}`
    );
  });

  it('should properly get cache file content', async () => {
    (fs.stat as jest.Mock).mockReturnValue({ size: 123 });
    const filename = 'myFile.csv';
    (createReadStream as jest.Mock).mockImplementation(() => Promise.resolve());
    await service.getCacheFileContent(filename);

    expect(fs.stat).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'files', filename));
    expect(createReadStream).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'files', filename));
  });

  it('should handle error when getting cache file content', async () => {
    const filename = 'myFile.csv';
    const error = new Error('file does not exist');
    (fs.stat as jest.Mock).mockImplementation(() => {
      throw error;
    });
    await service.getCacheFileContent(filename);

    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${path.resolve(mockBaseFolders('northId').cache, 'files', filename)}": ${error}`
    );
  });

  it('should be properly initialized with archive disabled', async () => {
    service.refreshArchiveFolder = jest.fn();
    await service.start();

    jest.advanceTimersByTime(10000);
    expect(service.refreshArchiveFolder).not.toHaveBeenCalled();
  });

  it('should properly remove file from cache', async () => {
    (fs.unlink as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('unlink error');
      });
    (fs.stat as jest.Mock).mockReturnValue({ size: 123 });

    await service.archiveOrRemoveFile('myFile.csv');
    expect(logger.debug).toHaveBeenCalledWith('File "myFile.csv" removed from disk');

    await service.archiveOrRemoveFile('myFile.csv');
    expect(logger.error).toHaveBeenCalledWith(`Could not remove "myFile.csv" from cache: unlink error`);
  });
});

describe('FileCacheService with sendFileImmediately', () => {
  let settings: NorthConnectorEntity<NorthSettings, NorthItemSettings>;
  let service: FileCache;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    settings = JSON.parse(JSON.stringify(testData.north.list[0]));
    settings.caching.rawFiles.sendFileImmediately = true;
    settings.caching.rawFiles.archive.enabled = true;
    settings.caching.rawFiles.archive.retentionDuration = 1;

    (fs.readdir as jest.Mock).mockImplementation(() => ['file1', 'file2']);

    service = new FileCache(
      logger,
      mockBaseFolders('northId').cache,
      mockBaseFolders('northId').error,
      mockBaseFolders('northId').archive,
      settings
    );
  });

  it('should be properly initialized with files in cache', async () => {
    (fs.stat as jest.Mock).mockImplementationOnce(() => ({ ctimeMs: 2 })).mockImplementationOnce(() => ({ ctimeMs: 1 }));

    await service.start();
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'files'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').error, 'files'));

    expect(logger.debug).toHaveBeenCalledWith('2 files in cache');
    expect(logger.warn).toHaveBeenCalledWith('2 files in error cache');
    expect(logger.trace).toHaveBeenCalledWith('Trigger next file send');
  });

  it('should be properly initialized with files in cache and properly remove and trigger', async () => {
    (fs.stat as jest.Mock).mockImplementationOnce(() => ({ ctimeMs: 2 })).mockImplementationOnce(() => ({ ctimeMs: 1 }));

    await service.start();
    service.removeFileFromQueue();
    expect(`There are 1 files in queue left. Triggering next send`);
  });

  it('should send file immediately', async () => {
    (fs.stat as jest.Mock).mockImplementation(() => ({ size: 123 }));

    await service.cacheFile('myFile.csv');
  });

  it('should be properly initialized with archive enabled', async () => {
    await service.start();
    expect(service.archiveFolder).toEqual(path.resolve(mockBaseFolders('northId').archive, 'files'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').archive, 'files'));
    expect(logger.trace).not.toHaveBeenCalledWith('Parse archive folder to remove old files');
    jest.advanceTimersByTime(10_000);

    expect(logger.trace).toHaveBeenCalledWith('Parse archive folder to remove old files');
  });

  it('should properly stop', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await service.stop();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    await service.start();
    await service.stop();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  });

  it('should properly move file from cache to archive folder', async () => {
    (fs.rename as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('rename error');
      });

    await service.archiveOrRemoveFile('myFile.csv');
    expect(logger.debug).toHaveBeenCalledWith(
      `File "myFile.csv" moved to archive folder "${path.resolve(service.archiveFolder, 'myFile.csv')}"`
    );

    await service.archiveOrRemoveFile('myFile.csv');
    expect(logger.error).toHaveBeenCalledWith(`Could not move "myFile.csv" from cache: rename error`);
  });

  it('should refresh archive folder', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    (fs.readdir as jest.Mock).mockImplementationOnce(() => []).mockImplementation(() => ['myFile1', 'myFile2']);
    service.removeFileFromArchiveIfTooOld = jest.fn();

    await service.refreshArchiveFolder();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(logger.trace).toHaveBeenCalledWith('Parse archive folder to remove old files');
    expect(logger.trace).toHaveBeenCalledWith(
      `The archive folder "${path.resolve(mockBaseFolders('northId').archive, 'files')}" is empty. Nothing to delete`
    );

    jest.advanceTimersByTime(600_000);
    await flushPromises();

    expect(service.removeFileFromArchiveIfTooOld).toHaveBeenCalledTimes(2);
  });

  it('should manage archive folder readdir error', async () => {
    (fs.readdir as jest.Mock).mockImplementationOnce(() => {
      throw new Error('readdir error');
    });
    service.removeFileFromArchiveIfTooOld = jest.fn();

    await service.refreshArchiveFolder();
    expect(service.removeFileFromArchiveIfTooOld).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      `Error reading archive folder "${path.resolve(mockBaseFolders('northId').archive, 'files')}": readdir error`
    );
  });

  it('should remove file if too old', async () => {
    (fs.stat as jest.Mock)
      .mockImplementationOnce(() => ({ mtimeMs: new Date('2020-02-01T02:02:02.222Z').getTime() }))
      .mockImplementationOnce(() => ({ mtimeMs: new Date('2020-02-02T02:02:01.222Z').getTime() }));

    await service.removeFileFromArchiveIfTooOld('myOldFile.csv', new Date().getTime(), 'archiveFolder');
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('archiveFolder', 'myOldFile.csv'));
    expect(logger.debug).toHaveBeenCalledWith(`File "${path.resolve('archiveFolder', 'myOldFile.csv')}" removed from archive`);
    await service.removeFileFromArchiveIfTooOld('myNewFile.csv', new Date().getTime(), 'archiveFolder');
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });

  it('should log an error if can not remove old file', async () => {
    (fs.stat as jest.Mock).mockImplementationOnce(() => ({ mtimeMs: new Date('2020-02-01T02:02:02.222Z').getTime() }));
    (fs.unlink as jest.Mock).mockImplementationOnce(() => {
      throw new Error('unlink error');
    });

    await service.removeFileFromArchiveIfTooOld('myOldFile.csv', new Date().getTime(), 'archiveFolder');
    expect(logger.error).toHaveBeenCalledWith(
      `Could not remove old file "${path.resolve('archiveFolder', 'myOldFile.csv')}" from archive: unlink error`
    );
  });

  it('should log an error if a problem occur accessing the file', async () => {
    (fs.stat as jest.Mock).mockImplementationOnce(() => {
      throw new Error('stat error');
    });

    await service.removeFileFromArchiveIfTooOld('myOldFile.csv', new Date().getTime(), 'archiveFolder');
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      `Could not read stats from archive file "${path.resolve('archiveFolder', 'myOldFile.csv')}": stat error`
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('should properly change logger', async () => {
    (fs.readdir as jest.Mock).mockReturnValue([]);
    service.setLogger(anotherLogger);
    await service.refreshArchiveFolder();
    expect(logger.trace).not.toHaveBeenCalled();
    expect(anotherLogger.trace).toHaveBeenCalledWith('Parse archive folder to remove old files');
  });

  it('should properly get archived files', async () => {
    (getFilesFiltered as jest.Mock).mockReturnValue([]);
    const files = await service.getArchiveFiles(testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'file');
    expect(getFilesFiltered).toHaveBeenCalledWith(
      service.archiveFolder,
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      'file',
      logger
    );
    expect(files).toEqual([]);
  });

  it('should remove files from archive folder with error handling', async () => {
    const filenames = ['file1', 'file2', 'errorFile'];
    const resolvedFiles = filenames.map(file => [path.resolve(mockBaseFolders('northId').archive, 'files', file)]);
    const logs = resolvedFiles.map(file => [`Removing archived file "${file}`]);

    (fs.stat as jest.Mock).mockReturnValue({ size: 123 });
    (fs.unlink as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error(`Can't remove file`);
      });

    await service.removeArchiveFiles(filenames);
    expect((fs.unlink as jest.Mock).mock.calls).toEqual(resolvedFiles);

    expect((logger.debug as jest.Mock).mock.calls).toEqual(logs);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing archived file "${path.resolve(mockBaseFolders('northId').archive, 'files', filenames[2])}": Can't remove file`
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('should remove all archived files', async () => {
    const filenames = ['file1', 'file2', 'file3'];
    (fs.readdir as jest.Mock).mockImplementation(() => filenames);
    service.removeArchiveFiles = jest.fn(() => Promise.resolve());

    await service.removeAllArchiveFiles();

    expect(service.removeArchiveFiles).toHaveBeenCalledWith(filenames);
    expect(service.removeArchiveFiles).toHaveBeenCalledTimes(1);

    expect(logger.debug).toHaveBeenLastCalledWith(
      `Removing ${filenames.length} files from "${path.resolve(mockBaseFolders('northId').archive, 'files')}"`
    );
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });

  it('should properly handle removing all files when folder is empty', async () => {
    (fs.readdir as jest.Mock).mockImplementation(() => []);
    const removeFilesSpy = jest.spyOn(service, 'removeArchiveFiles').mockImplementation(() => Promise.resolve());

    await service.removeAllArchiveFiles();

    expect(removeFilesSpy).toHaveBeenCalledTimes(0);

    expect(logger.debug).toHaveBeenLastCalledWith(
      `The archive folder "${path.resolve(mockBaseFolders('northId').archive, 'files')}" is empty. Nothing to delete`
    );
    expect(logger.debug).toHaveBeenCalledTimes(1);

    removeFilesSpy.mockRestore();
  });

  it('should properly get archived file content', async () => {
    const filename = 'myFile.csv';
    (createReadStream as jest.Mock).mockImplementation(() => Promise.resolve());
    await service.getArchiveFileContent(filename);

    expect(createReadStream).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').archive, 'files', filename));
  });

  it('should handle error while getting archived file content', async () => {
    const filename = 'myFile.csv';
    (fs.stat as jest.Mock).mockImplementation(() => {
      throw new Error('file does not exist');
    });
    const readStream = await service.getArchiveFileContent(filename);

    expect(readStream).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${path.resolve(mockBaseFolders('northId').archive, 'files', filename)}": file does not exist`
    );
  });
});
