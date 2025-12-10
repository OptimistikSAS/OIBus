import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import path from 'node:path';
import pino from 'pino';
import * as utils from '../../service/utils';
import { convertDateTimeToInstant, convertDelimiter, formatInstant, persistResults } from '../../service/utils';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import {
  SouthOLEDBItemSettings,
  SouthOLEDBItemSettingsDateTimeFields,
  SouthOLEDBSettings
} from '../../../shared/model/south-settings.model';
import SouthOLEDB from './south-oledb';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import testData from '../../tests/utils/test-data';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import { HTTPRequest } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';

jest.mock('node:fs/promises');
jest.mock('../../service/http-request.utils');
jest.mock('../../service/utils');
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

describe('SouthOLEDB', () => {
  let south: SouthOLEDB;
  const configuration: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'oledb',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      agentUrl: 'http://localhost:2224',
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'encrypted-password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'query1',
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
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          query: 'query2',
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
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          query: 'query3',
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
        scanMode: testData.scanMode.list[1]
      }
    ]
  };
  const connectionStringWithPassword = 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes;Password=encrypted-password;';

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (convertDateTimeToInstant as jest.Mock).mockImplementation(value => value);
    (convertDelimiter as jest.Mock).mockImplementation(value => value);
    (formatInstant as jest.Mock).mockImplementation(value => value);

    south = new SouthOLEDB(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  it('should get throttling settings', () => {
    expect(south.getThrottlingSettings(configuration.settings)).toEqual({
      maxReadInterval: configuration.settings.throttling.maxReadInterval,
      readDelay: configuration.settings.throttling.readDelay
    });
    expect(south.getMaxInstantPerItem(configuration.settings)).toEqual(true);
    expect(south.getOverlap(configuration.settings)).toEqual(configuration.settings.throttling.overlap);
  });

  it('should properly connect to remote agent and disconnect ', async () => {
    await south.connect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/connect` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: connectionStringWithPassword,
          connectionTimeout: configuration.settings.connectionTimeout
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    await south.disconnect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/disconnect` }),
      {
        method: 'DELETE'
      }
    );
  });

  it('should connect without password when not provided', async () => {
    const configurationWithoutPassword: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings> = {
      ...configuration,
      settings: {
        ...configuration.settings,
        password: null
      }
    };
    const southWithoutPassword = new SouthOLEDB(
      configurationWithoutPassword,
      addContentCallback,
      southCacheRepository,
      logger,
      'cacheFolder'
    );

    await southWithoutPassword.connect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        href: `${configurationWithoutPassword.settings.agentUrl}/api/ole/${configurationWithoutPassword.id}/connect`
      }),
      {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: configurationWithoutPassword.settings.connectionString,
          connectionTimeout: configurationWithoutPassword.settings.connectionTimeout
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  });

  it('should avoid adding duplicate semicolons when password is provided', async () => {
    const configurationWithTrailingSemicolon: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings> = {
      ...configuration,
      settings: {
        ...configuration.settings,
        connectionString: `${configuration.settings.connectionString};`
      }
    };
    const southWithTrailingSemicolon = new SouthOLEDB(
      configurationWithTrailingSemicolon,
      addContentCallback,
      southCacheRepository,
      logger,
      'cacheFolder'
    );
    const expectedConnectionString = `${configurationWithTrailingSemicolon.settings.connectionString}Password=encrypted-password;`;

    await southWithTrailingSemicolon.connect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        href: `${configurationWithTrailingSemicolon.settings.agentUrl}/api/ole/${configurationWithTrailingSemicolon.id}/connect`
      }),
      {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: expectedConnectionString,
          connectionTimeout: configurationWithTrailingSemicolon.settings.connectionTimeout
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  });

  it('should properly reconnect to when connection fails ', async () => {
    (HTTPRequest as jest.Mock).mockRejectedValueOnce(new Error('connection failed'));

    await south.connect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/connect` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: connectionStringWithPassword,
          connectionTimeout: configuration.settings.connectionTimeout
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(HTTPRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    await jest.runOnlyPendingTimersAsync();
    expect(HTTPRequest).toHaveBeenCalledTimes(2);
  });

  it('should properly clear reconnect timeout on disconnect', async () => {
    (HTTPRequest as jest.Mock)
      .mockRejectedValueOnce(new Error('connection failed'))
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('disconnection failed'));

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await south.connect();

    expect(HTTPRequest).toHaveBeenCalledTimes(1);
    await south.connect();

    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(HTTPRequest).toHaveBeenCalledTimes(3);
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

    await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
    expect(south.queryRemoteAgentData).toHaveBeenCalledTimes(3);
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(configuration.items[0], startTime, testData.constants.dates.FAKE_NOW);
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(configuration.items[1], startTime, testData.constants.dates.FAKE_NOW);
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(configuration.items[2], startTime, testData.constants.dates.FAKE_NOW);
  });

  it('should get data from Remote agent', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(
        createMockResponse(200, {
          recordCount: 2,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
          maxInstant: '2020-03-01T00:00:00.000Z'
        })
      )
      .mockResolvedValueOnce(
        createMockResponse(200, {
          recordCount: 0,
          content: [],
          maxInstant: '2020-03-01T00:00:00.000Z'
        })
      );

    const result = await south.queryRemoteAgentData(configuration.items[0], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(configuration.items[0].settings.query, startTime, endTime, logger);

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/read` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: connectionStringWithPassword,
          sql: 'query1',
          readTimeout: 1000,
          timeColumn: 'timestamp',
          datasourceTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
          datasourceTimezone: 'Europe/Paris',
          delimiter: 'COMMA',
          outputTimestampFormat: configuration.items[0].settings.serialization.outputTimestampFormat,
          outputTimezone: configuration.items[0].settings.serialization.outputTimezone
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(result).toEqual('2020-03-01T00:00:00.000Z');
    expect(persistResults).toHaveBeenCalledWith(
      [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
      {
        type: 'file',
        filename: configuration.items[0].settings.serialization.filename,
        compression: configuration.items[0].settings.serialization.compression
      },
      configuration.name,
      configuration.items[0].name,
      path.resolve('cacheFolder', 'tmp'),
      expect.any(Function),
      logger
    );

    await south.queryRemoteAgentData(configuration.items[0], startTime, endTime);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${configuration.items[0].name}. Request done in 0 ms`);
  });

  it('should get data from Remote agent without datetime reference', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (HTTPRequest as jest.Mock).mockResolvedValueOnce(
      createMockResponse(200, {
        recordCount: 2,
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
        maxInstant: startTime
      })
    );

    const result = await south.queryRemoteAgentData(configuration.items[1], startTime, endTime);

    expect(utils.logQuery).toHaveBeenCalledWith(configuration.items[1].settings.query, startTime, endTime, logger);

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/read` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: connectionStringWithPassword,
          sql: 'query2',
          readTimeout: 1000,
          delimiter: 'COMMA',
          outputTimestampFormat: configuration.items[1].settings.serialization.outputTimestampFormat,
          outputTimezone: configuration.items[1].settings.serialization.outputTimezone
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(result).toEqual(null);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(400, 'bad request')).mockResolvedValueOnce(createMockResponse(500));

    await expect(south.queryRemoteAgentData(configuration.items[0], startTime, endTime)).rejects.toThrow(
      `Error occurred when querying remote agent with status 400: bad request`
    );
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when querying remote agent with status 400: bad request`);

    await expect(south.queryRemoteAgentData(configuration.items[0], startTime, endTime)).rejects.toThrow(
      `Error occurred when querying remote agent with status 500`
    );
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when querying remote agent with status 500`);
  });

  it('should test item', async () => {
    const formattedInstant = '2020-01-01T00:00:00.000Z';
    south.queryRemoteAgentData = jest.fn().mockReturnValueOnce([
      { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
      { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
    ]);
    (utils.formatInstant as jest.Mock).mockReturnValue(formattedInstant);
    (utils.convertDateTimeToInstant as jest.Mock).mockImplementation(instant => instant);

    await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(configuration.items[0], startTime, endTime, true);
  });

  it('should test item without datetimeFields', async () => {
    const formattedInstant = '2020-01-01T00:00:00.000Z';
    south.queryRemoteAgentData = jest.fn().mockReturnValueOnce([
      { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
      { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
    ]);
    (utils.formatInstant as jest.Mock).mockReturnValue(formattedInstant);
    (utils.convertDateTimeToInstant as jest.Mock).mockImplementation(instant => instant);

    await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    expect(south.queryRemoteAgentData).toHaveBeenCalledWith(configuration.items[1], startTime, endTime, true);
  });

  it('QueryRemoteAgentData in case of item test', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(
        createMockResponse(200, {
          recordCount: 2,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        })
      )
      .mockResolvedValueOnce(
        createMockResponse(200, {
          recordCount: 0,
          content: [],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        })
      );

    await south.queryRemoteAgentData(configuration.items[0], startTime, endTime, true);

    expect(utils.logQuery).toHaveBeenCalledWith(configuration.items[0].settings.query, startTime, endTime, logger);

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/ole/${configuration.id}/read` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          connectionString: connectionStringWithPassword,
          sql: 'query1',
          readTimeout: 1000,
          timeColumn: 'timestamp',
          datasourceTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
          datasourceTimezone: 'Europe/Paris',
          delimiter: 'COMMA',
          outputTimestampFormat: configuration.items[0].settings.serialization.outputTimestampFormat,
          outputTimezone: configuration.items[0].settings.serialization.outputTimezone
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  });

  it('should test connection successfully', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200));
    await expect(south.testConnection()).resolves.not.toThrow();
    expect(logger.info).toHaveBeenCalledWith(
      'Testing OLE OIBus Agent connection on http://localhost:2224 with "Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes;Password=<secret>;"'
    );
  });

  it('should test connection fail', async () => {
    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(createMockResponse(400, 'bad request'))
      .mockResolvedValueOnce(createMockResponse(500, 'another error'));

    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Error occurred when sending connect command to remote agent with status 400: bad request`)
    );
    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Error occurred when sending connect command to remote agent with status 500`)
    );
  });

  it('should disconnect without fetch when not connected', async () => {
    await south.disconnect();
    expect(HTTPRequest).not.toHaveBeenCalled();
  });
});
