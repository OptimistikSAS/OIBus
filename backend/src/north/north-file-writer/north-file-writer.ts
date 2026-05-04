import fs from 'node:fs/promises';
import path from 'node:path';

import NorthConnector from '../north-connector';
import { DateTime } from 'luxon';
import { NorthFileWriterSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import type { ICacheService } from '../../model/cache.service.model';
import { createWriteStream, ReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { ILogger } from '../../model/logger.model';

/**
 * Class NorthFileWriter - Write files in an output folder
 */
export default class NorthFileWriter extends NorthConnector<NorthFileWriterSettings> {
  constructor(configuration: NorthConnectorEntity<NorthFileWriterSettings>, logger: ILogger, cacheService: ICacheService) {
    super(configuration, logger, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['any', 'setpoint', 'time-values'];
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
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

    const items: Array<{ key: string; value: string }> = [{ key: 'Output Folder', value: outputFolder }];

    try {
      const files = await fs.readdir(outputFolder);
      items.push({ key: 'Files', value: String(files.length) });
    } catch {
      // File count not critical
    }

    return { items };
  }

  async handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    const { name, ext } = path.parse(cacheMetadata.contentFile);
    const nowDate = DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS');
    const prefix = (this.connector.settings.prefix || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', this.connector.name);
    const suffix = (this.connector.settings.suffix || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', this.connector.name);
    const resultingFilename = `${prefix}${name}${suffix}${ext}`;
    const destinationPath = path.join(path.resolve(this.connector.settings.outputFolder), resultingFilename);

    await pipeline(fileStream, createWriteStream(destinationPath));
    this.logger.debug(`File "${cacheMetadata.contentFile}" copied into "${resultingFilename}"`);
  }
}
