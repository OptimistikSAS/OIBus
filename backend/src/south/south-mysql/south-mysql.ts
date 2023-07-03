import path from 'node:path';
import mysql from 'mysql2/promise';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import {
  formatInstant,
  convertDateTimeToInstant,
  createFolder,
  generateReplacementParameters,
  logQuery,
  persistResults
} from '../../service/utils';
import { SouthConnectorItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { QueriesHistory, TestsConnection } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthMySQLItemSettings, SouthMySQLSettings } from '../../../../shared/model/south-settings.model';

/**
 * Class SouthMySQL - Retrieve data from MySQL / MariaDB databases and send them to the cache as CSV files.
 */
export default class SouthMySQL
  extends SouthConnector<SouthMySQLSettings, SouthMySQLItemSettings>
  implements QueriesHistory, TestsConnection
{
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    configuration: SouthConnectorDTO<SouthMySQLSettings>,
    items: Array<SouthConnectorItemDTO<SouthMySQLItemSettings>>,
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

  static async testConnection(settings: SouthMySQLSettings, logger: pino.Logger, encryptionService: EncryptionService): Promise<void> {
    const config: mysql.ConnectionOptions = {
      host: settings.host,
      port: settings.port,
      user: settings.username,
      password: settings.password ? await encryptionService.decryptText(settings.password) : '',
      database: settings.database,
      connectTimeout: settings.connectionTimeout,
      timezone: 'Z'
    };
    let connection;
    logger.trace(`Testing if MYSQL connection settings are correct`);
    try {
      connection = await mysql.createConnection(config);
      logger.trace(`Pinging the database`);
      await connection.ping();
    } catch (error: any) {
      logger.error(`Unable to connect to database: ${error.message}`);
      if (connection) {
        await connection.end();
      }

      switch (error.code) {
        case 'ETIMEDOUT':
        case 'ECONNREFUSED':
          throw new Error('Please check host and port');

        case 'ER_ACCESS_DENIED_ERROR':
          throw new Error('Please check username and password');

        case 'ER_DBACCESS_DENIED_ERROR':
          throw new Error(`User '${settings.username}' does not have access to database '${settings.database}'`);

        case 'ER_BAD_DB_ERROR':
          throw new Error(`Database '${settings.database}' does not exist`);

        default:
          throw new Error('Please check logs');
      }
    }

    logger.trace(`Testing system table query`);

    let tables;
    try {
      [tables] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT TABLES.TABLE_NAME AS table_name,
               (SELECT GROUP_CONCAT(CONCAT(COLUMN_NAME, '(', DATA_TYPE, ')') SEPARATOR ', ')
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = TABLES.TABLE_NAME
                GROUP BY TABLE_SCHEMA) AS 'columns'
        FROM information_schema.TABLES AS TABLES
        WHERE table_schema = DATABASE()
          AND table_type = 'BASE TABLE'
      `);
    } catch (error: any) {
      await connection.end();

      logger.error(`Unable to read tables in database '${settings.database}': ${error.message}`);
      throw new Error(`Unable to read tables in database '${settings.database}', check logs`);
    }

    await connection.end();

    if (tables.length === 0) {
      logger.warn(`Database '${settings.database}' has no tables`);
      throw new Error('Database has no tables');
    }

    const tablesString = tables.map((row: any) => `${row.table_name}: [${row.columns}]`).join(',\n');

    logger.info('Database is live with tables (table:[columns]):\n%s', tablesString);
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(items: Array<SouthConnectorItemDTO<SouthMySQLItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
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
            const datetimeField = item.settings.dateTimeFields.find(dateTimeField => dateTimeField.fieldName === key) || null;
            if (!datetimeField) {
              formattedEntry[key] = value;
            } else {
              const entryDate = convertDateTimeToInstant(value, datetimeField);
              if (datetimeField.useAsReference) {
                if (entryDate > updatedStartTime) {
                  updatedStartTime = entryDate;
                }
              }
              formattedEntry[key] = formatInstant(entryDate, {
                type: 'string',
                format: item.settings.serialization.outputTimestampFormat,
                timezone: item.settings.serialization.outputTimezone,
                locale: 'en-En'
              });
            }
          });
          return formattedEntry;
        });
        await persistResults(
          formattedResult,
          item.settings.serialization,
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
    if (updatedStartTime !== startTime) {
      this.logger.debug(`Next start time updated from ${startTime} to ${updatedStartTime}`);
    }
    return updatedStartTime;
  }

  /**
   * Apply the SQL query to the target MySQL / MariaDB database
   */
  async queryData(item: SouthConnectorItemDTO<SouthMySQLItemSettings>, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const config = {
      host: this.configuration.settings.host,
      port: this.configuration.settings.port,
      user: this.configuration.settings.username,
      password: this.configuration.settings.password ? await this.encryptionService.decryptText(this.configuration.settings.password) : '',
      database: this.configuration.settings.database,
      connectTimeout: this.configuration.settings.connectionTimeout,
      timezone: 'Z'
    };

    const referenceTimestampField = item.settings.dateTimeFields.find(dateTimeField => dateTimeField.useAsReference) || null;
    const mysqlStartTime = referenceTimestampField == null ? startTime : formatInstant(startTime, referenceTimestampField);
    const mysqlEndTime = referenceTimestampField == null ? endTime : formatInstant(endTime, referenceTimestampField);
    logQuery(item.settings.query, mysqlStartTime, mysqlEndTime, this.logger);

    let connection;
    try {
      connection = await mysql.createConnection(config);
      const params = generateReplacementParameters(item.settings.query, mysqlStartTime, mysqlEndTime);
      const [data] = await connection.execute(
        {
          sql: item.settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?'),
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
