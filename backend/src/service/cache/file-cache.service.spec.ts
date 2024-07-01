import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';

import FileCache from './file-cache.service';
import { createFolder, getFilesFiltered } from '../utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import { NorthCacheSettingsDTO } from '../../../../shared/model/north-connector.model';

jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const nowDateString = '2020-02-02T02:02:02.222Z';
let settings: NorthCacheSettingsDTO;
let cache: FileCache;
describe('FileCache without sendFileImmediately', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    settings = {
      scanModeId: 'id1',
      groupCount: 1000,
      maxSendCount: 1000,
      retryCount: 3,
      retryInterval: 5000,
      sendFileImmediately: false,
      maxSize: 1000
    };

    cache = new FileCache(logger, 'myCacheFolder', settings);
  });

  it('should be properly initialized with files in cache', async () => {
    (fs.readdir as jest.Mock).mockImplementation(() => ['file1', 'file2']);
    (fs.stat as jest.Mock).mockImplementationOnce(() => ({ ctimeMs: 2 })).mockImplementationOnce(() => ({ ctimeMs: 1 }));

    await cache.start();
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files-errors'));

    expect(logger.debug).toHaveBeenCalledWith('2 files in cache');
    expect(logger.warn).toHaveBeenCalledWith('2 files in error cache');
  });

  it('should be properly initialized with files in cache but error access', async () => {
    (fs.readdir as jest.Mock)
      .mockImplementationOnce(() => ['file1', 'file2'])
      .mockImplementationOnce(() => {
        throw new Error('readdir error');
      });
    (fs.stat as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('stat error');
      })
      .mockImplementationOnce(() => ({ ctimeMs: 1 }));

    await cache.start();
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files-errors'));

    expect(logger.debug).toHaveBeenCalledWith('1 files in cache');
    expect(logger.error).toHaveBeenCalledWith(
      'Error while reading queue file ' + `"${path.resolve('myCacheFolder', 'files', 'file1')}": ${new Error('stat error')}`
    );
    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'));
  });

  it('should be properly initialized without files in cache', async () => {
    (fs.readdir as jest.Mock).mockImplementation(() => []);
    await cache.start();
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files-errors'));

    expect(logger.debug).toHaveBeenCalledWith('No files in cache');
    expect(logger.debug).toHaveBeenCalledWith('No error files in cache');
  });

  it('should properly cache file', async () => {
    (fs.stat as jest.Mock).mockImplementation(() => ({ size: 123 }));

    await cache.cacheFile('myFile.csv');

    expect(fs.copyFile).toHaveBeenCalledWith('myFile.csv', path.resolve('myCacheFolder', 'files', 'myFile-1580608922222.csv'));
    expect(logger.debug).toHaveBeenCalledWith(
      `File "myFile.csv" cached in "${path.resolve('myCacheFolder', 'files', 'myFile-1580608922222.csv')}"`
    );
  });

  it('should properly cache file without appending timestamp', async () => {
    (fs.stat as jest.Mock).mockImplementation(() => ({ size: 123 }));

    // When retrying an archived file, it will already have a timestamp, so we skip adding another
    await cache.cacheFile('myFile-1580608922222.csv', false);
    const cacheFilePath = path.resolve('myCacheFolder', 'files', 'myFile-1580608922222.csv');

    expect(fs.copyFile).toHaveBeenCalledWith('myFile-1580608922222.csv', cacheFilePath);
    expect(logger.debug).toHaveBeenCalledWith(`File "myFile-1580608922222.csv" cached in "${cacheFilePath}"`);
  });

  it('should properly managed cache file error', async () => {
    (fs.copyFile as jest.Mock).mockImplementation(() => {
      throw new Error('copy file');
    });

    let error;
    try {
      await cache.cacheFile('myFile.csv');
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
    const empty = await cache.isEmpty();
    expect(empty).toBeTruthy();
    const notEmpty = await cache.isEmpty();
    expect(notEmpty).toBeFalsy();

    const emptyBecauseOfError = await cache.isEmpty();
    expect(emptyBecauseOfError).toBeTruthy();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'));
  });

  it('should properly manage error files', async () => {
    (fs.rename as jest.Mock)
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error('rename error');
      });

    await cache.manageErroredFiles('myFile.csv', 1);
    expect(logger.warn).toHaveBeenCalledWith(
      `File "myFile.csv" moved to "${path.resolve('myCacheFolder', 'files-errors', 'myFile.csv')}" after 1 errors`
    );

    await cache.manageErroredFiles('myFile.csv', 1);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while moving file "myFile.csv" to "${path.resolve('myCacheFolder', 'files-errors', 'myFile.csv')}": ${new Error(
        'rename error'
      )}`
    );
  });

  it('should retry files from folder', async () => {
    // Used to retry files from error and archive folders
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    const cacheFileArgs = filenames.map(filename => [path.resolve('myCacheFolder', 'files-errors', filename), false]);
    const removeFilesArgs = filenames.map(filename => [cache.errorFolder, [filename]]);
    const loggerArgs = filenames.map(filename => {
      const fromFilePath = path.resolve('myCacheFolder', 'files-errors', filename);
      const cacheFilePath = path.resolve('myCacheFolder', 'files', filename);
      return [`Moving file "${fromFilePath}" back to cache "${cacheFilePath}"`];
    });

    cache.cacheFile = jest.fn();
    cache.removeFiles = jest.fn();

    await cache.retryFiles(cache.errorFolder, filenames);

    expect((cache.cacheFile as jest.Mock).mock.calls).toEqual(cacheFileArgs);
    expect((cache.removeFiles as jest.Mock).mock.calls).toEqual(removeFilesArgs);
    expect((logger.debug as jest.Mock).mock.calls).toEqual(loggerArgs);
  });

  it('should retry error files', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    cache.retryFiles = jest.fn();

    await cache.retryErrorFiles(filenames);
    expect(cache.retryFiles).toHaveBeenCalledWith(cache.errorFolder, filenames);
    expect(cache.retryFiles).toHaveBeenCalledTimes(1);
  });

  it('should retry all files from folder', async () => {
    // Used to retry all files from error and archive folders
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    (fs.readdir as jest.Mock).mockImplementationOnce(() => filenames);
    cache.retryFiles = jest.fn();

    await cache.retryAllFiles(cache.errorFolder);

    expect(fs.readdir).toHaveBeenCalledWith(cache.errorFolder);
    expect(cache.retryFiles).toHaveBeenCalledWith(cache.errorFolder, filenames);
    expect(cache.retryFiles).toHaveBeenCalledTimes(1);
  });

  it('should retry all error files', async () => {
    cache.retryAllFiles = jest.fn();

    await cache.retryAllErrorFiles();

    expect(cache.retryAllFiles).toHaveBeenCalledWith(cache.errorFolder);
    expect(cache.retryAllFiles).toHaveBeenCalledTimes(1);
  });

  it('should handle retrying all files when folder is empty', async () => {
    (fs.readdir as jest.Mock).mockImplementationOnce(() => []);

    await cache.retryAllFiles('folder');

    expect(logger.debug).toHaveBeenCalledWith(`The folder "folder" is empty. Nothing to delete`);
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });

  it('should remove files from folder', async () => {
    // Used to remove files from error and archive folders
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    fs.stat = jest
      .fn()
      .mockImplementationOnce(() => ({ size: 1 }))
      .mockImplementationOnce(() => ({ size: 2 }))
      .mockImplementationOnce(() => ({ size: 3 }));

    await cache.removeFiles(cache.errorFolder, filenames);

    expect(fs.unlink).toHaveBeenNthCalledWith(1, path.join(path.resolve('myCacheFolder', 'files-errors'), filenames[0]));
    expect(fs.unlink).toHaveBeenNthCalledWith(2, path.join(path.resolve('myCacheFolder', 'files-errors'), filenames[1]));
    expect(fs.unlink).toHaveBeenNthCalledWith(3, path.join(path.resolve('myCacheFolder', 'files-errors'), filenames[2]));
  });

  it('should remove all error files when the error folder is not empty', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve(filenames));
    cache.removeFiles = jest.fn();

    await cache.removeAllErrorFiles();
    expect(cache.removeFiles).toHaveBeenCalledWith(cache.errorFolder, filenames);
  });

  it('should not remove any error file when the error folder is empty', async () => {
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve([]));
    cache.removeFiles = jest.fn();

    await cache.removeAllErrorFiles();
    expect(cache.removeFiles).not.toHaveBeenCalled();
  });

  it('should remove all cache files when the folder is not empty', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve(filenames));
    cache.removeFiles = jest.fn();

    await cache.removeAllCacheFiles();
    expect(cache.removeFiles).toHaveBeenCalledWith(cache.fileFolder, filenames);
  });

  it('should not remove any cache file when the folder is empty', async () => {
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve([]));
    cache.removeFiles = jest.fn();

    await cache.removeAllCacheFiles();
    expect(cache.removeFiles).not.toHaveBeenCalled();
  });

  it('should not remove any error file when the error folder is empty', async () => {
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve([]));
    cache.retryErrorFiles = jest.fn();

    await cache.retryAllErrorFiles();
    expect(cache.retryErrorFiles).not.toHaveBeenCalled();
  });

  it('should properly get and remove file from queue', async () => {
    (fs.stat as jest.Mock).mockImplementation(() => ({ size: 123 }));

    const noFile = cache.getFileToSend();

    expect(noFile).toBeNull();

    await cache.cacheFile('myFile.csv');
    const file = cache.getFileToSend();

    expect(file).toEqual(path.resolve('myCacheFolder', 'files', 'myFile-1580608922222.csv'));

    cache.removeFileFromQueue();
    const noMoreFile = cache.getFileToSend();
    expect(noMoreFile).toBeNull();
  });

  it('should properly remove a specific file from queue', async () => {
    (fs.stat as jest.Mock).mockImplementation(() => ({ size: 123 }));

    const noFile = cache.getFileToSend();

    expect(noFile).toBeNull();

    await cache.cacheFile('myFile1.csv');
    await cache.cacheFile('myFile2.csv');
    await cache.cacheFile('myFile3.csv');
    await cache.cacheFile('myFile4.csv');

    cache.removeFileFromQueue(path.resolve('myCacheFolder', 'files', 'myFile3-1580608922222.csv'));
    expect(cache['filesQueue']).toEqual([
      path.resolve('myCacheFolder', 'files', 'myFile1-1580608922222.csv'),
      path.resolve('myCacheFolder', 'files', 'myFile2-1580608922222.csv'),
      path.resolve('myCacheFolder', 'files', 'myFile4-1580608922222.csv')
    ]);
  });

  it('should properly get error files', async () => {
    await cache.getErrorFiles('2020-02-02T02:02:02.222Z', '2020-02-03T02:02:02.222Z', 'file');
    expect(getFilesFiltered).toHaveBeenCalled();
  });

  it('should properly get cache files', async () => {
    await cache.getCacheFiles('2020-02-02T02:02:02.222Z', '2020-02-03T02:02:02.222Z', 'file');
    expect(getFilesFiltered).toHaveBeenCalled();
  });

  it('should properly change logger', async () => {
    (fs.readdir as jest.Mock).mockReturnValue([]);
    cache.setLogger(anotherLogger);
    await cache.start();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(anotherLogger.debug).toHaveBeenCalledWith(`No files in cache`);
  });

  it('should send file immediately', async () => {
    (fs.stat as jest.Mock).mockImplementation(() => ({ size: 123 }));

    cache.settings = {
      scanModeId: 'id1',
      groupCount: 1000,
      maxSendCount: 1000,
      retryCount: 3,
      retryInterval: 5000,
      sendFileImmediately: true,
      maxSize: 1000
    };
    await cache.cacheFile('myFile.csv');
  });

  it('should properly get error file content', async () => {
    const filename = 'myFile.csv';
    (createReadStream as jest.Mock).mockImplementation(() => {});
    await cache.getErrorFileContent(filename);

    expect(createReadStream).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files-errors', filename));
  });

  it('should handle error when getting error file content', async () => {
    const filename = 'myFile.csv';
    const error = new Error('file does not exist');
    (fs.stat as jest.Mock).mockImplementation(() => {
      throw error;
    });
    await cache.getErrorFileContent(filename);

    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading file "${path.resolve('myCacheFolder', 'files-errors', filename)}": ${error}`
    );
  });

  it('should properly get cache file content', async () => {
    const filename = 'myFile.csv';
    (createReadStream as jest.Mock).mockImplementation(() => {});
    await cache.getCacheFileContent(filename);

    expect(createReadStream).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files', filename));
  });

  it('should handle error when getting cache file content', async () => {
    const filename = 'myFile.csv';
    const error = new Error('file does not exist');
    (fs.stat as jest.Mock).mockImplementation(() => {
      throw error;
    });
    await cache.getCacheFileContent(filename);

    expect(logger.error).toHaveBeenCalledWith(`Error while reading file "${path.resolve('myCacheFolder', 'files', filename)}": ${error}`);
  });
});

