import path from 'node:path';
import fs from 'node:fs/promises';
import db from 'better-sqlite3';
import pino from 'pino';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { convertDateTimeToInstant, createFolder, formatInstant, logQuery, persistResults, generateCsvContent, generateFilenameForSerialization } from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthSQLiteItemSettings, SouthSQLiteSettings } from '../../../../shared/model/south-settings.model';
import { OIBusContent } from '../../../../shared/model/engine.model';

/**
 * Class SouthSQLite - Retrieve data from SQLite databases and send them to the cache as CSV files.
 */
export default class SouthSQLite extends SouthConnector<SouthSQLiteSettings, SouthSQLiteItemSettings> implements QueriesHistory {
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthSQLiteSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, engineAddContentCallback, encryptionService, repositoryService, logger, baseFolder);
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(dataStream = true): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start(dataStream);
  }

  override async testConnection(): Promise<void> {
    const dbPath = path.resolve(this.connector.settings.databasePath);

    try {
      await fs.access(dbPath, fs.constants.F_OK);
    } catch (error: any) {
      throw new Error(`Access error on "${dbPath}". ${error.message}`);
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
        .all() as { table_count: number }[];
      table_count = result[0]?.table_count ?? 0;
    } catch (error: any) {
      throw new Error(`Unable to query system table. ${error.message}`);
    }
    database.close();

    if (table_count === 0) {
      throw new Error(`Database "${dbPath}" has no tables`);
    }
  }

  override async testItem(item: SouthConnectorItemDTO<SouthSQLiteItemSettings>, callback: (data: OIBusContent) => void): Promise<void> {
    await this.testConnection();

    const startTime = DateTime.now()
      .minus(3600 * 1000)
      .toUTC()
      .toISO() as Instant;
    const endTime = DateTime.now().toUTC().toISO() as Instant;
    const result: Array<any> = await this.queryData(item, startTime, endTime);

    const formattedResults = result.map(entry => {
      const formattedEntry: Record<string, any> = {};
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
      default: {
        oibusContent = { type: 'time-values', content: formattedResults as Array<any> };
      }
    }
    callback(oibusContent);
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(items: Array<SouthConnectorItemDTO<SouthSQLiteItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
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
   * Apply the SQL query to the target SQLite database
   */
  async queryData(item: SouthConnectorItemDTO<SouthSQLiteItemSettings>, startTime: Instant, endTime: Instant): Promise<Array<any>> {
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
      return data;
    } catch (error) {
      database.close();
      throw error;
    }
  }
}
