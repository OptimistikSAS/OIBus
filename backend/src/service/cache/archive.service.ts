import fs from 'node:fs/promises';
import { createReadStream, ReadStream } from 'node:fs';
import path from 'node:path';

import { createFolder } from '../utils';
import pino from 'pino';

// Time between two checks of the Archive Folder
const ARCHIVE_TIMEOUT = 3600000; // one hour
const ARCHIVE_TIMEOUT_INIT = 10000; // Wait a little at North start up
const ARCHIVE_FOLDER = 'archive';

import { NorthArchiveSettings, NorthArchiveFiles } from '../../../shared/model/north-connector.model';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { EventEmitter } from 'node:events';

/**
 * Archive service used to archive sent file and check periodically the archive folder to remove old files
 * Once a file is sent by a North connector, the archiveOrRemoveFile is called by the connector to manage the file
 * The North cache folder is generated as north-connectorId. This base folder can be in data-stream or history-query
 * folder depending on the connector use case
 */
export default class ArchiveService {
  private _logger: pino.Logger;
  private readonly enabled: boolean;
  private readonly retentionDuration: number; // Converted from hours to ms to compare with mtimeMs (file modified time in ms)
  readonly archiveFolder: string;
  private archiveTimeout: NodeJS.Timeout | null = null;
  private _triggerRun: EventEmitter = new EventEmitter();

  constructor(logger: pino.Logger, baseFolder: string, settings: NorthArchiveSettings) {
    this._logger = logger;
    this.enabled = settings.enabled;
    this.retentionDuration = settings.retentionDuration * 3600000;
    this.archiveFolder = path.resolve(baseFolder, ARCHIVE_FOLDER);
  }

  /**
   * Create folders and activate archive cleanup if needed
   */
  async start(): Promise<void> {
    await createFolder(this.archiveFolder);
    // refresh the archiveFolder at the beginning only if retentionDuration is different from 0
    if (this.enabled && this.retentionDuration > 0) {
      this.archiveTimeout = setTimeout(this.refreshArchiveFolder.bind(this), ARCHIVE_TIMEOUT_INIT);
    }
  }

  /**
   * Stop the archive timeout and close the databases
   */
  async stop(): Promise<void> {
    if (this.archiveTimeout) {
      clearTimeout(this.archiveTimeout);
    }
  }

  /**
   * Remove file from North connector cache and place it to archive folder if enabled.
   */
  async archiveOrRemoveFile(filePathInCache: string) {
    if (this.enabled) {
      const filenameInfo = path.parse(filePathInCache);
      const archivePath = path.resolve(this.archiveFolder, filenameInfo.base);
      // Move cache file into the archive folder
      try {
        await fs.rename(filePathInCache, archivePath);
        this._logger.debug(`File "${filePathInCache}" moved to archive folder "${archivePath}"`);
      } catch (renameError) {
        this._logger.error(`Could not move "${filePathInCache}" from cache: ${renameError}`);
      }
    } else {
      // Delete original file
      try {
        await fs.unlink(filePathInCache);
        this._logger.debug(`File "${filePathInCache}" removed from disk`);
      } catch (unlinkError) {
        this._logger.error(`Could not remove "${filePathInCache}" from cache: ${unlinkError}`);
      }
    }
  }

  /**
   * Delete files in archiveFolder if they are older thant the retention time.
   */
  async refreshArchiveFolder(): Promise<void> {
    this._logger.debug('Parse archive folder to remove old files');
    // If a timeout already runs, clear it
    if (this.archiveTimeout) {
      clearTimeout(this.archiveTimeout);
    }

    let files: Array<string> = [];
    try {
      files = await fs.readdir(this.archiveFolder);
    } catch (error) {
      // If the archive folder doest not exist (removed by the user for example), an error is logged
      this._logger.error(`Error reading archive folder "${this.archiveFolder}": ${error}`);
    }
    if (files.length > 0) {
      const referenceDate = new Date().getTime();

      // Map each file to a promise and remove files sequentially
      for (const file of files) {
        await this.removeFileIfTooOld(file, referenceDate, this.archiveFolder);
      }
    } else {
      this._logger.debug(`The archive folder "${this.archiveFolder}" is empty. Nothing to delete`);
    }
    this.archiveTimeout = setTimeout(this.refreshArchiveFolder.bind(this), ARCHIVE_TIMEOUT);
  }

