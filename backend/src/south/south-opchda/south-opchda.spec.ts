import SouthOPCHDA from './south-opchda';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import { SouthOPCHDAItemSettings, SouthOPCHDASettings } from '../../../../shared/model/south-settings.model';
import fetch from 'node-fetch';

jest.mock('node-fetch');
jest.mock('node:fs/promises');
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
const items: Array<SouthConnectorItemDTO<SouthOPCHDAItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Random',
      aggregate: 'raw',
      resampling: 'none'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    enabled: true,
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Counter',
      aggregate: 'raw'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id3',
    name: 'item3',
    enabled: true,
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Triangle',
      aggregate: 'average',
      resampling: '10Seconds'
    },
    scanModeId: 'scanModeId2'
  }
];

const configuration: SouthConnectorDTO<SouthOPCHDASettings> = {
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
  settings: {
    agentUrl: 'http://localhost:2224',
    retryInterval: 1000,
    maxReturnValues: 0,
    readTimeout: 60,
    host: 'localhost',
    serverName: 'Matrikon.OPC.Simulation'
  }
};
let south: SouthOPCHDA;

describe('South OPCHDA', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    south = new SouthOPCHDA(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should properly connect to remote agent and disconnect ', async () => {
    await south.connect();
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/opc/${configuration.id}/connect`, {
      method: 'PUT',
      body: JSON.stringify({
        host: configuration.settings.host,
        serverName: configuration.settings.serverName
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    await south.disconnect();
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/opc/${configuration.id}/disconnect`, {
      method: 'DELETE'
    });
  });

  it('should properly reconnect to when connection fails ', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connection failed');
    });

    await south.connect();
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/opc/${configuration.id}/connect`, {
      method: 'PUT',
      body: JSON.stringify({
        host: configuration.settings.host,
        serverName: configuration.settings.serverName
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
        throw new Error('disconnection failed');
      });

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await south.connect();

    expect(fetch).toHaveBeenCalledTimes(1);
    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while sending connection HTTP request into agent. Reconnecting in ${configuration.settings.retryInterval} ms. ${new Error(
        'connection failed'
      )}`
    );
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
    await south.testConnection();
    expect(logger.info).toHaveBeenCalledWith('Connected to remote OPC server. Disconnecting...');
    expect(logger.info).toHaveBeenCalledWith(
      `Testing OPC OIBus Agent connection on ${configuration.settings.agentUrl} with host "${configuration.settings.host}" and server name "${configuration.settings.serverName}"`
    );
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
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when sending connect command to remote agent with status 400: bad request`);

    await expect(south.testConnection()).rejects.toThrow(
      new Error(`Error occurred when sending connect command to remote agent with status 500`)
    );
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when sending connect command to remote agent with status 500`);
  });

  it('should get data from Remote agent', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    south.addValues = jest.fn();
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

    const result = await south.historyQuery(items, startTime, endTime);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/opc/${configuration.id}/read`, {
      method: 'PUT',
      body: JSON.stringify({
        host: configuration.settings.host,
        serverName: configuration.settings.serverName,
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
    });

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.agentUrl}/api/opc/${configuration.id}/read`, {
      method: 'PUT',
      body: JSON.stringify({
        host: configuration.settings.host,
        serverName: configuration.settings.serverName,
        aggregate: 'average',
        resampling: '10Seconds',
        startTime,
        endTime,
        items: [{ name: 'item3', nodeId: 'ns=3;s=Triangle' }]
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(result).toEqual('2020-03-01T00:00:00.000Z');
    expect(south.addValues).toHaveBeenCalledWith([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);

    expect(logger.debug).toHaveBeenCalledWith(`No result found. Request done in 0 ms`);
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

    await south.historyQuery(items, startTime, endTime);
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when querying remote agent with status 400: bad request`);
    expect(logger.error).toHaveBeenCalledWith(`Error occurred when querying remote agent with status 500`);
  });
});
