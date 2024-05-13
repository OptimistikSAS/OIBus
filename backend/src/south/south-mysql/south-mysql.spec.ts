import path from 'node:path';

import SouthMySQL from './south-mysql';
import * as utils from '../../service/utils';
import { generateReplacementParameters } from '../../service/utils';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';

import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import mysql from 'mysql2/promise';
import {
  SouthMySQLItemSettings,
  SouthMySQLItemSettingsDateTimeFields,
  SouthMySQLSettings
} from '../../../../shared/model/south-settings.model';

jest.mock('mysql2/promise');
jest.mock('../../service/utils');

const database = new DatabaseMock();
jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return {
        createSouthCacheScanModeTable: jest.fn(),
        southCacheRepository: {
          database
        }
      };
    }
);
jest.mock(
  '../../service/south-connector-metrics.service',
  () =>
    function () {
      return {
        initMetrics: jest.fn(),
        updateMetrics: jest.fn(),
        get stream() {
          return { stream: 'myStream' };
        },
        metrics: {
          numberOfValuesRetrieved: 1,
          numberOfFilesRetrieved: 1
        }
      };
    }
);
const addContentCallback = jest.fn();

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const items: Array<SouthConnectorItemDTO<SouthMySQLItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    connectorId: 'southId',
    settings: {
      query: 'SELECT * FROM table',
      requestTimeout: 1000,
      dateTimeFields: [
        {
          fieldName: 'anotherTimestamp',
          useAsReference: false,
          type: 'unix-epoch-ms',
          timezone: null,
          format: null,
          locale: null
        } as unknown as SouthMySQLItemSettingsDateTimeFields,
        {
          fieldName: 'timestamp',
          useAsReference: true,
          type: 'string',
          timezone: 'Europe/Paris',
          format: 'yyyy-MM-dd HH:mm:ss.SSS',
          locale: 'en-US'
        }
      ],
      serialization: {
        type: 'csv',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
        outputTimezone: 'Europe/Paris'
      }
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    enabled: true,
    connectorId: 'southId',
    settings: {
      query: 'SELECT * FROM table',
      requestTimeout: 1000,
      dateTimeFields: null,
      serialization: {
        type: 'csv',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
        outputTimezone: 'Europe/Paris'
      }
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id3',
    name: 'item3',
    enabled: true,
    connectorId: 'southId',
    settings: {
      query: 'SELECT * FROM table',
      requestTimeout: 1000,
      dateTimeFields: [
        {
          fieldName: 'anotherTimestamp',
          useAsReference: false,
          type: 'unix-epoch-ms',
          timezone: null,
          format: null,
          locale: null
        } as unknown as SouthMySQLItemSettingsDateTimeFields,
        {
          fieldName: 'timestamp',
          useAsReference: true,
          type: 'string',
          timezone: 'Europe/Paris',
          format: 'yyyy-MM-dd HH:mm:ss.SSS',
          locale: 'en-US'
        }
      ],
      serialization: {
        type: 'csv',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
        outputTimezone: 'Europe/Paris'
      }
    },
    scanModeId: 'scanModeId2'
  }
];

const nowDateString = '2020-02-02T02:02:02.222Z';
let south: SouthMySQL;

