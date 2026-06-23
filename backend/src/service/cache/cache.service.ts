import fs from 'node:fs/promises';
import { createReadStream, createWriteStream, ReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import path from 'node:path';

import { determineContentTypeFromFilename, generateRandomId, processCacheFileContent } from '../utils';
import TypedEventEmitter from '../typed-event-emitter';
import type { CacheSizeEvents } from '../../model/cache.service.model';
import {
  CacheContentUpdateCommand,
  CacheMetadata,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent
} from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import DeferredPromise from '../deferred-promise';
import { CacheSize, CONTENT_FOLDER, METADATA_FOLDER } from '../../model/engine.model';
import type { ILogger } from '../../model/logger.model';
import type { ScopeType } from '../../../shared/model/logs.model';
import { loggerService } from '../logger/logger.service';

const DEBOUNCED_LOG_S = 10_000;
const DEBOUNCED_SIZE_WARNING_S = 60_000;
// Bound for the startup-scan file-read fan-out. Keeps the open-FD count in check
// even when the cache contains tens of thousands of files. Empirical sweet spot
// for SSDs; very small impact below ~16 and diminishing returns above ~64.
const STARTUP_SCAN_CONCURRENCY = 32;

/**
 * Run an async mapper over `items` with at most `limit` operations in flight.
 * Used to read many metadata files in parallel at startup without exhausting
 * file descriptors. Errors per item are surfaced to the caller via the mapper.
 */
const parallelMap = async <T, R>(items: ReadonlyArray<T>, limit: number, fn: (item: T) => Promise<R>): Promise<Array<R>> => {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  };
  const workers: Array<Promise<void>> = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
};

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
export default class CacheService {
  private logger: ILogger;
  private readonly _cacheFolder: string;
  private readonly _errorFolder: string;
  private readonly _archiveFolder: string;

  private updateCache$: DeferredPromise | null = null;
  private queue: Array<{ filename: string; metadata: CacheMetadata }> = [];

  private _queuedElementsCount = 0;
  private _queuedRawFilesCount = 0;
  private _cacheSizeEventEmitter: TypedEventEmitter<CacheSizeEvents> = new TypedEventEmitter<CacheSizeEvents>();
  private cacheSize: CacheSize = {
    cache: 0,
    error: 0,
    archive: 0
  };

  private cacheSizeWarningDebounceFlag = false;
  private cacheSizeWarningDebounceTimeout: NodeJS.Timeout | null = null;
  private cacheLogDebounceFlag = false;
  private cacheLogDebounceTimeout: NodeJS.Timeout | null = null;

  constructor(logger: ILogger, baseCacheFolder: string, baseErrorFolder: string, baseArchiveFolder: string) {
    this.logger = logger;
    this._cacheFolder = path.resolve(baseCacheFolder);
    this._errorFolder = path.resolve(baseErrorFolder);
    this._archiveFolder = path.resolve(baseArchiveFolder);
  }

  refreshLogger(scopeType: ScopeType, id: string, name: string): void {
    this.logger = loggerService.createChildLogger(scopeType, id, name);
  }

  get errorFolder(): string {
    return this._errorFolder;
  }

  get archiveFolder(): string {
    return this._archiveFolder;
  }

  get cacheFolder(): string {
    return this._cacheFolder;
  }

