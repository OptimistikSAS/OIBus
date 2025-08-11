import fs from 'node:fs/promises';
import path from 'node:path';

import SouthConnector from '../south-connector';
import { compress, createFolder } from '../../service/utils';

import pino from 'pino';
import { encryptionService } from '../../service/encryption.service';
import { QueriesFile } from '../south-interface';
import { SouthFTPItemSettings, SouthFTPSettings } from '../../../shared/model/south-settings.model';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { Client as FTPClient, FileInfo, AccessOptions } from 'basic-ftp';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';

/**
 * Class SouthFTP - Retrieve files from remote FTP instance
 */
export default class SouthFTP extends SouthConnector<SouthFTPSettings, SouthFTPItemSettings> implements QueriesFile {
  private readonly tmpFolder: string;

  /**
   * Constructor for SouthFTP
   */
  constructor(
    connector: SouthConnectorEntity<SouthFTPSettings, SouthFTPItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    southConnectorRepository: SouthConnectorRepository,
    southCacheRepository: SouthCacheRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(connector, engineAddContentCallback, southConnectorRepository, southCacheRepository, scanModeRepository, logger, baseFolders);
    this.tmpFolder = path.resolve(this.baseFolders.cache, 'tmp');
  }

  override async testConnection(): Promise<void> {
    try {
      const client = new FTPClient();
      await client.access(await this.createConnectionOptions());
      await client.close();
    } catch (error: unknown) {
      throw new Error(`Access error on "${this.connector.settings.host}:${this.connector.settings.port}": ${(error as Error).message}`);
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthFTPItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void
  ): Promise<void> {
    const filesInFolder = await this.listFiles(item);

    const values: Array<OIBusTimeValue> = filesInFolder.map(file => ({
      pointId: item.name,
      timestamp: DateTime.fromMillis(file.modifiedAt?.getTime() || Date.now())
        .toUTC()
        .toISO()!,
      data: { value: file.name }
    }));
    callback({ type: 'time-values', content: values });
  }

  async start(dataStream = true): Promise<void> {
    if (this.connector.id !== 'test') {
      await createFolder(this.tmpFolder);
    }
    await super.start(dataStream);
    // Create a custom table in the south cache database to manage file already sent when preserve file is set to true
    if (this.cacheService) {
      this.cacheService.createCustomTable(`ftp_${this.connector.id}`, 'filename TEXT PRIMARY KEY, mtime_ms INTEGER');
    }
  }

  /**
   * Read the raw file and rewrite it to another file in the folder archive
   */
  async fileQuery(items: Array<SouthConnectorItemEntity<SouthFTPItemSettings>>): Promise<void> {
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
  checkCondition(item: SouthConnectorItemEntity<SouthFTPItemSettings>, fileInfo: FileInfo): boolean {
    if (!fileInfo.name.match(item.settings.regex)) {
      this.logger.trace(`File name "${fileInfo.name}" does not match regex ${item.settings.regex}`);
      return false;
    }

    const timestamp = DateTime.now().toMillis();
    const fileModifyTime = fileInfo.modifiedAt?.getTime() || timestamp;
    this.logger.trace(
      `Check age condition: mT:${fileModifyTime} + mA ${item.settings.minAge} < ts:${timestamp} ` +
        `= ${fileModifyTime + item.settings.minAge < timestamp}`
    );

    if (fileModifyTime + item.settings.minAge > timestamp) return false;
    this.logger.trace(`File "${fileInfo.name}" matches age`);

    // Check if the file was already sent (if preserveFiles is true)
    if (item.settings.preserveFiles) {
      if (item.settings.ignoreModifiedDate) return true;
      const lastModifiedTime = this.getModifiedTime(fileInfo.name);

      if (fileModifyTime <= lastModifiedTime) return false;
      this.logger.trace(
        `File "${fileInfo.name}" last modified time ${lastModifiedTime} is older than modify time ${fileModifyTime}. The file will be sent`
      );
    }
    return true;
  }

  getModifiedTime(filename: string): number {
    const query = `SELECT mtime_ms AS mtimeMs FROM "ftp_${this.connector.id}" WHERE filename = ?`;
    const result: { mtimeMs: string } | null = this.cacheService!.getQueryOnCustomTable(query, [filename]) as {
      mtimeMs: string;
    } | null;
    return result ? parseFloat(result.mtimeMs) : 0;
  }

  updateModifiedTime(filename: string, mtimeMs: number): void {
    const query = `INSERT INTO "ftp_${this.connector.id}" (filename, mtime_ms) VALUES (?, ?) ON CONFLICT(filename) DO UPDATE SET mtime_ms = ?`;
    this.cacheService!.runQueryOnCustomTable(query, [filename, mtimeMs, mtimeMs]);
  }

  /**
   * Retrieve a file from a FTP server and send it to the Engine.
   */
  async listFiles(item: SouthConnectorItemEntity<SouthFTPItemSettings>): Promise<Array<FileInfo>> {
    const client = new FTPClient();
    await client.access(await this.createConnectionOptions());

    const fileList = await client.list(item.settings.remoteFolder);
    const filteredFiles = fileList.filter(fileInfo => {
      return this.checkCondition(item, fileInfo);
    });

    await client.close();
    return filteredFiles;
  }

  /**
   * Retrieve a file from a FTP server and send it to the Engine.
   */
  async getFile(file: FileInfo, item: SouthConnectorItemEntity<SouthFTPItemSettings>): Promise<void> {
    const client = new FTPClient();
    await client.access(await this.createConnectionOptions());

    const fileToRetrieve = `${item.settings.remoteFolder}/${file.name}`;
    const resultingFile = path.resolve(this.tmpFolder, file.name);

    await client.downloadTo(resultingFile, fileToRetrieve);

    if (!item.settings.preserveFiles) {
      try {
        await client.remove(fileToRetrieve);
      } catch (error) {
        this.logger.error(`Error while removing "${fileToRetrieve}": ${error}`);
      }
    } else {
      const modifyTime = file.modifiedAt?.getTime() || Date.now();
      this.logger.debug(`Upsert handled file "${file.name}" with modify time ${modifyTime}`);
      this.updateModifiedTime(file.name, modifyTime);
    }

    if (this.connector.settings.compression) {
      try {
        // Compress and send the compressed file
        const gzipPath = path.resolve(this.tmpFolder, `${file.name}.gz`);
        await compress(resultingFile, gzipPath);
        await this.addContent({ type: 'any', filePath: gzipPath });
        try {
          await fs.unlink(resultingFile);
          await fs.unlink(gzipPath);
        } catch (unlinkError) {
          this.logger.error(`Error while removing compressed file "${gzipPath}": ${unlinkError}`);
        }
      } catch {
        this.logger.error(`Error compressing file "${resultingFile}". Sending it raw instead`);
        await this.addContent({ type: 'any', filePath: resultingFile });
        try {
          await fs.unlink(resultingFile);
        } catch (unlinkError) {
          this.logger.error(`Error while removing file "${resultingFile}": ${unlinkError}`);
        }
      }
    } else {
      await this.addContent({ type: 'any', filePath: resultingFile });
      try {
        await fs.unlink(resultingFile);
      } catch (unlinkError) {
        this.logger.error(`Error while removing file "${resultingFile}": ${unlinkError}`);
      }
    }

    await client.close();
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
