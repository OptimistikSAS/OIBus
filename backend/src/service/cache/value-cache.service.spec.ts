import path from 'node:path';
import fs from 'node:fs/promises';

import ValueCache from './value-cache.service';

import { createFolder, generateRandomId, dirSize, getFilesFiltered } from '../utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import { NorthCacheSettingsDTO } from '../../../../shared/model/north-connector.model';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';

jest.mock('../utils', () => ({
  generateRandomId: jest.fn(() => 'generated-uuid'),
  createFolder: jest.fn(() => Promise.resolve()),
  dirSize: jest.fn(),
  getFilesFiltered: jest.fn(() => Promise.resolve([]))
}));
jest.mock('node:fs/promises');
// Mock logger
const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const nowDateString = '2020-02-02T02:02:02.222Z';
let settings: NorthCacheSettingsDTO;
let cache: ValueCache;
describe('ValueCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    settings = {
      scanModeId: 'id1',
      retryInterval: 5000,
      retryCount: 3,
      maxSize: 1000,
      oibusTimeValues: {
        groupCount: 1000,
        maxSendCount: 1000
      }
    } as NorthCacheSettingsDTO;
    (dirSize as jest.Mock).mockImplementation(() => 1000);

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
      });
    fs.stat = jest
      .fn()
      .mockImplementationOnce(() => ({ ctimeMs: 2 }))
      .mockImplementationOnce(() => ({ ctimeMs: 2 }))
      .mockImplementationOnce(() => {
        throw new Error('compact error');
      });
    await cache.start();

    expect(createFolder).toHaveBeenCalledTimes(2);
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors'));

    expect(logger.debug).toHaveBeenCalledWith('4 values in queue and 2 compacted files in cache');
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading buffer file "${path.resolve(
        'myCacheFolder',
        'values',
        'error.buffer.tmp'
      )}": SyntaxError: Unexpected token 'm', "malformed "... is not valid JSON`
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

    expect(logger.debug).toHaveBeenCalledWith('No value in cache');
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

    expect(logger.debug).toHaveBeenCalledWith('4 values in queue and 2 compacted files in cache');
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

  it('should remove all values', async () => {
    cache.removeSentValues = jest.fn();
    fs.readdir = jest.fn().mockImplementationOnce(() => ['1.queue.tmp', '2.queue.tmp', '3.queue.tmp', '4.queue.tmp']);
    fs.readFile = jest
      .fn()
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer1' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer3' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer4' }]));

    await cache.start();
    await cache.removeAllValues();
    expect(cache.removeSentValues).toHaveBeenCalledWith(
      new Map([
        [path.resolve('myCacheFolder', 'values', '1.queue.tmp'), [{ data: 'myFlushBuffer1' }]],
        [path.resolve('myCacheFolder', 'values', '2.queue.tmp'), [{ data: 'myFlushBuffer2' }]],
        [path.resolve('myCacheFolder', 'values', '3.queue.tmp'), [{ data: 'myFlushBuffer3' }]],
        [path.resolve('myCacheFolder', 'values', '4.queue.tmp'), [{ data: 'myFlushBuffer4' }]]
      ])
    );
  });

  it('should delete key from cache', async () => {
    fs.unlink = jest
      .fn()
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => {
        throw new Error('unlink error');
      });

    (fs.stat as jest.Mock).mockReturnValue({ size: 123 });
    await cache.deleteKeyFromCache(path.resolve('myCacheFolder', 'values', '1.queue.tmp'));
    const expectedMap = new Map();
    expectedMap.set('2.queue.tmp', []);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Removing "${path.resolve('myCacheFolder', 'values', '1.queue.tmp')}" from cache`);
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values', '1.queue.tmp'));

    await cache.deleteKeyFromCache(path.resolve('myCacheFolder', 'values', '1.compact.tmp'));
    expect(logger.trace).toHaveBeenCalledWith(`Removing "${path.resolve('myCacheFolder', 'values', '1.compact.tmp')}" from cache`);
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values', '1.compact.tmp'));
    expect(logger.error).toHaveBeenCalledWith(
      'Error while removing file ' +
        `"${path.resolve('myCacheFolder', 'values', '1.compact.tmp')}" from cache: ${new Error('unlink error')}`
    );
  });

  it('should manage error values', async () => {
    const valuesToRemove: Map<string, Array<any>> = new Map();
    valuesToRemove.set(path.resolve('myCacheFolder', 'values', '1.queue.tmp'), []);
    valuesToRemove.set(path.resolve('myCacheFolder', 'values', '1.compact.tmp'), []);
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

    const valuesToCache: Array<OIBusTimeValue> = [
      { data: { value: 'myFirstValue' } },
      { data: { value: 'mySecondValue' } }
    ] as Array<OIBusTimeValue>;
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

    const valuesToCache: Array<OIBusTimeValue> = [];
    for (let i = 0; i < 251; i += 1) {
      valuesToCache.push({} as OIBusTimeValue);
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
      `Error while writing queue file "${path.resolve('myCacheFolder', 'values', 'generated-uuid3.queue.tmp')}". Error: write error`
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

    await cache.cacheValues([valuesToCache[0], valuesToCache[0]]);

    const promise = new Promise(resolve => {
      setTimeout(() => resolve(''), 10);
    });
    compactSpy.mockImplementationOnce(async () => {
      await promise;
    });
    cache.flush();
    cache.flush();
    jest.advanceTimersByTime(1000);
    expect(logger.trace).toHaveBeenCalledWith(`Flush already in progress`);
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

  it('should properly change logger', async () => {
    (fs.readdir as jest.Mock).mockReturnValue([]);
    cache.setLogger(anotherLogger);
    await cache.start();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(anotherLogger.debug).toHaveBeenCalledWith(`No value in cache`);
  });

  it('should return metadata from queue', async () => {
    fs.readdir = jest.fn().mockImplementationOnce(() => ['1test.queue.tmp', '2test.queue.tmp', '3.queue.tmp', '4.queue.tmp']);
    fs.readFile = jest
      .fn()
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer1' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer2' }, { data: 'myFlushBuffer2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer3' }, { data: 'myFlushBuffer3' }, { data: 'myFlushBuffer3' }]))
      .mockImplementationOnce(() =>
        JSON.stringify([{ data: 'myFlushBuffer4' }, { data: 'myFlushBuffer4' }, { data: 'myFlushBuffer4' }, { data: 'myFlushBuffer4' }])
      );

    await cache.start();
    expect(cache.getQueuedFilesMetadata('')).toEqual([
      { filename: '1test.queue.tmp', valuesCount: 1 },
      { filename: '2test.queue.tmp', valuesCount: 2 },
      { filename: '3.queue.tmp', valuesCount: 3 },
      { filename: '4.queue.tmp', valuesCount: 4 }
    ]);

    expect(cache.getQueuedFilesMetadata('test')).toEqual([
      { filename: '1test.queue.tmp', valuesCount: 1 },
      { filename: '2test.queue.tmp', valuesCount: 2 }
    ]);
  });

  it('should return metadata about error value files', async () => {
    await cache.getErrorValueFiles('2020-02-02T02:02:02.222Z', '2020-02-03T02:02:02.222Z', 'file');
    expect(getFilesFiltered).toHaveBeenCalled();
  });

  it('should remove error value files', async () => {
    const valuesToRemove = ['1.queue.tmp', '2.queue.tmp'];
    const deleteKeyFromCacheSpy = jest.spyOn(cache, 'deleteKeyFromCache');
    await cache.removeErrorValues(valuesToRemove);

    expect(deleteKeyFromCacheSpy).toHaveBeenCalledTimes(2);
    expect(deleteKeyFromCacheSpy).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors', '1.queue.tmp'));
    expect(deleteKeyFromCacheSpy).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors', '2.queue.tmp'));
  });

  it('should remove all error value files', async () => {
    const removeErrorValuesSpy = jest.spyOn(cache, 'removeErrorValues');
    (fs.readdir as jest.Mock).mockImplementationOnce(() => ['1.queue.tmp', '2.queue.tmp', '3.queue.tmp', '4.queue.tmp']);

    await cache.removeAllErrorValues();
    expect(removeErrorValuesSpy).toHaveBeenCalledWith(['1.queue.tmp', '2.queue.tmp', '3.queue.tmp', '4.queue.tmp']);
    expect(logger.debug).toHaveBeenCalledWith(`Removing 4 files from "${path.resolve('myCacheFolder', 'values-errors')}"`);
  });

  it('should remove all error value files when there are none', async () => {
    const removeErrorValuesSpy = jest.spyOn(cache, 'removeErrorValues');
    (fs.readdir as jest.Mock).mockImplementationOnce(() => []);

    await cache.removeAllErrorValues();
    expect(removeErrorValuesSpy).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      `The error value folder "${path.resolve('myCacheFolder', 'values-errors')}" is empty. Nothing to delete`
    );
  });

  it('should retry error value files', async () => {
    const valuesToRetry = ['1.queue.tmp', '2.queue.tmp', 'error.queue.tmp'];
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => `[{"data": "myFirstValue"}]`)
      .mockImplementationOnce(() => `[{"data": "mySecondValue"}]`)
      .mockImplementationOnce(() => {
        throw new Error('read error');
      });

    const deleteKeyFromCacheSpy = jest.spyOn(cache, 'deleteKeyFromCache');
    const cacheValuesSpy = jest.spyOn(cache, 'cacheValues');

    await cache.retryErrorValues(valuesToRetry);

    // 1.queue.tmp
    expect(fs.readFile).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors', '1.queue.tmp'), { encoding: 'utf8' });
    expect(cacheValuesSpy).toHaveBeenCalledWith([{ data: 'myFirstValue' }]);
    expect(deleteKeyFromCacheSpy).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors', '1.queue.tmp'));

    // 2.queue.tmp
    expect(fs.readFile).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors', '2.queue.tmp'), { encoding: 'utf8' });
    expect(cacheValuesSpy).toHaveBeenCalledWith([{ data: 'mySecondValue' }]);
    expect(deleteKeyFromCacheSpy).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors', '2.queue.tmp'));

    // error.queue.tmp
    expect(fs.readFile).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'values-errors', 'error.queue.tmp'), { encoding: 'utf8' });
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading error value file "${path.resolve('myCacheFolder', 'values-errors', 'error.queue.tmp')}": Error: read error`
    );

    expect(cacheValuesSpy).toHaveBeenCalledTimes(2);
    expect(deleteKeyFromCacheSpy).toHaveBeenCalledTimes(2);
  });

  it('should retry all error value files', async () => {
    const retryErrorValuesSpy = jest.spyOn(cache, 'retryErrorValues');
    (fs.readdir as jest.Mock).mockImplementationOnce(() => ['1.queue.tmp', '2.queue.tmp', '3.queue.tmp', '4.queue.tmp']);

    await cache.retryAllErrorValues();
    expect(retryErrorValuesSpy).toHaveBeenCalledWith(['1.queue.tmp', '2.queue.tmp', '3.queue.tmp', '4.queue.tmp']);
    expect(logger.debug).toHaveBeenCalledWith(`Retrying 4 files from "${path.resolve('myCacheFolder', 'values-errors')}"`);
  });

  it('should retry all error value files when there are none', async () => {
    const retryErrorValuesSpy = jest.spyOn(cache, 'retryErrorValues');
    (fs.readdir as jest.Mock).mockImplementationOnce(() => []);

    await cache.retryAllErrorValues();
    expect(retryErrorValuesSpy).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      `The error value folder "${path.resolve('myCacheFolder', 'values-errors')}" is empty. Nothing to retry`
    );
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
      (fs.stat as jest.Mock).mockReturnValue({ size: 123 });

      cache = new ValueCache(logger, 'myCacheFolder', settings);

      cache.settings = settings;
      await cache.cacheValues(valuesToCache);
      await cache.cacheValues(valuesToCache);
      await cache.cacheValues(valuesToCache);
    });

    it('should properly get values to send from queue', async () => {
      const expectedValues: Map<string, Array<any>> = new Map();
      expectedValues.set(path.resolve('myCacheFolder', 'values', 'generated-uuid2.queue.tmp'), valuesToCache);
      expectedValues.set(path.resolve('myCacheFolder', 'values', 'generated-uuid4.queue.tmp'), valuesToCache);
      expectedValues.set(path.resolve('myCacheFolder', 'values', 'generated-uuid6.queue.tmp'), valuesToCache);
      const valuesToSend = await cache.getValuesToSend();

      expect(valuesToSend).toEqual(expectedValues);
    });

    it('should properly get values to send from compact and delete from cache', async () => {
      (fs.readFile as jest.Mock).mockImplementationOnce(() => '[{}]');

      const expectedValues: Map<string, Array<any>> = new Map();
      expectedValues.set(path.resolve('myCacheFolder', 'values', 'generated-uuid9.compact.tmp'), [{}]);

      await cache.cacheValues(valuesToCache); // compact queue here
      const valuesToSend = await cache.getValuesToSend();
      expect(valuesToSend).toEqual(expectedValues);

      await cache.deleteKeyFromCache(path.resolve('myCacheFolder', 'values', 'generated-uuid9.compact.tmp'));
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
      expect(logger.error).toHaveBeenCalledWith(
        `Error while reading compacted file "${path.resolve(
          'myCacheFolder',
          'values',
          'generated-uuid9.compact.tmp'
        )}". Error: read file error`
      );

      const errorMap = new Map();
      errorMap.set(path.resolve('myCacheFolder', 'values', 'generated-uuid9.compact.tmp'), []);
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
