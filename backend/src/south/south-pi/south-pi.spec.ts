import SouthPi from './south-pi';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { SouthPIItemSettings, SouthPISettings } from '../../../../shared/model/south-settings.model';
import fetch from 'node-fetch';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthConnectorMetricsRepository from '../../repository/logs/south-connector-metrics.repository';
import NorthMetricsRepositoryMock from '../../tests/__mocks__/repository/log/north-metrics-repository.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import SouthConnectorMetricsServiceMock from '../../tests/__mocks__/service/south-connector-metrics-service.mock';
import { SouthConnectorEntity } from '../../model/south-connector.model';

jest.mock('node-fetch');
jest.mock('node:fs/promises');
jest.mock('../../service/utils');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southMetricsRepository: SouthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();
const southConnectorMetricsService = new SouthConnectorMetricsServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);

jest.mock(
  '../../service/south-connector-metrics.service',
  () =>
    function () {
      return southConnectorMetricsService;
    }
);

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

describe('South PI', () => {
  let south: SouthPi;
  const configuration: SouthConnectorEntity<SouthPISettings, SouthPIItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    sharedConnection: false,
    settings: {
      agentUrl: 'http://localhost:2224',
      retryInterval: 1000
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          type: 'pointId',
          piPoint: 'FACTORY.WORKSHOP.POINT.ID1'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          type: 'pointQuery',
          piQuery: '*'
        },
        scanModeId: 'scanModeId1'
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthPi(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder'
    );
  });

  it('should properly connect to remote agent and disconnect ', async () => {
    await south.connect();
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/pi/${configuration.id}/connect`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    await south.disconnect();
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/pi/${configuration.id}/disconnect`, {
      method: 'DELETE'
    });
  });

  it('should properly reconnect to when connection fails ', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connection failed');
    });

    await south.connect();
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/pi/${configuration.id}/connect`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should properly clear reconnect timeout on disconnect when not connected', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connection failed');
    });

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await south.connect();

    expect(fetch).toHaveBeenCalledTimes(1);
    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending connection HTTP request into agent. Reconnecting in ${configuration.settings.retryInterval} ms. ${new Error(
        'connection failed'
      )}`
    );
  });

  it('should properly clear reconnect timeout on disconnect when connected', async () => {
    (fetch as unknown as jest.Mock)
      .mockImplementationOnce(() => {
        return true;
      })
      .mockImplementationOnce(() => {
        throw new Error('disconnection failed');
      });

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await south.connect();

    expect(fetch).toHaveBeenCalledTimes(1);
    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending disconnection HTTP request into agent. ${new Error('disconnection failed')}`
    );
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
    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          status: 200,
          json: () => ({
            recordCount: 2,
            content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
            logs: ['log1', 'log2'],
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
            logs: [],
            maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
          })
        })
      );

    const result = await south.historyQuery(configuration.items, startTime, endTime);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/pi/${configuration.id}/read`, {
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
    });

    expect(result).toEqual('2020-03-01T00:00:00.000Z');
    expect(south.addContent).toHaveBeenCalledWith({
      type: 'time-values',
      content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
    });
    expect(logger.warn).toHaveBeenCalledWith('log1');
    expect(logger.warn).toHaveBeenCalledWith('log2');

    const noResult = await south.historyQuery(configuration.items, startTime, endTime);
    expect(noResult).toEqual('2020-01-01T00:00:00.000Z');
    expect(logger.debug).toHaveBeenCalledWith('No result found. Request done in 0 ms');
    expect(logger.warn).toHaveBeenCalledTimes(2);
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
      .mockReturnValue(
        Promise.resolve({
          status: 500
        })
      );

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

    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('bad request');
    });

    await expect(south.historyQuery(configuration.items, startTime, endTime)).rejects.toThrow(new Error('bad request'));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue({ ...configuration, enabled: false });

    await south.start();
    await expect(south.historyQuery(configuration.items, startTime, endTime)).rejects.toThrow(new Error('bad request'));
  });

  it('should test item', async () => {
    (fetch as unknown as jest.Mock).mockReturnValueOnce(
      Promise.resolve({
        status: 200,
        json: () => ({
          recordCount: 2,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        })
      })
    );

    const callback = jest.fn();
    south.connect = jest.fn();
    south.disconnect = jest.fn();
    await south.testItem(configuration.items[0], callback);
    expect(south.connect).toHaveBeenCalledTimes(1);
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should test item and throw error if bad status', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        status: 400
      })
    );

    const callback = jest.fn();
    south.connect = jest.fn();
    south.disconnect = jest.fn();
    await expect(south.testItem(configuration.items[0], callback)).rejects.toThrow(
      `Error occurred when sending connect command to remote agent. 400`
    );
    expect(south.connect).toHaveBeenCalledTimes(1);
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
  });
});
