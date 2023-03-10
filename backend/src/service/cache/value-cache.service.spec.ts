import path from 'node:path';
import fs from 'node:fs/promises';

import ValueCache from './value-cache.service';

import { createFolder, generateRandomId } from '../utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import { NorthCacheSettingsLightDTO } from '../../../../shared/model/north-connector.model';

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
      maxSendCount: 1000,
      retryCount: 3,
      retryInterval: 5000,
      timeout: 10000
    };
    cache = new ValueCache(logger, 'myCacheFolder', settings);
  });

  it('should be properly initialized with values in cache', async () => {
    fs.readdir = jest
      .fn()
      .mockImplementation(() => [
        '1.buffer.tmp',
        'error.buffer.tmp',
        '1.queue.tmp',
        '2.queue.tmp',
        'error.queue.tmp',
        '1.compact.tmp',
        '2.compact.tmp',
        'error.compact.tmp'
      ]);

    fs.readFile = jest
      .fn()
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer' }]))
      .mockImplementationOnce(() => 'malformed buffer file')
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFirstQueueValue1' }, { data: 'myFirstQueueValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'mySecondQueueValue1' }, { data: 'mySecondQueueValue2' }]))
      .mockImplementationOnce(() => {
        throw new Error('queue error');
      })
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFirstCompactValue1' }, { data: 'myFirstCompactValue2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'mySecondCompactValue1' }, { data: 'mySecondCompactValue2' }]))
      .mockImplementationOnce(() => {
        throw new Error('compact error');
      });
    fs.stat = jest
      .fn()
      .mockImplementationOnce(() => ({ ctimeMs: 2 }))
      .mockImplementationOnce(() => ({ ctimeMs: 1 }));
    await cache.start();

    expect(createFolder).toHaveBeenCalledTimes(2);
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors'));

    expect(logger.info).toHaveBeenCalledWith('8 values in cache');
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading buffer file "${path.resolve(
        'myCacheFolder',
        'values',
        'error.buffer.tmp'
      )}": SyntaxError: Unexpected token m in JSON at position 0`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading queue file "${path.resolve('myCacheFolder', 'values', 'error.queue.tmp')}": Error: queue error`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading compact file "${path.resolve('myCacheFolder', 'values', 'error.compact.tmp')}": Error: compact error`
    );
  });

  it('should be properly initialized with no values in queue', async () => {
    // Buffer files are not taken into account for values in queue
    fs.readdir = jest.fn().mockImplementation(() => ['1.buffer.tmp']);

    fs.readFile = jest.fn().mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer' }]));

    await cache.start();

    expect(logger.info).toHaveBeenCalledWith('No value in cache');
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

    expect(logger.info).toHaveBeenCalledWith('8 values in cache');
  });

  it('should properly time flush with no data to flush', async () => {
    const compactSpy = jest.spyOn(cache, 'compactQueueCache');

    await cache.flush();
    expect(logger.trace).toHaveBeenCalledWith('Nothing to flush (time-flush)');
    expect(fs.rename).not.toHaveBeenCalled();
    expect(compactSpy).not.toHaveBeenCalled();
    compactSpy.mockReset();
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
    fs.unlink = jest
      .fn()
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => {
        throw new Error('unlink error');
      });

    await cache.deleteKeyFromCache('1.queue.tmp');
    const expectedMap = new Map();
    expectedMap.set('2.queue.tmp', []);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Removing "${path.resolve('myCacheFolder', 'values', '1.queue.tmp')}" from cache`);
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values', '1.queue.tmp'));

    await cache.deleteKeyFromCache('1.compact.tmp');
    expect(logger.trace).toHaveBeenCalledWith(`Removing "${path.resolve('myCacheFolder', 'values', '1.compact.tmp')}" from cache`);
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
    fs.rename = jest
      .fn()
      .mockImplementationOnce(() => '')
      .mockImplementation(() => {
        throw new Error('unlink error');
      });

    await cache.manageErroredValues(valuesToRemove, 1);
    const expectedMap = new Map();
    expectedMap.set('2.queue.tmp', []);
    expect(logger.warn).toHaveBeenCalledWith(
      `Values file "${path.resolve('myCacheFolder', 'values', '1.queue.tmp')}" ` +
        `moved to "${path.resolve('myCacheFolder', 'values-errors', '1.queue.tmp')}" after 1 errors`
    );
    expect(fs.rename).toHaveBeenCalledWith(
      path.resolve('myCacheFolder', 'values', '1.queue.tmp'),
      path.resolve('myCacheFolder', 'values-errors', '1.queue.tmp')
    );
    expect(fs.rename).toHaveBeenCalledWith(
      path.resolve('myCacheFolder', 'values', '1.compact.tmp'),
      path.resolve('myCacheFolder', 'values-errors', '1.compact.tmp')
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while moving values file "${path.resolve('myCacheFolder', 'values', '1.compact.tmp')}" ` +
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
  });

  it('should cache values and flush because of buffer max', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const compactSpy = jest.spyOn(cache, 'compactQueueCache');
    (generateRandomId as jest.Mock)
      .mockReturnValueOnce('generated-uuid1') // buffer with 2 values
      .mockReturnValueOnce('generated-uuid2') // buffer with 251 values
      .mockReturnValueOnce('generated-uuid3') // queue with 253 values
      .mockReturnValueOnce('generated-uuid4') // buffer with 251 values
      .mockReturnValueOnce('generated-uuid5') // queue with 251 value
      .mockReturnValueOnce('generated-uuid6') // buffer with 251 values
      .mockReturnValueOnce('generated-uuid7') // queue with 251 value
      .mockReturnValueOnce('generated-uuid8') // buffer with 251 values
      .mockReturnValueOnce('generated-uuid9'); // queue with 251 value

    fs.unlink = jest.fn().mockImplementationOnce(() => {
      throw new Error('unlink error');
    });

    fs.writeFile = jest
      .fn()
      .mockImplementationOnce(() => '') // buffer 1
      .mockImplementationOnce(() => '') // buffer 2
      .mockImplementationOnce(() => {
        // queue 1
        throw new Error('write error');
      });

    const valuesToCache = [];
    for (let i = 0; i < 251; i += 1) {
      valuesToCache.push({});
    }
    await cache.cacheValues([valuesToCache[0], valuesToCache[0]]);
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.resolve('myCacheFolder', 'values', 'generated-uuid1.buffer.tmp'),
      JSON.stringify([valuesToCache[0], valuesToCache[0]]),
      {
        encoding: 'utf8'
      }
    );

    await cache.cacheValues(valuesToCache);
    // clearTimeout called because max-flush has been triggered
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while writing queue file ${path.resolve('myCacheFolder', 'values', 'generated-uuid3.queue.tmp')}: Error: write error`
    );

    jest.advanceTimersByTime(150);
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.resolve('myCacheFolder', 'values', 'generated-uuid2.buffer.tmp'),
      JSON.stringify(valuesToCache),
      {
        encoding: 'utf8'
      }
    );
    await cache.cacheValues(valuesToCache);
    expect(compactSpy).not.toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(
      `Flush 504 values (max-flush) into "${path.resolve('myCacheFolder', 'values', 'generated-uuid5.queue.tmp')}". 504 values in queue`
    );

    await cache.cacheValues(valuesToCache);
    expect(logger.trace).toHaveBeenCalledWith(
      `Flush 251 values (max-flush) into "${path.resolve('myCacheFolder', 'values', 'generated-uuid7.queue.tmp')}". 755 values in queue`
    );
    expect(compactSpy).not.toHaveBeenCalled();
    await cache.cacheValues(valuesToCache); // compact queue here
    expect(compactSpy).toHaveBeenCalledTimes(1);
    compactSpy.mockReset();
  });

  it('should compact queue', async () => {
    const queue = new Map();
    queue.set('1.queue.tmp', [{ data: 'myFirstValue' }, { data: 'mySecondValue' }]);
    queue.set('2.queue.tmp', [{ data: 'myThirdValue' }]);

    cache.deleteKeyFromCache = jest.fn();

    await cache.compactQueueCache(queue);
    expect(logger.trace).toHaveBeenCalledWith('Max group count reach. Compacting queue into "generated-uuid.compact.tmp"');
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

  describe('with values loaded', () => {
    const valuesToCache: Array<any> = [];
    for (let i = 0; i < 251; i += 1) {
      valuesToCache.push({});
    }

    beforeEach(async () => {
      jest.resetAllMocks();
      (generateRandomId as jest.Mock)
        .mockReturnValueOnce('generated-uuid1')
        .mockReturnValueOnce('generated-uuid2')
        .mockReturnValueOnce('generated-uuid3')
        .mockReturnValueOnce('generated-uuid4')
        .mockReturnValueOnce('generated-uuid5')
        .mockReturnValueOnce('generated-uuid6')
        .mockReturnValueOnce('generated-uuid7')
        .mockReturnValueOnce('generated-uuid8')
        .mockReturnValueOnce('generated-uuid9');

      cache = new ValueCache(logger, 'myCacheFolder', settings);

      await cache.cacheValues(valuesToCache);
      await cache.cacheValues(valuesToCache);
      await cache.cacheValues(valuesToCache);
    });

    it('should properly get values to send from queue', async () => {
      const expectedValues: Map<string, Array<any>> = new Map();
      expectedValues.set('generated-uuid2.queue.tmp', valuesToCache);
      expectedValues.set('generated-uuid4.queue.tmp', valuesToCache);
      expectedValues.set('generated-uuid6.queue.tmp', valuesToCache);
      const valuesToSend = await cache.getValuesToSend();

      expect(valuesToSend).toEqual(expectedValues);
    });

    it('should properly get values to send from compact and delete from cache', async () => {
      (fs.readFile as jest.Mock).mockImplementationOnce(() => '[{}]');

      const expectedValues: Map<string, Array<any>> = new Map();
      expectedValues.set('generated-uuid9.compact.tmp', [{}]);

      await cache.cacheValues(valuesToCache); // compact queue here
      const valuesToSend = await cache.getValuesToSend();
      expect(valuesToSend).toEqual(expectedValues);

      await cache.deleteKeyFromCache('generated-uuid9.compact.tmp');
      expect(logger.trace).toHaveBeenCalledWith(
        `Removing "${path.resolve('myCacheFolder', 'values', 'generated-uuid9.compact.tmp')}" from cache`
      );
    });

    it('should properly get values to send from compact manage error', async () => {
      (fs.readFile as jest.Mock).mockImplementationOnce(() => {
        throw new Error('read file error');
      });

      await cache.cacheValues(valuesToCache); // compact queue here
      const noValues = await cache.getValuesToSend();
      expect(noValues).toEqual(new Map());
      expect(logger.error).toHaveBeenCalledWith(`Error while reading compacted file "generated-uuid9.compact.tmp": Error: read file error`);

      const errorMap = new Map();
      errorMap.set('generated-uuid9.compact.tmp', []);
      await cache.manageErroredValues(errorMap, 1);
      expect(logger.warn).toHaveBeenCalledWith(
        `Values file "${path.resolve('myCacheFolder', 'values', 'generated-uuid9.compact.tmp')}" moved to "${path.resolve(
          'myCacheFolder',
          'values-errors',
          'generated-uuid9.compact.tmp'
        )}" after 1 errors`
      );
    });

    it('should properly stop and clear timeout', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      await cache.stop();

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    });
  });
});
