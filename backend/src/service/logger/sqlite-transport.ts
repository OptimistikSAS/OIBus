import build from 'pino-abstract-transport';
import LogRepository from '../../repository/logs/log.repository';
import Database from 'better-sqlite3';
import { PinoLog } from '../../model/logs.model';

const DEFAULT_MAX_NUMBER_OF_LOGS = 2_000_000;
const BATCH_TEMPO = 700; // Store logs in the database every x ms

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
  private readonly maxNumberOfLogs;
  private readonly logsDatabase;

  constructor(private readonly options: SqliteOptions) {
    this.logsDatabase = Database(this.options.filename);
    // WAL + 2s busy timeout: this DB is opened by two threads (the main thread
    // for UI search + the logger worker for writes).
    this.logsDatabase.pragma('journal_mode = WAL');
    this.logsDatabase.pragma('busy_timeout = 2000');
    // NORMAL (vs the default FULL) drops the per-commit fsync to once per
    // checkpoint. For a logs database — append-only, append-fast, can tolerate
    // losing the last few seconds on crash — this is the recommended pairing
    // with WAL and meaningfully cuts I/O wait on the writer thread.
    this.logsDatabase.pragma('synchronous = NORMAL');
    this.repository = new LogRepository(this.logsDatabase);

    this.maxNumberOfLogs = this.options.maxNumberOfLogs || DEFAULT_MAX_NUMBER_OF_LOGS;
    try {
      this.numberOfLogs = this.repository.count();
      console.info(`${this.numberOfLogs} logs in database`);
      if (this.numberOfLogs >= this.maxNumberOfLogs) {
        this.deleteOldLogsIfDatabaseTooLarge();
      }
      // No vacuum logic here — the v3.8.0 migration switches the DB to
      // `auto_vacuum = FULL`, so SQLite reclaims free pages itself as part
      // of every transaction that frees them. No manual call needed.
    } catch (error: unknown) {
      console.error(`Error while preparing logs database: ${(error as Error).message}`);
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
        const logsToStore = this.batchLogs;
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
    const deleted = this.repository.delete(numberOfRecordToDelete);
    this.numberOfLogs -= deleted;
  };

  /**
   * Make sure the logs are stored before closing the repository
   */
  end = () => {
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