  /**
   * Check the modified time of a file (referenceDate in ms) and remove it if older than the retention duration
   */
  async removeFileIfTooOld(filename: string, referenceDate: number, archiveFolder: string) {
    let stats;
    try {
      // If a file is being written or corrupted, the stat method can fail an error is logged
      stats = await fs.stat(path.resolve(archiveFolder, filename));
    } catch (error) {
      this._logger.error(`Could not read stats from archive file "${path.resolve(archiveFolder, filename)}": ${error}`);
    }
    if (stats && stats.mtimeMs + this.retentionDuration < referenceDate) {
      try {
        const filePath = path.resolve(archiveFolder, filename);
        const fileStat = await fs.stat(filePath);
        await fs.unlink(filePath);
        this._logger.debug(`File "${path.resolve(archiveFolder, filename)}" removed from archive`);
        this.triggerRun.emit('cache-size', -fileStat.size);
      } catch (unlinkError) {
        this._logger.error(`Could not remove old file "${path.resolve(archiveFolder, filename)}" from archive: ${unlinkError}`);
      }
    }
  }

  /**
   * Get list of archive files.
   */
  async getArchiveFiles(fromDate: Instant, toDate: Instant, nameFilter: string): Promise<Array<NorthArchiveFiles>> {
    const filenames = await fs.readdir(this.archiveFolder);
    const filteredFilenames: Array<NorthArchiveFiles> = [];
    for (const filename of filenames) {
      try {
        const stats = await fs.stat(path.resolve(this.archiveFolder, filename));

        const dateIsSuperiorToStart = fromDate ? stats.mtimeMs >= DateTime.fromISO(fromDate).toMillis() : true;
        const dateIsInferiorToEnd = toDate ? stats.mtimeMs <= DateTime.fromISO(toDate).toMillis() : true;
        const dateIsBetween = dateIsSuperiorToStart && dateIsInferiorToEnd;
        const filenameContains = nameFilter ? filename.toUpperCase().includes(nameFilter.toUpperCase()) : true;
        if (dateIsBetween && filenameContains) {
          filteredFilenames.push({
            filename,
            modificationDate: DateTime.fromMillis(stats.mtimeMs).toUTC().toISO() as Instant,
            size: stats.size
          });
        }
      } catch (error) {
        this._logger.error(`Error while reading in archive folder file stats "${path.resolve(this.archiveFolder, filename)}": ${error}`);
      }
    }
    return filteredFilenames;
  }

  /**
   * Get archive file content.
   */
  async getArchiveFileContent(filename: string): Promise<ReadStream | null> {
    try {
      await fs.stat(path.resolve(this.archiveFolder, filename));
    } catch (error) {
      this._logger.error(`Error while reading file "${path.resolve(this.archiveFolder, filename)}": ${error}`);
      return null;
    }
    return createReadStream(path.resolve(this.archiveFolder, filename));
  }

  /**
   * Remove archive files.
   */
  async removeFiles(filenames: Array<string>): Promise<void> {
    for (const filename of filenames) {
      const filePath = path.resolve(this.archiveFolder, filename);
      try {
        this._logger.debug(`Removing archived file "${filePath}`);
        const fileStat = await fs.stat(filePath);
        await fs.unlink(filePath);
        this.triggerRun.emit('cache-size', -fileStat.size);
      } catch {
        this._logger.error(`Unable to remove archived file "${filePath}"`);
      }
    }
  }

  /**
   * Remove all archive files.
   */
  async removeAllArchiveFiles(): Promise<void> {
    const filenames = await fs.readdir(this.archiveFolder);
    if (filenames.length > 0) {
      this._logger.debug(`Removing ${filenames.length} files from "${this.archiveFolder}"`);
      await this.removeFiles(filenames);
    } else {
      this._logger.debug(`The archive folder "${this.archiveFolder}" is empty. Nothing to delete`);
    }
  }

  setLogger(value: pino.Logger) {
    this._logger = value;
  }

  get triggerRun(): EventEmitter {
    return this._triggerRun;
  }
}
