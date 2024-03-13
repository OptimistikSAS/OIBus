import DatabaseMock from '../../tests/__mocks__/database.mock';
import path from 'node:path';
import pino from 'pino';
// eslint-disable-next-line import/no-unresolved
import * as utils from '../../service/utils';
import { convertDateTimeToInstant, convertDelimiter, formatInstant, persistResults } from '../../service/utils';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import {
  SouthOLEDBItemSettings,
  SouthOLEDBItemSettingsDateTimeFields,
  SouthOLEDBSettings
} from '../../../../shared/model/south-settings.model';
import SouthOLEDB from './south-oledb';
import fetch from 'node-fetch';

const nowDateString = '2020-02-02T02:02:02.222Z';
let south: SouthOLEDB;
const database = new DatabaseMock();
jest.mock('../../service/utils');
jest.mock('node:fs/promises');
jest.mock('node-fetch');

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
const items: Array<SouthConnectorItemDTO<SouthOLEDBItemSettings>> = [
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
        } as unknown as SouthOLEDBItemSettingsDateTimeFields,
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
        } as unknown as SouthOLEDBItemSettingsDateTimeFields,
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

describe('SouthOLEDB with authentication', () => {
  const configuration: SouthConnectorDTO<SouthOLEDBSettings> = {
    id: 'southId',
    name: 'south',
    type: 'oledb',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      agentUrl: 'http://localhost:2224',
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: '',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (convertDateTimeToInstant as jest.Mock).mockImplementation(value => value);
    (convertDelimiter as jest.Mock).mockImplementation(value => value);
    (formatInstant as jest.Mock).mockImplementation(value => value);

    south = new SouthOLEDB(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should create temp folder', async () => {
    await south.start();
    expect(utils.createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', 'tmp'));
  });

  it('should properly connect to remote agent and disconnect ', async () => {
    await south.connect();
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/ole/${configuration.id}/connect`, {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: configuration.settings.connectionString,
        connectionTimeout: configuration.settings.connectionTimeout
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    await south.disconnect();
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/ole/${configuration.id}/disconnect`, {
      method: 'DELETE'
    });
  });

  it('should properly reconnect to when connection fails ', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connection failed');
    });

    await south.connect();
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/ole/${configuration.id}/connect`, {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: configuration.settings.connectionString,
        connectionTimeout: configuration.settings.connectionTimeout
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should properly clear reconnect timeout on disconnect', async () => {
    (fetch as unknown as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('connection failed');
      })
      .mockImplementationOnce(() => {
        return true;
      })
      .mockImplementationOnce(() => {
        throw new Error('disconnection failed');
      });

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await south.connect();

    expect(fetch).toHaveBeenCalledTimes(1);
    await south.connect();

    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending connection HTTP request into agent. Reconnecting in ${configuration.settings.retryInterval} ms. ${new Error(
        'connection failed'
      )}`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending disconnection HTTP request into agent. ${new Error('disconnection failed')}`
    );
  });

  it('should properly run historyQuery', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    south.queryRemoteAgentData = jest.fn().mockReturnValueOnce('2023-02-01T00:00:00.000Z').mockReturnValue('2023-02-01T00:00:00.000Z');

    await south.historyQuery(items, startTime, nowDateString);
    expect(south.queryRemoteAgentData).toHaveBeenCalledTimes(3);
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(items[0], startTime, nowDateString);
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(items[1], '2023-02-01T00:00:00.000Z', nowDateString);
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(items[2], '2023-02-01T00:00:00.000Z', nowDateString);
  });

  it('should get data from Remote agent', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          json: () => ({
            recordCount: 2,
            content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
            maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
          })
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          json: () => ({
            recordCount: 0,
            content: [],
            maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
          })
        })
      );

    const result = await south.queryRemoteAgentData(items[0], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(items[0].settings.query, startTime, endTime, logger);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/ole/${configuration.id}/read`, {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
        sql: 'SELECT * FROM table',
        readTimeout: 1000,
        timeColumn: 'timestamp',
        datasourceTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
        datasourceTimezone: 'Europe/Paris',
        delimiter: 'COMMA'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(result).toEqual('2020-03-01T00:00:00.000Z');
    expect(persistResults).toHaveBeenCalledWith(
      [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
      { type: 'file', filename: items[0].settings.serialization.filename, compression: items[0].settings.serialization.compression },
      configuration.name,
      path.resolve('baseFolder', 'tmp'),
      expect.any(Function),
      expect.any(Function),
      logger
    );

    await south.queryRemoteAgentData(items[0], startTime, endTime);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[0].name}. Request done in 0 ms`);
  });

  it('should get data from Remote agent without datetime reference', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (fetch as unknown as jest.Mock).mockReturnValueOnce(
      Promise.resolve({
        status: 200,
        json: () => ({
          recordCount: 2,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
          maxInstantRetrieved: startTime
        })
      })
    );

    const result = await south.queryRemoteAgentData(items[1], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(items[1].settings.query, startTime, endTime, logger);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/ole/${configuration.id}/read`, {
      method: 'PUT',
      body: JSON.stringify({
        connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
        sql: 'SELECT * FROM table',
        readTimeout: 1000,
        delimiter: 'COMMA'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(result).toEqual(startTime);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          status: 400,
          text: () => 'bad request'
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          status: 500
        })
      );
    await south.queryRemoteAgentData(items[0], startTime, endTime);
    await south.queryRemoteAgentData(items[0], startTime, endTime);

    expect(logger.error).toHaveBeenCalledWith(`Error occurred when querying remote agent with status 400: bad request`);
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when querying remote agent with status 500`);
  });
});

describe('SouthOLEDB test connection', () => {
  const configuration: SouthConnectorDTO<SouthOLEDBSettings> = {
    id: 'southId',
    name: 'south',
    type: 'oledb',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      agentUrl: 'http://localhost:2224',
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    south = new SouthOLEDB(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should test connection successfully', async () => {
    (fetch as unknown as jest.Mock).mockReturnValueOnce(
      Promise.resolve({
        status: 200
      })
    );
    await expect(south.testConnection()).resolves.not.toThrow();
  });

  it('should test connection fail', async () => {
    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          status: 400,
          text: () => 'bad request'
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          status: 500,
          text: () => 'another error'
        })
      );
    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Error occurred when sending connect command to remote agent with status 400: bad request`)
    );
    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Error occurred when sending connect command to remote agent with status 500`)
    );
  });

  it('should disconnect without fetch when not connected', async () => {
    await south.disconnect();
    expect(fetch).not.toHaveBeenCalled();
  });
});
