import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { EngineSettings } from '../../model/engine.model';
import {
  AuthTokenDuration,
  EngineLoggerCommandDTO,
  EngineProxyCommandDTO,
  EngineSettingsCommandDTO,
  EngineWebServerCommandDTO
} from '../../../shared/model/engine.model';
import { version } from '../../../package.json';
import { LogLevel } from '../../../shared/model/logs.model';

const ENGINES_TABLE = 'engines';

const DISABLED_FORWARD = { enabled: false, url: null, username: null, password: null };

const DEFAULT_ENGINE_SETTINGS: Omit<
  EngineSettings,
  'id' | 'version' | 'launcherVersion' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'
> = {
  general: {
    name: 'OIBus'
  },
  webServer: {
    port: 2223,
    authTokenDuration: '7d'
  },
  proxyServer: {
    enabled: false,
    port: 9000,
    forward: {
      enabled: false,
      url: null,
      username: null,
      password: null
    },
    username: null,
    password: null
  },
  logger: {
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
    },
    syslog: {
      level: 'silent',
      host: '',
      port: 514,
      protocol: 'udp4'
    }
  }
};

/**
 * Repository used for Engine settings
 */
export default class EngineRepository {
  constructor(
    private readonly database: Database,
    launcherVersion: string,
    defaultPort = DEFAULT_ENGINE_SETTINGS.webServer.port,
    defaultName = DEFAULT_ENGINE_SETTINGS.general.name
  ) {
    this.createDefault(
      {
        ...DEFAULT_ENGINE_SETTINGS,
        webServer: { ...DEFAULT_ENGINE_SETTINGS.webServer, port: defaultPort },
        general: { name: defaultName }
      },
      launcherVersion
    );
  }

  get(): EngineSettings | null {
    const query =
      'SELECT id, name, port, auth_token_duration, oibus_version, oibus_launcher_version, proxy_enabled, proxy_port, ' +
      'forward_proxy_enabled, forward_proxy_url, forward_proxy_username, forward_proxy_password, proxy_username, proxy_password, ' +
      'log_console_level, log_file_level, log_file_max_file_size, log_file_number_of_files, ' +
      'log_database_level, log_database_max_number_of_logs, ' +
      'log_loki_level, log_loki_interval, log_loki_address, log_loki_username, log_loki_password, ' +
      'log_oia_level, log_oia_interval, ' +
      'log_syslog_level, log_syslog_host, log_syslog_port, log_syslog_protocol, ' +
      `created_by, updated_by, created_at, updated_at FROM ${ENGINES_TABLE};`;
    const results: Array<Record<string, string | number>> = this.database.prepare(query).all() as Array<Record<string, string | number>>;

    if (results.length > 0) {
      return this.toEngineSettings(results[0]);
    } else {
      return null;
    }
  }

  update(command: EngineSettingsCommandDTO, updatedBy: string): void {
    const query =
      `UPDATE ${ENGINES_TABLE} SET name = ?, port = ?, auth_token_duration = ?, proxy_enabled = ?, proxy_port = ?, ` +
      'forward_proxy_enabled = ?, forward_proxy_url = ?, forward_proxy_username = ?, forward_proxy_password = ?, proxy_username = ?, proxy_password = ?, ' +
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
      'log_oia_interval = ?, ' +
      'log_syslog_level = ?, ' +
      'log_syslog_host = ?, ' +
      'log_syslog_port = ?, ' +
      'log_syslog_protocol = ?, ' +
      `updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ` +
      `WHERE rowid=(SELECT MIN(rowid) FROM ${ENGINES_TABLE});`;

    this.database
      .prepare(query)
      .run(
        command.general.name,
        command.webServer.port,
        command.webServer.authTokenDuration,
        +command.proxyServer.enabled,
        command.proxyServer.port,
        +(command.proxyServer.forward ?? DISABLED_FORWARD).enabled,
        (command.proxyServer.forward ?? DISABLED_FORWARD).url,
        (command.proxyServer.forward ?? DISABLED_FORWARD).username,
        (command.proxyServer.forward ?? DISABLED_FORWARD).password,
        command.proxyServer.username,
        command.proxyServer.password,
        command.logger.console.level,
        command.logger.file.level,
        command.logger.file.maxFileSize,
        command.logger.file.numberOfFiles,
        command.logger.database.level,
        command.logger.database.maxNumberOfLogs,
        command.logger.loki.level,
        command.logger.loki.interval,
        command.logger.loki.address,
        command.logger.loki.username,
        command.logger.loki.password,
        command.logger.oia.level,
        command.logger.oia.interval,
        command.logger.syslog.level,
        command.logger.syslog.host,
        command.logger.syslog.port,
        command.logger.syslog.protocol,
        updatedBy
      );
  }

  updateName(name: string, updatedBy: string): void {
    const query =
      `UPDATE ${ENGINES_TABLE} SET name = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ` +
      `WHERE rowid=(SELECT MIN(rowid) FROM ${ENGINES_TABLE});`;
    this.database.prepare(query).run(name, updatedBy);
  }

  updateWebServer(command: EngineWebServerCommandDTO, updatedBy: string): void {
    const query =
      `UPDATE ${ENGINES_TABLE} SET port = ?, auth_token_duration = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ` +
      `WHERE rowid=(SELECT MIN(rowid) FROM ${ENGINES_TABLE});`;
    this.database.prepare(query).run(command.port, command.authTokenDuration, updatedBy);
  }

