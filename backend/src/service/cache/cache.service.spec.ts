import { describe, it, beforeEach, afterEach, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';

import { mockBaseFolders } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import type CacheServiceType from './cache.service';
import { CacheContentUpdateCommand, CacheMetadata } from '../../../shared/model/engine.model';
import DeferredPromise from '../deferred-promise';
import { CONTENT_FOLDER, METADATA_FOLDER } from '../../model/engine.model';

const nodeRequire = createRequire(import.meta.url);
let CacheService: typeof CacheServiceType;

let determineContentTypeFromFilenameMock: ReturnType<typeof mock.fn>;
let generateRandomIdMock: ReturnType<typeof mock.fn>;
let processCacheFileContentMock: ReturnType<typeof mock.fn>;

/**
 * Creates a FIFO sequential mock implementation.
 * node:test's mockImplementationOnce only stores one "once" impl (overwrites prior ones),
 * so this helper provides Jest-compatible sequential behaviour.
 */
function seq<T>(...impls: Array<() => T>): () => T {
  let i = 0;
  return () => (i < impls.length ? impls[i++]() : (undefined as unknown as T));
}

before(() => {
  determineContentTypeFromFilenameMock = mock.fn();
  generateRandomIdMock = mock.fn();
  processCacheFileContentMock = mock.fn();

  // Load utils first to warm the cache
  nodeRequire('../utils');
  const utilsPath = nodeRequire.resolve('../utils');
  const origExports = nodeRequire.cache[utilsPath]!.exports;
  // tsx compiles TypeScript ES module exports as non-configurable/non-writable properties,
  // so we must replace the whole exports object to inject mocks.
  nodeRequire.cache[utilsPath]!.exports = Object.assign({}, origExports, {
    determineContentTypeFromFilename: determineContentTypeFromFilenameMock,
    generateRandomId: generateRandomIdMock,
    processCacheFileContent: processCacheFileContentMock
  });

  // Load CacheService fresh with mocked utils
  delete nodeRequire.cache[nodeRequire.resolve('./cache.service')];
  CacheService = nodeRequire('./cache.service').default;
});

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
  let service: CacheServiceType;
  let logger: pino.Logger;

  let readFileMock: ReturnType<typeof mock.fn>;
  let readdirMock: ReturnType<typeof mock.fn>;
  let writeFileMock: ReturnType<typeof mock.fn>;
  let statMock: ReturnType<typeof mock.fn>;
  let renameMock: ReturnType<typeof mock.fn>;
  let rmMock: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    // Recreate utils mocks (clears implementations and call history)
    determineContentTypeFromFilenameMock = mock.fn();
    generateRandomIdMock = mock.fn();
    processCacheFileContentMock = mock.fn();
    // Update live exports so CacheService sees new mocks (replace the whole object since
    // tsx compiles non-configurable properties)
    const utilsPath = nodeRequire.resolve('../utils');
    const prevExports = nodeRequire.cache[utilsPath]!.exports;
    nodeRequire.cache[utilsPath]!.exports = Object.assign({}, prevExports, {
      determineContentTypeFromFilename: determineContentTypeFromFilenameMock,
      generateRandomId: generateRandomIdMock,
      processCacheFileContent: processCacheFileContentMock
    });

    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW).getTime() });

    logger = new PinoLogger() as unknown as pino.Logger;
    service = new CacheService(logger, mockBaseFolders('northId').cache, mockBaseFolders('northId').error, mockBaseFolders('northId').archive);

    readFileMock = mock.fn();
    mock.method(fs, 'readFile', readFileMock);
    readdirMock = mock.fn();
    mock.method(fs, 'readdir', readdirMock);
    writeFileMock = mock.fn();
    mock.method(fs, 'writeFile', writeFileMock);
    statMock = mock.fn();
    mock.method(fs, 'stat', statMock);
    renameMock = mock.fn();
    mock.method(fs, 'rename', renameMock);
    rmMock = mock.fn();
    mock.method(fs, 'rm', rmMock);
  });

  afterEach(() => {
    service.cacheSizeEventEmitter.removeAllListeners();
    mock.restoreAll();
    mock.timers.reset();
  });

  it('should be properly initialized with files in cache', async () => {
    readdirMock.mock.mockImplementation(
      seq(
        async () => ['file1', 'file2', 'bad'], // Cache folder
        async () => ['file3', 'file4', 'bad'], // Error folder
        async () => ['file5', 'file6', 'bad']  // Archive folder
      )
    );
    readFileMock.mock.mockImplementation(
      seq(
        async () => JSON.stringify(fileList[0].metadata),
        async () => JSON.stringify(fileList[1].metadata),
        async () => { throw new Error('error 1'); },
        async () => JSON.stringify(fileList[2].metadata),
        async () => JSON.stringify(fileList[3].metadata),
        async () => { throw new Error('error 2'); },
        async () => JSON.stringify(fileList[4].metadata),
        async () => JSON.stringify(fileList[5].metadata),
        async () => { throw new Error('error 3'); }
      )
    );

    await service.start();

    // Check initial queue sort based on date
    const expectedQueueLength = 2; // Only valid files in 'cache' folder
    assert.strictEqual((service as any)['queue'].length, expectedQueueLength);
    assert.ok(service.getCacheSize() > 0);

    assert.ok((logger.error as any).mock.calls.some((c: any) => String(c.arguments[0]).includes('Error while reading cache file')));
    assert.ok((logger.error as any).mock.calls.some((c: any) => String(c.arguments[0]).includes('Error while reading errored file')));
    assert.ok((logger.error as any).mock.calls.some((c: any) => String(c.arguments[0]).includes('Error while reading archived file')));
    assert.ok((logger.info as any).mock.calls.some((c: any) => c.arguments[0] === `${expectedQueueLength} content in cache`));
    assert.ok((logger.warn as any).mock.calls.some((c: any) => c.arguments[0] === '3 content errored'));
    assert.ok((logger.debug as any).mock.calls.some((c: any) => c.arguments[0] === '3 content archived'));
  });

  it('should set logger', () => {
    const anotherLogger: pino.Logger = new PinoLogger() as unknown as pino.Logger;
    service.setLogger(anotherLogger);
    assert.strictEqual((service as any)['logger'], anotherLogger);
  });

  it('should not clear timeouts, reset flags, and remove listeners when stopping', () => {
    const clearTimeoutMock = mock.method(global, 'clearTimeout', mock.fn());

    (service as any)['cacheSizeWarningDebounceTimeout'] = null;
    (service as any)['cacheLogDebounceTimeout'] = null;
    (service as any)['cacheSizeWarningDebounceFlag'] = true;
    (service as any)['cacheLogDebounceFlag'] = true;

    const removeAllListenersMock = mock.method(service.cacheSizeEventEmitter, 'removeAllListeners', mock.fn());

    service.stop();

    assert.strictEqual(clearTimeoutMock.mock.calls.length, 0);

    assert.strictEqual((service as any)['cacheSizeWarningDebounceTimeout'], null);
    assert.strictEqual((service as any)['cacheLogDebounceTimeout'], null);
    assert.strictEqual((service as any)['cacheSizeWarningDebounceFlag'], false);
    assert.strictEqual((service as any)['cacheLogDebounceFlag'], false);
    assert.ok(removeAllListenersMock.mock.calls.length > 0);
  });

  it('should clear timeouts, reset flags, and remove listeners', () => {
    const clearTimeoutMock = mock.method(global, 'clearTimeout', mock.fn());

    const mockSizeTimeout = setTimeout(() => {
      // Do nothing
    }, 10000);
    const mockLogTimeout = setTimeout(() => {
      // Do nothing
    }, 10000);

    (service as any)['cacheSizeWarningDebounceTimeout'] = mockSizeTimeout;
    (service as any)['cacheLogDebounceTimeout'] = mockLogTimeout;
    (service as any)['cacheSizeWarningDebounceFlag'] = true;
    (service as any)['cacheLogDebounceFlag'] = true;

    const removeAllListenersMock = mock.method(service.cacheSizeEventEmitter, 'removeAllListeners', mock.fn());

    service.stop();

    assert.ok(clearTimeoutMock.mock.calls.some((c: any) => c.arguments[0] === mockSizeTimeout));
    assert.ok(clearTimeoutMock.mock.calls.some((c: any) => c.arguments[0] === mockLogTimeout));

    assert.strictEqual((service as any)['cacheSizeWarningDebounceTimeout'], null);
    assert.strictEqual((service as any)['cacheLogDebounceTimeout'], null);
    assert.strictEqual((service as any)['cacheSizeWarningDebounceFlag'], false);
    assert.strictEqual((service as any)['cacheLogDebounceFlag'], false);
    assert.ok(removeAllListenersMock.mock.calls.length > 0);
  });

  it('should wait for pending updateCache$ and compactQueue$ tasks to resolve', async () => {
    let resolveUpdate: (value: void | PromiseLike<void>) => void;
    const updatePromise = new Promise<void>(resolve => {
      resolveUpdate = resolve;
    });

    (service as any)['updateCache$'] = { promise: updatePromise } as DeferredPromise;

    let isFinished = false;
    const waitCall = (service as any)['waitCacheUpdateTasks']().then(() => {
      isFinished = true;
    });

    assert.strictEqual(isFinished, false);
    resolveUpdate!();
    await waitCall;
    assert.strictEqual(isFinished, true);
  });

  it('should resolve immediately if no tasks are pending', async () => {
    // Setup: Ensure properties are null
    (service as any)['updateCache$'] = null;

    // Execute
    await assert.doesNotReject((service as any)['waitCacheUpdateTasks']());
  });

  it('should wait for tasks and return null if queue is empty', async () => {
    (service as any)['waitCacheUpdateTasks'] = mock.fn();
    (service as any)['queue'] = [];

    const result = await service.getCacheContentToSend(100);

    assert.ok((service as any)['waitCacheUpdateTasks'].mock.calls.length > 0);
    assert.strictEqual(result, null);
  });

  it('should return item directly if content type is "any"', async () => {
    const item = { filename: 'file1.txt', metadata: { contentType: 'any' } as CacheMetadata };
    (service as any)['queue'] = [item];
    (service as any)['waitCacheUpdateTasks'] = mock.fn();
    (service as any)['compactQueue'] = mock.fn();

    const result = await service.getCacheContentToSend(100);

    assert.ok((service as any)['waitCacheUpdateTasks'].mock.calls.length > 0);
    assert.strictEqual((service as any)['compactQueue'].mock.calls.length, 0);
    assert.deepStrictEqual(result, item);
  });

  it('should compact queue and return item if content type is not "any"', async () => {
    const item = { filename: 'data.json', metadata: { contentType: 'time-values' } as CacheMetadata };
    (service as any)['queue'] = [item];

    (service as any)['waitCacheUpdateTasks'] = mock.fn();
    (service as any)['compactQueue'] = mock.fn();

    const maxGroupCount = 50;
    const result = await service.getCacheContentToSend(maxGroupCount);

    assert.ok((service as any)['waitCacheUpdateTasks'].mock.calls.length > 0);
    assert.deepStrictEqual((service as any)['compactQueue'].mock.calls[0].arguments, [maxGroupCount, 'time-values']);
    assert.deepStrictEqual(result, item);
  });

  it('should test if cache is empty', () => {
    assert.strictEqual(service.cacheIsEmpty(), true);
  });

  it('should get cache size', () => {
    assert.strictEqual(service.getCacheSize(), 0);
  });

  it('should test if cache is full ', () => {
    assert.strictEqual(service.cacheIsFull(0), false);

    (service as any).getCacheSize = mock.fn(
      seq(
        () => 1024 * 1024,
        () => 1024 * 1024 * 3,
        () => 1024 * 1024 * 3
      )
    );

    assert.strictEqual(service.cacheIsFull(2), false);
    assert.strictEqual((service as any)['cacheSizeWarningDebounceTimeout'], null);
    assert.strictEqual(service.cacheIsFull(2), true);
    assert.notStrictEqual((service as any)['cacheSizeWarningDebounceTimeout'], null);
    assert.strictEqual(service.cacheIsFull(2), true);
    assert.notStrictEqual((service as any)['cacheSizeWarningDebounceTimeout'], null);
    assert.ok((service as any)['cacheSizeWarningDebounceFlag']);
    mock.timers.tick(60_000);
    assert.ok(!(service as any)['cacheSizeWarningDebounceFlag']);
  });

  it('should be properly initialized without files in cache', async () => {
    readdirMock.mock.mockImplementation(
      seq(
        async () => [], // Cache folder
        async () => [], // Error folder
        async () => []  // Archive folder
      )
    );

    await service.start();

    assert.ok((logger.debug as any).mock.calls.some((c: any) => c.arguments[0] === 'No content in cache'));
    assert.ok((logger.debug as any).mock.calls.some((c: any) => c.arguments[0] === 'No content errored'));
    assert.ok((logger.debug as any).mock.calls.some((c: any) => c.arguments[0] === 'No content archived'));
  });

  it('should search cache content', async () => {
    // start() calls readdir 3 times (cache, error, archive metadata folders)
    // then searchCacheContent calls readdir 3 times again (cache, error, archive metadata folders)
    // Setup: cache has 2 valid files + 1 bad; error/archive empty
    readdirMock.mock.mockImplementation(
      seq(
        async () => [fileList[0].filename, fileList[1].filename, 'bad-file'], // start() cache
        async () => [], // start() error
        async () => [], // start() archive
        async () => [fileList[0].filename, fileList[1].filename, 'bad-file'], // searchCacheContent cache
        async () => [], // searchCacheContent error
        async () => []  // searchCacheContent archive
      )
    );

    readFileMock.mock.mockImplementation(
      seq(
        // start() reads file1, file2, bad-file (throws) in cache folder
        async () => JSON.stringify(fileList[0].metadata),
        async () => JSON.stringify(fileList[1].metadata),
        async () => { throw new Error('cache read error'); },
        // searchCacheContent reads file1 (match), file2 (no match or match), bad-file (error)
        async () => JSON.stringify(fileList[0].metadata),
        async () => JSON.stringify(fileList[0].metadata),
        async () => { throw new Error('read error'); }
      )
    );

    const result = await service.searchCacheContent({
      start: testData.constants.dates.DATE_1,
      end: testData.constants.dates.DATE_2,
      nameContains: 'file',
      maxNumberOfFilesReturned: 1000
    });

    assert.ok((logger.error as any).mock.calls.some((c: any) => String(c.arguments[0]).includes('Error while reading file')));
    // Should return files that match date range and name filter
    assert.ok(result.cache.length > 0);
    assert.strictEqual(result.cache[0].filename, fileList[0].filename);
  });

  it('should search cache content with minimal filters', async () => {
    readdirMock.mock.mockImplementation(async () => [fileList[0].filename]);
    readFileMock.mock.mockImplementation(async () => JSON.stringify(fileList[0].metadata));

    const result = await service.searchCacheContent({
      nameContains: undefined,
      start: undefined,
      end: undefined,
      maxNumberOfFilesReturned: 0
    });

    assert.strictEqual(result.cache.length, 1);
  });

  it('should get cache content file stream', async () => {
    // Use nodeRequire to get the CJS-style fs module where createReadStream is configurable
    const fsSync = nodeRequire('node:fs');
    mock.method(fsSync, 'createReadStream', mock.fn(() => null));
    readFileMock.mock.mockImplementation(async () => JSON.stringify(fileList[0].metadata));
    determineContentTypeFromFilenameMock.mock.mockImplementation(() => 'json');
    const cacheFileContentResult = { content: 'content', truncated: false, contentFilename: 'file1-123456.json' };
    processCacheFileContentMock.mock.mockImplementation(
      seq(
        () => cacheFileContentResult,
        () => { throw new Error('should not be called twice'); }
      )
    );
    const result = await service.getFileFromCache('cache', 'test');
    assert.deepStrictEqual(result, { ...cacheFileContentResult, totalSize: 100, contentType: 'json' });

    // Test error case
    readFileMock.mock.mockImplementation(
      seq(
        async () => { throw new Error('read error'); }
      )
    );
    await assert.rejects(service.getFileFromCache('cache', 'test'), /Error while reading file/);
  });

  it('should not get cache content file stream if bad full path', async () => {
    readFileMock.mock.mockImplementation(async () => { throw new Error('Invalid file path'); });
    await assert.rejects(service.getFileFromCache('error', path.join('..', 'test')));
  });

  it('should properly add cache content and log state', async () => {
    const output = 'some content';
    writeFileMock.mock.mockImplementation(async () => undefined);
    statMock.mock.mockImplementation(async () => ({ size: 1024, ctimeMs: Date.now() }));
    generateRandomIdMock.mock.mockImplementation(() => 'random');

    await service.addCacheContent(output, { contentType: 'any' });

    assert.strictEqual(writeFileMock.mock.calls.length, 2); // Content + Metadata
    assert.ok((logger.trace as any).mock.calls.some((c: any) => String(c.arguments[0]).includes('added to cache')));
    // Verify debounced logging
    assert.ok(
      (logger.debug as any).mock.calls.some((c: any) =>
        c.arguments.length > 1 && String(c.arguments[1]).includes('Cache updated')
      )
    );
  });

  describe('Debounce Logging', () => {
    it('should debounce cache logs', () => {
      const metadata = fileList[0].metadata;

      // First log
      (service as any)['logCacheState'](metadata);
      assert.strictEqual((logger.debug as any).mock.calls.length, 1);
      assert.strictEqual((service as any)['cacheLogDebounceFlag'], true);

      // Second log immediately (should be skipped)
      (service as any)['logCacheState'](metadata);
      assert.strictEqual((logger.debug as any).mock.calls.length, 1);

      // Advance timer
      mock.timers.tick(10000); // DEBOUNCED_LOG_S
      assert.strictEqual((service as any)['cacheLogDebounceFlag'], false);

      // Third log (should go through)
      (service as any)['logCacheState'](metadata);
      assert.strictEqual((logger.debug as any).mock.calls.length, 2);
    });
  });

  it('should check if cache is full and log warning with debounce', () => {
    (service as any)['cacheSize'] = { cache: 1024 * 1024 * 100, error: 0, archive: 0 }; // 100MB
    const maxSize = 50; // 50MB

    // First check
    assert.strictEqual(service.cacheIsFull(maxSize), true);
    assert.ok((logger.warn as any).mock.calls.some((c: any) => String(c.arguments[0]).includes('exceeding the maximum allowed size')));
    assert.strictEqual((service as any)['cacheSizeWarningDebounceFlag'], true);

    // Second check immediately (should return true but NOT log)
    assert.strictEqual(service.cacheIsFull(maxSize), true);
    assert.strictEqual((logger.warn as any).mock.calls.length, 1);

    // Advance timer
    mock.timers.tick(60000); // DEBOUNCED_SIZE_WARNING_S
    assert.strictEqual((service as any)['cacheSizeWarningDebounceFlag'], false);

    // Third check (should log again)
    assert.strictEqual(service.cacheIsFull(maxSize), true);
    assert.strictEqual((logger.warn as any).mock.calls.length, 2);
  });

  it('should update cache content (move/remove)', async () => {
    (service as any)['removeContent'] = mock.fn();
    (service as any)['moveContent'] = mock.fn();
    const emitEventMock = mock.method(service.cacheSizeEventEmitter, 'emit', mock.fn());

    const updateCommand = {
      cache: { remove: ['file1'], move: [{ to: 'archive', filename: 'file2' }] },
      error: { remove: ['file3'], move: [{ to: 'archive', filename: 'file4' }] },
      archive: { remove: ['file5'], move: [{ to: 'cache', filename: 'file6' }] }
    } as CacheContentUpdateCommand;

    await service.updateCacheContent(updateCommand);

    assert.strictEqual((service as any)['removeContent'].mock.calls.length, 3);
    assert.strictEqual((service as any)['moveContent'].mock.calls.length, 3);
    assert.ok(emitEventMock.mock.calls.length > 0);
  });

  it('should get number of raw files', () => {
    (service as any)['queue'] = [
      { filename: 'f1.json', metadata: { ...fileList[0].metadata, numberOfElement: 0 } },
      { filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } },
      { filename: 'f3.json', metadata: { ...fileList[2].metadata, numberOfElement: 1 } }
    ];
    assert.strictEqual(service.getNumberOfRawFilesInQueue(), 2);
  });

  it('should properly filter files', () => {
    assert.deepStrictEqual(
      (service as any)['filterFile'](
        [
          { filename: 'f1.json', metadata: { ...fileList[0].metadata, numberOfElement: 0 } },
          { filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } },
          { filename: 'f3.json', metadata: { ...fileList[2].metadata, numberOfElement: 1 } }
        ],
        { start: testData.constants.dates.DATE_2, end: testData.constants.dates.DATE_2, nameContains: '2', maxNumberOfFilesReturned: 0 }
      ),
      [{ filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } }]
    );

    assert.deepStrictEqual(
      (service as any)['filterFile'](
        [
          { filename: 'f1.json', metadata: { ...fileList[0].metadata, numberOfElement: 0 } },
          { filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } },
          { filename: 'f3.json', metadata: { ...fileList[2].metadata, numberOfElement: 1 } }
        ],
        { start: undefined, end: undefined, nameContains: undefined, maxNumberOfFilesReturned: 0 }
      ),
      [
        { filename: 'f1.json', metadata: { ...fileList[0].metadata, numberOfElement: 0 } },
        { filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } },
        { filename: 'f3.json', metadata: { ...fileList[2].metadata, numberOfElement: 1 } }
      ]
    );
  });

  describe('accumulateContent', () => {
    it('should accumulate all content when maxGroupCount is 0', async () => {
      const queueItems = [
        { filename: 'f1.json', metadata: { ...fileList[0].metadata } },
        { filename: 'f2.json', metadata: { ...fileList[1].metadata } }
      ];

      readFileMock.mock.mockImplementation(
        seq(
          async () => JSON.stringify([{ id: 1 }]),
          async () => JSON.stringify([{ id: 2 }, { id: 3 }])
        )
      );

      const result = await (service as any)['accumulateContent'](queueItems, 0);

      assert.deepStrictEqual(result.newListOfContent, [{ id: 1 }, { id: 2 }, { id: 3 }]);
      assert.deepStrictEqual(result.remainder, []);
      assert.strictEqual(result.compactedFiles.length, 2);
    });

    it('should split content into main list and remainder when limit is reached', async () => {
      // Setup: Limit 3. File 1 has 2 items, File 2 has 2 items.
      const maxGroupCount = 3;
      const queueItems = [
        { filename: 'f1.json', metadata: { ...fileList[0].metadata } },
        { filename: 'f2.json', metadata: { ...fileList[1].metadata } }
      ];

      readFileMock.mock.mockImplementation(
        seq(
          async () => JSON.stringify([{ id: 1 }, { id: 2 }]),
          async () => JSON.stringify([{ id: 3 }, { id: 4 }])
        )
      );

      const result = await (service as any)['accumulateContent'](queueItems, maxGroupCount);

      assert.deepStrictEqual(result.newListOfContent, [{ id: 1 }, { id: 2 }, { id: 3 }]); // First 3
      assert.deepStrictEqual(result.remainder, [{ id: 4 }]); // The 4th item
      assert.strictEqual(result.compactedFiles.length, 2);
    });

    it('should stop reading files once limit is reached', async () => {
      // Setup: Limit 1. File 1 has 2 items. File 2 should NOT be read.
      const maxGroupCount = 1;
      const queueItems = [
        { filename: 'f1.json', metadata: { ...fileList[0].metadata } },
        { filename: 'f2.json', metadata: { ...fileList[1].metadata } }
      ];

      readFileMock.mock.mockImplementation(
        seq(
          async () => JSON.stringify([{ id: 1 }, { id: 2 }])
        )
      );

      const result = await (service as any)['accumulateContent'](queueItems, maxGroupCount);

      assert.deepStrictEqual(result.newListOfContent, [{ id: 1 }]);
      assert.deepStrictEqual(result.remainder, [{ id: 2 }]);
      assert.strictEqual(result.compactedFiles.length, 1); // Only f1 was processed
      assert.strictEqual(readFileMock.mock.calls.length, 1); // f2 was ignored
    });

    it('should handle corrupt files by deleting them and continuing', async () => {
      // Setup: File 1 valid, File 2 corrupt, File 3 valid
      const queueItems = [
        { filename: 'f1.json', metadata: { ...fileList[0].metadata } },
        { filename: 'bad.json', metadata: { ...fileList[1].metadata } },
        { filename: 'f3.json', metadata: { ...fileList[2].metadata } }
      ];

      // Inject queue into service so removeCacheContentFromQueue works
      (service as any)['queue'] = [...queueItems];

      readFileMock.mock.mockImplementation(
        seq(
          async () => JSON.stringify([{ id: 1 }]),
          async () => { throw new Error('Invalid JSON'); },
          async () => JSON.stringify([{ id: 3 }])
        )
      );

      (service as any)['deleteCacheEntry'] = mock.fn();

      const result = await (service as any)['accumulateContent'](queueItems, 0);

      assert.deepStrictEqual(result.newListOfContent, [{ id: 1 }, { id: 3 }]);
      assert.strictEqual(result.compactedFiles.length, 2); // f1 and f3

      // Verify Error Handling
      assert.ok((logger.error as any).mock.calls.some((c: any) => String(c.arguments[0]).includes('Error while reading file')));
      assert.deepStrictEqual((service as any)['deleteCacheEntry'].mock.calls[0].arguments, ['cache', 'bad.json']);
      assert.strictEqual((service as any)['queue'].find((f: any) => f.filename === 'bad.json'), undefined);
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

      (service as any)['queue'] = [fileData]; // Put in queue to check in-memory update
      writeFileMock.mock.mockImplementation(async () => undefined);
      statMock.mock.mockImplementation(async () => ({ size: newSize }));

      await (service as any)['overwriteCacheFile'](fileData, newContent);

      assert.ok(
        writeFileMock.mock.calls.some((c: any) =>
          String(c.arguments[0]).includes(path.join('content', 'test.json'))
        )
      );

      assert.ok(
        writeFileMock.mock.calls.some((c: any) =>
          String(c.arguments[0]).includes(path.join('metadata', 'test.json')) &&
          String(c.arguments[1]).includes(`"contentSize":${newSize}`)
        )
      );

      assert.strictEqual(fileData.metadata.contentSize, newSize);
      assert.strictEqual(fileData.metadata.numberOfElement, 1);
    });

    it('should write content and not update metadata in memory if file not found in queue', async () => {
      const fileData = {
        filename: 'test.json',
        metadata: { contentSize: 100, numberOfElement: 1, createdAt: '', contentType: 'any', contentFile: 'orig' }
      };
      const newContent = [{ id: 'new' }];
      const newSize = 500;

      (service as any)['queue'] = [{ filename: 'another_file.json', metadata: fileData.metadata }]; // Put in queue a wrong filename
      writeFileMock.mock.mockImplementation(async () => undefined);
      statMock.mock.mockImplementation(async () => ({ size: newSize }));

      await (service as any)['overwriteCacheFile'](fileData, newContent);

      assert.strictEqual(writeFileMock.mock.calls.length, 2);
      assert.deepStrictEqual((service as any)['queue'], [{ filename: 'another_file.json', metadata: fileData.metadata }]);
    });

    it('should handled missing queue element', async () => {
      const fileData = {
        filename: 'test.json',
        metadata: { contentSize: 100, numberOfElement: 1, createdAt: '', contentType: 'any', contentFile: 'orig' }
      };
      const newContent = [{ id: 'new' }];

      (service as any)['queue'] = []; // Empty queue
      writeFileMock.mock.mockImplementation(async () => undefined);
      statMock.mock.mockImplementation(async () => ({ size: 500 }));

      await assert.doesNotReject((service as any)['overwriteCacheFile'](fileData, newContent));
    });
  });

  describe('compactQueue', () => {
    it('should return existing promise if compact is ongoing', async () => {
      let resolveCompact: (value: void | PromiseLike<void>) => void;
      const compactPromise = new Promise<void>(resolve => {
        resolveCompact = resolve;
      });

      (service as any)['updateCache$'] = { promise: compactPromise } as DeferredPromise;

      let isFinished = false;
      const waitCall = (service as any)['compactQueue'](1, 'time-values').then(() => {
        isFinished = true;
      });

      assert.strictEqual(isFinished, false);
      resolveCompact!();
      await waitCall;
      assert.strictEqual(isFinished, true);
    });

    it('should orchestrate accumulation, writing, and cleanup', async () => {
      // Setup: 2 items in queue, merge them into 1
      const item1 = { filename: '1.json', metadata: { contentType: 'typeA' } };
      const item2 = { filename: '2.json', metadata: { contentType: 'typeA' } };
      (service as any)['queue'] = [item1, item2] as Array<{ filename: string; metadata: CacheMetadata }>;

      // Mocks for helper methods
      (service as any)['accumulateContent'] = mock.fn(async () => ({
        newListOfContent: [{ a: 1 }, { b: 2 }],
        remainder: [],
        compactedFiles: [item1, item2] // Both processed
      }));
      (service as any)['overwriteCacheFile'] = mock.fn(async () => undefined);
      (service as any)['deleteCacheEntry'] = mock.fn(async () => undefined);

      await service.compactQueue(100, 'typeB'); // nothing to do on this type
      assert.strictEqual((service as any)['overwriteCacheFile'].mock.calls.length, 0);
      assert.strictEqual((service as any)['deleteCacheEntry'].mock.calls.length, 0);

      await service.compactQueue(100, 'typeA');

      // Verify Flow
      // 1. Accumulate called
      assert.ok((service as any)['accumulateContent'].mock.calls.length > 0);

      // 2. Write Main called with FIRST element (item1)
      assert.deepStrictEqual((service as any)['overwriteCacheFile'].mock.calls[0].arguments, [item1, [{ a: 1 }, { b: 2 }]]);

      // 3. Write Remainder NOT called (remainder empty)
      assert.strictEqual((service as any)['overwriteCacheFile'].mock.calls.length, 1);

      // 4. Delete intermediate called for BOTH (logic says we clean up intermediate files)
      assert.ok(
        (service as any)['deleteCacheEntry'].mock.calls.some((c: any) =>
          c.arguments[0] === 'cache' && c.arguments[1] === '2.json'
        )
      );

      // 5. Queue updated: should remove '2.json' (intermediate) but keep '1.json' (reused)
      assert.strictEqual((service as any)['queue'].length, 1);
      assert.strictEqual((service as any)['queue'][0], item1);
    });

    it('should handle remainder by writing to last file', async () => {
      const item1 = { filename: '1.json', metadata: { contentType: 'typeA' } };
      const item2 = { filename: '2.json', metadata: { contentType: 'typeA' } };
      (service as any)['queue'] = [item1, item2] as Array<{ filename: string; metadata: CacheMetadata }>;

      (service as any)['accumulateContent'] = mock.fn(async () => ({
        newListOfContent: [{ a: 1 }],
        remainder: [{ b: 2 }],
        compactedFiles: [item1, item2]
      }));
      (service as any)['overwriteCacheFile'] = mock.fn(async () => undefined);
      (service as any)['deleteCacheEntry'] = mock.fn(async () => undefined);

      await service.compactQueue(1, 'typeA');

      // Verify two writes
      assert.deepStrictEqual((service as any)['overwriteCacheFile'].mock.calls[0].arguments, [item1, [{ a: 1 }]]); // Main batch -> First file
      assert.deepStrictEqual((service as any)['overwriteCacheFile'].mock.calls[1].arguments, [item2, [{ b: 2 }]]); // Remainder -> Last file

      // Queue update: Both should remain in queue because shift() removed item1 and pop() removed item2 from the list to delete
      assert.strictEqual((service as any)['queue'].length, 2);
    });

    it('should orchestrate accumulation with no file compacted', async () => {
      // Setup: 2 items in queue, merge them into 1
      const item1 = { filename: '1.json', metadata: { contentType: 'typeA' } };
      const item2 = { filename: '2.json', metadata: { contentType: 'typeA' } };
      (service as any)['queue'] = [item1, item2] as Array<{ filename: string; metadata: CacheMetadata }>;

      // Mocks for helper methods
      (service as any)['accumulateContent'] = mock.fn(async () => ({
        newListOfContent: [],
        remainder: [],
        compactedFiles: []
      }));
      (service as any)['overwriteCacheFile'] = mock.fn();
      (service as any)['deleteCacheEntry'] = mock.fn();

      await service.compactQueue(100, 'typeA');

      assert.ok((service as any)['accumulateContent'].mock.calls.length > 0);
      assert.strictEqual((service as any)['overwriteCacheFile'].mock.calls.length, 0);
      assert.strictEqual((service as any)['deleteCacheEntry'].mock.calls.length, 0);

      assert.strictEqual((service as any)['queue'].length, 2);
      assert.strictEqual((service as any)['queue'][0], item1);
      assert.strictEqual((service as any)['queue'][1], item2);
    });
  });

  describe('moveContent', () => {
    it('should move content and metadata files and update cache size', async () => {
      // Setup
      const filename = 'file1.json';
      const metadata = { contentSize: 100, numberOfElement: 1, createdAt: '', contentType: 'any', contentFile: 'file' };

      // Inject initial state
      (service as any)['queue'] = [{ filename, metadata }];
      (service as any)['cacheSize'] = { cache: 100, error: 0, archive: 0 };

      (service as any)['readCacheMetadataFile'] = mock.fn(async () => metadata);
      (service as any)['removeCacheContentFromQueue'] = mock.fn();
      renameMock.mock.mockImplementation(async () => undefined);

      await (service as any)['moveContent']('cache', 'archive', filename);

      assert.strictEqual(renameMock.mock.calls.length, 2); // Content + Metadata
      assert.ok(
        renameMock.mock.calls.some((c: any) =>
          String(c.arguments[0]).includes(path.join('cache', 'northId', 'content', filename)) &&
          String(c.arguments[1]).includes(path.join('archive', 'northId', 'content', filename))
        )
      );

      assert.ok((service as any)['removeCacheContentFromQueue'].mock.calls.some((c: any) => c.arguments[0] === filename));
      assert.strictEqual((service as any)['cacheSize'].cache, 0);
      assert.strictEqual((service as any)['cacheSize'].archive, 100);
      assert.ok((logger.trace as any).mock.calls.some((c: any) => String(c.arguments[0]).includes('moved from cache to archive')));
    });

    it('should add to queue if moving TO cache', async () => {
      const filename = 'file2.json';
      const metadata = { contentSize: 50 };
      (service as any)['cacheSize'] = { cache: 0, error: 50, archive: 0 };

      (service as any)['readCacheMetadataFile'] = mock.fn(async () => metadata);
      renameMock.mock.mockImplementation(async () => undefined);

      await (service as any)['moveContent']('error', 'cache', filename);

      const queue = (service as any)['queue'];
      assert.strictEqual(queue.length, 1);
      assert.strictEqual(queue[0].filename, filename);
      assert.strictEqual((service as any)['cacheSize'].cache, 50);
    });

    it('should handle errors during move', async () => {
      const filename = 'bad-file.json';
      const metadata = { contentSize: 200 } as CacheMetadata;
      (service as any)['readCacheMetadataFile'] = mock.fn(async () => metadata);
      renameMock.mock.mockImplementation(async () => { throw new Error('Read Error'); });

      await (service as any)['moveContent']('cache', 'error', filename);

      assert.ok((logger.error as any).mock.calls.some((c: any) => String(c.arguments[0]).includes('Error while moving files')));
    });

    it('should handle empty metadata', async () => {
      const filename = 'file.json';

      (service as any)['readCacheMetadataFile'] = mock.fn(async () => null);

      await (service as any)['moveContent']('cache', 'error', filename);

      assert.strictEqual(renameMock.mock.calls.length, 0);
    });
  });

  describe('removeContent', () => {
    it('should remove content and metadata files and update cache size', async () => {
      // Setup
      const filename = 'file1.json';
      const metadata = { contentSize: 200 } as CacheMetadata;

      // Inject initial state
      (service as any)['queue'] = [{ filename, metadata }];
      (service as any)['cacheSize'] = { cache: 200, error: 0, archive: 0 };

      (service as any)['readCacheMetadataFile'] = mock.fn(async () => metadata);
      (service as any)['removeCacheContentFromQueue'] = mock.fn();

      // Execute: Remove from 'cache'
      await (service as any)['removeContent']('cache', filename);

      // Verify FS operations
      assert.strictEqual(rmMock.mock.calls.length, 2); // Content + Metadata
      assert.ok(
        rmMock.mock.calls.some((c: any) =>
          String(c.arguments[0]).includes(path.join('cache', 'northId', 'content', filename)) &&
          c.arguments[1]?.force === true &&
          c.arguments[1]?.recursive === true
        )
      );

      // Verify State Updates
      assert.ok((service as any)['removeCacheContentFromQueue'].mock.calls.some((c: any) => c.arguments[0] === filename));
      assert.strictEqual((service as any)['cacheSize'].cache, 0);
      assert.ok((logger.trace as any).mock.calls.some((c: any) => String(c.arguments[0]).includes('removed from cache')));
    });

    it('should handle errors during removal', async () => {
      const filename = 'file.json';
      const metadata = { contentSize: 100 };

      (service as any)['readCacheMetadataFile'] = mock.fn(async () => metadata);
      (service as any)['deleteCacheEntry'] = mock.fn(async () => { throw new Error('Rm Error'); });

      await (service as any)['removeContent']('archive', filename);

      assert.ok((logger.error as any).mock.calls.some((c: any) => String(c.arguments[0]).includes('Error while removing file')));
    });

    it('should handle empty metadata', async () => {
      const filename = 'file.json';

      (service as any)['readCacheMetadataFile'] = mock.fn(async () => null);
      (service as any)['deleteCacheEntry'] = mock.fn();

      await (service as any)['removeContent']('archive', filename);

      assert.strictEqual((service as any)['deleteCacheEntry'].mock.calls.length, 0);
    });
  });

  it('should delete cache entry', async () => {
    rmMock.mock.mockImplementation(
      seq(
        async () => undefined,
        async () => { throw new Error('rm error'); }
      )
    );
    await (service as any)['deleteCacheEntry']('cache', 'file');

    assert.strictEqual(rmMock.mock.calls.length, 2);
    assert.ok(
      rmMock.mock.calls.some((c: any) =>
        c.arguments[0] === path.join(service.cacheFolder, METADATA_FOLDER, 'file') &&
        c.arguments[1]?.recursive === true &&
        c.arguments[1]?.force === true
      )
    );
    assert.ok(
      rmMock.mock.calls.some((c: any) =>
        c.arguments[0] === path.join(service.cacheFolder, CONTENT_FOLDER, 'file') &&
        c.arguments[1]?.recursive === true &&
        c.arguments[1]?.force === true
      )
    );
    assert.ok((logger.trace as any).mock.calls.some((c: any) => c.arguments[0] === `Error deleting cache entry "file": rm error`));
  });

  it('should empty cache', async () => {
    const emitEventMock = mock.method(service.cacheSizeEventEmitter, 'emit', mock.fn());
    readdirMock.mock.mockImplementation(
      seq(
        async () => ['file1', 'file2', 'bad'], // Cache folder (metadata)
        async () => ['file1', 'file2', 'bad'], // Cache folder (content)
        async () => ['file3', 'file4', 'bad'], // Error folder (metadata)
        async () => ['file3', 'file4', 'bad'], // Error folder (content)
        async () => ['file5', 'file6', 'bad'], // Archive folder (metadata)
        async () => ['file5', 'file6', 'bad']  // Archive folder (content)
      )
    );

    rmMock.mock.mockImplementation(async (file: string) => {
      if (file.includes('bad')) throw new Error('rm error');
    });
    await service.removeAllCacheContent();

    assert.strictEqual(readdirMock.mock.calls.length, 6);
    assert.strictEqual(rmMock.mock.calls.length, 18);
    assert.strictEqual((logger.error as any).mock.calls.length, 6);
    assert.ok(emitEventMock.mock.calls.some((c: any) => c.arguments[0] === 'cache-size'));
  });
});
