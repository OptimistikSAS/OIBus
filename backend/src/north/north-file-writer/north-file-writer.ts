import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

import NorthConnector from '../north-connector';
import { encryptionService } from '../../service/encryption.service';

const execFile = promisify(execFileCb);
import { DateTime } from 'luxon';
import { NorthFileWriterSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import type { ICacheService } from '../../model/cache.service.model';
import { createWriteStream, ReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

/**
 * Class NorthFileWriter - Write files in an output folder
 */
export default class NorthFileWriter extends NorthConnector<NorthFileWriterSettings> {
  constructor(configuration: NorthConnectorEntity<NorthFileWriterSettings>, cacheService: ICacheService) {
    super(configuration, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['any', 'setpoint', 'time-values'];
  }

  override async connect(): Promise<void> {
    await this.mountNetworkShare(this.connector.settings.outputFolder);
    return super.connect();
  }

  override async disconnect(): Promise<void> {
    await this.unmountNetworkShare(this.connector.settings.outputFolder);
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

  async testConnection(): Promise<OIBusConnectionTestResult> {
    await this.mountNetworkShare(this.connector.settings.outputFolder);
    const outputFolder = path.resolve(this.connector.settings.outputFolder);

    try {
      await fs.access(outputFolder, fs.constants.F_OK);
    } catch (error: unknown) {
      throw new Error(`Access error on "${outputFolder}": ${(error as Error).message}`);
    }

    try {
      await fs.access(outputFolder, fs.constants.W_OK);
    } catch (error: unknown) {
      throw new Error(`Access error on "${outputFolder}": ${(error as Error).message}`);
    }

    const items: Array<{ key: string; value: string }> = [{ key: 'Output Folder', value: outputFolder }];

    try {
      const files = await fs.readdir(outputFolder);
      items.push({ key: 'Files', value: String(files.length) });
    } catch {
      // File count not critical
    }

    return { items };
  }

  async handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    const { name, ext } = path.parse(cacheMetadata.contentFile);
    const nowDate = DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS');
    const prefix = (this.connector.settings.prefix || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', this.connector.name);
    const suffix = (this.connector.settings.suffix || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', this.connector.name);
    const resultingFilename = `${prefix}${name}${suffix}${ext}`;
    const destinationPath = path.join(path.resolve(this.connector.settings.outputFolder), resultingFilename);

    await pipeline(fileStream, createWriteStream(destinationPath));
    this.logger.debug(`File "${cacheMetadata.contentFile}" copied into "${resultingFilename}"`);
  }
}
