import path from 'node:path';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { createFolder, generateReplacementParameters, getMostRecentDate, logQuery, writeResults } from '../../service/utils';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';

let odbc: { connect: (arg0: { connectionString: string; connectionTimeout: any; loginTimeout: any }) => any } | null = null;
// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import('odbc')
  .then(obj => {
    odbc = obj;
  })
  .catch(() => {
    console.error('Could not load odbc');
  });

/**
 * Class SouthODBC - Retrieve data from SQL databases with ODBC driver and send them to the cache as CSV files.
 */
export default class SouthODBC extends SouthConnector implements QueriesHistory {
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

  override async testConnection(settings: SouthConnectorDTO['settings']): Promise<boolean> {
    this.logger.trace(`Testing connection`);
    return false;
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(items: Array<OibusItemDTO>, startTime: Instant, endTime: Instant): Promise<Instant> {
    let updatedStartTime = startTime;

    for (const item of items) {
      logQuery(item.settings.query, updatedStartTime, endTime, this.logger);

      const result: Array<any> = await this.getDataFromOdbc(item, updatedStartTime, endTime);
      this.logger.info(`Found ${result.length} results`);

      if (result.length > 0) {
        await writeResults(
          result,
          item.settings,
          this.configuration.settings.compression,
          this.configuration.name,
          this.tmpFolder,
          this.addFile,
          this.logger
        );

        updatedStartTime = getMostRecentDate(result, updatedStartTime, item.settings.timeField, this.configuration.settings.timezone);
      } else {
        this.logger.debug(`No result found between ${startTime} and ${endTime}`);
      }
    }
    return updatedStartTime;
  }

  /**
   * Apply the SQL query to the target ODBC database
   */
  async getDataFromOdbc(item: OibusItemDTO, startTime: Instant, endTime: Instant) {
    if (!odbc) {
      throw new Error('odbc library not loaded.');
    }
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?');

    let connectionString = `Driver=${this.configuration.settings.odbcDriverPath};SERVER=${
      this.configuration.settings.host
    };TrustServerCertificate=${this.configuration.settings.selfSigned ? 'yes' : 'no'};`;
    connectionString += `Database=${this.configuration.settings.database};UID=${
      this.configuration.settings.username
    };PWD=${await this.encryptionService.decryptText(this.configuration.settings.password)}`;
    let connection = null;
    let data = [];
    try {
      const connectionConfig = {
        connectionString,
        connectionTimeout: this.configuration.settings.connectionTimeout,
        loginTimeout: this.configuration.settings.connectionTimeout
      };
      connection = await odbc.connect(connectionConfig);

      // TODO: fix date format
      const startDateTime = DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
      const endDateTime = DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
      const params = generateReplacementParameters(item.settings.query, startDateTime, endDateTime);
      data = await connection.query(adaptedQuery, params);
    } catch (error: any) {
      if (error.odbcErrors?.length > 0) {
        error.odbcErrors.forEach((odbcError: any) => {
          this.logger.error(odbcError.message);
        });
      }
      if (connection) {
        await connection.close();
      }
      throw error;
    }
    if (connection) {
      await connection.close();
    }
    return data;
  }
}
