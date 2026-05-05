import { describe, it, beforeEach, afterEach, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
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

// Holds the mutable exports object injected into cache.service at load time.
let utilsExports: Record<string, unknown>;

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
  // We capture the new object so beforeEach can mutate it in-place (not replace it),
  // keeping cache.service's import_utils binding valid across tests.
  utilsExports = Object.assign({}, origExports, {
    determineContentTypeFromFilename: determineContentTypeFromFilenameMock,
    generateRandomId: generateRandomIdMock,
    processCacheFileContent: processCacheFileContentMock
  });
  nodeRequire.cache[utilsPath]!.exports = utilsExports;

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
  let logger: PinoLogger;

  let readFileMock: ReturnType<typeof mock.fn>;
  let readdirMock: ReturnType<typeof mock.fn>;
  let writeFileMock: ReturnType<typeof mock.fn>;
  let statMock: ReturnType<typeof mock.fn>;
  let renameMock: ReturnType<typeof mock.fn>;
  let rmMock: ReturnType<typeof mock.fn>;

  /** Cast service to a plain record for accessing private fields. */
  const priv = () => service as unknown as Record<string, unknown>;
  /** Cast a private field value to a mock function for .mock.calls access. */
  const privMock = (key: string) => priv()[key] as ReturnType<typeof mock.fn>;

  beforeEach(() => {
    // Recreate utils mocks (clears implementations and call history)
    determineContentTypeFromFilenameMock = mock.fn();
    generateRandomIdMock = mock.fn();
    processCacheFileContentMock = mock.fn();
    // Mutate the SAME object that cache.service's import_utils variable references.
    // Replacing the cache entry would create a new object that cache.service never sees.
    utilsExports.determineContentTypeFromFilename = determineContentTypeFromFilenameMock;
    utilsExports.generateRandomId = generateRandomIdMock;
    utilsExports.processCacheFileContent = processCacheFileContentMock;

    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW).getTime() });

    logger = new PinoLogger();
    service = new CacheService(
      logger,
      mockBaseFolders('northId').cache,
      mockBaseFolders('northId').error,
      mockBaseFolders('northId').archive
    );

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
        async () => ['file5', 'file6', 'bad'] // Archive folder
      )
    );
    readFileMock.mock.mockImplementation(
      seq(
        async () => JSON.stringify(fileList[0].metadata),
        async () => JSON.stringify(fileList[1].metadata),
        async () => {
          throw new Error('error 1');
        },
        async () => JSON.stringify(fileList[2].metadata),
        async () => JSON.stringify(fileList[3].metadata),
        async () => {
          throw new Error('error 2');
        },
        async () => JSON.stringify(fileList[4].metadata),
        async () => JSON.stringify(fileList[5].metadata),
        async () => {
          throw new Error('error 3');
        }
      )
    );

    await service.start();

    // Check initial queue sort based on date
    const expectedQueueLength = 2; // Only valid files in 'cache' folder
    assert.strictEqual((priv()['queue'] as Array<unknown>).length, expectedQueueLength);
    assert.ok(service.getCacheSize() > 0);

    assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while reading cache file')));
    assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while reading errored file')));
    assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while reading archived file')));
    assert.ok(logger.info.mock.calls.some(c => c.arguments[0] === `${expectedQueueLength} content in cache`));
    assert.ok(logger.warn.mock.calls.some(c => c.arguments[0] === '3 content errored'));
    assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === '3 content archived'));
  });

  it('should set logger', () => {
    const anotherLogger = new PinoLogger();
    service.setLogger(anotherLogger);
    assert.strictEqual(priv()['logger'], anotherLogger);
  });

  it('should not clear timeouts, reset flags, and remove listeners when stopping', () => {
    const clearTimeoutMock = mock.method(global, 'clearTimeout', mock.fn());

    priv()['cacheSizeWarningDebounceTimeout'] = null;
    priv()['cacheLogDebounceTimeout'] = null;
    priv()['cacheSizeWarningDebounceFlag'] = true;
    priv()['cacheLogDebounceFlag'] = true;

    const removeAllListenersMock = mock.method(service.cacheSizeEventEmitter, 'removeAllListeners', mock.fn());

    service.stop();

    assert.strictEqual(clearTimeoutMock.mock.calls.length, 0);

    assert.strictEqual(priv()['cacheSizeWarningDebounceTimeout'], null);
    assert.strictEqual(priv()['cacheLogDebounceTimeout'], null);
    assert.strictEqual(priv()['cacheSizeWarningDebounceFlag'], false);
    assert.strictEqual(priv()['cacheLogDebounceFlag'], false);
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

    priv()['cacheSizeWarningDebounceTimeout'] = mockSizeTimeout;
    priv()['cacheLogDebounceTimeout'] = mockLogTimeout;
    priv()['cacheSizeWarningDebounceFlag'] = true;
    priv()['cacheLogDebounceFlag'] = true;

    const removeAllListenersMock = mock.method(service.cacheSizeEventEmitter, 'removeAllListeners', mock.fn());

    service.stop();

    assert.ok(clearTimeoutMock.mock.calls.some(c => c.arguments[0] === mockSizeTimeout));
    assert.ok(clearTimeoutMock.mock.calls.some(c => c.arguments[0] === mockLogTimeout));

    assert.strictEqual(priv()['cacheSizeWarningDebounceTimeout'], null);
    assert.strictEqual(priv()['cacheLogDebounceTimeout'], null);
    assert.strictEqual(priv()['cacheSizeWarningDebounceFlag'], false);
    assert.strictEqual(priv()['cacheLogDebounceFlag'], false);
    assert.ok(removeAllListenersMock.mock.calls.length > 0);
  });

  it('should wait for pending updateCache$ and compactQueue$ tasks to resolve', async () => {
    let resolveUpdate: (value: void | PromiseLike<void>) => void;
    const updatePromise = new Promise<void>(resolve => {
      resolveUpdate = resolve;
    });

    priv()['updateCache$'] = { promise: updatePromise } as DeferredPromise;

    let isFinished = false;
    const waitCall = (priv()['waitCacheUpdateTasks'] as () => Promise<void>)().then(() => {
      isFinished = true;
    });

    assert.strictEqual(isFinished, false);
    resolveUpdate!();
    await waitCall;
    assert.strictEqual(isFinished, true);
  });

  it('should resolve immediately if no tasks are pending', async () => {
    // Setup: Ensure properties are null
    priv()['updateCache$'] = null;

    // Execute
    await assert.doesNotReject((priv()['waitCacheUpdateTasks'] as () => Promise<void>)());
  });

  it('should wait for tasks and return null if queue is empty', async () => {
    priv()['waitCacheUpdateTasks'] = mock.fn();
    priv()['queue'] = [];

    const result = await service.getCacheContentToSend(100);

    assert.ok(privMock('waitCacheUpdateTasks').mock.calls.length > 0);
    assert.strictEqual(result, null);
  });

  it('should return item directly if content type is "any"', async () => {
    const item = { filename: 'file1.txt', metadata: { contentType: 'any' } as CacheMetadata };
    priv()['queue'] = [item];
    priv()['waitCacheUpdateTasks'] = mock.fn();
    priv()['compactQueue'] = mock.fn();

    const result = await service.getCacheContentToSend(100);

    assert.ok(privMock('waitCacheUpdateTasks').mock.calls.length > 0);
    assert.strictEqual(privMock('compactQueue').mock.calls.length, 0);
    assert.deepStrictEqual(result, item);
  });

  it('should compact queue and return item if content type is not "any"', async () => {
    const item = { filename: 'data.json', metadata: { contentType: 'time-values' } as CacheMetadata };
    priv()['queue'] = [item];

    priv()['waitCacheUpdateTasks'] = mock.fn();
    priv()['compactQueue'] = mock.fn();

    const maxGroupCount = 50;
    const result = await service.getCacheContentToSend(maxGroupCount);

    assert.ok(privMock('waitCacheUpdateTasks').mock.calls.length > 0);
    assert.deepStrictEqual(privMock('compactQueue').mock.calls[0].arguments, [maxGroupCount, 'time-values']);
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

    priv()['getCacheSize'] = mock.fn(
      seq(
        () => 1024 * 1024,
        () => 1024 * 1024 * 3,
        () => 1024 * 1024 * 3
      )
    );

    assert.strictEqual(service.cacheIsFull(2), false);
    assert.strictEqual(priv()['cacheSizeWarningDebounceTimeout'], null);
    assert.strictEqual(service.cacheIsFull(2), true);
    assert.notStrictEqual(priv()['cacheSizeWarningDebounceTimeout'], null);
    assert.strictEqual(service.cacheIsFull(2), true);
    assert.notStrictEqual(priv()['cacheSizeWarningDebounceTimeout'], null);
    assert.ok(priv()['cacheSizeWarningDebounceFlag']);
    mock.timers.tick(60_000);
    assert.ok(!priv()['cacheSizeWarningDebounceFlag']);
  });

  it('should be properly initialized without files in cache', async () => {
    readdirMock.mock.mockImplementation(
      seq(
        async () => [], // Cache folder
        async () => [], // Error folder
        async () => [] // Archive folder
      )
    );

    await service.start();

    assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'No content in cache'));
    assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'No content errored'));
    assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'No content archived'));
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
        async () => [] // searchCacheContent archive
      )
    );

    readFileMock.mock.mockImplementation(
      seq(
        // start() reads file1, file2, bad-file (throws) in cache folder
        async () => JSON.stringify(fileList[0].metadata),
        async () => JSON.stringify(fileList[1].metadata),
        async () => {
          throw new Error('cache read error');
        },
        // searchCacheContent reads file1 (match), file2 (no match or match), bad-file (error)
        async () => JSON.stringify(fileList[0].metadata),
        async () => JSON.stringify(fileList[0].metadata),
        async () => {
          throw new Error('read error');
        }
      )
    );

    const result = await service.searchCacheContent({
      start: testData.constants.dates.DATE_1,
      end: testData.constants.dates.DATE_2,
      nameContains: 'file',
      maxNumberOfFilesReturned: 1000
    });

    assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while reading file')));
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
    mock.method(
      fsSync,
      'createReadStream',
      mock.fn(() => null)
    );
    readFileMock.mock.mockImplementation(async () => JSON.stringify(fileList[0].metadata));
    determineContentTypeFromFilenameMock.mock.mockImplementation(() => 'json');
    const cacheFileContentResult = { content: 'content', truncated: false, contentFilename: 'file1-123456.json' };
    processCacheFileContentMock.mock.mockImplementation(
      seq(
        () => cacheFileContentResult,
        () => {
          throw new Error('should not be called twice');
        }
      )
    );
    const result = await service.getFileFromCache('cache', 'test');
    assert.deepStrictEqual(result, { ...cacheFileContentResult, totalSize: 100, contentType: 'json' });

    // Test error case
    readFileMock.mock.mockImplementation(
      seq(async () => {
        throw new Error('read error');
      })
    );
    await assert.rejects(service.getFileFromCache('cache', 'test'), /Error while reading file/);
  });

  it('should not get cache content file stream if bad full path', async () => {
    readFileMock.mock.mockImplementation(async () => {
      throw new Error('Invalid file path');
    });
    await assert.rejects(service.getFileFromCache('error', path.join('..', 'test')));
  });

  it('should properly add cache content and log state', async () => {
    const output = Buffer.from('some content');
    writeFileMock.mock.mockImplementation(async () => undefined);
    statMock.mock.mockImplementation(async () => ({ size: 1024, ctimeMs: Date.now() }));
    generateRandomIdMock.mock.mockImplementation(() => 'random');

    await service.addCacheContent(output, { contentType: 'any' });

    assert.strictEqual(writeFileMock.mock.calls.length, 2); // Content + Metadata
    assert.ok(logger.trace.mock.calls.some(c => String(c.arguments[0]).includes('added to cache')));
    // Verify debounced logging
    assert.ok(logger.debug.mock.calls.some(c => c.arguments.length > 1 && String(c.arguments[1]).includes('Cache updated')));
  });

  describe('Debounce Logging', () => {
    it('should debounce cache logs', () => {
      const metadata = fileList[0].metadata;

      // First log
      (priv()['logCacheState'] as unknown as (m: CacheMetadata) => void)(metadata);
      assert.strictEqual(logger.debug.mock.calls.length, 1);
      assert.strictEqual(priv()['cacheLogDebounceFlag'], true);

      // Second log immediately (should be skipped)
      (priv()['logCacheState'] as unknown as (m: CacheMetadata) => void)(metadata);
      assert.strictEqual(logger.debug.mock.calls.length, 1);

      // Advance timer
      mock.timers.tick(10000); // DEBOUNCED_LOG_S
      assert.strictEqual(priv()['cacheLogDebounceFlag'], false);

      // Third log (should go through)
      (priv()['logCacheState'] as unknown as (m: CacheMetadata) => void)(metadata);
      assert.strictEqual(logger.debug.mock.calls.length, 2);
    });
  });

  it('should check if cache is full and log warning with debounce', () => {
    priv()['cacheSize'] = { cache: 1024 * 1024 * 100, error: 0, archive: 0 }; // 100MB
    const maxSize = 50; // 50MB

    // First check
    assert.strictEqual(service.cacheIsFull(maxSize), true);
    assert.ok(logger.warn.mock.calls.some(c => String(c.arguments[0]).includes('exceeding the maximum allowed size')));
    assert.strictEqual(priv()['cacheSizeWarningDebounceFlag'], true);

    // Second check immediately (should return true but NOT log)
    assert.strictEqual(service.cacheIsFull(maxSize), true);
    assert.strictEqual(logger.warn.mock.calls.length, 1);

    // Advance timer
    mock.timers.tick(60000); // DEBOUNCED_SIZE_WARNING_S
    assert.strictEqual(priv()['cacheSizeWarningDebounceFlag'], false);

    // Third check (should log again)
    assert.strictEqual(service.cacheIsFull(maxSize), true);
    assert.strictEqual(logger.warn.mock.calls.length, 2);
  });

  it('should update cache content (move/remove)', async () => {
    priv()['removeContent'] = mock.fn();
    priv()['moveContent'] = mock.fn();
    const emitEventMock = mock.method(service.cacheSizeEventEmitter, 'emit', mock.fn());

    const updateCommand = {
      cache: { remove: ['file1'], move: [{ to: 'archive', filename: 'file2' }] },
      error: { remove: ['file3'], move: [{ to: 'archive', filename: 'file4' }] },
      archive: { remove: ['file5'], move: [{ to: 'cache', filename: 'file6' }] }
    } as CacheContentUpdateCommand;

    await service.updateCacheContent(updateCommand);

    assert.strictEqual(privMock('removeContent').mock.calls.length, 3);
    assert.strictEqual(privMock('moveContent').mock.calls.length, 3);
    assert.ok(emitEventMock.mock.calls.length > 0);
  });

  it('should get number of raw files', () => {
    priv()['queue'] = [
      { filename: 'f1.json', metadata: { ...fileList[0].metadata, numberOfElement: 0 } },
      { filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } },
      { filename: 'f3.json', metadata: { ...fileList[2].metadata, numberOfElement: 1 } }
    ];
    assert.strictEqual(service.getNumberOfRawFilesInQueue(), 2);
  });

  it('should properly filter files', () => {
    assert.deepStrictEqual(
      (priv()['filterFile'] as unknown as (files: Array<unknown>, filter: unknown) => Array<unknown>)(
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
      (priv()['filterFile'] as unknown as (files: Array<unknown>, filter: unknown) => Array<unknown>)(
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

      const result = await (
        priv()['accumulateContent'] as unknown as (
          items: Array<unknown>,
          max: number
        ) => Promise<{
          newListOfContent: Array<unknown>;
          remainder: Array<unknown>;
          compactedFiles: Array<unknown>;
        }>
      )(queueItems, 0);

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

      const result = await (
        priv()['accumulateContent'] as unknown as (
          items: Array<unknown>,
          max: number
        ) => Promise<{
          newListOfContent: Array<unknown>;
          remainder: Array<unknown>;
          compactedFiles: Array<unknown>;
        }>
      )(queueItems, maxGroupCount);

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

      readFileMock.mock.mockImplementation(seq(async () => JSON.stringify([{ id: 1 }, { id: 2 }])));

      const result = await (
        priv()['accumulateContent'] as unknown as (
          items: Array<unknown>,
          max: number
        ) => Promise<{
          newListOfContent: Array<unknown>;
          remainder: Array<unknown>;
          compactedFiles: Array<unknown>;
        }>
      )(queueItems, maxGroupCount);

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
      priv()['queue'] = [...queueItems];

      readFileMock.mock.mockImplementation(
        seq(
          async () => JSON.stringify([{ id: 1 }]),
          async () => {
            throw new Error('Invalid JSON');
          },
          async () => JSON.stringify([{ id: 3 }])
        )
      );

      priv()['deleteCacheEntry'] = mock.fn();

      const result = await (
        priv()['accumulateContent'] as unknown as (
          items: Array<unknown>,
          max: number
        ) => Promise<{
          newListOfContent: Array<unknown>;
          remainder: Array<unknown>;
          compactedFiles: Array<unknown>;
        }>
      )(queueItems, 0);

      assert.deepStrictEqual(result.newListOfContent, [{ id: 1 }, { id: 3 }]);
      assert.strictEqual(result.compactedFiles.length, 2); // f1 and f3

      // Verify Error Handling
      assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while reading file')));
      assert.deepStrictEqual(privMock('deleteCacheEntry').mock.calls[0].arguments, ['cache', 'bad.json']);
      assert.strictEqual(
        (priv()['queue'] as Array<{ filename: string }>).find(f => f.filename === 'bad.json'),
        undefined
      );
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

      priv()['queue'] = [fileData]; // Put in queue to check in-memory update
      writeFileMock.mock.mockImplementation(async () => undefined);
      statMock.mock.mockImplementation(async () => ({ size: newSize }));

      await (priv()['overwriteCacheFile'] as unknown as (file: unknown, content: Array<unknown>) => Promise<void>)(fileData, newContent);

      assert.ok(writeFileMock.mock.calls.some(c => String(c.arguments[0]).includes(path.join('content', 'test.json'))));

      assert.ok(
        writeFileMock.mock.calls.some(
          c =>
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

      priv()['queue'] = [{ filename: 'another_file.json', metadata: fileData.metadata }]; // Put in queue a wrong filename
      writeFileMock.mock.mockImplementation(async () => undefined);
      statMock.mock.mockImplementation(async () => ({ size: newSize }));

      await (priv()['overwriteCacheFile'] as unknown as (file: unknown, content: Array<unknown>) => Promise<void>)(fileData, newContent);

      assert.strictEqual(writeFileMock.mock.calls.length, 2);
      assert.deepStrictEqual(priv()['queue'], [{ filename: 'another_file.json', metadata: fileData.metadata }]);
    });

    it('should handled missing queue element', async () => {
      const fileData = {
        filename: 'test.json',
        metadata: { contentSize: 100, numberOfElement: 1, createdAt: '', contentType: 'any', contentFile: 'orig' }
      };
      const newContent = [{ id: 'new' }];

      priv()['queue'] = []; // Empty queue
      writeFileMock.mock.mockImplementation(async () => undefined);
      statMock.mock.mockImplementation(async () => ({ size: 500 }));

      await assert.doesNotReject(
        (priv()['overwriteCacheFile'] as unknown as (file: unknown, content: Array<unknown>) => Promise<void>)(fileData, newContent)
      );
    });
  });

  describe('compactQueue', () => {
    it('should return existing promise if compact is ongoing', async () => {
      let resolveCompact: (value: void | PromiseLike<void>) => void;
      const compactPromise = new Promise<void>(resolve => {
        resolveCompact = resolve;
      });

      priv()['updateCache$'] = { promise: compactPromise } as DeferredPromise;

      let isFinished = false;
      const waitCall = (priv()['compactQueue'] as unknown as (max: number, type: string) => Promise<void>)(1, 'time-values').then(() => {
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
      priv()['queue'] = [item1, item2] as Array<{ filename: string; metadata: CacheMetadata }>;

      // Mocks for helper methods
      priv()['accumulateContent'] = mock.fn(async () => ({
        newListOfContent: [{ a: 1 }, { b: 2 }],
        remainder: [],
        compactedFiles: [item1, item2] // Both processed
      }));
      priv()['overwriteCacheFile'] = mock.fn(async () => undefined);
      priv()['deleteCacheEntry'] = mock.fn(async () => undefined);

      await service.compactQueue(100, 'typeB'); // nothing to do on this type
      assert.strictEqual(privMock('overwriteCacheFile').mock.calls.length, 0);
      assert.strictEqual(privMock('deleteCacheEntry').mock.calls.length, 0);

      await service.compactQueue(100, 'typeA');

      // Verify Flow
      // 1. Accumulate called
      assert.ok(privMock('accumulateContent').mock.calls.length > 0);

      // 2. Write Main called with FIRST element (item1)
      assert.deepStrictEqual(privMock('overwriteCacheFile').mock.calls[0].arguments, [item1, [{ a: 1 }, { b: 2 }]]);

      // 3. Write Remainder NOT called (remainder empty)
      assert.strictEqual(privMock('overwriteCacheFile').mock.calls.length, 1);

      // 4. Delete intermediate called for BOTH (logic says we clean up intermediate files)
      assert.ok(privMock('deleteCacheEntry').mock.calls.some(c => c.arguments[0] === 'cache' && c.arguments[1] === '2.json'));

      // 5. Queue updated: should remove '2.json' (intermediate) but keep '1.json' (reused)
      assert.strictEqual((priv()['queue'] as Array<unknown>).length, 1);
      assert.strictEqual((priv()['queue'] as Array<unknown>)[0], item1);
    });

    it('should handle remainder by writing to last file', async () => {
      const item1 = { filename: '1.json', metadata: { contentType: 'typeA' } };
      const item2 = { filename: '2.json', metadata: { contentType: 'typeA' } };
      priv()['queue'] = [item1, item2] as Array<{ filename: string; metadata: CacheMetadata }>;

      priv()['accumulateContent'] = mock.fn(async () => ({
        newListOfContent: [{ a: 1 }],
        remainder: [{ b: 2 }],
        compactedFiles: [item1, item2]
      }));
      priv()['overwriteCacheFile'] = mock.fn(async () => undefined);
      priv()['deleteCacheEntry'] = mock.fn(async () => undefined);

      await service.compactQueue(1, 'typeA');

      // Verify two writes
      assert.deepStrictEqual(privMock('overwriteCacheFile').mock.calls[0].arguments, [item1, [{ a: 1 }]]); // Main batch -> First file
      assert.deepStrictEqual(privMock('overwriteCacheFile').mock.calls[1].arguments, [item2, [{ b: 2 }]]); // Remainder -> Last file

      // Queue update: Both should remain in queue because shift() removed item1 and pop() removed item2 from the list to delete
      assert.strictEqual((priv()['queue'] as Array<unknown>).length, 2);
    });

    it('should orchestrate accumulation with no file compacted', async () => {
      // Setup: 2 items in queue, merge them into 1
      const item1 = { filename: '1.json', metadata: { contentType: 'typeA' } };
      const item2 = { filename: '2.json', metadata: { contentType: 'typeA' } };
      priv()['queue'] = [item1, item2] as Array<{ filename: string; metadata: CacheMetadata }>;

      // Mocks for helper methods
      priv()['accumulateContent'] = mock.fn(async () => ({
        newListOfContent: [],
        remainder: [],
        compactedFiles: []
      }));
      priv()['overwriteCacheFile'] = mock.fn();
      priv()['deleteCacheEntry'] = mock.fn();

      await service.compactQueue(100, 'typeA');

      assert.ok(privMock('accumulateContent').mock.calls.length > 0);
      assert.strictEqual(privMock('overwriteCacheFile').mock.calls.length, 0);
      assert.strictEqual(privMock('deleteCacheEntry').mock.calls.length, 0);

      assert.strictEqual((priv()['queue'] as Array<unknown>).length, 2);
      assert.strictEqual((priv()['queue'] as Array<unknown>)[0], item1);
      assert.strictEqual((priv()['queue'] as Array<unknown>)[1], item2);
    });
  });

  describe('moveContent', () => {
    it('should move content and metadata files and update cache size', async () => {
      // Setup
      const filename = 'file1.json';
      const metadata = { contentSize: 100, numberOfElement: 1, createdAt: '', contentType: 'any', contentFile: 'file' };

      // Inject initial state
      priv()['queue'] = [{ filename, metadata }];
      priv()['cacheSize'] = { cache: 100, error: 0, archive: 0 };

      priv()['readCacheMetadataFile'] = mock.fn(async () => metadata);
      priv()['removeCacheContentFromQueue'] = mock.fn();
      renameMock.mock.mockImplementation(async () => undefined);

      await (priv()['moveContent'] as unknown as (from: string, to: string, filename: string) => Promise<void>)(
        'cache',
        'archive',
        filename
      );

      assert.strictEqual(renameMock.mock.calls.length, 2); // Content + Metadata
      assert.ok(
        renameMock.mock.calls.some(
          c =>
            String(c.arguments[0]).includes(path.join('cache', 'northId', 'content', filename)) &&
            String(c.arguments[1]).includes(path.join('archive', 'northId', 'content', filename))
        )
      );

      assert.ok(privMock('removeCacheContentFromQueue').mock.calls.some(c => c.arguments[0] === filename));
      assert.strictEqual((priv()['cacheSize'] as { cache: number; error: number; archive: number }).cache, 0);
      assert.strictEqual((priv()['cacheSize'] as { cache: number; error: number; archive: number }).archive, 100);
      assert.ok(logger.trace.mock.calls.some(c => String(c.arguments[0]).includes('moved from cache to archive')));
    });

    it('should add to queue if moving TO cache', async () => {
      const filename = 'file2.json';
      const metadata = { contentSize: 50 };
      priv()['cacheSize'] = { cache: 0, error: 50, archive: 0 };

      priv()['readCacheMetadataFile'] = mock.fn(async () => metadata);
      renameMock.mock.mockImplementation(async () => undefined);

      await (priv()['moveContent'] as unknown as (from: string, to: string, filename: string) => Promise<void>)('error', 'cache', filename);

      const queue = priv()['queue'] as Array<{ filename: string }>;
      assert.strictEqual(queue.length, 1);
      assert.strictEqual(queue[0].filename, filename);
      assert.strictEqual((priv()['cacheSize'] as { cache: number; error: number; archive: number }).cache, 50);
    });

    it('should handle errors during move', async () => {
      const filename = 'bad-file.json';
      const metadata = { contentSize: 200 } as CacheMetadata;
      priv()['readCacheMetadataFile'] = mock.fn(async () => metadata);
      renameMock.mock.mockImplementation(async () => {
        throw new Error('Read Error');
      });

      await (priv()['moveContent'] as unknown as (from: string, to: string, filename: string) => Promise<void>)('cache', 'error', filename);

      assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while moving files')));
    });

    it('should handle empty metadata', async () => {
      const filename = 'file.json';

      priv()['readCacheMetadataFile'] = mock.fn(async () => null);

      await (priv()['moveContent'] as unknown as (from: string, to: string, filename: string) => Promise<void>)('cache', 'error', filename);

      assert.strictEqual(renameMock.mock.calls.length, 0);
    });
  });

  describe('removeContent', () => {
    it('should remove content and metadata files and update cache size', async () => {
      // Setup
      const filename = 'file1.json';
      const metadata = { contentSize: 200 } as CacheMetadata;

      // Inject initial state
      priv()['queue'] = [{ filename, metadata }];
      priv()['cacheSize'] = { cache: 200, error: 0, archive: 0 };

      priv()['readCacheMetadataFile'] = mock.fn(async () => metadata);
      priv()['removeCacheContentFromQueue'] = mock.fn();

      // Execute: Remove from 'cache'
      await (priv()['removeContent'] as unknown as (folder: string, filename: string) => Promise<void>)('cache', filename);

      // Verify FS operations
      assert.strictEqual(rmMock.mock.calls.length, 2); // Content + Metadata
      assert.ok(
        rmMock.mock.calls.some(
          c =>
            String(c.arguments[0]).includes(path.join('cache', 'northId', 'content', filename)) &&
            (c.arguments[1] as { force: boolean; recursive: boolean })?.force === true &&
            (c.arguments[1] as { force: boolean; recursive: boolean })?.recursive === true
        )
      );

      // Verify State Updates
      assert.ok(privMock('removeCacheContentFromQueue').mock.calls.some(c => c.arguments[0] === filename));
      assert.strictEqual((priv()['cacheSize'] as { cache: number; error: number; archive: number }).cache, 0);
      assert.ok(logger.trace.mock.calls.some(c => String(c.arguments[0]).includes('removed from cache')));
    });

    it('should handle errors during removal', async () => {
      const filename = 'file.json';
      const metadata = { contentSize: 100 };

      priv()['readCacheMetadataFile'] = mock.fn(async () => metadata);
      priv()['deleteCacheEntry'] = mock.fn(async () => {
        throw new Error('Rm Error');
      });

      await (priv()['removeContent'] as unknown as (folder: string, filename: string) => Promise<void>)('archive', filename);

      assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while removing file')));
    });

    it('should handle empty metadata', async () => {
      const filename = 'file.json';

      priv()['readCacheMetadataFile'] = mock.fn(async () => null);
      priv()['deleteCacheEntry'] = mock.fn();

      await (priv()['removeContent'] as unknown as (folder: string, filename: string) => Promise<void>)('archive', filename);

      assert.strictEqual(privMock('deleteCacheEntry').mock.calls.length, 0);
    });
  });

  it('should delete cache entry', async () => {
    rmMock.mock.mockImplementation(
      seq(
        async () => undefined,
        async () => {
          throw new Error('rm error');
        }
      )
    );
    await (priv()['deleteCacheEntry'] as unknown as (folder: string, file: string) => Promise<void>)('cache', 'file');

    assert.strictEqual(rmMock.mock.calls.length, 2);
    assert.ok(
      rmMock.mock.calls.some(
        c =>
          c.arguments[0] === path.join(service.cacheFolder, METADATA_FOLDER, 'file') &&
          (c.arguments[1] as { recursive: boolean; force: boolean })?.recursive === true &&
          (c.arguments[1] as { recursive: boolean; force: boolean })?.force === true
      )
    );
    assert.ok(
      rmMock.mock.calls.some(
        c =>
          c.arguments[0] === path.join(service.cacheFolder, CONTENT_FOLDER, 'file') &&
          (c.arguments[1] as { recursive: boolean; force: boolean })?.recursive === true &&
          (c.arguments[1] as { recursive: boolean; force: boolean })?.force === true
      )
    );
    assert.ok(logger.trace.mock.calls.some(c => c.arguments[0] === `Error deleting cache entry "file": rm error`));
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
        async () => ['file5', 'file6', 'bad'] // Archive folder (content)
      )
    );

    rmMock.mock.mockImplementation(async (file: string) => {
      if (file.includes('bad')) throw new Error('rm error');
    });
    await service.removeAllCacheContent();

    assert.strictEqual(readdirMock.mock.calls.length, 6);
    assert.strictEqual(rmMock.mock.calls.length, 18);
    assert.strictEqual(logger.error.mock.calls.length, 6);
    assert.ok(emitEventMock.mock.calls.some(c => c.arguments[0] === 'cache-size'));
  });
});
