import path from 'node:path';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import {
  formatInstant,
  convertDateTimeToInstant,
  createFolder,
  generateReplacementParameters,
  logQuery,
  persistResults
} from '../../service/utils';
import { SouthConnectorItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { QueriesHistory, TestsConnection } from '../south-interface';
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
export default class SouthOracle
  extends SouthConnector<SouthOracleSettings, SouthOracleItemSettings>
  implements QueriesHistory, TestsConnection
{
  static type = manifest.id;

  private readonly tmpFolder: string;
  constructor(
    configuration: SouthConnectorDTO<SouthOracleSettings>,
    items: Array<SouthConnectorItemDTO<SouthOracleItemSettings>>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string,
    streamMode: boolean
  ) {
    super(
      configuration,
      items,
      engineAddValuesCallback,
      engineAddFileCallback,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      baseFolder,
      streamMode
    );
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start();
  }

  static async testConnection(settings: SouthOracleSettings, logger: pino.Logger, encryptionService: EncryptionService): Promise<void> {
    if (!oracledb) {
      throw new Error('oracledb library not loaded');
    }

    const config: Parameters<typeof oracledb.getConnection>[0] = {
      user: settings.username,
      password: settings.password ? await encryptionService.decryptText(settings.password) : '',
      connectString: `${settings.host}:${settings.port}/${settings.database}`
    };

    let connection;
    logger.trace(`Testing if Oracle connection settings are correct`);
    try {
      connection = await oracledb.getConnection(config);
      logger.trace(`Pinging the database`);
      await connection.ping();
    } catch (error: any) {
      logger.error(`Unable to connect to database: ${error.message}`);
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
          throw new Error(`Cannot connect to database '${settings.database}'. Service is not registered`);

        default:
          throw new Error('Please check logs');
      }
    }

    logger.trace(`Testing system table query`);

    let tables;
    try {
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      const { rows } = await connection.execute(`
              SELECT TABLES.TABLE_NAME AS "table_name",
                    (
                      SELECT LISTAGG(column_name || '(' || data_type || ')', ', ')
                              WITHIN GROUP (ORDER BY TABLE_NAME)
                      FROM USER_TAB_COLUMNS
                      WHERE TABLE_NAME = TABLES.TABLE_NAME
                    ) AS "columns"
              FROM ALL_TABLES TABLES
              WHERE OWNER = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')
      `);
      tables = rows;
    } catch (error: any) {
      await connection.close();

      logger.error(`Unable to read tables in database '${settings.database}': ${error.message}`);
      throw new Error(`Unable to read tables in database '${settings.database}', check logs`);
    }

    await connection.close();

    if (tables.length === 0) {
      logger.warn(`No tables in the '${settings.username}' schema`);
      throw new Error(`No tables in the '${settings.username}' schema`);
    }

    const tablesString = tables.map((row: any) => `${row.table_name}: [${row.columns}]`).join(',\n');

    logger.info('Database is live with tables (table:[columns]):\n%s', tablesString);
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
          this.configuration.name,
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
      user: this.configuration.settings.username,
      password: this.configuration.settings.password ? await this.encryptionService.decryptText(this.configuration.settings.password) : '',
      connectString: `${this.configuration.settings.host}:${this.configuration.settings.port}/${this.configuration.settings.database}`
    };

    const referenceTimestampField = item.settings.dateTimeFields.find(dateTimeField => dateTimeField.useAsReference) || null;
    const oracleStartTime = referenceTimestampField == null ? startTime : formatInstant(startTime, referenceTimestampField);
    const oracleEndTime = referenceTimestampField == null ? endTime : formatInstant(endTime, referenceTimestampField);
    logQuery(item.settings.query, oracleStartTime, oracleEndTime, this.logger);

    let connection;
    try {
      process.env.ORA_SDTZ = 'UTC';
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      connection = await oracledb.getConnection(config);
      connection.callTimeout = this.configuration.settings.requestTimeout;

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
