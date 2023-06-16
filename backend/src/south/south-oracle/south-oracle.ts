import path from 'node:path';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import {
  convertDateTimeFromInstant,
  convertDateTimeToInstant,
  createFolder,
  generateReplacementParameters,
  logQuery,
  persistResults
} from '../../service/utils';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { DateTimeSerialization, Instant, Serialization } from '../../../../shared/model/types';
import { QueriesHistory, TestsConnection } from '../south-interface';
import { DateTime } from 'luxon';

let oracledb: {
  outFormat: any;
  OUT_FORMAT_OBJECT: any;
  getConnection: (arg0: { user: any; password: string; connectString: string }) => any;
} | null = null;
// @ts-ignore
import('oracledb')
  .then(obj => {
    oracledb = obj;
    console.info('oracledb library loaded');
  })
  .catch(() => {
    console.error('Could not load oracledb');
  });

/**
 * Class SouthOracle - Retrieve data from Oracle databases and send them to the cache as CSV files.
 */
export default class SouthOracle extends SouthConnector implements QueriesHistory, TestsConnection {
  static type = manifest.id;

  private readonly tmpFolder: string;
  constructor(
    configuration: SouthConnectorDTO,
    items: Array<OibusItemDTO>,
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

  // TODO: method needs to be implemented
  static async testConnection(settings: SouthConnectorDTO['settings'], logger: pino.Logger): Promise<void> {
    logger.trace(`Testing connection`);
    throw new Error('TODO: method needs to be implemented');
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  async historyQuery(items: Array<OibusItemDTO>, startTime: Instant, endTime: Instant): Promise<Instant> {
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
            const datetimeField = item.settings.serialization.datetimeSerialization.find(
              (element: DateTimeSerialization) => element.field === key
            );
            if (!datetimeField) {
              formattedEntry[key] = value;
            } else {
              const entryDate = convertDateTimeToInstant(entry[datetimeField.field], datetimeField.datetimeFormat);
              if (datetimeField.useAsReference) {
                if (entryDate > updatedStartTime) {
                  updatedStartTime = entryDate;
                }
              }
              formattedEntry[key] = convertDateTimeFromInstant(entryDate, item.settings.serialization.dateTimeOutputFormat);
            }
          });
          return formattedEntry;
        });
        await persistResults(
          formattedResult,
          item.settings.serialization as Serialization,
          this.configuration.name,
          this.tmpFolder,
          this.addFile.bind(this),
          this.logger
        );
      } else {
        this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
      }
    }
    return updatedStartTime;
  }

  /**
   * Apply the SQL query to the target Oracle database
   */
  async queryData(item: OibusItemDTO, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    if (!oracledb) {
      throw new Error('oracledb library not loaded');
    }

    const config = {
      user: this.configuration.settings.username,
      password: this.configuration.settings.password ? await this.encryptionService.decryptText(this.configuration.settings.password) : '',
      connectString: `${this.configuration.settings.host}:${this.configuration.settings.port}/${this.configuration.settings.database}`
    };

    const datetimeSerialization = item.settings.serialization.datetimeSerialization.find(
      (serialization: DateTimeSerialization) => serialization.useAsReference
    );
    const oracleStartTime = convertDateTimeFromInstant(startTime, datetimeSerialization.datetimeFormat);
    const oracleEndTime = convertDateTimeFromInstant(endTime, datetimeSerialization.datetimeFormat);
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
