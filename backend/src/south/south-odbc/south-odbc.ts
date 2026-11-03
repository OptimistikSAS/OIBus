import { DateTime } from 'luxon';

import { OIBusContent, OIBusRecord } from '../../../shared/model/common/content.model';
import { Instant } from '../../../shared/model/common/types';
import { SouthItemSettings, SouthODBCItemSettings, SouthODBCSettings } from '../../../shared/model/connector/south-settings.model';
import { OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/domain/south-connector.model';

import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { encryptionService } from '../../service/encryption.service';
import { convertDateTimeToInstant, formatInstant, getErrorMessage, logQuery, workUnitLogCtx } from '../../service/utils';
import SouthConnector from '../south-connector';
import { SouthHistoryQuery } from '../south-interface';
import { loadOdbc } from './odbc-loader';

// Upper bound of maxParallelRun, as in the manifest.
const MAX_PARALLEL_RUN_CEILING = 8;

/**
 * Class SouthODBC - Retrieve data from SQL databases with ODBC driver and send them to the cache as record-list content.
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

  /**
   * Each query opens its own ODBC connection (see queryOdbcData): work-units can query in parallel.
   */
  protected override getMaxParallelRun(): number {
    return Math.max(1, Math.min(this.connector.settings.maxParallelRun, MAX_PARALLEL_RUN_CEILING));
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
    const result = await this.queryData(item, startTime, endTime);
    const queryDuration = DateTime.now().toMillis() - queryStart;
    return {
      result: { type: 'record-list', content: result },
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
   * Get entries from the database between startTime and endTime (if used in the SQL query) and send
   * them to the cache as record-list content.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthODBCItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: OIBusRecord | null }> {
    const item = items[0];
    const logCtx = workUnitLogCtx(items);

    const startRequest = DateTime.now();
    const result = await this.queryData(item, startTime, endTime);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

    let updatedStartTime: Instant | null = null;
    if (result.length > 0) {
      this.logger.info(logCtx, `Found ${result.length} results in ${requestDuration} ms`);
      updatedStartTime = this.trackMaxInstant(item, result);
      await this.addContent({ type: 'record-list', content: result }, startRequest.toUTC().toISO(), items);
    } else {
      this.logger.debug(logCtx, `No result found. Request done in ${requestDuration} ms`);
    }

    return { trackedInstant: updatedStartTime, value: result.length > 0 ? result[result.length - 1] : null };
  }

  /**
   * Scan the rows for the configured tracking field and return the max Instant found, used as the
   * cursor for the next incremental query. Row values are otherwise left untouched.
   */
  private trackMaxInstant(item: SouthConnectorItemEntity<SouthODBCItemSettings>, rows: Array<OIBusRecord>): Instant | null {
    if (!item.settings.trackingInstant?.trackInstant) return null;

    const fieldName = item.settings.trackingInstant.fieldName!;
    const dateTimeInput = item.settings.trackingInstant.dateTimeInput!;
    let updatedStartTime: Instant | null = null;
    for (const row of rows) {
      const rawValue = row[fieldName];
      if (rawValue === null || rawValue === undefined) continue;
      const instant = convertDateTimeToInstant(rawValue as string | number, dateTimeInput);
      if (instant && (!updatedStartTime || instant > updatedStartTime)) {
        updatedStartTime = instant;
      }
    }
    return updatedStartTime;
  }

  /**
   * Apply the SQL query with the ODBC driver. Only `@StartTime`/`@EndTime`
   * query parameters are formatted, using the tracking field's `dateTimeInput` config so they match the
   * source column's native representation.
   */
  async queryData(
    item: SouthConnectorItemEntity<SouthODBCItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<OIBusRecord>> {
    const dateTimeInput = item.settings.trackingInstant?.trackInstant ? item.settings.trackingInstant.dateTimeInput : null;
    const odbcStartTime = dateTimeInput == null ? startTime : formatInstant(startTime, dateTimeInput);
    const odbcEndTime = dateTimeInput == null ? endTime : formatInstant(endTime, dateTimeInput);
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, `${odbcStartTime}`).replace(/@EndTime/g, `${odbcEndTime}`);
    logQuery(adaptedQuery, odbcStartTime, odbcEndTime, this.logger, workUnitLogCtx([item]));
    return await this.queryOdbcData(item, adaptedQuery);
  }

  async queryOdbcData(item: SouthConnectorItemEntity<SouthODBCItemSettings>, query: string): Promise<Array<OIBusRecord>> {
    const odbc = await loadOdbc();
    if (!odbc) {
      throw new Error('ODBC library not available');
    }

    let connection;
    try {
      const connectionConfig = await this.createConnectionConfig(this.connector.settings);
      connection = await odbc.connect(connectionConfig);
      // The driver returns the rows in an array also carrying statement metadata (count, columns...): only keep the rows
      const result: Array<OIBusRecord> = [...(await connection.query(query))];
      await connection.close();
      return result;
    } catch (error: unknown) {
      const { odbcErrors } = error as { odbcErrors?: Array<{ message: string; code: number; state: string }> };
      if (odbcErrors && odbcErrors.length > 0) {
        this.logOdbcErrors(odbcErrors, workUnitLogCtx([item]));
      }
      if (connection) {
        await connection.close();
      }
      throw new Error(getErrorMessage(error));
    }
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
