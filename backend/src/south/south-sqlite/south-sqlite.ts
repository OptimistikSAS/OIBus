import path from 'node:path';
import fs from 'node:fs/promises';
import db from 'better-sqlite3';
import pino from 'pino';

import SouthConnector from '../south-connector';
import {
  convertDateTimeToInstant,
  createFolder,
  formatInstant,
  generateCsvContent,
  generateFilenameForSerialization,
  logQuery,
  persistResults
} from '../../service/utils';
import EncryptionService from '../../service/encryption.service';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthSQLiteItemSettings, SouthSQLiteSettings } from '../../../shared/model/south-settings.model';
import { OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';

/**
 * Class SouthSQLite - Retrieve data from SQLite databases and send them to the cache as CSV files.
 */
export default class SouthSQLite extends SouthConnector<SouthSQLiteSettings, SouthSQLiteItemSettings> implements QueriesHistory {
  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorEntity<SouthSQLiteSettings, SouthSQLiteItemSettings>,
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
    if (this.connector.id !== 'test') {
      await createFolder(this.tmpFolder);
    }
    await super.start(dataStream);
  }

  override async testConnection(): Promise<void> {
    const dbPath = path.resolve(this.connector.settings.databasePath);

    try {
      await fs.access(dbPath, fs.constants.F_OK);
    } catch (error: unknown) {
      throw new Error(`Access error on "${dbPath}". ${(error as Error).message}`);
    }

    const database = db(dbPath);
    let result;
    let table_count;
    try {
      result = database
        .prepare(
          `SELECT COUNT(*) AS table_count
           FROM sqlite_master
           WHERE type = 'table'`
        )
        .all() as Array<{ table_count: number }>;
      table_count = result[0]?.table_count ?? 0;
    } catch (error: unknown) {
      throw new Error(`Unable to query system table. ${(error as Error).message}`);
    }
    database.close();

    if (table_count === 0) {
      throw new Error(`Database "${dbPath}" has no tables`);
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthSQLiteItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void
  ): Promise<void> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
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
      case 'csv':
        const filePath = generateFilenameForSerialization(
          this.tmpFolder,
          item.settings.serialization.filename,
          this.connector.name,
          item.name
        );
        const content = generateCsvContent(formattedResults, item.settings.serialization.delimiter);
        oibusContent = { type: 'any', filePath, content };
        break;
    }
    callback(oibusContent);
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthSQLiteItemSettings>>,
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

  getThrottlingSettings(settings: SouthSQLiteSettings): SouthThrottlingSettings {
    return {
      maxReadInterval: settings.throttling.maxReadInterval,
      readDelay: settings.throttling.readDelay
    };
  }

  getMaxInstantPerItem(_settings: SouthSQLiteSettings): boolean {
    return true;
  }

  getOverlap(settings: SouthSQLiteSettings): number {
    return settings.throttling.overlap;
  }

  /**
   * Apply the SQL query to the target SQLite database
   */
  async queryData(
    item: SouthConnectorItemEntity<SouthSQLiteItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<Record<string, string | number>>> {
    this.logger.debug(`Opening ${path.resolve(this.connector.settings.databasePath)} SQLite database`);
    const database = db(path.resolve(this.connector.settings.databasePath));

    const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference);
    const sqliteStartTime = referenceTimestampField == null ? startTime : formatInstant(startTime, referenceTimestampField);
    const sqliteEndTime = referenceTimestampField == null ? endTime : formatInstant(endTime, referenceTimestampField);
    logQuery(item.settings.query, sqliteStartTime, sqliteEndTime, this.logger);

    try {
      const stmt = database.prepare(item.settings.query);
      const preparedParameters: Record<string, number | string> = {};
      if (item.settings.query.indexOf('@StartTime') !== -1) {
        preparedParameters.StartTime = sqliteStartTime;
      }
      if (item.settings.query.indexOf('@EndTime') !== -1) {
        preparedParameters.EndTime = sqliteEndTime;
      }

      const data = stmt.all(preparedParameters);
      database.close();
      return data as unknown as Array<Record<string, string | number>>;
    } catch (error) {
      database.close();
      throw error;
    }
  }
}