describe('FileCache with sendFileImmediately', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    settings = {
      scanModeId: 'id1',
      groupCount: 1000,
      maxSendCount: 1000,
      retryCount: 3,
      retryInterval: 5000,
      sendFileImmediately: true,
      maxSize: 1000
    };

    cache = new FileCache(logger, 'myCacheFolder', settings);
  });

  it('should be properly initialized with files in cache', async () => {
    (fs.readdir as jest.Mock).mockImplementation(() => ['file1', 'file2']);
    (fs.stat as jest.Mock).mockImplementationOnce(() => ({ ctimeMs: 2 })).mockImplementationOnce(() => ({ ctimeMs: 1 }));

    await cache.start();
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files-errors'));

    expect(logger.debug).toHaveBeenCalledWith('2 files in cache');
    expect(logger.warn).toHaveBeenCalledWith('2 files in error cache');
    expect(logger.trace).toHaveBeenCalledWith('Trigger next file send');
  });

  it('should be properly initialized with files in cache and properly remove and trigger', async () => {
    (fs.readdir as jest.Mock).mockImplementation(() => ['file1', 'file2']);
    (fs.stat as jest.Mock).mockImplementationOnce(() => ({ ctimeMs: 2 })).mockImplementationOnce(() => ({ ctimeMs: 1 }));

    await cache.start();
    cache.removeFileFromQueue();
    expect(`There are 1 files in queue left. Triggering next send`);
  });
});
