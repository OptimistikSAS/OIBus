import path from 'node:path';
import fs from 'node:fs/promises';
import db from 'better-sqlite3';

import SouthConnector from '../south-connector';
import {
  convertDateTimeToInstant,
  formatInstant,
  generateCsvContent,
  generateFilenameForSerialization,
  logQuery,
  persistResults
} from '../../service/utils';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { SouthHistoryQuery } from '../south-interface';
import { SouthItemSettings, SouthSQLiteItemSettings, SouthSQLiteSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import type { ILogger } from '../../model/logger.model';

/**
 * Class SouthSQLite - Retrieve data from SQLite databases and send them to the cache as CSV files.
 */
export default class SouthSQLite extends SouthConnector<SouthSQLiteSettings, SouthSQLiteItemSettings> implements SouthHistoryQuery {
  constructor(
    connector: SouthConnectorEntity<SouthSQLiteSettings, SouthSQLiteItemSettings>,
    engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: ILogger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
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
      database.close();
      throw new Error(`Unable to query system table. ${(error as Error).message}`);
    }

    if (table_count === 0) {
      database.close();
      throw new Error(`Database "${dbPath}" has no tables`);
    }

    const items: Array<{ key: string; value: string }> = [{ key: 'Tables', value: String(table_count) }];

    try {
      const versionResult = database.prepare(`SELECT sqlite_version() AS version`).all() as Array<{ version: string }>;
      if (versionResult[0]?.version) {
        items.unshift({ key: 'SQLite Version', value: versionResult[0].version });
      }
    } catch {
      // Version info not available
    }

    database.close();

    try {
      const stat = await fs.stat(dbPath);
      items.push({ key: 'File Size', value: `${(stat.size / 1024).toFixed(1)} KB` });
    } catch {
      // File stat not critical
    }

    return { items };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthSQLiteItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
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
    return oibusContent;
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthSQLiteItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    let updatedStartTime: Instant | null = null;

    const startRequest = DateTime.now();
    const result: Array<Record<string, string | number>> = await this.queryData(items[0], startTime, endTime);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

    if (result.length > 0) {
      this.logger.info(`Found ${result.length} results for item ${items[0].name} in ${requestDuration} ms`);

      const formattedResult = result.map(entry => {
        const formattedEntry: Record<string, string | number> = {};
        Object.entries(entry).forEach(([key, value]) => {
          const datetimeField = items[0].settings.dateTimeFields?.find(dateTimeField => dateTimeField.fieldName === key);
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
              format: items[0].settings.serialization.outputTimestampFormat,
              timezone: items[0].settings.serialization.outputTimezone,
              locale: 'en-En'
            });
          }
        });
        return formattedEntry;
      });
      await persistResults(
        formattedResult,
        items[0].settings.serialization,
        this.connector.name,
        items[0],
        startRequest.toUTC().toISO(),
        this.tmpFolder,
        this.addContent.bind(this),
        this.logger
      );
    } else {
      this.logger.debug(`No result found for item ${items[0].name}. Request done in ${requestDuration} ms`);
    }
    return { trackedInstant: updatedStartTime, value: result.length > 0 ? result[result.length - 1] : null };
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
