import fs from 'node:fs/promises';
import path from 'node:path';

import SouthConnector from '../south-connector';
import { compress, createFolder } from '../../service/utils';
import manifest from './manifest';

import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import { QueriesFile } from '../south-interface';
import { SouthSFTPItemSettings, SouthSFTPSettings } from '../../../../shared/model/south-settings.model';
import { OIBusDataValue } from '../../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import sftpClient, { ConnectOptions, FileInfo } from 'ssh2-sftp-client';

/**
 * Class SouthSFTP - Retrieve files from remote SFTP instance
 */
export default class SouthSFTP extends SouthConnector<SouthSFTPSettings, SouthSFTPItemSettings> implements QueriesFile {
  static type = manifest.id;

  private readonly tmpFolder: string;

  /**
   * Constructor for SouthFolderScanner
   */
  constructor(
    connector: SouthConnectorDTO<SouthSFTPSettings>,
    engineAddValuesCallback: (southId: string, values: Array<OIBusDataValue>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, engineAddValuesCallback, engineAddFileCallback, encryptionService, repositoryService, logger, baseFolder);
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
  }

  override async testConnection(): Promise<void> {
    try {
      const connectionOptions = await this.createConnectionOptions();

      const client = new sftpClient();
      await client.connect(connectionOptions);
      await client.end();
    } catch (error: any) {
      throw new Error(`Access error on "${this.connector.settings.host}:${this.connector.settings.port}": ${error.message}`);
    }
  }

  async start(dataStream = true): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start(dataStream);
    // Create a custom table in the south cache database to manage file already sent when preserve file is set to true
    this.cacheService!.cacheRepository.createCustomTable(
      `folder_scanner_${this.connector.id}`,
      'filename TEXT PRIMARY KEY, mtime_ms INTEGER'
    );
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   */
  async fileQuery(items: Array<SouthConnectorItemDTO<SouthSFTPItemSettings>>): Promise<void> {
    for (const item of items) {
      // List files in the inputFolder
      this.logger.trace(
        `Reading "${item.settings.remoteFolder}" remote folder on ${this.connector.settings.host}:${this.connector.settings.port} for item ${item.name}`
      );
      const startRequest = DateTime.now().toMillis();
      const files = await this.listFiles(item);
      const requestDuration = DateTime.now().toMillis() - startRequest;
      this.logger.debug(`Folder ${item.settings.remoteFolder} listed ${files.length} files in ${requestDuration} ms`);

      for (const file of files) {
        await this.getFile(file, item);
      }
    }
  }

  /**
   * Filter the files if the name and the age of the file meet the request or - when preserveFiles - if they were
   * already sent.
   */
  checkCondition(item: SouthConnectorItemDTO<SouthSFTPItemSettings>, fileInfo: FileInfo): boolean {
    if (!fileInfo.name.match(item.settings.regex)) {
      this.logger.trace(`File name "${fileInfo.name}" does not match regex ${item.settings.regex}`);
      return false;
    }

    const timestamp = DateTime.now().toMillis();
    this.logger.trace(
      `Check age condition: mT:${fileInfo.modifyTime} + mA ${item.settings.minAge} < ts:${timestamp} ` +
        `= ${fileInfo.modifyTime + item.settings.minAge < timestamp}`
    );

    if (fileInfo.modifyTime + item.settings.minAge > timestamp) return false;
    this.logger.trace(`File "${fileInfo.name}" matches age`);

    // Check if the file was already sent (if preserveFiles is true)
    if (item.settings.preserveFiles) {
      if (item.settings.ignoreModifiedDate) return true;
      const lastModifiedTime = this.getModifiedTime(fileInfo.name);

      if (fileInfo.modifyTime <= lastModifiedTime) return false;
      this.logger.trace(
        `File "${fileInfo.name}" last modified time ${lastModifiedTime} is older than modify time ${fileInfo.modifyTime}. The file will be sent`
      );
    }
    return true;
  }

  getModifiedTime(filename: string): number {
    const query = `SELECT mtime_ms AS mtimeMs FROM "sftp_${this.connector.id}" WHERE filename = ?`;
    const result: { mtimeMs: string } | null = this.cacheService!.cacheRepository.getQueryOnCustomTable(query, [filename]) as {
      mtimeMs: string;
    } | null;
    return result ? parseFloat(result.mtimeMs) : 0;
  }

  updateModifiedTime(filename: string, mtimeMs: number): void {
    const query = `INSERT INTO "sftp_${this.connector.id}" (filename, mtime_ms) VALUES (?, ?) ON CONFLICT(filename) DO UPDATE SET mtime_ms = ?`;
    this.cacheService!.cacheRepository.runQueryOnCustomTable(query, [filename, mtimeMs, mtimeMs]);
  }

  /**
   * Retrieve a file from a SFTP server and send it to the Engine.
   */

  async listFiles(item: SouthConnectorItemDTO<SouthSFTPItemSettings>): Promise<Array<FileInfo>> {
    const connectionOptions = await this.createConnectionOptions();
    const client = new sftpClient();
    await client.connect(connectionOptions);
    const fileList = await client.list(item.settings.remoteFolder, fileInfo => {
      return this.checkCondition(item, fileInfo);
    });
    await client.end();
    return fileList;
  }

  /**
   * Retrieve a file from a SFTP server and send it to the Engine.
   */
  async getFile(file: FileInfo, item: SouthConnectorItemDTO<SouthSFTPItemSettings>): Promise<void> {
    const connectionOptions = await this.createConnectionOptions();

    const client = new sftpClient();
    await client.connect(connectionOptions);

    const fileToRetrieve = `${item.settings.remoteFolder}/${file.name}`;
    const resultingFile = path.resolve(this.tmpFolder, file.name);
    await client.fastGet(fileToRetrieve, resultingFile);
    if (!item.settings.preserveFiles) {
      try {
        await client.delete(fileToRetrieve);
      } catch (error) {
        this.logger.error(`Error while removing "${fileToRetrieve}": ${error}`);
      }
    } else {
      this.logger.debug(`Upsert handled file "${file.name}" with modify time ${file.modifyTime}`);
      this.updateModifiedTime(file.name, file.modifyTime);
    }

    if (this.connector.settings.compression) {
      try {
        // Compress and send the compressed file
        const gzipPath = path.resolve(this.tmpFolder, `${file.name}.gz`);
        await compress(resultingFile, gzipPath);
        await this.addFile(gzipPath);
        try {
          await fs.unlink(resultingFile);
          await fs.unlink(gzipPath);
        } catch (unlinkError) {
          this.logger.error(`Error while removing compressed file "${gzipPath}": ${unlinkError}`);
        }
      } catch (compressionError) {
        this.logger.error(`Error compressing file "${resultingFile}". Sending it raw instead`);
        await this.addFile(resultingFile);
      }
    } else {
      await this.addFile(resultingFile);
    }

    await client.end();
  }

  private async createConnectionOptions(): Promise<ConnectOptions> {
    switch (this.connector.settings.authentication) {
      case 'private-key':
        return {
          host: this.connector.settings.host,
          port: this.connector.settings.port,
          username: this.connector.settings.username || '',
          privateKey: await fs.readFile(this.connector.settings.privateKey!, 'utf8'),
          passphrase: this.connector.settings.passphrase ? await this.encryptionService.decryptText(this.connector.settings.passphrase) : ''
        };
      case 'password':
      default:
        return {
          host: this.connector.settings.host,
          port: this.connector.settings.port,
          username: this.connector.settings.username || '',
          password: this.connector.settings.password ? await this.encryptionService.decryptText(this.connector.settings.password) : ''
        };
    }
  }
}
