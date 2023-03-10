import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { generateRandomId } from '../service/utils';
import EngineRepository from './engine.repository';
import { EngineSettingsCommandDTO, EngineSettingsDTO } from '../../shared/model/engine.model';
import { Database } from 'better-sqlite3';

jest.mock('node:crypto', () => ({
  randomBytes: () => {
    return Buffer.from('0123456789abcdef');
  }
}));
jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: EngineRepository;
describe('Empty engine repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    all.mockReturnValue([]);
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new EngineRepository(database);
  });

  it('should properly init engine settings table', () => {
    expect(database.prepare).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS engine (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, port INTEGER NOT NULL, ' +
        'log_console_level TEXT, log_file_level TEXT, log_file_max_file_size INTEGER, log_file_number_of_files INTEGER, ' +
        'log_database_level TEXT, log_database_max_number_of_logs INTEGER, log_loki_level TEXT, log_loki_interval INTEGER, ' +
        'log_loki_address TEXT, log_loki_token_address TEXT, log_loki_proxy_id TEXT, log_loki_username TEXT, ' +
        'log_loki_password TEXT, health_signal_log_enabled INTEGER, health_signal_log_interval INTEGER, ' +
        'health_signal_http_enabled INTEGER, health_signal_http_interval INTEGER, health_signal_http_verbose INTEGER, ' +
        'health_signal_http_address TEXT, health_signal_http_proxy_id TEXT, health_signal_http_authentication TEXT, crypto_settings TEXT, ' +
        'FOREIGN KEY(log_loki_proxy_id) REFERENCES proxy(id), FOREIGN KEY(health_signal_http_proxy_id) REFERENCES proxy(id));'
    );

    const command: EngineSettingsCommandDTO = {
      name: 'OIBus',
      port: 2223,
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
          tokenAddress: '',
          username: '',
          password: '',
          proxyId: null
        }
      },
      healthSignal: {
        logging: {
          enabled: true,
          interval: 60
        },
        http: {
          enabled: false,
          interval: 60,
          verbose: false,
          address: '',
          proxyId: null,
          authentication: {
            type: 'basic',
            username: '',
            password: ''
          }
        }
      }
    };

    const cryptoSettings = {
      algorithm: 'aes-256-cbc',
      initVector: Buffer.from('0123456789abcdef').toString('base64'),
      securityKey: Buffer.from('0123456789abcdef').toString('base64')
    };
    repository.createEngineSettings(command);
    expect(generateRandomId).toHaveBeenCalledWith();
    expect(database.prepare).toHaveBeenCalledWith('INSERT INTO engine VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);');
    expect(run).toHaveBeenCalledWith(
      '123456',
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
      Buffer.from(JSON.stringify(command.healthSignal.http.authentication)).toString('base64'),
      Buffer.from(JSON.stringify(cryptoSettings)).toString('base64')
    );

    expect(run).toHaveBeenCalledTimes(3);
  });

  it('should update engine settings', () => {
    const command: EngineSettingsCommandDTO = {
      name: 'OIBus',
      port: 2223,
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
          tokenAddress: '',
          username: '',
          password: '',
          proxyId: ''
        }
      },
      healthSignal: {
        logging: {
          enabled: true,
          interval: 60
        },
        http: {
          enabled: false,
          interval: 60,
          verbose: false,
          address: '',
          proxyId: null,
          authentication: {
            type: 'none'
          }
        }
      }
    };
    repository.updateEngineSettings(command);
    expect(database.prepare).toHaveBeenCalledWith(
      'UPDATE engine SET name = ?, port = ?, log_console_level = ?, log_file_level = ?, log_file_max_file_size = ?, ' +
        'log_file_number_of_files = ?, log_database_level = ?, log_database_max_number_of_logs = ?, log_loki_level = ?, ' +
        'log_loki_interval = ?, log_loki_address = ?, log_loki_token_address = ?, log_loki_proxy_id = ?, log_loki_username = ?, ' +
        'log_loki_password = ?, health_signal_log_enabled = ?, health_signal_log_interval = ?, health_signal_http_enabled = ?, ' +
        'health_signal_http_interval = ?, health_signal_http_verbose = ?, health_signal_http_address = ?, ' +
        'health_signal_http_proxy_id = ?, health_signal_http_authentication = ? WHERE rowid=(SELECT MIN(rowid) FROM engine);'
    );
    expect(run).toHaveBeenCalledWith(
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
      Buffer.from(JSON.stringify(command.healthSignal.http.authentication)).toString('base64')
    );
  });

  it('should not retrieve crypto settings', () => {
    const settings = repository.getCryptoSettings();
    expect(database.prepare).toHaveBeenCalledWith(`SELECT crypto_settings AS cryptoSettingsBase64 from engine;`);
    expect(settings).toBeNull();
  });
});

