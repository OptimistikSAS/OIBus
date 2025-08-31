import fs from 'node:fs/promises';

import NorthConnector from '../north-connector';
import pino from 'pino';
import { NorthConsoleSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusSetpoint, OIBusTimeValue } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import CacheService from '../../service/cache/cache.service';

/**
 * Class Console - display values and file path into the console
 */
export default class NorthConsole extends NorthConnector<NorthConsoleSettings> {
  constructor(
    configuration: NorthConnectorEntity<NorthConsoleSettings>,
    logger: pino.Logger,
    cacheFolderPath: string,
    cacheService: CacheService
  ) {
    super(configuration, logger, cacheFolderPath, cacheService);
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    if (!this.supportedTypes().includes(cacheMetadata.contentType)) {
      throw new Error(`Unsupported data type: ${cacheMetadata.contentType} (file ${cacheMetadata.contentFile})`);
    }

    switch (cacheMetadata.contentType) {
      case 'any':
        return this.handleFile(cacheMetadata.contentFile);

      case 'time-values':
        return this.handleValues(JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusTimeValue>);

      case 'setpoint':
        return this.handleSetpoints(
          JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusSetpoint>
        );
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
   * Handle values by printing them to the console.
   */
  async handleSetpoints(values: Array<OIBusSetpoint>): Promise<void> {
    if (this.connector.settings.verbose) {
      console.table(values, ['reference', 'value']);
    } else {
      process.stdout.write(`North Console sent ${values.length} setpoint.\r\n`);
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

  supportedTypes(): Array<string> {
    return ['any', 'time-values', 'setpoint'];
  }
}
