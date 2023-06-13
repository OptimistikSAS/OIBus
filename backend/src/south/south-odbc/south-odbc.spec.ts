import path from 'node:path';

import SouthODBC from './south-odbc';
import * as utils from '../../service/utils';
import { generateReplacementParameters } from '../../service/utils';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';
// eslint-disable-next-line import/no-unresolved
import odbc from 'odbc';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { DateTime } from 'luxon';

jest.mock('../../service/utils');
jest.mock('odbc');

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
let south: SouthODBC;

describe('SouthODBC with authentication', () => {
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
      trustServerCertificate: true,
      compression: false
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.getMostRecentDate as jest.Mock).mockReturnValue(new Date(nowDateString));
    (utils.generateReplacementParameters as jest.Mock).mockReturnValue([new Date(nowDateString), new Date(nowDateString)]);
    (utils.replaceFilenameWithVariable as jest.Mock).mockReturnValue('myFile');

    south = new SouthODBC(
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

  it('should test connection with odbc', async () => {
    // TODO
    await expect(SouthODBC.testConnection({}, logger)).rejects.toThrow('TODO: method needs to be implemented');
    expect(logger.trace).toHaveBeenCalledWith(`Testing connection`);
  });

  it('should properly run historyQuery', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    south.getDataFromOdbc = jest
      .fn()
      .mockReturnValueOnce([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
      .mockReturnValue([]);

    (utils.getMostRecentDate as jest.Mock).mockReturnValue('2020-03-01T00:00:00.000Z');

    await south.historyQuery(items, startTime, nowDateString);
    expect(utils.writeResults).toHaveBeenCalledTimes(1);
    expect(utils.getMostRecentDate).toHaveBeenCalledTimes(1);
    expect(utils.logQuery).toHaveBeenCalledTimes(3);
    expect(utils.logQuery).toHaveBeenCalledWith(items[0].settings.query, startTime, nowDateString, logger);
    expect(south.getDataFromOdbc).toHaveBeenCalledTimes(3);
    expect(south.getDataFromOdbc).toHaveBeenCalledWith(items[0], startTime, nowDateString);
    expect(south.getDataFromOdbc).toHaveBeenCalledWith(items[1], '2020-03-01T00:00:00.000Z', nowDateString);
    expect(south.getDataFromOdbc).toHaveBeenCalledWith(items[2], '2020-03-01T00:00:00.000Z', nowDateString);

    expect(logger.info).toHaveBeenCalledWith(`Found 2 results for item ${items[0].name} in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[1].name}. Request done in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[2].name}. Request done in 0 ms`);
  });

  it('should get data from ODBC', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (generateReplacementParameters as jest.Mock).mockReturnValue({ startTime, endTime });
    const odbcConnection = {
      close: jest.fn(),
      query: jest.fn().mockReturnValue([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    const result = await south.getDataFromOdbc(items[0], startTime, endTime);

    let expectedConnectionString = `Driver=${configuration.settings.driverPath};SERVER=${configuration.settings.host};PORT=${configuration.settings.port};`;
    expectedConnectionString += `TrustServerCertificate=yes;Database=${configuration.settings.database};UID=${configuration.settings.username};`;
    expect(odbc.connect).toHaveBeenCalledWith({
      connectionString: expectedConnectionString + 'PWD=password;',
      connectionTimeout: configuration.settings.connectionTimeout
    });
    expect(logger.debug).toHaveBeenCalledWith(`Connecting with connection string ${expectedConnectionString}PWD=<secret>;`);
    expect(generateReplacementParameters).toHaveBeenCalledWith(
      items[0].settings.query,
      DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS')
    );
    expect(odbcConnection.query).toHaveBeenCalledWith(items[0].settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?'), {
      startTime,
      endTime
    });
    expect(odbcConnection.close).toHaveBeenCalledTimes(1);

    expect(result).toEqual([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (generateReplacementParameters as jest.Mock).mockReturnValue({ startTime, endTime });
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
      await south.getDataFromOdbc(items[0], startTime, endTime);
    } catch (err) {
      error = err;
    }

    expect(odbcConnection.query).toHaveBeenCalledWith(items[0].settings.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?'), {
      startTime,
      endTime
    });
    expect(error).toEqual(new Error('query error'));
    expect(odbcConnection.close).toHaveBeenCalledTimes(1);

    try {
      await south.getDataFromOdbc(items[0], startTime, endTime);
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
      database: '',
      username: '',
      password: '',
      connectionTimeout: 1000,
      trustServerCertificate: false,
      compression: false
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    south = new SouthODBC(
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

  it('should get data from ODBC without auth', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (generateReplacementParameters as jest.Mock).mockReturnValue({ startTime, endTime });
    const odbcConnection = {
      close: jest.fn(),
      query: jest.fn().mockReturnValue([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
    };
    (odbc.connect as jest.Mock).mockReturnValue(odbcConnection);

    const result = await south.getDataFromOdbc(items[0], startTime, endTime);

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
      await south.getDataFromOdbc(items[0], startTime, endTime);
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
