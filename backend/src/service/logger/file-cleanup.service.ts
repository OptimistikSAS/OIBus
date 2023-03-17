import path from 'node:path';
import fs from 'node:fs/promises';

import { filesExists } from '../utils';
import pino from 'pino';

const CLEAN_UP_INTERVAL = 24 * 3600 * 1000; // One day

/**
 * Service used to clean up log files rolled by the pino-roll library
 * This service should be removed if pino-roll implements this feature one day
 */
export default class FileCleanupService {
  private readonly logFolder: string;
  private cleanUpInterval: NodeJS.Timeout | null = null;

  constructor(logFolder: string, private logger: pino.Logger, private readonly filename: string, private readonly numberOfFiles: number) {
    this.logFolder = path.resolve(logFolder);
  }

  /**
   * Clean up the folder at start and then every CLEAN_UP_INTERVAL ms
   */
  async start(): Promise<void> {
    await this.cleanUpLogFiles();
    this.cleanUpInterval = setInterval(this.cleanUpLogFiles.bind(this), CLEAN_UP_INTERVAL);
  }

  /**
   * Clear the interval when OIBus stop
   */
  stop(): void {
    this.logger.trace('Stopping file cleanup service.');
    if (this.cleanUpInterval) {
      clearInterval(this.cleanUpInterval);
    }
  }

  /**
   * List the files of the log folder and remove the older files if the number of files is over the limit of files
   */
  async cleanUpLogFiles(): Promise<void> {
    try {
      if (!(await filesExists(this.logFolder))) {
        return;
      }
      const filenames = await fs.readdir(this.logFolder);

      const regexp = new RegExp(`^${this.filename}\\.[0-9]*$`);
      const fileList: Array<{ file: string; modifiedTime: number }> = [];
      const logFiles = filenames.filter(file => file.match(regexp));

      this.logger.trace(`Found ${logFiles.length} log files with RegExp ${regexp} in folder "${this.logFolder}".`);
      if (logFiles.length > this.numberOfFiles) {
        for (const filename of logFiles) {
          try {
            const fileStat = await fs.stat(path.resolve(this.logFolder, filename));
            fileList.push({ file: path.resolve(this.logFolder, filename), modifiedTime: fileStat.mtimeMs });
          } catch (error) {
            // If a file is being written or corrupted, the stat method can fail
            // An error is logged and the cache goes through the other files
            this.logger.error(`Error while reading log file "${path.resolve(this.logFolder, filename)}": ${error}`);
          }
        }

        // Sort the newest files first and keep the numberOfFiles first files (the other files will be removed
        const fileToRemove = fileList
          .sort((a, b) => a.modifiedTime - b.modifiedTime)
          .map(element => element.file)
          .slice(0, fileList.length - this.numberOfFiles);
        this.logger.trace(`Removing ${fileToRemove.length} log files.`);
        for (const filename of fileToRemove) {
          try {
            await fs.unlink(path.resolve(this.logFolder, filename));
          } catch (error) {
            // If a file is being written or corrupted, the stat method can fail
            // An error is logged and the cache goes through the other files
            this.logger.error(`Error while removing log file "${path.resolve(this.logFolder, filename)}": ${error}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(error);
    }
  }
}
