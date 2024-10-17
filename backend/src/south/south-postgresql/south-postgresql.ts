import path from 'node:path';
import * as pg from 'pg';
import { ClientConfig } from 'pg';

import SouthConnector from '../south-connector';
import {
  convertDateTimeToInstant,
  createFolder,
  formatInstant,
  generateCsvContent,
  generateFilenameForSerialization,
  generateReplacementParameters,
  logQuery,
  persistResults
} from '../../service/utils';
import EncryptionService from '../../service/encryption.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { QueriesHistory } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthPostgreSQLItemSettings, SouthPostgreSQLSettings } from '../../../../shared/model/south-settings.model';
import { OIBusContent } from '../../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';

/**
 * Class SouthPostgreSQL - Retrieve data from PostgreSQL databases and send them to the cache as CSV files.
 */
export default class SouthPostgreSQL
  extends SouthConnector<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>
  implements QueriesHistory
{
  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorEntity<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings>,
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
    const config = await this.createConnectionOptions();

    let connection;
    try {
      connection = new pg.Client(config);
      await connection.connect();
    } catch (error: unknown) {
      if (connection) {
        await connection.end();
      }

      if (/(timeout expired)|(^(connect ECONNREFUSED).*)/.test((error as Error).message)) {
        throw new Error(`Please check host and port. ${(error as Error).message}`);
      }

      switch ((error as Error).message) {
        case `password authentication failed for user "${this.connector.settings.username}"`:
          throw new Error(`Please check username and password. ${(error as Error).message}`);

        case `database "${this.connector.settings.database}" does not exist`:
          throw new Error(`Database "${this.connector.settings.database}" does not exist. ${(error as Error).message}`);

        default:
          throw new Error(`Unexpected error. ${(error as Error).message}`);
      }
    }

    let table_count;
    try {
      const { rows } = await connection.query(`
        SELECT COUNT(*) AS table_count
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND table_schema = current_schema()
      `);
      table_count = rows[0]?.table_count ?? 0;
    } catch (error: unknown) {
      await connection.end();
      throw new Error(`Unable to read tables in database "${this.connector.settings.database}". ${(error as Error).message}`);
    }

    await connection.end();

    if (table_count === 0) {
      throw new Error(`Database "${this.connector.settings.database}" has no tables`);
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthPostgreSQLItemSettings>,
    callback: (data: OIBusContent) => void
  ): Promise<void> {
    const startTime = DateTime.now()
      .minus(600 * 1000)
      .toUTC()
      .toISO() as Instant;
    const endTime = DateTime.now().toUTC().toISO() as Instant;
    const result: Array<Record<string, string | number>> = await this.queryData(item, startTime, endTime);

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

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthPostgreSQLItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant> {
    let updatedStartTime = startTime;

    for (const item of items) {
      const startRequest = DateTime.now().toMillis();
      const result: Array<Record<string, string | number>> = await this.queryData(item, updatedStartTime, endTime);
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
        await persistResults(
          formattedResult,
          item.settings.serialization,
          this.connector.name,
          item.name,
          this.tmpFolder,
          this.addContent.bind(this),
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
  async queryData(
    item: SouthConnectorItemEntity<SouthPostgreSQLItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<Record<string, string | number>>> {
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, '$1').replace(/@EndTime/g, '$2');
    const config = await this.createConnectionOptions();

    const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference);
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
