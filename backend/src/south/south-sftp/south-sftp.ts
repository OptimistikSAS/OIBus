import fs from 'node:fs/promises';
import path from 'node:path';

import SouthConnector from '../south-connector';
import { checkAge, compress, getErrorMessage, workUnitLogCtx } from '../../service/utils';

import { SouthDirectQuery } from '../south-interface';
import { SouthItemSettings, SouthSFTPItemSettings, SouthSFTPSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import sftpClient, { ConnectOptions, FileInfo } from 'ssh2-sftp-client';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { encryptionService } from '../../service/encryption.service';
import { Instant } from '../../model/types';

/**
 * Class SouthSFTP - Retrieve files from remote SFTP instance
 */
export default class SouthSFTP extends SouthConnector<SouthSFTPSettings, SouthSFTPItemSettings> implements SouthDirectQuery {
  private client: sftpClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthSFTPSettings, SouthSFTPItemSettings>,
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
   * Open the persistent SFTP connection used by every subsequent listFiles()/getFile() call, instead
   * of opening a fresh connection per operation. Unlike basic-ftp, ssh2-sftp-client's Client wraps
   * the underlying ssh2 socket's 'close'/'end'/'error' events via a callbacks object, so unexpected
   * disconnects are detected proactively rather than reactively (see handleUnexpectedDisconnect()).
   */
  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      this.logger.debug(`Connecting to SFTP server ${this.connector.settings.host}:${this.connector.settings.port}`);
      const connectionOptions = await this.createConnectionOptions();
      const client = new sftpClient(this.connector.name, {
        error: (error: unknown) => this.handleUnexpectedDisconnect(`SFTP client error: ${getErrorMessage(error)}`),
        close: () => this.handleUnexpectedDisconnect('SFTP client closed unexpectedly')
      });
      const connectStart = DateTime.now().toMillis();
      await client.connect(connectionOptions);
      const connectDuration = DateTime.now().toMillis() - connectStart;
      this.client = client;
      this.logger.info(`Connected to SFTP server ${this.connector.settings.host}:${this.connector.settings.port} in ${connectDuration} ms`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(
        `Error while connecting to SFTP server ${this.connector.settings.host}:${this.connector.settings.port}: ${getErrorMessage(error)}`
      );
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  /**
   * Called from the client's 'error'/'close' callbacks (see connect()) when the underlying
   * connection is lost without us having triggered it ourselves via disconnect(). Mirrors
   * south-modbus.ts's socket 'close' handler.
   */
  private handleUnexpectedDisconnect(reason: string): void {
    if (this.disconnecting) return;
    this.logger.warn(`${reason}. Reconnecting in ${this.connector.settings.retryInterval} ms`);
    (async () => {
      await this.disconnect();
      if (this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    })().catch((error: unknown) => {
      // Not awaited by ssh2-sftp-client's event handling — caught here so a failure while
      // recovering from an unexpected disconnect can't become an unhandled rejection.
      this.logger.error(`Error while handling unexpected SFTP disconnect: ${getErrorMessage(error)}`);
    });
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.client) {
      // Unlike basic-ftp's close(), ssh2-sftp-client's end() is a real async round-trip (it sends
      // a disconnect message to the server and waits for the socket to close), so it's worth timing.
      const disconnectStart = DateTime.now().toMillis();
      try {
        await this.client.end();
        this.logger.info(
          `Disconnected from SFTP server ${this.connector.settings.host}:${this.connector.settings.port} in ${DateTime.now().toMillis() - disconnectStart} ms`
        );
      } catch (error: unknown) {
        this.logger.error(
          `Error while disconnecting from SFTP server ${this.connector.settings.host}:${this.connector.settings.port}: ${getErrorMessage(error)}`
        );
      }
      this.client = null;
    }
    await super.disconnect();
    this.disconnecting = false;
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    // Fully local client, opened and closed within this method — must never touch the connector's
    // own persistent `this.client`, so testing a connector's settings can never tear down a live
    // connection that connector is currently using.
    const client = new sftpClient();
    try {
      const connectionOptions = await this.createConnectionOptions();
      this.logger.debug(`Connecting to SFTP server ${this.connector.settings.host}:${this.connector.settings.port}`);
      const connectStart = DateTime.now().toMillis();
      await client.connect(connectionOptions);
      this.logger.info(
        `Connected to SFTP server ${this.connector.settings.host}:${this.connector.settings.port} in ${DateTime.now().toMillis() - connectStart} ms`
      );
    } catch (error: unknown) {
      throw new Error(`Access error on "${this.connector.settings.host}:${this.connector.settings.port}": ${getErrorMessage(error)}`);
    } finally {
      try {
        await client.end();
      } catch (error: unknown) {
        this.logger.error(`Error while closing SFTP test connection: ${getErrorMessage(error)}`);
      }
    }
    return {
      items: [
        { key: 'Host', value: `${this.connector.settings.host}:${this.connector.settings.port}` },
        { key: 'Username', value: this.connector.settings.username || '' }
      ]
    };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthSFTPItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    // Fully local client, opened and closed within this method — see testConnection() above for why.
    const client = new sftpClient();
    try {
      const connectionOptions = await this.createConnectionOptions();
      this.logger.debug(`Connecting to SFTP server ${this.connector.settings.host}:${this.connector.settings.port}`);
      const connectStart = DateTime.now().toMillis();
      await client.connect(connectionOptions);
      const connectionDuration = DateTime.now().toMillis() - connectStart;
      this.logger.info(
        `Connected to SFTP server ${this.connector.settings.host}:${this.connector.settings.port} in ${connectionDuration} ms`
      );

      const queryStart = DateTime.now().toMillis();
      const filesInFolder = await this.listFilesWithClient(client, item, []);
      const queryDuration = DateTime.now().toMillis() - queryStart;

      const values: Array<OIBusTimeValue> = filesInFolder.map(file => ({
        pointId: item.name,
        timestamp: DateTime.fromMillis(file.modifyTime).toUTC().toISO()!,
        data: { value: file.name }
      }));
      return {
        result: { type: 'time-values', content: values },
        connectionDuration,
        queryDuration
      };
    } finally {
      try {
        await client.end();
      } catch (error: unknown) {
        this.logger.error(`Error while closing SFTP test connection: ${getErrorMessage(error)}`);
      }
    }
  }

  /**
   * List files recursively if enabled
   */
  private async listFilesRecursively(
    client: sftpClient,
    dirPath: string,
    item: SouthConnectorItemEntity<SouthSFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>,
    relativePrefix = ''
  ): Promise<Array<FileInfo>> {
    const files: Array<FileInfo> = [];
    const fileList = await client.list(dirPath);

    for (const fileInfo of fileList) {
      const entryRelative = relativePrefix ? `${relativePrefix}/${fileInfo.name}` : fileInfo.name;
      if (fileInfo.type === 'd' && item.settings.recursive) {
        const subFiles = await this.listFilesRecursively(client, `${dirPath}/${fileInfo.name}`, item, filesPreserved, entryRelative);
        files.push(...subFiles);
      } else if (fileInfo.type === '-' && this.checkCondition(item, fileInfo, filesPreserved)) {
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
    items: Array<SouthConnectorItemEntity<SouthSFTPItemSettings>>
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
   * List files on the SFTP server using the connector's persistent connection. Throws if the
   * connection isn't currently established — unexpected disconnects are detected proactively via
   * the client's 'close'/'error' callbacks (see connect()), which already null out `this.client`
   * and schedule a reconnect, so there's no need to reactively inspect the error here.
   */
  async listFiles(
    item: SouthConnectorItemEntity<SouthSFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): Promise<Array<FileInfo>> {
    // Kept `async` (with this `await`) rather than a plain function returning the delegated
    // promise: callers rely on the "not connected" case rejecting like every other failure here,
    // and a plain function would instead throw synchronously before any Promise exists.
    if (!this.client) {
      throw new Error('SFTP client is not connected');
    }
    return await this.listFilesWithClient(this.client, item, filesPreserved);
  }

  /**
   * Shared file-listing logic parameterized by client, so both the production path (listFiles(),
   * using the persistent `this.client`) and testItem() (using its own fully-local client) reuse the
   * same regex/recursive/age filtering without duplicating it.
   */
  private async listFilesWithClient(
    client: sftpClient,
    item: SouthConnectorItemEntity<SouthSFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): Promise<Array<FileInfo>> {
    if (item.settings.recursive) {
      return await this.listFilesRecursively(client, item.settings.remoteFolder, item, filesPreserved);
    }
    return await client.list(item.settings.remoteFolder, fileInfo => this.checkCondition(item, fileInfo, filesPreserved));
  }

  /**
   * Retrieve a file from a SFTP server and send it to the Engine, using the connector's persistent
   * connection.
   */
  async getFile(
    file: FileInfo,
    item: SouthConnectorItemEntity<SouthSFTPItemSettings>,
    filesPreserved: Array<{ filename: string; modifiedTime: number }>
  ): Promise<void> {
    const logCtx = workUnitLogCtx([item]);
    if (!this.client) {
      throw new Error('SFTP client is not connected');
    }
    const client = this.client;

    const fileToRetrieve = `${item.settings.remoteFolder}/${file.name}`;
    const safeFilename = file.name.split(path.sep).join('_');
    const resultingFile = path.resolve(this.tmpFolder, safeFilename);
    const startRequest = DateTime.now();
    await client.fastGet(fileToRetrieve, resultingFile);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
    this.logger.debug(logCtx, `File "${fileToRetrieve}" downloaded in ${requestDuration} ms`);

    if (!item.settings.preserveFiles) {
      try {
        await client.delete(fileToRetrieve);
      } catch (error: unknown) {
        this.logger.error(logCtx, `Error while removing "${fileToRetrieve}": ${getErrorMessage(error)}`);
      }
    } else {
      this.logger.debug(logCtx, `Upsert handled file "${file.name}" with modify time ${file.modifyTime}`);
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
