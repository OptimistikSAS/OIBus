import path from 'node:path';
import fs from 'node:fs/promises';

import SouthSQLite from './south-sqlite';
import * as utils from '../../service/utils';
import DatabaseMock, { all } from '../../tests/__mocks__/database.mock';
import pino from 'pino';

import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import { DateTime } from 'luxon';
import {
  SouthSQLiteItemSettings,
  SouthSQLiteItemSettingsDateTimeFields,
  SouthSQLiteSettings
} from '../../../../shared/model/south-settings.model';

jest.mock('../../service/utils');
jest.mock('node:fs/promises');
const mockDatabase = new DatabaseMock();
jest.mock('better-sqlite3', () => () => mockDatabase);

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

const items: Array<SouthConnectorItemDTO<SouthSQLiteItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    connectorId: 'southId',
    settings: {
      query: 'SELECT * FROM table WHERE timestamp > @StartTime and timestamp < @EndTime',
      dateTimeFields: [
        {
          fieldName: 'anotherTimestamp',
          useAsReference: false,
          type: 'unix-epoch-ms',
          timezone: null,
          format: null,
          locale: null
        } as unknown as SouthSQLiteItemSettingsDateTimeFields,
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
        } as unknown as SouthSQLiteItemSettingsDateTimeFields,
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
        } as unknown as SouthSQLiteItemSettingsDateTimeFields,
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
const configuration: SouthConnectorDTO<SouthSQLiteSettings> = {
  id: 'southId',
  name: 'south',
  type: 'sqlite',
  description: 'my test connector',
  enabled: true,
  history: {
    maxInstantPerItem: true,
    maxReadInterval: 3600,
    readDelay: 0
  },
  settings: {
    databasePath: './database.db'
  }
};

const nowDateString = '2020-02-02T02:02:02.222Z';
let south: SouthSQLite;

describe('SouthSQLite', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.generateReplacementParameters as jest.Mock).mockReturnValue([new Date(nowDateString), new Date(nowDateString)]);

    south = new SouthSQLite(
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

  it('should get data from sqlite', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    all.mockReturnValue([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    (utils.formatInstant as jest.Mock)
      .mockReturnValueOnce(DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'))
      .mockReturnValueOnce(DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'));

    (mockDatabase.prepare as jest.Mock).mockReturnValue({ all });
    const result = await south.queryData(items[0], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(
      items[0].settings.query,
      DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      logger
    );

    expect(result).toEqual([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    all.mockImplementation(() => {
      throw new Error('query error');
    });

    let error;
    try {
      await south.queryData(items[1], startTime, endTime);
    } catch (err) {
      error = err;
    }

    expect(error).toEqual(new Error('query error'));
  });
});

describe('SouthSQLite test connection', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
  });

  const settings = { ...configuration.settings };
  const dbPath = path.resolve(settings.databasePath);

  it('Database is reachable and has tables', async () => {
    const result = [{ tbl_name: 'logs', columns: 'data(INTEGER), timestamp(datetime)' }];
    all.mockReturnValue(result);
    (mockDatabase.prepare as jest.Mock).mockReturnValue({ all });

    const test = SouthSQLite.testConnection(settings, logger, encryptionService);
    await expect(test).resolves.not.toThrow();

    expect((logger.trace as jest.Mock).mock.calls).toEqual([
      ['Testing if SQLite file exists'],
      ['Testing connection to SQLite system table']
    ]);

    const tables = result.map((row: any) => `${row.tbl_name}: [${row.columns}]`).join(',\n');
    expect(logger.info).toHaveBeenCalledWith('Database is live with tables (table:[columns]):\n%s', tables);
  });

  it('Database file does not exist', async () => {
    const errorMessage = 'File does not exist';
    (fs.access as jest.Mock).mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });

    const test = SouthSQLite.testConnection(settings, logger, encryptionService);
    await expect(test).rejects.toThrowError(`File '${dbPath}' does not exist`);

    expect((logger.trace as jest.Mock).mock.calls).toEqual([['Testing if SQLite file exists']]);
    expect(logger.error as jest.Mock).toBeCalledWith(`Access error on '${dbPath}': ${errorMessage}`);
  });

  it('Database connection error', async () => {
    const errorMessage = `Can't query database`;
    (mockDatabase.prepare as jest.Mock).mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });

    const test = SouthSQLite.testConnection(settings, logger, encryptionService);
    await expect(test).rejects.toThrowError('Error testing database connection, check logs');

    expect((logger.trace as jest.Mock).mock.calls).toEqual([
      ['Testing if SQLite file exists'],
      ['Testing connection to SQLite system table']
    ]);
    expect(logger.error as jest.Mock).toHaveBeenCalledWith(`Unable to query system table: ${errorMessage}`);
  });

  it('Database has no tables', async () => {
    all.mockReturnValue([]);
    (mockDatabase.prepare as jest.Mock).mockReturnValue({ all });

    const test = SouthSQLite.testConnection(settings, logger, encryptionService);
    await expect(test).rejects.toThrowError('Database has no tables');

    expect((logger.trace as jest.Mock).mock.calls).toEqual([
      ['Testing if SQLite file exists'],
      ['Testing connection to SQLite system table']
    ]);
    expect(logger.warn as jest.Mock).toHaveBeenCalledWith(`Database '${dbPath}' has no tables`);
  });
});
