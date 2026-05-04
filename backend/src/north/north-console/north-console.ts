import NorthConnector from '../north-connector';
import { NorthConsoleSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult, OIBusSetpoint, OIBusTimeValue } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import type { ICacheService } from '../../model/cache.service.model';
import { ReadStream } from 'node:fs';
import { streamToString } from '../../service/utils';
import type { ILogger } from '../../model/logger.model';

/**
 * Class Console - display values and file path into the console
 */
export default class NorthConsole extends NorthConnector<NorthConsoleSettings> {
  constructor(configuration: NorthConnectorEntity<NorthConsoleSettings>, logger: ILogger, cacheService: ICacheService) {
    super(configuration, logger, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['any', 'time-values', 'setpoint'];
  }

  testConnection(): Promise<OIBusConnectionTestResult> {
    if (!process.stdout.writable) {
      return Promise.reject(Error('The process.stdout stream has been destroyed, errored or ended'));
    }
    try {
      process.stdout.write('North Console output test.\r\n');
      console.table([{ data: 'foo' }, { data: 'bar' }]);
    } catch (error) {
      return Promise.reject(new Error(`Node process is unable to write to STDOUT. ${error}`));
    }

    return Promise.resolve({ items: [] });
  }

  async handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    switch (cacheMetadata.contentType) {
      case 'any':
        return this.handleFile(cacheMetadata);

      case 'time-values':
        return this.handleValues(JSON.parse(await streamToString(fileStream)) as Array<OIBusTimeValue>);

      case 'setpoint':
        return this.handleSetpoints(JSON.parse(await streamToString(fileStream)) as Array<OIBusSetpoint>);
    }
  }

  /**
   * Handle values by printing them to the console.
   */
  async handleValues(values: Array<OIBusTimeValue>): Promise<void> {
    if (this.connector.settings.verbose) {
      console.table(values, ['pointId', 'timestamp', 'data']);
    } else {
      process.stdout.write(`North Console sent ${values.length} values.\r\n`);
    }
  }

  /**
   * Handle values by printing them to the console.
   */
  async handleSetpoints(values: Array<OIBusSetpoint>): Promise<void> {
    if (this.connector.settings.verbose) {
      console.table(values, ['reference', 'value']);
    } else {
      process.stdout.write(`North Console sent ${values.length} setpoint.\r\n`);
    }
  }

  /**
   * Handle the file by displaying its name in the console
   */
  async handleFile(metadata: CacheMetadata): Promise<void> {
    if (this.connector.settings.verbose) {
      const data = [
        {
          filename: metadata.contentFile,
          fileSize: metadata.contentSize
        }
      ];
      console.table(data);
    } else {
      process.stdout.write('North Console sent 1 file.\r\n');
    }
  }
}
