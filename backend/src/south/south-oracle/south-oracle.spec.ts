import path from 'node:path';

import SouthOracle from './south-oracle';
import * as utils from '../../service/utils';
import { generateReplacementParameters } from '../../service/utils';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';

import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { SouthConnectorItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import oracledb from 'oracledb';
import { DateTime } from 'luxon';
import {
  SouthOracleItemSettings,
  SouthOracleItemSettingsDateTimeFields,
  SouthOracleSettings
} from '../../../../shared/model/south-settings.model';

jest.mock('oracledb');
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
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);
const items: Array<SouthConnectorItemDTO<SouthOracleItemSettings>> = [
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
        } as unknown as SouthOracleItemSettingsDateTimeFields,
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
        } as unknown as SouthOracleItemSettingsDateTimeFields,
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
        } as unknown as SouthOracleItemSettingsDateTimeFields,
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
let south: SouthOracle;

describe('SouthOracle with authentication', () => {
  const connector: SouthConnectorDTO<SouthOracleSettings> = {
    id: 'southId',
    name: 'south',
    type: 'oracle',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      host: 'localhost',
      port: 1521,
      database: 'db',
      username: 'username',
      password: 'password',
      connectionTimeout: 1000,
      requestTimeout: 1000
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.generateReplacementParameters as jest.Mock).mockReturnValue([new Date(nowDateString), new Date(nowDateString)]);

    south = new SouthOracle(
      connector,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true
    );
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

  it('should get data from Oracle', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (generateReplacementParameters as jest.Mock).mockReturnValue({
      startTime: DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      endTime: DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS')
    });
    const oracleConnection = {
      callTimeout: connector.settings.requestTimeout,
      close: jest.fn(),
      execute: jest
        .fn()
        .mockReturnValueOnce({
          rows: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
        })
        .mockReturnValue({ rows: null })
    };
    (oracledb.getConnection as jest.Mock).mockReturnValue(oracleConnection);
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

    expect(oracledb.getConnection).toHaveBeenCalledWith({
      user: 'username',
      password: 'password',
      connectString: `${connector.settings.host}:${connector.settings.port}/${connector.settings.database}`
    });
    expect(generateReplacementParameters).toHaveBeenCalledWith(
      items[0].settings.query,
      DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS')
    );
    expect(oracleConnection.execute).toHaveBeenCalledWith(
      items[0].settings.query.replace(/@StartTime/g, ':date1').replace(/@EndTime/g, ':date2'),
      {
        startTime: DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
        endTime: DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS')
      }
    );
    expect(oracleConnection.close).toHaveBeenCalledTimes(1);

    expect(result).toEqual([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);

    const nullResult = await south.queryData(items[0], startTime, endTime);
    expect(nullResult).toEqual([]);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (generateReplacementParameters as jest.Mock).mockReturnValue({ startTime, endTime });
    const oracleConnection = {
      callTimeout: connector.settings.requestTimeout,
      close: jest.fn(),
      execute: jest.fn().mockImplementation(() => {
        throw new Error('query error');
      })
    };
    (oracledb.getConnection as jest.Mock).mockReturnValue(oracleConnection);

    let error;
    try {
      await south.queryData(items[0], startTime, endTime);
    } catch (err) {
      error = err;
    }

    expect(oracleConnection.execute).toHaveBeenCalledWith(
      items[0].settings.query.replace(/@StartTime/g, ':date1').replace(/@EndTime/g, ':date2'),
      {
        startTime,
        endTime
      }
    );
    expect(error).toEqual(new Error('query error'));
    expect(oracleConnection.close).toHaveBeenCalledTimes(1);
  });
});

describe('SouthOracle without authentication', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'oracle',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
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

    south = new SouthOracle(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true
    );
  });

  it('should manage connection error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (oracledb.getConnection as jest.Mock).mockImplementation(() => {
      throw new Error('connection error');
    });

    let error;
    try {
      await south.queryData(items[0], startTime, endTime);
    } catch (err) {
      error = err;
    }

    expect(oracledb.getConnection).toHaveBeenCalledWith({
      user: '',
      password: '',
      connectString: `${configuration.settings.host}:${configuration.settings.port}/${configuration.settings.database}`
    });
    expect(error).toEqual(new Error('connection error'));
  });
});

