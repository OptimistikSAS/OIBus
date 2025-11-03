import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import path from 'node:path';
import SouthODBC from './south-odbc';
import * as utils from '../../service/utils';
import { convertDateTimeToInstant, convertDelimiter, formatInstant, persistResults } from '../../service/utils';
import pino from 'pino';
import { loadOdbc } from './odbc-loader';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { SouthODBCItemSettings, SouthODBCItemSettingsDateTimeFields, SouthODBCSettings } from '../../../shared/model/south-settings.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import testData from '../../tests/utils/test-data';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import { HTTPRequest } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';

jest.mock('../../service/http-request.utils');
jest.mock('node:fs/promises');
jest.mock('../../service/utils');
jest.mock('./odbc-loader.ts');

const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

// Spy on console info and error
jest.spyOn(global.console, 'info').mockImplementation(() => null);
jest.spyOn(global.console, 'error').mockImplementation(() => null);

describe('SouthODBC odbc driver with authentication', () => {
  let south: SouthODBC;
  const configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      remoteAgent: false,
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'query1',
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
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          query: 'query2',
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
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          query: 'query3',
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
        scanMode: testData.scanMode.list[1]
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (convertDateTimeToInstant as jest.Mock).mockImplementation(value => value);

    south = new SouthODBC(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  it('should get throttling settings', () => {
    expect(south.getThrottlingSettings(configuration.settings)).toEqual({
      maxReadInterval: configuration.settings.throttling.maxReadInterval,
      readDelay: configuration.settings.throttling.readDelay
    });
    expect(south.getMaxInstantPerItem(configuration.settings)).toEqual(true);
    expect(south.getOverlap(configuration.settings)).toEqual(configuration.settings.throttling.overlap);
  });

  it('should do nothing on connect and disconnect', async () => {
    await south.connect();
    await south.disconnect();
    expect(HTTPRequest).not.toHaveBeenCalled();
  });

  it('should not add ; if  present', async () => {
    south.connectorConfiguration = JSON.parse(JSON.stringify(south.connectorConfiguration));
    south.connectorConfiguration.settings.connectionString += ';';
    const result = await south.createConnectionConfig(south.connectorConfiguration.settings);
    expect(result).toEqual({
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes;PWD=password;',
      connectionTimeout: 1000
    });
  });

  it('should properly run historyQuery', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    south.queryOdbcData = jest.fn().mockReturnValueOnce('2023-02-01T00:00:00.000Z').mockReturnValue('2023-02-01T00:00:00.000Z');

    await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
    expect(south.queryOdbcData).toHaveBeenCalledTimes(3);
    expect(south.queryOdbcData).toHaveBeenCalledWith(configuration.items[0], startTime, testData.constants.dates.FAKE_NOW);
    expect(south.queryOdbcData).toHaveBeenCalledWith(configuration.items[1], startTime, testData.constants.dates.FAKE_NOW);
    expect(south.queryOdbcData).toHaveBeenCalledWith(configuration.items[2], startTime, testData.constants.dates.FAKE_NOW);
  });

  it('should get data from ODBC', async () => {
    const odbc = {
      connect: jest.fn()
    };
    (loadOdbc as jest.Mock).mockReturnValueOnce(odbc).mockReturnValueOnce(odbc);
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const odbcConnection = {
      close: jest.fn(),
      query: jest
        .fn()
        .mockReturnValueOnce([
          { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' },
          { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' }
        ])
        .mockReturnValueOnce([])
    };
    (formatInstant as jest.Mock).mockImplementation(value => value);

    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    const result = await south.queryOdbcData(configuration.items[0], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(configuration.items[0].settings.query, startTime, endTime, logger);

    expect(odbc.connect).toHaveBeenCalledWith({
      connectionString: `${configuration.settings.connectionString};` + 'PWD=password;',
      connectionTimeout: configuration.settings.connectionTimeout
    });
    expect(logger.debug).toHaveBeenCalledWith(`Connecting with connection string ${configuration.settings.connectionString}PWD=<secret>;`);
    expect(odbcConnection.query).toHaveBeenCalledWith(configuration.items[0].settings.query);
    expect(odbcConnection.close).toHaveBeenCalledTimes(1);

    expect(result).toEqual('2020-03-01T00:00:00.000Z');
    expect(persistResults).toHaveBeenCalledWith(
      [
        { value: 2, timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2020-03-01T00:00:00.000Z' },
        { value: 1, timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2020-02-01T00:00:00.000Z' }
      ],
      configuration.items[0].settings.serialization,
      configuration.name,
      configuration.items[0].name,
      path.resolve('cacheFolder', 'tmp'),
      expect.any(Function),
      logger
    );

    const noResult = await south.queryOdbcData(configuration.items[0], startTime, endTime);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${configuration.items[0].name}. Request done in 0 ms`);
    expect(noResult).toEqual(null);
  });

  it('should get data from ODBC without datetime reference', async () => {
    const odbc = {
      connect: jest.fn()
    };
    (loadOdbc as jest.Mock).mockReturnValueOnce(odbc);

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

    const result = await south.queryOdbcData(configuration.items[1], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(configuration.items[1].settings.query, startTime, endTime, logger);

    expect(result).toEqual(null);
  });

  it('should manage query error', async () => {
    const odbc = {
      connect: jest.fn()
    };
    (loadOdbc as jest.Mock).mockReturnValueOnce(odbc);

    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const odbcConnection = {
      close: jest.fn(),
      query: jest.fn().mockImplementationOnce(() => {
        throw new Error('query error');
      })
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    await expect(south.queryOdbcData(configuration.items[0], startTime, endTime)).rejects.toThrow('query error');
    expect(odbcConnection.query).toHaveBeenCalledWith(configuration.items[0].settings.query);
    expect(odbcConnection.close).toHaveBeenCalledTimes(1);
  });

  it('should manage odbc error', async () => {
    const odbc = {
      connect: jest.fn()
    };
    (loadOdbc as jest.Mock).mockReturnValueOnce(odbc);

    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const odbcConnection = {
      close: jest.fn(),
      query: jest.fn().mockImplementationOnce(() => {
        throw {
          message: 'odbc error',
          odbcErrors: [{ message: 'error1' }, { message: 'error2' }]
        };
      })
    };
    (odbc.connect as jest.Mock).mockReturnValueOnce(odbcConnection);

    await expect(south.queryOdbcData(configuration.items[0], startTime, endTime)).rejects.toThrow('odbc error');

    expect(logger.error).toHaveBeenCalledWith(`Error from ODBC driver: error1`);
    expect(logger.error).toHaveBeenCalledWith(`Error from ODBC driver: error2`);
  });

  it('queryOdbcData should throw error if ODBC library not loaded', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    (loadOdbc as jest.Mock).mockReturnValueOnce(null);
    await expect(south.queryOdbcData(configuration.items[0], startTime, endTime)).rejects.toThrow('ODBC library not available');
  });

  it('should test item with queryOdbcData', async () => {
    south.queryOdbcData = jest
      .fn()
      .mockReturnValue([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }] as Array<OIBusTimeValue>);

    await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    expect(south.queryOdbcData).toHaveBeenCalledTimes(1);
  });

  it('should test item with queryOdbcData', async () => {
    south.queryOdbcData = jest
      .fn()
      .mockReturnValue([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }] as Array<OIBusTimeValue>);

    await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
    expect(south.queryOdbcData).toHaveBeenCalledTimes(1);
    expect(convertDateTimeToInstant).not.toHaveBeenCalled();
    expect(formatInstant).not.toHaveBeenCalled();
  });

  it('QueryOdbcData in case of item test', async () => {
    const odbc = {
      connect: jest.fn()
    };
    (loadOdbc as jest.Mock).mockReturnValueOnce(odbc);

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

    await south.queryOdbcData(configuration.items[0], startTime, endTime, true);

    expect(utils.logQuery).toHaveBeenCalledWith(configuration.items[0].settings.query, startTime, endTime, logger);

    expect(odbc.connect).toHaveBeenCalledWith({
      connectionString: `${configuration.settings.connectionString};` + 'PWD=password;',
      connectionTimeout: configuration.settings.connectionTimeout
    });
    expect(logger.debug).toHaveBeenCalledWith(`Connecting with connection string ${configuration.settings.connectionString}PWD=<secret>;`);
    expect(odbcConnection.query).toHaveBeenCalledWith(configuration.items[0].settings.query);
    expect(odbcConnection.close).toHaveBeenCalledTimes(1);
  });
});

describe('SouthODBC odbc driver without authentication', () => {
  let south: SouthODBC;
  const configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      remoteAgent: false,
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: null,
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'query1',
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
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          query: 'query2',
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
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          query: 'query3',
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
        scanMode: testData.scanMode.list[1]
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    south = new SouthODBC(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  it('should get data from ODBC without auth', async () => {
    const odbc = {
      connect: jest.fn()
    };
    (loadOdbc as jest.Mock).mockReturnValueOnce(odbc);

    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (convertDateTimeToInstant as jest.Mock).mockImplementation(value => value);
    (formatInstant as jest.Mock).mockImplementation(value => value);
    const odbcConnection = {
      close: jest.fn(),
      query: jest.fn().mockReturnValue([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    const result = await south.queryOdbcData(configuration.items[0], startTime, endTime);

    expect(odbc.connect).toHaveBeenCalledWith({
      connectionString: configuration.settings.connectionString,
      connectionTimeout: configuration.settings.connectionTimeout
    });
    expect(logger.debug).toHaveBeenCalledWith(`Connecting with connection string ${configuration.settings.connectionString}`);

    expect(result).toEqual('2020-03-01T00:00:00.000Z');
    expect(persistResults).toHaveBeenCalledWith(
      [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
      configuration.items[0].settings.serialization,
      configuration.name,
      configuration.items[0].name,
      path.resolve('cacheFolder', 'tmp'),
      expect.any(Function),
      logger
    );
  });

  it('should manage connection error', async () => {
    const odbc = {
      connect: jest.fn()
    };
    (loadOdbc as jest.Mock).mockReturnValueOnce(odbc);

    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (odbc.connect as jest.Mock).mockImplementation(() => {
      throw new Error('connection error');
    });

    let error;
    try {
      await south.queryOdbcData(configuration.items[0], startTime, endTime);
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
  let south: SouthODBC;
  const configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      remoteAgent: false,
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'query1',
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
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          query: 'query2',
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
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          query: 'query3',
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
        scanMode: testData.scanMode.list[1]
      }
    ]
  };

  class NodeOdbcError extends Error {
    constructor(
      message: string,
      private odbcErrors: Array<{ code: number; message: string; state: string }> = []
    ) {
      super();
      this.name = 'ODBCError';
      this.message = message;
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
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    south = new SouthODBC(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  it('Database is reachable and has tables', async () => {
    const odbc = {
      connect: jest.fn()
    };
    (loadOdbc as jest.Mock).mockReturnValueOnce(odbc);
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

  it.each(flattenedErrors)(
    'Unable to create connection with $driver, error code $error.driverError.odbcErrors.0.code',
    async driverTest => {
      const odbc = {
        connect: jest.fn()
      };
      (loadOdbc as jest.Mock).mockReturnValueOnce(odbc);

      (odbc.connect as jest.Mock).mockImplementationOnce(() => {
        throw driverTest.error.driverError;
      });
      configuration.settings.connectionString = `Driver=${driverTest.driver}`;

      await expect(south.testConnection()).rejects.toThrow(`${driverTest.error.expectedError.message}`);
    }
  );

  it('Could not load driver', async () => {
    const odbc = {
      connect: jest.fn()
    };
    (loadOdbc as jest.Mock).mockReturnValueOnce(odbc);
    configuration.settings.connectionString = `Driver=Unknown driver`;

    const error = new NodeOdbcError(connectionErrorMessage, [{ code: -1, message: 'Driver not found', state: 'IM002' }]);
    (odbc.connect as jest.Mock).mockImplementation(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Driver not found. Check connection string and driver`));
  });

  it('Could not load driver', async () => {
    (loadOdbc as jest.Mock).mockReturnValueOnce(null);

    await expect(south.testConnection()).rejects.toThrow('ODBC library not available');
  });

  it('Unable to connect to database without password', async () => {
    const odbc = {
      connect: jest.fn()
    };
    (loadOdbc as jest.Mock).mockReturnValueOnce(odbc);
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
  let south: SouthODBC;
  const configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      remoteAgent: true,
      agentUrl: 'http://localhost:2224',
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'query1',
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
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          query: 'query2',
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
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          query: 'query3',
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
        scanMode: testData.scanMode.list[1]
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (convertDateTimeToInstant as jest.Mock).mockImplementation(value => value);
    (convertDelimiter as jest.Mock).mockImplementation(value => value);

    south = new SouthODBC(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  it('should properly connect to remote agent and disconnect ', async () => {
    await south.connect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/connect` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: configuration.settings.connectionString,
          connectionTimeout: configuration.settings.connectionTimeout
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    await south.disconnect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/disconnect` }),
      {
        method: 'DELETE'
      }
    );
  });

  it('should properly reconnect to when connection fails ', async () => {
    (HTTPRequest as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connection failed');
    });

    await south.connect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/connect` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: configuration.settings.connectionString,
          connectionTimeout: configuration.settings.connectionTimeout
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(HTTPRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(HTTPRequest).toHaveBeenCalledTimes(2);
  });

  it('should properly clear reconnect timeout on disconnect', async () => {
    (HTTPRequest as unknown as jest.Mock)
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

    expect(HTTPRequest).toHaveBeenCalledTimes(1);
    await south.connect();

    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(HTTPRequest).toHaveBeenCalledTimes(3);
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

    await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
    expect(south.queryRemoteAgentData).toHaveBeenCalledTimes(3);
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(configuration.items[0], startTime, testData.constants.dates.FAKE_NOW);
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(configuration.items[1], startTime, testData.constants.dates.FAKE_NOW);
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(configuration.items[2], startTime, testData.constants.dates.FAKE_NOW);
  });

  it('should get data from Remote agent', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(
        createMockResponse(200, {
          recordCount: 2,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
          maxInstant: '2020-03-01T00:00:00.000Z'
        })
      )
      .mockResolvedValueOnce(
        createMockResponse(200, {
          recordCount: 0,
          content: [],
          maxInstant: '2020-03-01T00:00:00.000Z'
        })
      );
    (formatInstant as jest.Mock).mockImplementation(value => value);

    const result = await south.queryRemoteAgentData(configuration.items[0], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(configuration.items[0].settings.query, startTime, endTime, logger);

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/read` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: configuration.settings.connectionString,
          sql: configuration.items[0].settings.query,
          readTimeout: configuration.settings.requestTimeout,
          timeColumn: configuration.items[0].settings.dateTimeFields![1].fieldName,
          datasourceTimestampFormat: configuration.items[0].settings.dateTimeFields![1].format,
          datasourceTimezone: configuration.items[0].settings.dateTimeFields![1].timezone,
          delimiter: configuration.items[0].settings.serialization.delimiter,
          outputTimestampFormat: configuration.items[0].settings.serialization.outputTimestampFormat,
          outputTimezone: configuration.items[0].settings.serialization.outputTimezone
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(result).toEqual('2020-03-01T00:00:00.000Z');
    expect(persistResults).toHaveBeenCalledWith(
      [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
      {
        type: 'file',
        filename: configuration.items[0].settings.serialization.filename,
        compression: configuration.items[0].settings.serialization.compression
      },
      configuration.name,
      configuration.items[0].name,
      path.resolve('cacheFolder', 'tmp'),
      expect.any(Function),
      logger
    );

    await south.queryRemoteAgentData(configuration.items[0], startTime, endTime);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${configuration.items[0].name}. Request done in 0 ms`);
  });

  it('should get data from Remote agent without datetime reference', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (HTTPRequest as jest.Mock).mockResolvedValueOnce(
      createMockResponse(200, {
        recordCount: 2,
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
        maxInstantRetrieved: startTime
      })
    );

    const result = await south.queryRemoteAgentData(configuration.items[1], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(configuration.items[1].settings.query, startTime, endTime, logger);

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/odbc/${configuration.id}/read` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: configuration.settings.connectionString,
          sql: configuration.items[1].settings.query,
          readTimeout: configuration.settings.requestTimeout,
          delimiter: configuration.items[1].settings.serialization.delimiter,
          outputTimestampFormat: configuration.items[1].settings.serialization.outputTimestampFormat,
          outputTimezone: configuration.items[1].settings.serialization.outputTimezone
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(result).toEqual(null);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(400, 'bad request')).mockResolvedValueOnce(createMockResponse(500));

    await expect(south.queryRemoteAgentData(configuration.items[0], startTime, endTime)).rejects.toThrow(
      `Error occurred when querying remote agent with status 400: "bad request"`
    );
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when querying remote agent with status 400: "bad request"`);

    await expect(south.queryRemoteAgentData(configuration.items[0], startTime, endTime)).rejects.toThrow(
      `Error occurred when querying remote agent with status 500`
    );
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when querying remote agent with status 500`);
  });

  it('should test item with queryRemoteAgentData', async () => {
    south.queryRemoteAgentData = jest.fn().mockReturnValue([
      [
        {
          timestamp: '2020-02-01T00:00:00.000Z',
          table_count: 2
        },
        { timestamp: '2020-03-01T00:00:00.000Z' }
      ]
    ]);

    await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
    expect(south.queryRemoteAgentData).toHaveBeenCalled();
  });

  it('QueryRemoteAgentData in case of item test', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (HTTPRequest as jest.Mock).mockResolvedValueOnce(
      createMockResponse(200, {
        recordCount: 0,
        content: [],
        maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
      })
    );

    await south.queryRemoteAgentData(configuration.items[0], startTime, endTime, true);
    expect(HTTPRequest).toHaveBeenCalled();
  });
});

describe('SouthODBC odbc remote test connection', () => {
  let south: SouthODBC;
  const configuration: SouthConnectorEntity<SouthODBCSettings, SouthODBCItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      remoteAgent: true,
      agentUrl: 'http://localhost:2224',
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'query1',
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
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          query: 'query2',
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
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          query: 'query3',
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
        scanMode: testData.scanMode.list[1]
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    south = new SouthODBC(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  it('should test connection successfully', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, 'bad request'));
    await expect(south.testConnection()).resolves.not.toThrow();
  });

  it('should test connection fail', async () => {
    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(createMockResponse(400, 'bad request'))
      .mockResolvedValueOnce(createMockResponse(500, 'another error'));
    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Error occurred when sending connect command to remote agent with status 400: "bad request"`)
    );

    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Error occurred when sending connect command to remote agent with status 500`)
    );
  });
});
