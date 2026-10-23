import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import { CacheContentUpdateCommand, CacheMetadata } from '../../../shared/model/domain/engine.model';

import { CONTENT_FOLDER, METADATA_FOLDER } from '../../model/engine.model';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, mockBaseFolders, mockModule, reloadModule, seq } from '../../tests/utils/test-utils';
import DeferredPromise from '../deferred-promise';
import type LoggerService from '../logger/logger.service';
import type * as Utils from '../utils';
import type CacheServiceType from './cache.service';

const nodeRequire = createRequire(import.meta.url);

// Mocked module exports: the same objects for the whole file, their functions are replaced before each test
const realUtils: typeof Utils = nodeRequire('../utils');
const createUtilsMocks = () => ({
  determineContentTypeFromFilename: mock.fn<typeof Utils.determineContentTypeFromFilename>(),
  generateRandomId: mock.fn<typeof Utils.generateRandomId>(),
  processCacheFileContent: mock.fn<typeof Utils.processCacheFileContent>()
});
const utilsExports = { ...realUtils, ...createUtilsMocks() };
const loggerServiceExports = { __esModule: true, loggerService: createMock<LoggerService>() };

let CacheService: typeof CacheServiceType;

before(() => {
  mockModule(nodeRequire, '../utils', utilsExports);
  mockModule(nodeRequire, '../logger/logger.service', loggerServiceExports);
  CacheService = reloadModule<{ default: typeof CacheServiceType }>(nodeRequire, './cache.service').default;
});

