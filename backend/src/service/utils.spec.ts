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
  downloadFile,
  filesExists,
  formatInstant,
  formatQueryParams,
  generateIntervals,
  generateRandomId,
  generateReplacementParameters,
  getCommandLineArguments,
  getFilesFiltered,
  getNetworkSettingsFromRegistration,
  getOIBusInfo,
  getPlatformFromOsType,
  httpGetWithBody,
  logQuery,
  persistResults,
  unzip,
  validateCronExpression
} from './utils';
import csv from 'papaparse';
import pino from 'pino';
import AdmZip from 'adm-zip';
import fetch from 'node-fetch';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { DateTimeType } from '../../../shared/model/types';
import Stream from 'node:stream';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import { EngineSettingsDTO, OIBusInfo, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import { createProxyAgent } from './proxy-agent';
import EncryptionService from './encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import cronstrue from 'cronstrue';

jest.mock('node:zlib');
jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('minimist');
jest.mock('papaparse');
jest.mock('adm-zip');
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');
jest.mock('node:http', () => ({ request: jest.fn() }));
jest.mock('node:https', () => ({ request: jest.fn() }));
jest.mock('./proxy-agent');

const nowDateString = '2020-02-02T02:02:02.222Z';
describe('Service utils', () => {
  describe('getNetworkSettings', () => {
    const encryptionService: EncryptionService = new EncryptionServiceMock('', '');

    it('should get network settings and throw error if not registered', async () => {
      await expect(
        getNetworkSettingsFromRegistration(
          {
            status: 'PENDING'
          } as RegistrationSettingsDTO,
          '/api/oianalytics/oibus-commands/${oibusId}/check',
          encryptionService
        )
      ).rejects.toThrow('OIBus not registered in OIAnalytics');
    });

    it('should get network settings', async () => {
      const settings: RegistrationSettingsDTO = {
        status: 'REGISTERED',
        host: 'http://localhost:4200/',
        token: 'my token',
        useProxy: false,
        acceptUnauthorized: false
      } as RegistrationSettingsDTO;

      const result = await getNetworkSettingsFromRegistration(settings, '/endpoint', encryptionService);
      expect(result).toEqual({
        host: 'http://localhost:4200',
        headers: { authorization: 'Bearer my token' },
        agent: undefined
      });
      expect(createProxyAgent).toHaveBeenCalledWith(false, 'http://localhost:4200/endpoint', null, false);
    });

    it('should get network settings and proxy', async () => {
      const settings: RegistrationSettingsDTO = {
        status: 'REGISTERED',
        host: 'http://localhost:4200/',
        token: 'my token',
        useProxy: true,
        proxyUrl: 'https://proxy.url',
        proxyUsername: 'user',
        proxyPassword: 'pass',
        acceptUnauthorized: false
      } as RegistrationSettingsDTO;

      const result = await getNetworkSettingsFromRegistration(settings, '/endpoint', encryptionService);
      expect(result).toEqual({
        host: 'http://localhost:4200',
        headers: { authorization: 'Bearer my token' },
        agent: undefined
      });
      expect(createProxyAgent).toHaveBeenCalledWith(
        true,
        'http://localhost:4200/endpoint',
        { url: 'https://proxy.url', username: 'user', password: 'pass' },
        false
      );
    });

    it('should get network settings and proxy without pass', async () => {
      const settings: RegistrationSettingsDTO = {
        status: 'REGISTERED',
        host: 'http://localhost:4200/',
        token: 'my token',
        useProxy: true,
        proxyUrl: 'https://proxy.url',
        proxyUsername: 'user',
        proxyPassword: '',
        acceptUnauthorized: false
      } as RegistrationSettingsDTO;

      const result = await getNetworkSettingsFromRegistration(settings, '/endpoint', encryptionService);
      expect(result).toEqual({
        host: 'http://localhost:4200',
        headers: { authorization: 'Bearer my token' },
        agent: undefined
      });
      expect(createProxyAgent).toHaveBeenCalledWith(
        true,
        'http://localhost:4200/endpoint',
        { url: 'https://proxy.url', username: 'user', password: null },
        false
      );
    });
  });

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
        ignoreRemoteConfig: false
      });
    });

    it('should parse command line arguments with args', () => {
      (minimist as unknown as jest.Mock).mockReturnValue({
        check: true,
        config: 'myConfig.json',
        ignoreIpFilters: true,
        ignoreRemoteUpdate: true,
        ignoreRemoteConfig: true
      });
      const result = getCommandLineArguments();
      expect(result).toEqual({
        check: true,
        configFile: path.resolve('myConfig.json'),
        ignoreIpFilters: true,
        ignoreRemoteUpdate: true,
        ignoreRemoteConfig: true
      });
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
        expect(addContent).toHaveBeenCalledWith({ type: 'raw', filePath });
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
        expect(addContent).toHaveBeenCalledWith({ type: 'raw', filePath });
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
        expect(addContent).toHaveBeenCalledWith({ type: 'raw', filePath });
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
        expect(addContent).toHaveBeenCalledWith({ type: 'raw', filePath });
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
        expect(addContent).toHaveBeenCalledWith({ type: 'raw', filePath: `${filePath}.gz` });
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
        expect(addContent).toHaveBeenCalledWith({ type: 'raw', filePath: `${filePath}.gz` });
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
        expect(addContent).toHaveBeenCalledWith({ type: 'raw', filePath: `${filePath}.gz` });
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
        expect(addContent).toHaveBeenCalledWith({ type: 'raw', filePath: `${filePath}.gz` });
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
      await expect(httpGetWithBody('body', { protocol: 'https:' })).rejects.toThrow('an error');
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
      await expect(httpGetWithBody('body', { protocol: 'https:' })).rejects.toThrow(
        'Unexpected token \'s\', "some datab"... is not valid JSON'
      );
    });
  });

  describe('downloadFile', () => {
    const connectionSettings = {
      host: 'http://localhost:4200',
      agent: undefined,
      headers: { authorization: `Bearer token` }
    };

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should download file', async () => {
      const filePath = 'oibus.zip';
      const timeout = 1000;

      const response = new Response('content');
      (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(response));

      await downloadFile(connectionSettings, '/endpoint', filePath, timeout);

      expect(fetch).toHaveBeenCalledWith(`${connectionSettings.host}/endpoint`, {
        method: 'GET',
        timeout,
        headers: connectionSettings.headers,
        agent: connectionSettings.agent
      });
      expect(fs.writeFile).toHaveBeenCalledWith(filePath, Buffer.from('content'));
    });

    it('should handle fetch error during download', async () => {
      const filePath = 'oibus.zip';
      const timeout = 1000;

      (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('error');
      });

      try {
        await downloadFile(connectionSettings, '/endpoint', filePath, timeout);
      } catch (error) {
        expect(error).toEqual(new Error('Download failed: Error: error'));
      }
      expect(fetch).toHaveBeenCalledWith(`${connectionSettings.host}/endpoint`, {
        method: 'GET',
        timeout,
        headers: connectionSettings.headers,
        agent: connectionSettings.agent
      });
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle invalid fetch response during download', async () => {
      const filePath = 'oibus.zip';
      const timeout = 1000;
      (fetch as unknown as jest.Mock).mockReturnValueOnce(
        Promise.resolve(new Response('invalid', { status: 404, statusText: 'Not Found' }))
      );

      try {
        await downloadFile(connectionSettings, '/endpoint', filePath, timeout);
      } catch (error) {
        expect(error).toEqual(new Error('Download failed with status code 404 and message: Not Found'));
      }
      expect(fetch).toHaveBeenCalledWith(`${connectionSettings.host}/endpoint`, {
        method: 'GET',
        timeout,
        headers: connectionSettings.headers,
        agent: connectionSettings.agent
      });
      expect(fs.writeFile).not.toHaveBeenCalled();
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
      oibusId: 'id',
      oibusName: 'name',
      platform: getPlatformFromOsType(os.type())
    };
    const result = getOIBusInfo({ id: 'id', name: 'name', version: '3.3.3' } as EngineSettingsDTO);
    expect(result).toEqual(expectedResult);
  });

  it('should return proper platform from OS type', async () => {
    expect(getPlatformFromOsType('Linux')).toEqual('linux');
    expect(getPlatformFromOsType('Darwin')).toEqual('macos');
    expect(getPlatformFromOsType('Windows_NT')).toEqual('windows');
    expect(getPlatformFromOsType('unknown')).toEqual('unknown');
  });

  describe('getFilesFiltered', () => {
    const logger: pino.Logger = new PinoLogger();

    beforeEach(() => {
      jest.resetAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    });

    it('should properly get files', async () => {
      (fs.readdir as jest.Mock).mockImplementation(() => ['file1', 'file2', 'file3', 'anotherFile', 'errorFile']);
      (fs.stat as jest.Mock)
        .mockImplementationOnce(() => ({ mtimeMs: DateTime.fromISO('2020-02-02T04:02:02.222Z').toMillis() }))
        .mockImplementationOnce(() => ({ mtimeMs: DateTime.fromISO('2020-02-02T06:02:02.222Z').toMillis() }))
        .mockImplementationOnce(() => ({ mtimeMs: DateTime.fromISO('2020-02-04T02:02:02.222Z').toMillis() }))
        .mockImplementationOnce(() => ({ mtimeMs: DateTime.fromISO('2020-02-05T02:02:02.222Z').toMillis() }))
        .mockImplementationOnce(() => {
          throw new Error('error file');
        });

      const files = await getFilesFiltered('errorFolder', '2020-02-02T02:02:02.222Z', '2020-02-03T02:02:02.222Z', 'file', logger);

      expect(files).toEqual([
        { filename: 'file1', modificationDate: '2020-02-02T04:02:02.222Z' },
        { filename: 'file2', modificationDate: '2020-02-02T06:02:02.222Z' }
      ]);
      expect(logger.error).toHaveBeenCalledWith(
        `Error while reading in errorFolder folder file stats "${path.join('errorFolder', 'errorFile')}": Error: error file`
      );
    });

    it('should properly get files', async () => {
      (fs.readdir as jest.Mock).mockImplementation(() => ['file1', 'file2']);
      (fs.stat as jest.Mock)
        .mockReturnValueOnce({ mtimeMs: DateTime.fromISO('2000-02-02T02:02:02.222Z').toMillis() })
        .mockReturnValueOnce({ mtimeMs: DateTime.fromISO('2030-02-02T02:02:02.222Z').toMillis() });

      const files = await getFilesFiltered('errorFolder', '2020-02-02T02:02:02.222Z', '2020-02-03T02:02:02.222Z', 'file', logger);

      expect(files).toEqual([]);
    });

    it('should properly get files without filtering', async () => {
      (fs.readdir as jest.Mock).mockImplementation(() => ['file1', 'file2']);
      (fs.stat as jest.Mock)
        .mockReturnValueOnce({ mtimeMs: DateTime.fromISO('2000-02-02T02:02:02.222Z').toMillis(), size: 100 })
        .mockReturnValueOnce({ mtimeMs: DateTime.fromISO('2030-02-02T02:02:02.222Z').toMillis(), size: 60 });

      const files = await getFilesFiltered('errorFolder', '', '', '', logger);

      expect(files).toEqual([
        { filename: 'file1', modificationDate: '2000-02-02T02:02:02.222Z', size: 100 },
        {
          filename: 'file2',
          modificationDate: '2030-02-02T02:02:02.222Z',
          size: 60
        }
      ]);
    });
  });

  describe('validateCronExpression', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    });

    it('should properly validate a cron expression', () => {
      const result = validateCronExpression('* * * * * *');
      const expectedResult = {
        humanReadableForm: 'Every second, every minute, every hour, every day',
        nextExecutions: ['2020-02-02T02:02:03.000Z', '2020-02-02T02:02:04.000Z', '2020-02-02T02:02:05.000Z']
      };
      expect(result).toEqual(expectedResult);
    });

    it('should properly validate a cron expression', () => {
      const result = validateCronExpression('0 */10 * * * *');
      const expectedResult = {
        humanReadableForm: 'Every 10 minutes, every hour, every day',
        nextExecutions: ['2020-02-02T02:10:00.000Z', '2020-02-02T02:20:00.000Z', '2020-02-02T02:30:00.000Z']
      };
      expect(result).toEqual(expectedResult);
    });

    it('should throw an error for too many fields', () => {
      expect(() => validateCronExpression('* * * * * * 2024')).toThrow(
        'Too many fields. Only seconds, minutes, hours, day of month, month and day of week are supported.'
      );
    });

    it('should throw an error for non standard characters', () => {
      expect(() => validateCronExpression('* * * * 5L')).toThrow('Expression contains non-standard characters: L');
      expect(() => validateCronExpression('* * * W * *')).toThrow('Expression contains non-standard characters: W');
      expect(() => validateCronExpression('* * * * * 5#3')).toThrow('Expression contains non-standard characters: #');
      expect(() => validateCronExpression('? ? * * * *')).toThrow('Expression contains non-standard characters: ?');
      expect(() => validateCronExpression('H * * * *')).toThrow('Expression contains non-standard characters: H');
    });

    it('should throw an error for invalid cron expression caught by cronstrue', () => {
      expect(() => validateCronExpression('0 35 10 19 01')).toThrow('Hours part must be >= 0 and <= 23');
      expect(() => validateCronExpression('0 23 10 19 01')).toThrow('Month part must be >= 1 and <= 12');
      expect(() => validateCronExpression('0 23 10 12 8')).toThrow('DOW part must be >= 0 and <= 6');
    });

    it('should throw an error for invalid cron expression caught by cron-parser', () => {
      expect(() => validateCronExpression('0 23 10 12 6/')).toThrow('Constraint error, cannot repeat at every 0 time.');
      expect(() => validateCronExpression('0 23 10 12 6/-')).toThrow('Constraint error, cannot repeat at every NaN time.');
      expect(() => validateCronExpression('0 23 10 12 6/-')).toThrow('Constraint error, cannot repeat at every NaN time.');
      expect(() => validateCronExpression('0 23 10-1 12 6/1')).toThrow('Invalid range: 10-1');
    });

    it('should catch unexpected errors', () => {
      jest.spyOn(cronstrue, 'toString').mockImplementation(() => {
        throw null;
      });
      expect(() => validateCronExpression('* * * * * *')).toThrow('Invalid cron expression');
    });
  });
});
