import path from 'node:path';
import fs from 'node:fs/promises';
import db from 'better-sqlite3';
import pino from 'pino';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { convertDateTimeToInstant, createFolder, formatInstant, logQuery, persistResults } from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthSQLiteItemSettings, SouthSQLiteSettings } from '../../../../shared/model/south-settings.model';
import { OIBusDataValue } from '../../../../shared/model/engine.model';

/**
 * Class SouthSQLite - Retrieve data from SQLite databases and send them to the cache as CSV files.
 */
export default class SouthSQLite extends SouthConnector<SouthSQLiteSettings, SouthSQLiteItemSettings> implements QueriesHistory {
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthSQLiteSettings>,
    items: Array<SouthConnectorItemDTO<SouthSQLiteItemSettings>>,
    engineAddValuesCallback: (southId: string, values: Array<OIBusDataValue>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, items, engineAddValuesCallback, engineAddFileCallback, encryptionService, repositoryService, logger, baseFolder);
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start();
  }

  override async testConnection(): Promise<void> {
    this.logger.info(`Testing connection on "${this.connector.settings.databasePath}"`);
    const dbPath = path.resolve(this.connector.settings.databasePath);

    try {
      await fs.access(dbPath, fs.constants.F_OK);
    } catch (error: any) {
      this.logger.error(`Access error on "${dbPath}". ${error.message}`);
      throw new Error(`File "${dbPath}" does not exist`);
    }

    const database = db(dbPath);
    let result;

    try {
      result = database
        .prepare(
          `SELECT tbl_name,
                  (SELECT group_concat(name || '(' || type || ')', ', ')
                   FROM PRAGMA_TABLE_INFO(tbl_name)) AS columns
           FROM sqlite_master
           WHERE type = 'table'`
        )
        .all();
    } catch (error: any) {
      this.logger.error(`Unable to query system table. ${error.message}`);
      throw new Error('Error testing database connection, check logs');
    }
    database.close();

    if (result.length === 0) {
      this.logger.warn(`Database "${dbPath}" has no table`);
      throw new Error('Database has no table');
    }
    const tables = result.map((row: any) => `${row.tbl_name}: [${row.columns}]`).join(',\n');
    this.logger.info('Database is live with tables (table:[columns]):\n%s', tables);
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
          this.tmpFolder,
          this.addFile.bind(this),
          this.addValues.bind(this),
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
