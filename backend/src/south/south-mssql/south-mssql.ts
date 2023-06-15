import path from 'node:path';
import mssql, { config } from 'mssql';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { createFolder, getMaxInstant, logQuery, serializeResults } from '../../service/utils';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { DateTimeSerialization, Instant, Serialization } from '../../../../shared/model/types';
import { QueriesHistory, TestsConnection } from '../south-interface';
import { DateTime } from 'luxon';

/**
 * Class SouthMSSQL - Retrieve data from MSSQL databases and send them to the cache as CSV files.
 */
export default class SouthMSSQL extends SouthConnector implements QueriesHistory, TestsConnection {
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
      const result: Array<any> = await this.getDataFromMSSQL(item, updatedStartTime, endTime);
      const requestDuration = DateTime.now().toMillis() - startRequest;

      if (result.length > 0) {
        this.logger.info(`Found ${result.length} results for item ${item.name} in ${requestDuration} ms`);
        updatedStartTime = getMaxInstant(result, updatedStartTime, item.settings.serialization.datetimeSerialization);
        await serializeResults(
          result,
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
   * Apply the SQL query to the target MSSQL database
   */
  async getDataFromMSSQL(item: OibusItemDTO, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const config: config = {
      user: this.configuration.settings.username,
      password: this.configuration.settings.password ? await this.encryptionService.decryptText(this.configuration.settings.password) : '',
      server: this.configuration.settings.host,
      port: this.configuration.settings.port,
      database: this.configuration.settings.database,
      connectionTimeout: this.configuration.settings.connectionTimeout,
      requestTimeout: this.configuration.settings.requestTimeout,
      options: {
        encrypt: this.configuration.settings.encryption,
        trustServerCertificate: this.configuration.settings.trustServerCertificate
      }
    };
    // domain is optional and allow to activate the ntlm authentication on Windows
    if (this.configuration.settings.domain) {
      config.domain = this.configuration.settings.domain;
    }

    const datetimeSerialization = item.settings.serialization.datetimeSerialization.find(
      (serialization: DateTimeSerialization) => serialization.useAsReference
    );
    const mssqlStartTime = this.formatDatetimeVariables(startTime, datetimeSerialization);
    const mssqlEndTime = this.formatDatetimeVariables(endTime, datetimeSerialization);
    logQuery(item.settings.query, mssqlStartTime.datetime, mssqlEndTime.datetime, this.logger);

    const pool = await new mssql.ConnectionPool(config).connect();
    const request = pool.request();
    if (item.settings.query.indexOf('@StartTime') !== -1) {
      request.input('StartTime', mssqlStartTime.mssqlType, mssqlStartTime.datetime);
    }
    if (item.settings.query.indexOf('@EndTime') !== -1) {
      request.input('EndTime', mssqlEndTime.mssqlType, mssqlEndTime.datetime);
    }
    try {
      const result = await request.query(item.settings.query);
      const [first] = result.recordsets as Array<any>;
      await pool.close();
      return first;
    } catch (error) {
      await pool.close();
      throw error;
    }
  }

  formatDatetimeVariables = (
    datetime: Instant,
    serialization: DateTimeSerialization | null
  ): { datetime: string | number | DateTime; mssqlType: any } => {
    if (!serialization) {
      return { datetime, mssqlType: mssql.TYPES.VarChar };
    }

    switch (serialization.datetimeFormat.type) {
      case 'unix-epoch':
        return { datetime: Math.floor(DateTime.fromISO(datetime).toMillis() / 1000), mssqlType: mssql.TYPES.BigInt };
      case 'unix-epoch-ms':
        return { datetime: DateTime.fromISO(datetime).toMillis(), mssqlType: mssql.TYPES.BigInt };
      case 'specific-string':
        return {
          datetime: DateTime.fromISO(datetime, { zone: serialization.datetimeFormat.timezone }).toFormat(
            serialization.datetimeFormat.format,
            {
              locale: serialization.datetimeFormat.locale
            }
          ),
          mssqlType: mssql.TYPES.VarChar
        };
      case 'iso-8601-string':
        return { datetime, mssqlType: mssql.TYPES.VarChar };
      case 'date-object':
        switch (serialization.datetimeFormat.dateObjectType) {
          case 'Date':
            return { datetime: DateTime.fromISO(datetime), mssqlType: mssql.TYPES.Date };
          case 'DateTime2':
            return { datetime: DateTime.fromISO(datetime), mssqlType: mssql.TYPES.DateTime2 };
          case 'DateTimeOffset':
            return { datetime: DateTime.fromISO(datetime), mssqlType: mssql.TYPES.DateTimeOffset };
          case 'SmallDateTime':
            return { datetime: DateTime.fromISO(datetime), mssqlType: mssql.TYPES.SmallDateTime };
          case 'DateTime':
          default:
            return { datetime: DateTime.fromISO(datetime), mssqlType: mssql.TYPES.DateTime };
        }
    }
  };
}
