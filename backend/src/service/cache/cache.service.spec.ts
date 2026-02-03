import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';

import { mockBaseFolders } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import CacheService from './cache.service';
import { CacheContentUpdateCommand, CacheMetadata } from '../../../shared/model/engine.model';
import { determineContentTypeFromFilename, generateRandomId, processCacheFileContent } from '../utils';
import DeferredPromise from '../deferred-promise';
import { CONTENT_FOLDER, METADATA_FOLDER } from '../../model/engine.model';

jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();

const fileList: Array<{ filename: string; metadata: CacheMetadata }> = [
  {
    filename: 'file1.json',
    metadata: {
      contentFile: 'file1-123456.json',
      contentSize: 100,
      numberOfElement: 3,
      createdAt: testData.constants.dates.DATE_1,
      contentType: 'time-values'
    }
  },
  {
    filename: 'file2.json',
    metadata: {
      contentFile: 'file2-123456.json',
      contentSize: 100,
      numberOfElement: 4,
      createdAt: testData.constants.dates.DATE_2,
      contentType: 'time-values'
    }
  },
  {
    filename: 'file3.json',
    metadata: {
      contentFile: 'file3-123456.csv',
      contentSize: 100,
      numberOfElement: 0,
      createdAt: testData.constants.dates.DATE_3,
      contentType: 'any'
    }
  },
  {
    filename: 'file4.json',
    metadata: {
      contentFile: 'file4-123456.json',
      contentSize: 100,
      numberOfElement: 6,
      createdAt: testData.constants.dates.FAKE_NOW,
      contentType: 'time-values'
    }
  },
  {
    filename: 'file5.json',
    metadata: {
      contentFile: 'file5-123456.csv',
      contentSize: 100,
      numberOfElement: 0,
      createdAt: testData.constants.dates.FAKE_NOW,
      contentType: 'any'
    }
  },
  {
    filename: 'file6.json',
    metadata: {
      contentFile: 'file6-123456.json',
      contentSize: 100,
      numberOfElement: 9,
      createdAt: testData.constants.dates.FAKE_NOW,
      contentType: 'time-values'
    }
  }
];

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    service = new CacheService(
      logger,
      mockBaseFolders('northId').cache,
      mockBaseFolders('northId').error,
      mockBaseFolders('northId').archive
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    service.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should be properly initialized with files in cache', async () => {
    (fs.readdir as jest.Mock)
      .mockImplementationOnce(() => ['file1', 'file2', 'bad']) // Cache folder
      .mockImplementationOnce(() => ['file3', 'file4', 'bad']) // Error folder
      .mockImplementationOnce(() => ['file5', 'file6', 'bad']); // Archive folder
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => JSON.stringify(fileList[0].metadata))
      .mockImplementationOnce(() => JSON.stringify(fileList[1].metadata))
      .mockImplementationOnce(() => {
        throw new Error('error 1');
      })
      .mockImplementationOnce(() => JSON.stringify(fileList[2].metadata))
      .mockImplementationOnce(() => JSON.stringify(fileList[3].metadata))
      .mockImplementationOnce(() => {
        throw new Error('error 2');
      })
      .mockImplementationOnce(() => JSON.stringify(fileList[4].metadata))
      .mockImplementationOnce(() => JSON.stringify(fileList[5].metadata))
      .mockImplementationOnce(() => {
        throw new Error('error 3');
      });

    await service.start();

    // Check initial queue sort based on date
    const expectedQueueLength = 2; // Only valid files in 'cache' folder
    expect(service['queue'].length).toBe(expectedQueueLength);
    expect(service.getCacheSize()).toBeGreaterThan(0);

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error while reading cache file'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error while reading errored file'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error while reading archived file'));
    expect(logger.info).toHaveBeenCalledWith(`${expectedQueueLength} content in cache`);
    expect(logger.warn).toHaveBeenCalledWith('3 content errored'); // 2 valid + 1 bad file
    expect(logger.debug).toHaveBeenCalledWith('3 content archived'); // 2 valid + 1 bad file
  });

  it('should set logger', () => {
    const anotherLogger: pino.Logger = new PinoLogger();
    service.setLogger(anotherLogger);
    expect(service['logger']).toBe(anotherLogger);
  });

  it('should not clear timeouts, reset flags, and remove listeners when stopping', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    service['cacheSizeWarningDebounceTimeout'] = null;
    service['cacheLogDebounceTimeout'] = null;
    service['cacheSizeWarningDebounceFlag'] = true;
    service['cacheLogDebounceFlag'] = true;

    const removeAllListenersSpy = jest.spyOn(service.cacheSizeEventEmitter, 'removeAllListeners');

    service.stop();

    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    expect(service['cacheSizeWarningDebounceTimeout']).toBeNull();
    expect(service['cacheLogDebounceTimeout']).toBeNull();
    expect(service['cacheSizeWarningDebounceFlag']).toBe(false);
    expect(service['cacheLogDebounceFlag']).toBe(false);
    expect(removeAllListenersSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('should clear timeouts, reset flags, and remove listeners', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const mockSizeTimeout = setTimeout(() => {
      // Do nothing
    }, 10000);
    const mockLogTimeout = setTimeout(() => {
      // Do nothing
    }, 10000);

    service['cacheSizeWarningDebounceTimeout'] = mockSizeTimeout;
    service['cacheLogDebounceTimeout'] = mockLogTimeout;
    service['cacheSizeWarningDebounceFlag'] = true;
    service['cacheLogDebounceFlag'] = true;

    const removeAllListenersSpy = jest.spyOn(service.cacheSizeEventEmitter, 'removeAllListeners');

    service.stop();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(mockSizeTimeout);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(mockLogTimeout);

    expect(service['cacheSizeWarningDebounceTimeout']).toBeNull();
    expect(service['cacheLogDebounceTimeout']).toBeNull();
    expect(service['cacheSizeWarningDebounceFlag']).toBe(false);
    expect(service['cacheLogDebounceFlag']).toBe(false);
    expect(removeAllListenersSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('should wait for pending updateCache$ and compactQueue$ tasks to resolve', async () => {
    let resolveUpdate: (value: void | PromiseLike<void>) => void;
    const updatePromise = new Promise<void>(resolve => {
      resolveUpdate = resolve;
    });

    service['updateCache$'] = { promise: updatePromise } as DeferredPromise;

    let isFinished = false;
    const waitCall = service['waitCacheUpdateTasks']().then(() => {
      isFinished = true;
    });

    expect(isFinished).toBe(false);
    resolveUpdate!();
    await waitCall;
    expect(isFinished).toBe(true);
  });

  it('should resolve immediately if no tasks are pending', async () => {
    // Setup: Ensure properties are null
    service['updateCache$'] = null;

    // Execute
    await expect(service['waitCacheUpdateTasks']()).resolves.not.toThrow();
  });

  it('should wait for tasks and return null if queue is empty', async () => {
    service['waitCacheUpdateTasks'] = jest.fn();
    service['queue'] = [];

    const result = await service.getCacheContentToSend(100);

    expect(service['waitCacheUpdateTasks']).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should return item directly if content type is "any"', async () => {
    const item = { filename: 'file1.txt', metadata: { contentType: 'any' } as CacheMetadata };
    service['queue'] = [item];
    service['waitCacheUpdateTasks'] = jest.fn();
    service['compactQueue'] = jest.fn();

    const result = await service.getCacheContentToSend(100);

    expect(service['waitCacheUpdateTasks']).toHaveBeenCalled();
    expect(service['compactQueue']).not.toHaveBeenCalled();
    expect(result).toEqual(item);
  });

  it('should compact queue and return item if content type is not "any"', async () => {
    const item = { filename: 'data.json', metadata: { contentType: 'time-values' } as CacheMetadata };
    service['queue'] = [item];

    service['waitCacheUpdateTasks'] = jest.fn();
    service['compactQueue'] = jest.fn();

    const maxGroupCount = 50;
    const result = await service.getCacheContentToSend(maxGroupCount);

    expect(service['waitCacheUpdateTasks']).toHaveBeenCalled();
    expect(service['compactQueue']).toHaveBeenCalledWith(maxGroupCount, 'time-values');
    expect(result).toEqual(item);
  });

  it('should test if cache is empty', () => {
    expect(service.cacheIsEmpty()).toBe(true);
  });

  it('should get cache size', () => {
    expect(service.getCacheSize()).toBe(0);
  });

  it('should test if cache is full ', () => {
    expect(service.cacheIsFull(0)).toBe(false);

    service.getCacheSize = jest
      .fn()
      .mockReturnValueOnce(1024 * 1024)
      .mockReturnValueOnce(1024 * 1024 * 3)
      .mockReturnValueOnce(1024 * 1024 * 3);

    expect(service.cacheIsFull(2)).toBe(false);
    expect(service['cacheSizeWarningDebounceTimeout']).toBeNull();
    expect(service.cacheIsFull(2)).toBe(true);
    expect(service['cacheSizeWarningDebounceTimeout']).not.toBeNull();
    expect(service.cacheIsFull(2)).toBe(true);
    expect(service['cacheSizeWarningDebounceTimeout']).not.toBeNull();
    expect(service['cacheSizeWarningDebounceFlag']).toBeTruthy();
    jest.advanceTimersByTime(60_000);
    expect(service['cacheSizeWarningDebounceFlag']).toBeFalsy();
  });

  it('should be properly initialized without files in cache', async () => {
    (fs.readdir as jest.Mock)
      .mockImplementationOnce(() => [])
      .mockImplementationOnce(() => [])
      .mockImplementationOnce(() => []);

    await service.start();

    expect(logger.debug).toHaveBeenCalledWith('No content in cache');
    expect(logger.debug).toHaveBeenCalledWith('No content errored');
    expect(logger.debug).toHaveBeenCalledWith('No content archived');
  });

  it('should search cache content', async () => {
    // Setup files in folders
    (fs.readdir as jest.Mock)
      .mockReturnValueOnce([fileList[0].filename, fileList[1].filename, 'bad-file']) // cache
      .mockReturnValueOnce([]) // error
      .mockReturnValueOnce([]); // archive

    (fs.readFile as jest.Mock)
      .mockReturnValueOnce(JSON.stringify(fileList[0].metadata))
      .mockReturnValueOnce(JSON.stringify(fileList[0].metadata))
      .mockRejectedValueOnce(new Error('read error'))
      .mockReturnValue('{}');
    const result = await service.searchCacheContent({
      start: testData.constants.dates.DATE_1,
      end: testData.constants.dates.DATE_2,
      nameContains: 'file',
      maxNumberOfFilesReturned: 1000
    });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error while reading file'));
    // Should return files that match date range and name filter
    expect(result.cache.length).toBeGreaterThan(0);
    expect(result.cache[0].filename).toBe(fileList[0].filename);
  });

  it('should search cache content with minimal filters', async () => {
    (fs.readdir as jest.Mock).mockReturnValue([fileList[0].filename]);
    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(fileList[0].metadata));

    const result = await service.searchCacheContent({
      nameContains: undefined,
      start: undefined,
      end: undefined,
      maxNumberOfFilesReturned: 0
    });

    expect(result.cache.length).toBe(1);
  });

  it('should get cache content file stream', async () => {
    (createReadStream as jest.Mock).mockReturnValueOnce(null);
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(fileList[0].metadata));
    (determineContentTypeFromFilename as jest.Mock).mockReturnValueOnce('json');
    const cacheFileContentResult = { content: 'content', truncated: false, contentFilename: 'file1-123456.json' };
    (processCacheFileContent as jest.Mock).mockReturnValueOnce(cacheFileContentResult);
    const result = await service.getFileFromCache('cache', 'test');
    expect(result).toEqual({ ...cacheFileContentResult, totalSize: 100, contentType: 'json' });

    // Test error case
    (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('read error'));
    await expect(service.getFileFromCache('cache', 'test')).rejects.toThrow('Error while reading file');
  });

  it('should not get cache content file stream if bad full path', async () => {
    // This logic relies on path.resolve throwing or fs failure, but path.resolve generally doesn't throw.
    // The implementation checks file existence via readFile/createReadStream.
    // We mock failure directly.
    (fs.readFile as jest.Mock).mockRejectedValue(new Error('Invalid file path'));
    await expect(service.getFileFromCache('error', path.join('..', 'test'))).rejects.toThrow();
  });

  it('should properly add cache content and log state', async () => {
    const output = 'some content';
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.stat as jest.Mock).mockResolvedValue({ size: 1024, ctimeMs: Date.now() });
    (generateRandomId as jest.Mock).mockReturnValue('random');

    await service.addCacheContent(output, { contentType: 'any' });

    expect(fs.writeFile).toHaveBeenCalledTimes(2); // Content + Metadata
    expect(logger.trace).toHaveBeenCalledWith(expect.stringContaining('added to cache'));
    // Verify debounced logging
    expect(logger.debug).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Cache updated'));
  });

  describe('Debounce Logging', () => {
    it('should debounce cache logs', () => {
      const metadata = fileList[0].metadata;

      // First log
      service['logCacheState'](metadata);
      expect(logger.debug).toHaveBeenCalledTimes(1);
      expect(service['cacheLogDebounceFlag']).toBe(true);

      // Second log immediately (should be skipped)
      service['logCacheState'](metadata);
      expect(logger.debug).toHaveBeenCalledTimes(1);

      // Advance timer
      jest.advanceTimersByTime(10000); // DEBOUNCED_LOG_S
      expect(service['cacheLogDebounceFlag']).toBe(false);

      // Third log (should go through)
      service['logCacheState'](metadata);
      expect(logger.debug).toHaveBeenCalledTimes(2);
    });
  });

  it('should check if cache is full and log warning with debounce', () => {
    service['cacheSize'] = { cache: 1024 * 1024 * 100, error: 0, archive: 0 }; // 100MB
    const maxSize = 50; // 50MB

    // First check
    expect(service.cacheIsFull(maxSize)).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('exceeding the maximum allowed size'));
    expect(service['cacheSizeWarningDebounceFlag']).toBe(true);

    // Second check immediately (should return true but NOT log)
    expect(service.cacheIsFull(maxSize)).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);

    // Advance timer
    jest.advanceTimersByTime(60000); // DEBOUNCED_SIZE_WARNING_S
    expect(service['cacheSizeWarningDebounceFlag']).toBe(false);

    // Third check (should log again)
    expect(service.cacheIsFull(maxSize)).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('should update cache content (move/remove)', async () => {
    service['removeContent'] = jest.fn();
    service['moveContent'] = jest.fn();
    const emitEventSpy = jest.spyOn(service.cacheSizeEventEmitter, 'emit');

    const updateCommand = {
      cache: { remove: ['file1'], move: [{ to: 'archive', filename: 'file2' }] },
      error: { remove: ['file3'], move: [{ to: 'archive', filename: 'file4' }] },
      archive: { remove: ['file5'], move: [{ to: 'cache', filename: 'file6' }] }
    } as CacheContentUpdateCommand;

    await service.updateCacheContent(updateCommand);

    expect(service['removeContent']).toHaveBeenCalledTimes(3);
    expect(service['moveContent']).toHaveBeenCalledTimes(3);
    expect(emitEventSpy).toHaveBeenCalled();
  });

  it('should get number of raw files', () => {
    service['queue'] = [
      { filename: 'f1.json', metadata: { ...fileList[0].metadata, numberOfElement: 0 } },
      { filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } },
      { filename: 'f3.json', metadata: { ...fileList[2].metadata, numberOfElement: 1 } }
    ];
    expect(service.getNumberOfRawFilesInQueue()).toEqual(2);
  });

  it('should properly filter files', () => {
    expect(
      service['filterFile'](
        [
          { filename: 'f1.json', metadata: { ...fileList[0].metadata, numberOfElement: 0 } },
          { filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } },
          { filename: 'f3.json', metadata: { ...fileList[2].metadata, numberOfElement: 1 } }
        ],
        { start: testData.constants.dates.DATE_2, end: testData.constants.dates.DATE_2, nameContains: '2', maxNumberOfFilesReturned: 0 }
      )
    ).toEqual([{ filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } }]);

    expect(
      service['filterFile'](
        [
          { filename: 'f1.json', metadata: { ...fileList[0].metadata, numberOfElement: 0 } },
          { filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } },
          { filename: 'f3.json', metadata: { ...fileList[2].metadata, numberOfElement: 1 } }
        ],
        { start: undefined, end: undefined, nameContains: undefined, maxNumberOfFilesReturned: 0 }
      )
    ).toEqual([
      { filename: 'f1.json', metadata: { ...fileList[0].metadata, numberOfElement: 0 } },
      { filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } },
      { filename: 'f3.json', metadata: { ...fileList[2].metadata, numberOfElement: 1 } }
    ]);
  });

  describe('accumulateContent', () => {
    it('should accumulate all content when maxGroupCount is 0', async () => {
      const queueItems = [
        { filename: 'f1.json', metadata: { ...fileList[0].metadata } },
        { filename: 'f2.json', metadata: { ...fileList[1].metadata } }
      ];

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify([{ id: 1 }]))
        .mockResolvedValueOnce(JSON.stringify([{ id: 2 }, { id: 3 }]));

      const result = await service['accumulateContent'](queueItems, 0);

      expect(result.newListOfContent).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.remainder).toEqual([]);
      expect(result.compactedFiles.length).toBe(2);
    });

    it('should split content into main list and remainder when limit is reached', async () => {
      // Setup: Limit 3. File 1 has 2 items, File 2 has 2 items.
      const maxGroupCount = 3;
      const queueItems = [
        { filename: 'f1.json', metadata: { ...fileList[0].metadata } },
        { filename: 'f2.json', metadata: { ...fileList[1].metadata } }
      ];

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify([{ id: 1 }, { id: 2 }]))
        .mockResolvedValueOnce(JSON.stringify([{ id: 3 }, { id: 4 }]));

      const result = await service['accumulateContent'](queueItems, maxGroupCount);

      expect(result.newListOfContent).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]); // First 3
      expect(result.remainder).toEqual([{ id: 4 }]); // The 4th item
      expect(result.compactedFiles.length).toBe(2);
    });

    it('should stop reading files once limit is reached', async () => {
      // Setup: Limit 1. File 1 has 2 items. File 2 should NOT be read.
      const maxGroupCount = 1;
      const queueItems = [
        { filename: 'f1.json', metadata: { ...fileList[0].metadata } },
        { filename: 'f2.json', metadata: { ...fileList[1].metadata } }
      ];

      (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify([{ id: 1 }, { id: 2 }]));

      const result = await service['accumulateContent'](queueItems, maxGroupCount);

      expect(result.newListOfContent).toEqual([{ id: 1 }]);
      expect(result.remainder).toEqual([{ id: 2 }]);
      expect(result.compactedFiles.length).toBe(1); // Only f1 was processed
      expect(fs.readFile).toHaveBeenCalledTimes(1); // f2 was ignored
    });

    it('should handle corrupt files by deleting them and continuing', async () => {
      // Setup: File 1 valid, File 2 corrupt, File 3 valid
      const queueItems = [
        { filename: 'f1.json', metadata: { ...fileList[0].metadata } },
        { filename: 'bad.json', metadata: { ...fileList[1].metadata } },
        { filename: 'f3.json', metadata: { ...fileList[2].metadata } }
      ];

      // Inject queue into service so removeCacheContentFromQueue works
      service['queue'] = [...queueItems];

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify([{ id: 1 }]))
        .mockRejectedValueOnce(new Error('Invalid JSON'))
        .mockResolvedValueOnce(JSON.stringify([{ id: 3 }]));

      service['deleteCacheEntry'] = jest.fn();

      const result = await service['accumulateContent'](queueItems, 0);

      expect(result.newListOfContent).toEqual([{ id: 1 }, { id: 3 }]);
      expect(result.compactedFiles.length).toBe(2); // f1 and f3

      // Verify Error Handling
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error while reading file'));
      expect(service['deleteCacheEntry']).toHaveBeenCalledWith('cache', 'bad.json');
      expect(service['queue'].find(f => f.filename === 'bad.json')).toBeUndefined();
    });
  });

  describe('overwriteCacheFile', () => {
    it('should write content and update metadata in memory', async () => {
      const fileData = {
        filename: 'test.json',
        metadata: { contentSize: 100, numberOfElement: 1, createdAt: '', contentType: 'any', contentFile: 'orig' }
      };
      const newContent = [{ id: 'new' }];
      const newSize = 500;

      service['queue'] = [fileData]; // Put in queue to check in-memory update
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: newSize });

      await service['overwriteCacheFile'](fileData, newContent);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(path.join('content', 'test.json')),
        JSON.stringify(newContent),
        expect.anything()
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(path.join('metadata', 'test.json')),
        expect.stringContaining(`"contentSize":${newSize}`),
        expect.anything()
      );

      expect(fileData.metadata.contentSize).toBe(newSize);
      expect(fileData.metadata.numberOfElement).toBe(1);
    });

    it('should write content and not update metadata in memory if file not found in queue', async () => {
      const fileData = {
        filename: 'test.json',
        metadata: { contentSize: 100, numberOfElement: 1, createdAt: '', contentType: 'any', contentFile: 'orig' }
      };
      const newContent = [{ id: 'new' }];
      const newSize = 500;

      service['queue'] = [{ filename: 'another_file.json', metadata: fileData.metadata }]; // Put in queue a wrong filename
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: newSize });

      await service['overwriteCacheFile'](fileData, newContent);

      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(service['queue']).toEqual([{ filename: 'another_file.json', metadata: fileData.metadata }]);
    });

    it('should handled missing queue element', async () => {
      const fileData = {
        filename: 'test.json',
        metadata: { contentSize: 100, numberOfElement: 1, createdAt: '', contentType: 'any', contentFile: 'orig' }
      };
      const newContent = [{ id: 'new' }];

      service['queue'] = []; // Empty queue
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 500 });

      await expect(service['overwriteCacheFile'](fileData, newContent)).resolves.not.toThrow();
    });
  });

  describe('compactQueue', () => {
    it('should return existing promise if compact is ongoing', async () => {
      let resolveCompact: (value: void | PromiseLike<void>) => void;
      const compactPromise = new Promise<void>(resolve => {
        resolveCompact = resolve;
      });

      service['updateCache$'] = { promise: compactPromise } as DeferredPromise;

      let isFinished = false;
      const waitCall = service['compactQueue'](1, 'time-values').then(() => {
        isFinished = true;
      });

      expect(isFinished).toBe(false);
      resolveCompact!();
      await waitCall;
      expect(isFinished).toBe(true);
    });

    it('should orchestrate accumulation, writing, and cleanup', async () => {
      // Setup: 2 items in queue, merge them into 1
      const item1 = { filename: '1.json', metadata: { contentType: 'typeA' } };
      const item2 = { filename: '2.json', metadata: { contentType: 'typeA' } };
      service['queue'] = [item1, item2] as Array<{ filename: string; metadata: CacheMetadata }>;

      // Mocks for helper methods
      service['accumulateContent'] = jest.fn().mockResolvedValue({
        newListOfContent: [{ a: 1 }, { b: 2 }],
        remainder: [],
        compactedFiles: [item1, item2] // Both processed
      });
      service['overwriteCacheFile'] = jest.fn().mockResolvedValue(undefined);
      service['deleteCacheEntry'] = jest.fn().mockResolvedValue(undefined);

      await service.compactQueue(100, 'typeB'); // nothing to do on this type
      expect(service['overwriteCacheFile']).not.toHaveBeenCalled();
      expect(service['deleteCacheEntry']).not.toHaveBeenCalled();

      await service.compactQueue(100, 'typeA');

      // Verify Flow
      // 1. Accumulate called
      expect(service['accumulateContent']).toHaveBeenCalled();

      // 2. Write Main called with FIRST element (item1)
      expect(service['overwriteCacheFile']).toHaveBeenCalledWith(item1, [{ a: 1 }, { b: 2 }]);

      // 3. Write Remainder NOT called (remainder empty)
      expect(service['overwriteCacheFile']).toHaveBeenCalledTimes(1);

      // 4. Delete intermediate called for BOTH (logic says we clean up intermediate files)
      // Note: Implementation iterates over compactedFiles.
      expect(service['deleteCacheEntry']).toHaveBeenCalledWith('cache', '2.json');

      // 5. Queue updated: should remove '2.json' (intermediate) but keep '1.json' (reused)

      // We need to ensure our mock returns a COPY array if the method mutates it,
      // or we accept that the method mutates the array we provided in the mock.
      expect(service['queue'].length).toBe(1);
      expect(service['queue'][0]).toBe(item1);
    });

    it('should handle remainder by writing to last file', async () => {
      const item1 = { filename: '1.json', metadata: { contentType: 'typeA' } };
      const item2 = { filename: '2.json', metadata: { contentType: 'typeA' } };
      service['queue'] = [item1, item2] as Array<{ filename: string; metadata: CacheMetadata }>;

      service['accumulateContent'] = jest.fn().mockResolvedValue({
        newListOfContent: [{ a: 1 }],
        remainder: [{ b: 2 }],
        compactedFiles: [item1, item2]
      });
      service['overwriteCacheFile'] = jest.fn().mockResolvedValue(undefined);
      service['deleteCacheEntry'] = jest.fn().mockResolvedValue(undefined);

      await service.compactQueue(1, 'typeA');

      // Verify two writes
      expect(service['overwriteCacheFile']).toHaveBeenCalledWith(item1, [{ a: 1 }]); // Main batch -> First file
      expect(service['overwriteCacheFile']).toHaveBeenCalledWith(item2, [{ b: 2 }]); // Remainder -> Last file

      // Queue update: Both should remain in queue because shift() removed item1 and pop() removed item2 from the list to delete
      expect(service['queue'].length).toBe(2);
    });

    it('should orchestrate accumulation with no file compacted', async () => {
      // Setup: 2 items in queue, merge them into 1
      const item1 = { filename: '1.json', metadata: { contentType: 'typeA' } };
      const item2 = { filename: '2.json', metadata: { contentType: 'typeA' } };
      service['queue'] = [item1, item2] as Array<{ filename: string; metadata: CacheMetadata }>;

      // Mocks for helper methods
      service['accumulateContent'] = jest.fn().mockResolvedValue({
        newListOfContent: [],
        remainder: [],
        compactedFiles: []
      });
      service['overwriteCacheFile'] = jest.fn();
      service['deleteCacheEntry'] = jest.fn();

      await service.compactQueue(100, 'typeA');

      expect(service['accumulateContent']).toHaveBeenCalled();
      expect(service['overwriteCacheFile']).not.toHaveBeenCalled();
      expect(service['deleteCacheEntry']).not.toHaveBeenCalledWith();

      expect(service['queue'].length).toBe(2);
      expect(service['queue'][0]).toBe(item1);
      expect(service['queue'][1]).toBe(item2);
    });
  });

  describe('moveContent', () => {
    it('should move content and metadata files and update cache size', async () => {
      // Setup
      const filename = 'file1.json';
      const metadata = { contentSize: 100, numberOfElement: 1, createdAt: '', contentType: 'any', contentFile: 'file' };

      // Inject initial state
      service['queue'] = [{ filename, metadata }];
      service['cacheSize'] = { cache: 100, error: 0, archive: 0 };

      service['readCacheMetadataFile'] = jest.fn().mockResolvedValue(metadata);
      service['removeCacheContentFromQueue'] = jest.fn();
      (fs.rename as jest.Mock).mockResolvedValue(undefined);

      await service['moveContent']('cache', 'archive', filename);

      expect(fs.rename).toHaveBeenCalledTimes(2); // Content + Metadata
      expect(fs.rename).toHaveBeenCalledWith(
        expect.stringContaining(path.join('cache', 'northId', 'content', filename)),
        expect.stringContaining(path.join('archive', 'northId', 'content', filename))
      );

      expect(service['removeCacheContentFromQueue']).toHaveBeenCalledWith(filename);
      expect(service['cacheSize'].cache).toBe(0);
      expect(service['cacheSize'].archive).toBe(100);
      expect(logger.trace).toHaveBeenCalledWith(expect.stringContaining('moved from cache to archive'));
    });

    it('should add to queue if moving TO cache', async () => {
      const filename = 'file2.json';
      const metadata = { contentSize: 50 };
      service['cacheSize'] = { cache: 0, error: 50, archive: 0 };

      service['readCacheMetadataFile'] = jest.fn().mockResolvedValue(metadata);
      (fs.rename as jest.Mock).mockResolvedValue(undefined);

      await service['moveContent']('error', 'cache', filename);

      const queue = service['queue'];
      expect(queue.length).toBe(1);
      expect(queue[0].filename).toBe(filename);
      expect(service['cacheSize'].cache).toBe(50);
    });

    it('should handle errors during move', async () => {
      const filename = 'bad-file.json';
      const metadata = { contentSize: 200 } as CacheMetadata;
      service['readCacheMetadataFile'] = jest.fn().mockResolvedValue(metadata);
      (fs.rename as jest.Mock).mockRejectedValue(new Error('Read Error'));

      await service['moveContent']('cache', 'error', filename);

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error while moving files'));
    });

    it('should handle empty metadata', async () => {
      const filename = 'file.json';

      service['readCacheMetadataFile'] = jest.fn().mockResolvedValue(null);

      await service['moveContent']('cache', 'error', filename);

      expect(fs.rename).not.toHaveBeenCalled();
    });
  });

  describe('removeContent', () => {
    it('should remove content and metadata files and update cache size', async () => {
      // Setup
      const filename = 'file1.json';
      const metadata = { contentSize: 200 } as CacheMetadata;

      // Inject initial state
      service['queue'] = [{ filename, metadata }];
      service['cacheSize'] = { cache: 200, error: 0, archive: 0 };

      service['readCacheMetadataFile'] = jest.fn().mockResolvedValue(metadata);
      service['removeCacheContentFromQueue'] = jest.fn();
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      // Execute: Remove from 'cache'
      await service['removeContent']('cache', filename);

      // Verify FS operations
      expect(fs.rm).toHaveBeenCalledTimes(2); // Content + Metadata
      expect(fs.rm).toHaveBeenCalledWith(expect.stringContaining(path.join('cache', 'northId', 'content', filename)), {
        force: true,
        recursive: true
      });

      // Verify State Updates
      expect(service['removeCacheContentFromQueue']).toHaveBeenCalledWith(filename);
      expect(service['cacheSize'].cache).toBe(0);
      expect(logger.trace).toHaveBeenCalledWith(expect.stringContaining('removed from cache'));
    });

    it('should handle errors during removal', async () => {
      const filename = 'file.json';
      const metadata = { contentSize: 100 };

      service['readCacheMetadataFile'] = jest.fn().mockResolvedValue(metadata);
      service['deleteCacheEntry'] = jest.fn().mockRejectedValue(new Error('Rm Error'));

      await service['removeContent']('archive', filename);

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error while removing file'));
    });

    it('should handle empty metadata', async () => {
      const filename = 'file.json';

      service['readCacheMetadataFile'] = jest.fn().mockResolvedValue(null);
      service['deleteCacheEntry'] = jest.fn();

      await service['removeContent']('archive', filename);

      expect(service['deleteCacheEntry']).not.toHaveBeenCalled();
    });
  });

  it('should delete cache entry', async () => {
    (fs.rm as jest.Mock).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('rm error'));
    await service['deleteCacheEntry']('cache', 'file');

    expect(fs.rm).toHaveBeenCalledTimes(2);
    expect(fs.rm).toHaveBeenCalledWith(path.join(service.cacheFolder, METADATA_FOLDER, 'file'), { recursive: true, force: true });
    expect(fs.rm).toHaveBeenCalledWith(path.join(service.cacheFolder, CONTENT_FOLDER, 'file'), { recursive: true, force: true });
    expect(logger.trace).toHaveBeenCalledWith(`Error deleting cache entry "file": rm error`);
  });

  it('should empty cache', async () => {
    const emitEventSpy = jest.spyOn(service.cacheSizeEventEmitter, 'emit');
    (fs.readdir as jest.Mock)
      .mockImplementationOnce(() => ['file1', 'file2', 'bad']) // Cache folder (metadata)
      .mockImplementationOnce(() => ['file1', 'file2', 'bad']) // Cache folder (content)
      .mockImplementationOnce(() => ['file3', 'file4', 'bad']) // Error folder (metadata)
      .mockImplementationOnce(() => ['file3', 'file4', 'bad']) // Error folder (content)
      .mockImplementationOnce(() => ['file5', 'file6', 'bad']) // Archive folder (metadata)
      .mockImplementationOnce(() => ['file5', 'file6', 'bad']); // Archive folder (content)

    (fs.rm as jest.Mock).mockImplementation((file: string) => {
      if (file.includes('bad')) return Promise.reject(new Error('rm error'));
      return Promise.resolve();
    });
    await service.removeAllCacheContent();

    expect(fs.readdir).toHaveBeenCalledTimes(6);
    expect(fs.rm).toHaveBeenCalledTimes(18);
    expect(logger.error).toHaveBeenCalledTimes(6);
    expect(emitEventSpy).toHaveBeenCalledWith('cache-size', service['cacheSize']);
  });
});
