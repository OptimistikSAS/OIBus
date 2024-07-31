import { EngineSettingsCommandDTO, EngineSettingsDTO } from '../../../shared/model/engine.model';
import { generateRandomId } from '../service/utils';
import { Database } from 'better-sqlite3';

export const ENGINES_TABLE = 'engines';

const defaultEngineSettings: EngineSettingsCommandDTO = {
  name: 'OIBus',
  port: 2223,
  proxyEnabled: false,
  proxyPort: 9000,
  logParameters: {
    console: {
      level: 'silent'
    },
    file: {
      level: 'info',
      maxFileSize: 50,
      numberOfFiles: 5
    },
    database: {
      level: 'info',
      maxNumberOfLogs: 100_000
    },
    loki: {
      level: 'silent',
      interval: 60,
      address: '',
      username: '',
      password: ''
    },
    oia: {
      level: 'silent',
      interval: 10
    }
  }
};

/**
 * Repository used for engine settings
 */
export default class EngineRepository {
  constructor(private readonly database: Database) {
    this.createDefault(defaultEngineSettings);
  }

  /**
   * Retrieve engine settings
   * One line per OIBus. Each OIBus is identified by a unique ID
   * The local OIBus can retrieve its own ID from its config file
   * Other OIBus settings can be used to test several config or for other OIBus to retrieve their own settings when
   * behind a firewall
   */
  get(): EngineSettingsDTO | null {
    const query =
      'SELECT id, name, port, oibus_version AS version, proxy_enabled AS proxyEnabled, proxy_port AS proxyPort, ' +
      'log_console_level AS consoleLogLevel, ' +
      'log_file_level AS fileLogLevel, ' +
      'log_file_max_file_size AS fileLogMaxFileSize, ' +
      'log_file_number_of_files AS fileLogNumberOfFiles, ' +
      'log_database_level AS databaseLogLevel, ' +
      'log_database_max_number_of_logs AS databaseLogMaxNumberOfLogs, ' +
      'log_loki_level AS lokiLogLevel, ' +
      'log_loki_interval AS lokiLogInterval, ' +
      'log_loki_address AS lokiLogAddress, ' +
      'log_loki_username AS lokiLogUsername, ' +
      'log_loki_password AS lokiLogPassword, ' +
      'log_oia_level AS oiaLogLevel, ' +
      'log_oia_interval AS oiaLogInterval ' +
      `FROM ${ENGINES_TABLE};`;
    const results: Array<any> = this.database.prepare(query).all();

    if (results.length > 0) {
      return {
        id: results[0].id,
        name: results[0].name,
        port: results[0].port,
        version: results[0].version,
        proxyEnabled: Boolean(results[0].proxyEnabled),
        proxyPort: results[0].proxyPort,
        logParameters: {
          console: {
            level: results[0].consoleLogLevel
          },
          file: {
            level: results[0].fileLogLevel,
            maxFileSize: results[0].fileLogMaxFileSize,
            numberOfFiles: results[0].fileLogNumberOfFiles
          },
          database: {
            level: results[0].databaseLogLevel,
            maxNumberOfLogs: results[0].databaseLogMaxNumberOfLogs
          },
          loki: {
            level: results[0].lokiLogLevel,
            interval: results[0].lokiLogInterval,
            address: results[0].lokiLogAddress,
            username: results[0].lokiLogUsername,
            password: results[0].lokiLogPassword
          },
          oia: {
            level: results[0].oiaLogLevel,
            interval: results[0].oiaLogInterval
          }
        }
      };
    } else {
      return null;
    }
  }

  update(command: EngineSettingsCommandDTO): void {
    const query =
      `UPDATE ${ENGINES_TABLE} SET name = ?, port = ?, proxy_enabled = ?, proxy_port = ?, ` +
      'log_console_level = ?, ' +
      'log_file_level = ?, ' +
      'log_file_max_file_size = ?, ' +
      'log_file_number_of_files = ?, ' +
      'log_database_level = ?, ' +
      'log_database_max_number_of_logs = ?, ' +
      'log_loki_level = ?, ' +
      'log_loki_interval = ?, ' +
      'log_loki_address = ?, ' +
      'log_loki_username = ?, ' +
      'log_loki_password = ?, ' +
      'log_oia_level = ?, ' +
      'log_oia_interval = ? ' +
      `WHERE rowid=(SELECT MIN(rowid) FROM ${ENGINES_TABLE});`;

    this.database
      .prepare(query)
      .run(
        command.name,
        command.port,
        +command.proxyEnabled,
        command.proxyPort,
        command.logParameters.console.level,
        command.logParameters.file.level,
        command.logParameters.file.maxFileSize,
        command.logParameters.file.numberOfFiles,
        command.logParameters.database.level,
        command.logParameters.database.maxNumberOfLogs,
        command.logParameters.loki.level,
        command.logParameters.loki.interval,
        command.logParameters.loki.address,
        command.logParameters.loki.username,
        command.logParameters.loki.password,
        command.logParameters.oia.level,
        command.logParameters.oia.interval
      );
  }

  updateVersion(version: string): void {
    const query = `UPDATE ${ENGINES_TABLE} SET oibus_version = ? WHERE rowid=(SELECT MIN(rowid) FROM ${ENGINES_TABLE});`;

    this.database.prepare(query).run(version);
  }

  createDefault(command: EngineSettingsCommandDTO): void {
    if (this.get()) {
      return;
    }

    const query =
      `INSERT INTO ${ENGINES_TABLE} (id, name, port, proxy_enabled, proxy_port, log_console_level, ` +
      'log_file_level, log_file_max_file_size, log_file_number_of_files, log_database_level, ' +
      'log_database_max_number_of_logs, log_loki_level, log_loki_interval, log_loki_address, ' +
      'log_loki_username, log_loki_password, log_oia_level, log_oia_interval) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);';
    this.database
      .prepare(query)
      .run(
        generateRandomId(),
        command.name,
        command.port,
        +command.proxyEnabled,
        command.proxyPort,
        command.logParameters.console.level,
        command.logParameters.file.level,
        command.logParameters.file.maxFileSize,
        command.logParameters.file.numberOfFiles,
        command.logParameters.database.level,
        command.logParameters.database.maxNumberOfLogs,
        command.logParameters.loki.level,
        command.logParameters.loki.interval,
        command.logParameters.loki.address,
        command.logParameters.loki.username,
        command.logParameters.loki.password,
        command.logParameters.oia.level,
        command.logParameters.oia.interval
      );
  }
}
