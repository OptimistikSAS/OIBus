import type { EventEmitter } from 'node:events';
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
import type { ILogger } from './logger.model';

export interface ICacheService {
  readonly errorFolder: string;
  readonly archiveFolder: string;
  readonly cacheFolder: string;
  readonly cacheSizeEventEmitter: EventEmitter;
  setLogger(value: ILogger): void;
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
  searchCacheContent(searchParams: CacheSearchParam): Promise<Omit<CacheSearchResult, 'metrics'>>;
  getFileFromCache(folder: DataFolderType, filename: string): Promise<FileCacheContent>;
  updateCacheContent(updateCommand: CacheContentUpdateCommand): Promise<void>;
  addCacheContent(
    output: Buffer | ReadStream | Readable,
    details: { contentFilename?: string; numberOfElement?: number; contentType: string }
  ): Promise<void>;
  removeAllCacheContent(): Promise<void>;
}
