import path from 'node:path';
import * as pg from 'pg';
import { ClientConfig } from 'pg';

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
import { SouthPostgreSQLItemSettings, SouthPostgreSQLSettings } from '../../../../shared/model/south-settings.model';
import { OIBusDataValue } from '../../../../shared/model/engine.model';

/**
 * Class SouthPostgreSQL - Retrieve data from PostgreSQL databases and send them to the cache as CSV files.
 */
export default class SouthPostgreSQL
  extends SouthConnector<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>
  implements QueriesHistory
{
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthPostgreSQLSettings>,
    items: Array<SouthConnectorItemDTO<SouthPostgreSQLItemSettings>>,
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

  async createConnectionOptions(): Promise<ClientConfig> {
    return {
      host: this.connector.settings.host,
      port: this.connector.settings.port,
      user: this.connector.settings.username || undefined,
      password: this.connector.settings.password ? await this.encryptionService.decryptText(this.connector.settings.password) : undefined,
      database: this.connector.settings.database,
      query_timeout: this.connector.settings.requestTimeout,
      connectionTimeoutMillis: this.connector.settings.connectionTimeout
    };
  }

  override async testConnection(): Promise<void> {
    this.logger.info(`Testing connection on "${this.connector.settings.host}"`);
    const config = await this.createConnectionOptions();

    let connection;
    try {
      connection = new pg.Client(config);
      await connection.connect();
    } catch (error: any) {
      this.logger.error(`Unable to connect to database. ${error.message}`);
      if (connection) {
        await connection.end();
      }

      if (/(timeout expired)|(^(connect ECONNREFUSED).*)/.test(error.message)) {
        throw new Error('Please check host and port');
      }

      switch (error.message) {
        case `password authentication failed for user "${this.connector.settings.username}"`:
          throw new Error('Please check username and password');

        case `database "${this.connector.settings.database}" does not exist`:
          throw new Error(`Database "${this.connector.settings.database}" does not exist`);

        default:
          throw new Error('Please check logs');
      }
    }

    let tables;
    try {
      const { rows } = await connection.query(`
        SELECT TABLES.table_name,
               (SELECT string_agg(column_name || '(' || data_type || ')', ', ' ORDER BY table_name)
                FROM information_schema.columns
                WHERE table_name = TABLES.table_name) columns
        FROM information_schema.tables TABLES
        WHERE table_type = 'BASE TABLE'
          AND table_schema = current_schema()
      `);
      tables = rows;
    } catch (error: any) {
      await connection.end();

      this.logger.error(`Unable to read tables in database "${this.connector.settings.database}". ${error.message}`);
      throw new Error(`Unable to read tables in database "${this.connector.settings.database}", check logs`);
    }

    await connection.end();

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
  async historyQuery(
    items: Array<SouthConnectorItemDTO<SouthPostgreSQLItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant> {
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
            const datetimeField = item.settings.dateTimeFields.find(dateTimeField => dateTimeField.fieldName === key);
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
   * Apply the SQL query to the target PostgreSQL database
   */
  async queryData(item: SouthConnectorItemDTO<SouthPostgreSQLItemSettings>, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, '$1').replace(/@EndTime/g, '$2');
    const config = await this.createConnectionOptions();

    const referenceTimestampField = item.settings.dateTimeFields.find(dateTimeField => dateTimeField.useAsReference);
    const postgresqlStartTime = referenceTimestampField == null ? startTime : formatInstant(startTime, referenceTimestampField);
    const postgresqlEndTime = referenceTimestampField == null ? endTime : formatInstant(endTime, referenceTimestampField);
    logQuery(item.settings.query, postgresqlStartTime, postgresqlEndTime, this.logger);

    let connection;
    try {
      connection = new pg.Client(config);
      await connection.connect();
      const params = generateReplacementParameters(item.settings.query, postgresqlStartTime, postgresqlEndTime);
      const { rows } = await connection.query(adaptedQuery, params);
      await connection.end();
      return rows;
    } catch (error) {
      if (connection) {
        await connection.end();
      }
      throw error;
    }
  }
}