  async start(): Promise<void> {
    // Scan the three independent folders concurrently. Within each folder, the
    // per-file metadata reads are bounded-parallel so we don't blow past the
    // OS file-descriptor limit on caches with tens of thousands of entries.
    const [cacheResult, errorResult, archiveResult] = await Promise.all([
      this.scanCacheFolder(this.cacheFolder, 'cache'),
      this.scanCacheFolder(this.errorFolder, 'error'),
      this.scanCacheFolder(this.archiveFolder, 'archive')
    ]);

    // Sort the queue to have the oldest file first
    this.queue = cacheResult.entries.sort((a, b) =>
      DateTime.fromISO(a.metadata.createdAt).diff(DateTime.fromISO(b.metadata.createdAt)).toMillis()
    );
    this.recomputeQueueCounters();

    if (this.queue.length > 0) {
      this.logger.info(`${this.queue.length} content in cache`);
    } else {
      this.logger.debug('No content in cache');
    }
    if (errorResult.totalFilenames > 0) {
      this.logger.warn(`${errorResult.totalFilenames} content errored`);
    } else {
      this.logger.debug('No content errored');
    }
    if (archiveResult.totalFilenames > 0) {
      this.logger.debug(`${archiveResult.totalFilenames} content archived`);
    } else {
      this.logger.debug('No content archived');
    }

    this.cacheSize = {
      cache: cacheResult.size,
      error: errorResult.size,
      archive: archiveResult.size
    };
    // Publish the freshly-scanned folder sizes so the metrics services pick up any
    // pre-existing backlog. Without this, currentCacheSize/ErrorSize/ArchiveSize stay
    // at 0 until the next add/move/remove, reporting wrong sizes right after startup.
    this.cacheSizeEventEmitter.emit('cache-size', this.cacheSize);
  }

  /**
   * Read every metadata file in a folder using bounded-parallel IO. Files that
   * fail to parse are logged and skipped (matching the previous sequential
   * behaviour). Returns the loaded entries and the aggregated content size.
   */
  private async scanCacheFolder(
    folder: string,
    label: DataFolderType
  ): Promise<{ entries: Array<{ filename: string; metadata: CacheMetadata }>; size: number; totalFilenames: number }> {
    const metadataFolder = path.join(folder, METADATA_FOLDER);
    const filenames = await fs.readdir(metadataFolder);
    if (filenames.length === 0) {
      return { entries: [], size: 0, totalFilenames: 0 };
    }

    // Past-participle phrasing matches the pre-refactor log messages exactly,
    // which downstream operators and tests rely on for grepping.
    const fileLabel = label === 'cache' ? 'cache' : label === 'error' ? 'errored' : 'archived';
    const parsed = await parallelMap(filenames, STARTUP_SCAN_CONCURRENCY, async filename => {
      const filePath = path.join(metadataFolder, filename);
      try {
        const metadata: CacheMetadata = JSON.parse(await fs.readFile(filePath, { encoding: 'utf8' }));
        return { filename, metadata };
      } catch (error: unknown) {
        this.logger.error(`Error while reading ${fileLabel} file "${filePath}": ${(error as Error).message}`);
        return null;
      }
    });

    const entries: Array<{ filename: string; metadata: CacheMetadata }> = [];
    let size = 0;
    for (const p of parsed) {
      if (p) {
        entries.push(p);
        size += p.metadata.contentSize;
      }
    }
    return { entries, size, totalFilenames: filenames.length };
  }

  stop(): void {
    this.cacheSizeWarningDebounceFlag = false;
    if (this.cacheSizeWarningDebounceTimeout) {
      clearTimeout(this.cacheSizeWarningDebounceTimeout);
      this.cacheSizeWarningDebounceTimeout = null;
    }
    this.cacheLogDebounceFlag = false;
    if (this.cacheLogDebounceTimeout) {
      clearTimeout(this.cacheLogDebounceTimeout);
      this.cacheLogDebounceTimeout = null;
    }
    this.cacheSizeEventEmitter.removeAllListeners();
  }

  private async waitCacheUpdateTasks(): Promise<void> {
    if (this.updateCache$) {
      await this.updateCache$.promise;
    }
  }

  async getCacheContentToSend(maxGroupCount: number): Promise<{ filename: string; metadata: CacheMetadata } | null> {
    await this.waitCacheUpdateTasks();

    // If there is no file in the queue, return null
    if (this.queue.length === 0) {
      return null;
    }

    // Decide whether to amortize compaction. Compaction reads ALL same-type
    // queued files and rewrites them; on every send, with a large backlog,
    // that's a lot of disk + JSON parse churn. Skip it when:
    //   - the head file is a raw "any" payload (always sent as-is), OR
    //   - the head file already has enough elements to fill a batch by itself
    //     (nothing for compaction to add — the send will take this one file).
    // `?? 0` keeps the previous behaviour for entries lacking numberOfElement.
    const head = this.queue[0];
    const numberOfElement = head.metadata.numberOfElement ?? 0;
    const shouldCompact = head.metadata.contentType !== 'any' && (maxGroupCount === 0 || numberOfElement < maxGroupCount);
    if (shouldCompact) {
      await this.compactQueue(maxGroupCount, head.metadata.contentType);
    }

    return this.queue[0];
  }

