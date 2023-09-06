import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync, { Dirent, Stats } from 'node:fs';
import zlib from 'node:zlib';

import minimist from 'minimist';

import { DateTime } from 'luxon';
import {
  compress,
  convertDateTimeToInstant,
  convertDelimiter,
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
  httpGetWithBody,
  logQuery,
  persistResults
} from './utils';
import csv from 'papaparse';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/logger.mock';
import { DateTimeType } from '../../../shared/model/types';
import Stream from 'node:stream';
import http from 'node:http';
import https from 'node:https';

jest.mock('node:zlib');
jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('minimist');
jest.mock('papaparse');
jest.mock('node:http', () => ({ request: jest.fn() }));
jest.mock('node:https', () => ({ request: jest.fn() }));

const nowDateString = '2020-02-02T02:02:02.222Z';

describe('Service utils', () => {
  describe('getCommandLineArguments', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should parse command line arguments without args', () => {
      (minimist as unknown as jest.Mock).mockReturnValue({});
      const result = getCommandLineArguments();
      expect(result).toEqual({ check: false, configFile: path.resolve('./') });
    });

    it('should parse command line arguments with args', () => {
      (minimist as unknown as jest.Mock).mockReturnValue({ check: true, config: 'myConfig.json' });
      const result = getCommandLineArguments();
      expect(result).toEqual({ check: true, configFile: path.resolve('myConfig.json') });
    });
  });

  describe('delay', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(nowDateString));
      jest.clearAllMocks();
    });

    it('should delay', async () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        return callback();
      });

      await delay(1000);
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

      expect(fsSync.createReadStream).toBeCalledTimes(1);
      expect(fsSync.createReadStream).toHaveBeenCalledWith('myInputFile');
      expect(myReadStream.pipe).toBeCalledTimes(2);
      expect(fsSync.createWriteStream).toBeCalledTimes(1);
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
      expect(fsSync.createReadStream).toBeCalledTimes(1);
      expect(fsSync.createReadStream).toHaveBeenCalledWith('myInputFile');
      expect(myReadStream.pipe).toBeCalledTimes(2);
      expect(fsSync.createWriteStream).toBeCalledTimes(1);
      expect(fsSync.createWriteStream).toHaveBeenCalledWith('myOutputFile');
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
    const addFile = jest.fn();
    const addValues = jest.fn();
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
            type: 'csv',
            delimiter: 'SEMI_COLON',
            filename: 'myFilename.csv',
            compression: false,
            outputTimestampFormat: 'yyyy-MM-ddTHH:mm:ss.SSS',
            outputTimezone: 'UTC'
          },
          'connectorName',
          'myTmpFolder',
          addFile,
          addValues,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(addFile).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledTimes(1);
      });

      it('should properly write results without compression and log unlink errors', async () => {
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
          'myTmpFolder',
          addFile,
          addValues,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(addFile).toHaveBeenCalledWith(filePath);
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

      it('should properly persists results into file', async () => {
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
          'myTmpFolder',
          addFile,
          addValues,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(addFile).toHaveBeenCalledWith(`${filePath}.gz`);
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledWith(`${filePath}.gz`);
        expect(fs.unlink).toHaveBeenCalledTimes(2);
      });

      it('should properly persists results into values', async () => {
        await persistResults(
          dataToWrite,
          {
            type: 'json',
            filename: '',
            compression: false,
            delimiter: 'COMMA',
            outputTimestampFormat: 'yyyy-MM-ddTHH:mm:ss.SSS',
            outputTimezone: 'UTC'
          },
          'connectorName',
          'myTmpFolder',
          addFile,
          addValues,
          logger
        );
        expect(addValues).toHaveBeenCalledWith(dataToWrite);
      });

      it('should properly persists results into file and log unlink errors', async () => {
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
          'myTmpFolder',
          addFile,
          addValues,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(logger.error).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenCalledWith(`Error when deleting file "${filePath}" after compression. Error: unlink error`);
        expect(logger.error).toHaveBeenCalledWith(
          `Error when deleting compressed file "${filePath}.gz" after caching it. Error: unlink error`
        );
        expect(addFile).toHaveBeenCalledWith(`${filePath}.gz`);
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledWith(`${filePath}.gz`);
        expect(fs.unlink).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('convertDateTimeFromInstant', () => {
    const testInstant = '2020-02-02T02:02:02.222Z';

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
        type: 'Date' as DateTimeType,
        timezone: 'Asia/Tokyo'
      };
      const result = formatInstant(testInstant, dateTimeFormat);
      expect(result).toEqual('2020-02-02');
    });

    it('should return a formatted SmallDateTime', () => {
      const dateTimeFormat = {
        type: 'SmallDateTime' as DateTimeType,
        timezone: 'Asia/Tokyo'
      };
      const result = formatInstant(testInstant, dateTimeFormat);
      expect(result).toEqual('2020-02-02 11:02:02');
    });

    it('should return a formatted DateTime', () => {
      const dateTimeFormat = {
        type: 'DateTime' as DateTimeType,
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
        type: 'DateTimeOffset' as DateTimeType,
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
    const testInstant = '2020-02-02T02:02:02.222Z';
    it('should return current value if no type specified', () => {
      const result = convertDateTimeToInstant(testInstant, { type: '' as DateTimeType });
      expect(result).toEqual(testInstant);
    });

    it('should return ISO String if no dateTimeFormat specified', () => {
      const result = convertDateTimeToInstant(testInstant, { type: 'iso-string' });
      expect(result).toEqual('2020-02-02T02:02:02.222Z');
    });

    it('should return ISO String from unix-epoch', () => {
      const result = convertDateTimeToInstant(Math.floor(DateTime.fromISO(testInstant).toMillis() / 1000), { type: 'unix-epoch' });
      expect(result).toEqual('2020-02-02T02:02:02.000Z');
    });

    it('should return ISO String from unix-epoch-ms', () => {
      const result = convertDateTimeToInstant(DateTime.fromISO(testInstant).toMillis(), { type: 'unix-epoch-ms' });
      expect(result).toEqual('2020-02-02T02:02:02.222Z');
    });

    it('should return ISO string from specific string with correct timezone', () => {
      const dateTimeFormat = {
        type: 'string' as DateTimeType,
        timezone: 'Asia/Tokyo',
        format: 'yyyy-MM-dd HH:mm:ss.SSS',
        locale: 'en-US'
      };
      const result = convertDateTimeToInstant(
        DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toFormat(dateTimeFormat.format),
        dateTimeFormat
      );
      // The date was converted from a zulu string to Asia/Tokyo time, so with the formatter, we retrieve the Asia Tokyo time with +9 offset
      expect(result).toEqual('2020-02-02T02:02:02.222Z');
    });

    it('should return a formatted ISO String', () => {
      const dateTimeFormat = {
        type: 'iso-string' as DateTimeType
      };
      const result = convertDateTimeToInstant(testInstant, dateTimeFormat);
      expect(result).toEqual(testInstant);
    });

    it('should return a formatted String with correct timezone for locale en-US', () => {
      const dateTimeFormat = {
        type: 'string' as DateTimeType,
        timezone: 'Asia/Tokyo',
        format: 'dd-MMM-yy HH:mm:ss', // format with localized month
        locale: 'en-US'
      };
      const result = convertDateTimeToInstant(
        DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toFormat(dateTimeFormat.format),
        dateTimeFormat
      );
      expect(result).toEqual('2020-02-02T02:02:02.000Z');
    });

    it('should return a formatted String with correct timezone for locale fr-FR', () => {
      const dateTimeFormat = {
        type: 'string' as DateTimeType,
        timezone: 'Asia/Tokyo',
        format: 'dd-MMM-yy HH:mm:ss', // format with localized month
        locale: 'fr-FR'
      };
      const result = convertDateTimeToInstant(
        DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toFormat(dateTimeFormat.format, {
          locale: dateTimeFormat.locale
        }),
        dateTimeFormat
      );
      expect(result).toEqual('2020-02-02T02:02:02.000Z');
    });

    it('should return an ISO String from timestamp with correct timezone', () => {
      const dateTimeFormat = {
        type: 'timestamp' as DateTimeType,
        timezone: 'Asia/Tokyo'
      };
      // From Zulu string
      const result = convertDateTimeToInstant(new Date(testInstant), dateTimeFormat);
      // The date was converted from a zulu string to Asia/Tokyo time, so with the formatter, we retrieve the Asia Tokyo time with +9 offset
      expect(result).toEqual('2020-02-01T17:02:02.222Z');
    });

    it('should return an ISO String from timestamptz with correct timezone', () => {
      const dateTimeFormat = {
        type: 'DateTimeOffset' as DateTimeType,
        timezone: 'Asia/Tokyo'
      };
      const result = convertDateTimeToInstant(new Date(testInstant), dateTimeFormat);
      expect(result).toEqual('2020-02-02T02:02:02.222Z');
    });
  });

  describe('formatQueryParams', () => {
    it('should correctly return void string when there is no query params', () => {
      const result = formatQueryParams('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z', []);
      expect(result).toEqual('');
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
      expect(result).toEqual('?start=2020-01-01T00%3A00%3A00.000Z&end=2021-01-01T00%3A00%3A00.000Z&' + 'anotherParam=anotherQueryParam');
    });
  });

  describe('httpGetWithBody', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    });

    it('should correctly create a body with GET HTTP', async () => {
      const streamStream = new Stream();
      const onMock = jest.fn();
      const writeMock = jest.fn();
      const endMock = jest.fn();
      (http.request as jest.Mock).mockImplementation((options, callback) => {
        callback(streamStream);
        streamStream.emit('data', '{ "data": "myValue" }');
        streamStream.emit('end'); // this will trigger the promise resolve

        return {
          on: onMock,
          write: writeMock,
          end: endMock
        };
      });
      const expectedResult = { data: 'myValue' };
      const result = await httpGetWithBody('body', { protocol: 'http:' });
      expect(result).toEqual(expectedResult);
      expect(onMock).toHaveBeenCalledTimes(1);
      expect(writeMock).toHaveBeenCalledTimes(1);
      expect(writeMock).toHaveBeenCalledWith('body');
      expect(endMock).toHaveBeenCalledTimes(1);
    });

    it('should correctly create a body with GET HTTPS', async () => {
      const streamStream = new Stream();
      const onMock = jest.fn();
      const writeMock = jest.fn();
      const endMock = jest.fn();
      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(streamStream);
        streamStream.emit('data', '{ "data": "myValue" }');
        streamStream.emit('end'); // this will trigger the promise resolve

        return {
          on: onMock,
          write: writeMock,
          end: endMock
        };
      });
      const expectedResult = { data: 'myValue' };
      const result = await httpGetWithBody('body', { protocol: 'https:' });
      expect(result).toEqual(expectedResult);
      expect(onMock).toHaveBeenCalledTimes(1);
      expect(writeMock).toHaveBeenCalledTimes(1);
      expect(writeMock).toHaveBeenCalledWith('body');
      expect(endMock).toHaveBeenCalledTimes(1);
    });

    it('should throw an error when HTTP req throws an error', async () => {
      const streamStream = new Stream();
      const onMock = jest.fn((type, callback) => {
        callback(new Error('an error'));
      });
      const writeMock = jest.fn(() => {
        streamStream.emit('error', new Error('an error'));
      });

      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(streamStream);

        return {
          on: onMock,
          write: writeMock,
          end: jest.fn()
        };
      });
      await expect(httpGetWithBody('body', { protocol: 'https:' })).rejects.toThrowError('an error');
    });

    it('should throw an error when parsing received data', async () => {
      const streamStream = new Stream();
      (https.request as jest.Mock).mockImplementation((options, callback) => {
        callback(streamStream);
        streamStream.emit('data', 'some data');
        streamStream.emit('data', 'but not a');
        streamStream.emit('data', 'json');
        streamStream.emit('end'); // this will trigger the promise resolve
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn()
        };
      });
      await expect(httpGetWithBody('body', { protocol: 'https:' })).rejects.toThrowError('Unexpected token s in JSON at position 0');
    });
  });
});
