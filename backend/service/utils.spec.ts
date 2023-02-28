import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import zlib from 'node:zlib';

import minimist from 'minimist';

import { DateTime } from 'luxon';
import * as utils from './utils';

jest.mock('node:zlib');
jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('minimist');

const nowDateString = '2020-02-02T02:02:02.222Z';

describe('Service utils', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
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

  it('should delay', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      return callback();
    });

    await utils.delay(1000);
    jest.advanceTimersToNextTimer();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
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

  it('should format date properly', () => {
    const test1 = utils.generateDateWithTimezone('2020-02-22 22:22:22.666', 'Europe/Paris', 'yyyy-MM-dd HH:mm:ss.SSS');
    const expectedResult1 = '2020-02-22T21:22:22.666Z';
    expect(test1).toBe(expectedResult1);

    const test2 = utils.generateDateWithTimezone('2020-02-22T22:22:22.666Z', 'Europe/Paris', 'yyyy-MM-dd HH:mm:ss.SSS');
    const expectedResult2 = '2020-02-22T22:22:22.666Z';
    expect(test2).toBe(expectedResult2);
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

  it('should properly check if a file exists or not', async () => {
    (fs.stat as jest.Mock).mockImplementation(() => {
      throw new Error('File does not exist');
    });

    expect(await utils.filesExists('myConfigFile.json')).toEqual(false);

    (fs.stat as jest.Mock).mockImplementation(() => null);
    expect(await utils.filesExists('myConfigFile.json')).toEqual(true);
  });

  it('should properly check if a file exists or not', async () => {
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

  it('should properly compress file', async () => {
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

  it('should properly filter asynchronously', async () => {
    const array = ['ok', 'ok', 'notOk', 'ok'];
    const predicate = async (item: string) => item === 'ok';

    const result = await utils.asyncFilter(array, predicate);

    expect(result).toEqual(['ok', 'ok', 'ok']);
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