  removeCacheContentFromQueue(filename: string): void {
    const idx = this.queue.findIndex(file => file.filename === filename);
    if (idx === -1) return;
    const removed = this.queue[idx];
    this.queue.splice(idx, 1);
    this.decrementQueueCounters(removed.metadata);
  }

  getNumberOfElementsInQueue(): number {
    return this._queuedElementsCount;
  }

  getNumberOfRawFilesInQueue(): number {
    return this._queuedRawFilesCount;
  }

  private recomputeQueueCounters(): void {
    let elements = 0;
    let rawFiles = 0;
    for (const entry of this.queue) {
      if (entry.metadata.numberOfElement === 0) {
        rawFiles++;
      } else {
        elements += entry.metadata.numberOfElement;
      }
    }
    this._queuedElementsCount = elements;
    this._queuedRawFilesCount = rawFiles;
  }

  private incrementQueueCounters(metadata: CacheMetadata): void {
    if (metadata.numberOfElement === 0) {
      this._queuedRawFilesCount++;
    } else {
      this._queuedElementsCount += metadata.numberOfElement;
    }
  }

  private decrementQueueCounters(metadata: CacheMetadata): void {
    if (metadata.numberOfElement === 0) {
      this._queuedRawFilesCount--;
    } else {
      this._queuedElementsCount -= metadata.numberOfElement;
    }
  }

  async compactQueue(maxGroupCount: number, contentType: string): Promise<void> {
    if (this.updateCache$) {
      // Return existing promise if running
      return this.updateCache$.promise;
    }

    this.updateCache$ = new DeferredPromise();
    try {
      // 1. Filter Queue
      const copiedQueue = this.queue.filter(el => el.metadata.contentType === contentType);
      if (copiedQueue.length <= 1) {
        return; // Nothing to compact
      }

      // 2. Accumulate Data (Read)
      const { newListOfContent, remainder, compactedFiles } = await this.accumulateContent(copiedQueue, maxGroupCount);

      // 3. Write Main Batch
      if (compactedFiles.length > 0) {
        // Reuse the first filename for the main batch
        // shift() removes it from the array so it doesn't get deleted later
        const firstElement = compactedFiles.shift()!;
        await this.overwriteCacheFile(firstElement, newListOfContent);
      }

      // 4. Write Remainder (if any)
      if (compactedFiles.length > 0 && remainder.length > 0) {
        // Reuse the last filename for the remainder
        // pop() removes it from the array so it doesn't get deleted later
        const lastElement = compactedFiles.pop()!;
        await this.overwriteCacheFile(lastElement, remainder);
      }

      // 5. Cleanup Intermediate Files
      // These are the files in the "middle" that were fully merged
      for (const element of compactedFiles) {
        await this.deleteCacheEntry('cache', element.filename);
      }

      // 6. Update Queue Reference
      // Remove the deleted files from the main queue and resync counters: this
      // path mutates many entries (filter + in-place numberOfElement updates in
      // overwriteCacheFile) so a single recompute is cheaper than tracking each
      // delta.
      this.queue = this.queue.filter(el => !compactedFiles.includes(el));
      this.recomputeQueueCounters();
    } finally {
      this.updateCache$.resolve();
      this.updateCache$ = null;
    }
  }

  cacheIsEmpty(): boolean {
    return this.queue.length === 0;
  }

