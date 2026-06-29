import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

import SouthConnector from '../south-connector';
import { encryptionService } from '../../service/encryption.service';

const execFile = promisify(execFileCb);
import { checkAge, compress } from '../../service/utils';
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
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, cacheFolderPath);
  }

  override async connect(): Promise<void> {
    await this.mountNetworkShare(this.connector.settings.inputFolder);
    return super.connect();
  }

  override async disconnect(): Promise<void> {
    await this.unmountNetworkShare(this.connector.settings.inputFolder);
    return super.disconnect();
  }

  private async mountNetworkShare(folderPath: string): Promise<void> {
    if (process.platform !== 'win32') return;
    if (!this.connector.settings.username) return;
    const uncRoot = folderPath.match(/^(\\\\[^\\]+\\[^\\]+)/)?.[1];
    if (!uncRoot) return;
    const user = this.connector.settings.domain
      ? `${this.connector.settings.domain}\\${this.connector.settings.username}`
      : this.connector.settings.username;
    try {
      const password = this.connector.settings.password ? await encryptionService.decryptText(this.connector.settings.password) : '';
      try {
        await execFile('net', ['use', uncRoot, password, `/user:${user}`, '/persistent:no']);
      } catch (firstError: unknown) {
        // Error 1219: existing connection with different credentials — disconnect and retry
        if ((firstError as Error).message?.includes('1219')) {
          await execFile('net', ['use', uncRoot, '/delete', '/yes']).catch(() => undefined);
          await execFile('net', ['use', uncRoot, password, `/user:${user}`, '/persistent:no']);
        } else {
          throw firstError;
        }
      }
      this.logger.debug(`Mounted SMB share ${uncRoot} as ${user}`);
    } catch (error: unknown) {
      this.logger.error(`Failed to mount SMB share ${uncRoot}: ${(error as Error).message}`);
      throw error;
    }
  }

  private async unmountNetworkShare(folderPath: string): Promise<void> {
    if (process.platform !== 'win32') return;
    if (!this.connector.settings.username) return;
    const uncRoot = folderPath.match(/^(\\\\[^\\]+\\[^\\]+)/)?.[1];
    if (!uncRoot) return;
    try {
      await execFile('net', ['use', uncRoot, '/delete', '/yes']);
    } catch {
      // Ignore — share may have already been disconnected
    }
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    await this.mountNetworkShare(this.connector.settings.inputFolder);
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
   * List files under {@link dirPath}, walking into subdirectories when `item.settings.recursive`
   * is enabled. Returns paths **relative to the original input folder** — i.e. a bare basename
   * for files at the top level, `subdir/name` for files nested one level down, and so on.
   *
   * The input folder itself is never included in the returned strings: top-level files keep the
   * exact basename that `fs.readdir` would have produced (matching the pre-recursive behaviour),
   * and nested files just get their relative subdir path prepended.
   *
   */
  private async listFilesRecursively(
    dirPath: string,
    relativePrefix: string,
    item: SouthConnectorItemEntity<SouthFolderScannerItemSettings>
  ): Promise<Array<string>> {
    const files: Array<string> = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelative = relativePrefix ? path.join(relativePrefix, entry.name) : entry.name;
      if (entry.isDirectory() && item.settings.recursive) {
        const subFiles = await this.listFilesRecursively(path.join(dirPath, entry.name), entryRelative, item);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(entryRelative);
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
    const itemValue = this.cacheService!.getItemLastValue(this.connector.id, item.id);
    let filesPreserved: Array<{ filename: string; modifiedTime: number }> = [];
    if (itemValue && Array.isArray(itemValue.value)) {
      filesPreserved = itemValue.value as Array<{ filename: string; modifiedTime: number }>;
    }

    const inputFolder = path.resolve(this.connector.settings.inputFolder);
    this.logger.debug(`Reading "${inputFolder}" directory with regex "${item.settings.regex}" and minAge ${item.settings.minAge}`);

    let fileCount = 0;
    let sizeRetrieved = 0;
    const maxFiles = Number(item.settings.maxFiles) || 0;
    const maxSize = (Number(item.settings.maxSize) || 0) * 1024 * 1024; // Convert MB to bytes

    // List files in the inputFolder
    const startRequest = DateTime.now();
    const files = await this.listFilesRecursively(inputFolder, '', item);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
    this.logger.debug(`Found ${files.length} files in ${inputFolder} read in ${requestDuration} ms`);

    const filteredFiles = files.filter(file => file.match(item.settings.regex));
    // Filters file that may still currently being written (based on minimum age)
    const matchedFiles: Array<{ filename: string; stats: Stats }> = [];
    for (const file of filteredFiles) {
      const stats = await fs.stat(path.join(inputFolder, file));
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
        // Compress and send the compressed file.
        // Use a flattened name for the temp .gz file (replace separators with _),
        // but preserve the original relative `filename` as the logical name so
        // north connectors see "subdir/file.json.gz" not the temp absolute path.
        const safeFilename = filename.split(path.sep).join('_');
        const gzipPath = path.resolve(this.tmpFolder, `${safeFilename}.gz`);
        await compress(filePath, gzipPath);
        await this.addContent({ type: 'any', filePath: gzipPath, filename: `${filename}.gz` }, queryTime, [item]);
        try {
          await fs.unlink(gzipPath);
        } catch (unlinkError) {
          this.logger.error(`Error while removing compressed file "${gzipPath}": ${unlinkError}`);
        }
      } catch (error: unknown) {
        this.logger.error(`Error compressing file "${filePath}": ${(error as Error).message}. Sending it raw instead.`);
        await this.addContent({ type: 'any', filePath, filename }, queryTime, [item]);
      }
    } else {
      await this.addContent({ type: 'any', filePath, filename }, queryTime, [item]);
    }
  }
}
