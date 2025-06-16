import fs from 'node:fs/promises';
import { createReadStream, ReadStream } from 'node:fs';
import path from 'node:path';

import { createFolder } from '../utils';
import pino from 'pino';
import { EventEmitter } from 'node:events';
import { CacheMetadata, CacheSearchParam } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import DeferredPromise from '../deferred-promise';

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
export default class CacheService {
  public readonly CONTENT_FOLDER = 'content';
  public readonly METADATA_FOLDER = 'metadata';

  private logger: pino.Logger;
  private readonly _cacheFolder: string;
  private readonly _errorFolder: string;
  private readonly _archiveFolder: string;

  private compactQueue$: DeferredPromise | null = null;
  private queue: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];
  private _cacheSizeEventEmitter: EventEmitter = new EventEmitter();

  constructor(logger: pino.Logger, baseCacheFolder: string, baseErrorFolder: string, baseArchiveFolder: string) {
    this.logger = logger;
    this._cacheFolder = path.resolve(baseCacheFolder);
    this._errorFolder = path.resolve(baseErrorFolder);
    this._archiveFolder = path.resolve(baseArchiveFolder);
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
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
    await createFolder(path.join(this.cacheFolder, this.METADATA_FOLDER));
    await createFolder(path.join(this.cacheFolder, this.CONTENT_FOLDER));
    await createFolder(path.join(this.errorFolder, this.METADATA_FOLDER));
    await createFolder(path.join(this.errorFolder, this.CONTENT_FOLDER));
    await createFolder(path.join(this.archiveFolder, this.METADATA_FOLDER));
    await createFolder(path.join(this.archiveFolder, this.CONTENT_FOLDER));

    const contentList = await fs.readdir(path.join(this.cacheFolder, this.METADATA_FOLDER));
    const filesWithCreationDate: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];
    let cacheSize = 0;
    for (const filename of contentList) {
      const filePath = path.join(this.cacheFolder, this.METADATA_FOLDER, filename);
      try {
        const metadata: CacheMetadata = JSON.parse(await fs.readFile(filePath, { encoding: 'utf8' }));
        cacheSize += metadata.contentSize;
        filesWithCreationDate.push({ metadataFilename: filename, metadata });
      } catch (error: unknown) {
        this.logger.error(`Error while reading cache file "${filePath}": ${(error as Error).message}`);
      }
    }
    // Sort the compact queue to have the oldest file first
    this.queue = filesWithCreationDate.sort((a, b) =>
      DateTime.fromISO(a.metadata.createdAt).diff(DateTime.fromISO(b.metadata.createdAt)).toMillis()
    );
    if (this.queue.length > 0) {
      this.logger.info(`${this.queue.length} content in cache`);
    } else {
      this.logger.debug('No content in cache');
    }

    const errorFiles = await fs.readdir(path.join(this.errorFolder, this.METADATA_FOLDER));
    let errorSize = 0;
    if (errorFiles.length > 0) {
      this.logger.warn(`${errorFiles.length} content errored`);
      for (const filename of errorFiles) {
        const filePath = path.join(this.errorFolder, this.METADATA_FOLDER, filename);
        try {
          const metadata: CacheMetadata = JSON.parse(await fs.readFile(filePath, { encoding: 'utf8' }));
          errorSize += metadata.contentSize;
        } catch (error: unknown) {
          this.logger.error(`Error while reading errored file "${filePath}": ${(error as Error).message}`);
        }
      }
    } else {
      this.logger.debug('No content errored');
    }

    const archiveFiles = await fs.readdir(path.join(this.archiveFolder, this.METADATA_FOLDER));
    let archiveSize = 0;
    if (archiveFiles.length > 0) {
      this.logger.debug(`${archiveFiles.length} content archived`);
      for (const filename of archiveFiles) {
        const filePath = path.join(this.archiveFolder, this.METADATA_FOLDER, filename);
        try {
          const metadata: CacheMetadata = JSON.parse(await fs.readFile(filePath, { encoding: 'utf8' }));
          archiveSize += metadata.contentSize;
        } catch (error: unknown) {
          this.logger.error(`Error while reading archived file "${filePath}": ${(error as Error).message}`);
        }
      }
    } else {
      this.logger.debug('No content archived');
    }

    this.cacheSizeEventEmitter.emit('init-cache-size', {
      cacheSizeToAdd: cacheSize,
      errorSizeToAdd: errorSize,
      archiveSizeToAdd: archiveSize
    });
  }

  async getCacheContentToSend(maxGroupCount: number): Promise<{ metadataFilename: string; metadata: CacheMetadata } | null> {
    if (this.compactQueue$) {
      await this.compactQueue$.promise;
    }
    // If there is no file in the queue, return null
    if (this.queue.length === 0) {
      return null;
    }
    // Otherwise, get the first element from the queue

    if (this.queue[0].metadata.contentType !== 'any') {
      await this.compactQueue(maxGroupCount, this.queue[0].metadata.contentType);
    }

    return this.queue[0];
  }

  removeCacheContentFromQueue(contentToRemove: { metadataFilename: string; metadata: CacheMetadata }): void {
    const idx = this.queue.findIndex(file => file.metadataFilename === contentToRemove.metadataFilename);
    if (idx === -1) return;
    this.queue.splice(idx, 1);
  }

  addCacheContentToQueue(cacheContent: { metadataFilename: string; metadata: CacheMetadata }): void {
    this.queue.push(cacheContent);
    this.updateCacheSize(cacheContent.metadata.contentSize, null, 'cache');
  }

  async compactQueue(maxGroupCount: number, contentType: string): Promise<void> {
    if (!this.compactQueue$) {
      this.compactQueue$ = new DeferredPromise();

      // List of queue elements of type contentType
      const copiedQueue: Array<{ metadataFilename: string; metadata: CacheMetadata }> = this.queue.filter(
        element => element.metadata.contentType === contentType
      );
      if (copiedQueue.length === 1) {
        this.compactQueue$.resolve();
        this.compactQueue$ = null;
        return;
      }
      const newListOfContent: Array<object> = [];
      const remainder: Array<object> = [];
      const compactedFiles: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];

      for (const data of copiedQueue) {
        try {
          const content: Array<object> = JSON.parse(
            await fs.readFile(path.join(this.cacheFolder, this.CONTENT_FOLDER, data.metadata.contentFile), { encoding: 'utf-8' })
          );
          compactedFiles.push(data);
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
            if (newListOfContent.length >= maxGroupCount) break;
          }
        } catch (error: unknown) {
          this.logger.error(`Error while reading file "${data.metadata.contentFile}": ${(error as Error).message}`);
          this.queue = this.queue.filter(element => data.metadataFilename !== element.metadataFilename);
          await fs.rm(path.join(this.cacheFolder, this.METADATA_FOLDER, data.metadataFilename), { recursive: true, force: true });
          await fs.rm(path.join(this.cacheFolder, this.CONTENT_FOLDER, data.metadata.contentFile), { recursive: true, force: true });
        }
      }

      if (compactedFiles.length > 0) {
        // It is possible to have an empty compacted files list if the files were corrupted or malformed
        const firstElement = compactedFiles.shift()!;
        const cacheContentFilePath = path.join(this.cacheFolder, this.CONTENT_FOLDER, firstElement.metadata.contentFile);
        await fs.writeFile(cacheContentFilePath, JSON.stringify(newListOfContent), {
          encoding: 'utf-8',
          flag: 'w'
        });

        const fileStat = await fs.stat(cacheContentFilePath);
        await fs.writeFile(
          path.join(this.cacheFolder, this.METADATA_FOLDER, firstElement.metadataFilename),
          JSON.stringify({
            contentFile: firstElement.metadata.contentFile,
            contentSize: fileStat.size,
            numberOfElement: newListOfContent.length,
            createdAt: firstElement.metadata.createdAt,
            contentType: firstElement.metadata.contentType,
            source: firstElement.metadata.source,
            options: firstElement.metadata.options
          }),
          {
            encoding: 'utf-8',
            flag: 'w'
          }
        );

        // Update the metadata of the first element
        const queueElement = this.queue.find(element => element.metadataFilename === firstElement.metadataFilename)!;
        queueElement.metadata.contentSize = fileStat.size;
        queueElement.metadata.numberOfElement = newListOfContent.length;
      }

      if (compactedFiles.length > 0 && remainder.length > 0) {
        const lastElement = compactedFiles.pop()!;
        const cacheContentFilePath = path.join(this.cacheFolder, this.CONTENT_FOLDER, lastElement.metadata.contentFile);
        await fs.writeFile(cacheContentFilePath, JSON.stringify(remainder), {
          encoding: 'utf-8',
          flag: 'w'
        });

        const fileStat = await fs.stat(cacheContentFilePath);
        const metadata: CacheMetadata = {
          contentFile: lastElement.metadata.contentFile,
          contentSize: fileStat.size,
          numberOfElement: remainder.length,
          createdAt: lastElement.metadata.createdAt,
          contentType: lastElement.metadata.contentType,
          source: lastElement.metadata.source,
          options: lastElement.metadata.options
        };
        await fs.writeFile(path.join(this.cacheFolder, this.METADATA_FOLDER, lastElement.metadataFilename), JSON.stringify(metadata), {
          encoding: 'utf-8',
          flag: 'w'
        });

        // Update the metadata of the remainder element
        const queueElement = this.queue.find(element => element.metadataFilename === lastElement.metadataFilename)!;
        queueElement.metadata.contentSize = fileStat.size;
        queueElement.metadata.numberOfElement = remainder.length;
      }

      for (const element of compactedFiles) {
        const cacheMetadataFilePath = path.join(this.cacheFolder, this.METADATA_FOLDER, element.metadataFilename);
        const cacheContentFilePath = path.join(this.cacheFolder, this.CONTENT_FOLDER, element.metadata.contentFile);
        await fs.unlink(cacheMetadataFilePath);
        await fs.unlink(cacheContentFilePath);
      }

      this.queue = this.queue.filter(element => !compactedFiles.includes(element));
      this.compactQueue$.resolve();
      this.compactQueue$ = null;
    }
  }

  getNumberOfElementsInQueue() {
    return this.queue.reduce((sum, element) => sum + element.metadata.numberOfElement, 0);
  }

  getNumberOfRawFilesInQueue() {
    return this.queue.reduce((sum, element) => (element.metadata.numberOfElement === 0 ? sum + 1 : sum), 0);
  }

  cacheIsEmpty(): boolean {
    return this.queue.length === 0;
  }

  async searchCacheContent(
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    if (folder === 'cache' && this.compactQueue$) {
      await this.compactQueue$.promise;
    }
    const cacheContentList: Array<{ metadataFilename: string; metadata: CacheMetadata }> = await this.readCacheMetadataFiles(folder);
    return cacheContentList.filter(
      element =>
        (searchParams.nameContains ? element.metadata.contentFile.toUpperCase().includes(searchParams.nameContains.toUpperCase()) : true) &&
        (searchParams.start ? element.metadata.createdAt >= searchParams.start : true) &&
        (searchParams.end ? element.metadata.createdAt <= searchParams.end : true)
    );
  }

  async metadataFileListToCacheContentList(
    folder: 'cache' | 'archive' | 'error',
    metadataFilenameList: Array<string>
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    const cacheContentList: Array<{ metadataFilename: string; metadata: CacheMetadata }> = await this.readCacheMetadataFiles(folder);
    return cacheContentList.filter(element => metadataFilenameList.includes(element.metadataFilename));
  }

  async getCacheContentFileStream(folder: 'cache' | 'archive' | 'error', filename: string): Promise<ReadStream | null> {
    const resolvedPath = path.resolve(this.getFolder(folder), this.CONTENT_FOLDER, filename);
    // Prevent parent paths injected into the JSON file in cache by checking the start of the path
    if (!resolvedPath.startsWith(path.resolve(this.getFolder(folder), this.CONTENT_FOLDER))) {
      this.logger.error(`Invalid file path "${resolvedPath}" when retrieving cache content file stream`);
      return null;
    }
    try {
      await fs.stat(resolvedPath);
    } catch (error: unknown) {
      this.logger.error(`Error while reading file "${resolvedPath}": ${(error as Error).message}`);
      return null;
    }
    return createReadStream(resolvedPath);
  }

  async removeCacheContent(
    folder: 'cache' | 'archive' | 'error',
    cacheContent: { metadataFilename: string; metadata: CacheMetadata }
  ): Promise<void> {
    const folderPath = this.getFolder(folder);

    if (folder === 'cache') {
      if (this.compactQueue$) {
        await this.compactQueue$.promise;
      }
      this.removeCacheContentFromQueue(cacheContent);
    }
    const metadataFilePath = path.join(folderPath, this.METADATA_FOLDER, cacheContent.metadataFilename);
    const contentFilePath = path.join(folderPath, this.CONTENT_FOLDER, cacheContent.metadata.contentFile);
    try {
      await fs.unlink(contentFilePath);
      await fs.unlink(metadataFilePath);
      this.updateCacheSize(cacheContent.metadata.contentSize, folder, null);
      this.logger.trace(`Files "${cacheContent.metadataFilename}" and "${cacheContent.metadata.contentFile}" removed from ${folder}`);
    } catch (error: unknown) {
      this.logger.error(
        `Error while removing files "${cacheContent.metadataFilename}" and "${cacheContent.metadata.contentFile}" from ${folder}: ${(error as Error).message}`
      );
    }
  }

  async removeAllCacheContent(folder: 'cache' | 'archive' | 'error'): Promise<void> {
    const cacheContentList: Array<{ metadataFilename: string; metadata: CacheMetadata }> = await this.readCacheMetadataFiles(folder);
    for (const cacheContent of cacheContentList) {
      await this.removeCacheContent(folder, cacheContent);
    }
  }

  async moveCacheContent(
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    cacheContent: { metadataFilename: string; metadata: CacheMetadata }
  ): Promise<void> {
    const originFolderPath = this.getFolder(originFolder);
    const destinationFolderPath = this.getFolder(destinationFolder);

    const metadataOriginPath = path.join(originFolderPath, this.METADATA_FOLDER, cacheContent.metadataFilename);
    const metadataDestinationPath = path.join(destinationFolderPath, this.METADATA_FOLDER, cacheContent.metadataFilename);
    const contentOriginPath = path.join(originFolderPath, this.CONTENT_FOLDER, cacheContent.metadata.contentFile);
    const contentDestinationPath = path.join(destinationFolderPath, this.CONTENT_FOLDER, cacheContent.metadata.contentFile);
    try {
      if (originFolder === 'cache') {
        if (this.compactQueue$) {
          await this.compactQueue$.promise;
        }
        this.removeCacheContentFromQueue(cacheContent);
      }
      await fs.rename(contentOriginPath, contentDestinationPath);
      await fs.rename(metadataOriginPath, metadataDestinationPath);

      if (destinationFolder === 'cache') {
        if (this.compactQueue$) {
          await this.compactQueue$.promise;
        }
        this.addCacheContentToQueue(cacheContent);
      }

      this.updateCacheSize(cacheContent.metadata.contentSize, originFolder, destinationFolder);

      this.logger.trace(
        `Files "${cacheContent.metadataFilename}" and "${cacheContent.metadata.contentFile}" moved from ${originFolder} to ${destinationFolder}`
      );
    } catch (error: unknown) {
      this.logger.error(
        `Error while moving files "${cacheContent.metadataFilename}" and "${cacheContent.metadata.contentFile}" from ${originFolder} to ${destinationFolder}: ${(error as Error).message}`
      );
    }
  }

  async moveAllCacheContent(originFolder: 'cache' | 'archive' | 'error', destinationFolder: 'cache' | 'archive' | 'error'): Promise<void> {
    const cacheContentList: Array<{ metadataFilename: string; metadata: CacheMetadata }> = await this.readCacheMetadataFiles(originFolder);
    for (const cacheContent of cacheContentList) {
      await this.moveCacheContent(originFolder, destinationFolder, cacheContent);
    }
  }

  get cacheSizeEventEmitter(): EventEmitter {
    return this._cacheSizeEventEmitter;
  }

  private updateCacheSize(
    size: number,
    originFolder: 'cache' | 'archive' | 'error' | null,
    destinationFolder: 'cache' | 'archive' | 'error' | null
  ) {
    const cacheSize = {
      cacheSizeToAdd: 0,
      errorSizeToAdd: 0,
      archiveSizeToAdd: 0
    };
    switch (originFolder) {
      case 'cache':
        cacheSize.cacheSizeToAdd = -size;
        break;
      case 'error':
        cacheSize.errorSizeToAdd = -size;
        break;
      case 'archive':
        cacheSize.archiveSizeToAdd = -size;
        break;
    }
    switch (destinationFolder) {
      case 'cache':
        cacheSize.cacheSizeToAdd = size;
        break;
      case 'error':
        cacheSize.errorSizeToAdd = size;
        break;
      case 'archive':
        cacheSize.archiveSizeToAdd = size;
        break;
    }
    this.cacheSizeEventEmitter.emit('cache-size', cacheSize);
  }

  private async readCacheMetadataFiles(
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    const filenames = await fs.readdir(path.join(this.getFolder(folder), this.METADATA_FOLDER));

    const cacheMetadataFiles: Array<{ metadataFilename: string; metadata: CacheMetadata }> = [];
    for (const filename of filenames) {
      const filePath = path.join(this.getFolder(folder), this.METADATA_FOLDER, filename);
      try {
        const metadata: CacheMetadata = JSON.parse(await fs.readFile(filePath, { encoding: 'utf8' }));
        cacheMetadataFiles.push({ metadataFilename: filename, metadata });
      } catch (error: unknown) {
        this.logger.error(`Error while reading file "${filePath}": ${(error as Error).message}`);
        try {
          await fs.unlink(filename);
        } catch (unlinkError: unknown) {
          this.logger.error(`Error while removing file "${filePath}": ${(unlinkError as Error).message}`);
        }
      }
    }
    return cacheMetadataFiles;
  }

  private getFolder(folder: 'cache' | 'archive' | 'error') {
    switch (folder) {
      case 'cache':
        return this.cacheFolder;
      case 'archive':
        return this.archiveFolder;
      case 'error':
        return this.errorFolder;
    }
  }
}