  cacheIsFull(maxSize: number): boolean {
    if (maxSize === 0) {
      return false;
    }
    const totalSize = this.getCacheSize();
    const full = totalSize >= maxSize * 1024 * 1024;
    if (full && !this.cacheSizeWarningDebounceFlag) {
      const sizeMB = Math.floor((totalSize / 1024 / 1024) * 100) / 100;
      this.logger.warn(
        `North cache is exceeding the maximum allowed size (${sizeMB} MB >= ${maxSize} MB). Values will be discarded until cache is emptied.`
      );
      this.cacheSizeWarningDebounceFlag = true;
      if (this.cacheSizeWarningDebounceTimeout) {
        clearTimeout(this.cacheSizeWarningDebounceTimeout);
        this.cacheSizeWarningDebounceTimeout = null;
      }
      this.cacheSizeWarningDebounceTimeout = setTimeout(() => {
        this.cacheSizeWarningDebounceFlag = false;
      }, DEBOUNCED_SIZE_WARNING_S);
    }
    return full;
  }

  getCacheSize(): number {
    return this.cacheSize.cache + this.cacheSize.error + this.cacheSize.archive;
  }

  async searchCacheContent(searchParams: CacheSearchParam): Promise<Omit<CacheSearchResult, 'metrics'>> {
    await this.waitCacheUpdateTasks();
    const cacheList: Array<{ filename: string; metadata: CacheMetadata }> = await this.readCacheMetadataFiles('cache');
    const errorList: Array<{ filename: string; metadata: CacheMetadata }> = await this.readCacheMetadataFiles('error');
    const archiveList: Array<{ filename: string; metadata: CacheMetadata }> = await this.readCacheMetadataFiles('archive');
    return {
      searchDate: DateTime.now().toUTC().toISO(),
      cache: this.filterFile(cacheList, searchParams),
      error: this.filterFile(errorList, searchParams),
      archive: this.filterFile(archiveList, searchParams)
    };
  }

  async getFileFromCache(folder: DataFolderType, filename: string): Promise<FileCacheContent> {
    const contentPath = path.resolve(this.getFolder(folder), CONTENT_FOLDER, filename);
    const metadataPath = path.resolve(this.getFolder(folder), METADATA_FOLDER, filename);
    try {
      const metadata: CacheMetadata = JSON.parse(await fs.readFile(metadataPath, { encoding: 'utf8' }));
      const contentType = determineContentTypeFromFilename(metadata.contentFile);
      const result = await processCacheFileContent(createReadStream(contentPath));
      return {
        content: result.content,
        contentFilename: metadata.contentFile,
        totalSize: metadata.contentSize,
        truncated: result.truncated,
        contentType
      };
    } catch (error: unknown) {
      throw new Error(`Error while reading file "${contentPath}": ${(error as Error).message}`);
    }
  }

  async updateCacheContent(updateCommand: CacheContentUpdateCommand): Promise<void> {
    await this.waitCacheUpdateTasks();
    this.updateCache$ = new DeferredPromise();

    // REMOVE
    for (const filename of updateCommand.cache.remove) {
      await this.removeContent('cache', filename);
    }
    for (const filename of updateCommand.error.remove) {
      await this.removeContent('error', filename);
    }
    for (const filename of updateCommand.archive.remove) {
      await this.removeContent('archive', filename);
    }

    // MOVE
    for (const operation of updateCommand.cache.move) {
      await this.moveContent('cache', operation.to, operation.filename);
    }
    for (const operation of updateCommand.error.move) {
      await this.moveContent('error', operation.to, operation.filename);
    }
    for (const operation of updateCommand.archive.move) {
      await this.moveContent('archive', operation.to, operation.filename);
    }

    this.updateCache$.resolve();
    this.updateCache$ = null;
    this.cacheSizeEventEmitter.emit('cache-size', this.cacheSize);
  }

