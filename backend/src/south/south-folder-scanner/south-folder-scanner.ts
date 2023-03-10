import fs from 'node:fs/promises';
import path from 'node:path';

import SouthConnector from '../south-connector';
import { compress } from '../../service/utils';
import manifest from './manifest';

import { SouthConnectorDTO, SouthItemDTO } from '../../../../shared/model/south-connector.model';
import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';

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
    items: Array<SouthItemDTO>,
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
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   */
  override async fileQuery(items: Array<SouthItemDTO>): Promise<void> {
    for (const item of items) {
      const inputFolder = path.resolve(this.configuration.settings.inputFolder);
      this.logger.trace(`Reading "${inputFolder}" directory with regex "${item.settings.regex}"`);
      // List files in the inputFolder
      const files = await fs.readdir(inputFolder);

      if (files.length === 0) {
        this.logger.debug(`The folder "${inputFolder}" is empty`);
        return;
      }

      // Filters file that don't match the regex
      const filteredFiles = files.filter(file => file.match(item.settings.regex));
      if (filteredFiles.length === 0) {
        this.logger.debug(`No files in "${inputFolder}" matches regex "${item.settings.regex}"`);
        return;
      }

      // Filters file that may still currently being written (based on last modification date)
      const promisesResults = await Promise.allSettled(filteredFiles.map(this.checkAge.bind(this)));
      const matchedFiles = filteredFiles.filter((_v, index) => promisesResults[index]);
      if (matchedFiles.length === 0) {
        this.logger.debug(`No files in "${inputFolder}" matches minimum last modification date`);
        return;
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
      `checkConditions: mT:${stats.mtimeMs} + mA ${this.configuration.settings.minAge} < ts:${timestamp} ` +
        `= ${stats.mtimeMs + this.configuration.settings.minAge < timestamp}`
    );

    if (stats.mtimeMs + this.configuration.settings.minAge > timestamp) return false;
    this.logger.trace(`checkConditions: ${filename} match age`);

    // Check if the file was already sent (if preserveFiles is true)
    if (this.configuration.settings.preserveFiles) {
      if (this.configuration.settings.ignoreModifiedDate) return true;
      const modifyTime = '0';
      if (parseFloat(modifyTime) >= stats.mtimeMs) return false;
      this.logger.trace(`File "${filename}" modified time ${modifyTime} => need to be sent`);
    }
    return true;
  }

  /**
   * Send the file to the Engine.
   */
  async sendFile(filename: string): Promise<void> {
    const inputFolder = path.resolve(this.configuration.settings.inputFolder);
    const filePath = path.join(inputFolder, filename);
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
          this.logger.error(`Error while removing compressed file ${gzipPath}: ${unlinkError}`);
        }
      } catch (compressionError) {
        this.logger.error(`Error compressing file "${filename}". Sending it raw instead.`);
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
        this.logger.error(`Error while removing ${filePath}: ${unlinkError}`);
      }
    } else {
      const stats = await fs.stat(path.join(this.configuration.settings.inputFolder, filename));
      this.logger.debug(`Upsert handled file "${filename}" with modify time ${stats.mtimeMs}`);
      // TODO upsert
    }
  }
}
