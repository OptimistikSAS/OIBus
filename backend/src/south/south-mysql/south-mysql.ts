import path from 'node:path';
import mysql from 'mysql2/promise';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { createFolder, generateReplacementParameters, getMostRecentDate, logQuery, writeResults } from '../../service/utils';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { QueriesHistory, TestsConnection } from '../south-interface';
import { DateTime } from 'luxon';

/**
 * Class SouthMySQL - Retrieve data from MySQL / MariaDB databases and send them to the cache as CSV files.
 */
export default class SouthMySQL extends SouthConnector implements QueriesHistory, TestsConnection {
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
      logQuery(item.settings.query, updatedStartTime, endTime, this.logger);

      const startRequest = DateTime.now().toMillis();
      const result: Array<any> = await this.getDataFromMySQL(item, updatedStartTime, endTime);
      const requestDuration = DateTime.now().toMillis() - startRequest;

      if (result.length > 0) {
        this.logger.info(`Found ${result.length} results for item ${item.name} in ${requestDuration} ms`);
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
        this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
      }
    }
    return updatedStartTime;
  }

  /**
   * Apply the SQL query to the target MySQL / MariaDB database
   */
  async getDataFromMySQL(item: OibusItemDTO, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?');

    const config = {
      host: this.configuration.settings.host,
      port: this.configuration.settings.port,
      user: this.configuration.settings.username,
      password: this.configuration.settings.password ? await this.encryptionService.decryptText(this.configuration.settings.password) : '',
      database: this.configuration.settings.database,
      connectTimeout: this.configuration.settings.connectionTimeout,
      timezone: 'Z'
    };

    let connection;
    try {
      connection = await mysql.createConnection(config);

      // TODO: format date
      const params = generateReplacementParameters(item.settings.query, startTime, endTime);
      const [data] = await connection.execute(
        {
          sql: adaptedQuery,
          timeout: this.configuration.settings.requestTimeout
        },
        params
      );
      await connection.end();
      return data as Array<any>;
    } catch (error) {
      if (connection) {
        await connection.end();
      }
      throw error;
    }
  }
}
