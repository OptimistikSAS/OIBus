import path from 'node:path';
import { access, constants } from 'node:fs/promises';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { convertDateTimeToInstant, createFolder, formatInstant, logQuery, persistResults } from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory, TestsConnection } from '../south-interface';
import { SouthODBCItemSettings, SouthODBCSettings } from '../../../../shared/model/south-settings.model';
// @ts-ignore
import type odbcNS from 'odbc';

let odbc: typeof odbcNS | null = null;
// @ts-ignore
import('odbc')
  .then(obj => {
    odbc = obj.default;
    console.info('odbc library loaded');
  })
  .catch(() => {
    console.error('Could not load odbc');
  });

/**
 * Class SouthODBC - Retrieve data from SQL databases with ODBC driver and send them to the cache as CSV files.
 */
export default class SouthODBC extends SouthConnector<SouthODBCSettings, SouthODBCItemSettings> implements QueriesHistory, TestsConnection {
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthODBCSettings>,
    items: Array<SouthConnectorItemDTO<SouthODBCItemSettings>>,
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
      connector,
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

  static async testConnection(settings: SouthODBCSettings, logger: pino.Logger, encryptionService: EncryptionService): Promise<void> {
    if (!odbc) {
      throw new Error('odbc library not loaded');
    }

    let connection;
    logger.trace(`Testing if ODBC connection settings are correct`);

    if (/SQLite/i.test(settings.driverPath)) {
      const dbPath = path.resolve(settings.database);

      try {
        await access(dbPath, constants.F_OK);
      } catch (error: any) {
        logger.error(`Access error on '${dbPath}': ${error.message}`);
        throw new Error(`File '${dbPath}' does not exist`);
      }
    }

    try {
      const connectionConfig = await SouthODBC.createConnectionConfig(settings, logger, encryptionService);
      connection = await odbc.connect(connectionConfig);
    } catch (error: any) {
      logger.error(`Unable to connect to database: ${error.message}`);

      if (connection) {
        await connection.close();
      }

      const { odbcErrors } = error as odbcNS.NodeOdbcError;
      SouthODBC.logOdbcErrors(logger, odbcErrors);

      if (odbcErrors[0].state === 'IM002') {
        throw new Error(`Driver '${settings.driverPath}' not found`);
      }

      const { errorCode, ERROR_CODES } = SouthODBC.parseErrorCodes(settings.driverPath, odbcErrors[0]);

      switch (errorCode) {
        case ERROR_CODES.HOST:
        case ERROR_CODES.PORT:
          throw new Error('Please check host and port');

        case ERROR_CODES.CREDENTIALS:
          throw new Error('Please check username and password');

        case ERROR_CODES.DB_ACCESS:
          throw new Error(`User '${settings.username}' does not have access to database '${settings.database}'`);

        default:
          throw new Error('Please check logs');
      }
    }

    logger.trace(`Testing system table query`);

    const tables: { table_name: string; columns: string }[] = [];

    try {
      // @ts-ignore
      const tableMetadata = await connection.tables<any>(settings.database, null, null, 'TABLE');
      for (const table of tableMetadata) {
        // @ts-ignore
        const columnMetadata = await connection.columns<any>(settings.database, null, table.TABLE_NAME, null);
        // @ts-ignore
        const columns = columnMetadata.map(column => `${column.COLUMN_NAME}(${column.TYPE_NAME})`).join(', ');
        tables.push({
          table_name: table.TABLE_NAME,
          columns
        });
      }
    } catch (error: any) {
      if (connection) {
        await connection.close();
      }

      SouthODBC.logOdbcErrors(logger, error.odbcErrors);

      logger.error(`Unable to read tables in database '${settings.database}': ${error.message}`);
      throw new Error(`Unable to read tables in database '${settings.database}', check logs`);
    }

    if (connection) {
      await connection.close();
    }

    if (tables.length === 0) {
      logger.warn(`Database '${settings.database}' has no tables`);
      throw new Error('Database has no tables');
    }

    const tablesString = tables.map(row => `${row.table_name}: [${row.columns}]`).join(',\n');

    logger.info('Database is live with tables (table:[columns]):\n%s', tablesString);
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(items: Array<SouthConnectorItemDTO<SouthODBCItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
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
   * Apply the SQL query to the target ODBC database
   */
  async queryData(item: SouthConnectorItemDTO<SouthODBCItemSettings>, startTime: Instant, endTime: Instant) {
    if (!odbc) {
      throw new Error('odbc library not loaded');
    }

    let connectionString = `Driver=${this.connector.settings.driverPath};SERVER=${this.connector.settings.host};PORT=${this.connector.settings.port};`;
    if (this.connector.settings.trustServerCertificate) {
      connectionString += `TrustServerCertificate=yes;`;
    }
    if (this.connector.settings.database) {
      connectionString += `Database=${this.connector.settings.database};`;
    }
    if (this.connector.settings.username) {
      connectionString += `UID=${this.connector.settings.username};`;
    }

    if (this.connector.settings.username && this.connector.settings.password) {
      this.logger.debug(`Connecting with connection string ${connectionString}PWD=<secret>;`);
      connectionString += `PWD=${await this.encryptionService.decryptText(this.connector.settings.password)};`;
    } else {
      this.logger.debug(`Connecting with connection string ${connectionString}`);
    }

    let connection;
    try {
      const connectionConfig = await SouthODBC.createConnectionConfig(this.connector.settings, this.logger, this.encryptionService);
      connection = await odbc.connect(connectionConfig);

      const referenceTimestampField = item.settings.dateTimeFields.find(dateTimeField => dateTimeField.useAsReference) || null;
      const odbcStartTime = referenceTimestampField == null ? startTime : formatInstant(startTime, referenceTimestampField);
      const odbcEndTime = referenceTimestampField == null ? endTime : formatInstant(endTime, referenceTimestampField);
      const adaptedQuery = item.settings.query.replace(/@StartTime/g, `${odbcStartTime}`).replace(/@EndTime/g, `${odbcEndTime}`);
      logQuery(adaptedQuery, odbcStartTime, odbcEndTime, this.logger);
      const data = await connection.query(adaptedQuery);
      await connection.close();
      return data;
    } catch (error: any) {
      if (error.odbcErrors?.length > 0) {
        SouthODBC.logOdbcErrors(this.logger, error.odbcErrors);
      }
      if (connection) {
        await connection.close();
      }
      throw error;
    }
  }

  static async createConnectionConfig(
    settings: SouthConnectorDTO['settings'],
    logger: pino.Logger,
    encryptionService: EncryptionService
  ): Promise<odbcNS.ConnectionParameters> {
    let connectionString = `Driver=${settings.driverPath};SERVER=${settings.host};PORT=${settings.port};`;
    if (settings.trustServerCertificate) {
      connectionString += `TrustServerCertificate=yes;`;
    }
    if (settings.database) {
      connectionString += `Database=${settings.database};`;
    }
    if (settings.username) {
      connectionString += `UID=${settings.username};`;
    }

    if (settings.username && settings.password) {
      logger.debug(`Connecting with connection string ${connectionString}PWD=<secret>;`);
      connectionString += `PWD=${await encryptionService.decryptText(settings.password)};`;
    } else {
      logger.debug(`Connecting with connection string ${connectionString}`);
    }

    const connectionConfig: odbcNS.ConnectionParameters = {
      connectionString,
      connectionTimeout: settings.connectionTimeout
    };

    return connectionConfig;
  }

  /**
   * Parse odbc error codes for known drivers
   */
  static parseErrorCodes(driverPath: string, odbcError: odbcNS.OdbcError) {
    let errorCode: number;
    let ERROR_CODES: {
      HOST: number;
      PORT: number;
      CREDENTIALS: number;
      DB_ACCESS: number;
    };

    // MSSQL
    if (/SQL Server/i.test(driverPath)) {
      errorCode = odbcError.code;
      ERROR_CODES = {
        HOST: 17,
        PORT: 17,
        CREDENTIALS: 18456,
        DB_ACCESS: 4060
      };
    }
    // PostgreSQL
    else if (/PostgreSQL|psqlODBC/i.test(driverPath)) {
      const message = odbcError.message;
      if (/Unknown host|server closed the connection unexpectedly/i.test(message)) errorCode = 1;
      else if (/Connection refused/i.test(message)) errorCode = 2;
      else if (/password|user/i.test(message)) errorCode = 3;
      else if (/database/i.test(message)) errorCode = 4;
      else errorCode = -1;

      ERROR_CODES = {
        HOST: 1,
        PORT: 2,
        CREDENTIALS: 3,
        DB_ACCESS: 4
      };
    }
    // Oracle
    else if (/Oracle/i.test(driverPath)) {
      errorCode = odbcError.code;
      // Note: Could not determine host, port and db_access errors codes
      ERROR_CODES = {
        HOST: -1,
        PORT: -1,
        CREDENTIALS: 1017,
        DB_ACCESS: -1
      };
    }
    // MySQL
    else if (/MySQL/i.test(driverPath)) {
      errorCode = odbcError.code;
      ERROR_CODES = {
        HOST: 2005,
        PORT: 2003,
        CREDENTIALS: 1045,
        DB_ACCESS: 1044
      };
    }
    // Other
    else {
      throw new Error('Please check logs');
    }

    return { errorCode, ERROR_CODES };
  }

  /**
   * Logs the odbcErrors array
   */
  static logOdbcErrors(logger: pino.Logger, odbcErrors: odbcNS.OdbcError[]) {
    odbcErrors.forEach(odbcError => {
      logger.error(`Error from ODBC driver: ${odbcError.message}`);
    });
  }
}
