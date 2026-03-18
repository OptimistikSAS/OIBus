import fs from 'node:fs/promises';
import path from 'node:path';

import SouthConnector from '../south-connector';
import { checkAge, compress } from '../../service/utils';

import pino from 'pino';
import { SouthDirectQuery } from '../south-interface';
import { SouthItemSettings, SouthSFTPItemSettings, SouthSFTPSettings } from '../../../shared/model/south-settings.model';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import sftpClient, { ConnectOptions, FileInfo } from 'ssh2-sftp-client';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { encryptionService } from '../../service/encryption.service';
import { Instant } from '../../model/types';

/**
 * Class SouthSFTP - Retrieve files from remote SFTP instance
 */
export default class SouthSFTP extends SouthConnector<SouthSFTPSettings, SouthSFTPItemSettings> implements SouthDirectQuery {
  constructor(
    connector: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings>,
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

  override async testConnection(): Promise<void> {
    try {
      const connectionOptions = await this.createConnectionOptions();

      const client = new sftpClient();
      await client.connect(connectionOptions);
      await client.end();
    } catch (error: unknown) {
      throw new Error(`Access error on "${this.connector.settings.host}:${this.connector.settings.port}": ${(error as Error).message}`);
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthSFTPItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    const filesInFolder = await this.listFiles(item, []);

    const values: Array<OIBusTimeValue> = filesInFolder.map(file => ({
      pointId: item.name,
      timestamp: DateTime.fromMillis(file.modifyTime).toUTC().toISO()!,
      data: { value: file.name }
    }));
    return { type: 'time-values', content: values };
  }

  /**
   * List files recursively if enabled
   */
  private async listFilesRecursively(
    client: sftpClient,
    dirPath: string,
    item: SouthConnectorItemEntity<SouthSFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): Promise<Array<FileInfo>> {
    const files: Array<FileInfo> = [];
    const fileList = await client.list(dirPath);

    for (const fileInfo of fileList) {
      if (fileInfo.type === 'd' && item.settings.recursive) {
        const subPath = `${dirPath}/${fileInfo.name}`;
        const subFiles = await this.listFilesRecursively(client, subPath, item, filesPreserved);
        files.push(...subFiles);
      } else if (fileInfo.type === '-' && this.checkCondition(item, fileInfo, filesPreserved)) {
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
    items: Array<SouthConnectorItemEntity<SouthSFTPItemSettings>>
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
    item: SouthConnectorItemEntity<SouthSFTPItemSettings>,
    fileInfo: FileInfo,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): boolean {
    if (!fileInfo.name.match(item.settings.regex)) {
      this.logger.trace(`File name "${fileInfo.name}" does not match regex ${item.settings.regex}`);
      return false;
    }
    return checkAge(item, fileInfo.name, fileInfo.modifyTime, filesPreserved, this.logger);
  }

  /**
   * Retrieve a file from a SFTP server and send it to the Engine.
   */
  async listFiles(
    item: SouthConnectorItemEntity<SouthSFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): Promise<Array<FileInfo>> {
    const connectionOptions = await this.createConnectionOptions();
    const client = new sftpClient();
    await client.connect(connectionOptions);

    let fileList: Array<FileInfo>;
    if (item.settings.recursive) {
      fileList = await this.listFilesRecursively(client, item.settings.remoteFolder, item, filesPreserved);
    } else {
      fileList = await client.list(item.settings.remoteFolder, fileInfo => {
        return this.checkCondition(item, fileInfo, filesPreserved);
      });
    }

    await client.end();
    return fileList;
  }

  /**
   * Retrieve a file from a SFTP server and send it to the Engine.
   */
  async getFile(
    file: FileInfo,
    item: SouthConnectorItemEntity<SouthSFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): Promise<void> {
    const connectionOptions = await this.createConnectionOptions();

    const client = new sftpClient();
    await client.connect(connectionOptions);

    const fileToRetrieve = `${item.settings.remoteFolder}/${file.name}`;
    const safeFilename = file.name.split(path.sep).join('_');
    const resultingFile = path.resolve(this.tmpFolder, safeFilename);
    const startRequest = DateTime.now();
    await client.fastGet(fileToRetrieve, resultingFile);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
    this.logger.debug(`File "${fileToRetrieve}" downloaded in ${requestDuration} ms`);

    if (!item.settings.preserveFiles) {
      try {
        await client.delete(fileToRetrieve);
      } catch (error) {
        this.logger.error(`Error while removing "${fileToRetrieve}": ${error}`);
      }
    } else {
      this.logger.debug(`Upsert handled file "${file.name}" with modify time ${file.modifyTime}`);
      const existingIndex = filesPreserved.findIndex(f => f.filename === file.name);
      if (existingIndex >= 0) {
        filesPreserved[existingIndex].modifiedTime = file.modifyTime;
      } else {
        filesPreserved.push({ filename: file.name, modifiedTime: file.modifyTime });
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
      }
    } else {
      await this.addContent({ type: 'any', filePath: resultingFile }, startRequest.toUTC().toISO(), [item]);
    }

    await client.end();
  }

  private async createConnectionOptions(): Promise<ConnectOptions> {
    switch (this.connector.settings.authentication) {
      case 'private-key':
        return {
          host: this.connector.settings.host,
          port: this.connector.settings.port,
          username: this.connector.settings.username,
          privateKey: await fs.readFile(this.connector.settings.privateKey!, 'utf8'),
          passphrase: this.connector.settings.passphrase ? await encryptionService.decryptText(this.connector.settings.passphrase) : ''
        };
      case 'password':
      default:
        return {
          host: this.connector.settings.host,
          port: this.connector.settings.port,
          username: this.connector.settings.username,
          password: this.connector.settings.password ? await encryptionService.decryptText(this.connector.settings.password) : ''
        };
    }
  }
}
