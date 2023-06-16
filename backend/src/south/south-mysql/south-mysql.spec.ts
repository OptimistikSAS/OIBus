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
import ProxyService from '../../service/proxy.service';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import mysql from 'mysql2/promise';

jest.mock('mysql2/promise');
jest.mock('../../service/utils');

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
      query: 'SELECT * FROM table',
      serialization: {
        type: 'file',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        dateTimeOutputFormat: { type: 'iso-8601-string' },
        datetimeSerialization: [
          { field: 'anotherTimestamp', useAsReference: false, datetimeFormat: { type: 'unix-epoch-ms', timezone: 'Europe/Paris' } },
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
        dateTimeOutputFormat: { type: 'iso-8601-string' },
        datetimeSerialization: [
          { field: 'anotherTimestamp', useAsReference: false, datetimeFormat: { type: 'unix-epoch-ms', timezone: 'Europe/Paris' } },
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
        dateTimeOutputFormat: { type: 'iso-8601-string' },
        datetimeSerialization: [
          { field: 'anotherTimestamp', useAsReference: false, datetimeFormat: { type: 'unix-epoch-ms', timezone: 'Europe/Paris' } },
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
let south: SouthMySQL;

describe('SouthMySQL with authentication', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'mysql',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
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
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.generateReplacementParameters as jest.Mock).mockReturnValue([new Date(nowDateString), new Date(nowDateString)]);

    south = new SouthMySQL(
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

  it('should test connection with oracle', async () => {
    // TODO
    await expect(SouthMySQL.testConnection({}, logger)).rejects.toThrow('TODO: method needs to be implemented');
    expect(logger.trace).toHaveBeenCalledWith(`Testing connection`);
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
    (utils.convertDateTimeFromInstant as jest.Mock)
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

  it('should get data from MySQL', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    (utils.convertDateTimeFromInstant as jest.Mock).mockReturnValueOnce(startTime).mockReturnValueOnce(endTime);

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
        timeout: configuration.settings.requestTimeout
      },
      {
        startTime,
        endTime
      }
    );
    expect(mysqlConnection.end).toHaveBeenCalledTimes(1);

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
        timeout: configuration.settings.requestTimeout
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
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'mysql',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      host: 'localhost',
      port: 3306,
      database: 'db',
      username: '',
      password: '',
      connectionTimeout: 1000,
      requestTimeout: 1000
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    south = new SouthMySQL(
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
      user: configuration.settings.username,
      password: '',
      database: configuration.settings.database,
      connectTimeout: configuration.settings.connectionTimeout,
      timezone: 'Z'
    });
    expect(error).toEqual(new Error('connection error'));
  });
});
