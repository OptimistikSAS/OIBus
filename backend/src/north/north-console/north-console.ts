import fs from 'node:fs/promises';

import NorthConnector from '../north-connector';
import manifest from './manifest';
import pino from 'pino';

import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import { HandlesFile, HandlesValues } from '../north-interface';
import { NorthConsoleSettings } from '../../../../shared/model/north-settings.model';
import { OIBusDataValue } from '../../../../shared/model/engine.model';

/**
 * Class Console - display values and file path into the console
 */
export default class NorthConsole extends NorthConnector<NorthConsoleSettings> implements HandlesFile, HandlesValues {
  static type = manifest.id;

  constructor(
    configuration: NorthConnectorDTO<NorthConsoleSettings>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(configuration, encryptionService, repositoryService, logger, baseFolder);
  }

  /**
   * Handle values by printing them to the console.
   */
  async handleValues(values: Array<OIBusDataValue>): Promise<void> {
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
    this.logger.info('Testing North Console output');

    try {
      if (!process.stdout.writable) {
        throw new Error('The process.stdout stream has been destroyed, errored or ended');
      }

      process.stdout.write('North Console output test.\r\n');
      console.table([{ data: 'foo' }, { data: 'bar' }]);
    } catch (error) {
      this.logger.error(`Error testing North Console output: ${error}`);
      return Promise.reject(new Error('Node process is unable to write to STDOUT'));
    }

    return Promise.resolve();
  }
}
