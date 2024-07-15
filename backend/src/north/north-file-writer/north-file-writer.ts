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
import { OIBusDataValue } from '../../../../shared/model/engine.model';
import csv from 'papaparse';

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

  async handleValues(values: Array<OIBusDataValue>): Promise<void> {
    const nowDate = DateTime.now().toUTC();
    const prefix = (this.connector.settings.prefix || '')
      .replace('@CurrentDate', nowDate.toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
      .replace('@ConnectorName', this.connector.name);
    const suffix = (this.connector.settings.suffix || '')
      .replace('@CurrentDate', nowDate.toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
      .replace('@ConnectorName', this.connector.name);

    const filename = `${prefix}${nowDate.toMillis()}${suffix}.csv`;

    const csvContent = csv.unparse(
      values.map(value => ({
        pointId: value.pointId,
        timestamp: value.timestamp,
        value: value.data.value
      })),
      {
        header: true,
        delimiter: ';'
      }
    );
    await fs.writeFile(path.join(path.resolve(this.connector.settings.outputFolder), filename), csvContent);
    this.logger.debug(`File "${filename}" created in "${path.resolve(this.connector.settings.outputFolder)}" output folder`);
  }

  async handleFile(filePath: string): Promise<void> {
    const nowDate = DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS');

    // Remove timestamp from the file path
    const { name, ext } = path.parse(filePath);
    const filename = name.slice(0, name.lastIndexOf('-'));

    const prefix = (this.connector.settings.prefix || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', this.connector.name);
    const suffix = (this.connector.settings.suffix || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', this.connector.name);

    const resultingFilename = `${prefix}${filename}${suffix}${ext}`;
    await fs.copyFile(filePath, path.join(path.resolve(this.connector.settings.outputFolder), resultingFilename));
    this.logger.debug(`File "${filePath}" copied into "${resultingFilename}"`);
  }

  override async testConnection(): Promise<void> {
    const outputFolder = path.resolve(this.connector.settings.outputFolder);

    try {
      await fs.access(outputFolder, fs.constants.F_OK);
    } catch (error: any) {
      throw new Error(`Access error on "${outputFolder}": ${error.message}`);
    }

    try {
      await fs.access(outputFolder, fs.constants.W_OK);
    } catch (error: any) {
      throw new Error(`Access error on "${outputFolder}": ${error.message}`);
    }
  }
}
