import fs from 'node:fs/promises';

import NorthConnector from '../north-connector';
import manifest from './manifest';
import pino from 'pino';

import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';

/**
 * Class Console - display values and file path into the console
 */
export default class NorthConsole extends NorthConnector {
  static category = manifest.category;

  constructor(
    configuration: NorthConnectorDTO,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(configuration, encryptionService, proxyService, repositoryService, logger, baseFolder, manifest);
  }

  /**
   * Handle values by printing them to the console.
   */
  override async handleValues(values: Array<any>): Promise<void> {
    if (this.configuration.settings.verbose) {
      console.table(values, ['pointId', 'timestamp', 'data']);
    } else {
      process.stdout.write(`North Console sent ${values.length} values.\r\n`);
    }
  }

  /**
   * Handle the file by displaying its name in the console
   */
  override async handleFile(filePath: string): Promise<void> {
    if (this.configuration.settings.verbose) {
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
