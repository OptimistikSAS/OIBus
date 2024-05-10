import path from 'node:path';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { convertDateTimeToInstant, convertDelimiter, createFolder, formatInstant, logQuery, persistResults } from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthODBCItemSettings, SouthODBCSettings } from '../../../../shared/model/south-settings.model';
import fetch, { HeadersInit, RequestInit } from 'node-fetch';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';

let odbc: any | null = null;
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
export default class SouthODBC extends SouthConnector<SouthODBCSettings, SouthODBCItemSettings> implements QueriesHistory {
  static type = manifest.id;

  private readonly tmpFolder: string;
  private connected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorDTO<SouthODBCSettings>,
    engineAddValuesCallback: (southId: string, values: Array<OIBusTimeValue>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, engineAddValuesCallback, engineAddFileCallback, encryptionService, repositoryService, logger, baseFolder);
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(dataStream = true): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start(dataStream);
  }

  override async connect(): Promise<void> {
    if (this.connector.settings.remoteAgent) {
      try {
        this.connected = false;
        const headers: Record<string, string> = {};
        headers['Content-Type'] = 'application/json';
        const fetchOptions = {
          method: 'PUT',
          body: JSON.stringify({
            connectionString: this.connector.settings.connectionString,
            connectionTimeout: this.connector.settings.connectionTimeout
          }),
          headers
        };
        await fetch(`${this.connector.settings.agentUrl}/api/odbc/${this.connector.id}/connect`, fetchOptions);
        this.connected = true;
        await super.connect();
      } catch (error) {
        this.logger.error(
          `Error while sending connection HTTP request into agent. Reconnecting in ${this.connector.settings.retryInterval} ms. ${error}`
        );
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    } else {
      await super.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = null;

    if (this.connector.settings.remoteAgent && this.connected) {
      try {
        const fetchOptions = { method: 'DELETE' };
        await fetch(`${this.connector.settings.agentUrl}/api/odbc/${this.connector.id}/disconnect`, fetchOptions);
      } catch (error) {
        this.logger.error(`Error while sending disconnection HTTP request into agent. ${error}`);
      }
    }
    this.connected = false;
    await super.disconnect();
  }

  override async testConnection(): Promise<void> {
    if (this.connector.settings.remoteAgent) {
      await this.testAgentConnection();
    } else {
      await this.testOdbcConnection();
    }
  }

  async testOdbcConnection(): Promise<void> {
    if (!odbc) {
      throw new Error('odbc library not loaded');
    }
    let connection;
    try {
      const connectionConfig = await this.createConnectionConfig(this.connector.settings);
      connection = await odbc.connect(connectionConfig);
    } catch (error: any) {
      const { odbcErrors } = error;

      if (odbcErrors[0].state === 'IM002') {
        throw new Error(`Driver not found. Check connection string and driver`);
      }

      const { errorCode, ERROR_CODES } = this.parseErrorCodes(this.connector.settings.connectionString, odbcErrors[0]);

      switch (errorCode) {
        case ERROR_CODES.HOST:
        case ERROR_CODES.PORT:
          throw new Error(`Please check host and port`);

        case ERROR_CODES.CREDENTIALS:
          throw new Error(`Please check username and password`);

        case ERROR_CODES.DB_ACCESS:
          throw new Error(`User does not have access to database`);

        default:
          throw new Error(`Unable to connect to database`);
      }
    }
    const tables: { table_name: string; columns: string }[] = [];

    try {
      // @ts-ignore
      const tableMetadata = await connection.tables<any>(this.connector.settings.database, null, null, 'TABLE');
      for (const table of tableMetadata) {
        // @ts-ignore
        const columnMetadata = await connection.columns<any>(this.connector.settings.database, null, table.TABLE_NAME, null);
        // @ts-ignore
        const columns = columnMetadata.map(column => `${column.COLUMN_NAME}(${column.TYPE_NAME})`).join(', ');
        tables.push({
          table_name: table.TABLE_NAME,
          columns
        });
      }
    } catch (error: any) {
      await connection.close();
      throw new Error(`Unable to read tables in database`);
    }

    await connection.close();

    if (tables.length === 0) {
      throw new Error('Database has no table');
    }
  }

  async testAgentConnection(): Promise<void> {
    const headers: Record<string, string> = {};
    headers['Content-Type'] = 'application/json';
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: this.connector.settings.connectionString,
        connectionTimeout: this.connector.settings.connectionTimeout
      }),
      headers
    };
    const response = await fetch(`${this.connector.settings.agentUrl!}/api/odbc/${this.connector.id}/connect`, fetchOptions);
    if (response.status === 200) {
      await fetch(`${this.connector.settings.agentUrl}/api/odbc/${this.connector.id}/disconnect`, { method: 'DELETE' });
    } else if (response.status === 400) {
      const errorMessage = await response.text();
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.status}: ${errorMessage}`);
    } else {
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.status}`);
    }
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(items: Array<SouthConnectorItemDTO<SouthODBCItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
    let updatedStartTime = startTime;

    for (const item of items) {
      if (this.connector.settings.remoteAgent) {
        updatedStartTime = await this.queryRemoteAgentData(item, updatedStartTime, endTime);
      } else {
        updatedStartTime = await this.queryOdbcData(item, updatedStartTime, endTime);
      }
    }
    return updatedStartTime;
  }

  async queryRemoteAgentData(item: SouthConnectorItemDTO<SouthODBCItemSettings>, startTime: Instant, endTime: Instant): Promise<Instant> {
    let updatedStartTime = startTime;
    const startRequest = DateTime.now().toMillis();

    const headers: HeadersInit = {};
    headers['Content-Type'] = 'application/json';

    const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference);
    const odbcStartTime = referenceTimestampField ? formatInstant(startTime, referenceTimestampField) : startTime;
    const odbcEndTime = referenceTimestampField ? formatInstant(endTime, referenceTimestampField) : endTime;
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, `${odbcStartTime}`).replace(/@EndTime/g, `${odbcEndTime}`);
    logQuery(adaptedQuery, odbcStartTime, odbcEndTime, this.logger);

    const fetchOptions: RequestInit = {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: this.connector.settings.connectionString,
        sql: adaptedQuery,
        readTimeout: this.connector.settings.requestTimeout,
        timeColumn: referenceTimestampField?.fieldName,
        datasourceTimestampFormat: referenceTimestampField?.format,
        datasourceTimezone: referenceTimestampField?.timezone,
        delimiter: convertDelimiter(item.settings.serialization.delimiter),
        outputTimestampFormat: item.settings.serialization.outputTimestampFormat,
        outputTimezone: item.settings.serialization.outputTimezone
      }),
      headers
    };
    const response = await fetch(`${this.connector.settings.agentUrl}/api/odbc/${this.connector.id}/read`, fetchOptions);
    if (response.status === 200) {
      const result: { recordCount: number; content: Array<any>; maxInstantRetrieved: Instant } = (await response.json()) as {
        recordCount: number;
        content: OIBusTimeValue[];
        maxInstantRetrieved: string;
      };
      const requestDuration = DateTime.now().toMillis() - startRequest;
      this.logger.info(`Found ${result.recordCount} results for item ${item.name} in ${requestDuration} ms`);

      if (result.content.length > 0) {
        await persistResults(
          result.content,
          { type: 'file', filename: item.settings.serialization.filename, compression: item.settings.serialization.compression },
          this.connector.name,
          item.name,
          this.tmpFolder,
          this.addFile.bind(this),
          this.addValues.bind(this),
          this.logger
        );
        if (result.maxInstantRetrieved > updatedStartTime) {
          updatedStartTime = result.maxInstantRetrieved;
        }
      } else {
        this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
      }
    } else if (response.status === 400) {
      const errorMessage = await response.text();
      this.logger.error(`Error occurred when querying remote agent with status ${response.status}: ${errorMessage}`);
    } else {
      this.logger.error(`Error occurred when querying remote agent with status ${response.status}`);
    }

    return updatedStartTime;
  }

  async queryOdbcData(item: SouthConnectorItemDTO<SouthODBCItemSettings>, startTime: Instant, endTime: Instant): Promise<Instant> {
    if (!odbc) {
      throw new Error('odbc library not loaded');
    }

    let updatedStartTime = startTime;
    const startRequest = DateTime.now().toMillis();
    let result: Array<any> = [];
    let connection;
    try {
      const connectionConfig = await this.createConnectionConfig(this.connector.settings);
      connection = await odbc.connect(connectionConfig);

      const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference);
      const odbcStartTime = referenceTimestampField ? formatInstant(startTime, referenceTimestampField) : startTime;
      const odbcEndTime = referenceTimestampField ? formatInstant(endTime, referenceTimestampField) : endTime;
      const adaptedQuery = item.settings.query.replace(/@StartTime/g, `${odbcStartTime}`).replace(/@EndTime/g, `${odbcEndTime}`);
      logQuery(adaptedQuery, odbcStartTime, odbcEndTime, this.logger);
      result = await connection.query(adaptedQuery);
      await connection.close();
    } catch (error: any) {
      if (error.odbcErrors?.length > 0) {
        this.logOdbcErrors(error.odbcErrors);
      }
      if (connection) {
        await connection.close();
      }
      throw error;
    }
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
        item.name,
        this.tmpFolder,
        this.addFile.bind(this),
        this.addValues.bind(this),
        this.logger
      );
    } else {
      this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
    }
    return updatedStartTime;
  }

  async createConnectionConfig(settings: SouthODBCSettings): Promise<{
    connectionString: string;
    connectionTimeout?: number;
  }> {
    let connectionString = settings.connectionString;

    if (settings.password) {
      this.logger.debug(`Connecting with connection string ${connectionString}PWD=<secret>;`);
      if (!connectionString.endsWith(';')) {
        connectionString += ';';
      }
      connectionString += `PWD=${await this.encryptionService.decryptText(settings.password)};`;
    } else {
      this.logger.debug(`Connecting with connection string ${connectionString}`);
    }

    return {
      connectionString,
      connectionTimeout: settings.connectionTimeout
    };
  }

  /**
   * Parse odbc error codes for known drivers
   */
  parseErrorCodes(
    connectionString: string,
    odbcError: {
      message: string;
      code: number;
      state: string;
    }
  ) {
    let errorCode: number;
    let ERROR_CODES: {
      HOST: number;
      PORT: number;
      CREDENTIALS: number;
      DB_ACCESS: number;
    };

    // MSSQL
    if (/SQL Server/i.test(connectionString)) {
      errorCode = odbcError.code;
      ERROR_CODES = {
        HOST: 17,
        PORT: 17,
        CREDENTIALS: 18456,
        DB_ACCESS: 4060
      };
    }
    // PostgreSQL
    else if (/PostgreSQL|psqlODBC/i.test(connectionString)) {
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
    else if (/Oracle/i.test(connectionString)) {
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
    else if (/MySQL/i.test(connectionString)) {
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
      throw new Error(`Unable to connect to database`);
    }

    return { errorCode, ERROR_CODES };
  }

  /**
   * Logs the odbcErrors array
   */
  logOdbcErrors(
    odbcErrors: Array<{
      message: string;
      code: number;
      state: string;
    }>
  ) {
    odbcErrors.forEach(odbcError => {
      this.logger.error(`Error from ODBC driver: ${odbcError.message}`);
    });
  }
}
