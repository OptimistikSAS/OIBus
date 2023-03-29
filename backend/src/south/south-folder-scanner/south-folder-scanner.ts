import fs from 'node:fs/promises';
import path from 'node:path';

import SouthConnector from '../south-connector';
import { compress } from '../../service/utils';
import manifest from './manifest';

import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';

const FOLDER_SCANNER_TABLE = 'folder_scanner';

/**
 * Class SouthFolderScanner - Retrieve file from a local or remote folder
 */
export default class SouthFolderScanner extends SouthConnector {
  static category = manifest.category;

  /**
   * Constructor for SouthFolderScanner
   */
  constructor(
    configuration: SouthConnectorDTO,
    items: Array<OibusItemDTO>,
    engineAddValuesCallback: () => Promise<void>,
    engineAddFileCallback: () => Promise<void>,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string,
    streamMode: boolean
  ) {
    super(
      configuration,
      items,
      engineAddValuesCallback,
      engineAddFileCallback,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      baseFolder,
      streamMode,
      manifest
    );

    // Create a custom table in the south cache database to manage file already sent when preserve file is set to true
    if (this.configuration.settings.preserveFiles) {
      this.southCacheService.southCacheRepository.database
        .prepare(`CREATE TABLE IF NOT EXISTS ${FOLDER_SCANNER_TABLE} (filename TEXT PRIMARY KEY, mtime_ms INTEGER);`)
        .run();
    }
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   */
  override async fileQuery(items: Array<OibusItemDTO>): Promise<void> {
    const inputFolder = path.resolve(this.configuration.settings.inputFolder);
    this.logger.trace(`Reading "${inputFolder}" directory`);
    // List files in the inputFolder
    const files = await fs.readdir(inputFolder);

    if (files.length === 0) {
      this.logger.debug(`The folder "${inputFolder}" is empty`);
      return;
    }

    for (const item of items) {
      this.logger.trace(`Filtering with regex "${item.settings.regex}"`);
      const filteredFiles = files.filter(file => file.match(item.settings.regex));
      if (filteredFiles.length === 0) {
        this.logger.debug(`No file in "${inputFolder}" matches regex "${item.settings.regex}"`);
        continue;
      }
      this.logger.trace(`${filteredFiles.length} files matching regex "${item.settings.regex}"`);

      // Filters file that may still currently being written (based on minimum age)
      const matchedFiles: Array<string> = [];
      for (const file of filteredFiles) {
        if (await this.checkAge(file)) {
          matchedFiles.push(file);
        }
      }

      if (matchedFiles.length === 0) {
        this.logger.debug(`No file matches minimum age with regex "${item.settings.regex}"`);
        continue;
      }

      // The files remaining after these checks need to be sent to the engine
      this.logger.trace(`Sending ${matchedFiles.length} files`);

      await Promise.allSettled(matchedFiles.map(file => this.sendFile(file)));
    }
  }

  /**
   * Filter the files if the name and the age of the file meet the request or - when preserveFiles - if they were
   * already sent.
   */
  async checkAge(filename: string): Promise<boolean> {
    const inputFolder = path.resolve(this.configuration.settings.inputFolder);

    const timestamp = new Date().getTime();
    const stats = await fs.stat(path.join(inputFolder, filename));
    this.logger.trace(
      `Check age condition: mT:${stats.mtimeMs} + mA ${this.configuration.settings.minAge} < ts:${timestamp} ` +
        `= ${stats.mtimeMs + this.configuration.settings.minAge < timestamp}`
    );

    if (stats.mtimeMs + this.configuration.settings.minAge > timestamp) return false;
    this.logger.trace(`File "${filename}" matches age`);

    // Check if the file was already sent (if preserveFiles is true)
    if (this.configuration.settings.preserveFiles) {
      if (this.configuration.settings.ignoreModifiedDate) return true;
      const lastModifiedTime = this.getModifiedTime(filename);

      if (stats.mtimeMs <= lastModifiedTime) return false;
      this.logger.trace(
        `File "${filename}" last modified time ${lastModifiedTime} is older than mtimeMs ${stats.mtimeMs}. The file will be sent`
      );
    }
    return true;
  }

  getModifiedTime(filename: string): number {
    const query = `SELECT mtime_ms AS mtimeMs FROM ${FOLDER_SCANNER_TABLE} WHERE filename = ?`;
    const result = this.southCacheService.southCacheRepository.database.prepare(query).get(filename);
    return result ? parseFloat(result.mtimeMs) : 0;
  }

  updateModifiedTime(filename: string, mtimeMs: number): void {
    const query = `INSERT INTO ${FOLDER_SCANNER_TABLE} (filename, mtime_ms) VALUES (?, ?) ON CONFLICT(filename) DO UPDATE SET mtime_ms = ?`;
    this.southCacheService.southCacheRepository.database.prepare(query).run(filename, mtimeMs, mtimeMs);
  }

  /**
   * Send the file to the Engine.
   */
  async sendFile(filename: string): Promise<void> {
    const filePath = path.resolve(this.configuration.settings.inputFolder, filename);
    this.logger.debug(`Sending file "${filePath}" to the engine`);

    if (this.configuration.settings.compression) {
      try {
        // Compress and send the compressed file
        const gzipPath = `${filePath}.gz`;
        await compress(filePath, gzipPath);
        await this.addFile(gzipPath);
        try {
          await fs.unlink(gzipPath);
        } catch (unlinkError) {
          this.logger.error(`Error while removing compressed file "${gzipPath}": ${unlinkError}`);
        }
      } catch (compressionError) {
        this.logger.error(`Error compressing file "${filePath}". Sending it raw instead.`);
        await this.addFile(filePath);
      }
    } else {
      await this.addFile(filePath);
    }

    // Delete original file if preserveFile is not set
    if (!this.configuration.settings.preserveFiles) {
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        this.logger.error(`Error while removing "${filePath}": ${unlinkError}`);
      }
    } else {
      const stats = await fs.stat(filePath);
      this.logger.debug(`Upsert handled file "${filename}" with modify time ${stats.mtimeMs}`);
      this.updateModifiedTime(filename, stats.mtimeMs);
    }
  }
}
