import path from 'node:path';
import fs from 'node:fs/promises';

import SouthODBC from './south-odbc';
import * as utils from '../../service/utils';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';
// eslint-disable-next-line import/no-unresolved
import odbc from 'odbc';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import { DateTime } from 'luxon';
import {
  SouthODBCItemSettings,
  SouthODBCItemSettingsDateTimeFields,
  SouthODBCSettings
} from '../../../../shared/model/south-settings.model';

jest.mock('../../service/utils');
jest.mock('odbc');
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
const addValues = jest.fn();
const addFile = jest.fn();

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const items: Array<SouthConnectorItemDTO<SouthODBCItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
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
    id: 'id3',
    name: 'item3',
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

describe('SouthODBC with authentication', () => {
  const configuration: SouthConnectorDTO<SouthODBCSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      driverPath: 'myOdbcDriver',
      host: 'localhost',
      port: 1433,
      database: 'db',
      username: 'username',
      password: 'password',
      connectionTimeout: 1000,
      trustServerCertificate: true
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    south = new SouthODBC(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder', true);
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
      .mockReturnValue([]);
    (utils.formatInstant as jest.Mock)
      .mockReturnValueOnce('2020-02-01 00:00:00.000')
      .mockReturnValueOnce('2020-03-01 00:00:00.000')
      .mockReturnValue(startTime);
    (utils.convertDateTimeToInstant as jest.Mock).mockImplementation(instant => instant);

    await south.historyQuery(items, startTime, nowDateString);
    expect(utils.persistResults).toHaveBeenCalledTimes(1);
    expect(south.queryData).toHaveBeenCalledTimes(3);
    expect(south.queryData).toHaveBeenCalledWith(items[0], startTime, nowDateString);
    expect(south.queryData).toHaveBeenCalledWith(items[1], '2020-03-01T00:00:00.000Z', nowDateString);
    expect(south.queryData).toHaveBeenCalledWith(items[2], '2020-03-01T00:00:00.000Z', nowDateString);

    expect(logger.info).toHaveBeenCalledWith(`Found 2 results for item ${items[0].name} in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[1].name}. Request done in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[2].name}. Request done in 0 ms`);
  });

  it('should get data from ODBC', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const odbcConnection = {
      close: jest.fn(),
      query: jest.fn().mockReturnValue([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);
    (utils.formatInstant as jest.Mock)
      .mockReturnValueOnce(DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'))
      .mockReturnValueOnce(DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'));

    const result = await south.queryData(items[0], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(
      items[0].settings.query,
      DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      logger
    );

    let expectedConnectionString = `Driver=${configuration.settings.driverPath};SERVER=${configuration.settings.host};PORT=${configuration.settings.port};`;
    expectedConnectionString += `TrustServerCertificate=yes;Database=${configuration.settings.database};UID=${configuration.settings.username};`;
    expect(odbc.connect).toHaveBeenCalledWith({
      connectionString: expectedConnectionString + 'PWD=password;',
      connectionTimeout: configuration.settings.connectionTimeout
    });
    expect(logger.debug).toHaveBeenCalledWith(`Connecting with connection string ${expectedConnectionString}PWD=<secret>;`);
    expect(odbcConnection.query).toHaveBeenCalledWith(items[0].settings.query);
    expect(odbcConnection.close).toHaveBeenCalledTimes(1);

    expect(result).toEqual([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
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
      await south.queryData(items[0], startTime, endTime);
    } catch (err) {
      error = err;
    }

    expect(odbcConnection.query).toHaveBeenCalledWith(items[0].settings.query);
    expect(error).toEqual(new Error('query error'));
    expect(odbcConnection.close).toHaveBeenCalledTimes(1);

    try {
      await south.queryData(items[0], startTime, endTime);
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

describe('SouthODBC without authentication', () => {
  const configuration: SouthConnectorDTO<SouthODBCSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      driverPath: 'myOdbcDriver',
      host: 'localhost',
      port: 1433,
      database: '',
      username: null,
      password: null,
      connectionTimeout: 1000,
      trustServerCertificate: false
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    south = new SouthODBC(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder', true);
  });

  it('should get data from ODBC without auth', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const odbcConnection = {
      close: jest.fn(),
      query: jest.fn().mockReturnValue([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    const result = await south.queryData(items[0], startTime, endTime);

    const expectedConnectionString = `Driver=${configuration.settings.driverPath};SERVER=${configuration.settings.host};PORT=${configuration.settings.port};`;
    expect(odbc.connect).toHaveBeenCalledWith({
      connectionString: expectedConnectionString,
      connectionTimeout: configuration.settings.connectionTimeout
    });
    expect(logger.debug).toHaveBeenCalledWith(`Connecting with connection string ${expectedConnectionString}`);

    expect(result).toEqual([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });

  it('should manage connection error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (odbc.connect as jest.Mock).mockImplementation(() => {
      throw new Error('connection error');
    });

    let error;
    try {
      await south.queryData(items[0], startTime, endTime);
    } catch (err) {
      error = err;
    }
    const expectedConnectionString = `Driver=${configuration.settings.driverPath};SERVER=${configuration.settings.host};PORT=${configuration.settings.port};`;
    expect(odbc.connect).toHaveBeenCalledWith({
      connectionString: expectedConnectionString,
      connectionTimeout: configuration.settings.connectionTimeout
    });
    expect(error).toEqual(new Error('connection error'));
  });
});

describe('SouthODBC test connection', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      driverPath: 'myOdbcDriver',
      host: 'localhost',
      port: 1433,
      database: 'db',
      username: 'username',
      password: 'password',
      connectionTimeout: 1000,
      trustServerCertificate: true
    }
  };
  const settings = { ...configuration.settings };

  class NodeOdbcError extends Error {
    public odbcErrors: odbc.OdbcError[];
    constructor(message: string, odbcErrors: odbc.OdbcError[]) {
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
    DB_ACCESS: `User '${settings.username}' does not have access to database '${settings.database}'`,
    DEFAULT: 'Please check logs'
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
  });

  it('Database is reachable and has tables', async () => {
    const result = [{ table_name: 'logs', columns: 'data(INTEGER), timestamp(datetime)' }];
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

    const test = SouthODBC.testConnection(settings, logger, encryptionService);
    await expect(test).resolves.not.toThrow();

    expect(odbcConnection.close).toBeCalled();
    expect((logger.trace as jest.Mock).mock.calls).toEqual([
      [`Testing if ODBC connection settings are correct`],
      [`Testing system table query`]
    ]);

    const tables = result.map((row: any) => `${row.table_name}: [${row.columns}]`).join(',\n');
    expect(logger.info).toHaveBeenCalledWith('Database is live with tables (table:[columns]):\n%s', tables);
  });

  it.each(flattenedErrors)(
    'Unable to create connection with $driver, error code $error.driverError.odbcErrors.0.code',
    async driverTest => {
      (odbc.connect as jest.Mock).mockImplementationOnce(() => {
        throw driverTest.error.driverError;
      });
      settings.driverPath = driverTest.driver;

      const test = SouthODBC.testConnection(settings, logger, encryptionService);
      await expect(test).rejects.toThrow(driverTest.error.expectedError);

      expect((logger.error as jest.Mock).mock.calls).toEqual([
        [`Unable to connect to database: ${connectionErrorMessage}`],
        [`Error from ODBC driver: ${driverTest.error.driverError.odbcErrors[0].message}`]
      ]);
      expect((logger.trace as jest.Mock).mock.calls).toEqual([[`Testing if ODBC connection settings are correct`]]);
    }
  );

  it('Unable to create connection with SQLite', async () => {
    const errorMessage = 'File does not exist';
    const dbPath = path.resolve(settings.database);
    (fs.access as jest.Mock).mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });
    settings.driverPath = 'SQLite';

    const test = SouthODBC.testConnection(settings, logger, encryptionService);
    await expect(test).rejects.toThrowError(`File '${dbPath}' does not exist`);

    expect((logger.trace as jest.Mock).mock.calls).toEqual([['Testing if ODBC connection settings are correct']]);
    expect(logger.error as jest.Mock).toBeCalledWith(`Access error on '${dbPath}': ${errorMessage}`);
  });

  it('Could not load driver', async () => {
    settings.driverPath = 'Unknown driver';
    const error = new NodeOdbcError(connectionErrorMessage, [{ code: -1, message: 'Driver not found', state: 'IM002' }]);
    (odbc.connect as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const test = SouthODBC.testConnection(settings, logger, encryptionService);
    await expect(test).rejects.toThrow(new Error(`Driver '${settings.driverPath}' not found`));

    expect((logger.error as jest.Mock).mock.calls).toEqual([
      [`Unable to connect to database: ${connectionErrorMessage}`],
      [`Error from ODBC driver: ${error.odbcErrors[0].message}`]
    ]);
    expect((logger.trace as jest.Mock).mock.calls).toEqual([[`Testing if ODBC connection settings are correct`]]);
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

    const test = SouthODBC.testConnection(settings, logger, encryptionService);
    await expect(test).rejects.toThrow(new Error(`Unable to read tables in database '${settings.database}', check logs`));

    expect(odbcConnection.close).toBeCalled();
    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Unable to read tables in database '${settings.database}': ${errorMessage}`]]);
    expect((logger.trace as jest.Mock).mock.calls).toEqual([
      [`Testing if ODBC connection settings are correct`],
      [`Testing system table query`]
    ]);
  });

  it('Database has no tables', async () => {
    const odbcConnection = {
      close: jest.fn(),
      tables: jest.fn(() => [])
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    const test = SouthODBC.testConnection(settings, logger, encryptionService);
    await expect(test).rejects.toThrow(new Error('Database has no tables'));

    expect(odbcConnection.close).toBeCalled();
    expect((logger.warn as jest.Mock).mock.calls).toEqual([[`Database '${settings.database}' has no tables`]]);
    expect((logger.trace as jest.Mock).mock.calls).toEqual([
      [`Testing if ODBC connection settings are correct`],
      [`Testing system table query`]
    ]);
  });

  it('Unable to connect to database without password', async () => {
    const errorMessage = 'Error connecting to database';
    settings.driverPath = 'myOdbcDriver';
    settings.password = '';
    (odbc.connect as jest.Mock).mockImplementationOnce(() => {
      throw new NodeOdbcError(errorMessage, [{ code: -1, message: errorMessage, state: '' }]);
    });

    const test = SouthODBC.testConnection(settings, logger, encryptionService);
    await expect(test).rejects.toThrow(new Error('Please check logs'));

    expect((logger.error as jest.Mock).mock.calls).toEqual([
      [`Unable to connect to database: ${errorMessage}`],
      [`Error from ODBC driver: ${errorMessage}`]
    ]);
    expect((logger.trace as jest.Mock).mock.calls).toEqual([[`Testing if ODBC connection settings are correct`]]);
  });
});
