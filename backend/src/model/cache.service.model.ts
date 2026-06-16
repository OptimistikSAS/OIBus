import type { ReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import type {
  CacheContentUpdateCommand,
  CacheMetadata,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent
} from '../../shared/model/engine.model';
import type { CacheSize } from './engine.model';
import type TypedEventEmitter from '../service/typed-event-emitter';
import type { ScopeType } from '../../shared/model/logs.model';

/** Events published by a cache service's {@link ICacheService.cacheSizeEventEmitter}. */
export interface CacheSizeEvents {
  /** Current on-disk sizes of the cache/error/archive folders (a gauge). */
  'cache-size': CacheSize;
  /** Size delta of a single file just added to the cache (a counter increment). */
  'cache-content-size': number;
}

export interface ICacheService {
  readonly errorFolder: string;
  readonly archiveFolder: string;
  readonly cacheFolder: string;
  readonly cacheSizeEventEmitter: TypedEventEmitter<CacheSizeEvents>;
  /** Re-creates the internal LoggerProxy for the given scope — call after a connector rename. */
  refreshLogger(scopeType: ScopeType, id: string, name: string): void;
  start(): Promise<void>;
  stop(): void;
  getCacheContentToSend(maxGroupCount: number): Promise<{ filename: string; metadata: CacheMetadata } | null>;
  removeCacheContentFromQueue(filename: string): void;
  compactQueue(maxGroupCount: number, contentType: string): Promise<void>;
  getNumberOfElementsInQueue(): number;
  getNumberOfRawFilesInQueue(): number;
  cacheIsEmpty(): boolean;
  cacheIsFull(maxSize: number): boolean;
  getCacheSize(): number;
  /** Current on-disk sizes of the cache/error/archive folders. Authoritative source for the size gauges. */
  getCacheContentSizes(): CacheSize;
  searchCacheContent(searchParams: CacheSearchParam): Promise<Omit<CacheSearchResult, 'metrics'>>;
  getFileFromCache(folder: DataFolderType, filename: string): Promise<FileCacheContent>;
  updateCacheContent(updateCommand: CacheContentUpdateCommand): Promise<void>;
  addCacheContent(
    output: Buffer | ReadStream | Readable,
    details: { contentFilename?: string; numberOfElement?: number; contentType: string }
  ): Promise<void>;
  removeAllCacheContent(): Promise<void>;
}