  async addCacheContent(
    output: Buffer | ReadStream | Readable,
    details: {
      contentFilename?: string;
      numberOfElement?: number;
      contentType: string;
    }
  ): Promise<void> {
    const filename = generateRandomId(12);
    const contentPath = path.join(this.cacheFolder, CONTENT_FOLDER, filename);

    // Compute contentSize as a side-effect of writing rather than via a
    // post-write fs.stat() syscall (saving one round-trip per cache add).
    //   - Buffer:  size is already known.
    //   - Stream:  pipe through a counting Transform during the write.
    let contentSize: number;
    if (Buffer.isBuffer(output)) {
      await fs.writeFile(contentPath, output, { flag: 'w' });
      contentSize = output.length;
    } else {
      let bytes = 0;
      const counter = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          bytes += chunk.length;
          cb(null, chunk);
        }
      });
      await pipeline(output, counter, createWriteStream(contentPath, { flags: 'w' }));
      contentSize = bytes;
    }

    const metadata: CacheMetadata = {
      contentFile: details.contentFilename || `${filename}.json`,
      contentSize,
      // The file was just written, so "now" matches the kernel-reported ctime
      // we used to fetch via fs.stat — but without the syscall.
      createdAt: DateTime.now().toUTC().toISO()!,
      numberOfElement: details.numberOfElement || 0,
      contentType: details.contentType
    };
    await fs.writeFile(path.join(this.cacheFolder, METADATA_FOLDER, filename), JSON.stringify(metadata), {
      encoding: 'utf-8',
      flag: 'w'
    });
    this.queue.push({ filename, metadata });
    this.incrementQueueCounters(metadata);
    this.cacheSize.cache += contentSize;
    this.cacheSizeEventEmitter.emit('cache-size', this.cacheSize);
    // Cumulative counter of all content ever cached — the delta is this file's size.
    this.cacheSizeEventEmitter.emit('cache-content-size', contentSize);
    this.logger.trace(`File "${filename}" added to cache`);
    this.logCacheState(metadata);
  }

  private async moveContent(from: DataFolderType, to: DataFolderType, filename: string): Promise<void> {
    const originFolderPath = this.getFolder(from);
    const destinationFolderPath = this.getFolder(to);

    const metadataOriginPath = path.join(originFolderPath, METADATA_FOLDER, filename);
    const metadataDestinationPath = path.join(destinationFolderPath, METADATA_FOLDER, filename);
    const contentOriginPath = path.join(originFolderPath, CONTENT_FOLDER, filename);
    const contentDestinationPath = path.join(destinationFolderPath, CONTENT_FOLDER, filename);

    if (from === 'cache') {
      this.removeCacheContentFromQueue(filename);
    }
    const metadata = await this.readCacheMetadataFile(from, filename);
    if (!metadata) {
      return;
    }
    try {
      await fs.rename(contentOriginPath, contentDestinationPath);
      await fs.rename(metadataOriginPath, metadataDestinationPath);
      if (to === 'cache') {
        this.queue.push({ filename, metadata });
        this.incrementQueueCounters(metadata);
      }
      this.cacheSize[from] -= metadata.contentSize;
      this.cacheSize[to] += metadata.contentSize;
      this.logger.trace(`File "${filename}" moved from ${from} to ${to}`);
    } catch (error: unknown) {
      this.logger.error(`Error while moving files "${filename}" from ${from} to ${to}: ${(error as Error).message}`);
    }
  }

  private async removeContent(from: DataFolderType, filename: string): Promise<void> {
    if (from === 'cache') {
      this.removeCacheContentFromQueue(filename);
    }
    const metadata = await this.readCacheMetadataFile(from, filename);
    if (!metadata) {
      return;
    }
    try {
      await this.deleteCacheEntry(from, filename);
      this.cacheSize[from] -= metadata.contentSize;
      this.logger.trace(`File "${filename}" removed from ${from}`);
    } catch (error: unknown) {
      this.logger.error(`Error while removing file "${filename}" from ${from}: ${(error as Error).message}`);
    }
  }

  async removeAllCacheContent(): Promise<void> {
    await this.waitCacheUpdateTasks();
    this.updateCache$ = new DeferredPromise();

    const folderList: Array<DataFolderType> = ['cache', 'error', 'archive'];
    for (const folder of folderList) {
      const metadataFolder = path.join(this.getFolder(folder), METADATA_FOLDER);
      const metadataFiles = await fs.readdir(metadataFolder);
      for (const file of metadataFiles) {
        await fs
          .rm(path.join(metadataFolder, file), { force: true, recursive: true })
          .catch(err =>
            this.logger.error(`Could not remove file "${file}" from ${path.join(this.getFolder(folder), METADATA_FOLDER)}: ${err.message}`)
          );
      }

      const contentFolder = path.join(this.getFolder(folder), CONTENT_FOLDER);
      const contentFiles = await fs.readdir(contentFolder);
      for (const file of contentFiles) {
        await fs
          .rm(path.join(contentFolder, file), { force: true, recursive: true })
          .catch(err =>
            this.logger.error(`Could not remove file "${file}" from ${path.join(this.getFolder(folder), CONTENT_FOLDER)}: ${err.message}`)
          );
      }
    }
    this.queue = [];
    this._queuedElementsCount = 0;
    this._queuedRawFilesCount = 0;
    this.cacheSize = {
      cache: 0,
      error: 0,
      archive: 0
    };
    this.cacheSizeEventEmitter.emit('cache-size', this.cacheSize);
    this.updateCache$.resolve();
    this.updateCache$ = null;
  }

  get cacheSizeEventEmitter(): TypedEventEmitter<CacheSizeEvents> {
    return this._cacheSizeEventEmitter;
  }

  /** Snapshot of the current on-disk cache/error/archive sizes — the authoritative gauge source. */
  getCacheContentSizes(): CacheSize {
    return { ...this.cacheSize };
  }

  private async readCacheMetadataFiles(folder: DataFolderType): Promise<Array<{ filename: string; metadata: CacheMetadata }>> {
    const filenames = await fs.readdir(path.join(this.getFolder(folder), METADATA_FOLDER));

    const cacheMetadataFiles: Array<{ filename: string; metadata: CacheMetadata }> = [];
    for (const filename of filenames) {
      const metadata = await this.readCacheMetadataFile(folder, filename);
      if (metadata) {
        cacheMetadataFiles.push({ filename, metadata });
      }
    }
    return cacheMetadataFiles;
  }

  private async readCacheMetadataFile(folder: DataFolderType, filename: string): Promise<CacheMetadata | null> {
    const filePath = path.join(this.getFolder(folder), METADATA_FOLDER, filename);
    try {
      return JSON.parse(await fs.readFile(filePath, { encoding: 'utf8' })) as CacheMetadata;
    } catch (error: unknown) {
      this.logger.error(`Error while reading file "${filePath}": ${(error as Error).message}`);
      await this.deleteCacheEntry(folder, filename);
      return null;
    }
  }

  private getFolder(folder: DataFolderType) {
    switch (folder) {
      case 'cache':
        return this.cacheFolder;
      case 'archive':
        return this.archiveFolder;
      case 'error':
        return this.errorFolder;
    }
  }

  private filterFile(
    list: Array<{ filename: string; metadata: CacheMetadata }>,
    searchParams: CacheSearchParam
  ): Array<{ filename: string; metadata: CacheMetadata }> {
    return list
      .filter(
        element =>
          (searchParams.nameContains ? element.filename.toUpperCase().includes(searchParams.nameContains.toUpperCase()) : true) &&
          (searchParams.start ? element.metadata.createdAt >= searchParams.start : true) &&
          (searchParams.end ? element.metadata.createdAt <= searchParams.end : true)
      )
      .slice(0, searchParams.maxNumberOfFilesReturned || undefined);
  }

  private logCacheState(metadata: CacheMetadata): void {
    // Debounce logging to prevent verbose output during heavy data loads
    if (this.cacheLogDebounceFlag) {
      return;
    }

    const cacheSnapshot = {
      cacheSizeBytes: this.cacheSize.cache,
      errorSizeBytes: this.cacheSize.error,
      archiveSizeBytes: this.cacheSize.archive,
      queuedElements: this.getNumberOfElementsInQueue(),
      queuedRawFiles: this.getNumberOfRawFilesInQueue()
    };

    const cacheSizeMB = Math.floor((cacheSnapshot.cacheSizeBytes / 1024 / 1024) * 100) / 100;
    const errorSizeMB = Math.floor((cacheSnapshot.errorSizeBytes / 1024 / 1024) * 100) / 100;
    const archiveSizeMB = Math.floor((cacheSnapshot.archiveSizeBytes / 1024 / 1024) * 100) / 100;

    this.logger.debug(
      {
        cacheState: {
          ...cacheSnapshot,
          cacheSizeMB,
          errorSizeMB,
          archiveSizeMB
        },
        lastAddedContent: {
          contentType: metadata.contentType,
          numberOfElement: metadata.numberOfElement,
          contentSize: metadata.contentSize
        }
      },
      `Cache updated: ${cacheSnapshot.queuedElements} time-values and ${cacheSnapshot.queuedRawFiles} raw file(s) in queue. ` +
        `Cache: ${cacheSizeMB} MB, Error: ${errorSizeMB} MB, Archive: ${archiveSizeMB} MB`
    );

    // Set debounce flag and reset after 10 seconds
    this.cacheLogDebounceFlag = true;
    if (this.cacheLogDebounceTimeout) {
      clearTimeout(this.cacheLogDebounceTimeout);
    }
    this.cacheLogDebounceTimeout = setTimeout(() => {
      this.cacheLogDebounceFlag = false;
    }, DEBOUNCED_LOG_S);
  }

  private async accumulateContent(
    queueItems: Array<{ filename: string; metadata: CacheMetadata }>,
    maxGroupCount: number
  ): Promise<{
    newListOfContent: Array<object>;
    remainder: Array<object>;
    compactedFiles: Array<{ filename: string; metadata: CacheMetadata }>;
  }> {
    const newListOfContent: Array<object> = [];
    const remainder: Array<object> = [];
    const compactedFiles: Array<{ filename: string; metadata: CacheMetadata }> = [];

    for (const data of queueItems) {
      try {
        const filePath = path.join(this.cacheFolder, CONTENT_FOLDER, data.filename);
        const fileContent = await fs.readFile(filePath, { encoding: 'utf-8' });
        const content: Array<object> = JSON.parse(fileContent);

        compactedFiles.push(data);

        // Grouping Logic
        if (maxGroupCount === 0) {
          for (const element of content) {
            newListOfContent.push(element);
          }
        } else {
          for (const element of content) {
            if (newListOfContent.length < maxGroupCount) {
              newListOfContent.push(element);
            } else {
              remainder.push(element);
            }
          }
          // Stop reading files if we have reached the limit
          if (newListOfContent.length >= maxGroupCount) {
            break;
          }
        }
      } catch (error) {
        this.logger.error(`Error while reading file "${data.filename}": ${(error as Error).message}`);
        await this.deleteCacheEntry('cache', data.filename); // Helper to delete metadata/content
        this.removeCacheContentFromQueue(data.filename);
      }
    }

    return { newListOfContent, remainder, compactedFiles };
  }

  private async overwriteCacheFile(fileData: { filename: string; metadata: CacheMetadata }, newContent: Array<object>): Promise<void> {
    const contentPath = path.join(this.cacheFolder, CONTENT_FOLDER, fileData.filename);
    const metadataPath = path.join(this.cacheFolder, METADATA_FOLDER, fileData.filename);

    // 1. Write Content
    await fs.writeFile(contentPath, JSON.stringify(newContent), { encoding: 'utf-8', flag: 'w' });

    // 2. Get new size
    const fileStat = await fs.stat(contentPath);

    // 3. Update Metadata
    const newMetadata: CacheMetadata = {
      ...fileData.metadata,
      contentSize: fileStat.size,
      numberOfElement: newContent.length
      // Keep original createdAt and contentType
    };

    await fs.writeFile(metadataPath, JSON.stringify(newMetadata), { encoding: 'utf-8', flag: 'w' });

    // 4. Update in-memory queue
    const queueElement = this.queue.find(el => el.filename === fileData.filename);
    if (queueElement) {
      queueElement.metadata = newMetadata;
    }
  }

  private async deleteCacheEntry(folder: DataFolderType, filename: string): Promise<void> {
    try {
      await fs.rm(path.join(this.getFolder(folder), METADATA_FOLDER, filename), { recursive: true, force: true });
      await fs.rm(path.join(this.getFolder(folder), CONTENT_FOLDER, filename), { recursive: true, force: true });
    } catch (error: unknown) {
      // Ignore delete errors
      this.logger.trace(`Error deleting cache entry "${filename}": ${(error as Error).message}`);
    }
  }
}
