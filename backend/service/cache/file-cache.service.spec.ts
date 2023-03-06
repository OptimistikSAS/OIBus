import path from 'node:path';
import fs from 'node:fs/promises';

import FileCache from './file-cache.service';
import { createFolder } from '../utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import { DateTime } from 'luxon';

jest.mock('node:fs/promises');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();
const nowDateString = '2020-02-02T02:02:02.222Z';
let cache: FileCache;
describe('FileCache', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    cache = new FileCache(logger, 'myCacheFolder');
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
    await cache.cacheFile('myFile.csv');

    expect(fs.copyFile).toHaveBeenCalledWith('myFile.csv', path.resolve('myCacheFolder', 'files', 'myFile-1580608922222.csv'));
    expect(logger.debug).toHaveBeenCalledWith(
      `File "myFile.csv" cached in "${path.resolve('myCacheFolder', 'files', 'myFile-1580608922222.csv')}"`
    );
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

  it('should remove error files', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name'];

    await cache.removeErrorFiles(filenames);
    expect(fs.unlink).toHaveBeenNthCalledWith(1, path.join(path.resolve('myCacheFolder', 'files-errors'), filenames[0]));
    expect(fs.unlink).toHaveBeenNthCalledWith(2, path.join(path.resolve('myCacheFolder', 'files-errors'), filenames[1]));
    expect(fs.unlink).toHaveBeenNthCalledWith(3, path.join(path.resolve('myCacheFolder', 'files-errors'), filenames[2]));
  });

  it('should retry error files', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name'];

    await cache.retryErrorFiles(filenames);
    expect(fs.rename).toHaveBeenNthCalledWith(
      1,
      path.resolve('myCacheFolder', 'files-errors', filenames[0]),
      path.resolve('myCacheFolder', 'files', filenames[0])
    );
    expect(fs.rename).toHaveBeenNthCalledWith(
      2,
      path.resolve('myCacheFolder', 'files-errors', filenames[1]),
      path.resolve('myCacheFolder', 'files', filenames[1])
    );
    expect(fs.rename).toHaveBeenNthCalledWith(
      3,
      path.resolve('myCacheFolder', 'files-errors', filenames[2]),
      path.resolve('myCacheFolder', 'files', filenames[2])
    );
  });

  it('should remove all error files when the error folder is not empty', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve(filenames));
    cache.removeErrorFiles = jest.fn();

    await cache.removeAllErrorFiles();
    expect(cache.removeErrorFiles).toHaveBeenCalledWith(filenames);
  });

  it('should not remove any error file when the error folder is empty', async () => {
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve([]));
    cache.removeErrorFiles = jest.fn();

    await cache.removeAllErrorFiles();
    expect(cache.removeErrorFiles).not.toHaveBeenCalled();
  });

  it('should retry all error files when the error folder is not empty', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name'];
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve(filenames));
    cache.retryErrorFiles = jest.fn();

    await cache.retryAllErrorFiles();
    expect(cache.retryErrorFiles).toHaveBeenCalledWith(filenames);
  });

  it('should not remove any error file when the error folder is empty', async () => {
    fs.readdir = jest.fn().mockReturnValue(Promise.resolve([]));
    cache.retryErrorFiles = jest.fn();

    await cache.retryAllErrorFiles();
    expect(cache.retryErrorFiles).not.toHaveBeenCalled();
  });

  it('should properly get and remove file from queue', async () => {
    const noFile = cache.getFileToSend();

    expect(noFile).toBeNull();

    await cache.cacheFile('myFile.csv');
    const file = cache.getFileToSend();

    expect(file).toEqual(path.resolve('myCacheFolder', 'files', 'myFile-1580608922222.csv'));

    cache.removeFileFromQueue();
    const noMoreFile = cache.getFileToSend();
    expect(noMoreFile).toBeNull();
  });

  it('should properly get error files', async () => {
    (fs.readdir as jest.Mock).mockImplementation(() => ['file1', 'file2', 'file3', 'anotherFile', 'errorFile']);
    (fs.stat as jest.Mock)
      .mockImplementationOnce(() => ({ mtimeMs: DateTime.fromISO('2020-02-02T04:02:02.222Z').toMillis() }))
      .mockImplementationOnce(() => ({ mtimeMs: DateTime.fromISO('2020-02-02T06:02:02.222Z').toMillis() }))
      .mockImplementationOnce(() => ({ mtimeMs: DateTime.fromISO('2020-02-04T02:02:02.222Z').toMillis() }))
      .mockImplementationOnce(() => ({ mtimeMs: DateTime.fromISO('2020-02-05T02:02:02.222Z').toMillis() }))
      .mockImplementationOnce(() => {
        throw new Error('error file');
      });

    const files = await cache.getErrorFiles('2020-02-02T02:02:02.222Z', '2020-02-03T02:02:02.222Z', 'file');

    expect(files).toEqual([
      { filename: 'file1', modificationDate: '2020-02-02T04:02:02.222Z' },
      { filename: 'file2', modificationDate: '2020-02-02T06:02:02.222Z' }
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading in error folder file stats "${path.resolve('myCacheFolder', 'files-errors', 'errorFile')}": Error: error file`
    );
  });

  it('should properly get error files', async () => {
    (fs.readdir as jest.Mock).mockImplementation(() => []);

    const files = await cache.getErrorFiles('2020-02-02T02:02:02.222Z', '2020-02-03T02:02:02.222Z', 'file');

    expect(files).toEqual([]);
  });
});
