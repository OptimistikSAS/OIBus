import {
  EngineSettingsCommandDTO,
  EngineSettingsDTO,
} from "../model/engine.model";
import { generateRandomId } from "./utils";

const ENGINE_TABLE = "engine";

const defaultEngineSettings: EngineSettingsCommandDTO = {
  name: "OIBus",
  port: 2223,
  logParameters: {
    console: {
      level: "silent",
    },
    file: {
      level: "info",
      maxFileSize: 50,
      numberOfFiles: 5,
    },
    database: {
      level: "info",
      maxNumberOfLogs: 100_000,
    },
    loki: {
      level: "silent",
      interval: 60,
      address: "",
      tokenAddress: "",
      username: "",
      password: "",
      proxyId: null,
    },
  },
  healthSignal: {
    logging: {
      enabled: true,
      interval: 60,
    },
    http: {
      enabled: false,
      interval: 60,
      verbose: false,
      address: "",
      proxyId: null,
      authentication: {
        type: "basic",
        key: "",
        secret: "",
      },
    },
  },
};

/**
 * Repository used for engine settings
 */
export default class EngineRepository {
  private readonly database;
  constructor(database) {
    this.database = database;
    const query =
      `CREATE TABLE IF NOT EXISTS ${ENGINE_TABLE} (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, port INTEGER NOT NULL, ` +
      "log_console_level TEXT, log_file_level TEXT, log_file_max_file_size INTEGER, log_file_number_of_files INTEGER, " +
      "log_database_level TEXT, log_database_max_number_of_logs INTEGER, log_loki_level TEXT, log_loki_interval INTEGER, " +
      "log_loki_address TEXT, log_loki_token_address TEXT, log_loki_proxy_id TEXT, log_loki_username TEXT, log_loki_password TEXT, " +
      "health_signal_log_enabled INTEGER, health_signal_log_interval INTEGER, health_signal_http_enabled INTEGER, " +
      "health_signal_http_interval INTEGER, health_signal_http_verbose INTEGER, health_signal_http_address TEXT, " +
      "health_signal_http_proxy_id TEXT, health_signal_http_authentication_type TEXT, health_signal_http_authentication_key TEXT, " +
      "health_signal_http_authentication_secret TEXT, " +
      "FOREIGN KEY(log_loki_proxy_id) REFERENCES proxy(id), " +
      "FOREIGN KEY(health_signal_http_proxy_id) REFERENCES proxy(id));";
    this.database.prepare(query).run();

    this.createEngineSettings(defaultEngineSettings);
  }

  /**
   * Retrieve engine settings
   * One line per OIBus. Each OIBus is identified by a unique ID
   * The local OIBus can retrieve its own ID from its config file
   * Other OIBus settings can be used to test several config or for other OIBus to retrieve their own settings when
   * behind a firewall
   */
  getEngineSettings(): EngineSettingsDTO {
    const query =
      "SELECT id, name, port, " +
      "log_console_level AS consoleLogLevel, " +
      "log_file_level AS fileLogLevel, " +
      "log_file_max_file_size AS fileLogMaxFileSize, " +
      "log_file_number_of_files AS fileLogNumberOfFiles, " +
      "log_database_level AS databaseLogLevel, " +
      "log_database_max_number_of_logs AS databaseLogMaxNumberOfLogs, " +
      "log_loki_level AS lokiLogLevel, " +
      "log_loki_interval AS lokiLogInterval, " +
      "log_loki_address AS lokiLogAddress, " +
      "log_loki_token_address AS lokiLogTokenAddress, " +
      "log_loki_proxy_id AS lokiLogProxyId, " +
      "log_loki_username AS lokiLogUsername, " +
      "log_loki_password AS lokiLogPassword, " +
      "health_signal_log_enabled AS healthSignalLogEnabled, " +
      "health_signal_log_interval AS healthSignalLogInterval, " +
      "health_signal_http_enabled AS healthSignalHttpEnabled, " +
      "health_signal_http_interval AS healthSignalHttpInterval, " +
      "health_signal_http_verbose AS healthSignalHttpVerbose, " +
      "health_signal_http_address AS healthSignalHttpAddress, " +
      "health_signal_http_proxy_id AS healthSignalHttpProxyId, " +
      "health_signal_http_authentication_type AS healthSignalHttpAuthenticationType, " +
      "health_signal_http_authentication_key AS healthSignalHttpAuthenticationKey, " +
      "health_signal_http_authentication_secret AS healthSignalHttpAuthenticationSecret " +
      `FROM ${ENGINE_TABLE};`;
    const results = this.database.prepare(query).all();

    if (results.length > 0) {
      return {
        id: results[0].id,
        name: results[0].name,
        port: results[0].port,
        logParameters: {
          console: {
            level: results[0].consoleLogLevel,
          },
          file: {
            level: results[0].fileLogLevel,
            maxFileSize: results[0].fileLogMaxFileSize,
            numberOfFiles: results[0].fileLogNumberOfFiles,
          },
          database: {
            level: results[0].databaseLogLevel,
            maxNumberOfLogs: results[0].databaseLogMaxNumberOfLogs,
          },
          loki: {
            level: results[0].lokiLogLevel,
            interval: results[0].lokiLogInterval,
            address: results[0].lokiLogAddress,
            tokenAddress: results[0].lokiLogTokenAddress,
            proxyId: results[0].lokiLogProxyId,
            username: results[0].lokiLogUsername,
            password: results[0].lokiLogPassword,
          },
        },
        healthSignal: {
          logging: {
            enabled: results[0].healthSignalLogEnabled,
            interval: results[0].healthSignalLogInterval,
          },
          http: {
            enabled: results[0].healthSignalHttpEnabled,
            interval: results[0].healthSignalHttpInterval,
            verbose: results[0].healthSignalHttpVerbose,
            address: results[0].healthSignalHttpAddress,
            proxyId: results[0].healthSignalHttpProxyId,
            authentication: {
              type: results[0].healthSignalHttpAuthenticationType,
              key: results[0].healthSignalHttpAuthenticationKey,
              secret: results[0].healthSignalHttpAuthenticationSecret,
            },
          },
        },
      };
    } else {
      return null;
    }
  }

