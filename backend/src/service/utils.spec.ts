import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import type { Dirent, Stats } from 'node:fs';
import zlib from 'node:zlib';
import { DateTime } from 'luxon';
import { Readable } from 'node:stream';
import os from 'node:os';
import { mockModule, reloadModule, seq } from '../tests/utils/test-utils';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import type { DateTimeType } from '../../shared/model/types';
import type { EngineSettingsDTO, OIBusInfo } from '../../shared/model/engine.model';
import type { SouthConnectorItemDTO } from '../../shared/model/south-connector.model';
import type { HistoryQueryItemDTO } from '../../shared/model/history-query.model';
import type { OIBusError as OIBusErrorType } from '../model/engine.model';
import cronstrue from 'cronstrue';
import testData from '../tests/utils/test-data';

const nodeRequire = createRequire(import.meta.url);

// Module-level mock exports for third-party modules
const minimistExports = mock.fn(() => ({}));
const csvExports = {
  unparse: mock.fn((_data?: unknown, _config?: unknown): string => 'csv content')
};
let admZipInstance: { extractAllTo: ReturnType<typeof mock.fn> };
function AdmZipMock() {
  return admZipInstance;
}
const admZipExports = AdmZipMock;

// Type for the utils module exports
type UtilsModule = typeof import('./utils');

