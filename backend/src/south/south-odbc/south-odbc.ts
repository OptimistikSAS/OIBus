import SouthConnector from '../south-connector';
import {
  convertDateTimeToInstant,
  formatInstant,
  generateCsvContent,
  generateFilenameForSerialization,
  getErrorMessage,
  logQuery,
  persistResults,
  workUnitLogCtx
} from '../../service/utils';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { SouthHistoryQuery } from '../south-interface';
import { SouthItemSettings, SouthODBCItemSettings, SouthODBCSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { loadOdbc } from './odbc-loader';
import { encryptionService } from '../../service/encryption.service';

/**
 * Class SouthODBC - Retrieve data from SQL databases with ODBC driver and send them to the cache as CSV files.
 */
export default class SouthODBC extends SouthConnector<SouthODBCSettings, SouthODBCItemSettings> implements SouthHistoryQuery {
  constructor(
    connector: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings>,
    engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, cacheFolderPath);
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    await this.testOdbcConnection();
    return { items: [] };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthODBCItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    const queryStart = DateTime.now().toMillis();
    const tempResult = await this.queryOdbcData(item, endTime, startTime, true);
    const formattedResults = (tempResult.value as Array<Record<string, string>>).map(entry => {
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
    const result: { trackedInstant: Instant | null; value: unknown | null } = {
      trackedInstant: tempResult.trackedInstant,
      value: generateCsvContent(formattedResults, item.settings.serialization.delimiter)
    };
    const queryDuration = DateTime.now().toMillis() - queryStart;

    let oibusContent: OIBusContent;
    switch (item.settings.serialization.type) {
      case 'csv': {
        const filePath = generateFilenameForSerialization(
          this.tmpFolder,
          item.settings.serialization.filename,
          this.connector.name,
          item.name
        );
        oibusContent = { type: 'any', filePath, content: result.value as string };
        break;
      }
    }
    return {
      result: oibusContent,
      // Connect + query happen together inside the query call above — splitting them would mean
      // refactoring a method the scheduled query path also uses, so connectionDuration stays 0 and
      // queryDuration covers the whole call.
      connectionDuration: 0,
      queryDuration
    };
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

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthODBCItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    return await this.queryOdbcData(items[0], startTime, endTime);
  }

  async queryOdbcData(
    item: SouthConnectorItemEntity<SouthODBCItemSettings>,
    startTime: Instant,
    endTime: Instant,
    test?: boolean
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    const odbc = await loadOdbc();
    if (!odbc) {
      throw new Error('ODBC library not available');
    }

    const logCtx = workUnitLogCtx([item]);
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
      logQuery(adaptedQuery, odbcStartTime, odbcEndTime, this.logger, logCtx);
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
          ).odbcErrors,
          logCtx
        );
      }
      if (connection) {
        await connection.close();
      }
      throw new Error(getErrorMessage(error));
    }
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

    if (result.length > 0) {
      this.logger.info(logCtx, `Found ${result.length} results in ${requestDuration} ms`);

      const formattedResult = result.map(entry => {
        const formattedEntry: Record<string, string | number> = {};
        Object.entries(entry).forEach(([key, value]) => {
          const datetimeField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.fieldName === key);
          if (!datetimeField) {
            formattedEntry[key] = value;
          } else {
            const entryDate = convertDateTimeToInstant(value, datetimeField);
            if (datetimeField.useAsReference && entryDate) {
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
      if (!test) {
        await persistResults(
          formattedResult,
          item.settings.serialization,
          this.connector.name,
          item,
          startRequest.toUTC().toISO(),
          this.tmpFolder,
          this.addContent.bind(this),
          this.logger
        );
      }
    } else {
      this.logger.debug(logCtx, `No result found. Request done in ${requestDuration} ms`);
    }
    return { trackedInstant: updatedStartTime, value: result.length > 0 ? result[result.length - 1] : null };
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
    }>,
    logCtx: Record<string, string> = {}
  ) {
    odbcErrors.forEach(odbcError => {
      this.logger.error(logCtx, `Error from ODBC driver: ${odbcError.message}`);
    });
  }
}
