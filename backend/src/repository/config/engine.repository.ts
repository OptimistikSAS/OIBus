import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { EngineSettings } from '../../model/engine.model';

const ENGINES_TABLE = 'engines';

const DEFAULT_ENGINE_SETTINGS: Omit<EngineSettings, 'id' | 'version'> = {
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
 * Repository used for Engine settings
 */
export default class EngineRepository {
  constructor(private readonly database: Database) {
    this.createDefault(DEFAULT_ENGINE_SETTINGS);
  }

  get(): EngineSettings | null {
    const query =
      'SELECT id, name, port, oibus_version AS version, proxy_enabled AS proxyEnabled, proxy_port AS proxyPort, ' +
      'log_console_level AS logParametersConsoleLevel, ' +
      'log_file_level AS logParametersFileLevel, ' +
      'log_file_max_file_size AS logParametersFileMaxFileSize, ' +
      'log_file_number_of_files AS logParametersFileNumberOfFiles, ' +
      'log_database_level AS logParametersDatabaseLevel, ' +
      'log_database_max_number_of_logs AS logParametersDatabaseMaxNumberOfLogs, ' +
      'log_loki_level AS logParametersLokiLevel, ' +
      'log_loki_interval AS logParametersLokiInterval, ' +
      'log_loki_address AS logParametersLokiAddress, ' +
      'log_loki_username AS logParametersLokiUsername, ' +
      'log_loki_password AS logParametersLokiPassword, ' +
      'log_oia_level AS logParametersOIALevel, ' +
      'log_oia_interval AS logParametersOIAInterval ' +
      `FROM ${ENGINES_TABLE};`;
    const results: Array<Record<string, string | number>> = this.database.prepare(query).all() as Array<Record<string, string | number>>;

    if (results.length > 0) {
      return this.toEngineSettings(results[0]);
    } else {
      return null;
    }
  }

  update(command: Omit<EngineSettings, 'id' | 'version'>): void {
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

  private createDefault(command: Omit<EngineSettings, 'id' | 'version'>): void {
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

  private toEngineSettings(result: Record<string, string | number>): EngineSettings {
    return {
      id: result.id as string,
      name: result.name as string,
      port: result.port as number,
      version: result.version as string,
      proxyEnabled: Boolean(result.proxyEnabled),
      proxyPort: result.proxyPort as number,
      logParameters: {
        console: {
          level: result.logParametersConsoleLevel as string
        },
        file: {
          level: result.logParametersFileLevel as string,
          maxFileSize: result.logParametersFileMaxFileSize as number,
          numberOfFiles: result.logParametersFileNumberOfFiles as number
        },
        database: {
          level: result.logParametersDatabaseLevel as string,
          maxNumberOfLogs: result.logParametersDatabaseMaxNumberOfLogs as number
        },

        loki: {
          level: result.logParametersLokiLevel as string,
          interval: result.logParametersLokiInterval as number,
          address: result.logParametersLokiAddress as string,
          username: result.logParametersLokiUsername as string,
          password: result.logParametersLokiPassword as string
        },
        oia: {
          level: result.logParametersOIALevel as string,
          interval: result.logParametersOIAInterval as number
        }
      }
    };
  }
}
