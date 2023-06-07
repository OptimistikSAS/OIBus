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

jest.mock('mssql');
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
      query: 'SELECT * FROM table WHERE timestamp > @StartTime AND timestamp < @EndTime',
      datetimeType: 'number',
      timeField: 'timestamp',
      timezone: 'Europe/Paris',
      filename: 'sql-@CurrentDate.csv',
      delimiter: ';',
      dateFormat: 'yyyy-MM-dd HH:mm:ss.SSS'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    connectorId: 'southId',
    settings: {
      query: 'SELECT * FROM table',
      datetimeType: 'number',
      timeField: 'timestamp',
      timezone: 'Europe/Paris',
      filename: 'sql-@CurrentDate.csv',
      delimiter: ';',
      dateFormat: 'yyyy-MM-dd HH:mm:ss.SSS'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id3',
    name: 'item3',
    connectorId: 'southId',
    settings: {
      query: 'SELECT * FROM table',
      datetimeType: 'number',
      timeField: 'timestamp',
      timezone: 'Europe/Paris',
      filename: 'sql-@CurrentDate.csv',
      delimiter: ';',
      dateFormat: 'yyyy-MM-dd HH:mm:ss.SSS'
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
      compression: false,
      trustServerCertificate: true
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect } as unknown as ConnectionPool));

    (utils.getMostRecentDate as jest.Mock).mockReturnValue(new Date(nowDateString));
    (utils.replaceFilenameWithVariable as jest.Mock).mockReturnValue('myFile');

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
    const result = await south.testConnection({});
    expect(logger.trace).toHaveBeenCalledWith(`Testing connection`);
    expect(result).toBeFalsy();
  });

  it('should properly run historyQuery', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    south.getDataFromMSSQL = jest
      .fn()
      .mockReturnValueOnce([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
      .mockReturnValue([]);

    (utils.getMostRecentDate as jest.Mock).mockReturnValue('2020-03-01T00:00:00.000Z');

    await south.historyQuery(items, startTime, nowDateString);
    expect(utils.writeResults).toHaveBeenCalledTimes(1);
    expect(utils.getMostRecentDate).toHaveBeenCalledTimes(1);
    expect(utils.logQuery).toHaveBeenCalledTimes(3);
    expect(utils.logQuery).toHaveBeenCalledWith(items[0].settings.query, startTime, nowDateString, logger);
    expect(south.getDataFromMSSQL).toHaveBeenCalledTimes(3);
    expect(south.getDataFromMSSQL).toHaveBeenCalledWith(items[0], startTime, nowDateString);
    expect(south.getDataFromMSSQL).toHaveBeenCalledWith(items[1], '2020-03-01T00:00:00.000Z', nowDateString);
    expect(south.getDataFromMSSQL).toHaveBeenCalledWith(items[2], '2020-03-01T00:00:00.000Z', nowDateString);

    expect(logger.info).toHaveBeenCalledWith(`Found 2 results for item ${items[0].name} in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[1].name}. Request done in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[2].name}. Request done in 0 ms`);
  });

  it('should get data from MSSQL', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const result = await south.getDataFromMSSQL(items[0], startTime, endTime);

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
    expect(input).toHaveBeenCalledWith('StartTime', startTime);
    expect(input).toHaveBeenCalledWith('EndTime', endTime);
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
      compression: false,
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
      await south.getDataFromMSSQL(items[1], startTime, endTime);
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
});
