import build from 'pino-abstract-transport';
import LogRepository from '../../repository/logs/log.repository';
import Database from 'better-sqlite3';
import { PinoLog } from '../../../shared/model/logs.model';

const DEFAULT_MAX_NUMBER_OF_LOGS = 2_000_000;
const BATCH_TEMPO = 700; // Store logs in the database every x ms
const VACUUM_THRESHOLD = 10; // After 10 deletions, run VACUUM

interface SqliteOptions {
  filename: string;
  maxNumberOfLogs: number;
}

/**
 * Class to support logging to sqlite as a custom Pino Transport module
 */
class SqliteTransport {
  private readonly repository: LogRepository;
  private storeLogsInterval: NodeJS.Timeout | null = null;
  private batchLogs: Array<PinoLog> = [];
  private numberOfLogs = 0;
  private numberOfDeletion = 0;
  private readonly maxNumberOfLogs;
  private readonly logsDatabase;

  constructor(private readonly options: SqliteOptions) {
    this.logsDatabase = Database(this.options.filename);
    // Enable WAL mode and set busy timeout because this database is used in two separates threads (main thread and logger)
    this.logsDatabase.pragma('journal_mode = WAL');
    this.logsDatabase.pragma('busy_timeout = 2000');
    this.repository = new LogRepository(this.logsDatabase);

    this.maxNumberOfLogs = this.options.maxNumberOfLogs || DEFAULT_MAX_NUMBER_OF_LOGS;
    try {
      this.numberOfLogs = this.repository.count();
      console.info(`${this.numberOfLogs} logs in database`);
      this.repository.vacuum();
    } catch (error: unknown) {
      console.error(`Error while vacuuming logs: ${(error as Error).message}`);
    }
    this.storeLogsInterval = setTimeout(this.writeLogs.bind(this), BATCH_TEMPO);
  }

  writeLogs = (ending = false): void => {
    if (this.storeLogsInterval) {
      clearTimeout(this.storeLogsInterval);
      this.storeLogsInterval = null;
    }
    try {
      if (this.batchLogs.length > 0) {
        const logsToStore = Array.from(this.batchLogs);
        this.batchLogs = [];
        this.repository.saveAll(logsToStore);
        this.numberOfLogs += logsToStore.length;
        if (this.numberOfLogs >= this.maxNumberOfLogs) {
          this.deleteOldLogsIfDatabaseTooLarge();
        }
      }
    } catch (error: unknown) {
      console.error(`Error while writing logs: ${(error as Error).message}`);
    }
    if (!ending) {
      this.storeLogsInterval = setTimeout(this.writeLogs.bind(this), BATCH_TEMPO);
    }
  };

  log = (payload: PinoLog): void => {
    this.batchLogs.push(payload);
  };

  deleteOldLogsIfDatabaseTooLarge = (): void => {
    // Remove the excess of logs and one fifth of the max allowed size
    const numberOfRecordToDelete = this.numberOfLogs - this.maxNumberOfLogs + this.maxNumberOfLogs / 5;
    console.info(`Removing ${numberOfRecordToDelete} rows from logs table`);
    this.repository.delete(numberOfRecordToDelete);
    this.numberOfDeletion += 1;
    // Do not vacuum every time to reduce workload
    if (this.numberOfDeletion >= VACUUM_THRESHOLD) {
      console.info('Running vacuum on logs database');
      this.repository.vacuum();
      this.numberOfDeletion = 0;
    }
    this.numberOfLogs = this.repository.count();
  };

  /**
   * Make sure the logs are stored before closing the repository
   */
  end = async () => {
    this.writeLogs(true);
    this.logsDatabase.close();
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
