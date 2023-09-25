import path from 'node:path';
import mssql, { config } from 'mssql';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { convertDateTimeToInstant, createFolder, formatInstant, logQuery, persistResults } from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { QueriesHistory } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthMSSQLItemSettings, SouthMSSQLSettings } from '../../../../shared/model/south-settings.model';
import { OIBusDataValue } from '../../../../shared/model/engine.model';

/**
 * Class SouthMSSQL - Retrieve data from MSSQL databases and send them to the cache as CSV files.
 */
export default class SouthMSSQL extends SouthConnector<SouthMSSQLSettings, SouthMSSQLItemSettings> implements QueriesHistory {
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthMSSQLSettings>,
    items: Array<SouthConnectorItemDTO<SouthMSSQLItemSettings>>,
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

  async createConnectionOptions(): Promise<config> {
    const config: config = {
      user: this.connector.settings.username || undefined,
      password: this.connector.settings.password ? await this.encryptionService.decryptText(this.connector.settings.password) : undefined,
      server: this.connector.settings.host,
      port: this.connector.settings.port,
      database: this.connector.settings.database,
      connectionTimeout: this.connector.settings.connectionTimeout,
      requestTimeout: this.connector.settings.requestTimeout,
      options: {
        encrypt: this.connector.settings.encryption,
        trustServerCertificate: this.connector.settings.trustServerCertificate,
        useUTC: true
      }
    };
    if (this.connector.settings.domain) {
      config.domain = this.connector.settings.domain;
    }
    return config;
  }

  override async testConnection(): Promise<void> {
    this.logger.info(`Testing connection on "${this.connector.settings.host}"`);
    const config = await this.createConnectionOptions();

    let pool;
    let request;
    try {
      pool = await new mssql.ConnectionPool(config).connect();
      request = pool.request();
    } catch (error: any) {
      this.logger.error(`Unable to connect to database: ${error.message}`);

      switch (error.code) {
        case 'ETIMEOUT':
        case 'ESOCKET':
          throw new Error('Please check host and port. See logs for more info');

        case 'ELOGIN':
          throw new Error('Please check username, password and database name. See logs for more info');

        default:
          throw new Error('Please check logs');
      }
    }

    let tables;
    try {
      const {
        recordsets: [recordset]
      } = await request.query<Array<any>>(`
        SELECT TABLES.TABLE_NAME     AS table_name,
               (SELECT STRING_AGG(CONCAT(COLUMN_NAME, '(', DATA_TYPE, ')'), ', ')
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = TABLES.TABLE_NAME
                GROUP BY TABLE_NAME) AS columns
        FROM INFORMATION_SCHEMA.TABLES TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
      `);
      tables = recordset as Array<any>;
    } catch (error: any) {
      await pool.close();
      this.logger.error(`Unable to read tables in database "${this.connector.settings.database}". ${error.message}`);
      throw new Error(`Unable to read tables in database "${this.connector.settings.database}", check logs`);
    }

    await pool.close();

    if (tables.length === 0) {
      this.logger.warn(`Database "${this.connector.settings.database}" has no table`);
      throw new Error('Database has no table');
    }

    const tablesString = tables.map((row: any) => `${row.table_name}: [${row.columns}]`).join(',\n');

    this.logger.info('Database is live with tables (table:[columns]):\n%s', tablesString);
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(items: Array<SouthConnectorItemDTO<SouthMSSQLItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
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
            const datetimeField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.fieldName === key);
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
    return updatedStartTime;
  }

  /**
   * Apply the SQL query to the target MSSQL database
   */
  async queryData(item: SouthConnectorItemDTO<SouthMSSQLItemSettings>, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const config = await this.createConnectionOptions();

    const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference) || null;
    const mssqlStartTime = referenceTimestampField == null ? startTime : formatInstant(startTime, referenceTimestampField);
    const mssqlEndTime = referenceTimestampField == null ? endTime : formatInstant(endTime, referenceTimestampField);
    logQuery(item.settings.query, mssqlStartTime, mssqlEndTime, this.logger);

    const pool = await new mssql.ConnectionPool(config).connect();
    const request = pool.request();
    if (item.settings.query.indexOf('@StartTime') !== -1) {
      request.input('StartTime', mssqlStartTime);
    }
    if (item.settings.query.indexOf('@EndTime') !== -1) {
      request.input('EndTime', mssqlEndTime);
    }
    try {
      const result = await request.query(item.settings.query);
      const [first] = result.recordsets as Array<any>;
      await pool.close();
      return first;
    } catch (error) {
      await pool.close();
      throw error;
    }
  }
}
