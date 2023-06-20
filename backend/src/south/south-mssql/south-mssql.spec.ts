import path from 'node:path';

import SouthMSSQL from './south-mssql';
import * as utils from '../../service/utils';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';

import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import mssql, { ConnectionPool } from 'mssql';
import { DateTime } from 'luxon';

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
const items: Array<OibusItemDTO> = [
  {
    id: 'id1',
    name: 'item1',
    connectorId: 'southId',
    settings: {
      query: 'SELECT * FROM table WHERE timestamp > @StartTime AND timestamp < @EndTime',
      dateTimeFields: [
        { field: 'anotherTimestamp', useAsReference: false, datetimeFormat: { type: 'unix-epoch-ms', timezone: 'Europe/Paris' } },
        {
          field: 'timestamp',
          useAsReference: true,
          datetimeFormat: { type: 'specific-string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
        }
      ],
      serialization: {
        type: 'file',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        dateTimeOutputFormat: { type: 'iso-8601-string' }
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
        { field: 'anotherTimestamp', useAsReference: false, datetimeFormat: { type: 'unix-epoch-ms', timezone: 'Europe/Paris' } },
        {
          field: 'timestamp',
          useAsReference: true,
          datetimeFormat: { type: 'specific-string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
        }
      ],
      serialization: {
        type: 'file',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        dateTimeOutputFormat: { type: 'iso-8601-string' }
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
        { field: 'anotherTimestamp', useAsReference: false, datetimeFormat: { type: 'unix-epoch-ms', timezone: 'Europe/Paris' } },
        {
          field: 'timestamp',
          useAsReference: true,
          datetimeFormat: { type: 'specific-string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
        }
      ],
      serialization: {
        type: 'file',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        dateTimeOutputFormat: { type: 'iso-8601-string' }
      }
    },
    scanModeId: 'scanModeId2'
  }
];

const nowDateString = '2020-02-02T02:02:02.222Z';
let south: SouthMSSQL;

const query = jest.fn(() => ({ recordsets: [[{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]] }));
const input = jest.fn();
const close = jest.fn();
const request = jest.fn(() => ({ input, query }));
const connect = jest.fn(() => ({ request, close }));
describe('SouthMSSQL with authentication', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'mssql',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
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
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect } as unknown as ConnectionPool));

    south = new SouthMSSQL(
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

  it('should test connection with mssql', async () => {
    // TODO
    await expect(SouthMSSQL.testConnection({}, logger, encryptionService)).rejects.toThrow('TODO: method needs to be implemented');
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
    (utils.formatInstant as jest.Mock)
      .mockReturnValueOnce('2020-02-01 00:00:00.000')
      .mockReturnValueOnce('2020-03-01 00:00:00.000')
      .mockReturnValue(startTime);
    (utils.convertDateTimeToInstant as jest.Mock).mockImplementation(instant => instant);

    await south.historyQuery(items, startTime, nowDateString);
    expect(utils.persistResults).toHaveBeenCalledTimes(1);
    expect(south.queryData).toHaveBeenCalledTimes(3);
    expect(south.queryData).toHaveBeenCalledWith(items[0], '2020-01-01T00:00:00.000Z', '2020-02-02T02:02:02.222Z');
    expect(south.queryData).toHaveBeenCalledWith(items[1], '2020-03-01T00:00:00.000Z', '2020-02-02T02:02:02.222Z');
    expect(south.queryData).toHaveBeenCalledWith(items[2], '2020-03-01T00:00:00.000Z', '2020-02-02T02:02:02.222Z');

    expect(logger.info).toHaveBeenCalledWith(`Found 2 results for item ${items[0].name} in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[1].name}. Request done in 0 ms`);
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
      format: 'yyyy-MM-dd HH:mm:ss.SSS',
      locale: 'en-US',
      timezone: 'Europe/Paris',
      type: 'specific-string'
    });
    expect(utils.formatInstant).toHaveBeenCalledWith(endTime, {
      format: 'yyyy-MM-dd HH:mm:ss.SSS',
      locale: 'en-US',
      timezone: 'Europe/Paris',
      type: 'specific-string'
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
        encrypt: configuration.settings.encryption,
        trustServerCertificate: configuration.settings.trustServerCertificate
      },
      domain: configuration.settings.domain
    });
    expect(input).toHaveBeenCalledWith('StartTime', '2020-01-01 00:00:00.000');
    expect(input).toHaveBeenCalledWith('EndTime', '2022-01-01 00:00:00.000');
    expect(query).toHaveBeenCalledWith(items[0].settings.query);
    expect(close).toHaveBeenCalledTimes(1);

    expect(result).toEqual([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });
});

