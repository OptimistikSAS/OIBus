import fs from 'node:fs/promises';
import path from 'node:path';

import NorthConnector from '../north-connector';
import pino from 'pino';
import { DateTime } from 'luxon';
import { NorthFileWriterSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import TransformerService from '../../service/transformer.service';
import { getFilenameWithoutRandomId } from '../../service/utils';

/**
 * Class NorthFileWriter - Write files in an output folder
 */
export default class NorthFileWriter extends NorthConnector<NorthFileWriterSettings> {
  constructor(
    configuration: NorthConnectorEntity<NorthFileWriterSettings>,
    transformerService: TransformerService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(configuration, transformerService, northConnectorRepository, scanModeRepository, logger, baseFolders);
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    if (!this.supportedTypes().includes(cacheMetadata.contentType)) {
      throw new Error(`Unsupported data type: ${cacheMetadata.contentType} (file ${cacheMetadata.contentFile})`);
    }

    const nowDate = DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS');

    // Remove timestamp from the file path
    const { name, ext } = path.parse(getFilenameWithoutRandomId(cacheMetadata.contentFile));

    const prefix = (this.connector.settings.prefix || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', this.connector.name);
    const suffix = (this.connector.settings.suffix || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', this.connector.name);

    const resultingFilename = `${prefix}${name}${suffix}${ext}`;
    await fs.copyFile(cacheMetadata.contentFile, path.join(path.resolve(this.connector.settings.outputFolder), resultingFilename));
    this.logger.debug(`File "${cacheMetadata.contentFile}" copied into "${resultingFilename}"`);
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

  supportedTypes(): Array<string> {
    return ['any'];
  }
}