describe('SouthOracle test connection', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'oracle',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      host: 'localhost',
      port: 1521,
      database: 'db',
      username: 'username',
      password: 'password',
      connectionTimeout: 1000,
      requestTimeout: 1000,
      compression: false
    }
  };
  const settings = { ...configuration.settings };

  // Error codes handled by the test function
  // With the expected error messages to throw
  const ERROR_CODES = {
    'NJS-515': 'Please check host and port',
    'NJS-503': 'Please check host and port',
    'ORA-01017': 'Please check username and password',
    'NJS-518': `Cannot connect to database '${settings.database}'. Service is not registered`,
    DEFAULT: 'Please check logs' // For exceptions that we aren't explicitly specifying
  } as const;

  type ErrorCodes = keyof typeof ERROR_CODES;

  class OracleDBError extends Error {
    private code: ErrorCodes;

    constructor(message: string, code: ErrorCodes) {
      super();
      this.name = 'SouthOracleError';
      this.message = message;
      this.code = code;
    }
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
  });

  it('Database is reachable and has tables', async () => {
    const result = [{ table_name: 'logs', columns: 'data(INTEGER), timestamp(datetime)' }];
    const oracleConnection = {
      execute: jest.fn().mockReturnValueOnce({ rows: result }),
      ping: jest.fn(),
      close: jest.fn()
    };
    (oracledb.getConnection as jest.Mock).mockReturnValue(oracleConnection);

    const test = SouthOracle.testConnection(settings, logger, encryptionService);
    await expect(test).resolves.not.toThrow();

    expect(oracleConnection.close).toBeCalled();
    expect((logger.trace as jest.Mock).mock.calls).toEqual([
      [`Testing if Oracle connection settings are correct`],
      [`Pinging the database`],
      [`Testing system table query`]
    ]);

    const tables = result.map((row: any) => `${row.table_name}: [${row.columns}]`).join(',\n');
    expect(logger.info).toHaveBeenCalledWith('Database is live with tables (table:[columns]):\n%s', tables);
  });

  it('Unable to create connection', async () => {
    let code: ErrorCodes;
    const errorMessage = 'Error creating connection';

    for (code in ERROR_CODES) {
      (logger.error as jest.Mock).mockClear();
      (logger.trace as jest.Mock).mockClear();
      (oracledb.getConnection as jest.Mock).mockImplementationOnce(() => {
        throw new OracleDBError(errorMessage, code);
      });

      const test = SouthOracle.testConnection(settings, logger, encryptionService);
      await expect(test).rejects.toThrow(new Error(ERROR_CODES[code]));

      expect((logger.error as jest.Mock).mock.calls).toEqual([[`Unable to connect to database: ${errorMessage}`]]);
      expect((logger.trace as jest.Mock).mock.calls).toEqual([[`Testing if Oracle connection settings are correct`]]);
    }
  });

  it('Unable to ping database', async () => {
    let code: ErrorCodes;
    const errorMessage = 'Error pinging database';

    for (code in ERROR_CODES) {
      (logger.error as jest.Mock).mockClear();
      (logger.trace as jest.Mock).mockClear();
      const oracleConnection = {
        ping: () => {
          throw new OracleDBError(errorMessage, code);
        },
        close: jest.fn()
      };
      (oracledb.getConnection as jest.Mock).mockReturnValue(oracleConnection);

      const test = SouthOracle.testConnection(settings, logger, encryptionService);
      await expect(test).rejects.toThrow(new Error(ERROR_CODES[code]));

      expect(oracleConnection.close).toBeCalled();
      expect((logger.error as jest.Mock).mock.calls).toEqual([[`Unable to connect to database: ${errorMessage}`]]);
      expect((logger.trace as jest.Mock).mock.calls).toEqual([
        [`Testing if Oracle connection settings are correct`],
        [`Pinging the database`]
      ]);
    }
  });

  it('System table unreachable', async () => {
    const errorMessage = 'ALL_TABLES does not exist';
    const oracleConnection = {
      execute: jest.fn().mockImplementationOnce(() => {
        throw new Error(errorMessage);
      }),
      ping: jest.fn(),
      close: jest.fn()
    };
    (oracledb.getConnection as jest.Mock).mockReturnValue(oracleConnection);
    const test = SouthOracle.testConnection(settings, logger, encryptionService);

    await expect(test).rejects.toThrow(new Error(`Unable to read tables in database '${settings.database}', check logs`));

    expect(oracleConnection.close).toBeCalled();
    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Unable to read tables in database '${settings.database}': ${errorMessage}`]]);
    expect((logger.trace as jest.Mock).mock.calls).toEqual([
      [`Testing if Oracle connection settings are correct`],
      [`Pinging the database`],
      [`Testing system table query`]
    ]);
  });

  it('Database has no tables', async () => {
    const oracleConnection = {
      execute: jest.fn().mockReturnValueOnce({ rows: [] }),
      ping: jest.fn(),
      close: jest.fn()
    };
    (oracledb.getConnection as jest.Mock).mockReturnValue(oracleConnection);

    const test = SouthOracle.testConnection(settings, logger, encryptionService);

    await expect(test).rejects.toThrow(new Error(`No tables in the '${settings.username}' schema`));

    expect(oracleConnection.close).toBeCalled();
    expect((logger.warn as jest.Mock).mock.calls).toEqual([[`No tables in the '${settings.username}' schema`]]);
    expect((logger.trace as jest.Mock).mock.calls).toEqual([
      [`Testing if Oracle connection settings are correct`],
      [`Pinging the database`],
      [`Testing system table query`]
    ]);
  });

  it('Unable to ping database without password', async () => {
    configuration.settings.password = '';
    let code: ErrorCodes;
    const errorMessage = 'Error pinging database';

    for (code in ERROR_CODES) {
      (logger.error as jest.Mock).mockClear();
      (logger.trace as jest.Mock).mockClear();
      const oracleConnection = {
        ping: () => {
          throw new OracleDBError(errorMessage, code);
        },
        close: jest.fn()
      };
      (oracledb.getConnection as jest.Mock).mockReturnValue(oracleConnection);

      const test = SouthOracle.testConnection(configuration.settings, logger, encryptionService);
      await expect(test).rejects.toThrow(new Error(ERROR_CODES[code]));
    }
  });
});
