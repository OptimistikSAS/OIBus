import path from 'node:path';
import mysql from 'mysql2/promise';

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
import { Instant } from '../../../shared/model/types';
import { QueriesHistory } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthMySQLItemSettings, SouthMySQLSettings } from '../../../shared/model/south-settings.model';
import { OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';

/**
 * Class SouthMySQL - Retrieve data from MySQL / MariaDB databases and send them to the cache as CSV files.
 */
export default class SouthMySQL extends SouthConnector<SouthMySQLSettings, SouthMySQLItemSettings> implements QueriesHistory {
  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorEntity<SouthMySQLSettings, SouthMySQLItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    southConnectorRepository: SouthConnectorRepository,
    southCacheRepository: SouthCacheRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(
      connector,
      engineAddContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      baseFolders
    );
    this.tmpFolder = path.resolve(this.baseFolders.cache, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(dataStream = true): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start(dataStream);
  }

  async createConnectionOptions(): Promise<mysql.ConnectionOptions> {
    return {
      host: this.connector.settings.host,
      port: this.connector.settings.port,
      user: this.connector.settings.username || undefined,
      password: this.connector.settings.password ? await this.encryptionService.decryptText(this.connector.settings.password) : undefined,
      database: this.connector.settings.database,
      connectTimeout: this.connector.settings.connectionTimeout,
      timezone: 'Z'
    };
  }

  override async testConnection(): Promise<void> {
    const config = await this.createConnectionOptions();
    let connection;
    try {
      connection = await mysql.createConnection(config);
      await connection.ping();
    } catch (error: unknown) {
      if (connection) {
        await connection.end();
      }

      switch ((error as { code: string; message: string }).code) {
        case 'ETIMEDOUT':
        case 'ECONNREFUSED':
          throw new Error(`Please check host and port. ${(error as { code: string; message: string }).message}`);

        case 'ER_ACCESS_DENIED_ERROR':
          throw new Error(`Please check username and password. ${(error as { code: string; message: string }).message}`);

        case 'ER_DBACCESS_DENIED_ERROR':
          throw new Error(
            `User "${this.connector.settings.username}" does not have access to database "${this.connector.settings.database}". ${(error as { code: string; message: string }).message}`
          );

        case 'ER_BAD_DB_ERROR':
          throw new Error(
            `Database "${this.connector.settings.database}" does not exist. ${(error as { code: string; message: string }).message}`
          );

        default:
          throw new Error(`Unexpected error. ${(error as { code: string; message: string }).message}`);
      }
    }

    let table_count;
    try {
      const [rows] = await connection.execute<Array<mysql.RowDataPacket>>(`
        SELECT COUNT(*) AS table_count
        FROM information_schema.TABLES AS TABLES
        WHERE table_schema = DATABASE()
          AND table_type = 'BASE TABLE'
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
    item: SouthConnectorItemEntity<SouthMySQLItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void
  ): Promise<void> {
    const config = await this.createConnectionOptions();
    const connection = await mysql.createConnection(config);

    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    const result: Array<Record<string, string | number>> = await this.queryData(item, startTime, endTime);
    await connection.end();

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
    items: Array<SouthConnectorItemEntity<SouthMySQLItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant | null> {
    let updatedStartTime: Instant | null = null;

    for (const item of items) {
      const startRequest = DateTime.now().toMillis();
      const result: Array<Record<string, string | number>> = await this.queryData(item, startTime, endTime);
      const requestDuration = DateTime.now().toMillis() - startRequest;

      if (result.length > 0) {
        this.logger.info(`Found ${result.length} results for item ${item.name} in ${requestDuration} ms`);

        const formattedResult = result.map(entry => {
          const formattedEntry: Record<string, string | number> = {};
          Object.entries(entry).forEach(([key, value]) => {
            const datetimeField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.fieldName === key) || null;
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
    return updatedStartTime;
  }

  getThrottlingSettings(settings: SouthMySQLSettings): SouthThrottlingSettings {
    return {
      maxReadInterval: settings.throttling.maxReadInterval,
      readDelay: settings.throttling.readDelay
    };
  }

  getMaxInstantPerItem(_settings: SouthMySQLSettings): boolean {
    return false;
  }

  getOverlap(settings: SouthMySQLSettings): number {
    return settings.throttling.overlap;
  }

  /**
   * Apply the SQL query to the target MySQL / MariaDB database
   */
  async queryData(
    item: SouthConnectorItemEntity<SouthMySQLItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<Record<string, string | number>>> {
    const config = await this.createConnectionOptions();

    const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference) || null;
    const mysqlStartTime = referenceTimestampField == null ? startTime : formatInstant(startTime, referenceTimestampField);
    const mysqlEndTime = referenceTimestampField == null ? endTime : formatInstant(endTime, referenceTimestampField);
    logQuery(item.settings.query, mysqlStartTime, mysqlEndTime, this.logger);

    let connection;
    try {
      connection = await mysql.createConnection(config);
      const params = generateReplacementParameters(item.settings.query, mysqlStartTime, mysqlEndTime);
      const [data] = await connection.execute(
        {
          sql: item.settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?'),
          timeout: item.settings.requestTimeout
        },
        params
      );
      await connection.end();
      return data as Array<Record<string, string | number>>;
    } catch (error) {
      if (connection) {
        await connection.end();
      }
      throw error;
    }
  }
}
