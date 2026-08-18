import fs from 'node:fs/promises';
import path from 'node:path';

import SouthConnector from '../south-connector';
import { checkAge, compress, getErrorMessage, workUnitLogCtx } from '../../service/utils';

import { encryptionService } from '../../service/encryption.service';
import { SouthDirectQuery } from '../south-interface';
import { SouthFTPItemSettings, SouthFTPSettings, SouthItemSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { AccessOptions, Client as FTPClient, FileInfo } from 'basic-ftp';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { Instant } from '../../model/types';

/**
 * Class SouthFTP - Retrieve files from a remote FTP instance
 */
export default class SouthFTP extends SouthConnector<SouthFTPSettings, SouthFTPItemSettings> implements SouthDirectQuery {
  private client: FTPClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthFTPSettings, SouthFTPItemSettings>,
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

  /**
   * Open the persistent FTP connection used by every subsequent listFiles()/getFile() call, instead
   * of opening a fresh connection per operation. On failure (or if the connection is later lost, see
   * directQuery()), schedules a reconnect attempt.
   */
  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      this.logger.debug(`Connecting to FTP server ${this.connector.settings.host}:${this.connector.settings.port}...`);
      const client = new FTPClient();
      const connectStart = DateTime.now().toMillis();
      await client.access(await this.createConnectionOptions());
      const connectDuration = DateTime.now().toMillis() - connectStart;
      this.client = client;
      this.logger.info(`Connected to FTP server ${this.connector.settings.host}:${this.connector.settings.port} in ${connectDuration} ms`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(
        `Error while connecting to FTP server ${this.connector.settings.host}:${this.connector.settings.port}: ${getErrorMessage(error)}`
      );
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.client) {
      // basic-ftp's close() is synchronous and purely local (it just tears down the sockets) —
      // no network round-trip to time, unlike e.g. OPC UA's session.close().
      this.client.close();
      this.client = null;
      this.logger.info(`Disconnected from FTP server ${this.connector.settings.host}:${this.connector.settings.port}`);
    }
    await super.disconnect();
    this.disconnecting = false;
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    // Fully local client, opened and closed within this method — must never touch the connector's
    // own persistent `this.client`, so testing a connector's settings can never tear down a live
    // connection that connector is currently using.
    const client = new FTPClient();
    try {
      this.logger.debug(`Connecting to FTP server ${this.connector.settings.host}:${this.connector.settings.port}...`);
      const connectStart = DateTime.now().toMillis();
      await client.access(await this.createConnectionOptions());
      this.logger.info(
        `Connected to FTP server ${this.connector.settings.host}:${this.connector.settings.port} in ${DateTime.now().toMillis() - connectStart} ms`
      );
    } catch (error: unknown) {
      throw new Error(`Access error on "${this.connector.settings.host}:${this.connector.settings.port}": ${getErrorMessage(error)}`);
    } finally {
      client.close();
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
  ): Promise<SouthConnectorItemQueryResult> {
    // Fully local client, opened and closed within this method — see testConnection() above for why.
    const client = new FTPClient();
    try {
      this.logger.debug(`Connecting to FTP server ${this.connector.settings.host}:${this.connector.settings.port}...`);
      const connectStart = DateTime.now().toMillis();
      await client.access(await this.createConnectionOptions());
      const connectionDuration = DateTime.now().toMillis() - connectStart;
      this.logger.info(
        `Connected to FTP server ${this.connector.settings.host}:${this.connector.settings.port} in ${connectionDuration} ms`
      );

      const queryStart = DateTime.now().toMillis();
      const filesInFolder = await this.listFilesWithClient(client, item, []);
      const queryDuration = DateTime.now().toMillis() - queryStart;

      const values: Array<OIBusTimeValue> = filesInFolder.map(file => ({
        pointId: item.name,
        timestamp: DateTime.fromMillis(file.modifiedAt?.getTime() || Date.now())
          .toUTC()
          .toISO()!,
        data: { value: file.name }
      }));
      return {
        result: { type: 'time-values', content: values },
        connectionDuration,
        queryDuration
      };
    } finally {
      client.close();
    }
  }

  /**
   * List files recursively if enabled
   */
  private async listFilesRecursively(
    client: FTPClient,
    dirPath: string,
    item: SouthConnectorItemEntity<SouthFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>,
    relativePrefix = ''
  ): Promise<Array<FileInfo>> {
    const files: Array<FileInfo> = [];
    const fileList = await client.list(dirPath);

    for (const fileInfo of fileList) {
      const entryRelative = relativePrefix ? `${relativePrefix}/${fileInfo.name}` : fileInfo.name;
      if (fileInfo.isDirectory && item.settings.recursive) {
        const subFiles = await this.listFilesRecursively(client, `${dirPath}/${fileInfo.name}`, item, filesPreserved, entryRelative);
        files.push(...subFiles);
      } else if (fileInfo.isFile && this.checkCondition(item, fileInfo, filesPreserved)) {
        fileInfo.name = entryRelative;
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
    const logCtx = workUnitLogCtx(items);
    const itemValue = this.southCacheRepository.getItemLastValue(this.connector.id, item.id);
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
      logCtx,
      `Reading "${item.settings.remoteFolder}" remote folder on ${this.connector.settings.host}:${this.connector.settings.port} with regex "${item.settings.regex}" and minAge ${item.settings.minAge}`
    );
    try {
      const startRequest = DateTime.now().toMillis();
      const files = await this.listFiles(item, filesPreserved);
      const requestDuration = DateTime.now().toMillis() - startRequest;
      this.logger.debug(logCtx, `Folder ${item.settings.remoteFolder} listed ${files.length} files in ${requestDuration} ms`);

      for (const file of files) {
        // Check the file count limit (applies across all items in this scan)
        if (maxFiles > 0 && fileCount >= maxFiles) {
          this.logger.debug(logCtx, `Max files limit (${maxFiles}) reached for item ${item.name}, skipping remaining files`);
          break;
        }

        // Check size limit (applies across all items in this scan)
        const fileSize = file.size || 0;
        if (maxSize > 0 && sizeRetrieved + fileSize > maxSize) {
          this.logger.debug(logCtx, `Max size limit (${item.settings.maxSize} MB) reached for item ${item.name}, skipping remaining files`);
          break;
        }

        sizeRetrieved += fileSize;
        fileCount++;
        await this.getFile(file, item, filesPreserved);
      }
      return filesPreserved;
    } catch (error: unknown) {
      // basic-ftp's Client isn't an event emitter — there's no proactive 'close'/'error' event to
      // react to (unlike net.Socket or mqtt's client). Instead, any operation throwing here is
      // treated as the connection having been lost (basic-ftp closes the client automatically on
      // any timeout or connection error), so reconnection is reactive rather than event-driven.
      this.logger.error(
        logCtx,
        `Error while querying FTP server ${this.connector.settings.host}:${this.connector.settings.port}: ${getErrorMessage(error)}`
      );
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
      throw error;
    }
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
   * List files on the FTP server using the connector's persistent connection. Throws if the
   * connection isn't currently usable so the caller (directQuery()) can treat it as a lost
   * connection and schedule a reconnect.
   */
  async listFiles(
    item: SouthConnectorItemEntity<SouthFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): Promise<Array<FileInfo>> {
    // Kept `async` (with this `await`) rather than a plain function returning the delegated
    // promise: callers rely on the "not connected" case rejecting like every other failure here,
    // and a plain function would instead throw synchronously before any Promise exists.
    if (!this.client || this.client.closed) {
      throw new Error('FTP client is not connected');
    }
    return await this.listFilesWithClient(this.client, item, filesPreserved);
  }

  /**
   * Shared file-listing logic parameterized by client, so both the production path (listFiles(),
   * using the persistent `this.client`) and testItem() (using its own fully-local client) reuse the
   * same regex/recursive/age filtering without duplicating it.
   */
  private async listFilesWithClient(
    client: FTPClient,
    item: SouthConnectorItemEntity<SouthFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): Promise<Array<FileInfo>> {
    if (item.settings.recursive) {
      return await this.listFilesRecursively(client, item.settings.remoteFolder, item, filesPreserved);
    }
    const fileList = await client.list(item.settings.remoteFolder);
    return fileList.filter(fileInfo => this.checkCondition(item, fileInfo, filesPreserved));
  }

  /**
   * Retrieve a file from an FTP server and send it to the Engine, using the connector's persistent
   * connection. Throws if the connection isn't currently usable so the caller (directQuery()) can
   * treat it as a lost connection and schedule a reconnect.
   */
  async getFile(
    file: FileInfo,
    item: SouthConnectorItemEntity<SouthFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): Promise<void> {
    const logCtx = workUnitLogCtx([item]);
    if (!this.client || this.client.closed) {
      throw new Error('FTP client is not connected');
    }
    const client = this.client;

    const fileToRetrieve = `${item.settings.remoteFolder}/${file.name}`;
    const safeFilename = file.name.split(path.sep).join('_');
    const resultingFile = path.resolve(this.tmpFolder, safeFilename);

    const startRequest = DateTime.now();
    await client.downloadTo(resultingFile, fileToRetrieve);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
    this.logger.debug(logCtx, `File "${fileToRetrieve}" downloaded in ${requestDuration} ms`);

    if (!item.settings.preserveFiles) {
      try {
        await client.remove(fileToRetrieve);
      } catch (error: unknown) {
        this.logger.error(logCtx, `Error while removing "${fileToRetrieve}": ${getErrorMessage(error)}`);
      }
    } else {
      const modifyTime = file.modifiedAt?.getTime() || Date.now();
      this.logger.debug(logCtx, `Upsert handled file "${file.name}" with modify time ${modifyTime}`);
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
        } catch (unlinkError: unknown) {
          this.logger.error(logCtx, `Error while removing compressed file "${gzipPath}": ${getErrorMessage(unlinkError)}`);
        }
      } catch (error: unknown) {
        this.logger.error(logCtx, `Error compressing file "${resultingFile}": ${getErrorMessage(error)}. Sending it raw instead.`);
        await this.addContent({ type: 'any', filePath: resultingFile }, startRequest.toUTC().toISO(), [item]);
        try {
          await fs.unlink(resultingFile);
        } catch (unlinkError: unknown) {
          this.logger.error(logCtx, `Error while removing file "${resultingFile}": ${getErrorMessage(unlinkError)}`);
        }
      }
    } else {
      await this.addContent({ type: 'any', filePath: resultingFile }, startRequest.toUTC().toISO(), [item]);
      try {
        await fs.unlink(resultingFile);
      } catch (unlinkError: unknown) {
        this.logger.error(logCtx, `Error while removing file "${resultingFile}": ${getErrorMessage(unlinkError)}`);
      }
    }
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
