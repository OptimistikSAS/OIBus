import fs from 'node:fs/promises';
import { createReadStream, ReadStream } from 'node:fs';
import path from 'node:path';

import { createFolder, getFilesFiltered } from '../utils';
import pino from 'pino';

import { Instant } from '../../../shared/model/types';
import { NorthCacheFiles } from '../../../shared/model/north-connector.model';
import { EventEmitter } from 'node:events';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';

const FILE_FOLDER = 'files';
const ARCHIVE_TIMEOUT = 600_000; // check if archive must be emptied every 10 minutes
const ARCHIVE_TIMEOUT_INIT = 10_000; // Wait a little at North start up

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
export default class FileCacheService {
  private _logger: pino.Logger;
  private readonly _cacheFolder: string;
  private readonly _errorFolder: string;
  private readonly _archiveFolder: string;

  private filesQueue: Array<string> = [];

  private _triggerRun: EventEmitter = new EventEmitter();

  private archiveTimeout: NodeJS.Timeout | undefined = undefined;

  constructor(
    logger: pino.Logger,
    baseCacheFolder: string,
    baseErrorFolder: string,
    baseArchiveFolder: string,
    private _settings: NorthConnectorEntity<NorthSettings>
  ) {
    this._logger = logger;
    this._cacheFolder = path.resolve(baseCacheFolder, FILE_FOLDER);
    this._errorFolder = path.resolve(baseErrorFolder, FILE_FOLDER);
    this._archiveFolder = path.resolve(baseArchiveFolder, FILE_FOLDER);

    // Remove old files from archive even if the connector is not enabled
    if (this._settings.caching.rawFiles.archive.retentionDuration > 0) {
      // refresh the archiveFolder at the beginning only if retentionDuration is different from 0
      this.archiveTimeout = setTimeout(this.refreshArchiveFolder.bind(this), ARCHIVE_TIMEOUT_INIT);
    }
  }

