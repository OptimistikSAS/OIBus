import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

import NorthConnector from '../north-connector';
import { encryptionService } from '../../service/encryption.service';
import { sanitizeCommandError } from '../../service/utils';

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
    if (process.platform !== 'win32') {
      if (this.connector.settings.username) this.logger.trace('Skipping SMB session authentication: not running on Windows');
      return;
    }
    if (!this.connector.settings.username) return;
    const serverRoot = folderPath.match(/^(\\\\[^\\]+)/)?.[1];
    if (!serverRoot) return;
    const user = this.connector.settings.domain
      ? `${this.connector.settings.domain}\\${this.connector.settings.username}`
      : this.connector.settings.username;
    // Clear any existing session to this server first. Windows refuses to add a new one when a
    // connection is already active under a different identity (system error 1219: "Multiple
    // connections to a server or shared resource by the same user, using more than one user
    // name, are not allowed"). This can happen after an unclean shutdown, a previous failed
    // mount attempt, or a prior testConnection() call that left its session open — best-effort,
    // there may simply be nothing to remove.
    await this.deleteNetworkSession(serverRoot);
    let password = '';
    try {
      password = this.connector.settings.password ? await encryptionService.decryptText(this.connector.settings.password) : '';
      // Authenticate against the server's IPC$ share rather than storing credentials via cmdkey:
      // `net use` establishes a live, session-scoped SMB session for the calling process's own
      // logon session, so subsequent UNC access to that server reuses it automatically. This
      // avoids Windows Credential Manager/DPAPI entirely, which is unreliable when OIBus runs
      // as a Windows service — cmdkey-stored credentials can silently fail to be usable even
      // under the exact user account that works fine when run interactively.
      await execFile('net', ['use', `${serverRoot}\\IPC$`, password, `/user:${user}`, '/persistent:no']);
      this.logger.debug(`Authenticated SMB session for ${serverRoot} as ${user}`);
    } catch (error: unknown) {
      // net use is called with the plaintext password as an argument, so the default error message
      // Node builds on failure (and stdout/stderr) can contain it verbatim — sanitize before
      // logging or rethrowing so it never ends up in logs or bubbles up to the UI.
      const sanitizedError = sanitizeCommandError(error, password);
      this.logger.error(`Failed to authenticate SMB session for ${serverRoot}: ${sanitizedError.message}`);
      throw sanitizedError;
    }
  }

  private async unmountNetworkShare(folderPath: string): Promise<void> {
    if (process.platform !== 'win32') {
      if (this.connector.settings.username) this.logger.trace('Skipping SMB session removal: not running on Windows');
      return;
    }
    if (!this.connector.settings.username) return;
    const serverRoot = folderPath.match(/^(\\\\[^\\]+)/)?.[1];
    if (!serverRoot) return;
    await this.deleteNetworkSession(serverRoot);
  }

  private async deleteNetworkSession(serverRoot: string): Promise<void> {
    try {
      await execFile('net', ['use', `${serverRoot}\\IPC$`, '/delete', '/yes']);
    } catch {
      // Ignore — session may not exist
    }
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    await this.mountNetworkShare(this.connector.settings.outputFolder);
    try {
      const outputFolder = path.resolve(this.connector.settings.outputFolder);

      const testFile = path.join(outputFolder, `.oibus-write-test`);
      try {
        await fs.writeFile(testFile, '');
        await fs.unlink(testFile);
      } catch (error: unknown) {
        throw new Error(`Write access error on "${outputFolder}": ${(error as Error).message}`);
      }

      const items: Array<{ key: string; value: string }> = [{ key: 'Output Folder', value: outputFolder }];

      try {
        const files = await fs.readdir(outputFolder);
        items.push({ key: 'Files', value: String(files.length) });
      } catch {
        // File count not critical
      }

      return { items };
    } finally {
      // Tear down the session opened for this one-off test — testConnection() is not paired
      // with a disconnect() call, so without this a session stays open until the next mount
      // (which would otherwise be the only thing to clean it up).
      await this.unmountNetworkShare(this.connector.settings.outputFolder);
    }
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
