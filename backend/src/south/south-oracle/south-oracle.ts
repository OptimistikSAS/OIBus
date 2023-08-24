import path from 'node:path';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import {
  convertDateTimeToInstant,
  createFolder,
  formatInstant,
  generateReplacementParameters,
  logQuery,
  persistResults
} from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { QueriesHistory } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthOracleItemSettings, SouthOracleSettings } from '../../../../shared/model/south-settings.model';

let oracledb: {
  outFormat: any;
  OUT_FORMAT_OBJECT: any;
  getConnection: (arg0: { user: any; password: string; connectString: string }) => any;
} | null = null;
// @ts-ignore
import('oracledb')
  .then(obj => {
    oracledb = obj.default;
    console.info('oracledb library loaded');
  })
  .catch(() => {
    console.error('Could not load oracledb');
  });

/**
 * Class SouthOracle - Retrieve data from Oracle databases and send them to the cache as CSV files.
 */
export default class SouthOracle extends SouthConnector<SouthOracleSettings, SouthOracleItemSettings> implements QueriesHistory {
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthOracleSettings>,
    items: Array<SouthConnectorItemDTO<SouthOracleItemSettings>>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
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
    if (!oracledb) {
      throw new Error('oracledb library not loaded');
    }
    this.logger.info(`Testing connection on "${this.connector.settings.host}"`);

    const config: Parameters<typeof oracledb.getConnection>[0] = {
      user: this.connector.settings.username,
      password: this.connector.settings.password ? await this.encryptionService.decryptText(this.connector.settings.password) : '',
      connectString: `${this.connector.settings.host}:${this.connector.settings.port}/${this.connector.settings.database}`
    };

    let connection;
    try {
      connection = await oracledb.getConnection(config);
      await connection.ping();
    } catch (error: any) {
      this.logger.error(`Unable to connect to database. ${error.message}`);
      if (connection) {
        await connection.close();
      }

      switch (error.code) {
        case 'NJS-515':
        case 'NJS-503':
          throw new Error('Please check host and port');

        case 'ORA-01017':
          throw new Error('Please check username and password');

        case 'NJS-518':
          throw new Error(`Cannot connect to database "${this.connector.settings.database}". Service is not registered`);

        default:
          throw new Error('Please check logs');
      }
    }

    let tables;
    try {
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      const { rows } = await connection.execute(`
        SELECT TABLES.TABLE_NAME AS "table_name",
               (SELECT LISTAGG(column_name || '(' || data_type || ')', ', ')
                         WITHIN
        GROUP (ORDER BY TABLE_NAME)
        FROM USER_TAB_COLUMNS
        WHERE TABLE_NAME = TABLES.TABLE_NAME
          ) AS "columns"
        FROM ALL_TABLES TABLES
        WHERE OWNER = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')
      `);
      tables = rows;
    } catch (error: any) {
      await connection.close();

      this.logger.error(`Unable to read tables in database "${this.connector.settings.database}". ${error.message}`);
      throw new Error(`Unable to read tables in database "${this.connector.settings.database}", check logs`);
    }

    await connection.close();

    if (tables.length === 0) {
      this.logger.warn(`No tables in the "${this.connector.settings.username}" schema`);
      throw new Error(`No tables in the "${this.connector.settings.username}" schema`);
    }
    const tablesString = tables.map((row: any) => `${row.table_name}: [${row.columns}]`).join(',\n');
    this.logger.info('Database is live with tables (table:[columns]):\n%s', tablesString);
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(items: Array<SouthConnectorItemDTO<SouthOracleItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
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
            const datetimeField = item.settings.dateTimeFields.find(dateTimeField => dateTimeField.fieldName === key);
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
   * Apply the SQL query to the target Oracle database
   */
  async queryData(item: SouthConnectorItemDTO<SouthOracleItemSettings>, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    if (!oracledb) {
      throw new Error('oracledb library not loaded');
    }

    const config = {
      user: this.connector.settings.username,
      password: this.connector.settings.password ? await this.encryptionService.decryptText(this.connector.settings.password) : '',
      connectString: `${this.connector.settings.host}:${this.connector.settings.port}/${this.connector.settings.database}`
    };

    const referenceTimestampField = item.settings.dateTimeFields.find(dateTimeField => dateTimeField.useAsReference);
    const oracleStartTime = referenceTimestampField ? formatInstant(startTime, referenceTimestampField) : startTime;
    const oracleEndTime = referenceTimestampField ? formatInstant(endTime, referenceTimestampField) : endTime;
    logQuery(item.settings.query, oracleStartTime, oracleEndTime, this.logger);

    let connection;
    try {
      process.env.ORA_SDTZ = 'UTC';
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      connection = await oracledb.getConnection(config);
      connection.callTimeout = item.settings.requestTimeout;

      const params = generateReplacementParameters(item.settings.query, oracleStartTime, oracleEndTime);
      const { rows } = await connection.execute(
        item.settings.query.replace(/@StartTime/g, ':date1').replace(/@EndTime/g, ':date2'),
        params
      );
      await connection.close();
      return rows || [];
    } catch (error) {
      if (connection) {
        await connection.close();
      }
      throw error;
    }
  }
}
