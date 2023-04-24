import fs from 'node:fs/promises';
import path from 'node:path';

import { createFolder } from '../utils';
import pino from 'pino';

import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { NorthCacheFiles } from '../../../../shared/model/north-connector.model';

const FILE_FOLDER = 'files';
const ERROR_FOLDER = 'files-errors';

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
export default class FileCacheService {
  private _logger: pino.Logger;
  private readonly _fileFolder: string;
  private readonly _errorFolder: string;

  private filesQueue: Array<string> = [];

  constructor(logger: pino.Logger, baseFolder: string) {
    this._logger = logger;
    this._fileFolder = path.resolve(baseFolder, FILE_FOLDER);
    this._errorFolder = path.resolve(baseFolder, ERROR_FOLDER);
  }

  setLogger(value: pino.Logger) {
    this._logger = value;
  }

  get errorFolder(): string {
    return this._errorFolder;
  }

  get fileFolder(): string {
    return this._fileFolder;
  }

  /**
   * Create folders and check errors files
   */
  async start(): Promise<void> {
    await createFolder(this._fileFolder);
    await createFolder(this._errorFolder);

    const files = await fs.readdir(this._fileFolder);

    const filesWithCreationDate: Array<{ filename: string; createdAt: number }> = [];
    for (const filename of files) {
      try {
        const fileStat = await fs.stat(path.resolve(this._fileFolder, filename));
        filesWithCreationDate.push({ filename: path.resolve(this._fileFolder, filename), createdAt: fileStat.ctimeMs });
      } catch (error) {
        // If a file is being written or corrupted, the stat method can fail
        // An error is logged and the cache goes through the other files
        this._logger.error(`Error while reading queue file "${path.resolve(this._fileFolder, filename)}": ${error}`);
      }
    }

    // Sort the compact queue to have the oldest file first
    this.filesQueue = filesWithCreationDate.sort((a, b) => a.createdAt - b.createdAt).map(file => file.filename);
    if (this.filesQueue.length > 0) {
      this._logger.debug(`${this.filesQueue.length} files in cache`);
    } else {
      this._logger.debug('No files in cache');
    }

    try {
      const errorFiles = await fs.readdir(this._errorFolder);
      if (errorFiles.length > 0) {
        this._logger.warn(`${errorFiles.length} files in error cache`);
      } else {
        this._logger.debug('No error files in cache');
      }
    } catch (error) {
      // If the folder does not exist, an error is logged but not thrown if the file cache folder is accessible
      this._logger.error(error);
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
    return path.resolve(this._fileFolder, queueFile);
  }

  removeFileFromQueue(): void {
    this.filesQueue.shift();
  }

  /**
   * Cache a new file from a South connector
   */
  async cacheFile(filePath: string): Promise<void> {
    this._logger.trace(`Caching file "${filePath}"...`);
    const timestamp = new Date().getTime();
    // When compressed file is received the name looks like filename.txt.gz
    const filenameInfo = path.parse(filePath);

    const cacheFilename = `${filenameInfo.name}-${timestamp}${filenameInfo.ext}`;
    const cachePath = path.join(this._fileFolder, cacheFilename);

    await fs.copyFile(filePath, cachePath);
    // Add the file to the queue once it is persisted in the cache folder
    this.filesQueue.push(cachePath);
    this._logger.debug(`File "${filePath}" cached in "${cachePath}"`);
  }

  /**
   * Move the file from North cache folder to its error folder
   */
  async manageErroredFiles(filePathInCache: string, errorCount: number): Promise<void> {
    const filenameInfo = path.parse(filePathInCache);
    const errorPath = path.join(this._errorFolder, filenameInfo.base);
    try {
      await fs.rename(filePathInCache, errorPath);
      this._logger.warn(`File "${filePathInCache}" moved to "${errorPath}" after ${errorCount} errors`);
    } catch (renameError) {
      this._logger.error(`Error while moving file "${filePathInCache}" to "${errorPath}": ${renameError}`);
    }
  }

  /**
   * Check if the file cache is empty or not
   */
  async isEmpty(): Promise<boolean> {
    let files = [];
    try {
      files = await fs.readdir(this._fileFolder);
    } catch (error) {
      // Log an error if the folder does not exist (removed by the user while OIBus is running for example)
      this._logger.error(error);
    }
    return files.length === 0;
  }

  /**
   * Get list of error files.
   */
  async getErrorFiles(fromDate: Instant, toDate: Instant, nameFilter: string): Promise<Array<NorthCacheFiles>> {
    const filenames = await fs.readdir(this._errorFolder);
    const filteredFilenames: Array<NorthCacheFiles> = [];
    for (const filename of filenames) {
      try {
        const stats = await fs.stat(path.join(this._errorFolder, filename));

        const dateIsSuperiorToStart = fromDate ? stats.mtimeMs >= DateTime.fromISO(fromDate).toMillis() : true;
        const dateIsInferiorToEnd = toDate ? stats.mtimeMs <= DateTime.fromISO(toDate).toMillis() : true;
        const dateIsBetween = dateIsSuperiorToStart && dateIsInferiorToEnd;
        const filenameContains = nameFilter ? filename.toUpperCase().includes(nameFilter.toUpperCase()) : true;
        if (dateIsBetween && filenameContains) {
          filteredFilenames.push({
            filename,
            modificationDate: DateTime.fromMillis(stats.mtimeMs).toUTC().toISO(),
            size: stats.size
          });
        }
      } catch (error) {
        this._logger.error(`Error while reading in error folder file stats "${path.join(this._errorFolder, filename)}": ${error}`);
      }
    }
    return filteredFilenames;
  }

  /**
   * Remove error files.
   */
  async removeFiles(folder: string, filenames: Array<string>): Promise<void> {
    await Promise.allSettled(
      filenames.map(async filename => {
        const filePath = path.join(folder, filename);
        this._logger.debug(`Removing file "${filePath}`);
        await fs.unlink(filePath);
      })
    );
  }

  /**
   * Retry error files.
   */
  async retryErrorFiles(filenames: Array<string>): Promise<void> {
    await Promise.allSettled(
      filenames.map(async filename => {
        const errorFilePath = path.join(this._errorFolder, filename);
        const cacheFilePath = path.join(this._fileFolder, filename);
        this._logger.debug(`Moving error file "${errorFilePath}" back to cache "${cacheFilePath}"`);
        await fs.rename(errorFilePath, cacheFilePath);
      })
    );
  }

  /**
   * Remove all cache files.
   */
  async removeAllCacheFiles(): Promise<void> {
    const filenames = await fs.readdir(this._fileFolder);
    if (filenames.length > 0) {
      this._logger.debug(`Removing ${filenames.length} files from "${this._fileFolder}"`);
      await this.removeFiles(this._fileFolder, filenames);
    } else {
      this._logger.debug(`The cache folder "${this._fileFolder}" is empty. Nothing to delete`);
    }
  }

  /**
   * Remove all error files.
   */
  async removeAllErrorFiles(): Promise<void> {
    const filenames = await fs.readdir(this._errorFolder);
    if (filenames.length > 0) {
      this._logger.debug(`Removing ${filenames.length} files from "${this._errorFolder}"`);
      await this.removeFiles(this._errorFolder, filenames);
    } else {
      this._logger.debug(`The error folder "${this._errorFolder}" is empty. Nothing to delete`);
    }
  }

  /**
   * Retry all error files.
   */
  async retryAllErrorFiles(): Promise<void> {
    const filenames = await fs.readdir(this._errorFolder);
    if (filenames.length > 0) {
      await this.retryErrorFiles(filenames);
    } else {
      this._logger.debug(`The error folder "${this._errorFolder}" is empty. Nothing to delete`);
    }
  }
}
