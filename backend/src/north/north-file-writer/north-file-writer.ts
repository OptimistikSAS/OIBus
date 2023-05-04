import fs from 'node:fs/promises';
import path from 'node:path';

import NorthConnector from '../north-connector';
import manifest from './manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { DateTime } from 'luxon';

/**
 * Class NorthFileWriter - Write file in an output folder. Values are stored in JSON files
 */
export default class NorthFileWriter extends NorthConnector {
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

  override async handleValues(values: Array<any>): Promise<void> {
    const fileName = `${this.configuration.settings.prefix}${DateTime.now().toUTC().toMillis()}${this.configuration.settings.suffix}.json`;
    const cleanedValues = values.map(value => ({
      timestamp: value.timestamp,
      data: value.data,
      pointId: value.pointId
    }));
    const data = JSON.stringify(cleanedValues);

    await fs.writeFile(path.join(path.resolve(this.configuration.settings.outputFolder), fileName), data);
    this.logger.debug(`File "${fileName}" created in "${path.resolve(this.configuration.settings.outputFolder)}" output folder`);
  }

  override async handleFile(filePath: string): Promise<void> {
    const extension = path.extname(filePath);
    let fileName = path.basename(filePath, extension);
    fileName = `${this.configuration.settings.prefix}${fileName}${this.configuration.settings.suffix}${extension}`;
    await fs.copyFile(filePath, path.join(path.resolve(this.configuration.settings.outputFolder), fileName));
    this.logger.debug(`File "${filePath}" copied into "${fileName}"`);
  }
}
