import build from 'pino-abstract-transport';
import LogRepository from '../../repository/logs/log.repository';
import db from 'better-sqlite3';
import { PinoLog } from '../../../../shared/model/logs.model';

const DEFAULT_MAX_NUMBER_OF_LOGS = 2000000;
const CLEAN_UP_INTERVAL = 24 * 3600 * 1000; // One day
const BATCH_TEMPO = 700; // Store logs in database every x ms

interface SqliteOptions {
  filename: string;
  maxNumberOfLogs: number;
}

/**
 * Class to support logging to sqlite as a custom Pino Transport module
 */
class SqliteTransport {
  private readonly repository: LogRepository;
  private readonly removeOldLogsTimeout: NodeJS.Timeout;
  private readonly storeLogsInterval: NodeJS.Timeout;
  batchLogs: Array<PinoLog> = [];

  constructor(private readonly options: SqliteOptions) {
    const database = db(this.options.filename);
    this.repository = new LogRepository(database);
    this.deleteOldLogsIfDatabaseTooLarge();
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
      this.repository.saveAll(logsToStore);
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
   * Delete old logs.
   */
  deleteOldLogsIfDatabaseTooLarge = (): void => {
    const numberOfLogs = this.repository.count();
    const maxNumberOfLogs = this.options.maxNumberOfLogs || DEFAULT_MAX_NUMBER_OF_LOGS;
    if (numberOfLogs > maxNumberOfLogs) {
      // Remove the excess of logs and one tenth of the max allowed size
      const numberOfRecordToDelete = numberOfLogs - maxNumberOfLogs + maxNumberOfLogs / 10;
      this.repository.delete(numberOfRecordToDelete);
    }
  };

  /**
   * Make sure the requests are done before closing the repository
   */
  end = async () => {
    clearInterval(this.removeOldLogsTimeout);
    clearInterval(this.storeLogsInterval);

    await this.addLogs();
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
