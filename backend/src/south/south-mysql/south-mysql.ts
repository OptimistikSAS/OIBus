import path from 'node:path';
import mysql from 'mysql2/promise';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import {
  convertDateTimeToInstant,
  createFolder,
  formatInstant,
  generateReplacementParameters,
  logQuery,
  persistResults
} from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { QueriesHistory } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthMySQLItemSettings, SouthMySQLSettings } from '../../../../shared/model/south-settings.model';
import { OIBusDataValue } from '../../../../shared/model/engine.model';

/**
 * Class SouthMySQL - Retrieve data from MySQL / MariaDB databases and send them to the cache as CSV files.
 */
export default class SouthMySQL extends SouthConnector<SouthMySQLSettings, SouthMySQLItemSettings> implements QueriesHistory {
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthMySQLSettings>,
    items: Array<SouthConnectorItemDTO<SouthMySQLItemSettings>>,
    engineAddValuesCallback: (southId: string, values: Array<OIBusDataValue>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, items, engineAddValuesCallback, engineAddFileCallback, encryptionService, repositoryService, logger, baseFolder);
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start();
  }

  async createConnectionOptions(): Promise<mysql.ConnectionOptions> {
    return {
      host: this.connector.settings.host,
      port: this.connector.settings.port,
      user: this.connector.settings.username || undefined,
      password: this.connector.settings.password ? await this.encryptionService.decryptText(this.connector.settings.password) : undefined,
      database: this.connector.settings.database,
      connectTimeout: this.connector.settings.connectionTimeout,
      timezone: 'Z'
    };
  }

  override async testConnection(): Promise<void> {
    this.logger.info(`Testing connection on "${this.connector.settings.host}"`);
    const config = await this.createConnectionOptions();

    let connection;
    try {
      connection = await mysql.createConnection(config);
      await connection.ping();
    } catch (error: any) {
      this.logger.error(`Unable to connect to database. ${error.message}`);
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
          throw new Error(
            `User "${this.connector.settings.username}" does not have access to database "${this.connector.settings.database}"`
          );

        case 'ER_BAD_DB_ERROR':
          throw new Error(`Database "${this.connector.settings.database}" does not exist`);

        default:
          throw new Error('Please check logs');
      }
    }

    let table_count;
    try {
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(`
        SELECT COUNT(*) AS table_count
        FROM information_schema.TABLES AS TABLES
        WHERE table_schema = DATABASE()
          AND table_type = 'BASE TABLE'
      `);
      table_count = rows[0]?.table_count ?? 0;
    } catch (error: any) {
      await connection.end();

      this.logger.error(`Unable to read tables in database "${this.connector.settings.database}". ${error.message}`);
      throw new Error(`Unable to read tables in database "${this.connector.settings.database}", check logs`);
    }

    await connection.end();

    if (table_count === 0) {
      this.logger.warn(`Database "${this.connector.settings.database}" has no tables`);
      throw new Error('Database has no tables');
    }

    this.logger.info(`Database is live with ${table_count} tables`);
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
            const datetimeField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.fieldName === key) || null;
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
          this.connector.name,
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
    const config = await this.createConnectionOptions();

    const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference) || null;
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
          timeout: item.settings.requestTimeout
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
