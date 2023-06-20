import path from 'node:path';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { formatInstant, convertDateTimeToInstant, createFolder, logQuery, persistResults } from '../../service/utils';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { DateTimeField, Instant, Serialization } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory, TestsConnection } from '../south-interface';

let odbc: any | null = null;
// @ts-ignore
import('odbc')
  .then(obj => {
    odbc = obj.default;
    console.info('odbc library loaded');
  })
  .catch(() => {
    console.error('Could not load odbc');
  });

/**
 * Class SouthIP21 - Retrieve data from SQL databases with ODBC driver AspenTech SQL Plus
 */
export default class SouthIP21 extends SouthConnector implements QueriesHistory, TestsConnection {
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    configuration: SouthConnectorDTO,
    items: Array<OibusItemDTO>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string,
    streamMode: boolean
  ) {
    super(
      configuration,
      items,
      engineAddValuesCallback,
      engineAddFileCallback,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      baseFolder,
      streamMode
    );
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start();
  }

  // TODO: method needs to be implemented
  static async testConnection(
    settings: SouthConnectorDTO['settings'],
    logger: pino.Logger,
    _encryptionService: EncryptionService
  ): Promise<void> {
    logger.trace(`Testing connection`);
    throw new Error('TODO: method needs to be implemented');
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(items: Array<OibusItemDTO>, startTime: Instant, endTime: Instant): Promise<Instant> {
    let updatedStartTime = startTime;

    for (const item of items) {
      const startRequest = DateTime.now().toMillis();
      const result: Array<any> = await this.queryData(item, updatedStartTime, endTime);
      const requestDuration = DateTime.now().toMillis() - startRequest;

      if (result.length > 0) {
        this.logger.info(`Found ${result.length} results for item ${item.name} in ${requestDuration} ms`);

        const formattedResult = result.map(entry => {
          const formattedEntry: Record<string, any> = {};
          Object.entries(entry).forEach(([key, value]) => {
            const datetimeField = item.settings.dateTimeFields.find((element: DateTimeField) => element.field === key);
            if (!datetimeField) {
              formattedEntry[key] = value;
            } else {
              const entryDate = convertDateTimeToInstant(entry[datetimeField.field], datetimeField.datetimeFormat);
              if (datetimeField.useAsReference) {
                if (entryDate > updatedStartTime) {
                  updatedStartTime = entryDate;
                }
              }
              formattedEntry[key] = formatInstant(entryDate, item.settings.serialization.dateTimeOutputFormat);
            }
          });
          return formattedEntry;
        });
        await persistResults(
          formattedResult,
          item.settings.serialization as Serialization,
          this.configuration.name,
          this.tmpFolder,
          this.addFile.bind(this),
          this.addValues.bind(this),
          this.logger
        );
      } else {
        this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
      }
    }
    return updatedStartTime;
  }

  /**
   * Apply the SQL query to the target ODBC database
   */
  async queryData(item: OibusItemDTO, startTime: Instant, endTime: Instant) {
    if (!odbc) {
      throw new Error('odbc library not loaded');
    }

    const connectionString = `Driver=AspenTech SQLplus;HOST=${this.configuration.settings.host};PORT=${this.configuration.settings.port};`;
    this.logger.debug(`Connecting with connection string ${connectionString}`);

    let connection;
    try {
      const connectionConfig = {
        connectionString,
        connectionTimeout: this.configuration.settings.connectionTimeout
      };
      connection = await odbc.connect(connectionConfig);

      const dateTimeField = item.settings.dateTimeFields.find((dateTimeField: DateTimeField) => dateTimeField.useAsReference);
      const odbcStartTime = formatInstant(startTime, dateTimeField.datetimeFormat);
      const odbcEndTime = formatInstant(endTime, dateTimeField.datetimeFormat);
      const adaptedQuery = item.settings.query.replace(/@StartTime/g, odbcStartTime).replace(/@EndTime/g, odbcEndTime);
      logQuery(adaptedQuery, odbcStartTime, odbcEndTime, this.logger);
      const data = await connection.query(adaptedQuery);
      await connection.close();
      return data;
    } catch (error: any) {
      if (error.odbcErrors?.length > 0) {
        error.odbcErrors.forEach((odbcError: any) => {
          this.logger.error(`Error from IP21 driver: ${odbcError.message}`);
        });
      }
      if (connection) {
        await connection.close();
      }
      throw error;
    }
  }
}
