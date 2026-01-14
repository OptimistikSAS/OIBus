import SouthPi from './south-pi';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { SouthPIItemSettings, SouthPISettings } from '../../../shared/model/south-settings.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import testData from '../../tests/utils/test-data';
import { HTTPRequest } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';

jest.mock('../../service/http-request.utils');
jest.mock('node:fs/promises');
jest.mock('../../service/utils');

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

describe('South PI', () => {
  let south: SouthPi;
  const configuration: SouthConnectorEntity<SouthPISettings, SouthPIItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'osisoft-pi',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0,
        maxInstantPerItem: true
      },
      agentUrl: 'http://localhost:2224',
      retryInterval: 1000
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          type: 'point-id',
          piPoint: 'FACTORY.WORKSHOP.POINT.ID1'
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          type: 'point-query',
          piQuery: '*'
        },
        scanMode: testData.scanMode.list[0]
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    south = new SouthPi(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  it('should get throttling settings', () => {
    expect(south.getThrottlingSettings(configuration.settings)).toEqual({
      maxReadInterval: configuration.settings.throttling.maxReadInterval,
      readDelay: configuration.settings.throttling.readDelay
    });
    expect(south.getMaxInstantPerItem(configuration.settings)).toEqual(configuration.settings.throttling.maxInstantPerItem);
    expect(south.getOverlap(configuration.settings)).toEqual(configuration.settings.throttling.overlap);
  });

  it('should properly connect to remote agent and disconnect ', async () => {
    await south.connect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/connect` }),
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    await south.disconnect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/disconnect` }),
      {
        method: 'DELETE'
      }
    );
  });

  it('should properly reconnect to when connection fails ', async () => {
    (HTTPRequest as unknown as jest.Mock).mockRejectedValueOnce(new Error('connection failed'));

    await south.connect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/connect` }),
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(HTTPRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(HTTPRequest).toHaveBeenCalledTimes(2);
  });

  it('should not reconnect when disconnecting ', async () => {
    (HTTPRequest as unknown as jest.Mock).mockRejectedValueOnce(new Error('connection failed'));
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    south.disconnect = jest.fn();
    south['disconnecting'] = true;

    await south.connect();

    expect(south.disconnect).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly clear reconnect timeout on disconnect when not connected', async () => {
    (HTTPRequest as unknown as jest.Mock).mockRejectedValueOnce(new Error('connection failed'));

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await south.connect();

    expect(HTTPRequest).toHaveBeenCalledTimes(1);
    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(HTTPRequest).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending connection HTTP request into agent. Reconnecting in ${configuration.settings.retryInterval} ms. ${new Error(
        'connection failed'
      )}`
    );
  });

  it('should properly clear reconnect timeout on disconnect when connected', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('disconnection failed'));

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await south.connect();

    expect(HTTPRequest).toHaveBeenCalledTimes(1);
    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(HTTPRequest).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending disconnection HTTP request into agent. ${new Error('disconnection failed')}`
    );
  });

  it('should test connection successfully', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200));
    await expect(south.testConnection()).resolves.not.toThrow();
  });

  it('should test connection fail', async () => {
    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(createMockResponse(400, 'bad request'))
      .mockResolvedValueOnce(createMockResponse(500, 'another error'));

    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Error occurred when sending connect command to remote agent with status 400. bad request`)
    );

    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Error occurred when sending connect command to remote agent with status 500`)
    );
  });

  it('should get data from Remote agent', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    south.addContent = jest.fn();
    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(
        createMockResponse(200, {
          recordCount: 2,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
          logs: ['log1', 'log2'],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        })
      )
      .mockResolvedValueOnce(
        createMockResponse(200, {
          recordCount: 1,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }],
          logs: [],
          maxInstantRetrieved: '2020-02-01T00:00:00.000Z'
        })
      )
      .mockResolvedValueOnce(
        createMockResponse(200, {
          recordCount: 0,
          content: [],
          logs: [],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        })
      );

    const result = await south.historyQuery(configuration.items, startTime, endTime);

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/read` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          startTime,
          endTime,
          items: [
            { name: 'item1', type: 'pointId', piPoint: 'FACTORY.WORKSHOP.POINT.ID1' },
            { name: 'item2', type: 'pointQuery', piQuery: '*' }
          ]
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(result).toEqual('2020-03-01T00:00:00.000Z');
    expect(south.addContent).toHaveBeenCalledWith(
      {
        type: 'time-values',
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
      },
      testData.constants.dates.FAKE_NOW,
      [configuration.items[0].id, configuration.items[1].id]
    );
    expect(logger.warn).toHaveBeenCalledWith('log1');
    expect(logger.warn).toHaveBeenCalledWith('log2');

    const resultNoUpdateInstant = await south.historyQuery(configuration.items, result!, endTime);
    expect(resultNoUpdateInstant).toEqual(null);

    const noResult = await south.historyQuery(configuration.items, startTime, endTime);
    expect(noResult).toEqual(null);
    expect(logger.debug).toHaveBeenCalledWith('No result found. Request done in 0 ms');
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(400, 'bad request')).mockResolvedValueOnce(createMockResponse(500));

    await expect(south.historyQuery(configuration.items, startTime, endTime)).rejects.toThrow(
      `Error occurred when querying remote agent with status 400: bad request`
    );
    await expect(south.historyQuery(configuration.items, startTime, endTime)).rejects.toThrow(
      `Error occurred when querying remote agent with status 500`
    );
  });

  it('should manage fetch error on connect', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (HTTPRequest as unknown as jest.Mock)
      .mockRejectedValueOnce(new Error('bad request'))
      .mockRejectedValueOnce(new Error('bad request'))
      .mockRejectedValueOnce(new Error('bad request'));

    await expect(south.historyQuery(configuration.items, startTime, endTime)).rejects.toThrow(new Error('bad request'));

    await south.start();
    await expect(south.historyQuery(configuration.items, startTime, endTime)).rejects.toThrow(new Error('bad request'));
  });

  it('should test item', async () => {
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
          recordCount: 2,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        })
      );

    south.connect = jest.fn();
    south.disconnect = jest.fn();
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        startTime,
        endTime,
        items: [
          {
            name: configuration.items[0].name,
            type: configuration.items[0].settings.type === 'point-id' ? 'pointId' : 'pointQuery',
            piPoint: configuration.items[0].settings.piPoint,
            piQuery: configuration.items[0].settings.piQuery
          }
        ]
      }),
      headers: { 'Content-Type': 'application/json' }
    };

    await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    expect(south.connect).toHaveBeenCalledTimes(1);
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/read` }),
      fetchOptions
    );

    await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
    expect(south.connect).toHaveBeenCalledTimes(2);
    expect(south.disconnect).toHaveBeenCalledTimes(2);
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/read` }),
      fetchOptions
    );
  });

  it('should test item and throw error if bad status', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(400));

    south.connect = jest.fn();
    south.disconnect = jest.fn();
    await expect(south.testItem(configuration.items[0], testData.south.itemTestingSettings)).rejects.toThrow(
      `Error occurred when sending connect command to remote agent. 400`
    );
    expect(south.connect).toHaveBeenCalledTimes(1);
    expect(south.disconnect).toHaveBeenCalledTimes(1);

    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        startTime,
        endTime,
        items: [
          {
            name: configuration.items[0].name,
            type: configuration.items[0].settings.type === 'point-id' ? 'pointId' : 'pointQuery',
            piPoint: configuration.items[0].settings.piPoint,
            piQuery: configuration.items[0].settings.piQuery
          }
        ]
      }),
      headers: { 'Content-Type': 'application/json' }
    };
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/read` }),
      fetchOptions
    );
  });
});
