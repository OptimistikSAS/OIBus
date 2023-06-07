import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync, { Dirent, Stats } from 'node:fs';
import zlib from 'node:zlib';

import minimist from 'minimist';

import { DateTime } from 'luxon';
import * as utils from './utils';
import { logQuery } from './utils';
import csv from 'papaparse';
import pino from 'pino';
import PinoLogger from '../tests/__mocks__/logger.mock';

jest.mock('node:zlib');
jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('minimist');
jest.mock('papaparse');

const nowDateString = '2020-02-02T02:02:02.222Z';

describe('Service utils', () => {
  describe('getCommandLineArguments', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should parse command line arguments without args', () => {
      (minimist as unknown as jest.Mock).mockReturnValue({});
      const result = utils.getCommandLineArguments();
      expect(result).toEqual({ check: false, configFile: path.resolve('./') });
    });

    it('should parse command line arguments with args', () => {
      (minimist as unknown as jest.Mock).mockReturnValue({ check: true, config: 'myConfig.json' });
      const result = utils.getCommandLineArguments();
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

      await utils.delay(1000);
      jest.advanceTimersToNextTimer();
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    });
  });

  describe('generateIntervals', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(nowDateString));
      jest.clearAllMocks();
    });

    it('should return only one interval', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2020-01-01T01:00:00.000Z';
      const expectedIntervals = [{ start: startTime, end: endTime }];
      const results = utils.generateIntervals(startTime, endTime, 3600);
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
      const results = utils.generateIntervals(startTime1, endTime2, 3600);
      expect(results).toEqual(expectedIntervals);
    });
  });

  describe('replaceFilenameWithVariable', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(nowDateString));
      jest.clearAllMocks();
    });

    it('should properly name file with variables in the name', () => {
      expect(utils.replaceFilenameWithVariable('myFileName.csv', 0, 'south')).toEqual('myFileName.csv');
      expect(utils.replaceFilenameWithVariable('myFileName-@QueryPart.csv', 0, 'south')).toEqual('myFileName-0.csv');
      expect(utils.replaceFilenameWithVariable('myFileName-@ConnectorName-@QueryPart.csv', 0, 'south')).toEqual('myFileName-south-0.csv');
      expect(utils.replaceFilenameWithVariable('myFileName-@ConnectorName-@CurrentDate.csv', 0, 'south')).toEqual(
        `myFileName-south-${DateTime.local().toFormat('yyyy_MM_dd_HH_mm_ss_SSS')}.csv`
      );
      expect(utils.replaceFilenameWithVariable('myFileName-@ConnectorName-@QueryPart-@CurrentDate.csv', 17, 'south')).toEqual(
        `myFileName-south-17-${DateTime.local().toFormat('yyyy_MM_dd_HH_mm_ss_SSS')}.csv`
      );
    });
  });

  describe('filesExists', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(nowDateString));
      jest.clearAllMocks();
    });

    it('should properly check if a file does not exist', async () => {
      (fs.stat as jest.Mock).mockImplementation(() => {
        throw new Error('File does not exist');
      });

      expect(await utils.filesExists('myConfigFile.json')).toEqual(false);

      (fs.stat as jest.Mock).mockImplementation(() => null);
      expect(await utils.filesExists('myConfigFile.json')).toEqual(true);
    });
  });

  describe('createFolder', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(nowDateString));
      jest.clearAllMocks();
    });

    it('should properly create folder', async () => {
      const folderToCreate = 'myFolder';
      (fs.mkdir as jest.Mock).mockImplementation(() => null);
      (fs.stat as jest.Mock).mockImplementation(() => null);

      await utils.createFolder(folderToCreate);
      expect(fs.mkdir).not.toHaveBeenCalled();

      (fs.stat as jest.Mock).mockImplementation(() => {
        throw new Error('File does not exist');
      });

      await utils.createFolder(folderToCreate);

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
      await utils.compress('myInputFile', 'myOutputFile');

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
        await utils.compress('myInputFile', 'myOutputFile');
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
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly generate a random ID with a standard size', () => {
      const randomId = utils.generateRandomId();
      expect(randomId.length).toEqual(16);
    });

    it('should properly generate a random ID with smaller size', () => {
      const randomId = utils.generateRandomId(8);
      expect(randomId.length).toEqual(8);
    });

    it('should properly generate a random ID with bigger size', () => {
      const randomId = utils.generateRandomId(32);
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

      const dirSize = await utils.dirSize('myDir');
      expect(fs.readdir).toHaveBeenCalledWith('myDir', { withFileTypes: true });
      expect(fs.readdir).toHaveBeenCalledWith(path.join('myDir', 'dir'), { withFileTypes: true });
      expect(fs.stat).toHaveBeenCalledWith(path.join('myDir', 'file1'));
      expect(fs.stat).toHaveBeenCalledWith(path.join('myDir', 'file2'));
      expect(fs.stat).toHaveBeenCalledWith(path.join('myDir', 'dir', 'file3'));
      expect(fs.stat).toHaveBeenCalledWith(path.join('myDir', 'dir', 'file5'));
      expect(fs.stat).toHaveBeenCalledTimes(4);
      expect(dirSize).toEqual(11);
    });
  });

  describe('getMostRecentDate', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should get most recent date with Date of SQL string type', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const entryList = [
        {
          value: 'val1',
          timestamp: '2020-01-01 00:00:00.000'
        },
        {
          value: 'val2',
          timestamp: '2021-01-01 00:00:00.000'
        },
        {
          value: 'val3',
          timestamp: '2020-02-01 00:00:00.000'
        }
      ];

      const mostRecentDate = utils.getMostRecentDate(entryList, startTime, 'timestamp', 'Europe/Paris');
      expect(mostRecentDate).toEqual('2020-12-31T23:00:00.001Z');
    });

    it('should get most recent date with Date of Date type', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const entryList = [
        {
          value: 'val1',
          timestamp: new Date('2020-01-01T00:00:00.000Z')
        },
        {
          value: 'val2',
          timestamp: new Date('2022-01-01T00:00:00.000Z')
        },
        {
          value: 'val3',
          timestamp: new Date('2021-01-01T00:00:00.000Z')
        }
      ];

      const mostRecentDate = utils.getMostRecentDate(
        entryList,
        startTime,
        'timestamp',
        'Europe/Paris' // timezone is ignored in case of Date type
      );
      expect(mostRecentDate).toEqual('2022-01-01T00:00:00.001Z');
    });

    it('should get most recent date with Date of number type', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const entryList = [
        {
          value: 'val1',
          timestamp: new Date('2020-01-01T00:00:00.000Z').getTime()
        },
        {
          value: 'val2',
          timestamp: new Date('2022-01-01T00:00:00.000Z').getTime()
        },
        {
          value: 'val3',
          timestamp: new Date('2021-01-01T00:00:00.000Z').getTime()
        }
      ];

      const mostRecentDate = utils.getMostRecentDate(
        entryList,
        startTime,
        'timestamp',
        'Europe/Paris' // timezone is ignored in case of Date type
      );
      expect(mostRecentDate).toEqual('2022-01-01T00:00:00.001Z');
    });

    it('should get most recent date with Date of ISO string type', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const entryList = [
        {
          value: 'val1',
          timestamp: '2020-01-01T00:00:00.000+06:00'
        },
        {
          value: 'val2',
          timestamp: '2022-01-01T00:00:00.000+06:00'
        },
        {
          value: 'val3',
          timestamp: '2021-01-01T00:00:00.000+06:00'
        }
      ];

      const mostRecentDate = utils.getMostRecentDate(
        entryList,
        startTime,
        'timestamp',
        'Europe/Paris' // timezone is ignored in case of ISO string type
      );
      expect(mostRecentDate).toEqual('2021-12-31T18:00:00.001Z');
    });

    it('should keep startTime as most recent date if no timeColumn', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const entryList = [
        {
          value: 'val1',
          timestamp: '2020-01-01 00:00:00.000'
        },
        {
          value: 'val2',
          timestamp: '2021-01-01 00:00:00.000'
        },
        {
          value: 'val3',
          timestamp: '2020-02-01 00:00:00.000'
        }
      ];

      const mostRecentDate = utils.getMostRecentDate(entryList, startTime, 'anotherTimeColumn', 'Europe/Paris');
      expect(mostRecentDate).toEqual(startTime);
    });

    it('should not parse Date if not in correct type', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const entryList = [
        {
          value: 'val1',
          timestamp: undefined
        },
        {
          value: 'val2',
          timestamp: 'abc'
        }
      ];

      const mostRecentDate = utils.getMostRecentDate(entryList, startTime, 'timestamp', 'Europe/Paris');
      expect(mostRecentDate).toEqual(startTime);
    });
  });

  describe('generateReplacementParameters', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    // TODO: date format
    it('should generate replacement parameters', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2021-01-01T00:00:00.000Z';
      const query = 'SELECT * FROM table WHERE timestamp > @StartTime && timestamp < @EndTime && @StartTime > timestamp';

      const expectedResult = [startTime, endTime, startTime];
      const result = utils.generateReplacementParameters(query, startTime, endTime);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('generateCSV', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should call csv unparse with correctly formatted dates', () => {
      const entryList = [
        {
          value: 'val1',
          timestamp: new Date('2020-01-01T00:00:00.000Z')
        },
        {
          value: 'val2',
          timestamp: '2021-01-01 00:00:00.000'
        },
        {
          value: 'val3',
          timestamp: new Date('2020-01-01T00:00:00.000Z').getTime()
        },
        {
          value: 'val4',
          timestamp: undefined
        }
      ];

      utils.generateCSV(entryList, ';');

      expect(csv.unparse).toHaveBeenCalledWith(entryList, { header: true, delimiter: ';' });
    });
  });

  describe('logQuery', () => {
    const logger: pino.Logger = new PinoLogger();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should properly log a query with variables', () => {
      const query = 'SELECT * FROM logs WHERE timestamp > @StartTime AND timestamp < @EndTime';
      utils.logQuery(query, '2020-01-01T00:00:00.000Z', '2023-01-01T00:00:00.000Z', logger);

      expect(logger.info).toHaveBeenCalledWith(
        `Sending "${query}" with @StartTime = 2020-01-01T00:00:00.000Z @EndTime = 2023-01-01T00:00:00.000Z`
      );
    });

    it('should properly log a query without variable', () => {
      const query = 'SELECT * FROM logs';
      utils.logQuery(query, '2020-01-01T00:00:00.000Z', '2023-01-01T00:00:00.000Z', logger);

      expect(logger.info).toHaveBeenCalledWith(`Sending "${query}"`);
    });
  });

  describe('writeResults', () => {
    const logger: pino.Logger = new PinoLogger();
    const dataToWrite = [{ data1: 1 }, { data2: 2 }];
    beforeEach(() => {
      jest.resetAllMocks();
    });

    describe('without compression', () => {
      it('should properly write results without compression', async () => {
        const addFile = jest.fn();
        await utils.writeResults(
          dataToWrite,
          {
            delimiter: ';',
            filename: 'myFilename.csv'
          },
          false,
          'connectorName',
          'myTmpFolder',
          addFile,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(addFile).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledTimes(1);
      });

      it('should properly write and compress results and log unlink errors', async () => {
        (fs.unlink as jest.Mock).mockImplementation(() => {
          throw new Error('unlink error');
        });
        const addFile = jest.fn();
        await utils.writeResults(
          dataToWrite,
          {
            delimiter: ';',
            filename: 'myFilename.csv'
          },
          false,
          'connectorName',
          'myTmpFolder',
          addFile,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(`Error when deleting file "${filePath}" after caching it. Error: unlink error`);
        expect(addFile).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledTimes(1);
      });
    });

    describe('with compression', () => {
      beforeEach(() => {
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
      });

      it('should properly write and compress results', async () => {
        const addFile = jest.fn();
        await utils.writeResults(
          dataToWrite,
          {
            delimiter: ';',
            filename: 'myFilename.csv'
          },
          true,
          'connectorName',
          'myTmpFolder',
          addFile,
          logger
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        expect(addFile).toHaveBeenCalledWith(`${filePath}.gz`);
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
        expect(fs.unlink).toHaveBeenCalledWith(`${filePath}.gz`);
        expect(fs.unlink).toHaveBeenCalledTimes(2);
      });

      it('should properly write and compress results and log unlink errors', async () => {
        (fs.unlink as jest.Mock).mockImplementation(() => {
          throw new Error('unlink error');
        });
        const addFile = jest.fn();
        await utils.writeResults(
          dataToWrite,
          {
            delimiter: ';',
            filename: 'myFilename.csv'
          },
          true,
          'connectorName',
          'myTmpFolder',
          addFile,
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
});
