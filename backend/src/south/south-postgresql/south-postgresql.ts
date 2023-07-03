import path from 'node:path';
import * as pg from 'pg';
import { ClientConfig } from 'pg';

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
import { SouthPostgreSQLItemSettings, SouthPostgreSQLSettings } from '../../../../shared/model/south-settings.model';

/**
 * Class SouthPostgreSQL - Retrieve data from PostgreSQL databases and send them to the cache as CSV files.
 */
export default class SouthPostgreSQL
  extends SouthConnector<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>
  implements QueriesHistory, TestsConnection
{
  static type = manifest.id;

  private readonly tmpFolder: string;
  constructor(
    configuration: SouthConnectorDTO<SouthPostgreSQLSettings>,
    items: Array<SouthConnectorItemDTO<SouthPostgreSQLItemSettings>>,
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

  static async testConnection(settings: SouthPostgreSQLSettings, logger: pino.Logger, encryptionService: EncryptionService): Promise<void> {
    const config: ClientConfig = {
      host: settings.host,
      port: settings.port,
      user: settings.username,
      password: settings.password ? await encryptionService.decryptText(settings.password) : '',
      database: settings.database,
      query_timeout: settings.requestTimeout,
      connectionTimeoutMillis: settings.connectionTimeout
    };
    let connection;
    logger.trace(`Testing if PostgreSQL connection settings are correct`);
    try {
      connection = new pg.Client(config);
      await connection.connect();
    } catch (error: any) {
      logger.error(`Unable to connect to database: ${error.message}`);
      if (connection) {
        await connection.end();
      }

      if (/(timeout expired)|(^(connect ECONNREFUSED).*)/.test(error.message)) {
        throw new Error('Please check host and port');
      }

      switch (error.message) {
        case `password authentication failed for user "${settings.username}"`:
          throw new Error('Please check username and password');

        case `database "${settings.database}" does not exist`:
          throw new Error(`Database '${settings.database}' does not exist`);

        default:
          throw new Error('Please check logs');
      }
    }

    logger.trace(`Testing system table query`);

    let tables;
    try {
      const { rows } = await connection.query(`
          SELECT TABLES.table_name,
                (
                  SELECT string_agg(column_name || '(' || data_type || ')', ', ' ORDER BY table_name)
                  FROM information_schema.columns
                  WHERE table_name = TABLES.table_name
                ) columns
          FROM information_schema.tables TABLES
          WHERE table_type = 'BASE TABLE'
          AND table_schema = current_schema()
      `);
      tables = rows;
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
   * Apply the SQL query to the target PostgreSQL database
   */
  async queryData(item: SouthConnectorItemDTO<SouthPostgreSQLItemSettings>, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, '$1').replace(/@EndTime/g, '$2');

    const config: ClientConfig = {
      host: this.configuration.settings.host,
      port: this.configuration.settings.port,
      user: this.configuration.settings.username,
      password: this.configuration.settings.password ? await this.encryptionService.decryptText(this.configuration.settings.password) : '',
      database: this.configuration.settings.database,
      query_timeout: this.configuration.settings.requestTimeout,
      connectionTimeoutMillis: this.configuration.settings.connectionTimeout
    };

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
