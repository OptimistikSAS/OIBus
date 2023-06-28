import path from 'node:path';
import mssql, { config } from 'mssql';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { formatInstant, convertDateTimeToInstant, createFolder, logQuery, persistResults } from '../../service/utils';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { DateTimeFormat, DateTimeField, Instant, Serialization } from '../../../../shared/model/types';
import { QueriesHistory, TestsConnection } from '../south-interface';
import { DateTime } from 'luxon';

/**
 * Class SouthMSSQL - Retrieve data from MSSQL databases and send them to the cache as CSV files.
 */
export default class SouthMSSQL extends SouthConnector implements QueriesHistory, TestsConnection {
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

  static async testConnection(
    settings: SouthConnectorDTO['settings'],
    logger: pino.Logger,
    encryptionService: EncryptionService
  ): Promise<void> {
    const config: config = {
      user: settings.username,
      password: settings.password ? await encryptionService.decryptText(settings.password) : '',
      server: settings.host,
      port: settings.port,
      database: settings.database,
      connectionTimeout: settings.connectionTimeout,
      requestTimeout: settings.requestTimeout,
      options: {
        encrypt: settings.encryption,
        trustServerCertificate: settings.trustServerCertificate
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
            SELECT TABLES.TABLE_NAME AS table_name,
                  (
                    SELECT STRING_AGG(CONCAT(COLUMN_NAME, '(', DATA_TYPE, ')'), ', ')
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = TABLES.TABLE_NAME
                    GROUP BY TABLE_NAME
                  ) AS columns
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
  async historyQuery(items: Array<OibusItemDTO>, startTime: Instant, endTime: Instant): Promise<Instant> {
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
            const datetimeField: DateTimeField = item.settings.dateTimeFields.find((element: DateTimeField) => element.field === key);
            if (!datetimeField) {
              formattedEntry[key] = value;
            } else {
              const entryDate = convertDateTimeToInstant(value, datetimeField.datetimeFormat);
              if (datetimeField.useAsReference) {
                if (entryDate > updatedStartTime) {
                  updatedStartTime = entryDate;
                }
              }
              formattedEntry[key] = formatInstant(entryDate, item.settings.serialization.dateTimeOutputFormat);
            }
          });
          return formattedEntry;
        });
        await persistResults(
          formattedResult,
          item.settings.serialization as Serialization,
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
    return updatedStartTime;
  }

  /**
   * Apply the SQL query to the target MSSQL database
   */
  async queryData(item: OibusItemDTO, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const config: config = {
      user: this.configuration.settings.username,
      password: this.configuration.settings.password ? await this.encryptionService.decryptText(this.configuration.settings.password) : '',
      server: this.configuration.settings.host,
      port: this.configuration.settings.port,
      database: this.configuration.settings.database,
      connectionTimeout: this.configuration.settings.connectionTimeout,
      requestTimeout: this.configuration.settings.requestTimeout,
      options: {
        encrypt: this.configuration.settings.encryption,
        trustServerCertificate: this.configuration.settings.trustServerCertificate
      }
    };
    // domain is optional and allow to activate the ntlm authentication on Windows
    if (this.configuration.settings.domain) {
      config.domain = this.configuration.settings.domain;
    }

    const referenceTimestampField: DateTimeField = item.settings.dateTimeFields.find(
      (dateTimeField: DateTimeField) => dateTimeField.useAsReference
    );
    const mssqlStartTime = this.formatDatetimeVariables(startTime, referenceTimestampField.datetimeFormat);
    const mssqlEndTime = this.formatDatetimeVariables(endTime, referenceTimestampField.datetimeFormat);
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

  formatDatetimeVariables = (datetime: Instant, dateTimeFormat: DateTimeFormat | null): string | number => {
    if (!dateTimeFormat) {
      return datetime;
    }

    switch (dateTimeFormat.type) {
      case 'unix-epoch':
      case 'unix-epoch-ms':
      case 'specific-string':
      case 'iso-8601-string':
        return formatInstant(datetime, dateTimeFormat);
      case 'date-object':
        switch (dateTimeFormat.dateObjectType) {
          case 'Date':
            return DateTime.fromISO(datetime, { zone: dateTimeFormat.timezone }).toFormat('yyyy-MM-dd');
          case 'DateTime2':
            return DateTime.fromISO(datetime, { zone: dateTimeFormat.timezone }).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
          case 'DateTimeOffset':
            return DateTime.fromISO(datetime, { zone: dateTimeFormat.timezone }).toFormat('yyyy-MM-dd HH:mm:ss.SSS ZZ');
          case 'SmallDateTime':
            return DateTime.fromISO(datetime, { zone: dateTimeFormat.timezone }).toFormat('yyyy-MM-dd HH:mm:ss');
          case 'DateTime':
          default:
            return DateTime.fromISO(datetime, { zone: dateTimeFormat.timezone }).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
        }
    }
  };
}
