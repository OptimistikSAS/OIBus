import path from 'node:path';
import fs from 'node:fs/promises';

import ValueCache from './value-cache.service';

import { createFolder, dirSize, generateRandomId, getFilesFiltered } from '../utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import testData from '../../tests/utils/test-data';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';

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

describe('ValueCache', () => {
  let configuration: NorthConnectorEntity<NorthSettings>;
  let cache: ValueCache<NorthSettings>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = testData.north.list[0];
    (dirSize as jest.Mock).mockImplementation(() => 1000);

    cache = new ValueCache(logger, 'myCacheFolder', configuration);
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

  it('should manage error values', async () => {
    const valuesToRemove = new Map<string, Array<OIBusTimeValue>>();
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
    const valuesToCache: Array<OIBusTimeValue> = [];
    for (let i = 0; i < 251; i += 1) {
      valuesToCache.push({} as OIBusTimeValue);
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

      cache = new ValueCache(logger, 'myCacheFolder', configuration);

      await cache.cacheValues(valuesToCache);
      await cache.cacheValues(valuesToCache);
      await cache.cacheValues(valuesToCache);
    });

    it('should properly get values to send from queue', async () => {
      const expectedValues = new Map<string, Array<OIBusTimeValue>>();
      expectedValues.set(path.resolve('myCacheFolder', 'values', 'generated-uuid2.queue.tmp'), valuesToCache);
      expectedValues.set(path.resolve('myCacheFolder', 'values', 'generated-uuid4.queue.tmp'), valuesToCache);
      expectedValues.set(path.resolve('myCacheFolder', 'values', 'generated-uuid6.queue.tmp'), valuesToCache);
      const valuesToSend = await cache.getValuesToSend();

      expect(valuesToSend).toEqual(expectedValues);
    });

    it('should properly stop and clear timeout', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      await cache.stop();

      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    });
  });
});
