import fs from 'node:fs/promises';
import path from 'node:path';

import NorthConnector from '../north-connector';
import manifest from './manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { DateTime } from 'luxon';
import { HandlesFile, HandlesValues } from '../north-interface';
import { NorthFileWriterSettings } from '../../../../shared/model/north-settings.model';

/**
 * Class NorthFileWriter - Write file in an output folder. Values are stored in JSON files
 */
export default class NorthFileWriter extends NorthConnector<NorthFileWriterSettings> implements HandlesFile, HandlesValues {
  static type = manifest.id;

  constructor(
    configuration: NorthConnectorDTO<NorthFileWriterSettings>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(configuration, encryptionService, repositoryService, logger, baseFolder);
  }

  async handleValues(values: Array<any>): Promise<void> {
    const fileName = `${this.connector.settings.prefix}${DateTime.now().toUTC().toMillis()}${this.connector.settings.suffix}.json`;
    const cleanedValues = values.map(value => ({
      timestamp: value.timestamp,
      data: value.data,
      pointId: value.pointId
    }));
    const data = JSON.stringify(cleanedValues);

    await fs.writeFile(path.join(path.resolve(this.connector.settings.outputFolder), fileName), data);
    this.logger.debug(`File "${fileName}" created in "${path.resolve(this.connector.settings.outputFolder)}" output folder`);
  }

  async handleFile(filePath: string): Promise<void> {
    const extension = path.extname(filePath);
    let fileName = path.basename(filePath, extension);
    fileName = `${this.connector.settings.prefix}${fileName}${this.connector.settings.suffix}${extension}`;
    await fs.copyFile(filePath, path.join(path.resolve(this.connector.settings.outputFolder), fileName));
    this.logger.debug(`File "${filePath}" copied into "${fileName}"`);
  }
}
