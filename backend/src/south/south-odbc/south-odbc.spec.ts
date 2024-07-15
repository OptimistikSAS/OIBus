import path from 'node:path';

import SouthODBC from './south-odbc';
import * as utils from '../../service/utils';
import { convertDateTimeToInstant, convertDelimiter, formatInstant, persistResults } from '../../service/utils';
import DatabaseMock from '../../tests/__mocks__/database.mock';

import pino from 'pino';
import fetch from 'node-fetch';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import {
  SouthODBCItemSettings,
  SouthODBCItemSettingsDateTimeFields,
  SouthODBCSettings
} from '../../../../shared/model/south-settings.model';

jest.mock(
  'odbc',
  () => {
    return {
      connect: jest.fn()
    };
  },
  { virtual: true }
);
// disable next line for tests purposes because the node module can not be download if odbc native library is not
// loaded into the OS. Using require instead of import allow the tests to not fail in this case.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const odbc = require('odbc');

jest.mock('node-fetch');
jest.mock('../../service/utils');
jest.mock('node:fs/promises');

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
const items: Array<SouthConnectorItemDTO<SouthODBCItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    connectorId: 'southId',
    settings: {
      query: 'SELECT * FROM table',
      dateTimeFields: [
        {
          fieldName: 'anotherTimestamp',
          useAsReference: false,
          type: 'unix-epoch-ms',
          timezone: null,
          format: null,
          locale: null
        } as unknown as SouthODBCItemSettingsDateTimeFields,
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
      dateTimeFields: [
        {
          fieldName: 'anotherTimestamp',
          useAsReference: false,
          type: 'unix-epoch-ms',
          timezone: null,
          format: null,
          locale: null
        } as unknown as SouthODBCItemSettingsDateTimeFields,
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
let south: SouthODBC;

// Spy on console info and error
jest.spyOn(global.console, 'info').mockImplementation(() => {});
jest.spyOn(global.console, 'error').mockImplementation(() => {});

describe('SouthODBC odbc driver with authentication', () => {
  const configuration: SouthConnectorDTO<SouthODBCSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      remoteAgent: false,
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    (convertDateTimeToInstant as jest.Mock).mockImplementation(value => value);

    south = new SouthODBC(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should create temp folder', async () => {
    await south.start();
    expect(utils.createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', 'tmp'));
  });

  it('should do nothing on connect and disconnect', async () => {
    await south.connect();
    await south.disconnect();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should properly run historyQuery', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    south.queryOdbcData = jest.fn().mockReturnValueOnce('2023-02-01T00:00:00.000Z').mockReturnValue('2023-02-01T00:00:00.000Z');

    await south.historyQuery(items, startTime, nowDateString, startTime);
    expect(south.queryOdbcData).toHaveBeenCalledTimes(3);
    expect(south.queryOdbcData).toHaveBeenCalledWith(items[0], startTime, nowDateString);
    expect(south.queryOdbcData).toHaveBeenCalledWith(items[1], '2023-02-01T00:00:00.000Z', nowDateString);
    expect(south.queryOdbcData).toHaveBeenCalledWith(items[2], '2023-02-01T00:00:00.000Z', nowDateString);
  });

  it('should get data from ODBC', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const odbcConnection = {
      close: jest.fn(),
      query: jest
        .fn()
        .mockReturnValueOnce([
          { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' },
          { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' }
        ])
        .mockReturnValueOnce([])
    };
    (formatInstant as jest.Mock).mockImplementation(value => value);

    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    const result = await south.queryOdbcData(items[0], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(items[0].settings.query, startTime, endTime, logger);

    expect(odbc.connect).toHaveBeenCalledWith({
      connectionString: `${configuration.settings.connectionString};` + 'PWD=password;',
      connectionTimeout: configuration.settings.connectionTimeout
    });
    expect(logger.debug).toHaveBeenCalledWith(`Connecting with connection string ${configuration.settings.connectionString}PWD=<secret>;`);
    expect(odbcConnection.query).toHaveBeenCalledWith(items[0].settings.query);
    expect(odbcConnection.close).toHaveBeenCalledTimes(1);

    expect(result).toEqual('2020-03-01T00:00:00.000Z');
    expect(persistResults).toHaveBeenCalledWith(
      [
        { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' },
        { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' }
      ],
      items[0].settings.serialization,
      configuration.name,
      items[0].name,
      path.resolve('baseFolder', 'tmp'),
      expect.any(Function),
      logger
    );

    await south.queryOdbcData(items[0], startTime, endTime);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[0].name}. Request done in 0 ms`);
  });

  it('should get data from ODBC without datetime reference', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const odbcConnection = {
      close: jest.fn(),
      query: jest
        .fn()
        .mockReturnValueOnce([
          { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' },
          { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' }
        ])
        .mockReturnValueOnce([])
    };
    (formatInstant as jest.Mock).mockImplementation(value => value);

    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    const result = await south.queryOdbcData(items[1], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(items[1].settings.query, startTime, endTime, logger);

    expect(result).toEqual(startTime);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const odbcConnection = {
      close: jest.fn(),
      query: jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('query error');
        })
        .mockImplementation(() => {
          throw {
            odbcErrors: [{ message: 'error1' }, { message: 'error2' }]
          };
        })
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    let error;
    try {
      await south.queryOdbcData(items[0], startTime, endTime);
    } catch (err) {
      error = err;
    }

    expect(odbcConnection.query).toHaveBeenCalledWith(items[0].settings.query);
    expect(error).toEqual(new Error('query error'));
    expect(odbcConnection.close).toHaveBeenCalledTimes(1);

    try {
      await south.queryOdbcData(items[0], startTime, endTime);
    } catch (err) {
      error = err;
    }

    expect(error).toEqual({
      odbcErrors: [{ message: 'error1' }, { message: 'error2' }]
    });
    expect(logger.error).toHaveBeenCalledWith(`Error from ODBC driver: error1`);
    expect(logger.error).toHaveBeenCalledWith(`Error from ODBC driver: error2`);
  });
});

describe('SouthODBC odbc driver without authentication', () => {
  const configuration: SouthConnectorDTO<SouthODBCSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      remoteAgent: false,
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: null,
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    south = new SouthODBC(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should get data from ODBC without auth', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (convertDateTimeToInstant as jest.Mock).mockImplementation(value => value);
    (formatInstant as jest.Mock).mockImplementation(value => value);
    const odbcConnection = {
      close: jest.fn(),
      query: jest.fn().mockReturnValue([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    const result = await south.queryOdbcData(items[0], startTime, endTime);

    expect(odbc.connect).toHaveBeenCalledWith({
      connectionString: configuration.settings.connectionString,
      connectionTimeout: configuration.settings.connectionTimeout
    });
    expect(logger.debug).toHaveBeenCalledWith(`Connecting with connection string ${configuration.settings.connectionString}`);

    expect(result).toEqual('2020-03-01T00:00:00.000Z');
    expect(persistResults).toHaveBeenCalledWith(
      [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
      items[0].settings.serialization,
      configuration.name,
      items[0].name,
      path.resolve('baseFolder', 'tmp'),
      expect.any(Function),
      logger
    );
  });

  it('should manage connection error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (odbc.connect as jest.Mock).mockImplementation(() => {
      throw new Error('connection error');
    });

    let error;
    try {
      await south.queryOdbcData(items[0], startTime, endTime);
    } catch (err) {
      error = err;
    }
    expect(odbc.connect).toHaveBeenCalledWith({
      connectionString: configuration.settings.connectionString,
      connectionTimeout: configuration.settings.connectionTimeout
    });
    expect(error).toEqual(new Error('connection error'));
  });
});

describe('SouthODBC odbc driver test connection', () => {
  const configuration: SouthConnectorDTO<SouthODBCSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      remoteAgent: false,
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    }
  };

  class NodeOdbcError extends Error {
    public odbcErrors: Array<{ code: number; message: string; state: string }> = [];
    constructor(message: string, odbcErrors: Array<{ code: number; message: string; state: string }> = []) {
      super();
      this.name = 'ODBCError';
      this.message = message;
      this.odbcErrors = odbcErrors;
    }
  }

  // Error types and the messages thrown by the test function
  const ERROR_TYPE = {
    HOST: 'Please check host and port',
    PORT: 'Please check host and port',
    CREDENTIALS: 'Please check username and password',
    DB_ACCESS: `User does not have access to database`,
    DEFAULT: 'Unable to connect to database'
  } as const;
  const connectionErrorMessage = 'Error creating connection';

  /**
   * Returns the NodeOdbcError driver error with it's expected error thrown by the test function
   *
   * @param expectedErrorMessage message thrown by the test function
   * @param message OdbcError message
   * @param code OdbcError code
   */
  const createOdbcError = (expectedErrorMessage: string, message: string, code: number) => {
    const driverError = new NodeOdbcError(connectionErrorMessage, [{ code, message, state: '' }]);
    const expectedError = new Error(expectedErrorMessage);

    return { driverError, expectedError };
  };

  // Drivers with the errors they are throwing
  const DRIVER_ERRORS = {
    'SQL Server': [
      createOdbcError(ERROR_TYPE.HOST, 'Host unreachable', 17),
      createOdbcError(ERROR_TYPE.PORT, 'Host:port unreachable', 17),
      createOdbcError(ERROR_TYPE.CREDENTIALS, 'Bad username or password', 18456),
      createOdbcError(ERROR_TYPE.DB_ACCESS, 'Unreachable Database', 4060),
      createOdbcError(ERROR_TYPE.DEFAULT, 'Unexpected error', -1)
    ],
    PostgreSQL: [
      createOdbcError(ERROR_TYPE.HOST, 'Unknown host', 1),
      createOdbcError(ERROR_TYPE.PORT, 'Connection refused', 1),
      createOdbcError(ERROR_TYPE.CREDENTIALS, 'Bad username or password', 1),
      createOdbcError(ERROR_TYPE.DB_ACCESS, 'Unreachable Database', 1),
      createOdbcError(ERROR_TYPE.DEFAULT, 'Unexpected error', -1)
    ],
    // Note: Could not determine host, port and db_access errors codes
    Oracle: [createOdbcError(ERROR_TYPE.CREDENTIALS, 'Bad username or password', 1017)],
    MySQL: [
      createOdbcError(ERROR_TYPE.HOST, 'Unknown host', 2005),
      createOdbcError(ERROR_TYPE.PORT, 'Host:port unreachable', 2003),
      createOdbcError(ERROR_TYPE.CREDENTIALS, 'Bad username or password', 1045),
      createOdbcError(ERROR_TYPE.DB_ACCESS, 'Unreachable Database', 1044),
      createOdbcError(ERROR_TYPE.DEFAULT, 'Unexpected error', -1)
    ],
    myOdbcDriver: [
      createOdbcError(ERROR_TYPE.DEFAULT, 'Unknown host', 1),
      createOdbcError(ERROR_TYPE.DEFAULT, 'Host:port unreachable', 2),
      createOdbcError(ERROR_TYPE.DEFAULT, 'Bad username or password', 3),
      createOdbcError(ERROR_TYPE.DEFAULT, 'Unreachable Database', 4),
      createOdbcError(ERROR_TYPE.DEFAULT, 'Unexpected error', -1)
    ]
  };

  // Flattens the errors inside DRIVER_ERRORS, keeping the name of the driver
  const flattenedErrors = Object.entries(DRIVER_ERRORS).flatMap(([driver, errors]) => errors.map(error => ({ driver, error })));

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    south = new SouthODBC(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('Database is reachable and has tables', async () => {
    const tablesResult = [{ TABLE_NAME: 'logs' }];
    const columnsResult = [
      { COLUMN_NAME: 'data', TYPE_NAME: 'INTEGER' },
      { COLUMN_NAME: 'timestamp', TYPE_NAME: 'datetime' }
    ];
    const odbcConnection = {
      close: jest.fn(),
      tables: jest.fn(() => tablesResult),
      columns: jest.fn(() => columnsResult)
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);
    await expect(south.testConnection()).resolves.not.toThrow();

    expect(odbcConnection.close).toHaveBeenCalled();
  });

  it('Database is reachable but reading table fails', async () => {
    const odbcConnection = {
      close: jest.fn(),
      tables: jest.fn(() => {
        throw { odbcErrors: [], message: 'table error' };
      })
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);
    await expect(south.testConnection()).rejects.toThrow('Unable to read tables in database');
  });

  it.each(flattenedErrors)(
    'Unable to create connection with $driver, error code $error.driverError.odbcErrors.0.code',
    async driverTest => {
      (odbc.connect as jest.Mock).mockImplementationOnce(() => {
        throw driverTest.error.driverError;
      });
      configuration.settings.connectionString = `Driver=${driverTest.driver}`;

      await expect(south.testConnection()).rejects.toThrow(`${driverTest.error.expectedError.message}`);
    }
  );

  it('Could not load driver', async () => {
    configuration.settings.connectionString = `Driver=Unknown driver`;

    const error = new NodeOdbcError(connectionErrorMessage, [{ code: -1, message: 'Driver not found', state: 'IM002' }]);
    (odbc.connect as jest.Mock).mockImplementation(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Driver not found. Check connection string and driver`));
  });

  it('System table unreachable', async () => {
    const errorMessage = 'Function unavailable';
    const odbcConnection = {
      close: jest.fn(),
      tables: jest.fn(() => {
        throw new NodeOdbcError(errorMessage, []);
      })
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    await expect(south.testConnection()).rejects.toThrow(new Error(`Unable to read tables in database`));

    expect(odbcConnection.close).toHaveBeenCalled();
  });

  it('Database has no tables', async () => {
    const odbcConnection = {
      close: jest.fn(),
      tables: jest.fn(() => [])
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    await expect(south.testConnection()).rejects.toThrow(new Error('Database has no table'));

    expect(odbcConnection.close).toHaveBeenCalled();
  });

  it('Unable to connect to database without password', async () => {
    const errorMessage = 'Error connecting to database';
    configuration.settings.connectionString = 'myOdbcDriver';
    configuration.settings.password = '';
    (odbc.connect as jest.Mock).mockImplementationOnce(() => {
      throw new NodeOdbcError(errorMessage, [{ code: -1, message: errorMessage, state: '' }]);
    });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Unable to connect to database`));
  });
});

describe('SouthODBC odbc remote with authentication', () => {
  const configuration: SouthConnectorDTO<SouthODBCSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      remoteAgent: true,
      agentUrl: 'http://localhost:2224',
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    (convertDateTimeToInstant as jest.Mock).mockImplementation(value => value);
    (convertDelimiter as jest.Mock).mockImplementation(value => value);

    south = new SouthODBC(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should properly connect to remote agent and disconnect ', async () => {
    await south.connect();
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/odbc/${configuration.id}/connect`, {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: configuration.settings.connectionString,
        connectionTimeout: configuration.settings.connectionTimeout
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    await south.disconnect();
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/odbc/${configuration.id}/disconnect`, {
      method: 'DELETE'
    });
  });

  it('should properly reconnect to when connection fails ', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connection failed');
    });

    await south.connect();
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/odbc/${configuration.id}/connect`, {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: configuration.settings.connectionString,
        connectionTimeout: configuration.settings.connectionTimeout
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should properly clear reconnect timeout on disconnect', async () => {
    (fetch as unknown as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('connection failed');
      })
      .mockImplementationOnce(() => {
        return true;
      })
      .mockImplementationOnce(() => {
        throw new Error('disconnection failed');
      });

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await south.connect();

    expect(fetch).toHaveBeenCalledTimes(1);
    await south.connect();

    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending connection HTTP request into agent. Reconnecting in ${configuration.settings.retryInterval} ms. ${new Error(
        'connection failed'
      )}`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending disconnection HTTP request into agent. ${new Error('disconnection failed')}`
    );
  });

  it('should properly run historyQuery', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    south.queryRemoteAgentData = jest.fn().mockReturnValueOnce('2023-02-01T00:00:00.000Z').mockReturnValue('2023-02-01T00:00:00.000Z');

    await south.historyQuery(items, startTime, nowDateString, startTime);
    expect(south.queryRemoteAgentData).toHaveBeenCalledTimes(3);
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(items[0], startTime, nowDateString);
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(items[1], '2023-02-01T00:00:00.000Z', nowDateString);
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(items[2], '2023-02-01T00:00:00.000Z', nowDateString);
  });

  it('should get data from Remote agent', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          json: () => ({
            recordCount: 2,
            content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
            maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
          })
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          json: () => ({
            recordCount: 0,
            content: [],
            maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
          })
        })
      );

    const result = await south.queryRemoteAgentData(items[0], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(items[0].settings.query, startTime, endTime, logger);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/odbc/${configuration.id}/read`, {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: configuration.settings.connectionString,
        sql: items[0].settings.query,
        readTimeout: configuration.settings.requestTimeout,
        timeColumn: items[0].settings.dateTimeFields![1].fieldName,
        datasourceTimestampFormat: items[0].settings.dateTimeFields![1].format,
        datasourceTimezone: items[0].settings.dateTimeFields![1].timezone,
        delimiter: items[0].settings.serialization.delimiter,
        outputTimestampFormat: items[0].settings.serialization.outputTimestampFormat,
        outputTimezone: items[0].settings.serialization.outputTimezone
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(result).toEqual('2020-03-01T00:00:00.000Z');
    expect(persistResults).toHaveBeenCalledWith(
      [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
      { type: 'file', filename: items[0].settings.serialization.filename, compression: items[0].settings.serialization.compression },
      configuration.name,
      items[0].name,
      path.resolve('baseFolder', 'tmp'),
      expect.any(Function),
      logger
    );

    await south.queryRemoteAgentData(items[0], startTime, endTime);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[0].name}. Request done in 0 ms`);
  });

  it('should get data from Remote agent without datetime reference', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (fetch as unknown as jest.Mock).mockReturnValueOnce(
      Promise.resolve({
        status: 200,
        json: () => ({
          recordCount: 2,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
          maxInstantRetrieved: startTime
        })
      })
    );

    const result = await south.queryRemoteAgentData(items[1], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(items[1].settings.query, startTime, endTime, logger);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/odbc/${configuration.id}/read`, {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: configuration.settings.connectionString,
        sql: items[0].settings.query,
        readTimeout: configuration.settings.requestTimeout,
        delimiter: items[0].settings.serialization.delimiter,
        outputTimestampFormat: items[0].settings.serialization.outputTimestampFormat,
        outputTimezone: items[0].settings.serialization.outputTimezone
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(result).toEqual(startTime);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          status: 400,
          text: () => 'bad request'
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          status: 500
        })
      );

    await south.queryRemoteAgentData(items[0], startTime, endTime);
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when querying remote agent with status 400: bad request`);

    await south.queryRemoteAgentData(items[0], startTime, endTime);
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when querying remote agent with status 500`);
  });
});

describe('SouthODBC odbc remote test connection', () => {
  const configuration: SouthConnectorDTO<SouthODBCSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      remoteAgent: true,
      agentUrl: 'http://localhost:2224',
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    south = new SouthODBC(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should test connection successfully', async () => {
    (fetch as unknown as jest.Mock).mockReturnValueOnce(
      Promise.resolve({
        status: 200
      })
    );
    await expect(south.testConnection()).resolves.not.toThrow();
  });

  it('should test connection fail', async () => {
    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          status: 400,
          text: () => 'bad request'
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          status: 500,
          text: () => 'another error'
        })
      );
    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Error occurred when sending connect command to remote agent with status 400: bad request`)
    );

    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Error occurred when sending connect command to remote agent with status 500`)
    );
  });
});
