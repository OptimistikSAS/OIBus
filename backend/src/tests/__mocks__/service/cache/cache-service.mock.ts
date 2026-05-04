import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
import {
  CacheMetadata,
  CacheSearchParam,
  CacheContentUpdateCommand,
  DataFolderType,
  FileCacheContent
} from '../../../../../shared/model/engine.model';
import type { ILogger } from '../../../../model/logger.model';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

/**
 * Create a mock object for Cache Service
 */
export default class CacheServiceMock {
  setLogger = mock.fn((_value: ILogger): void => undefined);
  start = mock.fn(async (): Promise<void> => undefined);
  stop = mock.fn((): void => undefined);
  getCacheContentToSend = mock.fn(async (_maxGroupCount: number): Promise<{ filename: string; metadata: CacheMetadata } | null> => null);
  removeCacheContentFromQueue = mock.fn((_filename: string): void => undefined);
  compactQueue = mock.fn(async (_maxGroupCount: number, _contentType: string): Promise<void> => undefined);
  getNumberOfElementsInQueue = mock.fn((): number => 0);
  getNumberOfRawFilesInQueue = mock.fn((): number => 0);
  cacheIsEmpty = mock.fn((): boolean => true);
  cacheIsFull = mock.fn((_maxSize: number): boolean => false);
  getCacheSize = mock.fn((): number => 0);
  searchCacheContent = mock.fn(async (_searchParams: CacheSearchParam): Promise<{ content: Array<CacheMetadata> }> => ({ content: [] }));
  getFileFromCache = mock.fn(async (_folder: DataFolderType, _filename: string): Promise<FileCacheContent> => ({}) as FileCacheContent);
  updateCacheContent = mock.fn(async (_updateCommand: CacheContentUpdateCommand): Promise<void> => undefined);
  addCacheContent = mock.fn(
    async (
      _output: Buffer | ReadStream | Readable,
      _details: { contentFilename?: string; numberOfElement?: number; contentType: string }
    ): Promise<void> => undefined
  );
  removeAllCacheContent = mock.fn(async (): Promise<void> => undefined);
  errorFolder = 'cache';
  archiveFolder = 'error';
  cacheFolder = 'cache';
  cacheSizeEventEmitter = new EventEmitter();
}
