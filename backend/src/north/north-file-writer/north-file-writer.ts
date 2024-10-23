import fs from 'node:fs/promises';
import path from 'node:path';

import NorthConnector from '../north-connector';
import EncryptionService from '../../service/encryption.service';
import pino from 'pino';
import { DateTime } from 'luxon';
import { NorthFileWriterSettings } from '../../../shared/model/north-settings.model';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import csv from 'papaparse';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';

/**
 * Class NorthFileWriter - Write files in an output folder
 */
export default class NorthFileWriter extends NorthConnector<NorthFileWriterSettings> {
  constructor(
    configuration: NorthConnectorEntity<NorthFileWriterSettings>,
    encryptionService: EncryptionService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, baseFolder);
  }

  async handleContent(data: OIBusContent): Promise<void> {
    switch (data.type) {
      case 'raw':
        return this.handleFile(data.filePath);

      case 'time-values':
        return this.handleValues(data.content);
    }
  }

  async handleValues(values: Array<OIBusTimeValue>): Promise<void> {
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
    } catch (error: unknown) {
      throw new Error(`Access error on "${outputFolder}": ${(error as Error).message}`);
    }

    try {
      await fs.access(outputFolder, fs.constants.W_OK);
    } catch (error: unknown) {
      throw new Error(`Access error on "${outputFolder}": ${(error as Error).message}`);
    }
  }
}
