import path from 'node:path';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import {
  convertDateTimeToInstant,
  createFolder,
  formatInstant,
  generateReplacementParameters,
  logQuery,
  persistResults,
  generateCsvContent,
  generateFilenameForSerialization
} from '../../service/utils';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { QueriesHistory } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthOracleItemSettings, SouthOracleSettings } from '../../../../shared/model/south-settings.model';
import { OIBusContent } from '../../../../shared/model/engine.model';

import oracledb, { ConnectionAttributes } from 'oracledb';

/**
 * Class SouthOracle - Retrieve data from Oracle databases and send them to the cache as CSV files.
 */
export default class SouthOracle extends SouthConnector<SouthOracleSettings, SouthOracleItemSettings> implements QueriesHistory {
  static type = manifest.id;

  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorDTO<SouthOracleSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, engineAddContentCallback, encryptionService, repositoryService, logger, baseFolder);
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
    if (this.connector.settings.thickMode && this.connector.settings.oracleClient) {
      oracledb.initOracleClient({ libDir: path.resolve(this.connector.settings.oracleClient) });
    }
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(dataStream = true): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start(dataStream);
  }

  override async testConnection(): Promise<void> {
    const config: ConnectionAttributes = {
      user: this.connector.settings.username || undefined,
      password: this.connector.settings.password ? await this.encryptionService.decryptText(this.connector.settings.password) : undefined,
      connectString: `${this.connector.settings.host}:${this.connector.settings.port}/${this.connector.settings.database}`
    };

    let connection;
    try {
      connection = await oracledb.getConnection(config);
      await connection.ping();
    } catch (error: any) {
      if (connection) {
        await connection.close();
      }

      switch (error.code) {
        case 'NJS-515':
        case 'NJS-503':
          throw new Error(`Please check host and port. ${error.message}`);

        case 'ORA-01017':
          throw new Error(`Please check username and password. ${error.message}`);

        case 'NJS-518':
          throw new Error(`Cannot connect to database "${this.connector.settings.database}". Service is not registered. ${error.message}`);

        default:
          throw new Error(`Unexpected error. ${error.message}`);
      }
    }

    let table_count;
    try {
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      const { rows } = await connection.execute(`
      SELECT COUNT(*) AS TABLE_COUNT
        FROM ALL_TABLES
        WHERE OWNER = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')
      `);
      if (rows) {
        const result: any = rows[0];
        table_count = result?.TABLE_COUNT || 0;
      }
    } catch (error: any) {
      await connection.close();
      throw new Error(`Unable to read tables in database "${this.connector.settings.database}". ${error.message}`);
    }

    await connection.close();

    if (table_count === 0) {
      throw new Error(`No tables in the "${this.connector.settings.username}" schema`);
    }
  }

  // it has never been tested
  override async testItem(item: SouthConnectorItemDTO<SouthOracleItemSettings>, callback: (data: OIBusContent) => void): Promise<void> {
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
   * Apply the SQL query to the target Oracle database
   */
  async queryData(item: SouthConnectorItemDTO<SouthOracleItemSettings>, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const config: ConnectionAttributes = {
      user: this.connector.settings.username || undefined,
      password: this.connector.settings.password ? await this.encryptionService.decryptText(this.connector.settings.password) : undefined,
      connectString: `${this.connector.settings.host}:${this.connector.settings.port}/${this.connector.settings.database}`
    };

    const referenceTimestampField = item.settings.dateTimeFields?.find(dateTimeField => dateTimeField.useAsReference);
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
