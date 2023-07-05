import path from 'node:path';
import mssql, { config } from 'mssql';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { formatInstant, convertDateTimeToInstant, createFolder, logQuery, persistResults } from '../../service/utils';
import { SouthConnectorItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { QueriesHistory, TestsConnection } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthMSSQLItemSettings, SouthMSSQLSettings } from '../../../../shared/model/south-settings.model';

/**
 * Class SouthMSSQL - Retrieve data from MSSQL databases and send them to the cache as CSV files.
 */
export default class SouthMSSQL
  extends SouthConnector<SouthMSSQLSettings, SouthMSSQLItemSettings>
  implements QueriesHistory, TestsConnection
{
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    configuration: SouthConnectorDTO<SouthMSSQLSettings>,
    items: Array<SouthConnectorItemDTO<SouthMSSQLItemSettings>>,
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

  static async testConnection(settings: SouthMSSQLSettings, logger: pino.Logger, encryptionService: EncryptionService): Promise<void> {
    const config: config = {
      user: settings.username || undefined,
      password: settings.password ? await encryptionService.decryptText(settings.password) : undefined,
      server: settings.host,
      port: settings.port,
      database: settings.database,
      connectionTimeout: settings.connectionTimeout,
      requestTimeout: settings.requestTimeout,
      options: {
        encrypt: settings.encryption == null ? undefined : settings.encryption,
        trustServerCertificate: settings.trustServerCertificate,
        useUTC: true
      }
    };
    if (settings.domain) {
      config.domain = settings.domain;
    }

    let pool;
    let request;

    logger.trace(`Testing if MSSQL connection settings are correct`);

    try {
      pool = await new mssql.ConnectionPool(config).connect();
      request = pool.request();
    } catch (error: any) {
      logger.error(`Unable to connect to database: ${error.message}`);
      if (pool) {
        await pool.close();
      }

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

    logger.trace(`Testing system table query`);

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

      logger.error(`Unable to read tables in database '${settings.database}': ${error.message}`);
      throw new Error(`Unable to read tables in database '${settings.database}', check logs`);
    }

    await pool.close();

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
    return updatedStartTime;
  }

  /**
   * Apply the SQL query to the target MSSQL database
   */
  async queryData(item: SouthConnectorItemDTO<SouthMSSQLItemSettings>, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const config: config = {
      user: this.connector.settings.username || undefined,
      password: this.connector.settings.password ? await this.encryptionService.decryptText(this.connector.settings.password) : undefined,
      server: this.connector.settings.host,
      port: this.connector.settings.port,
      database: this.connector.settings.database,
      connectionTimeout: this.connector.settings.connectionTimeout,
      requestTimeout: this.connector.settings.requestTimeout,
      options: {
        encrypt: this.connector.settings.encryption == null ? undefined : this.connector.settings.encryption,
        trustServerCertificate: this.connector.settings.trustServerCertificate,
        useUTC: true
      }
    };
    // domain is optional and allow to activate the ntlm authentication on Windows
    if (this.connector.settings.domain) {
      config.domain = this.connector.settings.domain;
    }

    const referenceTimestampField = item.settings.dateTimeFields.find(dateTimeField => dateTimeField.useAsReference) || null;
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
