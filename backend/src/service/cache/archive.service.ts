import fs from 'node:fs/promises';
import path from 'node:path';

import { createFolder } from '../utils';
import pino from 'pino';

// Time between two checks of the Archive Folder
const ARCHIVE_TIMEOUT = 3600000; // one hour
const ARCHIVE_TIMEOUT_INIT = 10000; // Wait a little at North start up
const ARCHIVE_FOLDER = 'archive';

import { NorthArchiveSettings } from '../../../../shared/model/north-connector.model';

/**
 * Archive service used to archive sent file and check periodically the archive folder to remove old files
 * Once a file is sent by a North connector, the archiveOrRemoveFile is called by the connector to manage the file
 * The North cache folder is generated as north-connectorId. This base folder can be in data-stream or history-query
 * folder depending on the connector use case
 */
export default class ArchiveService {
  private readonly logger: pino.Logger;
  private readonly enabled: boolean;
  private readonly retentionDuration: number; // Converted from hours to ms to compare with mtimeMs (file modified time in ms)
  readonly archiveFolder: string;
  private archiveTimeout: NodeJS.Timeout | null = null;

  constructor(logger: pino.Logger, baseFolder: string, settings: NorthArchiveSettings) {
    this.logger = logger;
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
      const archivePath = path.join(this.archiveFolder, filenameInfo.base);
      // Move cache file into the archive folder
      try {
        await fs.rename(filePathInCache, archivePath);
        this.logger.debug(`File "${filePathInCache}" moved to "${archivePath}".`);
      } catch (renameError) {
        this.logger.error(renameError);
      }
    } else {
      // Delete original file
      try {
        await fs.unlink(filePathInCache);
        this.logger.debug(`File "${filePathInCache}" removed from disk.`);
      } catch (unlinkError) {
        this.logger.error(unlinkError);
      }
    }
  }

  /**
   * Delete files in archiveFolder if they are older thant the retention time.
   */
  async refreshArchiveFolder(): Promise<void> {
    this.logger.debug('Parse archive folder to remove old files.');
    // If a timeout already runs, clear it
    if (this.archiveTimeout) {
      clearTimeout(this.archiveTimeout);
    }

    let files: Array<string> = [];
    try {
      files = await fs.readdir(this.archiveFolder);
    } catch (error) {
      // If the archive folder doest not exist (removed by the user for example), an error is logged
      this.logger.error(error);
    }
    if (files.length > 0) {
      const referenceDate = new Date().getTime();

      // Map each file to a promise and remove files sequentially
      await files.reduce(
        (promise, file) => promise.then(async () => this.removeFileIfTooOld(file, referenceDate, this.archiveFolder)),
        Promise.resolve()
      );
    } else {
      this.logger.debug(`The archive folder "${this.archiveFolder}" is empty. Nothing to delete.`);
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
      stats = await fs.stat(path.join(archiveFolder, filename));
    } catch (error) {
      this.logger.error(error);
    }
    if (stats && stats.mtimeMs + this.retentionDuration < referenceDate) {
      try {
        await fs.unlink(path.join(archiveFolder, filename));
        this.logger.debug(`File "${path.join(archiveFolder, filename)}" removed from archive.`);
      } catch (unlinkError) {
        this.logger.error(unlinkError);
      }
    }
  }
}
