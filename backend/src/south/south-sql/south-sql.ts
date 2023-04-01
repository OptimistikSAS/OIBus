import fs from 'node:fs/promises';
import path from 'node:path';

import db from 'better-sqlite3';
import mssql, { config } from 'mssql';
import mysql from 'mysql2/promise';
import * as pg from 'pg';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { generateCSV, generateReplacementParameters, getMostRecentDate } from './utils';
import { compress, createFolder, replaceFilenameWithVariable } from '../../service/utils';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';

let oracledb: {
  outFormat: any;
  OUT_FORMAT_OBJECT: any;
  getConnection: (arg0: { user: any; password: string; connectString: string }) => any;
};
/**
 * Class SouthSQL - Retrieve data from SQL databases and send them to the cache as CSV files.
 * Available drivers are :
 * - MSSQL
 * - MySQL / MariaDB
 * - Oracle
 * - PostgreSQL
 * - SQLite
 */
export default class SouthSQL extends SouthConnector {
  static category = manifest.category;

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
      streamMode,
      manifest
    );
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(): Promise<void> {
    try {
      // eslint-disable-next-line global-require,import/no-unresolved,import/no-extraneous-dependencies
      oracledb = require('oracledb');
    } catch {
      this.logger.warn('Could not load node oracledb');
    }

    await createFolder(this.tmpFolder);
    await super.start();
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   */
  override async historyQuery(items: Array<OibusItemDTO>, startTime: Instant, endTime: Instant): Promise<Instant> {
    let updatedStartTime = startTime;

    for (const item of items) {
      this.logQuery(item.settings.query, updatedStartTime, endTime);

      let result: Array<any>;
      switch (this.configuration.settings.driver) {
        case 'mssql':
          result = await this.getDataFromMSSQL(item, updatedStartTime, endTime);
          break;
        case 'mysql':
          result = await this.getDataFromMySQL(item, updatedStartTime, endTime);
          break;
        case 'postgresql':
          result = await this.getDataFromPostgreSQL(item, updatedStartTime, endTime);
          break;
        case 'oracle':
          result = await this.getDataFromOracle(item, updatedStartTime, endTime);
          break;
        case 'sqlite':
          result = await this.getDataFromSqlite(item, updatedStartTime, endTime);
          break;
        default:
          throw new Error(`SQL driver "${this.configuration.settings.driver}" not supported for South "${this.configuration.name}"`);
      }
      this.logger.info(`Found ${result.length} results`);

      if (result.length > 0) {
        const csvContent = generateCSV(
          result,
          this.configuration.settings.timezone,
          item.settings.dateFormat,
          this.configuration.settings.settings.delimiter
        );
        const filename = replaceFilenameWithVariable(item.settings.filename, 0, this.configuration.name);
        const filePath = path.join(this.tmpFolder, filename);

        this.logger.debug(`Writing CSV file at "${filePath}".`);
        await fs.writeFile(filePath, csvContent);

        if (this.configuration.settings.compression) {
          // Compress and send the compressed file
          const gzipPath = `${filePath}.gz`;
          await compress(filePath, gzipPath);

          try {
            await fs.unlink(filePath);
            this.logger.info(`File "${filePath}" compressed and deleted.`);
          } catch (unlinkError) {
            this.logger.error(unlinkError);
          }

          this.logger.debug(`Sending compressed file "${gzipPath}" to Engine.`);
          await this.addFile(gzipPath);
          try {
            await fs.unlink(gzipPath);
            this.logger.trace(`File ${gzipPath} deleted`);
          } catch (unlinkError) {
            this.logger.error(unlinkError);
          }
        } else {
          this.logger.debug(`Sending file "${filePath}" to Engine.`);
          await this.addFile(filePath);
          try {
            await fs.unlink(filePath);
            this.logger.trace(`File ${filePath} deleted`);
          } catch (unlinkError) {
            this.logger.error(unlinkError);
          }
        }

        updatedStartTime = getMostRecentDate(result, updatedStartTime, item.settings.timeColumn, this.configuration.settings.timezone);
      } else {
        this.logger.debug(`No result found between ${startTime} and ${endTime}`);
      }
    }
    return updatedStartTime;
  }

  /**
   * Apply the SQL query to the target MSSQL database
   */
  async getDataFromMSSQL(item: OibusItemDTO, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const adaptedQuery = item.settings.query;

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
        trustServerCertificate: true
      }
    };
    // domain is optional and allow to activate the ntlm authentication on Windows
    if (this.configuration.settings.domain) config.domain = this.configuration.settings.domain;

    const pool = await new mssql.ConnectionPool(config).connect();
    const request = pool.request();
    if (item.settings.query.indexOf('@StartTime') !== -1) {
      request.input('StartTime', mssql.DateTimeOffset, startTime);
    }
    if (item.settings.query.indexOf('@EndTime') !== -1) {
      request.input('EndTime', mssql.DateTimeOffset, endTime);
    }
    const result = await request.query(adaptedQuery);
    // @ts-ignore
    const [first] = result.recordsets;
    await pool.close();

    return first;
  }

  /**
   * Apply the SQL query to the target MySQL / MariaDB database
   */
  async getDataFromMySQL(item: OibusItemDTO, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?');

    const config = {
      host: this.configuration.settings.host,
      port: this.configuration.settings.port,
      user: this.configuration.settings.username,
      password: await this.encryptionService.decryptText(this.configuration.settings.password),
      database: this.configuration.settings.database,
      connectTimeout: this.configuration.settings.connectionTimeout,
      timezone: 'Z'
    };

    let connection = null;
    let data: Array<any> = [];
    try {
      connection = await mysql.createConnection(config);

      const params = generateReplacementParameters(item.settings.query, startTime, endTime);
      const [rows] = await connection.execute(
        {
          sql: adaptedQuery,
          timeout: this.configuration.settings.requestTimeout
        },
        params
      );
      // @ts-ignore
      data = rows;
    } catch (error) {
      if (connection) {
        await connection.end();
      }
      throw error;
    }
    if (connection) {
      await connection.end();
    }

    return data;
  }

  /**
   * Apply the SQL query to the target PostgreSQL database
   */
  async getDataFromPostgreSQL(item: OibusItemDTO, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    const adaptedQuery = item.settings.query.replace(/@StartTime/g, '$1').replace(/@EndTime/g, '$2');

    const config = {
      host: this.configuration.settings.host,
      port: this.configuration.settings.port,
      user: this.configuration.settings.username,
      password: await this.encryptionService.decryptText(this.configuration.settings.password),
      database: this.configuration.settings.database,
      query_timeout: this.configuration.settings.requestTimeout
    };

    pg.types.setTypeParser(1114, str => new Date(`${str}Z`));
    const connection = new pg.Client(config);
    let data = [];
    try {
      await connection.connect();
      const params = generateReplacementParameters(item.settings.query, startTime, endTime);
      const { rows } = await connection.query(adaptedQuery, params);
      data = rows;
    } catch (error) {
      await connection.end();
      throw error;
    }
    if (connection) {
      await connection.end();
    }

    return data;
  }

  /**
   * Apply the SQL query to the target Oracle database
   */
  async getDataFromOracle(item: OibusItemDTO, startTime: Instant, endTime: Instant): Promise<Array<any>> {
    if (!oracledb) {
      throw new Error('oracledb library not loaded');
    }

    const adaptedQuery = item.settings.query.replace(/@StartTime/g, ':date1').replace(/@EndTime/g, ':date2');

    const config = {
      user: this.configuration.settings.username,
      password: await this.encryptionService.decryptText(this.configuration.settings.password),
      connectString: `${this.configuration.settings.host}:${this.configuration.settings.port}/${this.configuration.settings.database}`
    };

    let connection = null;
    let data = [];
    try {
      process.env.ORA_SDTZ = 'UTC';
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      connection = await oracledb.getConnection(config);
      connection.callTimeout = this.configuration.settings.requestTimeout;
      const params = generateReplacementParameters(item.settings.query, startTime, endTime);
      const { rows } = await connection.execute(adaptedQuery, params);
      data = rows;
    } catch (error) {
      if (connection) {
        await connection.close();
      }
      throw error;
    }
    if (connection) {
      await connection.close();
    }

    return data;
  }

  /**
   * Apply the SQL query to the target SQLite database
   */
  async getDataFromSqlite(item: OibusItemDTO, startTime: Instant, endTime: Instant) {
    const adaptedQuery = item.settings.query;

    let database = null;
    let data = [];
    try {
      database = db(this.configuration.settings.databasePath);
      const stmt = database.prepare(adaptedQuery);
      const preparedParameters: Record<string, number> = {};
      if (item.settings.query.indexOf('@StartTime') !== -1) {
        preparedParameters.StartTime = DateTime.fromISO(startTime).toMillis();
      }
      if (item.settings.query.indexOf('@EndTime') !== -1) {
        preparedParameters.EndTime = DateTime.fromISO(endTime).toMillis();
      }

      data = stmt.all(preparedParameters);
    } catch (error) {
      if (database) {
        database.close();
      }
      throw error;
    }
    if (database) {
      database.close();
    }
    return data;
  }

  /**
   * Log the executed query with replacements values for query variables
   */
  logQuery(query: string, startTime: Instant, endTime: Instant): void {
    const startTimeLog = query.indexOf('@StartTime') !== -1 ? `StartTime = ${startTime}` : '';
    const endTimeLog = query.indexOf('@EndTime') !== -1 ? `EndTime = ${endTime}` : '';
    this.logger.info(`Executing "${query}" with ${startTimeLog} ${endTimeLog}`);
  }
}
