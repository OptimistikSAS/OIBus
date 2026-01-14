import SouthOpc from './south-opc';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import { SouthOPCItemSettings, SouthOPCSettings } from '../../../shared/model/south-settings.model';
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

describe('South OPC', () => {
  let south: SouthOpc;
  const configuration: SouthConnectorEntity<SouthOPCSettings, SouthOPCItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'opc',
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
      retryInterval: 1000,
      host: 'localhost',
      serverName: 'Matrikon.OPC.Simulation',
      mode: 'hda'
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Random',
          aggregate: 'raw',
          resampling: 'none'
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Counter',
          aggregate: 'raw'
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Triangle',
          aggregate: 'average',
          resampling: '10s'
        },
        scanMode: testData.scanMode.list[1]
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    south = new SouthOpc(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  it('should get throttling settings', () => {
    expect(south.getThrottlingSettings(configuration.settings)).toEqual({
      maxReadInterval: configuration.settings.throttling.maxReadInterval,
      readDelay: configuration.settings.throttling.readDelay
    });
    expect(south.getMaxInstantPerItem(configuration.settings)).toEqual(configuration.settings.throttling.maxInstantPerItem);
    expect(south.getOverlap(configuration.settings)).toEqual(configuration.settings.throttling.overlap);
  });

  it('should properly connect to remote agent and disconnect', async () => {
    await south.connect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}/connect` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          host: configuration.settings.host,
          serverName: configuration.settings.serverName,
          mode: 'hda'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    await south.disconnect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}/disconnect` }),
      {
        method: 'DELETE'
      }
    );
  });

  it('should properly reconnect to when connection fails', async () => {
    (HTTPRequest as unknown as jest.Mock).mockRejectedValueOnce(new Error('connection failed'));

    await south.connect();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}/connect` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          host: configuration.settings.host,
          serverName: configuration.settings.serverName,
          mode: 'hda'
        }),
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
    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(createMockResponse(200))
      .mockResolvedValueOnce(createMockResponse(200, {}))
      .mockResolvedValueOnce(createMockResponse(200));

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
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        })
      )
      .mockResolvedValueOnce(
        createMockResponse(200, {
          recordCount: 0,
          content: [],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        })
      )
      .mockResolvedValueOnce(
        createMockResponse(200, {
          recordCount: 1,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }],
          maxInstantRetrieved: '2020-02-01T00:00:00.000Z'
        })
      );

    const result = await south.historyQuery(configuration.items, startTime, endTime);

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}/read` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          host: configuration.settings.host,
          serverName: configuration.settings.serverName,
          mode: 'hda',
          maxReadValues: 3600,
          intervalReadDelay: 200,
          aggregate: 'raw',
          resampling: 'none',
          startTime,
          endTime,
          items: [
            { name: 'item1', nodeId: 'ns=3;s=Random' },
            { name: 'item2', nodeId: 'ns=3;s=Counter' }
          ]
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}/read` }),
      {
        method: 'PUT',
        body: JSON.stringify({
          host: configuration.settings.host,
          serverName: configuration.settings.serverName,
          mode: 'hda',
          maxReadValues: 3600,
          intervalReadDelay: 200,
          aggregate: 'average',
          resampling: '10s',
          startTime,
          endTime,
          items: [{ name: 'item3', nodeId: 'ns=3;s=Triangle' }]
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    expect(result).toEqual('2020-03-01T00:00:00.001Z');
    expect(south.addContent).toHaveBeenCalledWith(
      {
        type: 'time-values',
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
      },
      testData.constants.dates.FAKE_NOW,
      [configuration.items[0].id, configuration.items[1].id]
    );

    expect(logger.debug).toHaveBeenCalledWith(`No result found. Request done in 0 ms`);

    const noUpdateInstant = await south.historyQuery([configuration.items[0]], result!, endTime);
    expect(noUpdateInstant).toEqual(null);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(400, 'bad request')).mockResolvedValueOnce(createMockResponse(500));
    south.disconnect = jest.fn();
    south.connect = jest.fn();

    await expect(south.historyQuery(configuration.items, startTime, endTime)).rejects.toThrow(
      `Error occurred when querying remote agent with status 400: bad request`
    );
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when querying remote agent with status 400: bad request`);
    (south.connect as jest.Mock).mockClear();
    south['disconnecting'] = true;
    await expect(south.historyQuery(configuration.items, startTime, endTime)).rejects.toThrow(
      `Error occurred when querying remote agent with status 500`
    );
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when querying remote agent with status 500`);
    expect(south.connect).not.toHaveBeenCalled();
  });

  it('should manage fetch error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    (HTTPRequest as unknown as jest.Mock).mockRejectedValueOnce(new Error('bad request'));

    await expect(south.historyQuery(configuration.items, startTime, endTime)).rejects.toThrow(new Error('bad request'));
  });

  it('should test item', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(
      createMockResponse(200, {
        recordCount: 2,
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
        maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
      })
    );

    await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        host: configuration.settings.host,
        serverName: configuration.settings.serverName,
        mode: 'hda',
        aggregate: configuration.items[0].settings.aggregate,
        resampling: configuration.items[0].settings.resampling,
        startTime,
        endTime,
        items: [{ nodeId: configuration.items[0].settings.nodeId, name: configuration.items[0].name }]
      }),
      headers: { 'Content-Type': 'application/json' }
    };
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}-test/read` }),
      fetchOptions
    );
  });

  it('should test item and throw error if bad status', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(400));

    await expect(south.testItem(configuration.items[0], testData.south.itemTestingSettings)).rejects.toThrow(
      `Error occurred when sending connect command to remote agent. 400`
    );

    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        host: configuration.settings.host,
        serverName: configuration.settings.serverName,
        mode: 'hda',
        aggregate: configuration.items[0].settings.aggregate,
        resampling: configuration.items[0].settings.resampling,
        startTime,
        endTime,
        items: [{ nodeId: configuration.items[0].settings.nodeId, name: configuration.items[0].name }]
      }),
      headers: { 'Content-Type': 'application/json' }
    };
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}-test/read` }),
      fetchOptions
    );
  });
});
