import path from 'node:path';
import fs from 'node:fs/promises';

import ValueCacheService from './value-cache.service';

import { createFolder, dirSize, generateRandomId, getFilesFiltered } from '../utils';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import testData from '../../tests/utils/test-data';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';

import { flushPromises, mockBaseFolders } from '../../tests/utils/test-utils';

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

describe('ValueCacheService', () => {
  let settings: NorthConnectorEntity<NorthSettings>;
  let service: ValueCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    settings = testData.north.list[0];
    (dirSize as jest.Mock).mockImplementation(() => 1000);

    service = new ValueCacheService(logger, mockBaseFolders('northId').cache, mockBaseFolders('northId').error, settings);
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
    await service.start();
    service.settings = settings;
    expect(createFolder).toHaveBeenCalledTimes(2);
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'time-values'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').error, 'time-values'));

    expect(logger.debug).toHaveBeenCalledWith('4 values in queue and 2 compacted files in cache');
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading buffer file "${path.resolve(
        mockBaseFolders('northId').cache,
        'time-values',
        'error.buffer.tmp'
      )}": Unexpected token 'm', "malformed "... is not valid JSON`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading queue file "${path.resolve(mockBaseFolders('northId').cache, 'time-values', 'error.queue.tmp')}": queue error`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading compact file "${path.resolve(mockBaseFolders('northId').cache, 'time-values', 'error.compact.tmp')}": compact error`
    );
  });

  it('should be properly initialized with no values in queue', async () => {
    // Buffer files are not taken into account for values in queue
    fs.readdir = jest.fn().mockImplementation(() => ['1.buffer.tmp']);

    fs.readFile = jest.fn().mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer' }]));

    await service.start();

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
    await service.start();

    expect(createFolder).toHaveBeenCalledTimes(2);
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'time-values'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').error, 'time-values'));

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
    const empty = await service.isEmpty();
    expect(empty).toBeTruthy();
    expect(fs.readdir).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'time-values'));
    const notEmpty = await service.isEmpty();
    expect(notEmpty).toBeFalsy();
    expect(fs.readdir).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'time-values'));
    const notEmptyBecauseOfError = await service.isEmpty();
    expect(notEmptyBecauseOfError).toBeTruthy();
    expect(fs.readdir).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'time-values'));
    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'));
  });

  it('should remove all values', async () => {
    service.removeSentValues = jest.fn();
    fs.readdir = jest.fn().mockImplementationOnce(() => ['1.queue.tmp', '2.queue.tmp', '3.queue.tmp', '4.queue.tmp']);
    fs.readFile = jest
      .fn()
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer1' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer2' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer3' }]))
      .mockImplementationOnce(() => JSON.stringify([{ data: 'myFlushBuffer4' }]));

    await service.start();
    await service.removeAllValues();
    expect(service.removeSentValues).toHaveBeenCalledWith(
      new Map([
        [path.resolve(mockBaseFolders('northId').cache, 'time-values', '1.queue.tmp'), [{ data: 'myFlushBuffer1' }]],
        [path.resolve(mockBaseFolders('northId').cache, 'time-values', '2.queue.tmp'), [{ data: 'myFlushBuffer2' }]],
        [path.resolve(mockBaseFolders('northId').cache, 'time-values', '3.queue.tmp'), [{ data: 'myFlushBuffer3' }]],
        [path.resolve(mockBaseFolders('northId').cache, 'time-values', '4.queue.tmp'), [{ data: 'myFlushBuffer4' }]]
      ])
    );
  });

  it('should manage error values', async () => {
    (fs.stat as jest.Mock).mockReturnValue({ size: 123 });

    const valuesToRemove = new Map<string, Array<OIBusTimeValue>>();
    valuesToRemove.set(path.resolve(mockBaseFolders('northId').cache, 'time-values', '1.queue.tmp'), []);
    valuesToRemove.set(path.resolve(mockBaseFolders('northId').cache, 'time-values', '1.compact.tmp'), []);
    fs.rename = jest
      .fn()
      .mockImplementationOnce(() => '')
      .mockImplementation(() => {
        throw new Error('unlink error');
      });

    await service.manageErroredValues(valuesToRemove, 1);
    const expectedMap = new Map();
    expectedMap.set('2.queue.tmp', []);
    expect(logger.warn).toHaveBeenCalledWith(
      `Values file "${path.resolve(mockBaseFolders('northId').cache, 'time-values', '1.queue.tmp')}" ` +
        `moved to "${path.resolve(mockBaseFolders('northId').error, 'time-values', '1.queue.tmp')}" after 1 errors`
    );
    expect(fs.rename).toHaveBeenCalledWith(
      path.resolve(mockBaseFolders('northId').cache, 'time-values', '1.queue.tmp'),
      path.resolve(mockBaseFolders('northId').error, 'time-values', '1.queue.tmp')
    );
    expect(fs.rename).toHaveBeenCalledWith(
      path.resolve(mockBaseFolders('northId').cache, 'time-values', '1.compact.tmp'),
      path.resolve(mockBaseFolders('northId').error, 'time-values', '1.compact.tmp')
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while moving values file "${path.resolve(mockBaseFolders('northId').cache, 'time-values', '1.compact.tmp')}" ` +
        `into cache error "${path.resolve(mockBaseFolders('northId').error, 'time-values', '1.compact.tmp')}": unlink error`
    );
  });

  it('should properly change logger', async () => {
    (fs.readdir as jest.Mock).mockReturnValue([]);
    service.setLogger(anotherLogger);
    await service.start();
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

    await service.start();
    expect(service.getQueuedFilesMetadata('')).toEqual([
      {
        filename: '1test.queue.tmp',
        size: JSON.stringify([{ data: 'myFlushBuffer1' }]).length,
        modificationDate: testData.constants.dates.FAKE_NOW
      },
      {
        filename: '2test.queue.tmp',
        size: JSON.stringify([{ data: 'myFlushBuffer2' }, { data: 'myFlushBuffer2' }]).length,
        modificationDate: testData.constants.dates.FAKE_NOW
      },
      {
        filename: '3.queue.tmp',
        size: JSON.stringify([{ data: 'myFlushBuffer3' }, { data: 'myFlushBuffer3' }, { data: 'myFlushBuffer3' }]).length,
        modificationDate: testData.constants.dates.FAKE_NOW
      },
      {
        filename: '4.queue.tmp',
        size: JSON.stringify([
          { data: 'myFlushBuffer4' },
          { data: 'myFlushBuffer4' },
          { data: 'myFlushBuffer4' },
          { data: 'myFlushBuffer4' }
        ]).length,
        modificationDate: testData.constants.dates.FAKE_NOW
      }
    ]);

    expect(service.getQueuedFilesMetadata('test')).toEqual([
      {
        filename: '1test.queue.tmp',
        size: JSON.stringify([{ data: 'myFlushBuffer1' }]).length,
        modificationDate: testData.constants.dates.FAKE_NOW
      },
      {
        filename: '2test.queue.tmp',
        size: JSON.stringify([{ data: 'myFlushBuffer2' }, { data: 'myFlushBuffer2' }]).length,
        modificationDate: testData.constants.dates.FAKE_NOW
      }
    ]);
  });

  it('should return metadata about error value files', async () => {
    await service.getErrorValues('2020-02-02T02:02:02.222Z', '2020-02-03T02:02:02.222Z', 'file');
    expect(getFilesFiltered).toHaveBeenCalled();
  });

  it('should remove all error value files', async () => {
    service.removeErrorValues = jest.fn();
    (fs.readdir as jest.Mock).mockImplementationOnce(() => ['1.queue.tmp', '2.queue.tmp', '3.queue.tmp', '4.queue.tmp']);

    await service.removeAllErrorValues();
    expect(service.removeErrorValues).toHaveBeenCalledWith(['1.queue.tmp', '2.queue.tmp', '3.queue.tmp', '4.queue.tmp']);
    expect(logger.debug).toHaveBeenCalledWith(`Removing 4 files from "${path.resolve(mockBaseFolders('northId').error, 'time-values')}"`);
  });

  it('should remove all error value files when there are none', async () => {
    service.removeErrorValues = jest.fn();
    (fs.readdir as jest.Mock).mockImplementationOnce(() => []);

    await service.removeAllErrorValues();
    expect(service.removeErrorValues).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      `The error value folder "${path.resolve(mockBaseFolders('northId').error, 'time-values')}" is empty. Nothing to delete`
    );
  });

  it('should remove error values', async () => {
    (fs.unlink as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('unlink error');
      });
    await service.removeErrorValues(['file1', 'file2']);
    expect(fs.unlink).toHaveBeenNthCalledWith(1, path.resolve(mockBaseFolders('northId').error, 'time-values', 'file1'));
    expect(fs.unlink).toHaveBeenNthCalledWith(2, path.resolve(mockBaseFolders('northId').error, 'time-values', 'file2'));
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing file "${path.resolve(mockBaseFolders('northId').error, 'time-values', 'file2')}" from error cache: unlink error`
    );
  });

  it('should retry all error value files', async () => {
    service.retryErrorValues = jest.fn();
    (fs.readdir as jest.Mock).mockImplementationOnce(() => ['1.queue.tmp', '2.queue.tmp', '3.queue.tmp', '4.queue.tmp']);

    await service.retryAllErrorValues();
    expect(service.retryErrorValues).toHaveBeenCalledWith(['1.queue.tmp', '2.queue.tmp', '3.queue.tmp', '4.queue.tmp']);
    expect(logger.debug).toHaveBeenCalledWith(`Retrying 4 files from "${path.resolve(mockBaseFolders('northId').error, 'time-values')}"`);
  });

  it('should retry all error value files when there are none', async () => {
    service.retryErrorValues = jest.fn();
    (fs.readdir as jest.Mock).mockImplementationOnce(() => []);

    await service.retryAllErrorValues();
    expect(service.retryErrorValues).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      `The error value folder "${path.resolve(mockBaseFolders('northId').error, 'time-values')}" is empty. Nothing to retry`
    );
  });

  it('should retry error value files', async () => {
    service.removeErrorValues = jest.fn();
    service.cacheValues = jest.fn();
    (fs.readFile as jest.Mock).mockReturnValueOnce('{}').mockReturnValueOnce('not a json');
    await service.retryErrorValues(['file1', 'file2']);
    expect(service.cacheValues).toHaveBeenNthCalledWith(1, {});
    expect(service.removeErrorValues).toHaveBeenNthCalledWith(1, ['file1']);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading error value file "${path.resolve(mockBaseFolders('northId').error, 'time-values', 'file2')}": Unexpected token 'o', "not a json" is not valid JSON`
    );
    expect(service.removeErrorValues).toHaveBeenCalledTimes(1);
  });

  it('should properly cache values', async () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('generated-uuid1');
    const values: Array<OIBusTimeValue> = [
      {
        pointId: 'ref1',
        timestamp: testData.constants.dates.FAKE_NOW,
        data: {
          value: 'val1'
        }
      },
      {
        pointId: 'ref2',
        timestamp: testData.constants.dates.FAKE_NOW,
        data: {
          value: 'val2'
        }
      }
    ];
    await service.cacheValues(values);
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid1.buffer.tmp'),
      JSON.stringify(values),
      { encoding: 'utf8' }
    );
  });
});

describe('ValueCacheService with values loaded', () => {
  let settings: NorthConnectorEntity<NorthSettings>;
  let service: ValueCacheService;
  const valuesToCache: Array<OIBusTimeValue> = [];
  for (let i = 0; i < 251; i += 1) {
    valuesToCache.push({} as OIBusTimeValue);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    settings = JSON.parse(JSON.stringify(testData.north.list[0]));

    service = new ValueCacheService(logger, mockBaseFolders('northId').cache, mockBaseFolders('northId').error, settings);
  });

  it('should properly get values to send from queue', async () => {
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
    await service.cacheValues(valuesToCache);
    await service.cacheValues(valuesToCache);
    await service.cacheValues(valuesToCache);

    const expectedValues = new Map<string, Array<OIBusTimeValue>>();
    expectedValues.set(path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid2.queue.tmp'), valuesToCache);
    expectedValues.set(path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid4.queue.tmp'), valuesToCache);
    expectedValues.set(path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid6.queue.tmp'), valuesToCache);
    const valuesToSend = await service.getValuesToSend();

    expect(valuesToSend).toEqual(expectedValues);
  });

  it('should properly stop and clear timeout', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await service.stop();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should properly not flush if already flushing', async () => {
    service.cacheValues(valuesToCache);
    jest.advanceTimersByTime(350);
    await service.cacheValues(valuesToCache);
    expect(logger.trace).toHaveBeenCalledWith('Flush already in progress');
    await flushPromises();
  });

  it('should not write empty file in queue', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('generated-uuid');
    await service.cacheValues([]);
    jest.advanceTimersByTime(350);
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid.buffer.tmp'),
      '[]',
      { encoding: 'utf8' }
    );
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid.buffer.tmp'));
    expect(fs.unlink).not.toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid.queue.tmp'));
  });

  it('should not remove buffer files if there is a writing error of queue file', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('generated-uuid');
    (fs.writeFile as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('write error');
      });
    await service.cacheValues(valuesToCache);

    expect(fs.writeFile).toHaveBeenCalledWith(
      path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid.buffer.tmp'),
      JSON.stringify(valuesToCache),
      { encoding: 'utf8' }
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid.queue.tmp'),
      JSON.stringify(valuesToCache),
      { encoding: 'utf8', flag: 'w' }
    );
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      `Error while writing queue file "${path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid.queue.tmp')}": write error`
    );
  });

  it('should log error in case of unlink error in flush', async () => {
    (generateRandomId as jest.Mock).mockReturnValue('generated-uuid');
    (fs.unlink as jest.Mock).mockImplementationOnce(() => {
      throw new Error('unlink error');
    });
    await service.cacheValues(valuesToCache);
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid.buffer.tmp'));
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing buffer file "${path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid.buffer.tmp')}": unlink error`
    );
  });

  it('should compact queue if number of values exceed maxGroupCount, retrieve values and remove them', async () => {
    (generateRandomId as jest.Mock)
      .mockReturnValueOnce('generated-uuid-buffer1')
      .mockReturnValueOnce('generated-uuid-queue1')
      .mockReturnValueOnce('generated-uuid-buffer2')
      .mockReturnValueOnce('generated-uuid-queue2')
      .mockReturnValueOnce('generated-uuid-compact1');
    settings.caching.oibusTimeValues.maxSendCount = 400;
    await service.cacheValues(valuesToCache);
    await service.cacheValues(valuesToCache);
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid-compact1.compact.tmp'),
      JSON.stringify([...valuesToCache, ...valuesToCache]),
      { encoding: 'utf8', flag: 'w' }
    );
    expect(logger.trace).toHaveBeenCalledWith(
      `Max group count reach with 502 values in queue. Compacting queue into "${path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid-compact1.compact.tmp')}"`
    );

    (fs.readFile as jest.Mock).mockReturnValueOnce('[]').mockReturnValueOnce('not a json');
    const result = await service.getValuesToSend();
    expect(logger.trace).toHaveBeenCalledWith(
      `Retrieving values from "${path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid-compact1.compact.tmp')}"`
    );
    const expectedResult = new Map<string, Array<OIBusTimeValue>>();
    expectedResult.set(path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid-compact1.compact.tmp'), []);
    expect(result).toEqual(expectedResult);

    const expectedEmptyResult = new Map<string, Array<OIBusTimeValue>>();
    const emptyResult = await service.getValuesToSend();
    expect(logger.error).toHaveBeenCalledWith(
      `Error while reading compacted file "${path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid-compact1.compact.tmp')}": Unexpected token 'o', "not a json" is not valid JSON`
    );
    expect(emptyResult).toEqual(expectedEmptyResult);

    await service.removeSentValues(result);
    expect(fs.unlink).toHaveBeenCalledWith(
      path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid-compact1.compact.tmp')
    );
  });

  it('should compact queue if number of values exceed maxGroupCount, retrieve values and manage error values', async () => {
    (generateRandomId as jest.Mock)
      .mockReturnValueOnce('generated-uuid-buffer1')
      .mockReturnValueOnce('generated-uuid-queue1')
      .mockReturnValueOnce('generated-uuid-buffer2')
      .mockReturnValueOnce('generated-uuid-queue2')
      .mockReturnValueOnce('generated-uuid-compact1');
    settings.caching.oibusTimeValues.maxSendCount = 400;
    (fs.stat as jest.Mock).mockReturnValue({ size: 123 });
    await service.cacheValues(valuesToCache);
    await service.cacheValues(valuesToCache);

    (fs.readFile as jest.Mock).mockReturnValue('[]');
    const result = await service.getValuesToSend();

    await service.manageErroredValues(result, 3);
    expect(fs.rename).toHaveBeenCalledWith(
      path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid-compact1.compact.tmp'),
      path.resolve(mockBaseFolders('northId').error, 'time-values', 'generated-uuid-compact1.compact.tmp')
    );
  });

  it('should compact queue if number of values exceed maxGroupCount, retrieve values and log error on removal fail', async () => {
    (generateRandomId as jest.Mock)
      .mockReturnValueOnce('generated-uuid-buffer1')
      .mockReturnValueOnce('generated-uuid-queue1')
      .mockReturnValueOnce('generated-uuid-buffer2')
      .mockReturnValueOnce('generated-uuid-queue2')
      .mockReturnValueOnce('generated-uuid-compact1');
    settings.caching.oibusTimeValues.maxSendCount = 400;
    await service.cacheValues(valuesToCache);
    await service.cacheValues(valuesToCache);

    (fs.readFile as jest.Mock).mockReturnValueOnce('[]');
    const result = await service.getValuesToSend();

    (fs.unlink as jest.Mock).mockImplementationOnce(() => {
      throw new Error('unlink error');
    });
    await service.removeSentValues(result);
    expect(fs.unlink).toHaveBeenCalledWith(
      path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid-compact1.compact.tmp')
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while removing file "${path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid-compact1.compact.tmp')}" from cache: unlink error`
    );
  });

  it('should log error on compact queue write error', async () => {
    (generateRandomId as jest.Mock)
      .mockReturnValueOnce('generated-uuid-buffer1')
      .mockReturnValueOnce('generated-uuid-queue1')
      .mockReturnValueOnce('generated-uuid-buffer2')
      .mockReturnValueOnce('generated-uuid-queue2')
      .mockReturnValueOnce('generated-uuid-compact1');
    (fs.writeFile as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('write error');
      });
    settings.caching.oibusTimeValues.maxSendCount = 400;
    await service.cacheValues(valuesToCache);
    await service.cacheValues(valuesToCache);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while compacting queue files into "${path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid-compact1.compact.tmp')}": write error`
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.resolve(mockBaseFolders('northId').cache, 'time-values', 'generated-uuid-compact1.compact.tmp'),
      JSON.stringify([...valuesToCache, ...valuesToCache]),
      { encoding: 'utf8', flag: 'w' }
    );
  });
});
