import fs from 'node:fs/promises';

import NorthConnector from '../north-connector';
import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import { NorthConsoleSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusTimeValue } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';

/**
 * Class Console - display values and file path into the console
 */
export default class NorthConsole extends NorthConnector<NorthConsoleSettings> {
  constructor(
    configuration: NorthConnectorEntity<NorthConsoleSettings>,
    encryptionService: EncryptionService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, baseFolders);
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    switch (cacheMetadata.contentType) {
      case 'raw':
        return this.handleFile(cacheMetadata.contentFile);

      case 'time-values':
        return this.handleValues(JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusTimeValue>);
    }
  }

  /**
   * Handle values by printing them to the console.
   */
  async handleValues(values: Array<OIBusTimeValue>): Promise<void> {
    if (this.connector.settings.verbose) {
      console.table(values, ['pointId', 'timestamp', 'data']);
    } else {
      process.stdout.write(`North Console sent ${values.length} values.\r\n`);
    }
  }

  /**
   * Handle the file by displaying its name in the console
   */
  async handleFile(filePath: string): Promise<void> {
    if (this.connector.settings.verbose) {
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      const data = [
        {
          filePath,
          fileSize
        }
      ];
      console.table(data);
    } else {
      process.stdout.write('North Console sent 1 file.\r\n');
    }
  }

  override testConnection(): Promise<void> {
    if (!process.stdout.writable) {
      return Promise.reject(Error('The process.stdout stream has been destroyed, errored or ended'));
    }
    try {
      process.stdout.write('North Console output test.\r\n');
      console.table([{ data: 'foo' }, { data: 'bar' }]);
    } catch (error) {
      return Promise.reject(new Error(`Node process is unable to write to STDOUT. ${error}`));
    }

    return Promise.resolve();
  }
}
