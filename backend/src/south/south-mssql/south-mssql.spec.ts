import path from 'node:path';

import SouthMSSQL from './south-mssql';
import * as utils from '../../service/utils';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';

import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/service/repository-service.mock';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import mssql, { ConnectionPool } from 'mssql';
import {
  SouthMSSQLItemSettings,
  SouthMSSQLItemSettingsDateTimeFields,
  SouthMSSQLSettings
} from '../../../../shared/model/south-settings.model';

jest.mock('mssql');
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
const items: Array<SouthConnectorItemDTO<SouthMSSQLItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    connectorId: 'southId',
    settings: {
      query: 'SELECT * FROM table WHERE timestamp > @StartTime AND timestamp < @EndTime',
      dateTimeFields: [
        {
          fieldName: 'anotherTimestamp',
          useAsReference: false,
          type: 'unix-epoch-ms',
          timezone: null,
          format: null,
          locale: null
        } as unknown as SouthMSSQLItemSettingsDateTimeFields,
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
        } as unknown as SouthMSSQLItemSettingsDateTimeFields,
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
let south: SouthMSSQL;

const query = jest.fn<{ recordsets: Record<string, any>[][] }, [], any>(() => ({
  recordsets: [[{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]]
}));
const input = jest.fn();
const close = jest.fn();
const request = jest.fn(() => ({ input, query }));
const connect = jest.fn(() => ({ request, close }));
describe('SouthMSSQL with authentication', () => {
  const configuration: SouthConnectorDTO<SouthMSSQLSettings> = {
    id: 'southId',
    name: 'south',
    type: 'mssql',
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
      port: 1433,
      database: 'db',
      username: 'username',
      password: 'password',
      domain: 'domain',
      encryption: false,
      connectionTimeout: 1000,
      requestTimeout: 1000,
      trustServerCertificate: true
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.findById = jest.fn().mockReturnValue(configuration);

    jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect }) as unknown as ConnectionPool);

    south = new SouthMSSQL(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
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

    await south.historyQuery(items, startTime, nowDateString, startTime);
    expect(utils.persistResults).toHaveBeenCalledTimes(2);
    expect(south.queryData).toHaveBeenCalledTimes(3);
    expect(south.queryData).toHaveBeenCalledWith(items[0], '2020-01-01T00:00:00.000Z', '2020-02-02T02:02:02.222Z');
    expect(south.queryData).toHaveBeenCalledWith(items[1], '2020-03-01T00:00:00.000Z', '2020-02-02T02:02:02.222Z');
    expect(south.queryData).toHaveBeenCalledWith(items[2], '2020-03-01T00:00:00.000Z', '2020-02-02T02:02:02.222Z');

    expect(logger.info).toHaveBeenCalledWith(`Found 2 results for item ${items[0].name} in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[2].name}. Request done in 0 ms`);
  });

  it('should get data from MSSQL', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (utils.formatInstant as jest.Mock)
      .mockReturnValueOnce('2020-01-01 00:00:00.000')
      .mockReturnValueOnce('2022-01-01 00:00:00.000')
      .mockReturnValue(startTime);

    const result = await south.queryData(items[0], startTime, endTime);

    expect(utils.formatInstant).toHaveBeenCalledTimes(2);
    expect(utils.formatInstant).toHaveBeenCalledWith(startTime, {
      fieldName: 'timestamp',
      useAsReference: true,
      format: 'yyyy-MM-dd HH:mm:ss.SSS',
      locale: 'en-US',
      timezone: 'Europe/Paris',
      type: 'string'
    });
    expect(utils.formatInstant).toHaveBeenCalledWith(endTime, {
      fieldName: 'timestamp',
      useAsReference: true,
      format: 'yyyy-MM-dd HH:mm:ss.SSS',
      locale: 'en-US',
      timezone: 'Europe/Paris',
      type: 'string'
    });
    // startTime and endTime has been converted according to item 0 serialization settings
    expect(utils.logQuery).toHaveBeenCalledWith(items[0].settings.query, '2020-01-01 00:00:00.000', '2022-01-01 00:00:00.000', logger);

    expect(mssql.ConnectionPool).toHaveBeenCalledWith({
      user: configuration.settings.username,
      password: 'password',
      server: configuration.settings.host,
      port: configuration.settings.port,
      database: configuration.settings.database,
      connectionTimeout: configuration.settings.connectionTimeout,
      requestTimeout: configuration.settings.requestTimeout,
      options: {
        trustServerCertificate: configuration.settings.trustServerCertificate,
        encrypt: configuration.settings.encryption,
        useUTC: true
      },
      domain: configuration.settings.domain
    });
    expect(input).toHaveBeenCalledWith('StartTime', '2020-01-01 00:00:00.000');
    expect(input).toHaveBeenCalledWith('EndTime', '2022-01-01 00:00:00.000');
    expect(query).toHaveBeenCalledWith(items[0].settings.query);
    expect(close).toHaveBeenCalledTimes(1);

    expect(result).toEqual([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });

  it('should test item', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    south.queryData = jest.fn().mockReturnValueOnce([
      { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
      { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
    ]);
    (utils.formatInstant as jest.Mock).mockReturnValue(startTime);
    (utils.convertDateTimeToInstant as jest.Mock).mockImplementation(instant => instant);

    const callback = jest.fn();
    await south.testItem(items[0], callback);
    expect(south.queryData).toHaveBeenCalled();
  });

  it('should test item without datetimeFields', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    south.queryData = jest.fn().mockReturnValueOnce([
      { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
      { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
    ]);
    (utils.formatInstant as jest.Mock).mockReturnValue(startTime);
    (utils.convertDateTimeToInstant as jest.Mock).mockImplementation(instant => instant);

    const callback = jest.fn();
    await south.testItem(items[1], callback);
    expect(south.queryData).toHaveBeenCalled();
  });
});

describe('SouthMSSQL without authentication', () => {
  const configuration: SouthConnectorDTO<SouthMSSQLSettings> = {
    id: 'southId',
    name: 'south',
    type: 'mssql',
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
      port: 1433,
      database: 'db',
      username: null,
      password: null,
      domain: '',
      encryption: true,
      connectionTimeout: 1000,
      requestTimeout: 1000,
      trustServerCertificate: false
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.findById = jest.fn().mockReturnValue(configuration);

    south = new SouthMSSQL(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    query.mockImplementationOnce(() => {
      throw new Error('query error');
    });
    let error;
    try {
      await south.queryData(items[1], startTime, endTime);
    } catch (err) {
      error = err;
    }
    expect(mssql.ConnectionPool).toHaveBeenCalledWith({
      user: undefined,
      password: undefined,
      server: configuration.settings.host,
      port: configuration.settings.port,
      database: configuration.settings.database,
      connectionTimeout: configuration.settings.connectionTimeout,
      requestTimeout: configuration.settings.requestTimeout,
      options: {
        encrypt: configuration.settings.encryption,
        trustServerCertificate: configuration.settings.trustServerCertificate,
        useUTC: true
      }
    });

    expect(query).toHaveBeenCalledWith(items[1].settings.query);
    expect(input).not.toHaveBeenCalled();
    expect(error).toEqual(new Error('query error'));
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('SouthMSSQL test connection', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'mssql',
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
      port: 1433,
      database: 'db',
      username: 'username',
      password: 'password',
      domain: 'domain',
      encryption: true,
      connectionTimeout: 1000,
      requestTimeout: 1000,
      trustServerCertificate: true
    }
  };

  // Error codes handled by the test function
  // With the expected error messages to throw
  const ERROR_CODES = {
    ETIMEOUT: 'Please check host and port.',
    ESOCKET: 'Please check host and port.',
    ELOGIN: 'Please check username, password and database name.',
    DEFAULT: 'Unable to connect to database.' // For exceptions that we aren't explicitly specifying
  } as const;

  type ErrorCodes = keyof typeof ERROR_CODES;

  class MSSQLError extends Error {
    constructor(
      message: string,
      private code: string
    ) {
      super();
      this.name = 'MSSQLError';
      this.message = message;
    }
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.findById = jest.fn().mockReturnValue(configuration);

    jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect }) as unknown as ConnectionPool);
    south = new SouthMSSQL(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('Database is reachable and has tables', async () => {
    const result = [{ table_count: 21 }];
    query.mockReturnValue({ recordsets: [result] });

    await expect(south.testConnection()).resolves.not.toThrow();

    expect(close).toHaveBeenCalled();
  });

  it('Unable to create connection pool', async () => {
    let code: ErrorCodes;
    const errorMessage = 'Error creating connection pool';

    for (code in ERROR_CODES) {
      jest.spyOn(mssql, 'ConnectionPool').mockImplementationOnce(() => {
        throw new MSSQLError(errorMessage, code);
      });

      await expect(south.testConnection()).rejects.toThrow(new Error(`${ERROR_CODES[code]} ${errorMessage}`));
    }
  });

  it('System table unreachable', async () => {
    const errorMessage = 'INFORMATION_SCHEMA.TABLES does not exist';
    query.mockImplementation(() => {
      throw new Error(errorMessage);
    });
    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Unable to read tables in database "${configuration.settings.database}". ${errorMessage}`)
    );
    expect(close).toHaveBeenCalled();
  });

  it('Database has no tables', async () => {
    query.mockReturnValue({ recordsets: [[{ table_count: 0 }]] });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Database "${configuration.settings.database}" has no tables`));
    expect(close).toHaveBeenCalled();
  });

  it('Database does not return count of tables', async () => {
    query.mockReturnValue({ recordsets: [[]] });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Database "${configuration.settings.database}" has no tables`));
    expect(close).toHaveBeenCalled();
  });

  it('Unable to connect to database without password', async () => {
    configuration.settings.password = '';
    let code: ErrorCodes;
    const errorMessage = 'Error connecting to database';

    for (code in ERROR_CODES) {
      connect.mockImplementationOnce(() => {
        throw new MSSQLError(errorMessage, code);
      });

      await expect(south.testConnection()).rejects.toThrow(new Error(`${ERROR_CODES[code]} ${errorMessage}`));
    }
  });
});
