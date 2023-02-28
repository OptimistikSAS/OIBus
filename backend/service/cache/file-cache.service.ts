import fs from 'node:fs/promises';
import path from 'node:path';

import { asyncFilter, createFolder } from '../utils';
import pino from 'pino';

const PAGE_SIZE = 50;

const FILE_FOLDER = 'files';
const ERROR_FOLDER = 'files-errors';

/**
 * Local cache implementation to group events and store them when the communication with the North is down.
 */
export default class FileCacheService {
  private readonly logger: pino.Logger;
  private readonly fileFolder: string;
  private readonly errorFolder: string;

  private filesQueue: Array<string> = [];

  constructor(logger: pino.Logger, baseFolder: string) {
    this.logger = logger;
    this.fileFolder = path.resolve(baseFolder, FILE_FOLDER);
    this.errorFolder = path.resolve(baseFolder, ERROR_FOLDER);
  }

  /**
   * Create folders and check errors files
   */
  async start(): Promise<void> {
    await createFolder(this.fileFolder);
    await createFolder(this.errorFolder);

    const files = await fs.readdir(this.fileFolder);

    const filesWithCreationDate: Array<{ filename: string; createdAt: number }> = [];
    for (const filename of files) {
      try {
        const fileStat = await fs.stat(path.resolve(this.fileFolder, filename));
        filesWithCreationDate.push({ filename: path.resolve(this.fileFolder, filename), createdAt: fileStat.ctimeMs });
      } catch (error) {
        // If a file is being written or corrupted, the stat method can fail
        // An error is logged and the cache goes through the other files
        this.logger.error(`Error while reading queue file "${path.resolve(this.fileFolder, filename)}": ${error}`);
      }
    }

    // Sort the compact queue to have the oldest file first
    this.filesQueue = filesWithCreationDate.sort((a, b) => a.createdAt - b.createdAt).map(file => file.filename);
    if (this.filesQueue.length > 0) {
      this.logger.debug(`${this.filesQueue.length} files in cache`);
    } else {
      this.logger.debug('No files in cache');
    }

    try {
      const errorFiles = await fs.readdir(this.errorFolder);
      if (errorFiles.length > 0) {
        this.logger.warn(`${errorFiles.length} files in error cache`);
      } else {
        this.logger.debug('No error files in cache');
      }
    } catch (error) {
      // If the folder does not exist, an error is logged but not thrown if the file cache folder is accessible
      this.logger.error(error);
    }
  }

  /**
   * Retrieve the file from the queue
   */
  async getFileToSend(): Promise<string | null> {
    // If there is no file in the queue, return null
    if (this.filesQueue.length === 0) {
      return null;
    }
    // Otherwise, get the first element from the queue
    const [queueFile] = this.filesQueue;
    return path.resolve(this.fileFolder, queueFile);
  }

  removeFileFromQueue(): void {
    this.filesQueue.shift();
  }

  /**
   * Cache a new file from a South connector
   */
  async cacheFile(filePath: string): Promise<void> {
    this.logger.trace(`Caching file "${filePath}"...`);
    const timestamp = new Date().getTime();
    // When compressed file is received the name looks like filename.txt.gz
    const filenameInfo = path.parse(filePath);

    const cacheFilename = `${filenameInfo.name}-${timestamp}${filenameInfo.ext}`;
    const cachePath = path.join(this.fileFolder, cacheFilename);

    await fs.copyFile(filePath, cachePath);
    // Add the file to the queue once it is persisted in the cache folder
    this.filesQueue.push(cachePath);
    this.logger.debug(`File "${filePath}" cached in "${cachePath}"`);
  }

  /**
   * Move the file from North cache folder to its error folder
   */
  async manageErroredFiles(filePathInCache: string): Promise<void> {
    const filenameInfo = path.parse(filePathInCache);
    const errorPath = path.join(this.errorFolder, filenameInfo.base);
    // Move cache file into the archive folder
    try {
      await fs.rename(filePathInCache, errorPath);
      this.logger.info(`File "${filePathInCache}" moved to "${errorPath}"`);
    } catch (renameError) {
      this.logger.error(renameError);
    }
  }

  /**
   * Check if the file cache is empty or not
   */
  async isEmpty(): Promise<boolean> {
    let files = [];
    try {
      files = await fs.readdir(this.fileFolder);
    } catch (error) {
      // Log an error if the folder does not exist (removed by the user while OIBus is running for example)
      this.logger.error(error);
    }
    return files.length === 0;
  }

  /**
   * Get list of error files.
   */
  async getErrorFiles(fromDate: string, toDate: string, nameFilter: string, pageNumber: number): Promise<Array<string>> {
    const filenames = await fs.readdir(this.errorFolder);
    if (filenames.length === 0) {
      return filenames;
    }

    const filteredFilenames = await asyncFilter(filenames, async filename =>
      this.matchFile(this.errorFolder, filename, fromDate, toDate, nameFilter)
    );

    return filteredFilenames.slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE);
  }

  /**
   * Remove error files.
   */
  async removeErrorFiles(filenames: Array<string>): Promise<void> {
    await Promise.allSettled(
      filenames.map(async filename => {
        const errorFilePath = path.join(this.errorFolder, filename);
        this.logger.debug(`Removing error file "${errorFilePath}`);
        await fs.unlink(errorFilePath);
      })
    );
  }

  /**
   * Retry error files.
   */
  async retryErrorFiles(filenames: Array<string>): Promise<void> {
    await Promise.allSettled(
      filenames.map(async filename => {
        const errorFilePath = path.join(this.errorFolder, filename);
        const cacheFilePath = path.join(this.fileFolder, filename);
        this.logger.debug(`Moving error file "${errorFilePath}" back to cache "${cacheFilePath}"`);
        await fs.rename(errorFilePath, cacheFilePath);
      })
    );
  }

  /**
   * Remove all error files.
   */
  async removeAllErrorFiles(): Promise<void> {
    const filenames = await fs.readdir(this.errorFolder);
    if (filenames.length > 0) {
      await this.removeErrorFiles(filenames);
    } else {
      this.logger.debug(`The error folder "${this.errorFolder}" is empty. Nothing to delete`);
    }
  }

  /**
   * Retry all error files.
   */
  async retryAllErrorFiles(): Promise<void> {
    const filenames = await fs.readdir(this.errorFolder);
    if (filenames.length > 0) {
      await this.retryErrorFiles(filenames);
    } else {
      this.logger.debug(`The error folder "${this.errorFolder}" is empty. Nothing to delete`);
    }
  }

  /**
   * Whether the file matches the given criteria.
   */
  async matchFile(folder: string, filename: string, fromDate: string, toDate: string, nameFilter: string): Promise<boolean> {
    let stats;
    try {
      // If a file is being written or corrupted, the stat method can fail an error is logged
      stats = await fs.stat(path.join(folder, filename));
    } catch (error) {
      this.logger.error(error);
      return false;
    }

    const fromDateInMillis = new Date(fromDate).getTime();
    const toDateInMillis = new Date(toDate).getTime();
    const dateIsBetween = stats && stats.mtimeMs >= fromDateInMillis && stats.mtimeMs <= toDateInMillis;
    const filenameContains = filename.toUpperCase().includes(nameFilter.toUpperCase());
    return dateIsBetween && filenameContains;
  }
}
