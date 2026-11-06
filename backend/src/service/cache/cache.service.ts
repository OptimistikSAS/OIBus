import { createReadStream, createWriteStream, ReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { DateTime } from 'luxon';

import {
  CacheContentUpdateCommand,
  CacheMetadata,
  CacheMetadataDataSource,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent
} from '../../../shared/model/domain/engine.model';
import type { ScopeType } from '../../../shared/model/domain/logs.model';

import type { CacheSizeEvents } from '../../model/cache.service.model';
import { CacheSize, CONTENT_FOLDER, METADATA_FOLDER } from '../../model/engine.model';
import type { ILogger } from '../../model/logger.model';
import DeferredPromise from '../deferred-promise';
import { loggerService } from '../logger/logger.service';
import TypedEventEmitter from '../typed-event-emitter';
import { determineContentTypeFromFilename, generateRandomId, processCacheFileContent } from '../utils';

const DEBOUNCED_LOG_S = 10_000;
const DEBOUNCED_SIZE_WARNING_S = 60_000;
// Bound for the startup-scan file-read fan-out. Keeps the open-FD count in check
// even when the cache contains tens of thousands of files. Empirical sweet spot
// for SSDs; very small impact below ~16 and diminishing returns above ~64.
const STARTUP_SCAN_CONCURRENCY = 32;
// Content files without metadata younger than this are kept at startup: their metadata may still be being written
const ORPHAN_CONTENT_MIN_AGE_MS = 60_000;
// Retry the removals failing because a file is briefly locked (EBUSY, EPERM...), typically by an antivirus on Windows
const RM_OPTIONS = { recursive: true, force: true, maxRetries: 5, retryDelay: 100 };
// Number of metadata files read before checking whether a search already has enough results
const SEARCH_READ_CHUNK_SIZE = 1_000;

/** Creation time in ms, to sort the queue without parsing dates in the comparator. Unparsable dates sort first. */
const createdAtMillis = (metadata: CacheMetadata): number => {
  const millis = Date.parse(metadata.createdAt);
  return Number.isNaN(millis) ? 0 : millis;
};

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
/** Share of its maximum size a full error or archive folder is reduced to (see `CacheService.enforceFolderMaxSize`) */
const FOLDER_CLEANUP_TARGET_RATIO = 0.9;

export default class CacheService {
  private logger: ILogger;
  private readonly _cacheFolder: string;
  private readonly _errorFolder: string;
  private readonly _archiveFolder: string;

  private updateCache$: DeferredPromise | null = null;
  private queue: Array<{ filename: string; metadata: CacheMetadata }> = [];
  // Once started, the queue mirrors the cache folder: searches read it instead of every metadata file on disk
  private started = false;

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

    // Sort the queue to have the oldest file first. Each date is parsed once: parsing in the comparator blocks the
    // event loop for minutes when the cache holds millions of files
    this.queue = cacheResult.entries
      .map(entry => ({ entry, createdAt: createdAtMillis(entry.metadata) }))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(({ entry }) => entry);
    this.recomputeQueueCounters();
    this.started = true;

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
    const contentFolder = path.join(folder, CONTENT_FOLDER);
    // List the content before the metadata, so that content added in between is never taken for an orphan
    const contentFilenames = await fs.readdir(contentFolder);
    const metadataFilenames = await fs.readdir(metadataFolder);
    await this.removeOrphanContent(contentFolder, contentFilenames, metadataFilenames, label);
    const filenames = await this.removeOrphanMetadata(metadataFolder, contentFolder, contentFilenames, metadataFilenames, label);
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

  /**
   * Remove the metadata files whose content file is gone, and return the metadata files kept. Such an entry can never
   * be sent: as the oldest one in the queue, it was retried forever and blocked everything behind it. It is left behind
   * by a move or a removal interrupted between its content and its metadata (crash, file locked by an antivirus...).
   */
  private async removeOrphanMetadata(
    metadataFolder: string,
    contentFolder: string,
    contentFilenames: Array<string>,
    metadataFilenames: Array<string>,
    label: DataFolderType
  ): Promise<Array<string>> {
    const contentSet = new Set(contentFilenames);
    const candidates = metadataFilenames.filter(filename => !contentSet.has(filename));
    if (candidates.length === 0) {
      return metadataFilenames;
    }

    // Content listed before the metadata: an entry added in between looks like an orphan. Check the disk again
    const missingContent = new Set<string>();
    let removedFiles = 0;
    await parallelMap(candidates, STARTUP_SCAN_CONCURRENCY, async filename => {
      try {
        await fs.stat(path.join(contentFolder, filename));
        return;
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          return;
        }
      }
      // Not kept even if it cannot be removed: its content is gone, it must not be sent
      missingContent.add(filename);
      const metadataPath = path.join(metadataFolder, filename);
      try {
        await fs.rm(metadataPath, RM_OPTIONS);
        removedFiles++;
      } catch (error: unknown) {
        this.logger.warn(`Could not remove metadata file "${metadataPath}" without content: ${(error as Error).message}`);
      }
    });
    if (removedFiles > 0) {
      this.logger.warn(`${removedFiles} metadata file(s) without content removed from ${label} folder`);
    }
    return missingContent.size > 0 ? metadataFilenames.filter(filename => !missingContent.has(filename)) : metadataFilenames;
  }

  /**
   * Remove the content files that have no metadata. Nothing tracks them: they are never sent, searched nor counted in
   * the cache size, so they would stay on disk forever. They are left behind by a write or a removal interrupted midway
   * (failing source stream, full disk, file locked by an antivirus...). Recent files are kept: their metadata may still
   * be being written.
   */
  private async removeOrphanContent(
    contentFolder: string,
    contentFilenames: Array<string>,
    metadataFilenames: Array<string>,
    label: DataFolderType
  ): Promise<void> {
    const trackedFilenames = new Set(metadataFilenames);
    const orphanFilenames = contentFilenames.filter(filename => !trackedFilenames.has(filename));
    if (orphanFilenames.length === 0) {
      return;
    }

    const maxModificationTime = Date.now() - ORPHAN_CONTENT_MIN_AGE_MS;
    let removedFiles = 0;
    let removedSize = 0;
    await parallelMap(orphanFilenames, STARTUP_SCAN_CONCURRENCY, async filename => {
      const filePath = path.join(contentFolder, filename);
      try {
        const fileStat = await fs.stat(filePath);
        if (fileStat.mtimeMs > maxModificationTime) {
          return;
        }
        await fs.rm(filePath, RM_OPTIONS);
        removedFiles++;
        removedSize += fileStat.size;
      } catch (error: unknown) {
        this.logger.warn(`Could not remove content file "${filePath}" without metadata: ${(error as Error).message}`);
      }
    });
    if (removedFiles > 0) {
      const removedSizeMB = Math.floor((removedSize / 1024 / 1024) * 100) / 100;
      this.logger.warn(`${removedFiles} content file(s) without metadata removed from ${label} folder (${removedSizeMB} MB)`);
    }
  }

  stop(): void {
    this.started = false;
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

    // Return null when there is no file in the queue
    while (this.queue.length > 0) {
      // Decide whether to amortize compaction. Compaction reads ALL same-type
      // queued files and rewrites them; on every send, with a large backlog,
      // that's a lot of disk + JSON parse churn. Skip it when:
      //   - the head file is a raw "file" payload (always sent as-is), OR
      //   - the head file already has enough elements to fill a batch by itself
      //     (nothing for compaction to add — the send will take this one file).
      // `?? 0` keeps the previous behaviour for entries lacking numberOfElement.
      const head = this.queue[0];
      const numberOfElement = head.metadata.numberOfElement ?? 0;
      const shouldCompact = head.metadata.contentType !== 'file' && (maxGroupCount === 0 || numberOfElement < maxGroupCount);
      if (shouldCompact) {
        await this.compactQueue(maxGroupCount, head.metadata.contentType, head.metadata.dataSource?.id ?? null);
      }

      const contentToSend = this.queue[0];
      if (!contentToSend) {
        return null;
      }
      // Sending a missing content file fails like a network error: it would be retried forever, blocking the queue
      if (await this.contentExists(contentToSend.filename)) {
        return contentToSend;
      }
      this.removeEntryWithoutContent(contentToSend);
      await this.deleteCacheEntry('cache', contentToSend.filename);
    }
    return null;
  }

  private async contentExists(filename: string): Promise<boolean> {
    try {
      await fs.stat(path.join(this.cacheFolder, CONTENT_FOLDER, filename));
      return true;
    } catch (error: unknown) {
      // Other errors (file locked...) are left to the send, which reports and retries them
      return (error as NodeJS.ErrnoException).code !== 'ENOENT';
    }
  }

  private removeEntryWithoutContent(entry: { filename: string; metadata: CacheMetadata }): void {
    this.logger.error(
      `Content file of cache entry "${entry.filename}" (${entry.metadata.contentFile}) not found: removing it from the cache`
    );
    this.removeCacheContentFromQueue(entry.filename);
    this.cacheSize.cache -= entry.metadata.contentSize;
    this.cacheSizeEventEmitter.emit('cache-size', this.cacheSize);
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
      if (isRawFile(entry.metadata)) {
        rawFiles++;
      } else {
        elements += entry.metadata.numberOfElement;
      }
    }
    this._queuedElementsCount = elements;
    this._queuedRawFilesCount = rawFiles;
  }

  private incrementQueueCounters(metadata: CacheMetadata): void {
    if (isRawFile(metadata)) {
      this._queuedRawFilesCount++;
    } else {
      this._queuedElementsCount += metadata.numberOfElement;
    }
  }

  private decrementQueueCounters(metadata: CacheMetadata): void {
    if (isRawFile(metadata)) {
      this._queuedRawFilesCount--;
    } else {
      this._queuedElementsCount -= metadata.numberOfElement;
    }
  }

  /**
   * Merge queued files of the same content type and coming from the same data source (see `CacheMetadata.dataSource`).
   * Files from different data sources are never merged, so that each sent batch has a single source.
   */
  async compactQueue(maxGroupCount: number, contentType: string, dataSourceId: string | null = null): Promise<void> {
    if (this.updateCache$) {
      // Return existing promise if running
      return this.updateCache$.promise;
    }

    this.updateCache$ = new DeferredPromise();
    try {
      // 1. Filter Queue
      const copiedQueue = this.queue.filter(
        el => el.metadata.contentType === contentType && (el.metadata.dataSource?.id ?? null) === dataSourceId
      );
      if (copiedQueue.length <= 1) {
        return; // Nothing to compact
      }

      // 2. Accumulate Data (Read)
      const cacheSizeBefore = this.cacheSize.cache;
      const { newListOfContent, remainder, compactedFiles } = await this.accumulateContent(copiedQueue, maxGroupCount);
      // Size of every file about to be rewritten or deleted, taken before overwriteCacheFile swaps their metadata
      const previousSize = compactedFiles.reduce((total, element) => total + element.metadata.contentSize, 0);
      let newSize = 0;

      // 3. Write Main Batch
      if (compactedFiles.length > 0) {
        // Reuse the first filename for the main batch
        // shift() removes it from the array so it doesn't get deleted later
        const firstElement = compactedFiles.shift()!;
        newSize += await this.overwriteCacheFile(firstElement, newListOfContent);
      }

      // 4. Write Remainder (if any)
      if (compactedFiles.length > 0 && remainder.length > 0) {
        // Reuse the last filename for the remainder
        // pop() removes it from the array so it doesn't get deleted later
        const lastElement = compactedFiles.pop()!;
        newSize += await this.overwriteCacheFile(lastElement, remainder);
      }

      // 5. Cleanup Intermediate Files
      // These are the files in the "middle" that were fully merged
      await parallelMap(compactedFiles, STARTUP_SCAN_CONCURRENCY, element => this.deleteCacheEntry('cache', element.filename));

      // 6. Update Queue Reference
      // Remove the deleted files from the main queue and resync counters: this
      // path mutates many entries (filter + in-place numberOfElement updates in
      // overwriteCacheFile) so a single recompute is cheaper than tracking each
      // delta. A Set keeps the filter linear: thousands of merged files against
      // a queue of millions would otherwise block the event loop for seconds.
      const mergedFiles = new Set(compactedFiles);
      this.queue = this.queue.filter(el => !mergedFiles.has(el));
      this.recomputeQueueCounters();

      // 7. Resync the cache size: merged files drop their per-file JSON brackets, and unreadable
      // files were deleted, so the bytes on disk no longer match what was counted when they were added
      this.cacheSize.cache += newSize - previousSize;
      if (this.cacheSize.cache !== cacheSizeBefore) {
        this.cacheSizeEventEmitter.emit('cache-size', this.cacheSize);
      }
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
    // Only the cache folder counts: the error and archive folders have their own limits (see enforceFolderMaxSize)
    const totalSize = this.cacheSize.cache;
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

  async searchCacheContent(searchParams: CacheSearchParam): Promise<Omit<CacheSearchResult, 'metrics'>> {
    await this.waitCacheUpdateTasks();
    // The cache folder is mirrored by the in-memory queue (oldest first): no need to read its metadata files again
    const cache = this.started
      ? this.filterFile(this.queue, searchParams).map(({ filename, metadata }) => ({ filename, metadata }))
      : await this.searchMetadataFiles('cache', searchParams);
    const [error, archive] = await Promise.all([
      this.searchMetadataFiles('error', searchParams),
      this.searchMetadataFiles('archive', searchParams)
    ]);
    return {
      searchDate: DateTime.now().toUTC().toISO(),
      cache,
      error,
      archive
    };
  }

  /**
   * Read the metadata files of a folder in parallel, chunk by chunk, and stop as soon as enough of them match: the
   * folder may hold millions of files, and reading them all (one at a time) kept a search running for hours.
   */
  private async searchMetadataFiles(
    folder: DataFolderType,
    searchParams: CacheSearchParam
  ): Promise<Array<{ filename: string; metadata: CacheMetadata }>> {
    const maxResults = searchParams.maxNumberOfFilesReturned || Infinity;
    const filenames = (await fs.readdir(path.join(this.getFolder(folder), METADATA_FOLDER))).filter(filename =>
      this.matchesFilename(filename, searchParams)
    );

    const results: Array<{ filename: string; metadata: CacheMetadata }> = [];
    for (let i = 0; i < filenames.length && results.length < maxResults; i += SEARCH_READ_CHUNK_SIZE) {
      const chunk = filenames.slice(i, i + SEARCH_READ_CHUNK_SIZE);
      const metadataList = await parallelMap(chunk, STARTUP_SCAN_CONCURRENCY, filename => this.readCacheMetadataFile(folder, filename));
      for (let j = 0; j < chunk.length && results.length < maxResults; j++) {
        const metadata = metadataList[j];
        if (metadata && this.matchesDates(metadata, searchParams)) {
          results.push({ filename: chunk[j], metadata });
        }
      }
    }
    return results;
  }

  private async readCacheMetadataFiles(folder: DataFolderType): Promise<Array<{ filename: string; metadata: CacheMetadata }>> {
    const filenames = await fs.readdir(path.join(this.getFolder(folder), METADATA_FOLDER));
    const metadataList = await parallelMap(filenames, STARTUP_SCAN_CONCURRENCY, filename => this.readCacheMetadataFile(folder, filename));
    return filenames.flatMap((filename, index) => {
      const metadata = metadataList[index];
      return metadata ? [{ filename, metadata }] : [];
    });
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

    try {
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
    } finally {
      // Always release: an unreleased lock blocks getCacheContentToSend forever and the north stops sending
      this.updateCache$.resolve();
      this.updateCache$ = null;
    }
    this.cacheSizeEventEmitter.emit('cache-size', this.cacheSize);
  }

  async addCacheContent(
    output: Buffer | ReadStream | Readable,
    details: {
      contentFilename?: string;
      numberOfElement?: number;
      contentType: string;
      dataSource?: CacheMetadataDataSource | null;
    }
  ): Promise<void> {
    const filename = generateRandomId(12);
    const contentPath = path.join(this.cacheFolder, CONTENT_FOLDER, filename);

    // Compute contentSize as a side-effect of writing rather than via a
    // post-write fs.stat() syscall (saving one round-trip per cache add).
    //   - Buffer:  size is already known.
    //   - Stream:  pipe through a counting Transform during the write.
    let contentSize: number;
    let metadata: CacheMetadata;
    try {
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

      metadata = {
        contentFile: details.contentFilename || `${filename}.json`,
        contentSize,
        // The file was just written, so "now" matches the kernel-reported ctime
        // we used to fetch via fs.stat — but without the syscall.
        createdAt: DateTime.now().toUTC().toISO()!,
        numberOfElement: details.numberOfElement || 0,
        contentType: details.contentType,
        dataSource: details.dataSource ?? null
      };
      await fs.writeFile(path.join(this.cacheFolder, METADATA_FOLDER, filename), JSON.stringify(metadata), {
        encoding: 'utf-8',
        flag: 'w'
      });
    } catch (error: unknown) {
      // Do not leave a partial content file behind: without its metadata, nothing would ever send or remove it
      await this.deleteCacheEntry('cache', filename);
      throw error;
    }
    this.queue.push({ filename, metadata });
    this.incrementQueueCounters(metadata);
    this.cacheSize.cache += contentSize;
    this.cacheSizeEventEmitter.emit('cache-size', this.cacheSize);
    // Cumulative counter of all content ever cached — the delta is this file's size.
    this.cacheSizeEventEmitter.emit('cache-content-size', contentSize);
    this.logger.trace(`File "${filename}" added to cache`);
    this.logCacheState(metadata);
  }

  /**
   * When the error or archive folder exceeds `maxSize` (in MB, 0 means no limit), remove its oldest files until it is
   * back under {@link FOLDER_CLEANUP_TARGET_RATIO} of the limit. Freeing more than strictly needed avoids rescanning the
   * whole folder on every file moved into a full folder.
   */
  async enforceFolderMaxSize(folder: 'error' | 'archive', maxSize: number): Promise<void> {
    if (maxSize <= 0 || this.cacheSize[folder] <= maxSize * 1024 * 1024) {
      return;
    }
    const target = maxSize * 1024 * 1024 * FOLDER_CLEANUP_TARGET_RATIO;
    await this.waitCacheUpdateTasks();
    this.updateCache$ = new DeferredPromise();
    try {
      const files = (await this.readCacheMetadataFiles(folder)).sort((a, b) => a.metadata.createdAt.localeCompare(b.metadata.createdAt));
      let removed = 0;
      for (const file of files) {
        if (this.cacheSize[folder] <= target) {
          break;
        }
        await this.removeContent(folder, file.filename);
        removed++;
      }
      if (removed > 0) {
        this.logger.warn(`${removed} file(s) removed from the ${folder} folder to keep it under ${maxSize} MB`);
        this.cacheSizeEventEmitter.emit('cache-size', this.cacheSize);
      }
    } finally {
      this.updateCache$.resolve();
      this.updateCache$ = null;
    }
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

    try {
      const folderList: Array<DataFolderType> = ['cache', 'error', 'archive'];
      for (const folder of folderList) {
        const metadataFolder = path.join(this.getFolder(folder), METADATA_FOLDER);
        const metadataFiles = await fs.readdir(metadataFolder);
        for (const file of metadataFiles) {
          await fs
            .rm(path.join(metadataFolder, file), { force: true, recursive: true })
            .catch(err =>
              this.logger.error(
                `Could not remove file "${file}" from ${path.join(this.getFolder(folder), METADATA_FOLDER)}: ${err.message}`
              )
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
    } finally {
      // Always release, even if a folder cannot be listed: an unreleased lock blocks getCacheContentToSend
      // forever and the north stops sending
      this.updateCache$.resolve();
      this.updateCache$ = null;
    }
  }

  get cacheSizeEventEmitter(): TypedEventEmitter<CacheSizeEvents> {
    return this._cacheSizeEventEmitter;
  }

  /** Snapshot of the current on-disk cache/error/archive sizes — the authoritative gauge source. */
  getCacheContentSizes(): CacheSize {
    return { ...this.cacheSize };
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
    const maxResults = searchParams.maxNumberOfFilesReturned || Infinity;
    const results: Array<{ filename: string; metadata: CacheMetadata }> = [];
    for (const element of list) {
      if (results.length >= maxResults) {
        break;
      }
      if (this.matchesFilename(element.filename, searchParams) && this.matchesDates(element.metadata, searchParams)) {
        results.push(element);
      }
    }
    return results;
  }

  private matchesFilename(filename: string, searchParams: CacheSearchParam): boolean {
    return searchParams.nameContains ? filename.toUpperCase().includes(searchParams.nameContains.toUpperCase()) : true;
  }

  private matchesDates(metadata: CacheMetadata, searchParams: CacheSearchParam): boolean {
    return (
      (searchParams.start ? metadata.createdAt >= searchParams.start : true) &&
      (searchParams.end ? metadata.createdAt <= searchParams.end : true)
    );
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
      `Cache updated: ${cacheSnapshot.queuedElements} element(s) and ${cacheSnapshot.queuedRawFiles} raw file(s) in queue. ` +
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
        const content: unknown = JSON.parse(fileContent);
        // Only arrays can be merged: other content (e.g. the OIAnalytics compact format) is valid and sent as it is.
        // Stop there to keep the sending order
        if (!Array.isArray(content)) {
          break;
        }

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
        this.cacheSize.cache -= data.metadata.contentSize;
      }
    }

    return { newListOfContent, remainder, compactedFiles };
  }

  /** Rewrite a cache file with `newContent` and return its new size in bytes. */
  private async overwriteCacheFile(fileData: { filename: string; metadata: CacheMetadata }, newContent: Array<object>): Promise<number> {
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
    return fileStat.size;
  }

  private async deleteCacheEntry(folder: DataFolderType, filename: string): Promise<void> {
    try {
      // Remove the content first: if it cannot be removed, the metadata kept on disk still tracks it, instead of leaving
      // an orphan content file that nothing would ever remove
      await fs.rm(path.join(this.getFolder(folder), CONTENT_FOLDER, filename), RM_OPTIONS);
      await fs.rm(path.join(this.getFolder(folder), METADATA_FOLDER, filename), RM_OPTIONS);
    } catch (error: unknown) {
      this.logger.warn(`Could not delete cache entry "${filename}" from ${folder}: ${(error as Error).message}`);
    }
  }
}

/**
 * Files (whatever they contain, even values transformed into a CSV file) are counted by the number of files trigger,
 * every other content type by the number of elements trigger.
 */
const isRawFile = (metadata: CacheMetadata): boolean => metadata.contentType === 'file';
