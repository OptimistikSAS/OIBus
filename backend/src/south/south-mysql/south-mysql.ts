import path from 'node:path';
import mysql from 'mysql2/promise';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import {
  convertDateTimeToInstant,
  createFolder,
  formatInstant,
  generateCsvContent,
  generateFilenameForSerialization,
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
import { OIBusContent } from '../../../../shared/model/engine.model';

/**
 * Class SouthMySQL - Retrieve data from MySQL / MariaDB databases and send them to the cache as CSV files.
 */
export default class SouthMySQL extends SouthConnector<SouthMySQLSettings, SouthMySQLItemSettings> implements QueriesHistory {
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthMySQLSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, engineAddContentCallback, encryptionService, repositoryService, logger, baseFolder);
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(dataStream = true): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start(dataStream);
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
    const config = await this.createConnectionOptions();
    let connection;
    try {
      connection = await mysql.createConnection(config);
      await connection.ping();
    } catch (error: any) {
      if (connection) {
        await connection.end();
      }

      switch (error.code) {
        case 'ETIMEDOUT':
        case 'ECONNREFUSED':
          throw new Error(`Please check host and port. ${error.message}`);

        case 'ER_ACCESS_DENIED_ERROR':
          throw new Error(`Please check username and password. ${error.message}`);

        case 'ER_DBACCESS_DENIED_ERROR':
          throw new Error(
            `User "${this.connector.settings.username}" does not have access to database "${this.connector.settings.database}". ${error.message}`
          );

        case 'ER_BAD_DB_ERROR':
          throw new Error(`Database "${this.connector.settings.database}" does not exist. ${error.message}`);

        default:
          throw new Error(`Unexpected error. ${error.message}`);
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
      throw new Error(`Unable to read tables in database "${this.connector.settings.database}". ${error.message}`);
    }
    await connection.end();
    if (table_count === 0) {
      throw new Error(`Database "${this.connector.settings.database}" has no tables`);
    }
  }

  override async testItem(item: SouthConnectorItemDTO<SouthMySQLItemSettings>, callback: (data: OIBusContent) => void): Promise<void> {
    const config = await this.createConnectionOptions();
    const connection = await mysql.createConnection(config);

    const startTime = DateTime.now()
      .minus(3600 * 1000)
      .toUTC()
      .toISO() as Instant;
    const endTime = DateTime.now().toUTC().toISO() as Instant;
    const result: Array<any> = await this.queryData(item, startTime, endTime);
    await connection.end();

    const formattedResults = result.map(entry => {
      const formattedEntry: Record<string, any> = {};
      Object.entries(entry).forEach(([key, value]) => {
        const datetimeField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.fieldName === key) || null;
        if (!datetimeField) {
          formattedEntry[key] = value;
        } else {
          const entryDate = convertDateTimeToInstant(value, datetimeField);
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

    let oibusContent: OIBusContent;
    switch (item.settings.serialization.type) {
      case 'csv': {
        const filePath = generateFilenameForSerialization(
          this.tmpFolder,
          item.settings.serialization.filename,
          this.connector.name,
          item.name
        );
        const content = generateCsvContent(formattedResults, item.settings.serialization.delimiter);
        oibusContent = { type: 'raw', filePath, content };
        break;
      }
    }
    callback(oibusContent);
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
          item.name,
          this.tmpFolder,
          this.addContent.bind(this),
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