describe('Non-empty Engine repository', () => {
  const existingSettings = {
    id: 'id1',
    name: 'OIBus',
    port: 2223,
    consoleLogLevel: 'silent',
    fileLogLevel: 'info',
    fileLogMaxFileSize: 50,
    fileLogNumberOfFiles: 5,
    databaseLogLevel: 'info',
    databaseLogMaxNumberOfLogs: 100_000,
    lokiLogLevel: 'silent',
    lokiLogInterval: 60,
    lokiLogAddress: '',
    lokiLogTokenAddress: '',
    lokiLogProxyId: null,
    lokiLogUsername: '',
    lokiLogPassword: '',
    healthSignalLogEnabled: 1,
    healthSignalLogInterval: 60,
    healthSignalHttpEnabled: 0,
    healthSignalHttpInterval: 60,
    healthSignalHttpVerbose: 0,
    healthSignalHttpAddress: '',
    healthSignalHttpProxyId: null,
    healthSignalHttpAuthentication: Buffer.from(JSON.stringify({ type: 'basic', username: 'user', password: 'pass' })).toString('base64')
  };
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    all.mockReturnValue([existingSettings]);
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new EngineRepository(database);
  });

  it('should properly init engine settings table', () => {
    expect(database.prepare).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS engine (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, port INTEGER NOT NULL, ' +
        'log_console_level TEXT, log_file_level TEXT, log_file_max_file_size INTEGER, log_file_number_of_files INTEGER, ' +
        'log_database_level TEXT, log_database_max_number_of_logs INTEGER, log_loki_level TEXT, log_loki_interval INTEGER, ' +
        'log_loki_address TEXT, log_loki_token_address TEXT, log_loki_proxy_id TEXT, log_loki_username TEXT, ' +
        'log_loki_password TEXT, health_signal_log_enabled INTEGER, health_signal_log_interval INTEGER, ' +
        'health_signal_http_enabled INTEGER, health_signal_http_interval INTEGER, health_signal_http_verbose INTEGER, ' +
        'health_signal_http_address TEXT, health_signal_http_proxy_id TEXT, health_signal_http_authentication TEXT, ' +
        'crypto_settings TEXT, FOREIGN KEY(log_loki_proxy_id) REFERENCES proxy(id), FOREIGN KEY(health_signal_http_proxy_id) REFERENCES proxy(id));'
    );
    expect(generateRandomId).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should properly get the engine settings', () => {
    const expectedValue: EngineSettingsDTO = {
      id: 'id1',
      name: 'OIBus',
      port: 2223,
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
          tokenAddress: '',
          username: '',
          password: '',
          proxyId: null
        }
      },
      healthSignal: {
        logging: {
          enabled: true,
          interval: 60
        },
        http: {
          enabled: false,
          interval: 60,
          verbose: false,
          address: '',
          proxyId: null,
          authentication: { type: 'basic', username: 'user', password: 'pass' }
        }
      }
    };
    const externalSource = repository.getEngineSettings();
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, port, log_console_level AS consoleLogLevel, log_file_level AS fileLogLevel, ' +
        'log_file_max_file_size AS fileLogMaxFileSize, log_file_number_of_files AS fileLogNumberOfFiles, ' +
        'log_database_level AS databaseLogLevel, log_database_max_number_of_logs AS databaseLogMaxNumberOfLogs, ' +
        'log_loki_level AS lokiLogLevel, log_loki_interval AS lokiLogInterval, log_loki_address AS lokiLogAddress, ' +
        'log_loki_token_address AS lokiLogTokenAddress, log_loki_proxy_id AS lokiLogProxyId, ' +
        'log_loki_username AS lokiLogUsername, log_loki_password AS lokiLogPassword, ' +
        'health_signal_log_enabled AS healthSignalLogEnabled, health_signal_log_interval AS healthSignalLogInterval, ' +
        'health_signal_http_enabled AS healthSignalHttpEnabled, health_signal_http_interval AS healthSignalHttpInterval, ' +
        'health_signal_http_verbose AS healthSignalHttpVerbose, health_signal_http_address AS healthSignalHttpAddress, ' +
        'health_signal_http_proxy_id AS healthSignalHttpProxyId, ' +
        'health_signal_http_authentication AS healthSignalHttpAuthentication FROM engine;'
    );
    expect(all).toHaveBeenCalledTimes(2);
    expect(externalSource).toEqual(expectedValue);
  });

  it('should not create engine settings if they already exist', () => {
    const command: EngineSettingsCommandDTO = {
      name: 'OIBus',
      port: 2223,
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
          tokenAddress: '',
          username: '',
          password: '',
          proxyId: ''
        }
      },
      healthSignal: {
        logging: {
          enabled: true,
          interval: 60
        },
        http: {
          enabled: false,
          interval: 60,
          verbose: false,
          address: '',
          proxyId: null,
          authentication: {
            type: 'none'
          }
        }
      }
    };
    repository.createEngineSettings(command);
    expect(generateRandomId).not.toHaveBeenCalled();
  });

  it('should not retrieve crypto settings', () => {
    all.mockReturnValue([{ cryptoSettingsBase64: 'crypto settings 64' }]);

    const settings = repository.getCryptoSettings();
    expect(database.prepare).toHaveBeenCalledWith(`SELECT crypto_settings AS cryptoSettingsBase64 from engine;`);
    expect(settings).toEqual('crypto settings 64');
  });
});
