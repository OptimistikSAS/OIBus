import path from 'node:path';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import {
  convertDateTimeFromISO,
  createFolder,
  generateReplacementParameters,
  getMaxInstant,
  logQuery,
  serializeResults
} from '../../service/utils';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { DateTimeSerialization, Instant, Serialization } from '../../../../shared/model/types';
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
 * Class SouthODBC - Retrieve data from SQL databases with ODBC driver and send them to the cache as CSV files.
 */
export default class SouthODBC extends SouthConnector implements QueriesHistory, TestsConnection {
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
  static async testConnection(settings: SouthConnectorDTO['settings'], logger: pino.Logger): Promise<void> {
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
      const result: Array<any> = await this.getDataFromOdbc(item, updatedStartTime, endTime);
      const requestDuration = DateTime.now().toMillis() - startRequest;

      if (result.length > 0) {
        this.logger.info(`Found ${result.length} results for item ${item.name} in ${requestDuration} ms`);
        updatedStartTime = getMaxInstant(result, updatedStartTime, item.settings.serialization.datetimeSerialization);
        await serializeResults(
          result,
          item.settings.serialization as Serialization,
          this.configuration.name,
          this.tmpFolder,
          this.addFile.bind(this),
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
  async getDataFromOdbc(item: OibusItemDTO, startTime: Instant, endTime: Instant) {
    if (!odbc) {
      throw new Error('odbc library not loaded');
    }

    let connectionString = `Driver=${this.configuration.settings.driverPath};SERVER=${this.configuration.settings.host};PORT=${this.configuration.settings.port};`;
    if (this.configuration.settings.trustServerCertificate) {
      connectionString += `TrustServerCertificate=yes;`;
    }
    if (this.configuration.settings.database) {
      connectionString += `Database=${this.configuration.settings.database};`;
    }
    if (this.configuration.settings.username) {
      connectionString += `UID=${this.configuration.settings.username};`;
    }

    if (this.configuration.settings.username && this.configuration.settings.password) {
      this.logger.debug(`Connecting with connection string ${connectionString}PWD=<secret>;`);
      connectionString += `PWD=${await this.encryptionService.decryptText(this.configuration.settings.password)};`;
    } else {
      this.logger.debug(`Connecting with connection string ${connectionString}`);
    }

    const datetimeSerialization = item.settings.serialization.datetimeSerialization.find(
      (serialization: DateTimeSerialization) => serialization.useAsReference
    );
    const odbcStartTime = this.formatDatetimeVariables(startTime, datetimeSerialization);
    const odbcEndTime = this.formatDatetimeVariables(endTime, datetimeSerialization);

    logQuery(item.settings.query, odbcStartTime, odbcEndTime, this.logger);

    let connection;
    try {
      const connectionConfig = {
        connectionString,
        connectionTimeout: this.configuration.settings.connectionTimeout
      };
      connection = await odbc.connect(connectionConfig);

      const params = generateReplacementParameters(item.settings.query, odbcStartTime, odbcEndTime);
      const data = await connection.query(item.settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?'), params);
      await connection.close();
      return data;
    } catch (error: any) {
      if (error.odbcErrors?.length > 0) {
        error.odbcErrors.forEach((odbcError: any) => {
          this.logger.error(`Error from ODBC driver: ${odbcError.message}`);
        });
      }
      if (connection) {
        await connection.close();
      }
      throw error;
    }
  }

  formatDatetimeVariables = (datetime: Instant, serialization: DateTimeSerialization | null): string | number | DateTime => {
    if (!serialization) {
      return datetime;
    }
    return convertDateTimeFromISO(datetime, serialization.datetimeFormat);
  };
}
