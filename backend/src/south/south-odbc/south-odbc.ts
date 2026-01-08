import SouthConnector from '../south-connector';
import {
  convertDateTimeToInstant,
  convertDelimiter,
  formatInstant,
  generateCsvContent,
  generateFilenameForSerialization,
  logQuery,
  persistResults
} from '../../service/utils';
import pino from 'pino';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthODBCItemSettings, SouthODBCSettings } from '../../../shared/model/south-settings.model';
import { OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { loadOdbc } from './odbc-loader';
import { HTTPRequest, ReqOptions } from '../../service/http-request.utils';
import { encryptionService } from '../../service/encryption.service';

/**
 * Class SouthODBC - Retrieve data from SQL databases with ODBC driver and send them to the cache as CSV files.
 */
export default class SouthODBC extends SouthConnector<SouthODBCSettings, SouthODBCItemSettings> implements QueriesHistory {
  private connected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent, queryTime: Instant, itemIds: Array<string>) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async connect(): Promise<void> {
    if (this.connector.settings.remoteAgent) {
      try {
        this.connected = false;
        const fetchOptions: ReqOptions = {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionString: this.connector.settings.connectionString,
            connectionTimeout: this.connector.settings.connectionTimeout
          })
        };
        const requestUrl = new URL(`/api/odbc/${this.connector.id}/connect`, this.connector.settings.agentUrl);
        await HTTPRequest(requestUrl, fetchOptions);
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
        const fetchOptions: ReqOptions = { method: 'DELETE' };
        const requestUrl = new URL(`/api/odbc/${this.connector.id}/disconnect`, this.connector.settings.agentUrl);
        await HTTPRequest(requestUrl, fetchOptions);
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

  override async testItem(
    item: SouthConnectorItemEntity<SouthODBCItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    let result: string;
    if (this.connector.settings.remoteAgent) {
      result = (await this.queryRemoteAgentData(item, startTime, endTime, true)) as string;
    } else {
      const tempResult = (await this.queryOdbcData(item, endTime, startTime, true)) as Array<Record<string, string>>;
      const formattedResults = tempResult.map(entry => {
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
      result = generateCsvContent(formattedResults, item.settings.serialization.delimiter);
    }

    let oibusContent: OIBusContent;
    switch (item.settings.serialization.type) {
      case 'csv': {
        const filePath = generateFilenameForSerialization(
          this.tmpFolder,
          item.settings.serialization.filename,
          this.connector.name,
          item.name
        );
        oibusContent = { type: 'any', filePath, content: result };
        break;
      }
    }
    return oibusContent;
  }

  async testOdbcConnection(): Promise<void> {
    const odbc = await loadOdbc();
    if (!odbc) {
      throw new Error('ODBC library not available');
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
    const fetchOptions = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionString: this.connector.settings.connectionString,
        connectionTimeout: this.connector.settings.connectionTimeout
      })
    };
    const requestUrl = new URL(`/api/odbc/${this.connector.id}/connect`, this.connector.settings.agentUrl);
    const response = await HTTPRequest(requestUrl, fetchOptions);
    if (response.statusCode === 200) {
      const requestUrl = new URL(`/api/odbc/${this.connector.id}/disconnect`, this.connector.settings.agentUrl);
      await HTTPRequest(requestUrl, { method: 'DELETE' });
    } else if (response.statusCode === 400) {
      const errorMessage = await response.body.text();
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.statusCode}: ${errorMessage}`);
    } else {
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.statusCode}`);
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
  ): Promise<Instant | null> {
    let updatedStartTime: Instant | null = null;

    for (const item of items) {
      if (this.connector.settings.remoteAgent) {
        updatedStartTime = (await this.queryRemoteAgentData(item, startTime, endTime)) as string;
      } else {
        updatedStartTime = (await this.queryOdbcData(item, startTime, endTime)) as string;
      }
    }
    return updatedStartTime;
  }

  getThrottlingSettings(settings: SouthODBCSettings): SouthThrottlingSettings {
    return {
      maxReadInterval: settings.throttling.maxReadInterval,
      readDelay: settings.throttling.readDelay
    };
  }

  getMaxInstantPerItem(_settings: SouthODBCSettings): boolean {
    return true;
  }

  getOverlap(settings: SouthODBCSettings): number {
    return settings.throttling.overlap;
  }

  async queryRemoteAgentData(
    item: SouthConnectorItemEntity<SouthODBCItemSettings>,
    startTime: Instant,
    endTime: Instant,
    test?: boolean
  ): Promise<Instant | string | null> {
    let updatedStartTime: Instant | null = null;
    const startRequest = DateTime.now();

    const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference);
    const odbcStartTime = referenceTimestampField ? formatInstant(startTime, referenceTimestampField) : startTime;
    const odbcEndTime = referenceTimestampField ? formatInstant(endTime, referenceTimestampField) : endTime;
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, `${odbcStartTime}`).replace(/@EndTime/g, `${odbcEndTime}`);
    logQuery(adaptedQuery, odbcStartTime, odbcEndTime, this.logger);

    const fetchOptions: ReqOptions = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
      })
    };
    const requestUrl = new URL(`/api/odbc/${this.connector.id}/read`, this.connector.settings.agentUrl);
    const response = await HTTPRequest(requestUrl, fetchOptions);
    if (response.statusCode === 200) {
      const result: { recordCount: number; content: string; maxInstant: Instant } = (await response.body.json()) as {
        recordCount: number;
        content: string;
        maxInstant: Instant;
      };
      const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
      this.logger.info(`Found ${result.recordCount} results for item ${item.name} in ${requestDuration} ms`);

      if (test) {
        return result.content;
      } else {
        if (result.recordCount > 0) {
          await persistResults(
            result.content,
            { type: 'file', filename: item.settings.serialization.filename, compression: item.settings.serialization.compression },
            this.connector.name,
            item.name,
            item.id,
            startRequest.toUTC().toISO(),
            this.tmpFolder,
            this.addContent.bind(this),
            this.logger
          );
          if (result.maxInstant > startTime) {
            updatedStartTime = result.maxInstant;
          }
        } else {
          this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
        }
      }
    } else if (response.statusCode === 400) {
      const errorMessage = await response.body.text();
      this.logger.error(`Error occurred when querying remote agent with status ${response.statusCode}: ${errorMessage}`);
      throw new Error(`Error occurred when querying remote agent with status ${response.statusCode}: ${errorMessage}`);
    } else {
      this.logger.error(`Error occurred when querying remote agent with status ${response.statusCode}`);
      throw new Error(`Error occurred when querying remote agent with status ${response.statusCode}`);
    }

    return updatedStartTime;
  }

  async queryOdbcData(
    item: SouthConnectorItemEntity<SouthODBCItemSettings>,
    startTime: Instant,
    endTime: Instant,
    test?: boolean
  ): Promise<Instant | Array<Record<string, string | number>> | null> {
    const odbc = await loadOdbc();
    if (!odbc) {
      throw new Error('ODBC library not available');
    }

    let updatedStartTime: Instant | null = null;
    const startRequest = DateTime.now();
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
      throw new Error((error as Error).message);
    }
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

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
              if (!updatedStartTime || entryDate > updatedStartTime) {
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
          item.id,
          startRequest.toUTC().toISO(),
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
      connectionString += `PWD=${await encryptionService.decryptText(settings.password)};`;
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