  setLogger(value: pino.Logger) {
    this._logger = value;
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

  /**
   * Create folders and check errors files
   */
  async start(): Promise<void> {
    await createFolder(this._cacheFolder);
    await createFolder(this._errorFolder);
    await createFolder(this._archiveFolder);

    const files = await fs.readdir(this._cacheFolder);
    const filesWithCreationDate: Array<{ filename: string; createdAt: number }> = [];
    for (const filename of files) {
      try {
        const fileStat = await fs.stat(path.resolve(this._cacheFolder, filename));
        filesWithCreationDate.push({ filename: path.resolve(this._cacheFolder, filename), createdAt: fileStat.ctimeMs });
      } catch (error: unknown) {
        // If a file is being written or corrupted, the stat method can fail
        // An error is logged and the cache goes through the other files
        this._logger.error(`Error while reading cache file "${path.resolve(this._cacheFolder, filename)}": ${(error as Error).message}`);
      }
    }
    // Sort the compact queue to have the oldest file first
    this.filesQueue = filesWithCreationDate.sort((a, b) => a.createdAt - b.createdAt).map(file => file.filename);
    if (this.filesQueue.length > 0) {
      this._logger.debug(`${this.filesQueue.length} files in cache`);
      if (this._settings.caching.rawFiles.sendFileImmediately) {
        this._logger.trace(`Trigger next file send`);
        this.triggerRun.emit('next');
      }
    } else {
      this._logger.debug('No files in cache');
    }

    const errorFiles = await fs.readdir(this._errorFolder);
    if (errorFiles.length > 0) {
      this._logger.warn(`${errorFiles.length} files in error cache`);
    } else {
      this._logger.debug('No error file in cache');
    }
  }

  /**
   * Retrieve the file from the queue
   */
  getFileToSend(): string | null {
    // If there is no file in the queue, return null
    if (this.filesQueue.length === 0) {
      return null;
    }
    // Otherwise, get the first element from the queue
    const [queueFile] = this.filesQueue;
    return path.resolve(this._cacheFolder, queueFile);
  }

  /**
   * Removes files from the queue.
   *
   * If no filePath is given, the first element is removed
   * @param filePath
   * @returns
   */
  removeFileFromQueue(filePath: string | null = null): void {
    if (filePath) {
      const idx = this.filesQueue.findIndex(file => file === filePath);
      if (idx === -1) return;

      this.filesQueue.splice(idx, 1);
    } else {
      this.filesQueue.shift();
      if (this.filesQueue.length > 0 && this._settings.caching.rawFiles.sendFileImmediately) {
        this._logger.trace(`There are ${this.filesQueue.length} files in queue left. Triggering next send`);
        this.triggerRun.emit('next');
      }
    }
  }

  /**
   * Cache a new file from a South connector
   */
  async cacheFile(filePath: string, appendTimestamp = true): Promise<void> {
    const timestamp = new Date().getTime();
    // When compressed file is received the name looks like filename.txt.gz
    const filenameInfo = path.parse(filePath);

    const cacheFilename = appendTimestamp
      ? `${filenameInfo.name}-${timestamp}${filenameInfo.ext}`
      : `${filenameInfo.name}${filenameInfo.ext}`;
    const cachePath = path.resolve(this._cacheFolder, cacheFilename);

    await fs.copyFile(filePath, cachePath);
    const fileStat = await fs.stat(cachePath);
    this.triggerRun.emit('cache-size', { cacheSizeToAdd: fileStat.size, errorSizeToAdd: 0, archiveSizeToAdd: 0 });

    // Add the file to the queue once it is persisted in the cache folder
    this.filesQueue.push(cachePath);
    this._logger.debug(`File "${filePath}" cached in "${cachePath}"`);
    if (this._settings.caching.rawFiles.sendFileImmediately) {
      this.triggerRun.emit('next');
    }
  }

  /**
   * Move the file from North cache folder to its error folder
   */
  async manageErroredFiles(filePathInCache: string, errorCount: number): Promise<void> {
    const filenameInfo = path.parse(filePathInCache);
    const errorPath = path.resolve(this._errorFolder, filenameInfo.base);
    try {
      const fileStat = await fs.stat(errorPath);
      await fs.rename(filePathInCache, errorPath);
      this.triggerRun.emit('cache-size', { cacheSizeToAdd: -fileStat.size, errorSizeToAdd: fileStat.size, archiveSizeToAdd: 0 });
      this._logger.warn(`File "${filePathInCache}" moved to "${errorPath}" after ${errorCount} errors`);
    } catch (renameError: unknown) {
      this._logger.error(`Error while moving file "${filePathInCache}" to "${errorPath}": ${(renameError as Error).message}`);
    }
    this.removeFileFromQueue(filePathInCache);
  }

  /**
   * Remove file from North connector cache and place it to archive folder if enabled.
   */
  async archiveOrRemoveFile(filePathInCache: string): Promise<void> {
    this.removeFileFromQueue(filePathInCache);
    if (this._settings.caching.rawFiles.archive.enabled) {
      const filenameInfo = path.parse(filePathInCache);
      const archivePath = path.resolve(this._archiveFolder, filenameInfo.base);
      // Move cache file into the archive folder
      try {
        const fileStat = await fs.stat(path.resolve(filePathInCache));
        await fs.rename(filePathInCache, archivePath);
        this.triggerRun.emit('cache-size', { cacheSizeToAdd: -fileStat.size, errorSizeToAdd: 0, archiveSizeToAdd: fileStat.size });
        this._logger.debug(`File "${filePathInCache}" moved to archive folder "${archivePath}"`);
      } catch (error: unknown) {
        this._logger.error(`Could not move "${filePathInCache}" from cache: ${(error as Error).message}`);
      }
    } else {
      // Delete original file
      try {
        const fileStat = await fs.stat(path.resolve(filePathInCache));
        await fs.unlink(filePathInCache);
        this.triggerRun.emit('cache-size', { cacheSizeToAdd: -fileStat.size, errorSizeToAdd: 0, archiveSizeToAdd: 0 });
        this._logger.debug(`File "${filePathInCache}" removed from disk`);
      } catch (error) {
        this._logger.error(`Could not remove "${filePathInCache}" from cache: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Check if the file cache is empty or not
   */
  async isEmpty(): Promise<boolean> {
    let files = [];
    try {
      files = await fs.readdir(this._cacheFolder);
    } catch (error) {
      // Log an error if the folder does not exist (removed by the user while OIBus is running for example)
      this._logger.error(error);
    }
    return files.length === 0;
  }

  /**
   * Get list of error files.
   */
  async getErrorFiles(fromDate: Instant | null, toDate: Instant | null, nameFilter: string | null): Promise<Array<NorthCacheFiles>> {
    return await getFilesFiltered(this._errorFolder, fromDate, toDate, nameFilter, this._logger);
  }

  /**
   * Get error file content.
   */
  async getErrorFileContent(filename: string): Promise<ReadStream | null> {
    try {
      await fs.stat(path.resolve(this._errorFolder, filename));
    } catch (error) {
      this._logger.error(`Error while reading file "${path.resolve(this._errorFolder, filename)}": ${error}`);
      return null;
    }
    return createReadStream(path.resolve(this._errorFolder, filename));
  }

  async getArchiveFiles(fromDate: Instant | null, toDate: Instant | null, nameFilter: string | null): Promise<Array<NorthCacheFiles>> {
    return await getFilesFiltered(this._archiveFolder, fromDate, toDate, nameFilter, this._logger);
  }

  async getArchiveFileContent(filename: string): Promise<ReadStream | null> {
    try {
      await fs.stat(path.resolve(this.archiveFolder, filename));
    } catch (error: unknown) {
      this._logger.error(`Error while reading file "${path.resolve(this.archiveFolder, filename)}": ${(error as Error).message}`);
      return null;
    }
    return createReadStream(path.resolve(this.archiveFolder, filename));
  }

  async removeCacheFiles(filenames: Array<string>): Promise<void> {
    for (const filename of filenames) {
      const filePath = path.resolve(this.cacheFolder, filename);
      try {
        this._logger.debug(`Removing cache file "${filePath}`);
        const fileStat = await fs.stat(filePath);
        await fs.unlink(filePath);
        this.removeFileFromQueue(filePath);
        this.triggerRun.emit('cache-size', { cacheSizeToAdd: -fileStat.size, errorSizeToAdd: 0, archiveSizeToAdd: 0 });
      } catch (error: unknown) {
        this._logger.error(`Error while removing cache file "${filePath}": ${(error as Error).message}`);
      }
    }
  }

  async removeErrorFiles(filenames: Array<string>): Promise<void> {
    for (const filename of filenames) {
      const filePath = path.resolve(this.errorFolder, filename);
      try {
        this._logger.debug(`Removing error file "${filePath}`);
        const fileStat = await fs.stat(filePath);
        await fs.unlink(filePath);
        this.triggerRun.emit('cache-size', { cacheSizeToAdd: 0, errorSizeToAdd: -fileStat.size, archiveSizeToAdd: 0 });
      } catch (error: unknown) {
        this._logger.error(`Error while removing error file "${filePath}": ${(error as Error).message}`);
      }
    }
  }

  /**
   * Check the modified time of a file (referenceDate in ms) and remove it if older than the retention duration
   */
  async removeFileFromArchiveIfTooOld(filename: string, referenceDate: number, archiveFolder: string) {
    let stats;
    try {
      // If a file is being written or corrupted, the stat method can fail an error is logged
      stats = await fs.stat(path.resolve(archiveFolder, filename));
    } catch (error: unknown) {
      this._logger.error(`Could not read stats from archive file "${path.resolve(archiveFolder, filename)}": ${(error as Error).message}`);
    }
    if (stats && stats.mtimeMs + this._settings.caching.rawFiles.archive.retentionDuration < referenceDate) {
      const filePath = path.resolve(archiveFolder, filename);
      try {
        const fileStat = await fs.stat(filePath);
        await fs.unlink(filePath);
        this._logger.debug(`File "${path.resolve(archiveFolder, filename)}" removed from archive`);
        this.triggerRun.emit('cache-size', { cacheSizeToAdd: 0, errorSizeToAdd: 0, archiveSizeToAdd: -fileStat.size });
      } catch (error: unknown) {
        this._logger.error(`Could not remove old file "${filePath}" from archive: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Delete files in archiveFolder if they are older thant the retention time.
   */
  async refreshArchiveFolder(): Promise<void> {
    this._logger.trace('Parse archive folder to remove old files');
    // If a timeout already runs, clear it
    clearTimeout(this.archiveTimeout);

    // (Re)create the archive folder here in case it has been manually remove by the user
    await createFolder(this._archiveFolder);

    let files: Array<string> = [];
    try {
      files = await fs.readdir(this._archiveFolder);
    } catch (error: unknown) {
      // If the archive folder doest not exist (removed by the user for example), an error is logged
      this._logger.error(`Error reading archive folder "${this._archiveFolder}": ${(error as Error).message}`);
    }
    if (files.length > 0) {
      const referenceDate = new Date().getTime();

      for (const file of files) {
        await this.removeFileFromArchiveIfTooOld(file, referenceDate, this._archiveFolder);
      }
    } else {
      this._logger.trace(`The archive folder "${this._archiveFolder}" is empty. Nothing to delete`);
    }
    this.archiveTimeout = setTimeout(this.refreshArchiveFolder.bind(this), ARCHIVE_TIMEOUT);
  }

  async removeArchiveFiles(filenames: Array<string>): Promise<void> {
    for (const filename of filenames) {
      const filePath = path.resolve(this.archiveFolder, filename);
      try {
        this._logger.debug(`Removing archived file "${filePath}`);
        const fileStat = await fs.stat(filePath);
        await fs.unlink(filePath);
        this.triggerRun.emit('cache-size', { cacheSizeToAdd: 0, errorSizeToAdd: 0, archiveSizeToAdd: -fileStat.size });
      } catch (error: unknown) {
        this._logger.error(`Error while removing archived file "${filePath}": ${(error as Error).message}`);
      }
    }
  }

  async retryArchiveFiles(filenames: Array<string>): Promise<void> {
    for (const filename of filenames) {
      const fromFilePath = path.resolve(this._archiveFolder, filename);
      const cacheFilePath = path.resolve(this._cacheFolder, filename);
      this._logger.debug(`Moving file "${fromFilePath}" back to cache "${cacheFilePath}"`);

      await this.cacheFile(fromFilePath, false);
      await this.removeArchiveFiles([filename]);
    }
  }

  async retryErrorFiles(filenames: Array<string>): Promise<void> {
    for (const filename of filenames) {
      const fromFilePath = path.resolve(this._errorFolder, filename);
      const cacheFilePath = path.resolve(this._cacheFolder, filename);
      this._logger.debug(`Moving file "${fromFilePath}" back to cache "${cacheFilePath}"`);

      await this.cacheFile(fromFilePath, false);
      await this.removeErrorFiles([filename]);
    }
  }

  async removeAllCacheFiles(): Promise<void> {
    const filenames = await fs.readdir(this._cacheFolder);
    if (filenames.length > 0) {
      this._logger.debug(`Removing ${filenames.length} files from "${this._cacheFolder}"`);
      await this.removeCacheFiles(filenames);
    } else {
      this._logger.debug(`The cache folder "${this._cacheFolder}" is empty. Nothing to delete`);
    }
  }

  async removeAllErrorFiles(): Promise<void> {
    const filenames = await fs.readdir(this._errorFolder);
    if (filenames.length > 0) {
      this._logger.debug(`Removing ${filenames.length} files from "${this._errorFolder}"`);
      await this.removeErrorFiles(filenames);
    } else {
      this._logger.debug(`The error folder "${this._errorFolder}" is empty. Nothing to delete`);
    }
  }

  async removeAllArchiveFiles(): Promise<void> {
    const filenames = await fs.readdir(this._archiveFolder);
    if (filenames.length > 0) {
      this._logger.debug(`Removing ${filenames.length} files from "${this._archiveFolder}"`);
      await this.removeArchiveFiles(filenames);
    } else {
      this._logger.debug(`The archive folder "${this._archiveFolder}" is empty. Nothing to delete`);
    }
  }

  async retryAllArchiveFiles(): Promise<void> {
    const filenames = await fs.readdir(this._archiveFolder);
    if (filenames.length > 0) {
      await this.retryArchiveFiles(filenames);
    } else {
      this._logger.debug(`The folder "${this._archiveFolder}" is empty. Nothing to delete`);
    }
  }

  async retryAllErrorFiles(): Promise<void> {
    const filenames = await fs.readdir(this._errorFolder);
    if (filenames.length > 0) {
      await this.retryErrorFiles(filenames);
    } else {
      this._logger.debug(`The folder "${this._errorFolder}" is empty. Nothing to delete`);
    }
  }

  /**
   * Get list of cache files.
   */
  async getCacheFiles(fromDate: Instant | null, toDate: Instant | null, nameFilter: string | null): Promise<Array<NorthCacheFiles>> {
    return await getFilesFiltered(this._cacheFolder, fromDate, toDate, nameFilter, this._logger);
  }

  /**
   * Get cache file content.
   */
  async getCacheFileContent(filename: string): Promise<ReadStream | null> {
    try {
      await fs.stat(path.resolve(this._cacheFolder, filename));
    } catch (error) {
      this._logger.error(`Error while reading file "${path.resolve(this._cacheFolder, filename)}": ${error}`);
      return null;
    }

    return createReadStream(path.resolve(this._cacheFolder, filename));
  }

  get triggerRun(): EventEmitter {
    return this._triggerRun;
  }

  set settings(value: NorthConnectorEntity<NorthSettings>) {
    this._settings = value;
  }

  async stop(): Promise<void> {
    clearTimeout(this.archiveTimeout);
  }
}
