import fs from 'node:fs/promises';

import NorthConnector from '../north-connector';
import manifest from './manifest';
import pino from 'pino';

import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import { HandlesFile, HandlesValues } from '../north-interface';
import { NorthConsoleSettings } from '../../../../shared/model/north-settings.model';

/**
 * Class Console - display values and file path into the console
 */
export default class NorthConsole extends NorthConnector<NorthConsoleSettings> implements HandlesFile, HandlesValues {
  static type = manifest.id;

  constructor(
    configuration: NorthConnectorDTO<NorthConsoleSettings>,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(configuration, encryptionService, proxyService, repositoryService, logger, baseFolder);
  }

  /**
   * Handle values by printing them to the console.
   */
  async handleValues(values: Array<any>): Promise<void> {
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
}
