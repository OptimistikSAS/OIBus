import fs from 'node:fs/promises';
import path from 'node:path';

import NorthConnector from '../north-connector';
import manifest from './manifest';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { DateTime } from 'luxon';
import { NorthFileWriterSettings } from '../../../../shared/model/north-settings.model';
import { OIBusContent, OIBusRawContent, OIBusTimeValueContent } from '../../../../shared/model/engine.model';
import csv from 'papaparse';

/**
 * Class NorthFileWriter - Write files in an output folder
 */
export default class NorthFileWriter extends NorthConnector<NorthFileWriterSettings> {
  static type = manifest.id;

  constructor(
    configuration: NorthConnectorDTO<NorthFileWriterSettings>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(configuration, encryptionService, repositoryService, logger, baseFolder);

    this.assignStandardTransformer('time-values', this.transformTimeValues);
    this.assignStandardTransformer('raw', this.transformRaw);
  }

  async handleContent(southData: OIBusContent): Promise<void> {
    const northData = await this.transform(southData, manifest.transformers!);

    const nowDate = DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS');
    const prefix = (this.connector.settings.prefix || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', this.connector.name);
    const suffix = (this.connector.settings.suffix || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', this.connector.name);

    switch (northData?.type) {
      case 'file-path': {
        const filePath = northData.data;

        // Remove timestamp from the file path
        const { name, ext } = path.parse(filePath);
        const filename = name.slice(0, name.lastIndexOf('-'));

        const resultingFilename = `${prefix}${filename}${suffix}${ext}`;
        await fs.copyFile(filePath, path.join(path.resolve(this.connector.settings.outputFolder), resultingFilename));
        this.logger.debug(`File "${filePath}" copied into "${resultingFilename}"`);
        break;
      }

      case 'file-content': {
        const content = northData.data.content;
        const ext = northData.data.ext;
        const filename = `${prefix}${DateTime.now().toUTC().toMillis()}${suffix}${ext}`;

        await fs.writeFile(path.join(path.resolve(this.connector.settings.outputFolder), filename), content);
        this.logger.debug(`File "${filename}" created in "${path.resolve(this.connector.settings.outputFolder)}" output folder`);
        break;
      }
    }
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

  /**
   * Standard transformer
   * @input time-values
   * @output file-content
   */
  async transformTimeValues(data: OIBusTimeValueContent) {
    const csvContent = csv.unparse(
      data.content.map(value => ({
        pointId: value.pointId,
        timestamp: value.timestamp,
        value: value.data.value
      })),
      {
        header: true,
        delimiter: ';'
      }
    );

    return {
      type: 'file-content',
      data: {
        content: csvContent,
        ext: '.csv'
      }
    };
  }

  /**
   * Standard transformer
   * @input raw
   * @output file-path
   */
  async transformRaw(data: OIBusRawContent) {
    return {
      type: 'file-path',
      data: data.filePath
    };
  }
}
