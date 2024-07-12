import path from 'node:path';

import SouthPostgreSQL from './south-postgresql';
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
import pg from 'pg';
import { DateTime } from 'luxon';
import { SouthPostgreSQLItemSettings, SouthPostgreSQLItemSettingsDateTimeFields } from '../../../../shared/model/south-settings.model';

jest.mock('pg');

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
const addValues = jest.fn();
const addFile = jest.fn();

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const items: Array<SouthConnectorItemDTO<SouthPostgreSQLItemSettings>> = [
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
        } as unknown as SouthPostgreSQLItemSettingsDateTimeFields,
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
        outputTimestampFormat: 'yyyy-MM-dd',
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
        outputTimestampFormat: 'yyyy-MM-dd',
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
        } as unknown as SouthPostgreSQLItemSettingsDateTimeFields,
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
        outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss',
        outputTimezone: 'Europe/Paris'
      }
    },
    scanModeId: 'scanModeId2'
  }
];

const nowDateString = '2020-02-02T02:02:02.222Z';
let south: SouthPostgreSQL;

describe('SouthPostgreSQL with authentication', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'postgresql',
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
      port: 5432,
      database: 'db',
      username: 'username',
      password: 'password',
      connectionTimeout: 1000,
      requestTimeout: 1000,
      compression: false
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    (utils.generateReplacementParameters as jest.Mock).mockReturnValue([new Date(nowDateString), new Date(nowDateString)]);

    south = new SouthPostgreSQL(configuration, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
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

  it('should get data from PostgreSQL', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (generateReplacementParameters as jest.Mock).mockReturnValue({
      startTime: DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      endTime: DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS')
    });
    const client = {
      connect: jest.fn(),
      query: jest.fn(() => ({
        rows: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
      })),
      end: jest.fn()
    };
    (pg.Client as unknown as jest.Mock).mockReturnValue(client);
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
    expect(pg.Client).toHaveBeenCalledWith({
      host: configuration.settings.host,
      port: configuration.settings.port,
      user: configuration.settings.username,
      password: configuration.settings.password,
      database: configuration.settings.database,
      connectionTimeoutMillis: configuration.settings.connectionTimeout,
      query_timeout: configuration.settings.requestTimeout
    });
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(items[0].settings.query.replace(/@StartTime/g, '$1').replace(/@EndTime/g, '$2'), {
      startTime: DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      endTime: DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS')
    });
    expect(client.end).toHaveBeenCalledTimes(1);
    expect(generateReplacementParameters).toHaveBeenCalledWith(
      items[0].settings.query,
      DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS')
    );

    expect(result).toEqual([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });

  it('should get data from postgre without reference', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const client = {
      connect: jest.fn(),
      query: jest.fn(() => ({
        rows: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
      })),
      end: jest.fn()
    };
    (pg.Client as unknown as jest.Mock).mockReturnValue(client);
    const result = await south.queryData(items[1], startTime, endTime);
    expect(utils.formatInstant).not.toHaveBeenCalled();
    expect(utils.logQuery).toHaveBeenCalledWith(items[1].settings.query, startTime, endTime, logger);

    expect(result).toEqual([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    pg.types.setTypeParser = jest.fn();
    (generateReplacementParameters as jest.Mock).mockReturnValue({ startTime, endTime });
    const client = {
      connect: jest.fn(),
      query: jest.fn().mockImplementation(() => {
        throw new Error('query error');
      }),
      end: jest.fn()
    };
    (pg.Client as unknown as jest.Mock).mockReturnValue(client);

    let error;
    try {
      await south.queryData(items[0], startTime, endTime);
    } catch (err) {
      error = err;
    }

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(items[0].settings.query.replace(/@StartTime/g, '$1').replace(/@EndTime/g, '$2'), {
      startTime,
      endTime
    });
    expect(error).toEqual(new Error('query error'));

    expect(client.end).toHaveBeenCalledTimes(1);
  });
});

describe('SouthPostgreSQL without authentication', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'postgresql',
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
      port: 1521,
      database: 'db',
      username: '',
      password: '',
      connectionTimeout: 1000,
      requestTimeout: 1000,
      compression: false
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    south = new SouthPostgreSQL(configuration, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should manage connection error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    pg.types.setTypeParser = jest.fn();
    (generateReplacementParameters as jest.Mock).mockReturnValue({ startTime, endTime });

    (pg.Client as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('connection error');
    });

    let error;
    try {
      await south.queryData(items[0], startTime, endTime);
    } catch (err) {
      error = err;
    }

    expect(error).toEqual(new Error('connection error'));
  });
});

