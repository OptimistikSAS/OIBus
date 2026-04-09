import fs from 'node:fs/promises';
import path from 'node:path';

import SouthConnector from '../south-connector';
import { checkAge, compress } from '../../service/utils';
import pino from 'pino';
import { SouthDirectQuery } from '../south-interface';
import { SouthFolderScannerItemSettings, SouthFolderScannerSettings, SouthItemSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { Instant, OIBusTestingError } from '../../model/types';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { Stats } from 'node:fs';

/**
 * Class SouthFolderScanner - Retrieve files from a local or remote folder
 */
export default class SouthFolderScanner
  extends SouthConnector<SouthFolderScannerSettings, SouthFolderScannerItemSettings>
  implements SouthDirectQuery
{
  constructor(
    connector: SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings>,
    engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
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

    const items: Array<{ key: string; value: string }> = [{ key: 'Folder', value: inputFolder }];

    try {
      const files = await fs.readdir(inputFolder);
      items.push({ key: 'Files', value: String(files.length) });
    } catch {
      // File count not critical
    }

    return { items };
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
      const stats = await fs.stat(path.join(inputFolder, file));
      if (checkAge(item, file, stats.mtimeMs, [], this.logger)) {
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

  /**
   * List files recursively if enabled
   */
  private async listFilesRecursively(
    dirPath: string,
    baseDir: string,
    item: SouthConnectorItemEntity<SouthFolderScannerItemSettings>
  ): Promise<Array<string>> {
    const files: Array<string> = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory() && item.settings.recursive) {
        const subFiles = await this.listFilesRecursively(fullPath, baseDir, item);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(path.relative(baseDir, fullPath));
      }
    }
    return files;
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   */
  async directQuery(
    items: Array<SouthConnectorItemEntity<SouthFolderScannerItemSettings>>
  ): Promise<Array<{ filename: string; modifiedTime: number }>> {
    const item = items[0];
    const itemValue = this.cacheService!.getItemLastValue(this.connector.id, null, item.id);
    let filesPreserved: Array<{ filename: string; modifiedTime: number }> = [];
    if (itemValue && Array.isArray(itemValue.value)) {
      filesPreserved = itemValue.value as Array<{ filename: string; modifiedTime: number }>;
    }
    // Migration fallback: if filesPreserved is empty AND trackedInstant is set (migrated from v3.7),
    // use trackedInstant as a cutoff to avoid re-processing files that were already processed before the migration.
    // After the first successful scan with preserveFiles=true, the file list is populated and this fallback is inactive.
    const legacyMigrationCutoffMs =
      filesPreserved.length === 0 && itemValue?.trackedInstant ? DateTime.fromISO(itemValue.trackedInstant).toMillis() : null;

    const inputFolder = path.resolve(this.connector.settings.inputFolder);
    this.logger.debug(`Reading "${inputFolder}" directory with regex "${item.settings.regex}" and minAge ${item.settings.minAge}`);

    let fileCount = 0;
    let sizeRetrieved = 0;
    const maxFiles = Number(item.settings.maxFiles) || 0;
    const maxSize = (Number(item.settings.maxSize) || 0) * 1024 * 1024; // Convert MB to bytes

    // List files in the inputFolder
    const startRequest = DateTime.now();
    const files = await this.listFilesRecursively(inputFolder, inputFolder, item);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
    this.logger.debug(`Found ${files.length} files in ${inputFolder} read in ${requestDuration} ms`);

    const filteredFiles = files.filter(file => file.match(item.settings.regex));
    // Filters file that may still currently being written (based on minimum age)
    const matchedFiles: Array<{ filename: string; stats: Stats }> = [];
    for (const file of filteredFiles) {
      const stats = await fs.stat(path.join(inputFolder, file));
      if (legacyMigrationCutoffMs !== null && stats.mtimeMs <= legacyMigrationCutoffMs) {
        this.logger.trace(`Skipping "${file}" — modified before v3.7 migration cutoff`);
        continue;
      }
      if (checkAge(item, file, stats.mtimeMs, filesPreserved, this.logger)) {
        matchedFiles.push({ filename: file, stats });
      }
    }

    for (const file of matchedFiles) {
      // Check the file count limit (applies across all items in this scan)
      if (maxFiles > 0 && fileCount >= maxFiles) {
        this.logger.debug(`Max files limit (${maxFiles}) reached for item ${item.name}, skipping remaining files`);
        break;
      }

      // Check size limit (applies across all items in this scan)
      const filePath = path.resolve(inputFolder, file.filename);
      if (maxSize > 0 && sizeRetrieved + file.stats.size > maxSize) {
        this.logger.debug(`Max size limit (${item.settings.maxSize} MB) reached for item ${item.name}, skipping remaining files`);
        break;
      }

      sizeRetrieved += file.stats.size;
      fileCount++;
      await this.sendFile(item, file.filename, startRequest.toUTC().toISO());

      // Delete the original file if preserveFile is not set
      if (!item.settings.preserveFiles) {
        try {
          await fs.unlink(filePath);
        } catch (unlinkError) {
          this.logger.error(`Error while removing "${filePath}": ${unlinkError}`);
        }
      } else {
        this.logger.debug(`Upsert handled file "${file.filename}" with modify time ${file.stats.mtimeMs}`);
        const existingIndex = filesPreserved.findIndex(f => f.filename === file.filename);
        if (existingIndex >= 0) {
          filesPreserved[existingIndex].modifiedTime = file.stats.mtimeMs;
        } else {
          filesPreserved.push({ filename: file.filename, modifiedTime: file.stats.mtimeMs });
        }
      }
    }
    return filesPreserved;
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
        const safeFilename = filename.split(path.sep).join('_');
        const gzipPath = path.resolve(this.tmpFolder, `${safeFilename}.gz`);
        await compress(filePath, gzipPath);
        await this.addContent({ type: 'any', filePath: gzipPath }, queryTime, [item]);
        try {
          await fs.unlink(gzipPath);
        } catch (unlinkError) {
          this.logger.error(`Error while removing compressed file "${gzipPath}": ${unlinkError}`);
        }
      } catch (error: unknown) {
        this.logger.error(`Error compressing file "${filePath}": ${(error as Error).message}. Sending it raw instead.`);
        await this.addContent({ type: 'any', filePath }, queryTime, [item]);
      }
    } else {
      await this.addContent({ type: 'any', filePath }, queryTime, [item]);
    }
  }
}
