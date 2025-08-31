import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync, { Dirent, Stats } from 'node:fs';
import zlib from 'node:zlib';

import minimist from 'minimist';

import { DateTime } from 'luxon';
import {
  checkScanMode,
  compress,
  convertDateTimeToInstant,
  convertDelimiter,
  createBaseFolders,
  createFolder,
  delay,
  dirSize,
  filesExists,
  formatInstant,
  formatQueryParams,
  generateIntervals,
  generateRandomId,
  generateReplacementParameters,
  getCommandLineArguments,
  getFilenameWithoutRandomId,
  getOIBusInfo,
  getPlatformFromOsType,
  itemToFlattenedCSV,
  logQuery,
  persistResults,
  stringToBoolean,
  testIPOnFilter,
  unzip,
  validateCronExpression
} from './utils';
import csv from 'papaparse';
import pino from 'pino';
import AdmZip from 'adm-zip';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { DateTimeType } from '../../shared/model/types';
import os from 'node:os';
import { EngineSettingsDTO, OIBusInfo } from '../../shared/model/engine.model';
import cronstrue from 'cronstrue';
import testData from '../tests/utils/test-data';
import { mockBaseFolders } from '../tests/utils/test-utils';

jest.mock('node:zlib');
jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('minimist');
jest.mock('papaparse');
jest.mock('adm-zip');
jest.mock('node:http', () => ({ request: jest.fn() }));
jest.mock('node:https', () => ({ request: jest.fn() }));