const fileList: Array<{ filename: string; metadata: CacheMetadata }> = [
  {
    filename: 'file1.json',
    metadata: {
      contentFile: 'file1-123456.json',
      contentSize: 100,
      numberOfElement: 3,
      createdAt: testData.constants.dates.DATE_1,
      contentType: 'record-list'
    }
  },
  {
    filename: 'file2.json',
    metadata: {
      contentFile: 'file2-123456.json',
      contentSize: 100,
      numberOfElement: 4,
      createdAt: testData.constants.dates.DATE_2,
      contentType: 'record-list'
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
      contentType: 'record-list'
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
      contentType: 'record-list'
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

  beforeEach(() => {
    Object.assign(utilsExports, createUtilsMocks());
    loggerServiceExports.loggerService = createMock<LoggerService>();

    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW).getTime() });

    logger = new PinoLogger();
    const folders = mockBaseFolders('northId');
    service = new CacheService(logger, folders.cache, folders.error, folders.archive);

    readFileMock = mock.method(fs, 'readFile', mock.fn());
    readdirMock = mock.method(fs, 'readdir', mock.fn());
    writeFileMock = mock.method(fs, 'writeFile', mock.fn());
    statMock = mock.method(fs, 'stat', mock.fn());
    renameMock = mock.method(fs, 'rename', mock.fn());
    rmMock = mock.method(fs, 'rm', mock.fn());
  });

  afterEach(() => {
    service.cacheSizeEventEmitter.removeAllListeners();
    mock.restoreAll();
    mock.timers.reset();
  });

  it('should be properly initialized with files in cache', async () => {
    const emitEventMock = mock.method(service.cacheSizeEventEmitter, 'emit', mock.fn());
    const files: Record<string, Record<string, CacheMetadata | null>> = {
      [service.cacheFolder]: { file1: fileList[0].metadata, file2: fileList[1].metadata, bad: null },
      [service.errorFolder]: { file3: fileList[2].metadata, file4: fileList[3].metadata, bad: null },
      [service.archiveFolder]: { file5: fileList[4].metadata, file6: fileList[5].metadata, bad: null }
    };
    // Every content file has its metadata: nothing to remove
    readdirMock.mock.mockImplementation(async (folder: string) => Object.keys(files[path.dirname(folder)]));
    readFileMock.mock.mockImplementation(async (filePath: string) => {
      const metadata = files[path.dirname(path.dirname(filePath))][path.basename(filePath)];
      if (!metadata) {
        throw new Error('read error');
      }
      return JSON.stringify(metadata);
    });

    await service.start();

    assert.strictEqual(rmMock.mock.calls.length, 0);

    // Check initial queue sort based on date
    const expectedQueueLength = 2; // Only valid files in 'cache' folder
    assert.strictEqual(service['queue'].length, expectedQueueLength);
    assert.ok(service.getCacheSize() > 0);
    // The freshly-scanned folder sizes must be published so the metrics services
    // reflect pre-existing backlog immediately after startup.
    const startEmit = emitEventMock.mock.calls.find(c => c.arguments[0] === 'cache-size');
    assert.ok(startEmit, 'cache-size must be emitted after the initial folder scan');
    assert.deepStrictEqual(startEmit!.arguments[1], service['cacheSize']);

    assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while reading cache file')));
    assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while reading errored file')));
    assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while reading archived file')));
    assert.ok(logger.info.mock.calls.some(c => c.arguments[0] === `${expectedQueueLength} content in cache`));
    assert.ok(logger.warn.mock.calls.some(c => c.arguments[0] === '3 content errored'));
    assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === '3 content archived'));
  });

  it('should refresh logger', () => {
    const newLogger = new PinoLogger();
    const createChildLoggerMock = loggerServiceExports.loggerService.createChildLogger;
    createChildLoggerMock.mock.mockImplementation(() => newLogger);
    service.refreshLogger('north', 'id', 'name');
    assert.strictEqual(createChildLoggerMock.mock.calls[0].arguments[0], 'north');
    assert.strictEqual(createChildLoggerMock.mock.calls[0].arguments[1], 'id');
    assert.strictEqual(createChildLoggerMock.mock.calls[0].arguments[2], 'name');
    assert.strictEqual(service['logger'], newLogger);
  });

  it('should not clear timeouts, reset flags, and remove listeners when stopping', () => {
    const clearTimeoutMock = mock.method(global, 'clearTimeout', mock.fn());

    service['cacheSizeWarningDebounceTimeout'] = null;
    service['cacheLogDebounceTimeout'] = null;
    service['cacheSizeWarningDebounceFlag'] = true;
    service['cacheLogDebounceFlag'] = true;

    const removeAllListenersMock = mock.method(service.cacheSizeEventEmitter, 'removeAllListeners', mock.fn());

    service.stop();

    assert.strictEqual(clearTimeoutMock.mock.calls.length, 0);

    assert.strictEqual(service['cacheSizeWarningDebounceTimeout'], null);
    assert.strictEqual(service['cacheLogDebounceTimeout'], null);
    assert.strictEqual(service['cacheSizeWarningDebounceFlag'], false);
    assert.strictEqual(service['cacheLogDebounceFlag'], false);
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

    service['cacheSizeWarningDebounceTimeout'] = mockSizeTimeout;
    service['cacheLogDebounceTimeout'] = mockLogTimeout;
    service['cacheSizeWarningDebounceFlag'] = true;
    service['cacheLogDebounceFlag'] = true;

    const removeAllListenersMock = mock.method(service.cacheSizeEventEmitter, 'removeAllListeners', mock.fn());

    service.stop();

    assert.ok(clearTimeoutMock.mock.calls.some(c => c.arguments[0] === mockSizeTimeout));
    assert.ok(clearTimeoutMock.mock.calls.some(c => c.arguments[0] === mockLogTimeout));

    assert.strictEqual(service['cacheSizeWarningDebounceTimeout'], null);
    assert.strictEqual(service['cacheLogDebounceTimeout'], null);
    assert.strictEqual(service['cacheSizeWarningDebounceFlag'], false);
    assert.strictEqual(service['cacheLogDebounceFlag'], false);
    assert.ok(removeAllListenersMock.mock.calls.length > 0);
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

    assert.strictEqual(isFinished, false);
    resolveUpdate!();
    await waitCall;
    assert.strictEqual(isFinished, true);
  });

  it('should resolve immediately if no tasks are pending', async () => {
    // Setup: Ensure properties are null
    service['updateCache$'] = null;

    // Execute
    await assert.doesNotReject(service['waitCacheUpdateTasks']());
  });

  it('should wait for tasks and return null if queue is empty', async () => {
    const waitCacheUpdateTasks = mock.fn(async () => undefined);
    service['waitCacheUpdateTasks'] = waitCacheUpdateTasks;
    service['queue'] = [];

    const result = await service.getCacheContentToSend(100);

    assert.ok(waitCacheUpdateTasks.mock.calls.length > 0);
    assert.strictEqual(result, null);
  });

  it('should return item directly if content type is "any"', async () => {
    const item = { filename: 'file1.txt', metadata: { contentType: 'any' } as CacheMetadata };
    service['queue'] = [item];
    const waitCacheUpdateTasks = mock.fn(async () => undefined);
    service['waitCacheUpdateTasks'] = waitCacheUpdateTasks;
    const compactQueue = mock.method(service, 'compactQueue', () => undefined);

    const result = await service.getCacheContentToSend(100);

    assert.ok(waitCacheUpdateTasks.mock.calls.length > 0);
    assert.strictEqual(compactQueue.mock.calls.length, 0);
    assert.deepStrictEqual(result, item);
  });

  it('should compact queue and return item if content type is not "any"', async () => {
    const item = { filename: 'data.json', metadata: { contentType: 'record-list' } as CacheMetadata };
    service['queue'] = [item];

    const waitCacheUpdateTasks = mock.fn(async () => undefined);
    service['waitCacheUpdateTasks'] = waitCacheUpdateTasks;
    const compactQueue = mock.method(service, 'compactQueue', () => undefined);

    const maxGroupCount = 50;
    const result = await service.getCacheContentToSend(maxGroupCount);

    assert.ok(waitCacheUpdateTasks.mock.calls.length > 0);
    assert.deepStrictEqual(compactQueue.mock.calls[0].arguments, [maxGroupCount, 'record-list']);
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

    mock.method(
      service,
      'getCacheSize',
      seq(
        () => 1024 * 1024,
        () => 1024 * 1024 * 3,
        () => 1024 * 1024 * 3
      )
    );

    assert.strictEqual(service.cacheIsFull(2), false);
    assert.strictEqual(service['cacheSizeWarningDebounceTimeout'], null);
    assert.strictEqual(service.cacheIsFull(2), true);
    assert.notStrictEqual(service['cacheSizeWarningDebounceTimeout'], null);
    assert.strictEqual(service.cacheIsFull(2), true);
    assert.notStrictEqual(service['cacheSizeWarningDebounceTimeout'], null);
    assert.ok(service['cacheSizeWarningDebounceFlag']);
    mock.timers.tick(60_000);
    assert.ok(!service['cacheSizeWarningDebounceFlag']);
  });

  it('should be properly initialized without files in cache', async () => {
    readdirMock.mock.mockImplementation(async () => []);

    await service.start();

    assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'No content in cache'));
    assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'No content errored'));
    assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'No content archived'));
  });

  it('should remove the content files without metadata at startup', async () => {
    const now = Date.now();
    const contentFiles: Record<string, Record<string, { mtimeMs: number; size: number }>> = {
      [service.cacheFolder]: {
        file1: { mtimeMs: now - 3_600_000, size: 100 },
        orphan1: { mtimeMs: now - 3_600_000, size: 1024 * 1024 },
        // Its metadata may still be being written
        recent: { mtimeMs: now - 1_000, size: 50 },
        locked: { mtimeMs: now - 3_600_000, size: 200 }
      },
      [service.errorFolder]: { orphan2: { mtimeMs: now - 3_600_000, size: 1024 * 1024 } },
      [service.archiveFolder]: {}
    };
    readdirMock.mock.mockImplementation(async (folder: string) => {
      if (path.basename(folder) === CONTENT_FOLDER) {
        return Object.keys(contentFiles[path.dirname(folder)]);
      }
      return folder === path.join(service.cacheFolder, METADATA_FOLDER) ? ['file1'] : [];
    });
    readFileMock.mock.mockImplementation(async () => JSON.stringify(fileList[0].metadata));
    statMock.mock.mockImplementation(
      async (filePath: string) => contentFiles[path.dirname(path.dirname(filePath))][path.basename(filePath)]
    );
    rmMock.mock.mockImplementation(async (filePath: string) => {
      if (path.basename(filePath) === 'locked') {
        throw new Error('EBUSY');
      }
    });

    await service.start();

    assert.deepStrictEqual(
      rmMock.mock.calls.map(c => c.arguments[0]),
      [
        path.join(service.cacheFolder, CONTENT_FOLDER, 'orphan1'),
        path.join(service.cacheFolder, CONTENT_FOLDER, 'locked'),
        path.join(service.errorFolder, CONTENT_FOLDER, 'orphan2')
      ]
    );
    assert.deepStrictEqual(rmMock.mock.calls[0].arguments[1], { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    assert.deepStrictEqual(
      logger.warn.mock.calls.map(c => c.arguments[0]),
      [
        `Could not remove content file "${path.join(service.cacheFolder, CONTENT_FOLDER, 'locked')}" without metadata: EBUSY`,
        '1 content file(s) without metadata removed from cache folder (1 MB)',
        '1 content file(s) without metadata removed from error folder (1 MB)'
      ]
    );
    // The orphans are not part of the cache
    assert.strictEqual(service['queue'].length, 1);
    assert.deepStrictEqual(service.getCacheContentSizes(), { cache: 100, error: 0, archive: 0 });
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
    utilsExports.determineContentTypeFromFilename.mock.mockImplementation(() => 'json');
    const cacheFileContentResult = { content: 'content', truncated: false, contentFilename: 'file1-123456.json' };
    utilsExports.processCacheFileContent.mock.mockImplementation(
      seq(
        async () => cacheFileContentResult,
        async () => {
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

  it('should properly add cache content from a stream, computing size via the counting transform', async () => {
    const { Writable, Readable } = await import('node:stream');
    const fsSync = nodeRequire('node:fs');
    const written: Array<Buffer> = [];
    const writeStream = new Writable({
      write(chunk: Buffer, _enc, cb) {
        written.push(chunk);
        cb();
      }
    });
    mock.method(
      fsSync,
      'createWriteStream',
      mock.fn(() => writeStream)
    );
    writeFileMock.mock.mockImplementation(async () => undefined);
    utilsExports.generateRandomId.mock.mockImplementation(() => 'random-stream');
    const emitEventMock = mock.method(service.cacheSizeEventEmitter, 'emit', mock.fn());

    const input = Readable.from([Buffer.from('hello '), Buffer.from('world')]);

    await service.addCacheContent(input, { contentType: 'any' });

    const expectedSize = Buffer.from('hello world').length;
    assert.strictEqual(Buffer.concat(written).length, expectedSize);
    const contentSizeCall = emitEventMock.mock.calls.find(c => c.arguments[0] === 'cache-content-size');
    assert.ok(contentSizeCall, 'cache-content-size must be emitted when content is cached from a stream');
    assert.strictEqual(contentSizeCall!.arguments[1], expectedSize);
  });

  it('should return a snapshot copy of the current cache content sizes', () => {
    const sizes = service.getCacheContentSizes();
    assert.deepStrictEqual(sizes, service['cacheSize']);
    assert.notStrictEqual(sizes, service['cacheSize']);
  });

  it('should properly add cache content and log state', async () => {
    const output = Buffer.from('some content');
    writeFileMock.mock.mockImplementation(async () => undefined);
    statMock.mock.mockImplementation(async () => ({ size: 1024, ctimeMs: Date.now() }));
    utilsExports.generateRandomId.mock.mockImplementation(() => 'random');
    const emitEventMock = mock.method(service.cacheSizeEventEmitter, 'emit', mock.fn());

    await service.addCacheContent(output, { contentType: 'any' });

    assert.strictEqual(writeFileMock.mock.calls.length, 2); // Content + Metadata
    assert.ok(logger.trace.mock.calls.some(c => String(c.arguments[0]).includes('added to cache')));
    // Verify debounced logging
    assert.ok(logger.debug.mock.calls.some(c => c.arguments.length > 1 && String(c.arguments[1]).includes('Cache updated')));
    // Both the current-folder size and the cumulative content-size deltas must be emitted,
    // so currentCacheSize and contentCachedSize stay correct in the metrics services.
    assert.ok(emitEventMock.mock.calls.some(c => c.arguments[0] === 'cache-size'));
    const contentSizeCall = emitEventMock.mock.calls.find(c => c.arguments[0] === 'cache-content-size');
    assert.ok(contentSizeCall, 'cache-content-size must be emitted when content is cached');
    assert.strictEqual(contentSizeCall!.arguments[1], output.length);
  });

  it('should remove the written content when the metadata cannot be written', async () => {
    utilsExports.generateRandomId.mock.mockImplementation(() => 'random');
    writeFileMock.mock.mockImplementation(
      seq(
        async () => undefined,
        async () => {
          throw new Error('ENOSPC');
        }
      )
    );
    const emitEventMock = mock.method(service.cacheSizeEventEmitter, 'emit', mock.fn());

    await assert.rejects(service.addCacheContent(Buffer.from('some content'), { contentType: 'any' }), { message: 'ENOSPC' });

    assert.deepStrictEqual(
      rmMock.mock.calls.map(c => c.arguments[0]),
      [path.join(service.cacheFolder, CONTENT_FOLDER, 'random'), path.join(service.cacheFolder, METADATA_FOLDER, 'random')]
    );
    assert.strictEqual(service.cacheIsEmpty(), true);
    assert.deepStrictEqual(service.getCacheContentSizes(), { cache: 0, error: 0, archive: 0 });
    assert.strictEqual(emitEventMock.mock.calls.length, 0);
  });

  it('should remove the partial content when the source stream fails', async () => {
    // Write on a real disk, to check that no partial file is left behind
    mock.restoreAll();
    utilsExports.generateRandomId.mock.mockImplementation(() => 'random');
    const tmpFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-cache-'));
    try {
      await fs.mkdir(path.join(tmpFolder, CONTENT_FOLDER));
      await fs.mkdir(path.join(tmpFolder, METADATA_FOLDER));
      service = new CacheService(logger, tmpFolder, tmpFolder, tmpFolder);
      const source = new Readable({
        read() {
          this.push(Buffer.alloc(1024));
          this.destroy(new Error('source error'));
        }
      });

      await assert.rejects(service.addCacheContent(source, { contentType: 'any', contentFilename: 'file.csv' }), {
        message: 'source error'
      });

      assert.deepStrictEqual(await fs.readdir(path.join(tmpFolder, CONTENT_FOLDER)), []);
      assert.deepStrictEqual(await fs.readdir(path.join(tmpFolder, METADATA_FOLDER)), []);
      assert.strictEqual(service.cacheIsEmpty(), true);
    } finally {
      await fs.rm(tmpFolder, { recursive: true, force: true });
    }
  });

  describe('Debounce Logging', () => {
    it('should debounce cache logs', () => {
      const metadata = fileList[0].metadata;

      // First log
      service['logCacheState'](metadata);
      assert.strictEqual(logger.debug.mock.calls.length, 1);
      assert.strictEqual(service['cacheLogDebounceFlag'], true);

      // Second log immediately (should be skipped)
      service['logCacheState'](metadata);
      assert.strictEqual(logger.debug.mock.calls.length, 1);

      // Advance timer
      mock.timers.tick(10000); // DEBOUNCED_LOG_S
      assert.strictEqual(service['cacheLogDebounceFlag'], false);

      // Third log (should go through)
      service['logCacheState'](metadata);
      assert.strictEqual(logger.debug.mock.calls.length, 2);
    });
  });

  it('should check if cache is full and log warning with debounce', () => {
    service['cacheSize'] = { cache: 1024 * 1024 * 100, error: 0, archive: 0 }; // 100MB
    const maxSize = 50; // 50MB

    // First check
    assert.strictEqual(service.cacheIsFull(maxSize), true);
    assert.ok(logger.warn.mock.calls.some(c => String(c.arguments[0]).includes('exceeding the maximum allowed size')));
    assert.strictEqual(service['cacheSizeWarningDebounceFlag'], true);

    // Second check immediately (should return true but NOT log)
    assert.strictEqual(service.cacheIsFull(maxSize), true);
    assert.strictEqual(logger.warn.mock.calls.length, 1);

    // Advance timer
    mock.timers.tick(60000); // DEBOUNCED_SIZE_WARNING_S
    assert.strictEqual(service['cacheSizeWarningDebounceFlag'], false);

    // Third check (should log again)
    assert.strictEqual(service.cacheIsFull(maxSize), true);
    assert.strictEqual(logger.warn.mock.calls.length, 2);
  });

  it('should update cache content (move/remove)', async () => {
    const removeContent = mock.fn(async () => undefined);
    service['removeContent'] = removeContent;
    const moveContent = mock.fn(async () => undefined);
    service['moveContent'] = moveContent;
    const emitEventMock = mock.method(service.cacheSizeEventEmitter, 'emit', mock.fn());

    const updateCommand = {
      cache: { remove: ['file1'], move: [{ to: 'archive', filename: 'file2' }] },
      error: { remove: ['file3'], move: [{ to: 'archive', filename: 'file4' }] },
      archive: { remove: ['file5'], move: [{ to: 'cache', filename: 'file6' }] }
    } as CacheContentUpdateCommand;

    await service.updateCacheContent(updateCommand);

    assert.strictEqual(removeContent.mock.calls.length, 3);
    assert.strictEqual(moveContent.mock.calls.length, 3);
    assert.ok(emitEventMock.mock.calls.length > 0);
  });

  it('should get number of raw files', () => {
    service['queue'] = [
      { filename: 'f1.json', metadata: { ...fileList[0].metadata, numberOfElement: 0 } },
      { filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } },
      { filename: 'f3.json', metadata: { ...fileList[2].metadata, numberOfElement: 1 } }
    ];
    service['recomputeQueueCounters']();
    assert.strictEqual(service.getNumberOfRawFilesInQueue(), 2);
  });

  it('should get number of elements', () => {
    service['queue'] = [
      { filename: 'f1.json', metadata: { ...fileList[0].metadata, numberOfElement: 5 } },
      { filename: 'f2.json', metadata: { ...fileList[1].metadata, numberOfElement: 0 } },
      { filename: 'f3.json', metadata: { ...fileList[2].metadata, numberOfElement: 7 } }
    ];
    service['recomputeQueueCounters']();
    assert.strictEqual(service.getNumberOfElementsInQueue(), 12);
  });

  it('should maintain queue counters incrementally as content is added and removed', async () => {
    writeFileMock.mock.mockImplementation(async () => undefined);
    utilsExports.generateRandomId.mock.mockImplementation(() => 'counter-test');

    // Initial state: empty queue → both counters zero.
    assert.strictEqual(service.getNumberOfElementsInQueue(), 0);
    assert.strictEqual(service.getNumberOfRawFilesInQueue(), 0);

    // Add a 10-element batch → numberOfElement bumps, rawFiles stays put.
    await service.addCacheContent(Buffer.from('payload-1'), { contentType: 'record-list', numberOfElement: 10 });
    assert.strictEqual(service.getNumberOfElementsInQueue(), 10);
    assert.strictEqual(service.getNumberOfRawFilesInQueue(), 0);

    // Add a raw file (numberOfElement omitted/zero) → rawFiles bumps.
    utilsExports.generateRandomId.mock.mockImplementationOnce(() => 'counter-test-2');
    await service.addCacheContent(Buffer.from('payload-2'), { contentType: 'any' });
    assert.strictEqual(service.getNumberOfElementsInQueue(), 10);
    assert.strictEqual(service.getNumberOfRawFilesInQueue(), 1);

    // Remove the raw file from the queue → rawFiles decrements.
    service.removeCacheContentFromQueue('counter-test-2');
    assert.strictEqual(service.getNumberOfRawFilesInQueue(), 0);
    assert.strictEqual(service.getNumberOfElementsInQueue(), 10);
  });

  it('should properly filter files', () => {
    assert.deepStrictEqual(
      service['filterFile'](
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
      service['filterFile'](
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

      const result = await service['accumulateContent'](queueItems, 0);

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

      const result = await service['accumulateContent'](queueItems, maxGroupCount);

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

      const result = await service['accumulateContent'](queueItems, maxGroupCount);

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
      service['queue'] = [...queueItems];
      service['cacheSize'] = { cache: 1000, error: 0, archive: 0 };

      readFileMock.mock.mockImplementation(
        seq(
          async () => JSON.stringify([{ id: 1 }]),
          async () => {
            throw new Error('Invalid JSON');
          },
          async () => JSON.stringify([{ id: 3 }])
        )
      );

      const deleteCacheEntry = mock.fn(async () => undefined);
      service['deleteCacheEntry'] = deleteCacheEntry;

      const result = await service['accumulateContent'](queueItems, 0);

      assert.deepStrictEqual(result.newListOfContent, [{ id: 1 }, { id: 3 }]);
      assert.strictEqual(result.compactedFiles.length, 2); // f1 and f3

      // Verify Error Handling
      assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while reading file')));
      assert.deepStrictEqual(deleteCacheEntry.mock.calls[0].arguments, ['cache', 'bad.json']);
      assert.strictEqual(
        service['queue'].find(f => f.filename === 'bad.json'),
        undefined
      );
      assert.strictEqual(service['cacheSize'].cache, 1000 - fileList[1].metadata.contentSize);
    });

    it('should stop at content that is not an array without deleting it', async () => {
      const queueItems = [
        { filename: 'f1.json', metadata: { ...fileList[0].metadata } },
        { filename: 'compact.json', metadata: { ...fileList[1].metadata } },
        { filename: 'f3.json', metadata: { ...fileList[2].metadata } }
      ];
      service['queue'] = [...queueItems];
      readFileMock.mock.mockImplementation(
        seq(
          async () => JSON.stringify([{ id: 1 }]),
          async () => JSON.stringify({ timestamps: ['t'], values: [[1]], references: ['p'] })
        )
      );
      const deleteCacheEntry = mock.fn(async () => undefined);
      service['deleteCacheEntry'] = deleteCacheEntry;

      const result = await service['accumulateContent'](queueItems, 0);

      assert.deepStrictEqual(result, { newListOfContent: [{ id: 1 }], remainder: [], compactedFiles: [queueItems[0]] });
      // f3 is not merged before the compact content, to keep the sending order
      assert.strictEqual(readFileMock.mock.calls.length, 2);
      assert.strictEqual(deleteCacheEntry.mock.calls.length, 0);
      assert.deepStrictEqual(service['queue'], queueItems);
      assert.strictEqual(logger.error.mock.calls.length, 0);
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
      writeFileMock.mock.mockImplementation(async () => undefined);
      statMock.mock.mockImplementation(async () => ({ size: newSize }));

      const writtenSize = await service['overwriteCacheFile'](fileData, newContent);

      assert.strictEqual(writtenSize, newSize);
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

      service['queue'] = [{ filename: 'another_file.json', metadata: fileData.metadata }]; // Put in queue a wrong filename
      writeFileMock.mock.mockImplementation(async () => undefined);
      statMock.mock.mockImplementation(async () => ({ size: newSize }));

      await service['overwriteCacheFile'](fileData, newContent);

      assert.strictEqual(writeFileMock.mock.calls.length, 2);
      assert.deepStrictEqual(service['queue'], [{ filename: 'another_file.json', metadata: fileData.metadata }]);
    });

    it('should handled missing queue element', async () => {
      const fileData = {
        filename: 'test.json',
        metadata: { contentSize: 100, numberOfElement: 1, createdAt: '', contentType: 'any', contentFile: 'orig' }
      };
      const newContent = [{ id: 'new' }];

      service['queue'] = []; // Empty queue
      writeFileMock.mock.mockImplementation(async () => undefined);
      statMock.mock.mockImplementation(async () => ({ size: 500 }));

      await assert.doesNotReject(service['overwriteCacheFile'](fileData, newContent));
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
      const waitCall = service['compactQueue'](1, 'record-list').then(() => {
        isFinished = true;
      });

      assert.strictEqual(isFinished, false);
      resolveCompact!();
      await waitCall;
      assert.strictEqual(isFinished, true);
    });

    it('should orchestrate accumulation, writing, and cleanup', async () => {
      // Setup: 2 items in queue, merge them into 1
      const item1 = { filename: '1.json', metadata: { contentType: 'typeA', contentSize: 10 } as CacheMetadata };
      const item2 = { filename: '2.json', metadata: { contentType: 'typeA', contentSize: 12 } as CacheMetadata };
      service['queue'] = [item1, item2];
      service['cacheSize'] = { cache: 22, error: 0, archive: 0 };
      const cacheSizeListener = mock.fn();
      service.cacheSizeEventEmitter.on('cache-size', cacheSizeListener);

      // Mocks for helper methods
      const accumulateContent = mock.fn(async () => ({
        newListOfContent: [{ a: 1 }, { b: 2 }],
        remainder: [],
        compactedFiles: [item1, item2] // Both processed
      }));
      service['accumulateContent'] = accumulateContent;
      // Merged file is smaller than the sum of its parts: one pair of JSON brackets is gone
      const overwriteCacheFile = mock.fn<CacheServiceType['overwriteCacheFile']>(async () => 21);
      service['overwriteCacheFile'] = overwriteCacheFile;
      const deleteCacheEntry = mock.fn<CacheServiceType['deleteCacheEntry']>(async () => undefined);
      service['deleteCacheEntry'] = deleteCacheEntry;

      await service.compactQueue(100, 'typeB'); // nothing to do on this type
      assert.strictEqual(overwriteCacheFile.mock.calls.length, 0);
      assert.strictEqual(deleteCacheEntry.mock.calls.length, 0);

      await service.compactQueue(100, 'typeA');

      // Verify Flow
      // 1. Accumulate called
      assert.ok(accumulateContent.mock.calls.length > 0);

      // 2. Write Main called with FIRST element (item1)
      assert.deepStrictEqual(overwriteCacheFile.mock.calls[0].arguments, [item1, [{ a: 1 }, { b: 2 }]]);

      // 3. Write Remainder NOT called (remainder empty)
      assert.strictEqual(overwriteCacheFile.mock.calls.length, 1);

      // 4. Delete intermediate called for BOTH (logic says we clean up intermediate files)
      assert.ok(deleteCacheEntry.mock.calls.some(c => c.arguments[0] === 'cache' && c.arguments[1] === '2.json'));

      // 5. Queue updated: should remove '2.json' (intermediate) but keep '1.json' (reused)
      assert.strictEqual(service['queue'].length, 1);
      assert.strictEqual(service['queue'][0], item1);

      // 6. Cache size resynced with what is now on disk
      assert.strictEqual(service['cacheSize'].cache, 21);
      assert.strictEqual(cacheSizeListener.mock.calls.length, 1);
    });

    it('should leave OIAnalytics compact content untouched', async () => {
      const queueItems = ['1.json', '2.json', '3.json'].map(filename => ({
        filename,
        metadata: { contentType: 'oianalytics', contentSize: 10, numberOfElement: 1 } as CacheMetadata
      }));
      service['queue'] = [...queueItems];
      service['cacheSize'] = { cache: 30, error: 0, archive: 0 };
      readFileMock.mock.mockImplementation(async () => JSON.stringify({ timestamps: ['t'], values: [[1]], references: ['p'] }));

      assert.strictEqual(await service.getCacheContentToSend(10_000), queueItems[0]);

      assert.strictEqual(writeFileMock.mock.calls.length, 0);
      assert.strictEqual(rmMock.mock.calls.length, 0);
      assert.deepStrictEqual(service['queue'], queueItems);
      assert.strictEqual(service['cacheSize'].cache, 30);
      assert.strictEqual(logger.error.mock.calls.length, 0);
    });

    it('should handle remainder by writing to last file', async () => {
      const item1 = { filename: '1.json', metadata: { contentType: 'typeA', contentSize: 10 } as CacheMetadata };
      const item2 = { filename: '2.json', metadata: { contentType: 'typeA', contentSize: 12 } as CacheMetadata };
      service['queue'] = [item1, item2];
      service['cacheSize'] = { cache: 22, error: 0, archive: 0 };
      const cacheSizeListener = mock.fn();
      service.cacheSizeEventEmitter.on('cache-size', cacheSizeListener);

      service['accumulateContent'] = mock.fn(async () => ({
        newListOfContent: [{ a: 1 }],
        remainder: [{ b: 2 }],
        compactedFiles: [item1, item2]
      }));
      const overwriteCacheFile = mock.fn<CacheServiceType['overwriteCacheFile']>(
        seq(
          async () => 11,
          async () => 11
        )
      );
      service['overwriteCacheFile'] = overwriteCacheFile;
      service['deleteCacheEntry'] = mock.fn(async () => undefined);

      await service.compactQueue(1, 'typeA');

      // Verify two writes
      assert.deepStrictEqual(overwriteCacheFile.mock.calls[0].arguments, [item1, [{ a: 1 }]]); // Main batch -> First file
      assert.deepStrictEqual(overwriteCacheFile.mock.calls[1].arguments, [item2, [{ b: 2 }]]); // Remainder -> Last file

      // Queue update: Both should remain in queue because shift() removed item1 and pop() removed item2 from the list to delete
      assert.strictEqual(service['queue'].length, 2);
      // Same bytes, split differently: size unchanged, no event
      assert.strictEqual(service['cacheSize'].cache, 22);
      assert.strictEqual(cacheSizeListener.mock.calls.length, 0);
    });

    it('should orchestrate accumulation with no file compacted', async () => {
      // Setup: 2 items in queue, merge them into 1
      const item1 = { filename: '1.json', metadata: { contentType: 'typeA' } as CacheMetadata };
      const item2 = { filename: '2.json', metadata: { contentType: 'typeA' } as CacheMetadata };
      service['queue'] = [item1, item2];

      // Mocks for helper methods
      const accumulateContent = mock.fn(async () => ({
        newListOfContent: [],
        remainder: [],
        compactedFiles: []
      }));
      service['accumulateContent'] = accumulateContent;
      const overwriteCacheFile = mock.fn(async () => 0);
      service['overwriteCacheFile'] = overwriteCacheFile;
      const deleteCacheEntry = mock.fn(async () => undefined);
      service['deleteCacheEntry'] = deleteCacheEntry;

      await service.compactQueue(100, 'typeA');

      assert.ok(accumulateContent.mock.calls.length > 0);
      assert.strictEqual(overwriteCacheFile.mock.calls.length, 0);
      assert.strictEqual(deleteCacheEntry.mock.calls.length, 0);

      assert.strictEqual(service['queue'].length, 2);
      assert.strictEqual(service['queue'][0], item1);
      assert.strictEqual(service['queue'][1], item2);
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

      service['readCacheMetadataFile'] = mock.fn(async () => metadata);
      const removeCacheContentFromQueue = mock.method(service, 'removeCacheContentFromQueue', () => undefined);
      renameMock.mock.mockImplementation(async () => undefined);

      await service['moveContent']('cache', 'archive', filename);

      assert.strictEqual(renameMock.mock.calls.length, 2); // Content + Metadata
      assert.ok(
        renameMock.mock.calls.some(
          c =>
            String(c.arguments[0]).includes(path.join('cache', 'northId', 'content', filename)) &&
            String(c.arguments[1]).includes(path.join('archive', 'northId', 'content', filename))
        )
      );

      assert.ok(removeCacheContentFromQueue.mock.calls.some(c => c.arguments[0] === filename));
      assert.strictEqual(service['cacheSize'].cache, 0);
      assert.strictEqual(service['cacheSize'].archive, 100);
      assert.ok(logger.trace.mock.calls.some(c => String(c.arguments[0]).includes('moved from cache to archive')));
    });

    it('should add to queue if moving TO cache', async () => {
      const filename = 'file2.json';
      const metadata = { contentSize: 50 } as CacheMetadata;
      service['cacheSize'] = { cache: 0, error: 50, archive: 0 };

      service['readCacheMetadataFile'] = mock.fn(async () => metadata);
      renameMock.mock.mockImplementation(async () => undefined);

      await service['moveContent']('error', 'cache', filename);

      const queue = service['queue'] as Array<{ filename: string }>;
      assert.strictEqual(queue.length, 1);
      assert.strictEqual(queue[0].filename, filename);
      assert.strictEqual(service['cacheSize'].cache, 50);
    });

    it('should handle errors during move', async () => {
      const filename = 'bad-file.json';
      const metadata = { contentSize: 200 } as CacheMetadata;
      service['readCacheMetadataFile'] = mock.fn(async () => metadata);
      renameMock.mock.mockImplementation(async () => {
        throw new Error('Read Error');
      });

      await service['moveContent']('cache', 'error', filename);

      assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while moving files')));
    });

    it('should handle empty metadata', async () => {
      const filename = 'file.json';

      service['readCacheMetadataFile'] = mock.fn(async () => null);

      await service['moveContent']('cache', 'error', filename);

      assert.strictEqual(renameMock.mock.calls.length, 0);
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

      service['readCacheMetadataFile'] = mock.fn(async () => metadata);
      const removeCacheContentFromQueue = mock.method(service, 'removeCacheContentFromQueue', () => undefined);

      // Execute: Remove from 'cache'
      await service['removeContent']('cache', filename);

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
      assert.ok(removeCacheContentFromQueue.mock.calls.some(c => c.arguments[0] === filename));
      assert.strictEqual(service['cacheSize'].cache, 0);
      assert.ok(logger.trace.mock.calls.some(c => String(c.arguments[0]).includes('removed from cache')));
    });

    it('should handle errors during removal', async () => {
      const filename = 'file.json';
      const metadata = { contentSize: 100 } as CacheMetadata;

      service['readCacheMetadataFile'] = mock.fn(async () => metadata);
      service['deleteCacheEntry'] = mock.fn(async () => {
        throw new Error('Rm Error');
      });

      await service['removeContent']('archive', filename);

      assert.ok(logger.error.mock.calls.some(c => String(c.arguments[0]).includes('Error while removing file')));
    });

    it('should handle empty metadata', async () => {
      const filename = 'file.json';

      service['readCacheMetadataFile'] = mock.fn(async () => null);
      const deleteCacheEntry = mock.fn(async () => undefined);
      service['deleteCacheEntry'] = deleteCacheEntry;

      await service['removeContent']('archive', filename);

      assert.strictEqual(deleteCacheEntry.mock.calls.length, 0);
    });
  });

  it('should delete cache entry content before its metadata', async () => {
    await service['deleteCacheEntry']('error', 'file');

    const rmOptions = { recursive: true, force: true, maxRetries: 5, retryDelay: 100 };
    assert.deepStrictEqual(
      rmMock.mock.calls.map(c => c.arguments),
      [
        [path.join(service.errorFolder, CONTENT_FOLDER, 'file'), rmOptions],
        [path.join(service.errorFolder, METADATA_FOLDER, 'file'), rmOptions]
      ]
    );
    assert.strictEqual(logger.warn.mock.calls.length, 0);
  });

  it('should keep the metadata when the cache entry content cannot be deleted', async () => {
    rmMock.mock.mockImplementation(async () => {
      throw new Error('EBUSY');
    });

    await service['deleteCacheEntry']('cache', 'file');

    // The metadata still tracks the content left on disk
    assert.deepStrictEqual(
      rmMock.mock.calls.map(c => c.arguments[0]),
      [path.join(service.cacheFolder, CONTENT_FOLDER, 'file')]
    );
    assert.deepStrictEqual(
      logger.warn.mock.calls.map(c => c.arguments[0]),
      ['Could not delete cache entry "file" from cache: EBUSY']
    );
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

  it('should release the update lock when emptying the cache fails', async () => {
    readdirMock.mock.mockImplementation(async () => {
      throw new Error('readdir error');
    });

    await assert.rejects(service.removeAllCacheContent(), /readdir error/);

    assert.strictEqual(service['updateCache$'], null);
    // The next send is not blocked behind the failed reset
    service['queue'] = [];
    assert.strictEqual(await service.getCacheContentToSend(100), null);
  });

  it('should release the update lock when a cache update fails', async () => {
    service['removeContent'] = mock.fn(async () => {
      throw new Error('remove error');
    });

    await assert.rejects(
      service.updateCacheContent({
        cache: { remove: ['file1'], move: [] },
        error: { remove: [], move: [] },
        archive: { remove: [], move: [] }
      }),
      /remove error/
    );

    assert.strictEqual(service['updateCache$'], null);
    service['queue'] = [];
    assert.strictEqual(await service.getCacheContentToSend(100), null);
  });
});