describe('Service utils', () => {
  let utils: UtilsModule;
  let OIBusError: typeof OIBusErrorType;

  before(() => {
    mockModule(nodeRequire, 'minimist', minimistExports);
    mockModule(nodeRequire, 'papaparse', csvExports);
    mockModule(nodeRequire, 'adm-zip', admZipExports);

    utils = reloadModule<UtilsModule>(nodeRequire, './utils');
    // OIBusError is a class from model/engine.model - import it directly
    OIBusError = nodeRequire('../model/engine.model').OIBusError;
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('getCommandLineArguments', () => {
    let consoleSpy: ReturnType<typeof mock.method>;

    beforeEach(() => {
      minimistExports.mock.resetCalls();
      minimistExports.mock.mockImplementation(() => ({}));
      consoleSpy = mock.method(console, 'info', () => undefined);
    });

    it('should parse command line arguments without args', () => {
      minimistExports.mock.mockImplementation(() => ({}));
      const result = utils.getCommandLineArguments();

      assert.strictEqual(consoleSpy.mock.calls.length >= 1, true);
      const infoArg = consoleSpy.mock.calls[0].arguments[0] as string;
      assert.strictEqual(infoArg.includes('OIBus starting with the following arguments:'), true);
      assert.deepStrictEqual(result, {
        version: false,
        configFile: path.resolve('./'),
        ignoreIpFilters: false,
        ignoreRemoteUpdate: false,
        ignoreRemoteConfig: false,
        launcherVersion: '3.4.0'
      });
    });

    it('should parse command line arguments with args', () => {
      minimistExports.mock.mockImplementation(() => ({
        version: true,
        config: 'myConfig.json',
        ignoreIpFilters: true,
        ignoreRemoteUpdate: true,
        ignoreRemoteConfig: true,
        launcherVersion: '3.5.0'
      }));
      const result = utils.getCommandLineArguments();

      assert.strictEqual(consoleSpy.mock.calls.length >= 1, true);
      const infoArg = consoleSpy.mock.calls[0].arguments[0] as string;
      assert.strictEqual(infoArg.includes('OIBus starting with the following arguments:'), true);
      assert.deepStrictEqual(result, {
        version: true,
        configFile: path.resolve('myConfig.json'),
        ignoreIpFilters: true,
        ignoreRemoteUpdate: true,
        ignoreRemoteConfig: true,
        launcherVersion: '3.5.0'
      });
    });
  });

  describe('delay', () => {
    it('should delay', async () => {
      // Just verify delay resolves without hanging (using a tiny timeout)
      await utils.delay(0);
    });
  });

  describe('generateIntervals', () => {
    it('should return only one interval', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const startTimeFromCache = '2020-01-01T00:00:00.000Z';
      const endTime = '2020-01-01T01:00:00.000Z';
      const expectedIntervals = [{ start: startTime, end: endTime }];
      const { intervals, numberOfIntervalsDone } = utils.generateIntervals(startTime, startTimeFromCache, endTime, 3600);
      assert.deepStrictEqual(intervals, expectedIntervals);
      assert.deepStrictEqual(numberOfIntervalsDone, 0);
    });

    it('should return only one interval when max number of seconds is 0', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const startTimeFromCache = '2020-01-01T00:00:00.000Z';
      const endTime = '2020-01-01T01:00:00.000Z';
      const expectedIntervals = [{ start: startTime, end: endTime }];
      const { intervals, numberOfIntervalsDone } = utils.generateIntervals(startTime, startTimeFromCache, endTime, 0);
      assert.deepStrictEqual(intervals, expectedIntervals);
      assert.deepStrictEqual(numberOfIntervalsDone, 0);
    });

    it('should return two intervals', () => {
      const startTime1 = '2020-01-01T00:00:00.000Z';
      const startTimeFromCache = '2020-01-01T01:30:00.000Z';
      const endTime1 = '2020-01-01T01:00:00.000Z';
      const endTime2 = '2020-01-01T02:00:00.000Z';
      const startTime3 = '2020-01-01T02:00:00.000Z';
      const endTime3 = '2020-01-01T02:50:00.000Z';
      const expectedIntervals = [
        { start: startTime1, end: endTime1 },
        { start: startTimeFromCache, end: endTime2 },
        { start: startTime3, end: endTime3 }
      ];
      const { intervals, numberOfIntervalsDone } = utils.generateIntervals(startTime1, startTimeFromCache, endTime3, 3600);
      assert.deepStrictEqual(intervals, expectedIntervals);
      assert.deepStrictEqual(numberOfIntervalsDone, 1);
    });

    it('should return single interval when maxNumberOfSecondsInInterval is 0', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const startTimeFromCache = '2020-01-01T00:00:00.000Z';
      const endTime = '2020-01-02T00:00:00.000Z';
      const { intervals, numberOfIntervalsDone } = utils.generateIntervals(startTime, startTimeFromCache, endTime, 0);
      assert.deepStrictEqual(intervals, [{ start: startTimeFromCache, end: endTime }]);
      assert.deepStrictEqual(numberOfIntervalsDone, 0);
    });
  });

  describe('filesExists', () => {
    it('should properly check if a file does not exist', async () => {
      mock.method(fs, 'stat', () => {
        throw new Error('File does not exist');
      });

      assert.deepStrictEqual(await utils.filesExists('myConfigFile.json'), false);
    });

    it('should properly check if a file exists', async () => {
      mock.method(fs, 'stat', async () => null);

      assert.deepStrictEqual(await utils.filesExists('myConfigFile.json'), true);
    });
  });

  describe('createFolder', () => {
    it('should properly create folder when it exists', async () => {
      const folderToCreate = 'myFolder';
      const mkdirMock = mock.method(fs, 'mkdir', async () => null);
      mock.method(fs, 'stat', async () => null);

      await utils.createFolder(folderToCreate);
      assert.strictEqual(mkdirMock.mock.calls.length, 0);
    });

    it('should properly create folder when it does not exist', async () => {
      const folderToCreate = 'myFolder';
      const mkdirMock = mock.method(fs, 'mkdir', async () => null);
      mock.method(fs, 'stat', () => {
        throw new Error('File does not exist');
      });

      await utils.createFolder(folderToCreate);

      assert.strictEqual(mkdirMock.mock.calls.length, 1);
      assert.deepStrictEqual(mkdirMock.mock.calls[0].arguments, [path.resolve(folderToCreate), { recursive: true }]);
    });
  });

  describe('getFilenameWithoutRandomId', () => {
    it('should properly get filename without random id', () => {
      assert.deepStrictEqual(utils.getFilenameWithoutRandomId('test.file'), 'test.file');
      assert.deepStrictEqual(utils.getFilenameWithoutRandomId('test-12345.file'), 'test.file');
      assert.deepStrictEqual(utils.getFilenameWithoutRandomId('test-12345.csv.gz'), 'test.gz'); // This case should never happen
      assert.deepStrictEqual(utils.getFilenameWithoutRandomId('test.csv-12345.gz'), 'test.csv.gz');
      assert.deepStrictEqual(utils.getFilenameWithoutRandomId(path.join('folder', 'sub-directory', 'test-12345.file')), 'test.file');
    });
  });

  describe('compress', () => {
    it('should properly compress file', async () => {
      const onFinish = mock.fn((event: string, handler: () => void) => handler());
      const onError = mock.fn(() => ({ on: onFinish }));
      const myReadStream = {
        pipe: mock.fn(function (this: unknown) {
          return this;
        }),
        on: onError
      };
      const createReadStreamMock = mock.method(
        fsSync,
        'createReadStream',
        seq(() => myReadStream as unknown as fsSync.ReadStream)
      );

      const myWriteStream: { pipe: ReturnType<typeof mock.fn>; on: ReturnType<typeof mock.fn> } = {
        pipe: mock.fn(function (this: unknown) {
          return this;
        }),
        on: mock.fn((event: string, handler: () => void) => {
          handler();
          return myWriteStream;
        })
      };
      mock.method(fsSync, 'createWriteStream', () => myWriteStream as unknown as fsSync.WriteStream);
      mock.method(zlib, 'createGzip', () => ({}) as zlib.Gzip);

      await utils.compress('myInputFile', 'myOutputFile');

      assert.strictEqual(createReadStreamMock.mock.calls.length, 1);
      assert.deepStrictEqual(createReadStreamMock.mock.calls[0].arguments, ['myInputFile']);
      assert.strictEqual(myReadStream.pipe.mock.calls.length, 2);
    });

    it('should properly manage error when compressing file', async () => {
      const myReadStream: { pipe: ReturnType<typeof mock.fn>; on: ReturnType<typeof mock.fn> } = {
        pipe: mock.fn(function (this: unknown) {
          return this;
        }),
        on: mock.fn((event: string, handler: (err: string) => void) => {
          handler('compression error');
          return myReadStream;
        })
      };
      const createReadStreamMock = mock.method(
        fsSync,
        'createReadStream',
        seq(() => myReadStream as unknown as fsSync.ReadStream)
      );
      mock.method(fsSync, 'createWriteStream', () => ({}) as fsSync.WriteStream);
      mock.method(zlib, 'createGzip', () => ({}) as zlib.Gzip);

      let expectedError: unknown = null;
      try {
        await utils.compress('myInputFile', 'myOutputFile');
      } catch (error) {
        expectedError = error;
      }
      assert.deepStrictEqual(expectedError, 'compression error');
      assert.strictEqual(createReadStreamMock.mock.calls.length, 1);
      assert.deepStrictEqual(createReadStreamMock.mock.calls[0].arguments, ['myInputFile']);
      assert.strictEqual(myReadStream.pipe.mock.calls.length, 2);
    });
  });

  describe('unzip', () => {
    it('should properly unzip file', () => {
      const extractAllTo = mock.fn();
      admZipInstance = { extractAllTo };

      utils.unzip('myInputFile', 'myOutputFolder');

      assert.strictEqual(extractAllTo.mock.calls.length, 1);
    });

    it('should properly manage unzip errors', () => {
      const extractAllTo = mock.fn(() => {
        throw new Error('unzip error');
      });
      admZipInstance = { extractAllTo };

      let expectedError: unknown = null;
      try {
        utils.unzip('myInputFile', 'myOutputFolder');
      } catch (error) {
        expectedError = error;
      }

      assert.deepStrictEqual(expectedError, new Error('unzip error'));
      assert.strictEqual(extractAllTo.mock.calls.length, 1);
    });
  });

  describe('generateRandomId', () => {
    it('should properly generate a random ID with a standard size', () => {
      const randomId = utils.generateRandomId();
      assert.strictEqual(randomId.length, 16);
    });

    it('should properly generate a random ID with smaller size', () => {
      const randomId = utils.generateRandomId(8);
      assert.strictEqual(randomId.length, 8);
    });

    it('should properly generate a random ID with bigger size', () => {
      const randomId = utils.generateRandomId(32);
      assert.strictEqual(randomId.length, 32);
    });
  });

  describe('dirSize', () => {
    it('should properly retrieve dir size', async () => {
      const firstFolder = [
        { name: 'file1', isDirectory: () => false, isFile: () => true } as unknown as Dirent,
        { name: 'file2', isDirectory: () => false, isFile: () => true } as unknown as Dirent,
        { name: 'dir', isDirectory: () => true, isFile: () => false } as unknown as Dirent
      ];
      const secondFolder = [
        { name: 'file3', isDirectory: () => false, isFile: () => true } as unknown as Dirent,
        { name: 'file4', isDirectory: () => false, isFile: () => false } as unknown as Dirent,
        { name: 'file5', isDirectory: () => false, isFile: () => true } as unknown as Dirent
      ];

      const readdirMock = mock.method(
        fs,
        'readdir',
        seq(
          async () => firstFolder as unknown as Awaited<ReturnType<typeof fs.readdir>>,
          async () => secondFolder as unknown as Awaited<ReturnType<typeof fs.readdir>>
        )
      );

      const statMock = mock.method(
        fs,
        'stat',
        seq(
          async () => ({ size: 1 }) as Stats,
          async () => ({ size: 2 }) as Stats,
          async () => {
            throw new Error('stat error');
          },
          async () => ({ size: 8 }) as Stats
        )
      );

      const result = await utils.dirSize('myDir');
      assert.deepStrictEqual(readdirMock.mock.calls[0].arguments, ['myDir', { withFileTypes: true }]);
      assert.deepStrictEqual(readdirMock.mock.calls[1].arguments, [path.join('myDir', 'dir'), { withFileTypes: true }]);
      assert.deepStrictEqual(statMock.mock.calls[0].arguments, [path.join('myDir', 'file1')]);
      assert.deepStrictEqual(statMock.mock.calls[1].arguments, [path.join('myDir', 'file2')]);
      assert.deepStrictEqual(statMock.mock.calls[2].arguments, [path.join('myDir', 'dir', 'file3')]);
      assert.deepStrictEqual(statMock.mock.calls[3].arguments, [path.join('myDir', 'dir', 'file5')]);
      assert.strictEqual(statMock.mock.calls.length, 4);
      assert.deepStrictEqual(result, 11);
    });
  });

  describe('generateReplacementParameters', () => {
    it('should generate replacement parameters', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2021-01-01T00:00:00.000Z';
      const query = 'SELECT * FROM table WHERE timestamp > @StartTime && timestamp < @EndTime && @StartTime > timestamp';

      const expectedResult = [startTime, endTime, startTime];
      const result = utils.generateReplacementParameters(query, startTime, endTime);
      assert.deepStrictEqual(result, expectedResult);
    });
  });

  describe('logQuery', () => {
    const logger = new PinoLogger();

    beforeEach(() => {
      logger.info.mock.resetCalls();
    });

    it('should properly log a query with string variables', () => {
      const query = 'SELECT * FROM logs WHERE timestamp > @StartTime AND timestamp < @EndTime';
      utils.logQuery(
        query,
        '2020-01-01T00:00:00.000Z',
        '2023-01-01T00:00:00.000Z',
        logger as unknown as Parameters<typeof utils.logQuery>[3]
      );

      assert.strictEqual(logger.info.mock.calls.length, 1);
      assert.deepStrictEqual(logger.info.mock.calls[0].arguments, [
        `Sending "${query}" with @StartTime = 2020-01-01T00:00:00.000Z @EndTime = 2023-01-01T00:00:00.000Z`
      ]);
    });

    it('should properly log a query with number variables', () => {
      const query = 'SELECT * FROM logs WHERE timestamp > @StartTime AND timestamp < @EndTime';
      utils.logQuery(
        query,
        DateTime.fromISO('2020-01-01T00:00:00.000Z').toMillis(),
        DateTime.fromISO('2023-01-01T00:00:00.000Z').toMillis(),
        logger as unknown as Parameters<typeof utils.logQuery>[3]
      );

      assert.strictEqual(logger.info.mock.calls.length, 1);
      assert.deepStrictEqual(logger.info.mock.calls[0].arguments, [
        `Sending "${query}" with @StartTime = 1577836800000 @EndTime = 1672531200000`
      ]);
    });

    it('should properly log a query without variable', () => {
      const query = 'SELECT * FROM logs';
      utils.logQuery(
        query,
        '2020-01-01T00:00:00.000Z',
        '2023-01-01T00:00:00.000Z',
        logger as unknown as Parameters<typeof utils.logQuery>[3]
      );

      assert.strictEqual(logger.info.mock.calls.length, 1);
      assert.deepStrictEqual(logger.info.mock.calls[0].arguments, [`Sending "${query}"`]);
    });
  });

  describe('persistResults', () => {
    const logger = new PinoLogger();
    const addContent = mock.fn();
    const dataToWrite = [{ data1: 1 }, { data2: 2 }];

    beforeEach(() => {
      addContent.mock.resetCalls();
      logger.error.mock.resetCalls();
      csvExports.unparse.mock.resetCalls();
      csvExports.unparse.mock.mockImplementation(() => 'csv content');
    });

    describe('without compression', () => {
      it('should properly write results without compression', async () => {
        mock.method(fs, 'writeFile', async () => null);
        mock.method(fs, 'unlink', async () => null);

        await utils.persistResults(
          dataToWrite,
          {
            type: 'file',
            filename: 'myFilename.csv',
            compression: false
          },
          'connectorName',
          testData.south.list[0].items[0] as unknown as Parameters<typeof utils.persistResults>[3],
          testData.constants.dates.FAKE_NOW,
          'myTmpFolder',
          addContent as unknown as Parameters<typeof utils.persistResults>[6],
          logger as unknown as Parameters<typeof utils.persistResults>[7]
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        assert.strictEqual(addContent.mock.calls.length, 1);
        assert.deepStrictEqual(addContent.mock.calls[0].arguments, [
          { type: 'any', filePath },
          testData.constants.dates.FAKE_NOW,
          [testData.south.list[0].items[0]]
        ]);
      });

      it('should properly write results into CSV without compression', async () => {
        mock.method(fs, 'writeFile', async () => null);
        const unlinkMock = mock.method(fs, 'unlink', async () => null);

        await utils.persistResults(
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
          testData.south.list[0].items[0] as unknown as Parameters<typeof utils.persistResults>[3],
          testData.constants.dates.FAKE_NOW,
          'myTmpFolder',
          addContent as unknown as Parameters<typeof utils.persistResults>[6],
          logger as unknown as Parameters<typeof utils.persistResults>[7]
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        assert.strictEqual(addContent.mock.calls.length, 1);
        assert.deepStrictEqual(addContent.mock.calls[0].arguments, [
          { type: 'any', filePath },
          testData.constants.dates.FAKE_NOW,
          [testData.south.list[0].items[0]]
        ]);
        assert.deepStrictEqual(unlinkMock.mock.calls[0].arguments, [filePath]);
        assert.strictEqual(unlinkMock.mock.calls.length, 1);
      });

      it('should properly write results into CSV without compression and log unlink errors', async () => {
        mock.method(fs, 'writeFile', async () => null);
        const unlinkMock = mock.method(fs, 'unlink', () => {
          throw new Error('unlink error');
        });

        await utils.persistResults(
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
          testData.south.list[0].items[0] as unknown as Parameters<typeof utils.persistResults>[3],
          testData.constants.dates.FAKE_NOW,
          'myTmpFolder',
          addContent as unknown as Parameters<typeof utils.persistResults>[6],
          logger as unknown as Parameters<typeof utils.persistResults>[7]
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        assert.strictEqual(addContent.mock.calls.length, 1);
        assert.deepStrictEqual(addContent.mock.calls[0].arguments, [
          { type: 'any', filePath },
          testData.constants.dates.FAKE_NOW,
          [testData.south.list[0].items[0]]
        ]);
        assert.deepStrictEqual(unlinkMock.mock.calls[0].arguments, [filePath]);
        assert.strictEqual(unlinkMock.mock.calls.length, 1);
        assert.strictEqual(logger.error.mock.calls.length, 1);
        assert.deepStrictEqual(logger.error.mock.calls[0].arguments, [
          `Error when deleting CSV file "${filePath}" after caching it. ${new Error('unlink error')}`
        ]);
      });

      it('should properly write results without compression and log unlink errors', async () => {
        mock.method(fs, 'writeFile', async () => null);
        const unlinkMock = mock.method(fs, 'unlink', () => {
          throw new Error('unlink error');
        });

        await utils.persistResults(
          dataToWrite,
          {
            type: 'file',
            filename: 'myFilename.csv',
            compression: false
          },
          'connectorName',
          testData.south.list[0].items[0] as unknown as Parameters<typeof utils.persistResults>[3],
          testData.constants.dates.FAKE_NOW,
          'myTmpFolder',
          addContent as unknown as Parameters<typeof utils.persistResults>[6],
          logger as unknown as Parameters<typeof utils.persistResults>[7]
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        assert.strictEqual(addContent.mock.calls.length, 1);
        assert.deepStrictEqual(addContent.mock.calls[0].arguments, [
          { type: 'any', filePath },
          testData.constants.dates.FAKE_NOW,
          [testData.south.list[0].items[0]]
        ]);
        assert.deepStrictEqual(unlinkMock.mock.calls[0].arguments, [filePath]);
        assert.strictEqual(unlinkMock.mock.calls.length, 1);
        assert.strictEqual(logger.error.mock.calls.length, 1);
        assert.deepStrictEqual(logger.error.mock.calls[0].arguments, [
          `Error when deleting file "${filePath}" after caching it. ${new Error('unlink error')}`
        ]);
      });
    });

    describe('with compression', () => {
      let readStreamMock: {
        pipe: ReturnType<typeof mock.fn>;
        on: ReturnType<typeof mock.fn>;
      };

      beforeEach(() => {
        const onFinish = mock.fn((event: string, handler: () => void) => handler());
        const onError = mock.fn(() => ({ on: onFinish }));

        readStreamMock = {
          pipe: mock.fn(function (this: unknown) {
            return this;
          }),
          on: onError
        };

        mock.method(
          fsSync,
          'createReadStream',
          seq(() => readStreamMock as unknown as fsSync.ReadStream)
        );

        const myWriteStream: { pipe: ReturnType<typeof mock.fn>; on: ReturnType<typeof mock.fn> } = {
          pipe: mock.fn(function (this: unknown) {
            return this;
          }),
          on: mock.fn((event: string, handler: () => void) => {
            handler();
            return myWriteStream;
          })
        };
        mock.method(fsSync, 'createWriteStream', () => myWriteStream as unknown as fsSync.WriteStream);
        mock.method(zlib, 'createGzip', () => ({}) as zlib.Gzip);
        mock.method(fs, 'writeFile', async () => null);
      });

      it('should properly persists results into CSV file', async () => {
        const unlinkMock = mock.method(fs, 'unlink', async () => null);

        await utils.persistResults(
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
          testData.south.list[0].items[0] as unknown as Parameters<typeof utils.persistResults>[3],
          testData.constants.dates.FAKE_NOW,
          'myTmpFolder',
          addContent as unknown as Parameters<typeof utils.persistResults>[6],
          logger as unknown as Parameters<typeof utils.persistResults>[7]
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        assert.strictEqual(addContent.mock.calls.length, 1);
        assert.deepStrictEqual(addContent.mock.calls[0].arguments, [
          { type: 'any', filePath: `${filePath}.gz` },
          testData.constants.dates.FAKE_NOW,
          [testData.south.list[0].items[0]]
        ]);
        const unlinkArgs = unlinkMock.mock.calls.map(c => c.arguments[0]);
        assert.strictEqual(unlinkArgs.includes(filePath), true);
        assert.strictEqual(unlinkArgs.includes(`${filePath}.gz`), true);
        assert.strictEqual(unlinkMock.mock.calls.length, 2);
      });

      it('should properly persists results into file', async () => {
        const unlinkMock = mock.method(fs, 'unlink', async () => null);

        await utils.persistResults(
          dataToWrite,
          {
            type: 'file',
            filename: 'myFilename.csv',
            compression: true
          },
          'connectorName',
          testData.south.list[0].items[0] as unknown as Parameters<typeof utils.persistResults>[3],
          testData.constants.dates.FAKE_NOW,
          'myTmpFolder',
          addContent as unknown as Parameters<typeof utils.persistResults>[6],
          logger as unknown as Parameters<typeof utils.persistResults>[7]
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        assert.strictEqual(addContent.mock.calls.length, 1);
        assert.deepStrictEqual(addContent.mock.calls[0].arguments, [
          { type: 'any', filePath: `${filePath}.gz` },
          testData.constants.dates.FAKE_NOW,
          [testData.south.list[0].items[0]]
        ]);
        const unlinkArgs = unlinkMock.mock.calls.map(c => c.arguments[0]);
        assert.strictEqual(unlinkArgs.includes(filePath), true);
        assert.strictEqual(unlinkArgs.includes(`${filePath}.gz`), true);
        assert.strictEqual(unlinkMock.mock.calls.length, 2);
      });

      it('should properly persists results into CSV file and log unlink errors', async () => {
        mock.method(fs, 'unlink', () => {
          throw new Error('unlink error');
        });

        await utils.persistResults(
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
          testData.south.list[0].items[0] as unknown as Parameters<typeof utils.persistResults>[3],
          testData.constants.dates.FAKE_NOW,
          'myTmpFolder',
          addContent as unknown as Parameters<typeof utils.persistResults>[6],
          logger as unknown as Parameters<typeof utils.persistResults>[7]
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        assert.strictEqual(logger.error.mock.calls.length, 2);
        const errorMessages = logger.error.mock.calls.map(c => c.arguments[0]);
        assert.strictEqual(
          errorMessages.includes(`Error when deleting CSV file "${filePath}" after compression. Error: unlink error`),
          true
        );
        assert.strictEqual(
          errorMessages.includes(`Error when deleting compressed CSV file "${filePath}.gz" after caching it. Error: unlink error`),
          true
        );
        assert.strictEqual(addContent.mock.calls.length, 1);
        assert.deepStrictEqual(addContent.mock.calls[0].arguments, [
          { type: 'any', filePath: `${filePath}.gz` },
          testData.constants.dates.FAKE_NOW,
          [testData.south.list[0].items[0]]
        ]);
      });

      it('should properly persists results into file and log unlink errors', async () => {
        mock.method(fs, 'unlink', () => {
          throw new Error('unlink error');
        });

        await utils.persistResults(
          dataToWrite,
          {
            type: 'file',
            filename: 'myFilename.csv',
            compression: true
          },
          'connectorName',
          testData.south.list[0].items[0] as unknown as Parameters<typeof utils.persistResults>[3],
          testData.constants.dates.FAKE_NOW,
          'myTmpFolder',
          addContent as unknown as Parameters<typeof utils.persistResults>[6],
          logger as unknown as Parameters<typeof utils.persistResults>[7]
        );
        const filePath = path.join('myTmpFolder', 'myFilename.csv');
        assert.strictEqual(logger.error.mock.calls.length, 2);
        const errorMessages = logger.error.mock.calls.map(c => c.arguments[0]);
        assert.strictEqual(errorMessages.includes(`Error when deleting file "${filePath}" after compression. Error: unlink error`), true);
        assert.strictEqual(
          errorMessages.includes(`Error when deleting compressed file "${filePath}.gz" after caching it. Error: unlink error`),
          true
        );
        assert.strictEqual(addContent.mock.calls.length, 1);
        assert.deepStrictEqual(addContent.mock.calls[0].arguments, [
          { type: 'any', filePath: `${filePath}.gz` },
          testData.constants.dates.FAKE_NOW,
          [testData.south.list[0].items[0]]
        ]);
      });
    });
  });

  describe('convertDateTimeFromInstant', () => {
    const testInstant = '2020-02-02T02:02:02.222Z';

    it('should return empty string', () => {
      const dateTimeFormat = {
        type: 'unix-epoch-ms' as DateTimeType
      };
      const result = utils.formatInstant(undefined, dateTimeFormat);
      assert.deepStrictEqual(result, '');
    });

    it('should return Number of ms', () => {
      const dateTimeFormat = {
        type: 'unix-epoch-ms' as DateTimeType
      };
      const expectedResult = DateTime.fromISO(testInstant).toMillis();
      const result = utils.formatInstant(testInstant, dateTimeFormat);
      assert.deepStrictEqual(result, expectedResult);
      assert.deepStrictEqual(
        DateTime.fromMillis(result as number)
          .toUTC()
          .toISO(),
        '2020-02-02T02:02:02.222Z'
      );
    });

    it('should return Number of seconds', () => {
      const dateTimeFormat = {
        type: 'unix-epoch' as DateTimeType
      };
      const expectedResult = Math.floor(DateTime.fromISO(testInstant).toMillis() / 1000);
      const result = utils.formatInstant(testInstant, dateTimeFormat);
      assert.deepStrictEqual(result, expectedResult);
      assert.deepStrictEqual(
        DateTime.fromMillis((result as number) * 1000)
          .toUTC()
          .toISO(),
        '2020-02-02T02:02:02.000Z'
      );
    });

    it('should return a formatted String with correct timezone', () => {
      const dateTimeFormat = {
        type: 'string' as DateTimeType,
        timezone: 'Asia/Tokyo',
        format: 'yyyy-MM-dd HH:mm:ss.SSS',
        locale: 'en-US'
      };
      const expectedResult = DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toFormat(dateTimeFormat.format);
      const result = utils.formatInstant(testInstant, dateTimeFormat);
      assert.deepStrictEqual(result, expectedResult);
      assert.deepStrictEqual(result, '2020-02-02 11:02:02.222');
    });

    it('should return a formatted ISO String from ISO String', () => {
      const dateTimeFormat = {
        type: 'iso-string' as DateTimeType
      };
      const result = utils.formatInstant(testInstant, dateTimeFormat);
      assert.deepStrictEqual(result, testInstant);
    });

    it('should return a formatted Date', () => {
      const dateTimeFormat = {
        type: 'date' as DateTimeType,
        timezone: 'Asia/Tokyo'
      };
      const result = utils.formatInstant(testInstant, dateTimeFormat);
      assert.deepStrictEqual(result, '2020-02-02');
    });

    it('should return a formatted small-date-time', () => {
      const dateTimeFormat = {
        type: 'small-date-time' as DateTimeType,
        timezone: 'Asia/Tokyo'
      };
      const result = utils.formatInstant(testInstant, dateTimeFormat);
      assert.deepStrictEqual(result, '2020-02-02 11:02:02');
    });

    it('should return a formatted DateTime', () => {
      const dateTimeFormat = {
        type: 'date-time' as DateTimeType,
        timezone: 'Asia/Tokyo'
      };
      const result = utils.formatInstant(testInstant, dateTimeFormat);
      assert.deepStrictEqual(result, '2020-02-02 11:02:02.222');
    });

    it('should return a formatted String with correct timezone for locale en-US', () => {
      const dateTimeFormat = {
        type: 'string' as DateTimeType,
        timezone: 'Asia/Tokyo',
        format: 'dd-MMM-yy HH:mm:ss',
        locale: 'en-US'
      };
      const expectedResult = DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toFormat(dateTimeFormat.format);
      const result = utils.formatInstant(testInstant, dateTimeFormat);
      assert.deepStrictEqual(result, expectedResult);
      assert.deepStrictEqual(result, '02-Feb-20 11:02:02');
    });

    it('should return a formatted String with correct timezone for locale fr-FR', () => {
      const dateTimeFormat = {
        type: 'string' as DateTimeType,
        timezone: 'Asia/Tokyo',
        format: 'dd-MMM-yy HH:mm:ss',
        locale: 'fr-FR'
      };
      const expectedResult = DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toFormat(dateTimeFormat.format, {
        locale: dateTimeFormat.locale
      });
      const result = utils.formatInstant(testInstant, dateTimeFormat);
      assert.deepStrictEqual(result, expectedResult);
      assert.deepStrictEqual(result, '02-févr.-20 11:02:02');
    });

    it('should return an ISO String from Date with correct timezone', () => {
      const dateTimeFormat = {
        type: 'date-time-offset' as DateTimeType,
        timezone: 'Asia/Tokyo'
      };
      const expectedResult = DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toUTC().toISO()!;
      const result = utils.formatInstant(testInstant, dateTimeFormat);
      assert.deepStrictEqual(result, expectedResult);
    });
  });

  describe('convertDelimiter', () => {
    it('should convert to csv delimiter', () => {
      assert.deepStrictEqual(utils.convertDelimiter('NON_BREAKING_SPACE'), ' ');
      assert.deepStrictEqual(utils.convertDelimiter('COLON'), ':');
      assert.deepStrictEqual(utils.convertDelimiter('COMMA'), ',');
      assert.deepStrictEqual(utils.convertDelimiter('DOT'), '.');
      assert.deepStrictEqual(utils.convertDelimiter('SLASH'), '/');
      assert.deepStrictEqual(utils.convertDelimiter('PIPE'), '|');
      assert.deepStrictEqual(utils.convertDelimiter('SEMI_COLON'), ';');
      assert.deepStrictEqual(utils.convertDelimiter('TAB'), ' ');
    });
  });

  describe('convertDateTimeToInstant', () => {
    beforeEach(() => {
      mock.method(DateTime, 'fromJSDate', (date: Date) => {
        if (date instanceof Date && !isNaN(date.getTime())) {
          return DateTime.fromISO(testData.constants.dates.FAKE_NOW);
        }
        throw new Error('Invalid date');
      });
    });

    describe('when no type is provided', () => {
      it('should return empty string if value is null', () => {
        const result = utils.convertDateTimeToInstant(null, {});
        assert.deepStrictEqual(result, '');
      });

      it('should return the input if it is a valid ISO string', () => {
        const result = utils.convertDateTimeToInstant('2023-01-01T00:00:00Z', {});
        assert.strictEqual(result, '2023-01-01T00:00:00Z');
      });

      it('should throw an error if input is not a valid ISO string', () => {
        assert.throws(
          () => utils.convertDateTimeToInstant('not-an-iso-string', {}),
          /The value must be a valid ISO string if no type is provided: "not-an-iso-string"/
        );
        assert.throws(() => utils.convertDateTimeToInstant(123, {}), /The value must be a valid ISO string if no type is provided: "123"/);
        assert.throws(
          () => utils.convertDateTimeToInstant(new Date(), {}),
          /The value must be a valid ISO string if no type is provided: "/
        );
      });
    });

    describe('unix-epoch', () => {
      it('should convert a number (seconds since epoch) to ISO string', () => {
        const result = utils.convertDateTimeToInstant(1672531200, { type: 'unix-epoch' });
        assert.strictEqual(result, '2023-01-01T00:00:00.000Z');
      });

      it('should convert a numeric string (seconds since epoch) to ISO string', () => {
        const result = utils.convertDateTimeToInstant('1672531200', { type: 'unix-epoch' });
        assert.strictEqual(result, '2023-01-01T00:00:00.000Z');
      });

      it('should throw an error if input is not a number or numeric string', () => {
        assert.throws(
          () => utils.convertDateTimeToInstant(new Date(), { type: 'unix-epoch' }),
          /The value must be a number or numeric string for type "unix-epoch": "/
        );
        assert.throws(
          () => utils.convertDateTimeToInstant('not-a-number', { type: 'unix-epoch' }),
          /Failed to convert "not-a-number" to Instant for type "unix-epoch"/
        );
      });
    });

    describe('unix-epoch-ms', () => {
      it('should convert a number (milliseconds since epoch) to ISO string', () => {
        const result = utils.convertDateTimeToInstant(1672531200000, { type: 'unix-epoch-ms' });
        assert.strictEqual(result, '2023-01-01T00:00:00.000Z');
      });

      it('should convert a numeric string (milliseconds since epoch) to ISO string', () => {
        const result = utils.convertDateTimeToInstant('1672531200000', { type: 'unix-epoch-ms' });
        assert.strictEqual(result, '2023-01-01T00:00:00.000Z');
      });

      it('should throw an error if input is not a number or numeric string', () => {
        assert.throws(
          () => utils.convertDateTimeToInstant(new Date(), { type: 'unix-epoch-ms' }),
          /The value must be a number or numeric string for type "unix-epoch-ms": "/
        );
        assert.throws(
          () => utils.convertDateTimeToInstant('not-a-number', { type: 'unix-epoch-ms' }),
          /Failed to convert "not-a-number" to Instant for type "unix-epoch-ms"/
        );
      });
    });

    describe('iso-string', () => {
      it('should convert a valid ISO string to ISO string', () => {
        const result = utils.convertDateTimeToInstant('2023-01-01T12:00:00+02:00', { type: 'iso-string' });
        assert.strictEqual(result, '2023-01-01T10:00:00.000Z');
      });

      it('should throw an error if input is not a string', () => {
        assert.throws(
          () => utils.convertDateTimeToInstant(123, { type: 'iso-string' }),
          /The value must be a string for type "iso-string": "123"/
        );
        assert.throws(
          () => utils.convertDateTimeToInstant(new Date(), { type: 'iso-string' }),
          /The value must be a string for type "iso-string": "/
        );
      });
    });

    describe('string', () => {
      it('should convert a string with format to ISO string', () => {
        const result = utils.convertDateTimeToInstant('01/01/2023', {
          type: 'string',
          format: 'MM/dd/yyyy',
          timezone: 'Europe/Paris'
        });
        assert.match(result, /2022-12-31T.*Z/);
      });

      it('should throw an error if input is not a string', () => {
        assert.throws(
          () => utils.convertDateTimeToInstant(123, { type: 'string', format: 'MM/dd/yyyy' }),
          /The value must be a string and format must be provided for type "string": "123"/
        );
      });

      it('should throw an error if format is not provided', () => {
        assert.throws(
          () => utils.convertDateTimeToInstant('01/01/2023', { type: 'string' }),
          /The value must be a string and format must be provided for type "string": "01\/01\/2023"/
        );
      });

      it('should throw an error if string cannot be parsed with the given format', () => {
        assert.throws(
          () =>
            utils.convertDateTimeToInstant('not-a-date', {
              type: 'string',
              format: 'MM/dd/yyyy'
            }),
          /Failed to convert "not-a-date" to Instant for type "string"/
        );
      });
    });

    describe('Date types (date, small-date-time, date-time, date-time-2)', () => {
      const dateTypes: Array<'date' | 'small-date-time' | 'date-time' | 'date-time-2'> = [
        'date',
        'small-date-time',
        'date-time',
        'date-time-2'
      ];

      for (const type of dateTypes) {
        describe(type, () => {
          it('should convert a Date object to ISO string', () => {
            const result = utils.convertDateTimeToInstant(new Date(testData.constants.dates.FAKE_NOW), { type, timezone: 'UTC' });
            assert.strictEqual(result, testData.constants.dates.FAKE_NOW);
          });

          it('should convert a Date object to ISO string with timezone', () => {
            const result = utils.convertDateTimeToInstant(new Date(testData.constants.dates.FAKE_NOW), {
              type,
              timezone: 'America/New_York'
            });
            assert.strictEqual(result, '2021-01-02T05:00:00.000Z');
          });

          it('should throw an error if input is not a Date object', () => {
            assert.throws(
              () => utils.convertDateTimeToInstant('not-a-date', { type }),
              new RegExp(`The value must be a Date object for type "${type}": "not-a-date"`)
            );
            assert.throws(
              () => utils.convertDateTimeToInstant(123, { type }),
              new RegExp(`The value must be a Date object for type "${type}": "123"`)
            );
          });
        });
      }
    });

    describe('date-time-offset, timestamp, timestamptz', () => {
      const dateTypes: Array<'date-time-offset' | 'timestamp' | 'timestamptz'> = ['date-time-offset', 'timestamp', 'timestamptz'];

      for (const type of dateTypes) {
        describe(type, () => {
          it('should convert a Date object to ISO string', () => {
            const result = utils.convertDateTimeToInstant(new Date(testData.constants.dates.FAKE_NOW), { type, timezone: 'UTC' });
            assert.strictEqual(result, testData.constants.dates.FAKE_NOW);
          });

          it('should throw an error if input is not a Date object', () => {
            assert.throws(
              () => utils.convertDateTimeToInstant('not-a-date', { type }),
              new RegExp(`The value must be a Date object for type "${type}": "not-a-date"`)
            );
            assert.throws(
              () => utils.convertDateTimeToInstant(123, { type }),
              new RegExp(`The value must be a Date object for type "${type}": "123"`)
            );
          });
        });
      }

      describe('unsupported type', () => {
        it('should throw an error for unsupported types', () => {
          assert.throws(
            () =>
              utils.convertDateTimeToInstant(new Date(), {
                type: 'unsupported-type' as unknown as DateTimeType
              }),
            /Unsupported DateTimeType: "unsupported-type"/
          );
        });
      });
    });
  });

  describe('convertDateTime', () => {
    it('should convert a valid ISO string to ISO string', () => {
      const result = utils.convertDateTime('2023-01-01T12:00:00+02:00', { type: 'iso-string' }, { type: 'iso-string' });
      assert.strictEqual(result, '2023-01-01T10:00:00.000Z');
    });
  });

  describe('formatQueryParams', () => {
    it('should correctly return void string when there is no query params', () => {
      const result = utils.formatQueryParams('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z', []);
      assert.deepStrictEqual(result, {});
    });

    it('should correctly format query params with ISO date string', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2021-01-01T00:00:00.000Z';
      const queryParams = [
        { key: 'start', value: '@StartTime' },
        { key: 'end', value: '@EndTime' },
        { key: 'anotherParam', value: 'anotherQueryParam' }
      ];

      const result = utils.formatQueryParams(startTime, endTime, queryParams);
      assert.deepStrictEqual(result, {
        anotherParam: 'anotherQueryParam',
        end: '2021-01-01T00:00:00.000Z',
        start: '2020-01-01T00:00:00.000Z'
      });
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
      platform: utils.getPlatformFromOsType(os.type())
    };
    const result = utils.getOIBusInfo({ id: 'id', name: 'name', version: '3.3.3', launcherVersion: '3.5.0' } as EngineSettingsDTO);
    assert.deepStrictEqual(result, expectedResult);
  });

  it('should return proper platform from OS type', () => {
    assert.deepStrictEqual(utils.getPlatformFromOsType('Linux'), 'linux');
    assert.deepStrictEqual(utils.getPlatformFromOsType('Darwin'), 'macos');
    assert.deepStrictEqual(utils.getPlatformFromOsType('Windows_NT'), 'windows');
    assert.deepStrictEqual(utils.getPlatformFromOsType('unknown'), 'unknown');
  });

  describe('validateCronExpression', () => {
    it('should properly validate a cron expression (every second)', () => {
      mock.method(Date, 'now', () => new Date(testData.constants.dates.FAKE_NOW).getTime());
      const result = utils.validateCronExpression('* * * * * *');
      const expectedResult = {
        isValid: true,
        errorMessage: '',
        humanReadableForm: 'Every second, every minute, every hour, every day',
        nextExecutions: ['2021-01-02T00:00:01.000Z', '2021-01-02T00:00:02.000Z', '2021-01-02T00:00:03.000Z']
      };
      assert.deepStrictEqual(result, expectedResult);
    });

    it('should properly validate a cron expression', () => {
      mock.method(Date, 'now', () => new Date(testData.constants.dates.FAKE_NOW).getTime());
      const result = utils.validateCronExpression('0 */10 * * * *');
      const expectedResult = {
        isValid: true,
        errorMessage: '',
        humanReadableForm: 'Every 10 minutes, every hour, every day',
        nextExecutions: ['2021-01-02T00:10:00.000Z', '2021-01-02T00:20:00.000Z', '2021-01-02T00:30:00.000Z']
      };
      assert.deepStrictEqual(result, expectedResult);
    });

    it('should throw an error for too many fields', () => {
      assert.deepStrictEqual(utils.validateCronExpression('* * * * * * 2024'), {
        isValid: false,
        errorMessage: 'Cron Expression: Too many fields. Only seconds, minutes, hours, day of month, month and day of week are supported.',
        humanReadableForm: '',
        nextExecutions: []
      });
    });

    it('should throw an error for non standard characters', () => {
      assert.deepStrictEqual(utils.validateCronExpression('* * * * 5L'), {
        isValid: false,
        errorMessage: 'Cron Expression: Non-standard characters: L',
        humanReadableForm: '',
        nextExecutions: []
      });

      assert.deepStrictEqual(utils.validateCronExpression('* * * W * *'), {
        isValid: false,
        errorMessage: 'Cron Expression: Non-standard characters: W',
        humanReadableForm: '',
        nextExecutions: []
      });

      assert.deepStrictEqual(utils.validateCronExpression('* * * * * 5#3'), {
        isValid: false,
        errorMessage: 'Cron Expression: Non-standard characters: #',
        humanReadableForm: '',
        nextExecutions: []
      });

      assert.deepStrictEqual(utils.validateCronExpression('? ? * * * *'), {
        isValid: false,
        errorMessage: 'Cron Expression: Non-standard characters: ?',
        humanReadableForm: '',
        nextExecutions: []
      });

      assert.deepStrictEqual(utils.validateCronExpression('H * * * *'), {
        isValid: false,
        errorMessage: 'Cron Expression: Non-standard characters: H',
        humanReadableForm: '',
        nextExecutions: []
      });
    });

    it('should throw an error for invalid cron expression caught by cronstrue', () => {
      assert.deepStrictEqual(utils.validateCronExpression('0 35 10 19 01'), {
        isValid: false,
        errorMessage: 'Cron Expression: Hours part must be >= 0 and <= 23',
        humanReadableForm: '',
        nextExecutions: []
      });
      assert.deepStrictEqual(utils.validateCronExpression('0 23 10 19 01'), {
        isValid: false,
        errorMessage: 'Cron Expression: Month part must be >= 1 and <= 12',
        humanReadableForm: '',
        nextExecutions: []
      });
      assert.deepStrictEqual(utils.validateCronExpression('0 23 10 12 8'), {
        isValid: false,
        errorMessage: 'Cron Expression: DOW part must be >= 0 and <= 6',
        humanReadableForm: '',
        nextExecutions: []
      });
    });

    it('should throw an error for invalid cron expression caught by cron-parser', () => {
      assert.deepStrictEqual(utils.validateCronExpression('0 23 10 12 6/-'), {
        isValid: false,
        errorMessage: 'Cron Expression: Constraint error, cannot repeat at every NaN time.',
        humanReadableForm: '',
        nextExecutions: []
      });
      assert.deepStrictEqual(utils.validateCronExpression('0 23 10-1 12 6/1'), {
        isValid: false,
        errorMessage: 'Cron Expression: Invalid range: 10-1, min(10) > max(1)',
        humanReadableForm: '',
        nextExecutions: []
      });
    });

    it('should catch unexpected errors', () => {
      mock.method(cronstrue, 'toString', () => {
        throw null;
      });
      assert.deepStrictEqual(utils.validateCronExpression('* * * * * *'), {
        isValid: false,
        errorMessage: 'Cron Expression: Invalid',
        humanReadableForm: '',
        nextExecutions: []
      });
    });
  });

  describe('checkScanMode', () => {
    it('should properly check scan mode', () => {
      assert.deepStrictEqual(utils.checkScanMode(testData.scanMode.list, 'scanModeId1', null), testData.scanMode.list[0]);
      assert.throws(() => utils.checkScanMode(testData.scanMode.list, null, null), /Scan mode not specified/);
      assert.throws(
        () => utils.checkScanMode(testData.scanMode.list, null, 'bad scan mode name'),
        /Scan mode "bad scan mode name" not found/
      );
      assert.deepStrictEqual(utils.checkScanMode(testData.scanMode.list, null, testData.scanMode.list[0].name), testData.scanMode.list[0]);
    });
  });

  describe('itemToFlattenedCSV', () => {
    beforeEach(() => {
      csvExports.unparse.mock.resetCalls();
      csvExports.unparse.mock.mockImplementation(() => 'csv content');
    });

    it('should properly convert items into csv', () => {
      assert.deepStrictEqual(
        utils.itemToFlattenedCSV(
          [
            ...testData.south.list[2].items.map(item => ({ ...item, settings: { ...item.settings, objectSettings: {} } })),
            {
              ...testData.south.list[2].items[0]
            }
          ] as unknown as Array<SouthConnectorItemDTO | HistoryQueryItemDTO>,
          ',',
          testData.scanMode.list
        ),
        'csv content'
      );
    });

    it('should properly convert without scan modes', () => {
      assert.deepStrictEqual(
        utils.itemToFlattenedCSV(
          [
            ...testData.south.list[2].items.map(item => ({ ...item, settings: { ...item.settings, objectSettings: {} } })),
            {
              ...testData.south.list[2].items[0]
            }
          ] as unknown as Array<SouthConnectorItemDTO | HistoryQueryItemDTO>,
          ','
        ),
        'csv content'
      );
    });

    it('should fall back to group historian values when item values are null', () => {
      const scanModeEntry = testData.scanMode.list[0];
      const mockScanModeDTO = {
        ...scanModeEntry,
        createdBy: { id: scanModeEntry.createdBy, friendlyName: scanModeEntry.createdBy },
        updatedBy: { id: scanModeEntry.updatedBy, friendlyName: scanModeEntry.updatedBy }
      };
      const mockGroup = {
        id: 'group1',
        standardSettings: {
          name: 'My Group',
          scanMode: mockScanModeDTO
        },
        historySettings: {
          maxReadInterval: 3600,
          readDelay: 200,
          overlap: 5
        },
        createdBy: { id: '', friendlyName: '' },
        updatedBy: { id: '', friendlyName: '' },
        createdAt: '',
        updatedAt: ''
      };
      const item = {
        ...testData.south.list[2].items[0],
        group: mockGroup,
        syncWithGroup: true,
        maxReadInterval: null,
        readDelay: null,
        overlap: null
      } as unknown as SouthConnectorItemDTO;

      utils.itemToFlattenedCSV([item] as unknown as Array<SouthConnectorItemDTO | HistoryQueryItemDTO>, ',', testData.scanMode.list);

      assert.strictEqual(csvExports.unparse.mock.calls.length, 1);
      const capturedData = csvExports.unparse.mock.calls[0].arguments[0] as Array<Record<string, unknown>>;
      assert.notStrictEqual(capturedData, null);
      assert.deepStrictEqual(capturedData[0].maxReadInterval, 3600);
      assert.deepStrictEqual(capturedData[0].readDelay, 200);
      assert.deepStrictEqual(capturedData[0].overlap, 5);
    });
  });

  describe('stringToBoolean', () => {
    it('should properly convert string to boolean', () => {
      assert.deepStrictEqual(utils.stringToBoolean('true'), true);
      assert.deepStrictEqual(utils.stringToBoolean('True'), true);
      assert.deepStrictEqual(utils.stringToBoolean('TRUE'), true);
      assert.deepStrictEqual(utils.stringToBoolean('1'), true);
      assert.deepStrictEqual(utils.stringToBoolean('false'), false);
      assert.deepStrictEqual(utils.stringToBoolean('False'), false);
      assert.deepStrictEqual(utils.stringToBoolean('FALSE'), false);
      assert.deepStrictEqual(utils.stringToBoolean('0'), false);
      assert.deepStrictEqual(utils.stringToBoolean('99'), false);
    });
  });

  describe('testIPOnFilter', () => {
    it('should return false for an empty filter list', () => {
      assert.deepStrictEqual(utils.testIPOnFilter([], '192.168.1.1'), false);
    });

    it('should return true for a matching IPv4 address', () => {
      assert.deepStrictEqual(utils.testIPOnFilter(['192.168.1.*'], '192.168.1.1'), true);
      assert.deepStrictEqual(utils.testIPOnFilter(['192.168.*.*'], '192.168.1.1'), true);
    });

    it('should return true for a matching IPv6-mapped IPv4 address', () => {
      const ipFilters = ['192.168.1.*'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '::ffff:192.168.1.1'), true);
    });

    it('should return false for a non-matching IPv4 address', () => {
      const ipFilters = ['192.168.2.*'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '192.168.1.1'), false);
    });

    it('should return false for a non-matching IPv6-mapped IPv4 address', () => {
      const ipFilters = ['192.168.2.*'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '::ffff:192.168.1.1'), false);
    });

    it('should return true for a direct matching IPv4 address', () => {
      const ipFilters = ['192.168.1.1'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '192.168.1.1'), true);
    });

    it('should return true for a direct matching IPv6-mapped IPv4 address', () => {
      const ipFilters = ['192.168.1.1'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '::ffff:192.168.1.1'), true);
    });

    it('should return true for a matching IPv6 address', () => {
      const ipFilters = ['2001:0db8:85a3:0000:0000:8a2e:0370:*'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '2001:0db8:85a3:0000:0000:8a2e:0370:7334'), true);
    });

    it('should return false for a non-matching IPv6 address', () => {
      const ipFilters = ['2001:0db8:85a3:0000:0000:8a2e:0370:*'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '2001:0db8:85a3:0000:0000:8a2e:0371:7334'), false);
    });

    it('should return true for localhost IPv4', () => {
      const ipFilters = ['127.0.0.1'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '127.0.0.1'), true);
    });

    it('should return true for localhost IPv6', () => {
      const ipFilters = ['::1'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '::1'), true);
    });

    it('should return true for any IP with wildcard *', () => {
      const ipFilters = ['*'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '192.168.1.1'), true);
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '::ffff:192.168.1.1'), true);
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '2001:0db8:85a3:0000:0000:8a2e:0370:7334'), true);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove surrounding quotes', () => {
      assert.deepStrictEqual(utils.sanitizeFilename('"file.csv"'), 'file.csv');
      assert.deepStrictEqual(utils.sanitizeFilename("'file.csv'"), 'file.csv');
      assert.deepStrictEqual(utils.sanitizeFilename('"file.name.csv"'), 'file.name.csv');
    });

    it('should replace special characters and spaces with hyphens in the name', () => {
      assert.deepStrictEqual(utils.sanitizeFilename('my file.csv'), 'my-file.csv');
      assert.deepStrictEqual(utils.sanitizeFilename('file@name#1.json'), 'file-name-1.json');
      assert.deepStrictEqual(utils.sanitizeFilename('my/bad/path.txt'), 'my-bad-path.txt');
    });

    it('should allow valid characters (alphanumeric, -, _) to remain', () => {
      assert.deepStrictEqual(utils.sanitizeFilename('valid-file_name123.csv'), 'valid-file_name123.csv');
      assert.deepStrictEqual(utils.sanitizeFilename('UPPER_case.TXT'), 'UPPER_case.TXT');
    });

    it('should handle files without extensions', () => {
      assert.deepStrictEqual(utils.sanitizeFilename('makefile'), 'makefile');
      assert.deepStrictEqual(utils.sanitizeFilename('read me'), 'read-me');
      assert.deepStrictEqual(utils.sanitizeFilename('weird@file'), 'weird-file');
    });

    it('should handle complex extensions correctly', () => {
      assert.deepStrictEqual(utils.sanitizeFilename('archive.tar.gz'), 'archive.tar.gz');
      assert.deepStrictEqual(utils.sanitizeFilename('complex.name.structure.json'), 'complex.name.structure.json');
    });

    it('should handle edge cases', () => {
      assert.deepStrictEqual(utils.sanitizeFilename('.env'), '.env');
      assert.deepStrictEqual(utils.sanitizeFilename('folder.'), 'folder.');
      assert.deepStrictEqual(utils.sanitizeFilename(''), '');
    });
  });

  describe('injectIndices', () => {
    it('should replace single wildcard with corresponding index', () => {
      assert.strictEqual(utils.injectIndices('$.users[*].name', [0]), '$.users[0].name');
      assert.strictEqual(utils.injectIndices('$[*]', [99]), '$[99]');
    });

    it('should replace multiple wildcards sequentially', () => {
      assert.strictEqual(utils.injectIndices('$.users[*].items[*].id', [0, 5]), '$.users[0].items[5].id');
      assert.strictEqual(utils.injectIndices('$[*].nested[*].deep[*]', [1, 2, 3]), '$[1].nested[2].deep[3]');
    });

    it('should keep the wildcard if there are not enough indices provided', () => {
      assert.strictEqual(utils.injectIndices('$.users[*].items[*].id', [0]), '$.users[0].items[*].id');
      assert.strictEqual(utils.injectIndices('$.users[*].items[*]', []), '$.users[*].items[*]');
    });

    it('should ignore extra indices if there are fewer wildcards', () => {
      assert.strictEqual(utils.injectIndices('$.users[*].name', [0, 5]), '$.users[0].name');
    });

    it('should return the path unchanged if there are no wildcards', () => {
      assert.strictEqual(utils.injectIndices('$.users.fixed.path', [0, 1]), '$.users.fixed.path');
    });

    it('should correctly handle other bracket notation that is not [*]', () => {
      assert.strictEqual(utils.injectIndices('$.users[0].items[*]', [2]), '$.users[0].items[2]');
      assert.strictEqual(utils.injectIndices('$.users["key"].items[*]', [3]), '$.users["key"].items[3]');
    });
  });

  describe('processCacheFileContent', () => {
    it('should read full content if smaller than limit', async () => {
      const content = 'Hello World';
      const stream = Readable.from(Buffer.from(content));

      const result = await utils.processCacheFileContent(stream);

      assert.deepStrictEqual(result.content, content);
      assert.strictEqual(result.truncated, false);
    });

    it('should truncate content if larger than limit', async () => {
      const content = 'Hello World';
      const limit = 5;

      function* charGenerator() {
        for (const char of content) {
          yield Buffer.from(char);
        }
      }
      const stream = Readable.from(charGenerator());

      const result = await utils.processCacheFileContent(stream, limit);

      assert.deepStrictEqual(result.content, 'Hello');
      assert.strictEqual(result.truncated, true);
    });

    it('should handle multi-chunk streams correctly', async () => {
      function* generateChunks() {
        yield Buffer.from('Chunk1');
        yield Buffer.from('Chunk2');
        yield Buffer.from('Chunk3');
      }
      const stream = Readable.from(generateChunks());

      const result = await utils.processCacheFileContent(stream, 9);

      assert.deepStrictEqual(result.content, 'Chunk1Chu');
      assert.strictEqual(result.truncated, true);
    });
  });

  describe('determineContentTypeFromFilename', () => {
    it('should identify json', () => {
      assert.strictEqual(utils.determineContentTypeFromFilename('data.json'), 'json');
      assert.strictEqual(utils.determineContentTypeFromFilename('/path/to/file.json'), 'json');
    });

    it('should identify csv', () => {
      assert.strictEqual(utils.determineContentTypeFromFilename('data.csv'), 'csv');
    });

    it('should identify xml', () => {
      assert.strictEqual(utils.determineContentTypeFromFilename('data.xml'), 'xml');
    });

    it('should default to raw for others', () => {
      assert.strictEqual(utils.determineContentTypeFromFilename('data.txt'), 'raw');
      assert.strictEqual(utils.determineContentTypeFromFilename('data'), 'raw');
      assert.strictEqual(utils.determineContentTypeFromFilename('data.bin'), 'raw');
    });
  });

  describe('streamToString', () => {
    it('should convert stream to string', async () => {
      const expected = 'stream content';
      const stream = Readable.from(Buffer.from(expected));

      const result = await utils.streamToString(stream);
      assert.deepStrictEqual(result, expected);
    });

    it('should reject on stream error', async () => {
      const stream = new Readable({
        read() {
          this.emit('error', new Error('Stream Error'));
        }
      });

      await assert.rejects(async () => utils.streamToString(stream), /Stream Error/);
    });
  });

  describe('createOIBusError', () => {
    it('should return OIBusError as is', () => {
      const originalError = new OIBusError('test', true);
      const result = utils.createOIBusError(originalError);
      assert.strictEqual(result, originalError);
      assert.strictEqual(result.forceRetry, true);
    });

    it('should wrap Error object', () => {
      const error = new Error('Standard error');
      const result = utils.createOIBusError(error);
      assert.strictEqual(result instanceof OIBusError, true);
      assert.strictEqual(result.message, 'Standard error');
      assert.strictEqual(result.forceRetry, false);
    });

    it('should wrap string error', () => {
      const result = utils.createOIBusError('String error');
      assert.strictEqual(result instanceof OIBusError, true);
      assert.strictEqual(result.message, 'String error');
    });

    it('should stringify unknown object', () => {
      const obj = { custom: 'value' };
      const result = utils.createOIBusError(obj);
      assert.strictEqual(result instanceof OIBusError, true);
      assert.strictEqual(result.message, '{"custom":"value"}');
    });
  });

  describe('generateFilenameForSerialization', () => {
    it('should replace placeholders correctly', () => {
      mock.method(Date, 'now', () => new Date(testData.constants.dates.FAKE_NOW).getTime());
      const base = '/base/folder';
      const filenameTemplate = 'export_@ConnectorName_@ItemName_@CurrentDate.csv';
      const connectorName = 'MyConnector';
      const itemName = 'MyItem';

      const result = utils.generateFilenameForSerialization(base, filenameTemplate, connectorName, itemName);

      const expectedDate = '2021_01_02_00_00_00_000';
      const expectedFilename = `export_${connectorName}_${itemName}_${expectedDate}.csv`;

      assert.deepStrictEqual(result, path.join(base, expectedFilename));
    });
  });

  describe('generateCsvContent', () => {
    beforeEach(() => {
      csvExports.unparse.mock.resetCalls();
      csvExports.unparse.mock.mockImplementation(() => 'mocked,csv,output');
    });

    it('should generate CSV string with correct delimiter', () => {
      const data = [
        { col1: 'val1', col2: 123 },
        { col1: 'val2', col2: 456 }
      ];

      const result = utils.generateCsvContent(data, 'COMMA');

      assert.strictEqual(csvExports.unparse.mock.calls.length, 1);
      assert.deepStrictEqual(csvExports.unparse.mock.calls[0].arguments, [
        data,
        {
          header: true,
          delimiter: ','
        }
      ]);
      assert.strictEqual(result, 'mocked,csv,output');
    });

    it('should handle different delimiters', () => {
      const data = [{ a: 1 }];
      utils.generateCsvContent(data, 'SEMI_COLON');
      assert.strictEqual(csvExports.unparse.mock.calls.length, 1);
      const callArgs = csvExports.unparse.mock.calls[0].arguments[1] as Record<string, unknown>;
      assert.strictEqual(callArgs.delimiter, ';');
    });
  });

  describe('resolveBypassingExports', () => {
    it('should resolve a standard allowed export normally', () => {
      const result = utils.resolveBypassingExports('typescript', 'package.json');
      assert.strictEqual(result.includes(path.normalize('node_modules/typescript/package.json')), true);
    });

    it('should bypass exports restrictions for blocked subpaths (e.g., luxon)', () => {
      const pkgName = 'luxon';
      const subPath = 'build/global/luxon.min.js';

      const result = utils.resolveBypassingExports(pkgName, subPath);

      assert.strictEqual(result.includes(path.normalize(`node_modules/${pkgName}/${subPath}`)), true);
    });

    it('should throw standard MODULE_NOT_FOUND for non-existent packages', () => {
      assert.throws(() => {
        utils.resolveBypassingExports('some-fake-package-that-does-not-exist', 'file.js');
      }, /Cannot find module 'some-fake-package-that-does-not-exist\/file\.js'/);
    });

    it('should re-throw generic errors that are not related to module resolution', () => {
      assert.throws(() => {
        utils.resolveBypassingExports(Symbol('bad-input') as unknown as string, 'file.js');
      }, TypeError);

      assert.throws(() => {
        utils.resolveBypassingExports(Symbol('bad-input') as unknown as string, 'file.js');
      }, /Cannot convert a Symbol value to a string/);
    });

    it('should throw the original error if the package resolves but is not in a node_modules folder (rootIdx === -1)', () => {
      assert.throws(() => {
        utils.resolveBypassingExports('fs', 'fake-subpath.js');
      }, /Cannot find module 'fs\/fake-subpath\.js'/);
    });
  });

  describe('groupItemsByGroup', () => {
    const baseItem = testData.south.list[2].items[0];

    const baseGroup = {
      id: 'g1',
      name: 'Group 1',
      southId: 'south1',
      scanMode: testData.scanMode.list[0],
      overlap: null,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    it('should put each item in its own group when syncWithGroup is false', () => {
      const item1 = { ...baseItem, id: 'item1', group: null, syncWithGroup: false };
      const item2 = { ...baseItem, id: 'item2', group: null, syncWithGroup: false };
      const result = utils.groupItemsByGroup('mssql', [item1, item2]);
      assert.deepStrictEqual(result, [[item1], [item2]]);
    });

    it('should group items by group.id when syncWithGroup is true and southType is in SOUTH_SINGLE_ITEMS', () => {
      const group = { ...baseGroup, id: 'g1' };
      const item1 = { ...baseItem, id: 'item1', group, syncWithGroup: true };
      const item2 = { ...baseItem, id: 'item2', group, syncWithGroup: true };
      const result = utils.groupItemsByGroup('mssql', [item1, item2]);
      assert.deepStrictEqual(result, [[item1, item2]]);
    });

    it('should create separate sub-arrays for items with different group.ids', () => {
      const group1 = { ...baseGroup, id: 'g1' };
      const group2 = { ...baseGroup, id: 'g2' };
      const item1 = { ...baseItem, id: 'item1', group: group1, syncWithGroup: true };
      const item2 = { ...baseItem, id: 'item2', group: group2, syncWithGroup: true };
      const result = utils.groupItemsByGroup('mssql', [item1, item2]);
      assert.deepStrictEqual(result, [[item1], [item2]]);
    });
  });
});
