import path from 'node:path';
import fs from 'node:fs/promises';

import FileCache from './file-cache.service';

import { NorthCacheSettingsDTO } from '../../../shared/model/north-connector.model';
import { createFolder } from '../utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';

jest.mock('node:fs/promises');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();

// Method used to flush promises called in setTimeout
// const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);
const nowDateString = '2020-02-02T02:02:02.222Z';
let settings: NorthCacheSettingsDTO;
let cache: FileCache;

describe('FileCache', () => {
  const northSendFilesCallback = jest.fn();
  const northShouldRetryCallback = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
  });

  describe('with standard callback', () => {
    const northSendFilesCallback = jest.fn();
    const northShouldRetryCallback = jest.fn();

    beforeEach(() => {
      jest.resetAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(nowDateString));
      settings = {
        scanMode: { id: 'id1', name: 'myScanMode', description: 'description', cron: '* * * * *' },
        groupCount: 1000,
        maxSendCount: 10000,
        retryCount: 3,
        retryInterval: 5000,
        timeout: 10000
      };
      cache = new FileCache(logger, 'myCacheFolder', northSendFilesCallback, northShouldRetryCallback, settings);
    });

    it('should be properly initialized with files in cache', async () => {
      (fs.readdir as jest.Mock).mockImplementation(() => ['file1', 'file2']);
      (fs.stat as jest.Mock).mockImplementationOnce(() => ({ ctimeMs: 2 })).mockImplementationOnce(() => ({ ctimeMs: 1 }));

      await cache.start();
      expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files'));
      expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files-errors'));

      expect(logger.debug).toHaveBeenCalledWith('2 files in cache.');
      expect(logger.warn).toHaveBeenCalledWith('2 files in error cache.');
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

      expect(logger.debug).toHaveBeenCalledWith('1 files in cache.');
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

      expect(logger.debug).toHaveBeenCalledWith('No files in cache.');
      expect(logger.debug).toHaveBeenCalledWith('No error files in cache.');
    });

    it('should properly cache file', async () => {
      await cache.cacheFile('myFile.csv');

      expect(logger.debug).toHaveBeenCalledWith('Caching file "myFile.csv"...');
      expect(fs.copyFile).toHaveBeenCalledWith('myFile.csv', path.resolve('myCacheFolder', 'files', 'myFile-1580608922222.csv'));
      expect(logger.debug).toHaveBeenCalledWith(
        `File "myFile.csv" cached in "${path.resolve('myCacheFolder', 'files', 'myFile-1580608922222.csv')}".`
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

      await cache.manageErroredFiles('myFile.csv');
      expect(logger.info).toHaveBeenCalledWith(
        `File "myFile.csv" moved to "${path.resolve('myCacheFolder', 'files-errors', 'myFile.csv')}".`
      );

      await cache.manageErroredFiles('myFile.csv');
      expect(logger.error).toHaveBeenCalledWith(new Error('rename error'));
    });

    it('should not send files if no file to send', async () => {
      cache.getFileToSend = jest.fn(() => Promise.resolve(null));
      cache.resetFilesTimeout = jest.fn();
      await cache.sendFile();

      expect(logger.trace).toHaveBeenCalledWith('No file to send...');
    });

    it('should manage error in send file wrapper', async () => {
      cache.sendFile = jest.fn().mockImplementation(() => {
        throw new Error('send file error');
      });
      await cache.sendFileWrapper();
      expect(cache.sendFile).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(new Error('send file error'));
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

    it('should match file with date and name', async () => {
      const folder = 'folder';
      const filename = 'file.name';
      const fromDate = '2022-11-11T11:11:11.111';
      const toDate = '2022-11-12T11:11:11.111';
      fs.stat = jest.fn().mockReturnValue({ mtimeMs: new Date('2022-11-12T00:00:00.000').getTime() });

      const match = await cache.matchFile(folder, filename, fromDate, toDate, 'ile');
      expect(fs.stat).toBeCalledWith(path.join(folder, filename));
      expect(match).toBeTruthy();
    });

    it('should not match file without date match', async () => {
      const folder = 'folder';
      const filename = 'file.name';
      const fromDate = '2022-11-11T11:11:11.111';
      const toDate = '2022-11-12T11:11:11.111';
      fs.stat = jest.fn().mockReturnValue({ mtimeMs: new Date('2022-11-13T00:00:00.000').getTime() });

      const match = await cache.matchFile(folder, filename, fromDate, toDate, 'ile');
      expect(fs.stat).toBeCalledWith(path.join(folder, filename));
      expect(match).toBeFalsy();
    });

    it('should not match file without name match', async () => {
      const folder = 'folder';
      const filename = 'file.name';
      const fromDate = '2022-11-11T11:11:11.111';
      const toDate = '2022-11-12T11:11:11.111';
      fs.stat = jest.fn().mockReturnValue({ mtimeMs: new Date('2022-11-13T00:00:00.000').getTime() });

      const match = await cache.matchFile(folder, filename, fromDate, toDate, 'noMatch');
      expect(fs.stat).toBeCalledWith(path.join(folder, filename));
      expect(match).toBeFalsy();
    });
  });

  describe('with specific callback', () => {
    beforeEach(async () => {
      jest.resetAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(nowDateString));
      settings = {
        scanMode: { id: 'id1', name: 'myScanMode', description: 'description', cron: '* * * * *' },
        groupCount: 1000,
        maxSendCount: 10000,
        retryCount: 3,
        retryInterval: 5000,
        timeout: 10000
      };

      cache = new FileCache(logger, 'myCacheFolder', northSendFilesCallback, northShouldRetryCallback, settings);
    });

    it('should retry to send files if it fails', async () => {
      const fileToSend = 'myFile';
      cache.getFileToSend = jest.fn(() => Promise.resolve(fileToSend));
      cache.manageErroredFiles = jest.fn();

      northSendFilesCallback
        .mockImplementationOnce(() => {
          throw new Error('handleFile error 0');
        })
        .mockImplementationOnce(() => {
          throw new Error('handleFile error 1');
        })
        .mockImplementationOnce(() => {
          throw new Error('handleFile error 2');
        })
        .mockImplementationOnce(() => {
          throw new Error('handleFile error 3');
        });

      await cache.sendFile();
      expect(logger.debug).toHaveBeenCalledWith('Retrying file in 5000 ms. Retry count: 1');
      jest.advanceTimersByTime(settings.retryInterval);
      // expect(logger.debug).toHaveBeenCalledWith('Retrying file in 5000 ms. Retry count: 2');
      // jest.advanceTimersByTime(settings.retryInterval);
      // expect(logger.debug).toHaveBeenCalledWith('Retrying file in 5000 ms. Retry count: 3');
      // jest.advanceTimersByTime(settings.retryInterval);

      // expect(cache.northSendFilesCallback).toHaveBeenCalledWith(fileToSend);
      // expect(cache.northSendFilesCallback).toHaveBeenCalledTimes(4);
      // expect(cache.manageErroredFiles).toHaveBeenCalledTimes(1);
      // expect(logger.debug).toHaveBeenCalledWith("Too many retries. The file won't be sent again.");
      // expect(cache.manageErroredFiles).toHaveBeenCalledWith(fileToSend);
    });

    it('should successfully send files', async () => {
      const fileToSend = 'myFile';
      cache.getFileToSend = jest.fn(() => Promise.resolve(fileToSend));
      cache.manageErroredFiles = jest.fn();
      fs.readdir = jest.fn().mockReturnValue(['file1', 'myFile', 'file2']);

      await cache.sendFile();
      // await flushPromises();
      expect(cache.northSendFilesCallback).toHaveBeenCalledWith(fileToSend);
      expect(cache.northSendFilesCallback).toHaveBeenCalledTimes(1);
      expect(cache.manageErroredFiles).not.toHaveBeenCalled();
    });
  });
});
