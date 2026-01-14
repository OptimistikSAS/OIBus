import fs from 'node:fs/promises';
import path from 'node:path';

import SouthConnector from '../south-connector';
import { compress } from '../../service/utils';
import pino from 'pino';
import { QueriesFile } from '../south-interface';
import { SouthFolderScannerItemSettings, SouthFolderScannerSettings } from '../../../shared/model/south-settings.model';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { Instant, OIBusTestingError } from '../../model/types';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';

/**
 * Class SouthFolderScanner - Retrieve files from a local or remote folder
 */
export default class SouthFolderScanner
  extends SouthConnector<SouthFolderScannerSettings, SouthFolderScannerItemSettings>
  implements QueriesFile
{
  constructor(
    connector: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent, queryTime: Instant, itemIds: Array<string>) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async testConnection(): Promise<void> {
    const inputFolder = path.resolve(this.connector.settings.inputFolder);

    try {
      await fs.access(inputFolder, fs.constants.F_OK);
    } catch (error: unknown) {
      throw new OIBusTestingError(`Folder "${inputFolder}" does not exist: ${(error as Error).message}`);
    }

    try {
      await fs.access(inputFolder, fs.constants.R_OK);
    } catch (error: unknown) {
      throw new OIBusTestingError(`Read access error on "${inputFolder}": ${(error as Error).message}`);
    }

    const stat = await fs.stat(inputFolder);
    if (!stat.isDirectory()) {
      throw new OIBusTestingError(`${inputFolder} is not a directory`);
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthFolderScannerItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    await this.testConnection();
    const inputFolder = path.resolve(this.connector.settings.inputFolder);
    const filesInFolder = await fs.readdir(inputFolder);
    const filteredFiles = filesInFolder.filter(file => file.match(item.settings.regex));
    const matchedFiles: Array<{ name: string; modifyTime: Instant }> = [];
    for (const file of filteredFiles) {
      if (await this.checkAge(item, file, true)) {
        const stats = await fs.stat(path.join(inputFolder, file));
        matchedFiles.push({ name: file, modifyTime: DateTime.fromMillis(stats.mtimeMs).toUTC().toISO()! });
      }
    }

    const values: Array<OIBusTimeValue> = matchedFiles.map(file => ({
      pointId: item.name,
      timestamp: file.modifyTime,
      data: { value: file.name }
    }));
    return { type: 'time-values', content: values };
  }

  async start(): Promise<void> {
    await super.start();
    // Create a custom table in the south cache database to manage file already sent when preserve file is set to true
    this.cacheService!.createCustomTable(`folder_scanner_${this.connector.id}`, 'filename TEXT PRIMARY KEY, mtime_ms INTEGER');
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   */
  async fileQuery(items: Array<SouthConnectorItemEntity<SouthFolderScannerItemSettings>>): Promise<void> {
    const inputFolder = path.resolve(this.connector.settings.inputFolder);
    this.logger.trace(`Reading "${inputFolder}" directory`);
    // List files in the inputFolder
    const startRequest = DateTime.now();
    const files = await fs.readdir(inputFolder);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
    this.logger.debug(`Folder ${inputFolder} read in ${requestDuration} ms`);

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
        if (await this.checkAge(item, file)) {
          matchedFiles.push(file);
        }
      }

      if (matchedFiles.length === 0) {
        this.logger.debug(`No file matches minimum age with regex "${item.settings.regex}"`);
        continue;
      }

      // The files remaining after these checks need to be sent to the engine
      this.logger.trace(`Sending ${matchedFiles.length} files`);

      for (const file of matchedFiles) {
        await this.sendFile(item, file, startRequest.toUTC().toISO());
      }
    }
  }

  /**
   * Filter the files if the name and the age of the file meet the request or - when preserveFiles - if they were
   * already sent.
   */
  async checkAge(item: SouthConnectorItemEntity<SouthFolderScannerItemSettings>, filename: string, test = false): Promise<boolean> {
    const inputFolder = path.resolve(this.connector.settings.inputFolder);

    const timestamp = new Date().getTime();
    const stats = await fs.stat(path.join(inputFolder, filename));
    this.logger.trace(
      `Check age condition: mT:${stats.mtimeMs} + mA ${item.settings.minAge} < ts:${timestamp} ` +
        `= ${stats.mtimeMs + item.settings.minAge < timestamp}`
    );

    if (stats.mtimeMs + item.settings.minAge > timestamp) return false;
    this.logger.trace(`File "${filename}" matches age`);

    // Check if the file was already sent (if preserveFiles is true)
    if (item.settings.preserveFiles && !test) {
      if (item.settings.ignoreModifiedDate) return true;
      const lastModifiedTime = this.getModifiedTime(filename);

      if (stats.mtimeMs <= lastModifiedTime) return false;
      this.logger.trace(
        `File "${filename}" last modified time ${lastModifiedTime} is older than mtimeMs ${stats.mtimeMs}. The file will be sent`
      );
    }
    return true;
  }

  getModifiedTime(filename: string): number {
    const query = `SELECT mtime_ms AS mtimeMs FROM "folder_scanner_${this.connector.id}" WHERE filename = ?`;
    const result: { mtimeMs: string } | null = this.cacheService!.getQueryOnCustomTable(query, [filename]) as {
      mtimeMs: string;
    } | null;
    return result ? parseFloat(result.mtimeMs) : 0;
  }

  updateModifiedTime(filename: string, mtimeMs: number): void {
    const query = `INSERT INTO "folder_scanner_${this.connector.id}" (filename, mtime_ms) VALUES (?, ?) ON CONFLICT(filename) DO UPDATE SET mtime_ms = ?`;
    this.cacheService!.runQueryOnCustomTable(query, [filename, mtimeMs, mtimeMs]);
  }

  /**
   * Send the file to the Engine.
   */
  async sendFile(item: SouthConnectorItemEntity<SouthFolderScannerItemSettings>, filename: string, queryTime: Instant): Promise<void> {
    const filePath = path.resolve(this.connector.settings.inputFolder, filename);
    this.logger.info(`Sending file "${filePath}" to the engine`);

    if (this.connector.settings.compression) {
      try {
        // Compress and send the compressed file
        const gzipPath = path.resolve(this.tmpFolder, `${filename}.gz`);
        await compress(filePath, gzipPath);
        await this.addContent({ type: 'any', filePath: gzipPath }, queryTime, [item.id]);
        try {
          await fs.unlink(gzipPath);
        } catch (unlinkError) {
          this.logger.error(`Error while removing compressed file "${gzipPath}": ${unlinkError}`);
        }
      } catch (error: unknown) {
        this.logger.error(`Error compressing file "${filePath}": ${(error as Error).message}. Sending it raw instead.`);
        await this.addContent({ type: 'any', filePath }, queryTime, [item.id]);
      }
    } else {
      await this.addContent({ type: 'any', filePath }, queryTime, [item.id]);
    }

    // Delete original file if preserveFile is not set
    if (!item.settings.preserveFiles) {
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