  /**
   * Update engine settings in the database.
   * @param {EngineSettingsCommandDTO} command - The command
   */
  updateEngineSettings(command: EngineSettingsCommandDTO): void {
    const query =
      `UPDATE ${ENGINE_TABLE} SET name = ?, port = ?, ` +
      `log_console_level = ?, ` +
      `log_file_level = ?, ` +
      `log_file_max_file_size = ?, ` +
      `log_file_number_of_files = ?, ` +
      `log_database_level = ?, ` +
      `log_database_max_number_of_logs = ?, ` +
      `log_loki_level = ?, ` +
      `log_loki_interval = ?, ` +
      `log_loki_address = ?, ` +
      `log_loki_token_address = ?, ` +
      `log_loki_proxy_id = ?, ` +
      `log_loki_username = ?, ` +
      `log_loki_password = ?, ` +
      `health_signal_log_enabled = ?, ` +
      `health_signal_log_interval = ?` +
      `health_signal_http_enabled = ?, ` +
      `health_signal_http_interval = ?, ` +
      `health_signal_http_verbose = ?, ` +
      `health_signal_http_address = ?, ` +
      `health_signal_http_proxy_id = ?, ` +
      `health_signal_http_authentication_type = ?, ` +
      `health_signal_http_authentication_key = ?, ` +
      `health_signal_http_authentication_secret = ? ` +
      `WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(
        command.name,
        command.port,
        command.logParameters.console.level,
        command.logParameters.file.level,
        command.logParameters.file.maxFileSize,
        command.logParameters.file.numberOfFiles,
        command.logParameters.database.level,
        command.logParameters.database.maxNumberOfLogs,
        command.logParameters.loki.level,
        command.logParameters.loki.interval,
        command.logParameters.loki.address,
        command.logParameters.loki.tokenAddress,
        command.logParameters.loki.proxyId,
        command.logParameters.loki.username,
        command.logParameters.loki.password,
        +command.healthSignal.logging.enabled,
        command.healthSignal.logging.interval,
        +command.healthSignal.http.enabled,
        command.healthSignal.http.interval,
        +command.healthSignal.http.verbose,
        command.healthSignal.http.address,
        command.healthSignal.http.proxyId,
        command.healthSignal.http.authentication.type,
        command.healthSignal.http.authentication.key,
        command.healthSignal.http.authentication.secret
      );
  }

  /**
   * Create engine settings in the database.
   * @param {EngineSettingsCommandDTO} command - The command
   */
  createEngineSettings(command: EngineSettingsCommandDTO): void {
    if (this.getEngineSettings()) {
      return;
    }
    const query = `INSERT INTO ${ENGINE_TABLE} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);`;
    this.database
      .prepare(query)
      .run(
        generateRandomId(),
        command.name,
        command.port,
        command.logParameters.console.level,
        command.logParameters.file.level,
        command.logParameters.file.maxFileSize,
        command.logParameters.file.numberOfFiles,
        command.logParameters.database.level,
        command.logParameters.database.maxNumberOfLogs,
        command.logParameters.loki.level,
        command.logParameters.loki.interval,
        command.logParameters.loki.address,
        command.logParameters.loki.tokenAddress,
        command.logParameters.loki.proxyId,
        command.logParameters.loki.username,
        command.logParameters.loki.password,
        +command.healthSignal.logging.enabled,
        command.healthSignal.logging.interval,
        +command.healthSignal.http.enabled,
        command.healthSignal.http.interval,
        +command.healthSignal.http.verbose,
        command.healthSignal.http.address,
        command.healthSignal.http.proxyId,
        command.healthSignal.http.authentication.type,
        command.healthSignal.http.authentication.key,
        command.healthSignal.http.authentication.secret
      );
  }
}