describe('SouthMySQL with authentication', () => {
  const configuration: SouthConnectorDTO<SouthMySQLSettings> = {
    id: 'southId',
    name: 'south',
    type: 'mysql',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      host: 'localhost',
      port: 3306,
      database: 'db',
      username: 'username',
      password: 'password',
      connectionTimeout: 1000
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    (utils.generateReplacementParameters as jest.Mock).mockReturnValue([new Date(nowDateString), new Date(nowDateString)]);

    south = new SouthMySQL(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should create temp folder', async () => {
    await south.start();
    expect(utils.createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', 'tmp'));
  });

  it('should properly run historyQuery', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    south.queryData = jest
      .fn()
      .mockReturnValueOnce([
        { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
        { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
      ])
      .mockReturnValueOnce([
        { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
        { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
      ])
      .mockReturnValue([]);
    (utils.formatInstant as jest.Mock)
      .mockReturnValueOnce('2020-02-01 00:00:00.000')
      .mockReturnValueOnce('2020-03-01 00:00:00.000')
      .mockReturnValue(startTime);
    (utils.convertDateTimeToInstant as jest.Mock).mockImplementation(instant => instant);

    await south.historyQuery(items, startTime, nowDateString);
    expect(utils.persistResults).toHaveBeenCalledTimes(2);
    expect(south.queryData).toHaveBeenCalledTimes(3);
    expect(south.queryData).toHaveBeenCalledWith(items[0], startTime, nowDateString);
    expect(south.queryData).toHaveBeenCalledWith(items[1], '2020-03-01T00:00:00.000Z', nowDateString);
    expect(south.queryData).toHaveBeenCalledWith(items[2], '2020-03-01T00:00:00.000Z', nowDateString);

    expect(logger.info).toHaveBeenCalledWith(`Found 2 results for item ${items[0].name} in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[2].name}. Request done in 0 ms`);
  });

  it('should get data from MySQL', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    (utils.formatInstant as jest.Mock).mockReturnValueOnce(startTime).mockReturnValueOnce(endTime);

    (generateReplacementParameters as jest.Mock).mockReturnValue({ startTime, endTime });
    const mysqlConnection = {
      end: jest.fn(),
      execute: jest.fn().mockReturnValue([[{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]])
    };
    (mysql.createConnection as jest.Mock).mockReturnValue(mysqlConnection);

    const result = await south.queryData(items[0], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(items[0].settings.query, startTime, endTime, logger);
    expect(mysql.createConnection).toHaveBeenCalledWith({
      host: configuration.settings.host,
      port: configuration.settings.port,
      user: configuration.settings.username,
      password: configuration.settings.password,
      database: configuration.settings.database,
      connectTimeout: configuration.settings.connectionTimeout,
      timezone: 'Z'
    });
    expect(generateReplacementParameters).toHaveBeenCalledWith(items[0].settings.query, startTime, endTime);
    expect(mysqlConnection.execute).toHaveBeenCalledWith(
      {
        sql: items[0].settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?'),
        timeout: items[0].settings.requestTimeout
      },
      {
        startTime,
        endTime
      }
    );
    expect(mysqlConnection.end).toHaveBeenCalledTimes(1);

    expect(result).toEqual([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });

  it('should get data from MySQL without reference', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const mysqlConnection = {
      end: jest.fn(),
      execute: jest.fn().mockReturnValue([[{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]])
    };
    (mysql.createConnection as jest.Mock).mockReturnValue(mysqlConnection);
    const result = await south.queryData(items[1], startTime, endTime);
    expect(utils.formatInstant).not.toHaveBeenCalled();
    expect(utils.logQuery).toHaveBeenCalledWith(items[1].settings.query, startTime, endTime, logger);

    expect(result).toEqual([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (generateReplacementParameters as jest.Mock).mockReturnValue({ startTime, endTime });
    const mysqlConnection = {
      end: jest.fn(),
      execute: jest.fn().mockImplementation(() => {
        throw new Error('query error');
      })
    };
    (mysql.createConnection as jest.Mock).mockReturnValue(mysqlConnection);

    let error;
    try {
      await south.queryData(items[0], startTime, endTime);
    } catch (err) {
      error = err;
    }

    expect(mysqlConnection.execute).toHaveBeenCalledWith(
      {
        sql: items[0].settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?'),
        timeout: items[0].settings.requestTimeout
      },
      {
        startTime,
        endTime
      }
    );
    expect(error).toEqual(new Error('query error'));
    expect(mysqlConnection.end).toHaveBeenCalledTimes(1);
  });
});

describe('SouthMySQL without authentication', () => {
  const configuration: SouthConnectorDTO<SouthMySQLSettings> = {
    id: 'southId',
    name: 'south',
    type: 'mysql',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      host: 'localhost',
      port: 3306,
      database: 'db',
      username: null,
      password: null,
      connectionTimeout: 1000
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    south = new SouthMySQL(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should manage connection error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (mysql.createConnection as jest.Mock).mockImplementation(() => {
      throw new Error('connection error');
    });

    let error;
    try {
      await south.queryData(items[0], startTime, endTime);
    } catch (err) {
      error = err;
    }

    expect(mysql.createConnection).toHaveBeenCalledWith({
      host: configuration.settings.host,
      port: configuration.settings.port,
      user: undefined,
      password: undefined,
      database: configuration.settings.database,
      connectTimeout: configuration.settings.connectionTimeout,
      timezone: 'Z'
    });
    expect(error).toEqual(new Error('connection error'));
  });
});

describe('SouthMySQL test connection', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'mysql',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      host: 'localhost',
      port: 3306,
      database: 'db',
      username: 'username',
      password: 'password',
      connectionTimeout: 1000,
      requestTimeout: 1000
    }
  };

  // Error codes handled by the test function
  // With the expected error messages to throw
  const ERROR_CODES = {
    ETIMEDOUT: 'Please check host and port.',
    ECONNREFUSED: 'Please check host and port.',
    ER_ACCESS_DENIED_ERROR: 'Please check username and password.',
    ER_DBACCESS_DENIED_ERROR: `User "${configuration.settings.username}" does not have access to database "${configuration.settings.database}".`,
    ER_BAD_DB_ERROR: `Database "${configuration.settings.database}" does not exist.`,
    DEFAULT: 'Unexpected error.' // For exceptions that we aren't explicitly specifying
  } as const;

  type ErrorCodes = keyof typeof ERROR_CODES;

  class MYSQL2Error extends Error {
    private code: ErrorCodes;

    constructor(message: string, code: ErrorCodes) {
      super();
      this.name = 'MYSQL2Error';
      this.message = message;
      this.code = code;
    }
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    south = new SouthMySQL(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('Database is reachable and has tables', async () => {
    const result = [{ table_count: 21 }];
    const mysqlConnection = {
      execute: jest.fn().mockReturnValueOnce([result]),
      ping: jest.fn(),
      end: jest.fn()
    };
    (mysql.createConnection as jest.Mock).mockReturnValue(mysqlConnection);

    await expect(south.testConnection()).resolves.not.toThrow();

    expect(mysqlConnection.end).toHaveBeenCalled();
  });

  it('Unable to create connection', async () => {
    let code: ErrorCodes;
    const errorMessage = 'Error creating connection';

    for (code in ERROR_CODES) {
      (logger.error as jest.Mock).mockClear();
      (logger.info as jest.Mock).mockClear();
      (mysql.createConnection as jest.Mock).mockImplementationOnce(() => {
        throw new MYSQL2Error(errorMessage, code);
      });

      await expect(south.testConnection()).rejects.toThrow(new Error(`${ERROR_CODES[code]} ${errorMessage}`));
    }
  });

  it('Unable to ping database', async () => {
    let code: ErrorCodes;
    const errorMessage = 'Error pinging database';

    for (code in ERROR_CODES) {
      (logger.error as jest.Mock).mockClear();
      (logger.info as jest.Mock).mockClear();
      const mysqlConnection = {
        ping: () => {
          throw new MYSQL2Error(errorMessage, code);
        },
        end: jest.fn()
      };
      (mysql.createConnection as jest.Mock).mockReturnValue(mysqlConnection);

      await expect(south.testConnection()).rejects.toThrow(new Error(`${ERROR_CODES[code]} ${errorMessage}`));
      expect(mysqlConnection.end).toHaveBeenCalled();
    }
  });

  it('System table unreachable', async () => {
    const errorMessage = 'information_schema.TABLES does not exist';
    const mysqlConnection = {
      execute: jest.fn().mockImplementationOnce(() => {
        throw new Error(errorMessage);
      }),
      ping: jest.fn(),
      end: jest.fn()
    };
    (mysql.createConnection as jest.Mock).mockReturnValue(mysqlConnection);

    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Unable to read tables in database "${configuration.settings.database}". ${errorMessage}`)
    );
    expect(mysqlConnection.end).toHaveBeenCalled();
  });

  it('Database has no tables', async () => {
    const mysqlConnection = {
      execute: jest.fn().mockReturnValueOnce([[{ table_count: 0 }]]),
      ping: jest.fn(),
      end: jest.fn()
    };
    (mysql.createConnection as jest.Mock).mockReturnValue(mysqlConnection);

    await expect(south.testConnection()).rejects.toThrow(new Error(`Database "${configuration.settings.database}" has no tables`));
    expect(mysqlConnection.end).toHaveBeenCalled();
  });

  it('Database does not return count of tables', async () => {
    const mysqlConnection = {
      execute: jest.fn().mockReturnValueOnce([[]]),
      ping: jest.fn(),
      end: jest.fn()
    };
    (mysql.createConnection as jest.Mock).mockReturnValue(mysqlConnection);

    await expect(south.testConnection()).rejects.toThrow(new Error(`Database "${configuration.settings.database}" has no tables`));
    expect(mysqlConnection.end).toHaveBeenCalled();
  });

  it('Unable to ping database without password', async () => {
    configuration.settings.password = '';
    let code: ErrorCodes;
    const errorMessage = 'Error pinging database';

    for (code in ERROR_CODES) {
      const mysqlConnection = {
        ping: () => {
          throw new MYSQL2Error(errorMessage, code);
        },
        end: jest.fn()
      };
      (mysql.createConnection as jest.Mock).mockReturnValue(mysqlConnection);

      await expect(south.testConnection()).rejects.toThrow(new Error(`${ERROR_CODES[code]} ${errorMessage}`));
    }
  });
});
