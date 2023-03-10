import build from 'pino-abstract-transport';
import db, { Database } from 'better-sqlite3';

import { LogLevel } from '../../../../shared/model/engine.model';

const LOGS_TABLE_NAME = 'logs';
const DEFAULT_MAX_NUMBER_OF_LOGS = 2000000;
const CLEAN_UP_INTERVAL = 24 * 3600 * 1000; // One day
const BATCH_TEMPO = 700; // Store logs in database every x ms

const LEVEL_FORMAT: { [key: string]: LogLevel } = {
  '10': 'trace',
  '20': 'debug',
  '30': 'info',
  '40': 'warn',
  '50': 'error',
  '60': 'fatal'
};

interface SqliteOptions {
  filename: string;
  table: string;
  interval: number;
  maxNumberOfLogs: number;
}

interface PinoLog {
  msg: string;
  scope: string;
  time: number;
  level: string;
}

/**
 * Class to support logging to sqlite as a custom Pino Transport module
 */
class SqliteTransport {
  private readonly options: SqliteOptions;
  private readonly database: Database;
  private readonly removeOldLogsTimeout: NodeJS.Timeout;
  private readonly storeLogsInterval: NodeJS.Timeout;
  batchLogs: Array<PinoLog> = [];

  constructor(options: SqliteOptions) {
    this.options = options;
    this.database = db(this.options.filename || ':memory:');
    this.createLogsDatabase();
    this.removeOldLogsTimeout = setInterval(this.deleteOldLogsIfDatabaseTooLarge.bind(this), CLEAN_UP_INTERVAL);
    this.storeLogsInterval = setInterval(this.addLogs.bind(this), BATCH_TEMPO);
  }

  addLogs = (): void => {
    try {
      if (this.batchLogs.length === 0) {
        return;
      }
      const logsToStore = this.batchLogs;
      this.batchLogs = [];

      // Create a single query to store many logs at once
      let valueClause = 'VALUES ';
      const params: Array<string | number> = [];
      logsToStore.forEach(log => {
        valueClause += ' (?,?,?,?),';
        params.push(log.time, LEVEL_FORMAT[log.level], log.scope, log.msg);
      });

      // Remove last string char ","
      const query = `INSERT INTO ${this.options.table || LOGS_TABLE_NAME} (timestamp, level, scope, message) ${valueClause.slice(0, -1)};`;
      this.database.prepare(query).run(...params);
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Core logging method.
   */
  log = (payload: PinoLog): void => {
    this.batchLogs.push(payload);
  };

  /**
   * Count the number of logs stored in the database
   */
  countLogs = (): number => {
    const query = `SELECT COUNT(*) AS count FROM ${this.options.table || LOGS_TABLE_NAME}`;
    const result = this.database.prepare(query).get();
    return result.count;
  };

  /**
   * Delete old logs.
   */
  deleteOldLogsIfDatabaseTooLarge = (): void => {
    const numberOfLogs = this.countLogs();
    if (numberOfLogs > (this.options.maxNumberOfLogs || DEFAULT_MAX_NUMBER_OF_LOGS)) {
      const query =
        `DELETE FROM ${this.options.table || LOGS_TABLE_NAME} WHERE id IN (` +
        `SELECT id FROM ${this.options.table || LOGS_TABLE_NAME} ORDER BY id LIMIT ?);`;
      // Remove the excess of logs and one tenth of the max allowed size
      const numberOfRecordToDelete =
        numberOfLogs -
        (this.options.maxNumberOfLogs || DEFAULT_MAX_NUMBER_OF_LOGS) +
        (this.options.maxNumberOfLogs || DEFAULT_MAX_NUMBER_OF_LOGS) / 10;
      this.database.prepare(query).run(numberOfRecordToDelete);
    }
  };

  /**
   * Initiate database and create the logs table.
   */
  createLogsDatabase = (): void => {
    const query =
      `CREATE TABLE IF NOT EXISTS ${this.options.table || LOGS_TABLE_NAME} (id INTEGER PRIMARY KEY, ` +
      `timestamp TEXT, level TEXT, scope TEXT, message TEXT);`;
    this.database.prepare(query).run();
    this.deleteOldLogsIfDatabaseTooLarge();
  };

  /**
   * Make sure the requests are done before closing the database
   */
  end = async () => {
    clearInterval(this.removeOldLogsTimeout);
    clearInterval(this.storeLogsInterval);

    await this.addLogs();

    this.database.close();
  };
}

const createTransport = (opts: SqliteOptions) => {
  const sqliteTransport = new SqliteTransport(opts);
  return build(
    async source => {
      for await (const log of source) {
        sqliteTransport.log(log);
      }
    },
    {
      close: async () => {
        await sqliteTransport.end();
      }
    }
  );
};

export default createTransport;