describe('Service utils', () => {
  describe('getCommandLineArguments', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should parse command line arguments without args', () => {
      (minimist as unknown as jest.Mock).mockReturnValue({});
      const result = getCommandLineArguments();
      expect(result).toEqual({
        check: false,
        configFile: path.resolve('./'),
        ignoreIpFilters: false,
        ignoreRemoteUpdate: false,
        ignoreRemoteConfig: false,
        launcherVersion: '3.4.0'
      });
    });

    it('should parse command line arguments with args', () => {
      (minimist as unknown as jest.Mock).mockReturnValue({
        check: true,
        config: 'myConfig.json',
        ignoreIpFilters: true,
        ignoreRemoteUpdate: true,
        ignoreRemoteConfig: true,
        launcherVersion: '3.5.0'
      });
      const result = getCommandLineArguments();
      expect(result).toEqual({
        check: true,
        configFile: path.resolve('myConfig.json'),
        ignoreIpFilters: true,
        ignoreRemoteUpdate: true,
        ignoreRemoteConfig: true,
        launcherVersion: '3.5.0'
      });
    });
  });

  describe('delay', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
      jest.clearAllMocks();
    });

    it('should delay', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      delay(1000);
      jest.advanceTimersToNextTimer();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    });
  });

  describe('generateIntervals', () => {
    it('should return only one interval', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2020-01-01T01:00:00.000Z';
      const expectedIntervals = [{ start: startTime, end: endTime }];
      const results = generateIntervals(startTime, endTime, 3600);
      expect(results).toEqual(expectedIntervals);
    });

    it('should return two intervals', () => {
      const startTime1 = '2020-01-01T00:00:00.000Z';
      const endTime1 = '2020-01-01T01:00:00.000Z';
      const startTime2 = '2020-01-01T01:00:00.000Z';
      const endTime2 = '2020-01-01T02:00:00.000Z';
      const expectedIntervals = [
        { start: startTime1, end: endTime1 },
        { start: startTime2, end: endTime2 }
      ];
      const results = generateIntervals(startTime1, endTime2, 3600);
      expect(results).toEqual(expectedIntervals);
    });
  });

  describe('filesExists', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly check if a file does not exist', async () => {
      (fs.stat as jest.Mock).mockImplementation(() => {
        throw new Error('File does not exist');
      });

      expect(await filesExists('myConfigFile.json')).toEqual(false);

      (fs.stat as jest.Mock).mockImplementation(() => null);
      expect(await filesExists('myConfigFile.json')).toEqual(true);
    });
  });

  describe('createFolder', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly create folder', async () => {
      const folderToCreate = 'myFolder';
      (fs.mkdir as jest.Mock).mockImplementation(() => null);
      (fs.stat as jest.Mock).mockImplementation(() => null);

      await createFolder(folderToCreate);
      expect(fs.mkdir).not.toHaveBeenCalled();

      (fs.stat as jest.Mock).mockImplementation(() => {
        throw new Error('File does not exist');
      });

      await createFolder(folderToCreate);

      expect(fs.mkdir).toHaveBeenCalledTimes(1);
      expect(fs.mkdir).toHaveBeenCalledWith(path.resolve(folderToCreate), { recursive: true });
    });
  });

  describe('createBaseFolders', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly create base folders for north', async () => {
      (fs.stat as jest.Mock).mockImplementation(() => null);

      await createBaseFolders(mockBaseFolders(testData.north.list[0].id), 'north');
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.stat).toHaveBeenCalledTimes(3);
    });

    it('should properly create base folders for south', async () => {
      (fs.stat as jest.Mock).mockImplementation(() => null);

      await createBaseFolders(mockBaseFolders(testData.south.list[0].id), 'south');
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.stat).toHaveBeenCalledTimes(3);
    });

    it('should properly create base folders for history query', async () => {
      (fs.stat as jest.Mock).mockImplementation(() => null);

      await createBaseFolders(mockBaseFolders(testData.historyQueries.list[0].id), 'history');
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.stat).toHaveBeenCalledTimes(9);
    });
  });

  describe('getFilenameWithoutRandomId', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly get filename without random id', () => {
      expect(getFilenameWithoutRandomId('test.file')).toEqual('test.file');
      expect(getFilenameWithoutRandomId('test-12345.file')).toEqual('test.file');
      expect(getFilenameWithoutRandomId(path.join('folder', 'sub-directory', 'test-12345.file'))).toEqual('test.file');
    });
  });

  describe('compress', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should properly compress file', async () => {
      const onFinish = jest.fn((event, handler) => handler());
      const onError = jest.fn().mockImplementation(() => {
        return { on: onFinish };
      });
      const myReadStream = {
        pipe: jest.fn().mockReturnThis(),
        on: onError
      };
      (fsSync.createReadStream as jest.Mock).mockReturnValueOnce(myReadStream);

      const myWriteStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, handler) => {
          handler();
          return this;
        })
      };
      (fsSync.createReadStream as jest.Mock).mockReturnValueOnce(myWriteStream);

      (zlib.createGzip as jest.Mock).mockReturnValue({});
      await compress('myInputFile', 'myOutputFile');

      expect(fsSync.createReadStream).toHaveBeenCalledTimes(1);
      expect(fsSync.createReadStream).toHaveBeenCalledWith('myInputFile');
      expect(myReadStream.pipe).toHaveBeenCalledTimes(2);
      expect(fsSync.createWriteStream).toHaveBeenCalledTimes(1);
      expect(fsSync.createWriteStream).toHaveBeenCalledWith('myOutputFile');
    });

    it('should properly manage error when compressing file', async () => {
      const myReadStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, handler) => {
          handler('compression error');
          return this;
        })
      };
      (fsSync.createReadStream as jest.Mock).mockReturnValueOnce(myReadStream);

      const myWriteStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, handler) => {
          handler();
          return this;
        })
      };
      (fsSync.createReadStream as jest.Mock).mockReturnValueOnce(myWriteStream);

      (zlib.createGzip as jest.Mock).mockReturnValue({});
      let expectedError = null;
      try {
        await compress('myInputFile', 'myOutputFile');
      } catch (error) {
        expectedError = error;
      }
      expect(expectedError).toEqual('compression error');
      expect(fsSync.createReadStream).toHaveBeenCalledTimes(1);
      expect(fsSync.createReadStream).toHaveBeenCalledWith('myInputFile');
      expect(myReadStream.pipe).toHaveBeenCalledTimes(2);
      expect(fsSync.createWriteStream).toHaveBeenCalledTimes(1);
      expect(fsSync.createWriteStream).toHaveBeenCalledWith('myOutputFile');
    });
  });

  describe('unzip', () => {
    it('should properly unzip file', () => {
      const extractAllTo = jest.fn();
      (AdmZip as jest.Mock).mockImplementation(() => ({ extractAllTo }));

      unzip('myInputFile', 'myOutputFolder');

      expect(extractAllTo).toHaveBeenCalledTimes(1);
    });

    it('should properly manage unzip errors', () => {
      const extractAllTo = jest.fn().mockImplementation(() => {
        throw new Error('unzip error');
      });
      (AdmZip as jest.Mock).mockImplementation(() => ({ extractAllTo }));

      let expectedError = null;
      try {
        unzip('myInputFile', 'myOutputFolder');
      } catch (error) {
        expectedError = error;
      }

      expect(expectedError).toEqual(new Error('unzip error'));
      expect(extractAllTo).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateRandomId', () => {
    it('should properly generate a random ID with a standard size', () => {
      const randomId = generateRandomId();
      expect(randomId.length).toEqual(16);
    });

    it('should properly generate a random ID with smaller size', () => {
      const randomId = generateRandomId(8);
      expect(randomId.length).toEqual(8);
    });

    it('should properly generate a random ID with bigger size', () => {
      const randomId = generateRandomId(32);
      expect(randomId.length).toEqual(32);
    });
  });

  describe('dirSize', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly retrieve dir size', async () => {
      const firstFolder: Array<Dirent> = [
        { name: 'file1', isDirectory: () => false, isFile: () => true } as Dirent,
        { name: 'file2', isDirectory: () => false, isFile: () => true } as Dirent,
        { name: 'dir', isDirectory: () => true, isFile: () => false } as Dirent
      ];
      const secondFolder: Array<Dirent> = [
        { name: 'file3', isDirectory: () => false, isFile: () => true } as Dirent,
        { name: 'file4', isDirectory: () => false, isFile: () => false } as Dirent,
        { name: 'file5', isDirectory: () => false, isFile: () => true } as Dirent
      ];
      (fs.readdir as jest.Mock).mockReturnValueOnce(firstFolder).mockReturnValueOnce(secondFolder);
      (fs.stat as jest.Mock)
        .mockReturnValueOnce({ size: 1 } as Stats)
        .mockReturnValueOnce({ size: 2 } as Stats)
        .mockImplementationOnce(() => {
          throw new Error('stat error');
        })
        .mockReturnValueOnce({ size: 8 } as Stats);

      const result = await dirSize('myDir');
      expect(fs.readdir).toHaveBeenCalledWith('myDir', { withFileTypes: true });
      expect(fs.readdir).toHaveBeenCalledWith(path.join('myDir', 'dir'), { withFileTypes: true });
      expect(fs.stat).toHaveBeenCalledWith(path.join('myDir', 'file1'));
      expect(fs.stat).toHaveBeenCalledWith(path.join('myDir', 'file2'));
      expect(fs.stat).toHaveBeenCalledWith(path.join('myDir', 'dir', 'file3'));
      expect(fs.stat).toHaveBeenCalledWith(path.join('myDir', 'dir', 'file5'));
      expect(fs.stat).toHaveBeenCalledTimes(4);
      expect(result).toEqual(11);
    });
  });

  describe('generateReplacementParameters', () => {
    it('should generate replacement parameters', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2021-01-01T00:00:00.000Z';
      const query = 'SELECT * FROM table WHERE timestamp > @StartTime && timestamp < @EndTime && @StartTime > timestamp';

      const expectedResult = [startTime, endTime, startTime];
      const result = generateReplacementParameters(query, startTime, endTime);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('logQuery', () => {
    const logger: pino.Logger = new PinoLogger();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly log a query with string variables', () => {
      const query = 'SELECT * FROM logs WHERE timestamp > @StartTime AND timestamp < @EndTime';
      logQuery(query, '2020-01-01T00:00:00.000Z', '2023-01-01T00:00:00.000Z', logger);

      expect(logger.info).toHaveBeenCalledWith(
        `Sending "${query}" with @StartTime = 2020-01-01T00:00:00.000Z @EndTime = 2023-01-01T00:00:00.000Z`
      );
    });

    it('should properly log a query with number variables', () => {
      const query = 'SELECT * FROM logs WHERE timestamp > @StartTime AND timestamp < @EndTime';
      logQuery(
        query,
        DateTime.fromISO('2020-01-01T00:00:00.000Z').toMillis(),
        DateTime.fromISO('2023-01-01T00:00:00.000Z').toMillis(),
        logger
      );

      expect(logger.info).toHaveBeenCalledWith(`Sending "${query}" with @StartTime = 1577836800000 @EndTime = 1672531200000`);
    });

    it('should properly log a query without variable', () => {
      const query = 'SELECT * FROM logs';
      logQuery(query, '2020-01-01T00:00:00.000Z', '2023-01-01T00:00:00.000Z', logger);

      expect(logger.info).toHaveBeenCalledWith(`Sending "${query}"`);
    });
  });

  describe('persistResults', () => {
    const logger: pino.Logger = new PinoLogger();
    const addContent = jest.fn();
    const dataToWrite = [{ data1: 1 }, { data2: 2 }];

    describe('without compression', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        (csv.unparse as jest.Mock).mockReturnValue('csv content');
      });

      it('should properly write results without compression', async () => {
        await persistResults(
          dataToWrite,
          {
            type: 'file',
            filename: 'myFilename.csv',
            compression: false
          },
          'connectorName',
          'itemName',
          'myTmpFolder',
          addContent,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(addContent).toHaveBeenCalledWith({ type: 'any', filePath });
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledTimes(1);
      });

      it('should properly write results into CSV without compression', async () => {
        await persistResults(
          dataToWrite,
          {
            type: 'csv',
            delimiter: 'SEMI_COLON',
            filename: 'myFilename.csv',
            compression: false,
            outputTimestampFormat: 'yyyy-MM-ddTHH:mm:ss.SSS',
            outputTimezone: 'UTC'
          },
          'connectorName',
          'itemName',
          'myTmpFolder',
          addContent,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(addContent).toHaveBeenCalledWith({ type: 'any', filePath });
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledTimes(1);
      });

      it('should properly write results into CSV without compression and log unlink errors', async () => {
        (fs.unlink as jest.Mock).mockImplementation(() => {
          throw new Error('unlink error');
        });
        await persistResults(
          dataToWrite,
          {
            type: 'csv',
            delimiter: 'SEMI_COLON',
            filename: 'myFilename.csv',
            compression: false,
            outputTimestampFormat: 'yyyy-MM-ddTHH:mm:ss.SSS',
            outputTimezone: 'UTC'
          },
          'connectorName',
          'itemName',
          'myTmpFolder',
          addContent,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(addContent).toHaveBeenCalledWith({ type: 'any', filePath });
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
          `Error when deleting CSV file "${filePath}" after caching it. ${new Error('unlink error')}`
        );
      });

      it('should properly write results without compression and log unlink errors', async () => {
        (fs.unlink as jest.Mock).mockImplementation(() => {
          throw new Error('unlink error');
        });
        await persistResults(
          dataToWrite,
          {
            type: 'file',
            filename: 'myFilename.csv',
            compression: false
          },
          'connectorName',
          'itemName',
          'myTmpFolder',
          addContent,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(addContent).toHaveBeenCalledWith({ type: 'any', filePath });
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(`Error when deleting file "${filePath}" after caching it. ${new Error('unlink error')}`);
      });
    });

    describe('with compression', () => {
      beforeEach(() => {
        jest.resetAllMocks();
        const onFinish = jest.fn((event, handler) => handler());
        const onError = jest.fn().mockImplementation(() => {
          return { on: onFinish };
        });

        const myReadStream = {
          pipe: jest.fn().mockReturnThis(),
          on: onError
        };
        (fsSync.createReadStream as jest.Mock).mockReturnValueOnce(myReadStream);

        const myWriteStream = {
          pipe: jest.fn().mockReturnThis(),
          on: jest.fn().mockImplementation((event, handler) => {
            handler();
            return this;
          })
        };
        (fsSync.createReadStream as jest.Mock).mockReturnValueOnce(myWriteStream);
        (csv.unparse as jest.Mock).mockReturnValue('csv content');
        (zlib.createGzip as jest.Mock).mockReturnValue({});
      });

      it('should properly persists results into CSV file', async () => {
        await persistResults(
          dataToWrite,
          {
            type: 'csv',
            delimiter: 'SEMI_COLON',
            filename: 'myFilename.csv',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-ddTHH:mm:ss.SSS',
            outputTimezone: 'UTC'
          },
          'connectorName',
          'itemName',
          'myTmpFolder',
          addContent,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(addContent).toHaveBeenCalledWith({ type: 'any', filePath: `${filePath}.gz` });
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledWith(`${filePath}.gz`);
        expect(fs.unlink).toHaveBeenCalledTimes(2);
      });

      it('should properly persists results into file', async () => {
        await persistResults(
          dataToWrite,
          {
            type: 'file',
            filename: 'myFilename.csv',
            compression: true
          },
          'connectorName',
          'itemName',
          'myTmpFolder',
          addContent,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(addContent).toHaveBeenCalledWith({ type: 'any', filePath: `${filePath}.gz` });
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledWith(`${filePath}.gz`);
        expect(fs.unlink).toHaveBeenCalledTimes(2);
      });

      it('should properly persists results into values', async () => {
        await persistResults(
          dataToWrite,
          {
            type: 'json'
          },
          'connectorName',
          'itemName',
          'myTmpFolder',
          addContent,
          logger
        );
        expect(addContent).toHaveBeenCalledWith({ type: 'time-values', content: dataToWrite });
      });

      it('should properly persists results into CSV file and log unlink errors', async () => {
        (fs.unlink as jest.Mock).mockImplementation(() => {
          throw new Error('unlink error');
        });
        await persistResults(
          dataToWrite,
          {
            type: 'csv',
            delimiter: 'SEMI_COLON',
            filename: 'myFilename.csv',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-ddTHH:mm:ss.SSS',
            outputTimezone: 'UTC'
          },
          'connectorName',
          'itemName',
          'myTmpFolder',
          addContent,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(logger.error).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenCalledWith(`Error when deleting CSV file "${filePath}" after compression. Error: unlink error`);
        expect(logger.error).toHaveBeenCalledWith(
          `Error when deleting compressed CSV file "${filePath}.gz" after caching it. Error: unlink error`
        );
        expect(addContent).toHaveBeenCalledWith({ type: 'any', filePath: `${filePath}.gz` });
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledWith(`${filePath}.gz`);
        expect(fs.unlink).toHaveBeenCalledTimes(2);
      });

      it('should properly persists results into file and log unlink errors', async () => {
        (fs.unlink as jest.Mock).mockImplementation(() => {
          throw new Error('unlink error');
        });
        await persistResults(
          dataToWrite,
          {
            type: 'file',
            filename: 'myFilename.csv',
            compression: true
          },
          'connectorName',
          'itemName',
          'myTmpFolder',
          addContent,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(logger.error).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenCalledWith(`Error when deleting file "${filePath}" after compression. Error: unlink error`);
        expect(logger.error).toHaveBeenCalledWith(
          `Error when deleting compressed file "${filePath}.gz" after caching it. Error: unlink error`
        );
        expect(addContent).toHaveBeenCalledWith({ type: 'any', filePath: `${filePath}.gz` });
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledWith(`${filePath}.gz`);
        expect(fs.unlink).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('convertDateTimeFromInstant', () => {
    const testInstant = '2020-02-02T02:02:02.222Z';

    it('should return empty string', () => {
      const dateTimeFormat = {
        type: 'unix-epoch-ms' as DateTimeType
      };
      const result = formatInstant(undefined, dateTimeFormat);
      expect(result).toEqual('');
    });

    it('should return Number of ms', () => {
      const dateTimeFormat = {
        type: 'unix-epoch-ms' as DateTimeType
      };
      const expectedResult = DateTime.fromISO(testInstant).toMillis();
      const result = formatInstant(testInstant, dateTimeFormat);
      expect(result).toEqual(expectedResult);
      expect(
        DateTime.fromMillis(result as number)
          .toUTC()
          .toISO()
      ).toEqual('2020-02-02T02:02:02.222Z');
    });

    it('should return Number of seconds', () => {
      const dateTimeFormat = {
        type: 'unix-epoch' as DateTimeType
      };
      const expectedResult = Math.floor(DateTime.fromISO(testInstant).toMillis() / 1000);
      const result = formatInstant(testInstant, dateTimeFormat);
      expect(result).toEqual(expectedResult);
      expect(
        DateTime.fromMillis((result as number) * 1000)
          .toUTC()
          .toISO()
      ).toEqual('2020-02-02T02:02:02.000Z');
    });

    it('should return a formatted String with correct timezone', () => {
      const dateTimeFormat = {
        type: 'string' as DateTimeType,
        timezone: 'Asia/Tokyo',
        format: 'yyyy-MM-dd HH:mm:ss.SSS',
        locale: 'en-US'
      };
      const expectedResult = DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toFormat(dateTimeFormat.format);
      const result = formatInstant(testInstant, dateTimeFormat);
      expect(result).toEqual(expectedResult);
      // The date was converted from a zulu string to Asia/Tokyo time, so with the formatter, we retrieve the Asia Tokyo time with +9 offset
      expect(result).toEqual('2020-02-02 11:02:02.222');
    });

    it('should return a formatted ISO String from ISO String', () => {
      const dateTimeFormat = {
        type: 'iso-string' as DateTimeType
      };
      const result = formatInstant(testInstant, dateTimeFormat);
      expect(result).toEqual(testInstant);
    });

    it('should return a formatted Date', () => {
      const dateTimeFormat = {
        type: 'date' as DateTimeType,
        timezone: 'Asia/Tokyo'
      };
      const result = formatInstant(testInstant, dateTimeFormat);
      expect(result).toEqual('2020-02-02');
    });

    it('should return a formatted small-date-time', () => {
      const dateTimeFormat = {
        type: 'small-date-time' as DateTimeType,
        timezone: 'Asia/Tokyo'
      };
      const result = formatInstant(testInstant, dateTimeFormat);
      expect(result).toEqual('2020-02-02 11:02:02');
    });

    it('should return a formatted DateTime', () => {
      const dateTimeFormat = {
        type: 'date-time' as DateTimeType,
        timezone: 'Asia/Tokyo'
      };
      const result = formatInstant(testInstant, dateTimeFormat);
      expect(result).toEqual('2020-02-02 11:02:02.222');
    });

    it('should return a formatted String with correct timezone for locale en-US', () => {
      const dateTimeFormat = {
        type: 'string' as DateTimeType,
        timezone: 'Asia/Tokyo',
        format: 'dd-MMM-yy HH:mm:ss', // format with localized month
        locale: 'en-US'
      };
      // From Zulu string
      const expectedResult = DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toFormat(dateTimeFormat.format);
      const result = formatInstant(testInstant, dateTimeFormat);
      expect(result).toEqual(expectedResult);
      // The date was converted from a zulu string to Asia/Tokyo time, so with the formatter, we retrieve the Asia Tokyo time with +9 offset
      expect(result).toEqual('02-Feb-20 11:02:02');
    });

    it('should return a formatted String with correct timezone for locale fr-FR', () => {
      const dateTimeFormat = {
        type: 'string' as DateTimeType,
        timezone: 'Asia/Tokyo',
        format: 'dd-MMM-yy HH:mm:ss', // format with localized month
        locale: 'fr-FR'
      };
      const expectedResult = DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toFormat(dateTimeFormat.format, {
        locale: dateTimeFormat.locale
      });
      const result = formatInstant(testInstant, dateTimeFormat);
      expect(result).toEqual(expectedResult);
      // The date was converted from a zulu string to Asia/Tokyo time, so with the formatter, we retrieve the Asia Tokyo time with +9 offset
      expect(result).toEqual('02-févr.-20 11:02:02');
    });

    it('should return an ISO String from Date with correct timezone', () => {
      const dateTimeFormat = {
        type: 'date-time-offset' as DateTimeType,
        timezone: 'Asia/Tokyo'
      };
      // From Zulu string
      const expectedResult = DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toUTC().toISO()!;
      const result = formatInstant(testInstant, dateTimeFormat);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('convertDelimiter', () => {
    it('should convert to csv delimiter', () => {
      expect(convertDelimiter('NON_BREAKING_SPACE')).toEqual(' ');
      expect(convertDelimiter('COLON')).toEqual(':');
      expect(convertDelimiter('COMMA')).toEqual(',');
      expect(convertDelimiter('DOT')).toEqual('.');
      expect(convertDelimiter('SLASH')).toEqual('/');
      expect(convertDelimiter('PIPE')).toEqual('|');
      expect(convertDelimiter('SEMI_COLON')).toEqual(';');
      expect(convertDelimiter('TAB')).toEqual(' ');
    });
  });

  describe('convertDateTimeToInstant', () => {
    beforeAll(() => {
      jest.spyOn(DateTime, 'fromJSDate').mockImplementation(date => {
        if (date instanceof Date && !isNaN(date.getTime())) {
          return DateTime.fromISO(testData.constants.dates.FAKE_NOW);
        }
        throw new Error('Invalid date');
      });
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    describe('when no type is provided', () => {
      it('should return the input if it is a valid ISO string', () => {
        const result = convertDateTimeToInstant('2023-01-01T00:00:00Z', {});
        expect(result).toBe('2023-01-01T00:00:00Z');
      });

      it('should throw an error if input is not a valid ISO string', () => {
        expect(() => convertDateTimeToInstant('not-an-iso-string', {})).toThrow(
          'The value must be a valid ISO string if no type is provided: "not-an-iso-string"'
        );
        expect(() => convertDateTimeToInstant(123, {})).toThrow('The value must be a valid ISO string if no type is provided: "123"');
        expect(() => convertDateTimeToInstant(new Date(), {})).toThrow('The value must be a valid ISO string if no type is provided: "');
      });
    });

    describe('unix-epoch', () => {
      it('should convert a number (seconds since epoch) to ISO string', () => {
        const result = convertDateTimeToInstant(1672531200, { type: 'unix-epoch' });
        expect(result).toBe('2023-01-01T00:00:00.000Z');
      });

      it('should convert a numeric string (seconds since epoch) to ISO string', () => {
        const result = convertDateTimeToInstant('1672531200', { type: 'unix-epoch' });
        expect(result).toBe('2023-01-01T00:00:00.000Z');
      });

      it('should throw an error if input is not a number or numeric string', () => {
        expect(() => convertDateTimeToInstant(new Date(), { type: 'unix-epoch' })).toThrow(
          'The value must be a number or numeric string for type "unix-epoch": "'
        );
        expect(() => convertDateTimeToInstant('not-a-number', { type: 'unix-epoch' })).toThrow(
          'Failed to convert "not-a-number" to Instant for type "unix-epoch"'
        );
      });
    });

    describe('unix-epoch-ms', () => {
      it('should convert a number (milliseconds since epoch) to ISO string', () => {
        const result = convertDateTimeToInstant(1672531200000, { type: 'unix-epoch-ms' });
        expect(result).toBe('2023-01-01T00:00:00.000Z');
      });

      it('should convert a numeric string (milliseconds since epoch) to ISO string', () => {
        const result = convertDateTimeToInstant('1672531200000', { type: 'unix-epoch-ms' });
        expect(result).toBe('2023-01-01T00:00:00.000Z');
      });

      it('should throw an error if input is not a number or numeric string', () => {
        expect(() => convertDateTimeToInstant(new Date(), { type: 'unix-epoch-ms' })).toThrow(
          'The value must be a number or numeric string for type "unix-epoch-ms": "'
        );
        expect(() => convertDateTimeToInstant('not-a-number', { type: 'unix-epoch-ms' })).toThrow(
          'Failed to convert "not-a-number" to Instant for type "unix-epoch-ms"'
        );
      });
    });

    describe('iso-string', () => {
      it('should convert a valid ISO string to ISO string', () => {
        const result = convertDateTimeToInstant('2023-01-01T12:00:00+02:00', { type: 'iso-string' });
        expect(result).toBe('2023-01-01T10:00:00.000Z');
      });

      it('should throw an error if input is not a string', () => {
        expect(() => convertDateTimeToInstant(123, { type: 'iso-string' })).toThrow(
          'The value must be a string for type "iso-string": "123"'
        );
        expect(() => convertDateTimeToInstant(new Date(), { type: 'iso-string' })).toThrow(
          'The value must be a string for type "iso-string": "'
        );
      });
    });

    describe('string', () => {
      it('should convert a string with format to ISO string', () => {
        const result = convertDateTimeToInstant('01/01/2023', {
          type: 'string',
          format: 'MM/dd/yyyy',
          timezone: 'Europe/Paris'
        });
        expect(result).toMatch(/2022-12-31T.*Z/);
      });

      it('should throw an error if input is not a string', () => {
        expect(() => convertDateTimeToInstant(123, { type: 'string', format: 'MM/dd/yyyy' })).toThrow(
          'The value must be a string and format must be provided for type "string": "123"'
        );
      });

      it('should throw an error if format is not provided', () => {
        expect(() => convertDateTimeToInstant('01/01/2023', { type: 'string' })).toThrow(
          'The value must be a string and format must be provided for type "string": "01/01/2023"'
        );
      });

      it('should throw an error if string cannot be parsed with the given format', () => {
        expect(() =>
          convertDateTimeToInstant('not-a-date', {
            type: 'string',
            format: 'MM/dd/yyyy'
          })
        ).toThrow('Failed to convert "not-a-date" to Instant for type "string"');
      });
    });

    describe('Date types (date, small-date-time, date-time, date-time-2)', () => {
      const dateTypes: Array<'date' | 'small-date-time' | 'date-time' | 'date-time-2'> = [
        'date',
        'small-date-time',
        'date-time',
        'date-time-2'
      ];

      dateTypes.forEach(type => {
        describe(type, () => {
          it('should convert a Date object to ISO string', () => {
            const result = convertDateTimeToInstant(new Date(testData.constants.dates.FAKE_NOW), { type, timezone: 'UTC' });
            expect(result).toBe(testData.constants.dates.FAKE_NOW);
          });

          it('should convert a Date object to ISO string with timezone', () => {
            const result = convertDateTimeToInstant(new Date(testData.constants.dates.FAKE_NOW), {
              type,
              timezone: 'America/New_York'
            });
            expect(result).toBe('2021-01-02T05:00:00.000Z');
          });

          it('should throw an error if input is not a Date object', () => {
            expect(() => convertDateTimeToInstant('not-a-date', { type })).toThrow(
              `The value must be a Date object for type "${type}": "not-a-date"`
            );
            expect(() => convertDateTimeToInstant(123, { type })).toThrow(`The value must be a Date object for type "${type}": "123"`);
          });
        });
      });
    });

    describe('date-time-offset, timestamp, timestamptz', () => {
      const dateTypes: Array<'date-time-offset' | 'timestamp' | 'timestamptz'> = ['date-time-offset', 'timestamp', 'timestamptz'];

      dateTypes.forEach(type => {
        describe(type, () => {
          it('should convert a Date object to ISO string', () => {
            const result = convertDateTimeToInstant(new Date(testData.constants.dates.FAKE_NOW), { type, timezone: 'UTC' });
            expect(result).toBe(testData.constants.dates.FAKE_NOW);
          });

          it('should throw an error if input is not a Date object', () => {
            expect(() => convertDateTimeToInstant('not-a-date', { type })).toThrow(
              `The value must be a Date object for type "${type}": "not-a-date"`
            );
            expect(() => convertDateTimeToInstant(123, { type })).toThrow(`The value must be a Date object for type "${type}": "123"`);
          });
        });
      });

      describe('unsupported type', () => {
        it('should throw an error for unsupported types', () => {
          expect(() =>
            convertDateTimeToInstant(new Date(), {
              type: 'unsupported-type' as unknown as DateTimeType
            })
          ).toThrow('Unsupported DateTimeType: "unsupported-type"');
        });
      });
    });
  });

  describe('formatQueryParams', () => {
    it('should correctly return void string when there is no query params', () => {
      const result = formatQueryParams('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z', []);
      expect(result).toEqual({});
    });

    it('should correctly format query params with ISO date string', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2021-01-01T00:00:00.000Z';
      const queryParams = [
        { key: 'start', value: '@StartTime' },
        { key: 'end', value: '@EndTime' },
        { key: 'anotherParam', value: 'anotherQueryParam' }
      ];

      const result = formatQueryParams(startTime, endTime, queryParams);
      expect(result).toEqual({ anotherParam: 'anotherQueryParam', end: '2021-01-01T00:00:00.000Z', start: '2020-01-01T00:00:00.000Z' });
    });
  });

  it('should get OIBus info', () => {
    const expectedResult: OIBusInfo = {
      architecture: process.arch,
      binaryDirectory: process.execPath,
      dataDirectory: process.cwd(),
      hostname: os.hostname(),
      operatingSystem: `${os.type()} ${os.release()}`,
      processId: process.pid.toString(),
      version: '3.3.3',
      launcherVersion: '3.5.0',
      oibusId: 'id',
      oibusName: 'name',
      platform: getPlatformFromOsType(os.type())
    };
    const result = getOIBusInfo({ id: 'id', name: 'name', version: '3.3.3', launcherVersion: '3.5.0' } as EngineSettingsDTO);
    expect(result).toEqual(expectedResult);
  });

  it('should return proper platform from OS type', async () => {
    expect(getPlatformFromOsType('Linux')).toEqual('linux');
    expect(getPlatformFromOsType('Darwin')).toEqual('macos');
    expect(getPlatformFromOsType('Windows_NT')).toEqual('windows');
    expect(getPlatformFromOsType('unknown')).toEqual('unknown');
  });

  describe('validateCronExpression', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    });

    it('should properly validate a cron expression (every second)', () => {
      const result = validateCronExpression('* * * * * *');
      const expectedResult = {
        isValid: true,
        errorMessage: '',
        humanReadableForm: 'Every second, every minute, every hour, every day',
        nextExecutions: ['2021-01-02T00:00:01.000Z', '2021-01-02T00:00:02.000Z', '2021-01-02T00:00:03.000Z']
      };
      expect(result).toEqual(expectedResult);
    });

    it('should properly validate a cron expression', () => {
      const result = validateCronExpression('0 */10 * * * *');
      const expectedResult = {
        isValid: true,
        errorMessage: '',
        humanReadableForm: 'Every 10 minutes, every hour, every day',
        nextExecutions: ['2021-01-02T00:10:00.000Z', '2021-01-02T00:20:00.000Z', '2021-01-02T00:30:00.000Z']
      };
      expect(result).toEqual(expectedResult);
    });

    it('should throw an error for too many fields', () => {
      expect(validateCronExpression('* * * * * * 2024')).toEqual({
        isValid: false,
        errorMessage: 'Too many fields. Only seconds, minutes, hours, day of month, month and day of week are supported.',
        humanReadableForm: '',
        nextExecutions: []
      });
    });

    it('should throw an error for non standard characters', () => {
      expect(validateCronExpression('* * * * 5L')).toEqual({
        isValid: false,
        errorMessage: 'Expression contains non-standard characters: L',
        humanReadableForm: '',
        nextExecutions: []
      });

      expect(validateCronExpression('* * * W * *')).toEqual({
        isValid: false,
        errorMessage: 'Expression contains non-standard characters: W',
        humanReadableForm: '',
        nextExecutions: []
      });

      expect(validateCronExpression('* * * * * 5#3')).toEqual({
        isValid: false,
        errorMessage: 'Expression contains non-standard characters: #',
        humanReadableForm: '',
        nextExecutions: []
      });

      expect(validateCronExpression('? ? * * * *')).toEqual({
        isValid: false,
        errorMessage: 'Expression contains non-standard characters: ?',
        humanReadableForm: '',
        nextExecutions: []
      });

      expect(validateCronExpression('H * * * *')).toEqual({
        isValid: false,
        errorMessage: 'Expression contains non-standard characters: H',
        humanReadableForm: '',
        nextExecutions: []
      });
    });

    it('should throw an error for invalid cron expression caught by cronstrue', () => {
      expect(validateCronExpression('0 35 10 19 01')).toEqual({
        isValid: false,
        errorMessage: 'Hours part must be >= 0 and <= 23',
        humanReadableForm: '',
        nextExecutions: []
      });
      expect(validateCronExpression('0 23 10 19 01')).toEqual({
        isValid: false,
        errorMessage: 'Month part must be >= 1 and <= 12',
        humanReadableForm: '',
        nextExecutions: []
      });
      expect(validateCronExpression('0 23 10 12 8')).toEqual({
        isValid: false,
        errorMessage: 'DOW part must be >= 0 and <= 6',
        humanReadableForm: '',
        nextExecutions: []
      });
    });

    it('should throw an error for invalid cron expression caught by cron-parser', () => {
      expect(validateCronExpression('0 23 10 12 6/-')).toEqual({
        isValid: false,
        errorMessage: 'Constraint error, cannot repeat at every NaN time.',
        humanReadableForm: '',
        nextExecutions: []
      });
      expect(validateCronExpression('0 23 10-1 12 6/1')).toEqual({
        isValid: false,
        errorMessage: 'Invalid range: 10-1, min(10) > max(1)',
        humanReadableForm: '',
        nextExecutions: []
      });
    });

    it('should catch unexpected errors', () => {
      jest.spyOn(cronstrue, 'toString').mockImplementation(() => {
        throw null;
      });
      expect(validateCronExpression('* * * * * *')).toEqual({
        isValid: false,
        errorMessage: 'Invalid cron expression',
        humanReadableForm: '',
        nextExecutions: []
      });
    });
  });

  describe('checkScanMode', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    });

    it('should properly check scan mode', () => {
      expect(checkScanMode(testData.scanMode.list, 'scanModeId1', null)).toEqual(testData.scanMode.list[0]);
      expect(() => checkScanMode(testData.scanMode.list, null, null)).toThrow('Scan mode not specified');
      expect(() => checkScanMode(testData.scanMode.list, null, 'bad scan mode name')).toThrow('Scan mode "bad scan mode name" not found');
      expect(checkScanMode(testData.scanMode.list, null, testData.scanMode.list[0].name)).toEqual(testData.scanMode.list[0]);
    });
  });

  describe('itemToFlattenedCSV', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    });

    it('should properly convert items into csv', () => {
      (csv.unparse as jest.Mock).mockReturnValue('csv content');

      expect(
        itemToFlattenedCSV(
          [
            ...testData.south.list[2].items.map(item => ({ ...item, settings: { ...item.settings, objectSettings: {} } })),
            {
              ...testData.south.list[2].items[0]
            }
          ],
          ',',
          testData.scanMode.list
        )
      ).toEqual('csv content');
    });

    it('should properly convert without scan modes', () => {
      (csv.unparse as jest.Mock).mockReturnValue('csv content');

      expect(
        itemToFlattenedCSV(
          [
            ...testData.south.list[2].items.map(item => ({ ...item, settings: { ...item.settings, objectSettings: {} } })),
            {
              ...testData.south.list[2].items[0]
            }
          ],
          ','
        )
      ).toEqual('csv content');
    });
  });

  describe('stringToBoolean', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    });

    it('should properly convert string to boolean', () => {
      expect(stringToBoolean('true')).toEqual(true);
      expect(stringToBoolean('True')).toEqual(true);
      expect(stringToBoolean('TRUE')).toEqual(true);
      expect(stringToBoolean('1')).toEqual(true);
      expect(stringToBoolean('false')).toEqual(false);
      expect(stringToBoolean('False')).toEqual(false);
      expect(stringToBoolean('FALSE')).toEqual(false);
      expect(stringToBoolean('0')).toEqual(false);
      expect(stringToBoolean('99')).toEqual(false);
    });
  });

  describe('testIPOnFilter', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return false for an empty filter list', () => {
      expect(testIPOnFilter([], '192.168.1.1')).toEqual(false);
    });

    it('should return true for a matching IPv4 address', () => {
      expect(testIPOnFilter(['192.168.1.*'], '192.168.1.1')).toEqual(true);
      expect(testIPOnFilter(['192.168.*.*'], '192.168.1.1')).toEqual(true);
    });

    it('should return true for a matching IPv6-mapped IPv4 address', () => {
      const ipFilters = ['192.168.1.*'];
      expect(testIPOnFilter(ipFilters, '::ffff:192.168.1.1')).toEqual(true);
    });

    it('should return false for a non-matching IPv4 address', () => {
      const ipFilters = ['192.168.2.*'];
      expect(testIPOnFilter(ipFilters, '192.168.1.1')).toEqual(false);
    });

    it('should return false for a non-matching IPv6-mapped IPv4 address', () => {
      const ipFilters = ['192.168.2.*'];
      expect(testIPOnFilter(ipFilters, '::ffff:192.168.1.1')).toEqual(false);
    });

    it('should return true for a direct matching IPv4 address', () => {
      const ipFilters = ['192.168.1.1'];
      expect(testIPOnFilter(ipFilters, '192.168.1.1')).toEqual(true);
    });

    it('should return true for a direct matching IPv6-mapped IPv4 address', () => {
      const ipFilters = ['192.168.1.1'];
      expect(testIPOnFilter(ipFilters, '::ffff:192.168.1.1')).toEqual(true);
    });

    it('should return true for a matching IPv6 address', () => {
      const ipFilters = ['2001:0db8:85a3:0000:0000:8a2e:0370:*'];
      expect(testIPOnFilter(ipFilters, '2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toEqual(true);
    });

    it('should return false for a non-matching IPv6 address', () => {
      const ipFilters = ['2001:0db8:85a3:0000:0000:8a2e:0370:*'];
      expect(testIPOnFilter(ipFilters, '2001:0db8:85a3:0000:0000:8a2e:0371:7334')).toEqual(false);
    });

    it('should return true for localhost IPv4', () => {
      const ipFilters = ['127.0.0.1'];
      expect(testIPOnFilter(ipFilters, '127.0.0.1')).toEqual(true);
    });

    it('should return true for localhost IPv6', () => {
      const ipFilters = ['::1'];
      expect(testIPOnFilter(ipFilters, '::1')).toEqual(true);
    });

    it('should return true for any IP with wildcard *', () => {
      const ipFilters = ['*'];
      expect(testIPOnFilter(ipFilters, '192.168.1.1')).toEqual(true);
      expect(testIPOnFilter(ipFilters, '::ffff:192.168.1.1')).toEqual(true);
      expect(testIPOnFilter(ipFilters, '2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toEqual(true);
    });
  });
});
