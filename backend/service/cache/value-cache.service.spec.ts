import path from 'node:path';
import fs from 'node:fs/promises';

import ValueCache from './value-cache.service';

import { createFolder, generateRandomId } from '../utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import { NorthCacheSettingsLightDTO } from '../../../shared/model/north-connector.model';

jest.mock('../utils', () => ({
  generateRandomId: jest.fn(() => 'generated-uuid'),
  createFolder: jest.fn(() => Promise.resolve())
}));
jest.mock('node:fs/promises');
jest.mock('../utils');

// Mock logger
const logger: pino.Logger = new PinoLogger();

// const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);
const nowDateString = '2020-02-02T02:02:02.222Z';
let settings: NorthCacheSettingsLightDTO;
let cache: ValueCache;
describe('ValueCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    settings = {
      scanModeId: 'id1',
      groupCount: 1000,
      maxSendCount: 10000,
      retryCount: 3,
      retryInterval: 5000,
      timeout: 10000
    };
    cache = new ValueCache(logger, 'myCacheFolder', settings);
  });

  it('should be properly initialized with values in cache', async () => {
    fs.readdir = jest.fn().mockImplementation(() => ['1.buffer.tmp', '1.queue.tmp', '2.queue.tmp', '1.compact.tmp', '2.compact.tmp']);

    fs.readFile = jest
      .fn()
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFirstQueueValue1' }, { data: 'myFirstQueueValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'mySecondQueueValue1' }, { data: 'mySecondQueueValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFirstCompactValue1' }, { data: 'myFirstCompactValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'mySecondCompactValue1' }, { data: 'mySecondCompactValue2' }]));
    fs.stat = jest
      .fn()
      .mockImplementationOnce(() => ({ ctimeMs: 2 }))
      .mockImplementationOnce(() => ({ ctimeMs: 1 }));
    await cache.start();

    expect(createFolder).toHaveBeenCalledTimes(2);
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors'));

    expect(logger.info).toHaveBeenCalledWith('8 values in cache.');
  });

  it('should be properly initialized with values in cache and no buffer file', async () => {
    fs.readdir = jest.fn().mockImplementation(() => ['1.queue.tmp', '2.queue.tmp', '1.compact.tmp', '2.compact.tmp']);

    fs.readFile = jest
      .fn()
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFirstQueueValue1' }, { data: 'myFirstQueueValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'mySecondQueueValue1' }, { data: 'mySecondQueueValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFirstCompactValue1' }, { data: 'myFirstCompactValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'mySecondCompactValue1' }, { data: 'mySecondCompactValue2' }]));
    fs.stat = jest
      .fn()
      .mockImplementationOnce(() => ({ ctimeMs: 2 }))
      .mockImplementationOnce(() => ({ ctimeMs: 1 }));
    await cache.start();

    expect(createFolder).toHaveBeenCalledTimes(2);
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors'));

    expect(logger.info).toHaveBeenCalledWith('8 values in cache.');
  });

  it('should properly flush with no data to flush', async () => {
    cache.compactQueueCache = jest.fn();

    await cache.flush();
    expect(logger.trace).toHaveBeenCalledWith('Nothing to flush (time-flush).');
    expect(fs.rename).not.toHaveBeenCalled();
    expect(cache.compactQueueCache).not.toHaveBeenCalled();
  });

  it('should check if cache is empty', async () => {
    fs.readdir = jest
      .fn()
      .mockImplementationOnce(() => [])
      .mockImplementationOnce(() => [{}])
      .mockImplementationOnce(() => {
        throw new Error('readdir error');
      });
    const empty = await cache.isEmpty();
    expect(empty).toBeTruthy();
    expect(fs.readdir).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values'));
    const notEmpty = await cache.isEmpty();
    expect(notEmpty).toBeFalsy();
    expect(fs.readdir).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values'));
    const notEmptyBecauseOfError = await cache.isEmpty();
    expect(notEmptyBecauseOfError).toBeTruthy();
    expect(fs.readdir).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values'));
    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'));
  });

  it('should remove sent values', async () => {
    const valuesToRemove: Map<string, Array<any>> = new Map();
    valuesToRemove.set('1.queue.tmp', []);
    valuesToRemove.set('1.compact.tmp', []);
    cache.deleteKeyFromCache = jest.fn();
    await cache.removeSentValues(valuesToRemove);

    expect(cache.deleteKeyFromCache).toHaveBeenCalledTimes(2);
    expect(cache.deleteKeyFromCache).toHaveBeenCalledWith('1.queue.tmp');
    expect(cache.deleteKeyFromCache).toHaveBeenCalledWith('1.compact.tmp');
  });

  it('should delete key from cache', async () => {
    // cache.compactedQueue = [{ fileName: '1.compact.tmp' }];
    // cache.queue = new Map();
    // cache.queue.set('1.queue.tmp', []);
    // cache.queue.set('2.queue.tmp', []);
    fs.unlink = jest
      .fn()
      .mockImplementationOnce(() => '')
      .mockImplementation(() => {
        throw new Error('unlink error');
      });

    await cache.deleteKeyFromCache('1.queue.tmp');
    // expect(cache.compactedQueue).toEqual([{ fileName: '1.compact.tmp' }]);
    const expectedMap = new Map();
    expectedMap.set('2.queue.tmp', []);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Removing "${path.resolve('myCacheFolder', 'values', '1.queue.tmp')}" from cache.`);
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values', '1.queue.tmp'));

    await cache.deleteKeyFromCache('1.compact.tmp');
    expect(logger.trace).toHaveBeenCalledWith(`Removing "${path.resolve('myCacheFolder', 'values', '1.compact.tmp')}" from cache.`);
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values', '1.compact.tmp'));
    expect(logger.error).toHaveBeenCalledWith(
      'Error while removing file ' +
        `"${path.resolve('myCacheFolder', 'values', '1.compact.tmp')}" from cache: ${new Error('unlink error')}`
    );
  });

  it('should manage error values', async () => {
    const valuesToRemove: Map<string, Array<any>> = new Map();
    valuesToRemove.set('1.queue.tmp', []);
    valuesToRemove.set('1.compact.tmp', []);
    // cache.compactedQueue = [{ fileName: '1.compact.tmp' }];
    // cache.queue = new Map();
    // cache.queue.set('1.queue.tmp', []);
    // cache.queue.set('2.queue.tmp', []);
    fs.rename = jest
      .fn()
      .mockImplementationOnce(() => '')
      .mockImplementation(() => {
        throw new Error('unlink error');
      });

    await cache.manageErroredValues(valuesToRemove);
    const expectedMap = new Map();
    expectedMap.set('2.queue.tmp', []);
    expect(logger.trace).toHaveBeenCalledWith(
      `Moving "${path.resolve('myCacheFolder', 'values', '1.queue.tmp')}" ` +
        `to error cache: "${path.resolve('myCacheFolder', 'values-errors', '1.queue.tmp')}".`
    );
    expect(fs.rename).toHaveBeenCalledWith(
      path.resolve('myCacheFolder', 'values', '1.queue.tmp'),
      path.resolve('myCacheFolder', 'values-errors', '1.queue.tmp')
    );
    expect(logger.trace).toHaveBeenCalledWith(
      `Moving "${path.resolve('myCacheFolder', 'values', '1.compact.tmp')}" ` +
        `to error cache: "${path.resolve('myCacheFolder', 'values-errors', '1.compact.tmp')}".`
    );
    expect(fs.rename).toHaveBeenCalledWith(
      path.resolve('myCacheFolder', 'values', '1.compact.tmp'),
      path.resolve('myCacheFolder', 'values-errors', '1.compact.tmp')
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while moving file "${path.resolve('myCacheFolder', 'values', '1.compact.tmp')}" ` +
        `into cache error "${path.resolve('myCacheFolder', 'values-errors', '1.compact.tmp')}": ${new Error('unlink error')}`
    );
  });

  it('should cache values and flush because of timer', async () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('generated-uuid1').mockReturnValueOnce('generated-uuid2');

    const valuesToCache = [{ data: 'myFirstValue' }, { data: 'mySecondValue' }];
    cache.flush = jest.fn();
    await cache.cacheValues(valuesToCache);
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.resolve('myCacheFolder', 'values', 'generated-uuid1.buffer.tmp'),
      JSON.stringify(valuesToCache),
      { encoding: 'utf8' }
    );
    jest.advanceTimersByTime(150);
    await cache.cacheValues(valuesToCache);
    expect(cache.flush).not.toHaveBeenCalled();

    jest.advanceTimersByTime(150);
    expect(cache.flush).toHaveBeenCalledWith();
  });

  it('should cache values and flush because of buffer max', async () => {
    const valuesToCache = [];
    for (let i = 0; i < 251; i += 1) {
      valuesToCache.push({});
    }
    cache.flush = jest.fn();
    await cache.cacheValues(valuesToCache);
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.resolve('myCacheFolder', 'values', 'generated-uuid.buffer.tmp'),
      JSON.stringify(valuesToCache),
      {
        encoding: 'utf8'
      }
    );
    jest.advanceTimersByTime(300);
    expect(cache.flush).toHaveBeenCalledWith('max-flush');
  });

  it('should compact queue', async () => {
    const queue = new Map();
    queue.set('1.queue.tmp', [{ data: 'myFirstValue' }, { data: 'mySecondValue' }]);
    queue.set('2.queue.tmp', [{ data: 'myThirdValue' }]);

    cache.deleteKeyFromCache = jest.fn();

    await cache.compactQueueCache(queue);
    expect(logger.trace).toHaveBeenCalledWith('Max group count reach. Compacting queue into "generated-uuid.compact.tmp".');
    expect(cache.deleteKeyFromCache).toHaveBeenCalledTimes(2);
  });

  it('should log an error and not remove file from queue if compact write error', async () => {
    const queue = new Map();
    cache.deleteKeyFromCache = jest.fn();
    fs.writeFile = jest.fn().mockImplementationOnce(() => {
      throw new Error('writing error');
    });
    await cache.compactQueueCache(queue);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(new Error('writing error'));
  });
});
