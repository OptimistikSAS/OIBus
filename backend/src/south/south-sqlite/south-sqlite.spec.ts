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
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';

jest.mock('../../service/utils');
jest.mock('node:fs/promises');
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

const nowDateString = '2020-02-02T02:02:02.222Z';
let south: SouthSQLite;

describe('SouthSQLite', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.getMostRecentDate as jest.Mock).mockReturnValue(new Date(nowDateString));
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

  it('should properly run historyQuery', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    south.getDataFromSqlite = jest
      .fn()
      .mockReturnValueOnce([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
      .mockReturnValue([]);

    (utils.getMostRecentDate as jest.Mock).mockReturnValue('2020-03-01T00:00:00.000Z');

    await south.historyQuery(items, startTime, nowDateString);
    expect(utils.writeResults).toHaveBeenCalledTimes(1);
    expect(utils.getMostRecentDate).toHaveBeenCalledTimes(1);
    expect(utils.logQuery).toHaveBeenCalledTimes(3);
    expect(utils.logQuery).toHaveBeenCalledWith(items[0].settings.query, startTime, nowDateString, logger);
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

    (mockDatabase.prepare as jest.Mock).mockReturnValue({ all });
    const result = await south.getDataFromSqlite(items[0], startTime, endTime);

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
});

describe('SouthSQLite test connection', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
  });

  const settings = { ...configuration.settings };
  const dbPath = path.resolve(settings.databasePath);
  const dbFolder = path.dirname(dbPath).replace(/\\/g, '\\\\');

  it('Folder does not exist', async () => {
    const errorMessage = 'Folder does not exist';
    (fs.access as jest.Mock).mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });

    const test = SouthSQLite.testConnection(settings, logger);
    const folderRegex = new RegExp(`Folder '${dbFolder}' does not exist`);
    await expect(test).rejects.toThrowError(folderRegex);

    const accessRegex = new RegExp(`Access error on '${dbFolder}': ${errorMessage}`);
    expect((logger.trace as jest.Mock).mock.calls).toEqual([['Testing connection'], [expect.stringMatching(accessRegex)]]);
  });

  it('No read/write access', async () => {
    const errorMessage = 'No read/write access';
    (fs.access as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error(errorMessage);
      });

    await expect(SouthSQLite.testConnection(settings, logger)).rejects.toThrowError('No read/write access on folder');

    const accessRegex = new RegExp(`Access error on '${dbFolder}': ${errorMessage}`);
    expect((logger.trace as jest.Mock).mock.calls).toEqual([['Testing connection'], [expect.stringMatching(accessRegex)]]);
  });
});