describe('SouthPostgreSQL test connection', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'postgresql',
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
      port: 5432,
      database: 'db',
      username: 'username',
      password: 'password',
      connectionTimeout: 1000,
      requestTimeout: 1000,
      compression: false
    }
  };

  // Error messages handled by the test function
  // With the expected error messages to throw
  // Note: The PostgreSQL connect function throws errors with no codes,
  //       so messages are used to distinguish the cases
  const ERROR_MESSAGES = {
    'timeout expired': 'Please check host and port.',
    'connect ECONNREFUSED ::1:1234': 'Please check host and port.',
    'password authentication failed for user "username"': 'Please check username and password.',
    'database "db" does not exist': `Database "${configuration.settings.database}" does not exist.`,
    DEFAULT: 'Unexpected error.' // For exceptions that we aren't explicitly specifying
  } as const;

  type ErrorMessages = keyof typeof ERROR_MESSAGES;

  class PGError extends Error {
    constructor(message: ErrorMessages) {
      super();
      this.name = 'PGError';
      this.message = message;
    }
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    south = new SouthPostgreSQL(configuration, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('Database is reachable and has tables', async () => {
    const result = [{ table_count: 21 }];
    const client = {
      connect: jest.fn(),
      query: jest.fn(() => ({ rows: result })),
      end: jest.fn()
    };
    (pg.Client as unknown as jest.Mock).mockReturnValue(client);

    await expect(south.testConnection()).resolves.not.toThrow();

    expect(client.end).toHaveBeenCalled();
  });

  it('Unable to create connection', async () => {
    let errorMessage: ErrorMessages;

    for (errorMessage in ERROR_MESSAGES) {
      (logger.error as jest.Mock).mockClear();
      (logger.info as jest.Mock).mockClear();
      (pg.Client as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new PGError(errorMessage);
      });

      await expect(south.testConnection()).rejects.toThrow(new Error(`${ERROR_MESSAGES[errorMessage]} ${errorMessage}`));
    }
  });

  it('System table unreachable', async () => {
    const errorMessage = 'information_schema.TABLES does not exist';
    const client = {
      connect: jest.fn(),
      query: jest.fn().mockImplementationOnce(() => {
        throw new Error(errorMessage);
      }),
      end: jest.fn()
    };
    (pg.Client as unknown as jest.Mock).mockReturnValue(client);

    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Unable to read tables in database "${configuration.settings.database}". ${errorMessage}`)
    );

    expect(client.end).toHaveBeenCalled();
  });

  it('Database has no tables', async () => {
    const client = {
      connect: jest.fn(),
      query: jest.fn().mockReturnValueOnce({ rows: [{ table_count: 0 }] }),
      end: jest.fn()
    };
    (pg.Client as unknown as jest.Mock).mockReturnValue(client);

    await expect(south.testConnection()).rejects.toThrow(new Error(`Database "${configuration.settings.database}" has no tables`));
    expect(client.end).toHaveBeenCalled();
  });

  it('Database does not return count of tables', async () => {
    const client = {
      connect: jest.fn(),
      query: jest.fn().mockReturnValueOnce({ rows: [] }),
      end: jest.fn()
    };
    (pg.Client as unknown as jest.Mock).mockReturnValue(client);

    await expect(south.testConnection()).rejects.toThrow(new Error(`Database "${configuration.settings.database}" has no tables`));

    expect(client.end).toHaveBeenCalled();
  });

  it('Unable to connect to database without password', async () => {
    configuration.settings.password = '';
    let errorMessage: ErrorMessages;

    for (errorMessage in ERROR_MESSAGES) {
      const client = {
        connect: () => {
          throw new PGError(errorMessage);
        },
        query: jest.fn().mockReturnValueOnce([[]]),
        end: jest.fn()
      };
      (pg.Client as unknown as jest.Mock).mockReturnValue(client);

      await expect(south.testConnection()).rejects.toThrow(new Error(`${ERROR_MESSAGES[errorMessage]} ${errorMessage}`));
    }
  });
});
