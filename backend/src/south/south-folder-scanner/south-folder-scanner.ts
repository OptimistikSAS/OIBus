import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

import SouthConnector from '../south-connector';
import { encryptionService } from '../../service/encryption.service';

const execFile = promisify(execFileCb);
import { checkAge, compress, getErrorMessage, sanitizeCommandError, workUnitLogCtx } from '../../service/utils';
import { SouthDirectQuery } from '../south-interface';
import { SouthFolderScannerItemSettings, SouthFolderScannerSettings, SouthItemSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { Instant, OIBusTestingError } from '../../model/types';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
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
    if (process.platform !== 'win32') {
      if (this.connector.settings.username) this.logger.trace('Skipping SMB session authentication: not running on Windows');
      return;
    }
    if (!this.connector.settings.username) return;
    const shareRoot = folderPath.match(/^(\\\\[^\\]+\\[^\\]+)/)?.[1];
    if (!shareRoot) return;
    const user = this.connector.settings.domain
      ? `${this.connector.settings.domain}\\${this.connector.settings.username}`
      : this.connector.settings.username;
    // Clear any existing session to this share first. Windows refuses to add a new one when a
    // connection is already active under a different identity (system error 1219: "Multiple
    // connections to a server or shared resource by the same user, using more than one user
    // name, are not allowed"). This can happen after an unclean shutdown, a previous failed
    // mount attempt, or a prior testConnection()/testItem() call that left its session open —
    // best-effort, there may simply be nothing to remove.
    await this.deleteNetworkSession(shareRoot);
    let password = '';
    try {
      password = this.connector.settings.password ? await encryptionService.decryptText(this.connector.settings.password) : '';
      // Authenticate against the actual target share (not just the server's IPC$ pseudo-share)
      // rather than storing credentials via cmdkey: `net use` establishes a live, session-scoped
      // SMB session for the calling process's own logon session, so subsequent UNC access to
      // that same share reuses it automatically. Targeting the exact share being read/written —
      // rather than IPC$ — avoids relying on credentials granted at the IPC$ level actually
      // carrying over to a different tree connect on the same server, which isn't guaranteed on
      // every SMB server implementation. This also avoids Windows Credential Manager/DPAPI
      // entirely, which is unreliable when OIBus runs as a Windows service — cmdkey-stored
      // credentials can silently fail to be usable even under the exact account that works fine
      // when run interactively.
      await execFile('net', ['use', shareRoot, password, `/user:${user}`, '/persistent:no']);
      this.logger.debug(`Authenticated SMB session for ${shareRoot} as ${user}`);
    } catch (error: unknown) {
      // net use is called with the plaintext password as an argument, so the default error message
      // Node builds on failure (and stdout/stderr) can contain it verbatim — sanitize before
      // logging or rethrowing so it never ends up in logs or bubbles up to the UI.
      const sanitizedError = sanitizeCommandError(error, password);
      this.logger.error(`Failed to authenticate SMB session for ${shareRoot}: ${sanitizedError.message}`);
      throw sanitizedError;
    }
  }

  private async unmountNetworkShare(folderPath: string): Promise<void> {
    if (process.platform !== 'win32') {
      if (this.connector.settings.username) this.logger.trace('Skipping SMB session removal: not running on Windows');
      return;
    }
    if (!this.connector.settings.username) return;
    const shareRoot = folderPath.match(/^(\\\\[^\\]+\\[^\\]+)/)?.[1];
    if (!shareRoot) return;
    await this.deleteNetworkSession(shareRoot);
  }

  private async deleteNetworkSession(shareRoot: string): Promise<void> {
    try {
      await execFile('net', ['use', shareRoot, '/delete', '/yes']);
    } catch {
      // Ignore — session may not exist
    }
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    // Deliberately does NOT unmount afterwards: the SMB session is a single shared OS-level
    // resource per share, not something owned exclusively by this call. If the connector is
    // already connected and actively running, tearing the session down here would rip it out
    // from under it, breaking every read until the next connect/reconnect — mountNetworkShare()'s
    // own delete-then-add already keeps things self-healing on the next mount, so there is
    // nothing to clean up here.
    await this.mountNetworkShare(this.connector.settings.inputFolder);
    const inputFolder = path.resolve(this.connector.settings.inputFolder);

    try {
      await fs.access(inputFolder, fs.constants.F_OK);
    } catch (error: unknown) {
      throw new OIBusTestingError(`Folder "${inputFolder}" does not exist: ${getErrorMessage(error)}`);
    }

    try {
      await fs.access(inputFolder, fs.constants.R_OK);
    } catch (error: unknown) {
      throw new OIBusTestingError(`Read access error on "${inputFolder}": ${getErrorMessage(error)}`);
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
  ): Promise<SouthConnectorItemQueryResult> {
    const connectStart = DateTime.now().toMillis();
    await this.testConnection();
    const connectionDuration = DateTime.now().toMillis() - connectStart;
    const queryStart = DateTime.now().toMillis();
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
    const queryDuration = DateTime.now().toMillis() - queryStart;
    const values: Array<OIBusTimeValue> = matchedFiles.map(file => ({
      pointId: item.name,
      timestamp: file.modifyTime,
      data: { value: file.name }
    }));
    return {
      result: { type: 'time-values', content: values },
      connectionDuration,
      queryDuration
    };
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
    // Re-authenticate before every scan rather than relying solely on the mount from connect():
    // this is a no-op most of the time (mountNetworkShare()'s delete-then-add is idempotent), but
    // self-heals a session that dropped or was replaced since connect() ran, instead of failing
    // every scan until the connector fully reconnects.
    await this.mountNetworkShare(this.connector.settings.inputFolder);
    const item = items[0];
    const logCtx = workUnitLogCtx(items);
    const itemValue = this.southCacheRepository.getItemLastValue(this.connector.id, item.id);
    let filesPreserved: Array<{ filename: string; modifiedTime: number }> = [];
    if (itemValue && Array.isArray(itemValue.value)) {
      filesPreserved = itemValue.value as Array<{ filename: string; modifiedTime: number }>;
    }

    const inputFolder = path.resolve(this.connector.settings.inputFolder);
    this.logger.debug(logCtx, `Reading "${inputFolder}" directory with regex "${item.settings.regex}" and minAge ${item.settings.minAge}`);

    let fileCount = 0;
    let sizeRetrieved = 0;
    const maxFiles = Number(item.settings.maxFiles) || 0;
    const maxSize = (Number(item.settings.maxSize) || 0) * 1024 * 1024; // Convert MB to bytes

    // List files in the inputFolder
    const startRequest = DateTime.now();
    const files = await this.listFilesRecursively(inputFolder, '', item);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
    this.logger.debug(logCtx, `Found ${files.length} files in ${inputFolder} read in ${requestDuration} ms`);

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
        this.logger.debug(logCtx, `Max files limit (${maxFiles}) reached for item ${item.name}, skipping remaining files`);
        break;
      }

      // Check size limit (applies across all items in this scan)
      const filePath = path.resolve(inputFolder, file.filename);
      if (maxSize > 0 && sizeRetrieved + file.stats.size > maxSize) {
        this.logger.debug(logCtx, `Max size limit (${item.settings.maxSize} MB) reached for item ${item.name}, skipping remaining files`);
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
          this.logger.error(logCtx, `Error while removing "${filePath}": ${getErrorMessage(unlinkError)}`);
        }
      } else {
        this.logger.debug(logCtx, `Upsert handled file "${file.filename}" with modify time ${file.stats.mtimeMs}`);
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
    const logCtx = workUnitLogCtx([item]);
    const filePath = path.resolve(this.connector.settings.inputFolder, filename);
    this.logger.info(logCtx, `Sending file "${filePath}" to the engine`);

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
          this.logger.error(logCtx, `Error while removing compressed file "${gzipPath}": ${getErrorMessage(unlinkError)}`);
        }
      } catch (error: unknown) {
        this.logger.error(logCtx, `Error compressing file "${filePath}": ${getErrorMessage(error)}. Sending it raw instead.`);
        await this.addContent({ type: 'any', filePath, filename }, queryTime, [item]);
      }
    } else {
      await this.addContent({ type: 'any', filePath, filename }, queryTime, [item]);
    }
  }
}
