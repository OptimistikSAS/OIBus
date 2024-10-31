import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { EngineSettings } from '../../model/engine.model';
import { version } from '../../../package.json';

const ENGINES_TABLE = 'engines';

const DEFAULT_ENGINE_SETTINGS: Omit<EngineSettings, 'id' | 'version' | 'launcherVersion'> = {
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
  constructor(
    private readonly database: Database,
    launcherVersion: string
  ) {
    this.createDefault(DEFAULT_ENGINE_SETTINGS, launcherVersion);
  }

  get(): EngineSettings | null {
    const query =
      'SELECT id, name, port, oibus_version, oibus_launcher_version, proxy_enabled, proxy_port, ' +
      'log_console_level, log_file_level, log_file_max_file_size, log_file_number_of_files, ' +
      'log_database_level, log_database_max_number_of_logs, ' +
      'log_loki_level, log_loki_interval, log_loki_address, log_loki_username, log_loki_password, ' +
      `log_oia_level, log_oia_interval FROM ${ENGINES_TABLE};`;
    const results: Array<Record<string, string | number>> = this.database.prepare(query).all() as Array<Record<string, string | number>>;

    if (results.length > 0) {
      return this.toEngineSettings(results[0]);
    } else {
      return null;
    }
  }

  update(command: Omit<EngineSettings, 'id' | 'version' | 'launcherVersion'>): void {
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

  updateLauncherVersion(version: string): void {
    const query = `UPDATE ${ENGINES_TABLE} SET oibus_launcher_version = ? WHERE rowid=(SELECT MIN(rowid) FROM ${ENGINES_TABLE});`;
    this.database.prepare(query).run(version);
  }

  private createDefault(command: Omit<EngineSettings, 'id' | 'version' | 'launcherVersion'>, launcherVersion: string): void {
    if (this.get()) {
      return;
    }

    const query =
      `INSERT INTO ${ENGINES_TABLE} (id, name, oibus_version, oibus_launcher_version, port, proxy_enabled, proxy_port,` +
      'log_console_level, log_file_level, log_file_max_file_size, log_file_number_of_files, log_database_level, ' +
      'log_database_max_number_of_logs, log_loki_level, log_loki_interval, log_loki_address, ' +
      'log_loki_username, log_loki_password, log_oia_level, log_oia_interval) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);';
    this.database
      .prepare(query)
      .run(
        generateRandomId(),
        command.name,
        version,
        launcherVersion,
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
      version: result.oibus_version as string,
      launcherVersion: result.oibus_launcher_version as string,
      proxyEnabled: Boolean(result.proxy_enabled),
      proxyPort: result.proxy_port as number,
      logParameters: {
        console: {
          level: result.log_console_level as string
        },
        file: {
          level: result.log_file_level as string,
          maxFileSize: result.log_file_max_file_size as number,
          numberOfFiles: result.log_file_number_of_files as number
        },
        database: {
          level: result.log_database_level as string,
          maxNumberOfLogs: result.log_database_max_number_of_logs as number
        },

        loki: {
          level: result.log_loki_level as string,
          interval: result.log_loki_interval as number,
          address: result.log_loki_address as string,
          username: result.log_loki_username as string,
          password: result.log_loki_password as string
        },
        oia: {
          level: result.log_oia_level as string,
          interval: result.log_oia_interval as number
        }
      }
    };
  }
}
