import fs from 'node:fs/promises';
import path from 'node:path';

import SouthConnector from '../south-connector';
import { checkAge, compress } from '../../service/utils';

import { encryptionService } from '../../service/encryption.service';
import { SouthDirectQuery } from '../south-interface';
import { SouthFTPItemSettings, SouthFTPSettings, SouthItemSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { AccessOptions, Client as FTPClient, FileInfo } from 'basic-ftp';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { Instant } from '../../model/types';
import type { ILogger } from '../../model/logger.model';

/**
 * Class SouthFTP - Retrieve files from a remote FTP instance
 */
export default class SouthFTP extends SouthConnector<SouthFTPSettings, SouthFTPItemSettings> implements SouthDirectQuery {
  constructor(
    connector: SouthConnectorEntity<SouthFTPSettings, SouthFTPItemSettings>,
    engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: ILogger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    try {
      const client = new FTPClient();
      await client.access(await this.createConnectionOptions());
      client.close();
    } catch (error: unknown) {
      throw new Error(`Access error on "${this.connector.settings.host}:${this.connector.settings.port}": ${(error as Error).message}`);
    }
    return {
      items: [
        { key: 'Host', value: `${this.connector.settings.host}:${this.connector.settings.port}` },
        { key: 'Username', value: this.connector.settings.username || '' }
      ]
    };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthFTPItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    const filesInFolder = await this.listFiles(item, []);

    const values: Array<OIBusTimeValue> = filesInFolder.map(file => ({
      pointId: item.name,
      timestamp: DateTime.fromMillis(file.modifiedAt?.getTime() || Date.now())
        .toUTC()
        .toISO()!,
      data: { value: file.name }
    }));
    return { type: 'time-values', content: values };
  }

  /**
   * List files recursively if enabled
   */
  private async listFilesRecursively(
    client: FTPClient,
    dirPath: string,
    item: SouthConnectorItemEntity<SouthFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): Promise<Array<FileInfo>> {
    const files: Array<FileInfo> = [];
    const fileList = await client.list(dirPath);

    for (const fileInfo of fileList) {
      if (fileInfo.isDirectory && item.settings.recursive) {
        const subPath = `${dirPath}/${fileInfo.name}`;
        const subFiles = await this.listFilesRecursively(client, subPath, item, filesPreserved);
        files.push(...subFiles);
      } else if (fileInfo.isFile && this.checkCondition(item, fileInfo, filesPreserved)) {
        // Preserve the relative path for recursive files
        fileInfo.name = `${dirPath}/${fileInfo.name}`.replace(item.settings.remoteFolder + '/', '');
        files.push(fileInfo);
      }
    }
    return files;
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   */
  async directQuery(
    items: Array<SouthConnectorItemEntity<SouthFTPItemSettings>>
  ): Promise<Array<{ filename: string; modifiedTime: number }>> {
    const item = items[0];
    const itemValue = this.cacheService!.getItemLastValue(this.connector.id, null, item.id);
    let filesPreserved: Array<{ filename: string; modifiedTime: number }> = [];
    if (itemValue && Array.isArray(itemValue.value)) {
      filesPreserved = itemValue.value as Array<{ filename: string; modifiedTime: number }>;
    }

    let fileCount = 0;
    let sizeRetrieved = 0;
    const maxFiles = Number(item.settings.maxFiles) || 0;
    const maxSize = (Number(item.settings.maxSize) || 0) * 1024 * 1024; // Convert MB to bytes

    // List files in the inputFolder
    this.logger.debug(
      `Reading "${item.settings.remoteFolder}" remote folder on ${this.connector.settings.host}:${this.connector.settings.port} with regex "${item.settings.regex}" and minAge ${item.settings.minAge}`
    );
    const startRequest = DateTime.now().toMillis();
    const files = await this.listFiles(item, filesPreserved);
    const requestDuration = DateTime.now().toMillis() - startRequest;
    this.logger.debug(`Folder ${item.settings.remoteFolder} listed ${files.length} files in ${requestDuration} ms`);

    for (const file of files) {
      // Check the file count limit (applies across all items in this scan)
      if (maxFiles > 0 && fileCount >= maxFiles) {
        this.logger.debug(`Max files limit (${maxFiles}) reached for item ${item.name}, skipping remaining files`);
        break;
      }

      // Check size limit (applies across all items in this scan)
      const fileSize = file.size || 0;
      if (maxSize > 0 && sizeRetrieved + fileSize > maxSize) {
        this.logger.debug(`Max size limit (${item.settings.maxSize} MB) reached for item ${item.name}, skipping remaining files`);
        break;
      }

      sizeRetrieved += fileSize;
      fileCount++;
      await this.getFile(file, item, filesPreserved);
    }
    return filesPreserved;
  }

  /**
   * Filter the files if the name and the age of the file meet the request or - when preserveFiles - if they were
   * already sent.
   */
  checkCondition(
    item: SouthConnectorItemEntity<SouthFTPItemSettings>,
    fileInfo: FileInfo,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): boolean {
    if (!fileInfo.name.match(item.settings.regex)) {
      this.logger.trace(`File name "${fileInfo.name}" does not match regex ${item.settings.regex}`);
      return false;
    }
    const timestamp = DateTime.now().toMillis();
    const fileModifyTime = fileInfo.modifiedAt?.getTime() || timestamp + item.settings.minAge;
    return checkAge(item, fileInfo.name, fileModifyTime, filesPreserved, this.logger);
  }

  /**
   * Retrieve a file from an FTP server and send it to the Engine.
   */
  async listFiles(
    item: SouthConnectorItemEntity<SouthFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): Promise<Array<FileInfo>> {
    const client = new FTPClient();
    await client.access(await this.createConnectionOptions());

    let filteredFiles: Array<FileInfo>;
    if (item.settings.recursive) {
      filteredFiles = await this.listFilesRecursively(client, item.settings.remoteFolder, item, filesPreserved);
    } else {
      const fileList = await client.list(item.settings.remoteFolder);
      filteredFiles = fileList.filter(fileInfo => {
        return this.checkCondition(item, fileInfo, filesPreserved);
      });
    }

    client.close();
    return filteredFiles;
  }

  /**
   * Retrieve a file from an FTP server and send it to the Engine.
   */
  async getFile(
    file: FileInfo,
    item: SouthConnectorItemEntity<SouthFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): Promise<void> {
    const client = new FTPClient();
    await client.access(await this.createConnectionOptions());

    const fileToRetrieve = `${item.settings.remoteFolder}/${file.name}`;
    const safeFilename = file.name.split(path.sep).join('_');
    const resultingFile = path.resolve(this.tmpFolder, safeFilename);

    const startRequest = DateTime.now();
    await client.downloadTo(resultingFile, fileToRetrieve);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
    this.logger.debug(`File "${fileToRetrieve}" downloaded in ${requestDuration} ms`);

    if (!item.settings.preserveFiles) {
      try {
        await client.remove(fileToRetrieve);
      } catch (error) {
        this.logger.error(`Error while removing "${fileToRetrieve}": ${error}`);
      }
    } else {
      const modifyTime = file.modifiedAt?.getTime() || Date.now();
      this.logger.debug(`Upsert handled file "${file.name}" with modify time ${modifyTime}`);
      const existingIndex = filesPreserved.findIndex(f => f.filename === file.name);
      if (existingIndex >= 0) {
        filesPreserved[existingIndex].modifiedTime = modifyTime;
      } else {
        filesPreserved.push({ filename: file.name, modifiedTime: modifyTime });
      }
    }

    if (this.connector.settings.compression) {
      try {
        // Compress and send the compressed file
        const gzipPath = path.resolve(this.tmpFolder, `${safeFilename}.gz`);
        await compress(resultingFile, gzipPath);
        await this.addContent({ type: 'any', filePath: gzipPath }, startRequest.toUTC().toISO(), [item]);
        try {
          await fs.unlink(resultingFile);
          await fs.unlink(gzipPath);
        } catch (unlinkError) {
          this.logger.error(`Error while removing compressed file "${gzipPath}": ${unlinkError}`);
        }
      } catch {
        this.logger.error(`Error compressing file "${resultingFile}". Sending it raw instead`);
        await this.addContent({ type: 'any', filePath: resultingFile }, startRequest.toUTC().toISO(), [item]);
        try {
          await fs.unlink(resultingFile);
        } catch (unlinkError) {
          this.logger.error(`Error while removing file "${resultingFile}": ${unlinkError}`);
        }
      }
    } else {
      await this.addContent({ type: 'any', filePath: resultingFile }, startRequest.toUTC().toISO(), [item]);
      try {
        await fs.unlink(resultingFile);
      } catch (unlinkError) {
        this.logger.error(`Error while removing file "${resultingFile}": ${unlinkError}`);
      }
    }
    client.close();
  }

  private async createConnectionOptions(): Promise<AccessOptions> {
    return {
      host: this.connector.settings.host,
      port: this.connector.settings.port,
      user: this.connector.settings.username || '',
      password: this.connector.settings.password ? await encryptionService.decryptText(this.connector.settings.password) : '',
      secure: false // FTP is not secure by default
    };
  }
}
