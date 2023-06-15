import path from 'node:path';

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
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { DateTime } from 'luxon';

jest.mock('../../service/utils');
const mockDatabase = new DatabaseMock();
jest.mock('better-sqlite3', () => () => mockDatabase);

const database = new DatabaseMock();
jest.mock(
  '../../service/cache.service',
  () =>
    function () {
      return {
        createCacheHistoryTable: jest.fn(),
        southCacheRepository: {
          database
        },
        updateMetrics: jest.fn()
      };
    }
);

const addValues = jest.fn();
const addFile = jest.fn();

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);

const items: Array<OibusItemDTO> = [
  {
    id: 'id1',
    name: 'item1',
    connectorId: 'southId',
    settings: {
      query: 'SELECT * FROM table WHERE timestamp > @StartTime and timestamp < @EndTime',
      serialization: {
        type: 'file',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        datetimeSerialization: [
          { field: 'aaa', useAsReference: false, datetimeFormat: { type: 'unix-epoch-ms', timezone: 'Europe/Paris' } },
          {
            field: 'timestamp',
            useAsReference: true,
            datetimeFormat: { type: 'specific-string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
          }
        ]
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
      serialization: {
        type: 'file',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        datetimeSerialization: [
          { field: 'aaa', useAsReference: false, datetimeFormat: { type: 'unix-epoch-ms', timezone: 'Europe/Paris' } },
          {
            field: 'timestamp',
            useAsReference: true,
            datetimeFormat: { type: 'specific-string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
          }
        ]
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
      serialization: {
        type: 'file',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        datetimeSerialization: [
          { field: 'aaa', useAsReference: false, datetimeFormat: { type: 'unix-epoch-ms', timezone: 'Europe/Paris' } },
          {
            field: 'timestamp',
            useAsReference: true,
            datetimeFormat: { type: 'specific-string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
          }
        ]
      }
    },
    scanModeId: 'scanModeId2'
  }
];

const nowDateString = '2020-02-02T02:02:02.222Z';
let south: SouthSQLite;

describe('SouthSQLite', () => {
  const configuration: SouthConnectorDTO = {
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
      databasePath: './database.db',
      compression: false
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.getMaxInstant as jest.Mock).mockReturnValue(new Date(nowDateString));
    (utils.generateReplacementParameters as jest.Mock).mockReturnValue([new Date(nowDateString), new Date(nowDateString)]);
    (utils.replaceFilenameWithVariable as jest.Mock).mockReturnValue('myFile');

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

  it('should test connection with sqlite', async () => {
    // TODO
    await expect(SouthSQLite.testConnection({}, logger)).rejects.toThrow('TODO: method needs to be implemented');
    expect(logger.trace).toHaveBeenCalledWith(`Testing connection`);
  });

  it('should properly run historyQuery', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    south.getDataFromSqlite = jest
      .fn()
      .mockReturnValueOnce([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
      .mockReturnValue([]);

    (utils.getMaxInstant as jest.Mock).mockReturnValue('2020-03-01T00:00:00.000Z');

    await south.historyQuery(items, startTime, nowDateString);
    expect(utils.serializeResults).toHaveBeenCalledTimes(1);
    expect(utils.getMaxInstant).toHaveBeenCalledTimes(1);
    expect(south.getDataFromSqlite).toHaveBeenCalledTimes(3);
    expect(south.getDataFromSqlite).toHaveBeenCalledWith(items[0], startTime, nowDateString);
    expect(south.getDataFromSqlite).toHaveBeenCalledWith(items[1], '2020-03-01T00:00:00.000Z', nowDateString);
    expect(south.getDataFromSqlite).toHaveBeenCalledWith(items[2], '2020-03-01T00:00:00.000Z', nowDateString);

    expect(logger.info).toHaveBeenCalledWith(`Found 2 results for item ${items[0].name} in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[1].name}. Request done in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[2].name}. Request done in 0 ms`);
  });

  it('should get data from sqlite', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    all.mockReturnValue([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    (utils.convertDateTimeFromISO as jest.Mock)
      .mockReturnValueOnce(DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'))
      .mockReturnValueOnce(DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'));

    (mockDatabase.prepare as jest.Mock).mockReturnValue({ all });
    const result = await south.getDataFromSqlite(items[0], startTime, endTime);

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
      await south.getDataFromSqlite(items[1], startTime, endTime);
    } catch (err) {
      error = err;
    }

    expect(error).toEqual(new Error('query error'));
  });

  it('should keep iso string format if serialization is not found', () => {
    const result = south.formatDatetimeVariables(nowDateString, null);
    expect(result).toEqual(nowDateString);
  });
});