  updateProxy(command: EngineProxyCommandDTO, updatedBy: string): void {
    const query =
      `UPDATE ${ENGINES_TABLE} SET proxy_enabled = ?, proxy_port = ?, ` +
      `forward_proxy_enabled = ?, forward_proxy_url = ?, forward_proxy_username = ?, forward_proxy_password = ?, ` +
      `proxy_username = ?, proxy_password = ?, ` +
      `updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ` +
      `WHERE rowid=(SELECT MIN(rowid) FROM ${ENGINES_TABLE});`;
    this.database
      .prepare(query)
      .run(
        +command.enabled,
        command.port,
        +(command.forward ?? DISABLED_FORWARD).enabled,
        (command.forward ?? DISABLED_FORWARD).url,
        (command.forward ?? DISABLED_FORWARD).username,
        (command.forward ?? DISABLED_FORWARD).password,
        command.username,
        command.password,
        updatedBy
      );
  }

  updateLogger(command: EngineLoggerCommandDTO, updatedBy: string): void {
    const query =
      `UPDATE ${ENGINES_TABLE} SET ` +
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
      'log_oia_interval = ?, ' +
      `updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ` +
      `WHERE rowid=(SELECT MIN(rowid) FROM ${ENGINES_TABLE});`;
    this.database
      .prepare(query)
      .run(
        command.console.level,
        command.file.level,
        command.file.maxFileSize,
        command.file.numberOfFiles,
        command.database.level,
        command.database.maxNumberOfLogs,
        command.loki.level,
        command.loki.interval,
        command.loki.address,
        command.loki.username,
        command.loki.password,
        command.oia.level,
        command.oia.interval,
        updatedBy
      );
  }

  updateVersion(version: string, launcherVersion: string): void {
    const query = `UPDATE ${ENGINES_TABLE} SET oibus_version = ?, oibus_launcher_version = ? WHERE rowid=(SELECT MIN(rowid) FROM ${ENGINES_TABLE});`;
    this.database.prepare(query).run(version, launcherVersion);
  }

  protected createDefault(
    command: Omit<EngineSettings, 'id' | 'version' | 'launcherVersion' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>,
    launcherVersion: string
  ): void {
    if (this.get()) {
      return;
    }

    const query =
      `INSERT INTO ${ENGINES_TABLE} (id, name, oibus_version, oibus_launcher_version, port, auth_token_duration, proxy_enabled, proxy_port,` +
      'forward_proxy_enabled, forward_proxy_url, forward_proxy_username, forward_proxy_password, proxy_username, proxy_password, ' +
      'log_console_level, log_file_level, log_file_max_file_size, log_file_number_of_files, log_database_level, ' +
      'log_database_max_number_of_logs, log_loki_level, log_loki_interval, log_loki_address, ' +
      'log_loki_username, log_loki_password, log_oia_level, log_oia_interval, ' +
      'log_syslog_level, log_syslog_host, log_syslog_port, log_syslog_protocol, ' +
      `created_by, updated_by, created_at, updated_at) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
    this.database
      .prepare(query)
      .run(
        generateRandomId(),
        command.general.name,
        version,
        launcherVersion,
        command.webServer.port,
        command.webServer.authTokenDuration,
        +command.proxyServer.enabled,
        command.proxyServer.port,
        +command.proxyServer.forward.enabled,
        command.proxyServer.forward.url,
        command.proxyServer.forward.username,
        command.proxyServer.forward.password,
        command.proxyServer.username,
        command.proxyServer.password,
        command.logger.console.level,
        command.logger.file.level,
        command.logger.file.maxFileSize,
        command.logger.file.numberOfFiles,
        command.logger.database.level,
        command.logger.database.maxNumberOfLogs,
        command.logger.loki.level,
        command.logger.loki.interval,
        command.logger.loki.address,
        command.logger.loki.username,
        command.logger.loki.password,
        command.logger.oia.level,
        command.logger.oia.interval,
        command.logger.syslog.level,
        command.logger.syslog.host,
        command.logger.syslog.port,
        command.logger.syslog.protocol,
        'system',
        'system'
      );
  }

  private toEngineSettings(result: Record<string, string | number>): EngineSettings {
    return {
      id: result.id as string,
      version: result.oibus_version as string,
      launcherVersion: result.oibus_launcher_version as string,
      general: {
        name: result.name as string
      },
      webServer: {
        port: result.port as number,
        authTokenDuration: result.auth_token_duration as AuthTokenDuration
      },
      proxyServer: {
        enabled: Boolean(result.proxy_enabled),
        port: result.proxy_port as number,
        forward: {
          enabled: Boolean(result.forward_proxy_enabled),
          url: (result.forward_proxy_url as string) || null,
          username: (result.forward_proxy_username as string) || null,
          password: (result.forward_proxy_password as string) || null
        },
        username: (result.proxy_username as string) || null,
        password: (result.proxy_password as string) || null
      },
      createdBy: result.created_by as string,
      updatedBy: result.updated_by as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string,
      logger: {
        console: {
          level: result.log_console_level as LogLevel
        },
        file: {
          level: result.log_file_level as LogLevel,
          maxFileSize: result.log_file_max_file_size as number,
          numberOfFiles: result.log_file_number_of_files as number
        },
        database: {
          level: result.log_database_level as LogLevel,
          maxNumberOfLogs: result.log_database_max_number_of_logs as number
        },
        loki: {
          level: result.log_loki_level as LogLevel,
          interval: result.log_loki_interval as number,
          address: result.log_loki_address as string,
          username: result.log_loki_username as string,
          password: result.log_loki_password as string
        },
        oia: {
          level: result.log_oia_level as LogLevel,
          interval: result.log_oia_interval as number
        },
        syslog: {
          level: result.log_syslog_level as LogLevel,
          host: result.log_syslog_host as string,
          port: result.log_syslog_port as number,
          protocol: result.log_syslog_protocol as 'udp4' | 'tcp'
        }
      }
    };
  }
}
