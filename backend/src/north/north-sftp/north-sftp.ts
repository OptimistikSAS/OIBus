import path from 'node:path';

import NorthConnector from '../north-connector';
import EncryptionService from '../../service/encryption.service';
import pino from 'pino';
import { DateTime } from 'luxon';
import { NorthSFTPSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';

import sftpClient, { ConnectOptions } from 'ssh2-sftp-client';
import fs from 'node:fs/promises';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import TransformerService from '../../service/transformer.service';
import { getFilenameWithoutRandomId } from '../../service/utils';

/**
 * Class NorthSFTP - Write files in an output folder
 */
export default class NorthSFTP extends NorthConnector<NorthSFTPSettings> {
  constructor(
    configuration: NorthConnectorEntity<NorthSFTPSettings>,
    encryptionService: EncryptionService,
    transformerService: TransformerService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(configuration, encryptionService, transformerService, northConnectorRepository, scanModeRepository, logger, baseFolders);
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    const nowDate = DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS');

    // Remove timestamp from the file path
    const { name, ext } = path.parse(getFilenameWithoutRandomId(cacheMetadata.contentFile));

    const prefix = (this.connector.settings.prefix || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', this.connector.name);
    const suffix = (this.connector.settings.suffix || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', this.connector.name);

    const resultingFilename = `${prefix}${name}${suffix}${ext}`;
    const target = `${this.connector.settings.remoteFolder}/${resultingFilename}`;
    await this.sendToSftpServer(cacheMetadata.contentFile, target);
    this.logger.debug(`File "${cacheMetadata.contentFile}" sent into "${target}" remote folder`);
  }

  async sendToSftpServer(file: string | Buffer, target: string): Promise<void> {
    const connectionOptions = await this.createConnectionOptions();

    const client = new sftpClient();
    await client.connect(connectionOptions);
    await client.put(file, target);
    await client.end();
  }

  override async testConnection(): Promise<void> {
    let folderExists: false | 'd' | '-' | 'l' = false;
    const connectionOptions = await this.createConnectionOptions();
    try {
      const client = new sftpClient();
      await client.connect(connectionOptions);
      folderExists = await client.exists(this.connector.settings.remoteFolder);
      await client.end();
    } catch (error: unknown) {
      throw new Error(
        `Access error on "${this.connector.settings.remoteFolder}" on "${this.connector.settings.host}:${this.connector.settings.port}": ${(error as Error).message}`
      );
    }

    if (!folderExists) {
      throw new Error(
        `Remote target "${this.connector.settings.remoteFolder}" does not exist or the user does not have the right permissions`
      );
    } else if (folderExists !== 'd') {
      throw new Error(`Remote target "${this.connector.settings.remoteFolder}" is not a folder`);
    }
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
