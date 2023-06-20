import path from 'node:path';
import * as pg from 'pg';
import { ClientConfig } from 'pg';

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
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { DateTimeField, Instant, Serialization } from '../../../../shared/model/types';
import { QueriesHistory, TestsConnection } from '../south-interface';
import { DateTime } from 'luxon';

/**
 * Class SouthPostgreSQL - Retrieve data from PostgreSQL databases and send them to the cache as CSV files.
 */
export default class SouthPostgreSQL extends SouthConnector implements QueriesHistory, TestsConnection {
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
  static async testConnection(
    settings: SouthConnectorDTO['settings'],
    logger: pino.Logger,
    _encryptionService: EncryptionService
  ): Promise<void> {
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
            const datetimeField: DateTimeField = item.settings.dateTimeFields.find((element: DateTimeField) => element.field === key);
            if (!datetimeField) {
              formattedEntry[key] = value;
            } else {
              const entryDate = convertDateTimeToInstant(value, datetimeField.datetimeFormat);
              if (datetimeField.useAsReference) {
                if (entryDate > updatedStartTime) {
                  updatedStartTime = entryDate;
                }
              }
              formattedEntry[key] = formatInstant(entryDate, {
                type: 'specific-string',
                format: item.settings.serialization.outputDateTimeFormat,
                timezone: item.settings.serialization.timezone,
                locale: 'en-En'
              });
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
   * Apply the SQL query to the target PostgreSQL database
   */
  async queryData(item: OibusItemDTO, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, '$1').replace(/@EndTime/g, '$2');

    const config: ClientConfig = {
      host: this.configuration.settings.host,
      port: this.configuration.settings.port,
      user: this.configuration.settings.username,
      password: this.configuration.settings.password ? await this.encryptionService.decryptText(this.configuration.settings.password) : '',
      database: this.configuration.settings.database,
      query_timeout: this.configuration.settings.requestTimeout,
      connectionTimeoutMillis: this.configuration.settings.connectionTimeout
    };

    const datetimeSerialization = item.settings.dateTimeFields.find((serialization: DateTimeField) => serialization.useAsReference);
    const postgresqlStartTime = formatInstant(startTime, datetimeSerialization.datetimeFormat);
    const postgresqlEndTime = formatInstant(endTime, datetimeSerialization.datetimeFormat);
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