describe('SouthMSSQL without authentication', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'mssql',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      host: 'localhost',
      port: 1433,
      database: 'db',
      username: '',
      password: '',
      domain: '',
      encryption: false,
      connectionTimeout: 1000,
      requestTimeout: 1000,
      trustServerCertificate: false
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    south = new SouthMSSQL(
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
      user: '',
      password: '',
      server: configuration.settings.host,
      port: configuration.settings.port,
      database: configuration.settings.database,
      connectionTimeout: configuration.settings.connectionTimeout,
      requestTimeout: configuration.settings.requestTimeout,
      options: {
        encrypt: configuration.settings.encryption,
        trustServerCertificate: configuration.settings.trustServerCertificate
      }
    });

    expect(query).toHaveBeenCalledWith(items[1].settings.query);
    expect(input).not.toHaveBeenCalled();
    expect(error).toEqual(new Error('query error'));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('should keep iso string format if serialization is not found', () => {
    const result = south.formatDatetimeVariables(nowDateString, null);
    expect(result).toEqual(nowDateString);
  });

  it('should format iso string to unix epoch ms', () => {
    (utils.formatInstant as jest.Mock).mockReturnValueOnce(DateTime.fromISO(nowDateString).toMillis());

    const result = south.formatDatetimeVariables(nowDateString, {
      type: 'unix-epoch-ms'
    });
    expect(result).toEqual(DateTime.fromISO(nowDateString).toMillis());
  });

  it('should format iso string to unix epoch', () => {
    (utils.formatInstant as jest.Mock).mockReturnValueOnce(Math.floor(DateTime.fromISO(nowDateString).toMillis() / 1000));

    const result = south.formatDatetimeVariables(nowDateString, {
      type: 'unix-epoch'
    });
    expect(result).toEqual(Math.floor(DateTime.fromISO(nowDateString).toMillis() / 1000));
  });

  it('should format iso string to iso string', () => {
    (utils.formatInstant as jest.Mock).mockReturnValueOnce(nowDateString);

    const result = south.formatDatetimeVariables(nowDateString, {
      type: 'iso-8601-string'
    });
    expect(result).toEqual(nowDateString);
  });

  it('should format iso string to Date date-object epoch', () => {
    const result = south.formatDatetimeVariables(nowDateString, {
      type: 'date-object',
      dateObjectType: 'Date',
      timezone: 'Europe/Paris'
    });
    expect(result).toEqual('2020-02-02');
  });

  it('should format iso string to DateTime2 date-object epoch', () => {
    const result = south.formatDatetimeVariables(nowDateString, {
      type: 'date-object',
      dateObjectType: 'DateTime2',
      timezone: 'Europe/Paris'
    });
    expect(result).toEqual('2020-02-02 03:02:02.222');
  });

  it('should format iso string to DateTimeOffset date-object epoch', () => {
    const result = south.formatDatetimeVariables(nowDateString, {
      type: 'date-object',
      dateObjectType: 'DateTimeOffset',
      timezone: 'Europe/Paris'
    });
    expect(result).toEqual('2020-02-02 03:02:02.222 +01:00');
  });

  it('should format iso string to SmallDateTime date-object epoch', () => {
    const result = south.formatDatetimeVariables(nowDateString, {
      type: 'date-object',
      dateObjectType: 'SmallDateTime',
      timezone: 'Europe/Paris'
    });
    expect(result).toEqual('2020-02-02 03:02:02');
  });

  it('should format iso string to DateTime date-object epoch', () => {
    const result = south.formatDatetimeVariables(nowDateString, {
      type: 'date-object',
      dateObjectType: 'DateTime',
      timezone: 'Europe/Paris'
    });
    expect(result).toEqual('2020-02-02 03:02:02.222');
  });
});
