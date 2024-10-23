import path from 'node:path';

import SouthConnector from '../south-connector';
import {
  convertDateTimeToInstant,
  convertDelimiter,
  createFolder,
  formatInstant,
  generateCsvContent,
  generateFilenameForSerialization,
  logQuery,
  persistResults
} from '../../service/utils';
import EncryptionService from '../../service/encryption.service';
import pino from 'pino';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthODBCItemSettings, SouthODBCSettings } from '../../../shared/model/south-settings.model';
import fetch, { HeadersInit, RequestInit } from 'node-fetch';
import { OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let odbc: any | null = null;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
  private readonly tmpFolder: string;
  private connected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    southConnectorRepository: SouthConnectorRepository,
    southCacheRepository: SouthCacheRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(
      connector,
      engineAddContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      baseFolder
    );
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

  override async testItem(item: SouthConnectorItemEntity<SouthODBCItemSettings>, callback: (data: OIBusContent) => void): Promise<void> {
    const startTime = DateTime.now()
      .minus(600 * 1000)
      .toUTC()
      .toISO() as Instant;
    const endTime = DateTime.now().toUTC().toISO() as Instant;
    let result: Array<Record<string, string>>;
    if (this.connector.settings.remoteAgent) {
      result = (await this.queryRemoteAgentData(item, startTime, endTime, true)) as Array<Record<string, string>>;
    } else {
      result = (await this.queryOdbcData(item, endTime, startTime, true)) as Array<Record<string, string>>;
    }

    const formattedResults = result.map(entry => {
      const formattedEntry: Record<string, string | number> = {};
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

  async testOdbcConnection(): Promise<void> {
    if (!odbc) {
      throw new Error('odbc library not loaded');
    }
    let connection;
    try {
      const connectionConfig = await this.createConnectionConfig(this.connector.settings);
      connection = await odbc.connect(connectionConfig);
    } catch (error: unknown) {
      const { odbcErrors } = error as {
        odbcErrors: Array<{
          message: string;
          code: number;
          state: string;
        }>;
      };

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
    await connection.close();
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
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthODBCItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant> {
    let updatedStartTime: string = startTime;

    for (const item of items) {
      if (this.connector.settings.remoteAgent) {
        updatedStartTime = (await this.queryRemoteAgentData(item, updatedStartTime, endTime)) as string;
      } else {
        updatedStartTime = (await this.queryOdbcData(item, updatedStartTime, endTime)) as string;
      }
    }
    return updatedStartTime;
  }

  async queryRemoteAgentData(
    item: SouthConnectorItemEntity<SouthODBCItemSettings>,
    startTime: Instant,
    endTime: Instant,
    test?: boolean
  ): Promise<string | Array<Record<string, string>>> {
    // test is here in case we are testing items
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
      const result: { recordCount: number; content: Array<Record<string, string>>; maxInstantRetrieved: Instant } =
        (await response.json()) as {
          recordCount: number;
          content: Array<Record<string, string>>;
          maxInstantRetrieved: string;
        };
      const requestDuration = DateTime.now().toMillis() - startRequest;
      this.logger.info(`Found ${result.recordCount} results for item ${item.name} in ${requestDuration} ms`);

      if (test) {
        return result.content;
      } else {
        if (result.content.length > 0) {
          await persistResults(
            result.content,
            { type: 'file', filename: item.settings.serialization.filename, compression: item.settings.serialization.compression },
            this.connector.name,
            item.name,
            this.tmpFolder,
            this.addContent.bind(this),
            this.logger
          );
          if (result.maxInstantRetrieved > updatedStartTime) {
            updatedStartTime = result.maxInstantRetrieved;
          }
        } else {
          this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
        }
      }
    } else if (response.status === 400) {
      const errorMessage = await response.text();
      this.logger.error(`Error occurred when querying remote agent with status ${response.status}: ${errorMessage}`);
      throw new Error(`Error occurred when querying remote agent with status ${response.status}: ${errorMessage}`);
    } else {
      this.logger.error(`Error occurred when querying remote agent with status ${response.status}`);
      throw new Error(`Error occurred when querying remote agent with status ${response.status}`);
    }

    return updatedStartTime;
  }

  async queryOdbcData(
    item: SouthConnectorItemEntity<SouthODBCItemSettings>,
    startTime: Instant,
    endTime: Instant,
    test?: boolean
  ): Promise<string | Array<Record<string, string | number>>> {
    // test is here in case we are testing items
    if (!odbc) {
      throw new Error('odbc library not loaded');
    }

    let updatedStartTime = startTime;
    const startRequest = DateTime.now().toMillis();
    let result: Array<Record<string, string>> = [];
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
    } catch (error: unknown) {
      if (
        (
          error as {
            odbcErrors: Array<{
              message: string;
              code: number;
              state: string;
            }>;
          }
        ).odbcErrors?.length > 0
      ) {
        this.logOdbcErrors(
          (
            error as {
              odbcErrors: Array<{
                message: string;
                code: number;
                state: string;
              }>;
            }
          ).odbcErrors
        );
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
        const formattedEntry: Record<string, string | number> = {};
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
      if (test) {
        return formattedResult;
      } else {
        await persistResults(
          formattedResult,
          item.settings.serialization,
          this.connector.name,
          item.name,
          this.tmpFolder,
          this.addContent.bind(this),
          this.logger
        );
      }
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
