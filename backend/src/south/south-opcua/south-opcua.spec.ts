import nodeOPCUAMock from '../../tests/__mocks__/node-opcua.mock';
import SouthOPCUA from './south-opcua';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { SouthOPCUAItemSettings, SouthOPCUASettings } from '../../../shared/model/south-settings.model';
import Stream from 'node:stream';
import {
  ClientMonitoredItem,
  ClientSession,
  ClientSubscription,
  DataType,
  HistoryReadRequest,
  NodeId,
  resolveNodeId,
  StatusCodes
} from 'node-opcua';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import testData from '../../tests/utils/test-data';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import { DateTime } from 'luxon';
import {
  createSessionConfigs,
  getHistoryReadRequest,
  getTimestamp,
  initOPCUACertificateFolders,
  logMessages,
  parseOPCUAValue,
  toOPCUASecurityMode,
  toOPCUASecurityPolicy
} from '../../service/utils-opcua';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'crypto';

class CustomStream extends Stream {
  constructor() {
    super();
  }

  terminate() {
    return;
  }
}

jest.mock('node-opcua', () => ({
  ...nodeOPCUAMock,
  DataType: jest.requireActual('node-opcua').DataType,
  StatusCodes: jest.requireActual('node-opcua').StatusCodes,
  SecurityPolicy: jest.requireActual('node-opcua').SecurityPolicy,
  AttributeIds: jest.requireActual('node-opcua').AttributeIds,
  UserTokenType: jest.requireActual('node-opcua').UserTokenType,
  TimestampsToReturn: jest.requireActual('node-opcua').TimestampsToReturn,
  AggregateFunction: jest.requireActual('node-opcua').AggregateFunction,
  HistoryReadRequest: jest.requireActual('node-opcua').HistoryReadRequest
}));
// Mock only the randomUUID function because other functions are used by OPCUA
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn()
}));
jest.mock('node:fs/promises');
jest.mock('../../service/utils');
jest.mock('../../service/utils-opcua');

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

const opcuaOptions = {
  applicationName: 'OIBus',
  clientName: 'connectorName-connectorId',
  connectionStrategy: {
    initialDelay: 1000,
    maxRetry: 1
  },
  securityMode: 1,
  securityPolicy: 'none',
  endpointMustExist: false,
  keepSessionAlive: false,
  keepPendingSessionsOnDisconnect: false,
  requestedSessionTimeout: 15000,
  clientCertificateManager: { state: 2 }
};
const opcuaUserIdentity = { type: 0 };

describe('SouthOPCUA', () => {
  let south: SouthOPCUA;
  const configuration: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'opcua',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      sharedConnection: false,
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 15000,
      flushMessageTimeout: 1000,
      maxNumberOfMessages: 1000,
      authentication: {
        type: 'none'
      },
      securityMode: 'none',
      securityPolicy: 'none',
      keepSessionAlive: false
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Random',
          mode: 'ha',
          haMode: {
            aggregate: 'raw',
            resampling: 'none'
          }
        },
        scanMode: testData.scanMode.list[0],
        groups: []
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Counter',
          mode: 'ha',
          haMode: {
            aggregate: 'raw',
            resampling: 'none'
          }
        },
        scanMode: testData.scanMode.list[0],
        groups: []
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Triangle',
          mode: 'ha',
          haMode: {
            aggregate: 'raw',
            resampling: 'none'
          }
        },
        scanMode: testData.scanMode.list[1],
        groups: []
      },
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Random',
          mode: 'da',
          timestampOrigin: 'oibus'
        },
        scanMode: testData.scanMode.list[0],
        groups: []
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Counter',
          mode: 'da',
          timestampOrigin: 'point'
        },
        scanMode: testData.scanMode.list[0],
        groups: []
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Triangle',
          mode: 'da',
          timestampOrigin: 'server'
        },
        scanMode: testData.scanMode.list[1],
        groups: []
      }
    ]
  };
  let historyReadRequest: HistoryReadRequest;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    historyReadRequest = { requestHeader: {} } as unknown as HistoryReadRequest;
    (toOPCUASecurityPolicy as jest.Mock).mockReturnValue('none');
    (toOPCUASecurityMode as jest.Mock).mockReturnValue(1);
    (createSessionConfigs as jest.Mock).mockReturnValue({ options: opcuaOptions, userIdentity: opcuaUserIdentity });
    (getHistoryReadRequest as jest.Mock).mockReturnValue(historyReadRequest);
    (getTimestamp as jest.Mock).mockReturnValue(testData.constants.dates.FAKE_NOW);
    (randomUUID as jest.Mock).mockReturnValue('randomUUID');
    south = new SouthOPCUA(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  it('should be properly initialized', async () => {
    south.connect = jest.fn();
    south.createSession = jest.fn();
    await south.start();
    await south.start();
    expect(initOPCUACertificateFolders).toHaveBeenCalledTimes(2);
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith('cacheFolder');
    // createSession should not be called right after starting, because
    // it will be eventually called when the first session is needed
    expect(south.createSession).not.toHaveBeenCalled();
    expect(south.connect).toHaveBeenCalledTimes(2);
  });

  it('should properly connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    south.createSession = jest.fn();
    south.disconnect = jest.fn();
    south['reconnectTimeout'] = setTimeout(() => null);
    south['flushTimeout'] = setTimeout(() => null);
    await south.connect();
    expect(south.createSession).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(south.disconnect).not.toHaveBeenCalled();
  });

  it('should not reconnect if disconnecting', async () => {
    south.createSession = jest.fn().mockImplementation(() => {
      throw new Error('get session error');
    });
    south.disconnect = jest.fn();
    south['disconnecting'] = true;
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    await south.connect();
    expect(logger.error).toHaveBeenCalledWith('Error while connecting to the OPCUA server: get session error');
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(south.disconnect).toHaveBeenCalled();
  });

  it('should properly reconnect if not disconnecting', async () => {
    south.createSession = jest.fn().mockImplementation(() => {
      throw new Error('get session error');
    });
    south.disconnect = jest.fn();
    south['disconnecting'] = false;
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    await south.connect();
    expect(logger.error).toHaveBeenCalledWith('Error while connecting to the OPCUA server: get session error');
    expect(south.disconnect).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should properly disconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await south.disconnect();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    south['flushTimeout'] = setTimeout(() => null);
    south['reconnectTimeout'] = setTimeout(() => null);
    const terminate = jest.fn();
    const close = jest.fn();
    south['subscription'] = { terminate } as unknown as ClientSubscription;
    south['client'] = { close } as unknown as ClientSession;

    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('should properly test connection', async () => {
    const mockedClient = { close: jest.fn() };
    south.createSession = jest.fn().mockReturnValueOnce(mockedClient);
    await south.testConnection();
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith('opcua-test-randomUUID');
    expect(south.createSession).toHaveBeenCalledTimes(1);
    expect(mockedClient.close).toHaveBeenCalledTimes(1);
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('opcua-test-randomUUID'), { recursive: true, force: true });
  });

  it('should properly throw error if test fails', async () => {
    south.createSession = jest.fn().mockImplementationOnce(() => {
      throw new Error('get session error');
    });
    await expect(south.testConnection()).rejects.toThrow('get session error');
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith('opcua-test-randomUUID');
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('opcua-test-randomUUID'), { recursive: true, force: true });
    expect(south.createSession).toHaveBeenCalledTimes(1);
  });

  it('should properly test ha item', async () => {
    const mockedClient = { close: jest.fn() };
    south.createSession = jest.fn().mockReturnValueOnce(mockedClient);
    south.getDAValues = jest.fn();
    south.getHAValues = jest.fn();

    await south.testItem(configuration.items[0], {
      history: {
        startTime: testData.constants.dates.DATE_1,
        endTime: testData.constants.dates.DATE_2
      }
    });
    expect(south.getHAValues).toHaveBeenCalledWith(
      [configuration.items[0]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      mockedClient,
      true
    );
    expect(resolveNodeId).not.toHaveBeenCalled();
    expect(south.getDAValues).not.toHaveBeenCalled();
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith('opcua-test-randomUUID');
    expect(south.createSession).toHaveBeenCalledTimes(1);
    expect(mockedClient.close).toHaveBeenCalledTimes(1);
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('opcua-test-randomUUID'), { recursive: true, force: true });
  });

  it('should properly test da item', async () => {
    const mockedClient = { close: jest.fn() };
    south.createSession = jest.fn().mockReturnValueOnce(mockedClient);
    south.getDAValues = jest.fn();
    south.getHAValues = jest.fn();
    await south.testItem(configuration.items[3], { history: undefined });
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith('opcua-test-randomUUID');
    expect(resolveNodeId).toHaveBeenCalledWith(configuration.items[0].settings.nodeId);
    expect(south.createSession).toHaveBeenCalledTimes(1);
    expect(mockedClient.close).toHaveBeenCalledTimes(1);
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('opcua-test-randomUUID'), { recursive: true, force: true });
  });

  it('should properly throw error if test item fails', async () => {
    south.createSession = jest.fn().mockImplementationOnce(() => {
      throw new Error('get session error');
    });
    south.getDAValues = jest.fn();
    south.getHAValues = jest.fn();
    await expect(south.testItem(configuration.items[3], { history: undefined })).rejects.toThrow('get session error');
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith('opcua-test-randomUUID');
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('opcua-test-randomUUID'), { recursive: true, force: true });
    expect(south.createSession).toHaveBeenCalledTimes(1);
    expect(south.getDAValues).not.toHaveBeenCalled();
    expect(south.getHAValues).not.toHaveBeenCalled();
  });

  it('should properly manage history query', async () => {
    south.getHAValues = jest.fn();
    south['client'] = {} as unknown as ClientSession;
    await south.historyQuery(
      [configuration.items[0], configuration.items[1], configuration.items[2]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2
    );

    expect(south.getHAValues).toHaveBeenCalledWith(
      [configuration.items[0], configuration.items[1], configuration.items[2]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      south['client']
    );
  });

  it('should properly manage history query and manage error', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    south.getHAValues = jest.fn().mockImplementationOnce(() => {
      throw new Error('history error');
    });
    south['client'] = {} as unknown as ClientSession;
    south.disconnect = jest.fn();
    await expect(
      south.historyQuery(
        [configuration.items[0], configuration.items[1], configuration.items[2]],
        testData.constants.dates.DATE_1,
        testData.constants.dates.DATE_2
      )
    ).rejects.toThrow('history error');
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalled();
  });

  it('should properly manage history query and manage error and not reconnect if disconnecting', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    south.getHAValues = jest.fn().mockImplementationOnce(() => {
      throw new Error('history error');
    });
    south['client'] = {} as unknown as ClientSession;
    south.disconnect = jest.fn();
    south['disconnecting'] = true;
    await expect(
      south.historyQuery(
        [configuration.items[0], configuration.items[1], configuration.items[2]],
        testData.constants.dates.DATE_1,
        testData.constants.dates.DATE_2
      )
    ).rejects.toThrow('history error');
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should throw error when querying history with client not set', async () => {
    south.getHAValues = jest.fn();

    await expect(
      south.historyQuery(
        [configuration.items[0], configuration.items[1], configuration.items[2]],
        testData.constants.dates.DATE_1,
        testData.constants.dates.DATE_2
      )
    ).rejects.toThrow('OPCUA client not set');

    expect(south.getHAValues).not.toHaveBeenCalled();
  });

  it('should properly get HA values with response status not good', async () => {
    const historyRead = jest.fn().mockReturnValue({
      responseHeader: {
        serviceResult: {
          isNot: jest.fn().mockReturnValue(true),
          description: 'not ok'
        }
      }
    });
    const mockedClient = {
      historyRead,
      close: jest.fn()
    } as unknown as ClientSession;

    south.addContent = jest.fn();
    (resolveNodeId as jest.Mock).mockImplementationOnce(() => {
      throw new Error('node id error');
    });

    await south.getHAValues(
      [configuration.items[0], configuration.items[0], configuration.items[1]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      mockedClient
    );

    expect(getHistoryReadRequest).toHaveBeenCalledWith(testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'raw', 'none', [
      { nodeId: configuration.items[0].settings.nodeId },
      { nodeId: configuration.items[1].settings.nodeId }
    ]);
    expect(mockedClient.historyRead).toHaveBeenCalledWith(historyReadRequest);
    expect(historyReadRequest.requestHeader.timeoutHint).toEqual(configuration.settings.readTimeout);
    expect(logger.error).toHaveBeenCalledWith(
      `Error when parsing node ID ${configuration.items[0].settings.nodeId} for item ${configuration.items[0].name}: node id error`
    );
    expect(logger.error).toHaveBeenCalledWith('Error while reading history: not ok');
    expect(logger.error).toHaveBeenCalledWith('No result found in response');
  });

  it('should properly retrieve HA values with associated node not found', async () => {
    const historyRead = jest.fn().mockReturnValue({
      responseHeader: {
        serviceResult: {
          isNot: jest.fn().mockReturnValue(true),
          description: 'not ok'
        }
      }
    });
    const mockedClient = {
      historyRead,
      close: jest.fn()
    } as unknown as ClientSession;
    south.addContent = jest.fn();

    await south.getHAValues(
      [configuration.items[0], configuration.items[1]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      mockedClient
    );

    expect(getHistoryReadRequest).toHaveBeenCalledWith(testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'raw', 'none', [
      { nodeId: configuration.items[0].settings.nodeId },
      { nodeId: configuration.items[1].settings.nodeId }
    ]);
    expect(mockedClient.historyRead).toHaveBeenCalledWith(historyReadRequest);
    expect(historyReadRequest.requestHeader.timeoutHint).toEqual(configuration.settings.readTimeout);
    expect(logger.error).toHaveBeenCalledWith('Error while reading history: not ok');
    expect(logger.error).toHaveBeenCalledWith('No result found in response');
  });

  it('getHAValues() in case of a test', async () => {
    const historyRead = jest.fn().mockReturnValue({
      responseHeader: {
        serviceResult: StatusCodes.Good
      },
      results: [
        {
          historyData: {
            dataValues: [
              {
                sourceTimestamp: new Date(testData.constants.dates.FAKE_NOW),
                value: {
                  value: '123',
                  dataType: DataType.String
                },
                statusCode: StatusCodes.Good
              },
              {
                sourceTimestamp: new Date(testData.constants.dates.FAKE_NOW),
                value: {
                  value: '456',
                  dataType: DataType.String
                },
                statusCode: StatusCodes.Good
              }
            ]
          },
          statusCode: StatusCodes.Good,
          continuationPoint: false
        }
      ]
    });
    const client = { historyRead } as unknown as ClientSession;

    (parseOPCUAValue as jest.Mock).mockReturnValueOnce('').mockReturnValueOnce('123');
    const result = await south.getHAValues(
      [configuration.items[0]],
      testData.constants.dates.FAKE_NOW,
      testData.constants.dates.FAKE_NOW,
      client,
      true
    );
    expect(historyRead).toHaveBeenCalled();
    expect(result).toEqual({
      content: [
        {
          data: { quality: 'Good', value: '123' },
          pointId: 'item1',
          timestamp: testData.constants.dates.FAKE_NOW
        }
      ],
      type: 'time-values'
    });
  });

  it('getHAValues() in case of run time', async () => {
    const historyRead = jest
      .fn()
      .mockReturnValueOnce({
        responseHeader: {
          serviceResult: StatusCodes.Good
        },
        results: [
          {
            historyData: {
              dataValues: [
                {
                  sourceTimestamp: new Date(testData.constants.dates.DATE_2),
                  value: {
                    value: '123',
                    dataType: DataType.String
                  },
                  statusCode: StatusCodes.Good
                },
                {
                  serverTimestamp: new Date(testData.constants.dates.DATE_1),
                  value: {
                    value: '123',
                    dataType: DataType.String
                  },
                  statusCode: StatusCodes.Good
                }
              ]
            },
            statusCode: StatusCodes.Good,
            continuationPoint: true
          }
        ]
      })
      .mockReturnValueOnce({
        responseHeader: {
          serviceResult: StatusCodes.Good
        },
        results: [
          {
            historyData: {
              dataValues: [
                {
                  sourceTimestamp: new Date(testData.constants.dates.DATE_2),
                  value: {
                    value: '789',
                    dataType: DataType.String
                  },
                  statusCode: StatusCodes.Good
                }
              ]
            },
            statusCode: StatusCodes.Good,
            continuationPoint: false
          }
        ]
      });
    const client = { historyRead } as unknown as ClientSession;

    south.addContent = jest.fn();
    (parseOPCUAValue as jest.Mock).mockReturnValueOnce('123').mockReturnValueOnce('456');
    await south.getHAValues([configuration.items[0]], testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, client, false);
    expect(historyRead).toHaveBeenCalled();
    expect(south.addContent).toHaveBeenCalledWith(
      {
        content: [
          {
            data: { quality: 'Good', value: '123' },
            pointId: 'item1',
            timestamp: testData.constants.dates.DATE_2
          },
          {
            data: { quality: 'Good', value: '456' },
            pointId: 'item1',
            timestamp: testData.constants.dates.DATE_1
          }
        ],
        type: 'time-values'
      },
      testData.constants.dates.FAKE_NOW,
      [configuration.items[0].id]
    );
  });

  it('getHAValues() in case of a bad result status code', async () => {
    const historyRead = jest.fn().mockReturnValue({
      responseHeader: {
        serviceResult: StatusCodes.Good
      },
      results: [
        {
          statusCode: StatusCodes.Bad,
          continuationPoint: false
        },
        {
          statusCode: StatusCodes.BadDataLost,
          continuationPoint: false
        },
        {
          statusCode: StatusCodes.Bad,
          continuationPoint: false
        }
      ]
    });
    const client = { historyRead } as unknown as ClientSession;

    const result = await south.getHAValues(
      [configuration.items[0], configuration.items[1], configuration.items[2]],
      testData.constants.dates.FAKE_NOW,
      testData.constants.dates.FAKE_NOW,
      client,
      true
    );
    expect(historyRead).toHaveBeenCalled();
    expect(result).toEqual({
      content: [],
      type: 'time-values'
    });
    const expectedLogs = new Map();
    expectedLogs.set('Bad', {
      affectedNodes: [configuration.items[0].name, configuration.items[2].name],
      description: 'The operation failed.'
    });
    expectedLogs.set('BadDataLost', {
      affectedNodes: [configuration.items[1].name],
      description: 'Data is missing due to collection started/stopped/lost.'
    });
    expect(logMessages).toHaveBeenCalledWith(expectedLogs, logger);
  });

  it('getHAValues() should do nothing if no data values', async () => {
    const historyRead = jest.fn().mockReturnValue({
      responseHeader: {
        serviceResult: StatusCodes.Good
      },
      results: [
        {
          historyData: {},
          statusCode: StatusCodes.Good,
          continuationPoint: false
        }
      ]
    });
    const client = { historyRead } as unknown as ClientSession;

    await south.getHAValues([configuration.items[0]], testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, client, true);
    expect(historyRead).toHaveBeenCalled();
  });

  it('should filter HA items', () => {
    const result = south.filterHistoryItems(configuration.items);
    expect(result).toEqual(configuration.items.filter(item => item.settings.mode === 'ha'));
  });

  it('should properly throw error on query last point if client not set', async () => {
    south.getDAValues = jest.fn();
    await expect(south.lastPointQuery(configuration.items)).rejects.toThrow('OPCUA client not set');
    expect(south.getDAValues).not.toHaveBeenCalled();
  });

  it('should do nothing on query last point if no nodes to read', async () => {
    south['client'] = {} as unknown as ClientSession;
    south.getDAValues = jest.fn();
    south.addContent = jest.fn();
    await south.lastPointQuery([]);
    expect(south.getDAValues).not.toHaveBeenCalled();
    expect(south.addContent).not.toHaveBeenCalled();
  });

  it('should query last point (only one)', async () => {
    const mockedClient = {} as unknown as ClientSession;
    south['client'] = mockedClient;
    south.getDAValues = jest.fn().mockReturnValue(testData.oibusContent[0]);
    south.addContent = jest.fn();
    await south.lastPointQuery([configuration.items[0], configuration.items[3]]);
    expect(logger.debug(`Read node ${configuration.items[3].settings.nodeId}`));
    expect(south.getDAValues).toHaveBeenCalledWith(
      [{ nodeId: configuration.items[3].settings.nodeId, name: configuration.items[3].name, settings: configuration.items[3].settings }],
      mockedClient
    );
    expect(south.addContent).toHaveBeenCalledWith(testData.oibusContent[0], testData.constants.dates.FAKE_NOW, [configuration.items[0].id]);
  });

  it('should query last point (several) and fail and reconnect', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const mockedClient = {} as unknown as ClientSession;
    south['client'] = mockedClient;
    south.getDAValues = jest.fn().mockImplementationOnce(() => {
      throw new Error('opcua read error');
    });
    south.addContent = jest.fn();
    south.disconnect = jest.fn();
    south.connect = jest.fn();
    await expect(south.lastPointQuery([configuration.items[0], configuration.items[3]])).rejects.toThrow('opcua read error');
    expect(logger.debug(`Read node ${configuration.items[3].settings.nodeId}`));
    expect(south.getDAValues).toHaveBeenCalledWith(
      [{ nodeId: configuration.items[3].settings.nodeId, name: configuration.items[3].name, settings: configuration.items[3].settings }],
      mockedClient
    );
    expect(south.addContent).not.toHaveBeenCalled();
    expect(south.disconnect).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalled();
  });

  it('should query last point (several) and fail and not reconnect', async () => {
    const mockedClient = {} as unknown as ClientSession;
    south['client'] = mockedClient;
    south.getDAValues = jest.fn().mockImplementationOnce(() => {
      throw new Error('opcua read error');
    });
    south.addContent = jest.fn();
    south.disconnect = jest.fn();
    south.connect = jest.fn();
    south['disconnecting'] = true;
    await expect(south.lastPointQuery([configuration.items[0], configuration.items[3]])).rejects.toThrow('opcua read error');
    expect(logger.debug(`Read node ${configuration.items[3].settings.nodeId}`));
    expect(south.getDAValues).toHaveBeenCalledWith(
      [{ nodeId: configuration.items[3].settings.nodeId, name: configuration.items[3].name, settings: configuration.items[3].settings }],
      mockedClient
    );
    expect(south.addContent).not.toHaveBeenCalled();
    expect(south.connect).not.toHaveBeenCalled();
    expect(south.disconnect).toHaveBeenCalled();
  });

  it('should not query items if bad node id', async () => {
    south['client'] = {} as unknown as ClientSession;
    south.getDAValues = jest.fn();
    (resolveNodeId as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('bad node id');
      })
      .mockImplementationOnce(() => {
        throw new Error('bad node id');
      })
      .mockImplementationOnce(() => {
        throw new Error('bad node id');
      });

    await south.lastPointQuery([configuration.items[3], configuration.items[4], configuration.items[5]]);
    expect(south.getDAValues).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(3);
  });

  it('getDAValues() should properly retrieve data', async () => {
    const read = jest.fn().mockReturnValue([
      {
        sourceTimestamp: new Date(testData.constants.dates.FAKE_NOW),
        value: {
          value: '123',
          dataType: DataType.String
        },
        statusCode: StatusCodes.Good
      },
      {
        sourceTimestamp: new Date(testData.constants.dates.FAKE_NOW),
        value: {
          value: '456',
          dataType: DataType.String
        },
        statusCode: StatusCodes.Good
      }
    ]);
    const client = { read } as unknown as ClientSession;

    (parseOPCUAValue as jest.Mock).mockReturnValueOnce('').mockReturnValueOnce('123');
    const result = await south.getDAValues(
      [
        {
          nodeId: configuration.items[0].settings.nodeId as unknown as NodeId,
          name: configuration.items[0].name,
          settings: configuration.items[0].settings
        },
        {
          nodeId: configuration.items[1].settings.nodeId as unknown as NodeId,
          name: configuration.items[1].name,
          settings: configuration.items[1].settings
        }
      ],
      client
    );
    expect(read).toHaveBeenCalled();
    expect(result).toEqual({
      content: [
        {
          data: { quality: 'Good', value: '123' },
          pointId: 'item2',
          timestamp: testData.constants.dates.FAKE_NOW
        }
      ],
      type: 'time-values'
    });
  });

  it('getDAValues() should properly retrieve data', async () => {
    const read = jest.fn().mockReturnValue([]);
    const client = { read } as unknown as ClientSession;

    const result = await south.getDAValues(
      [
        {
          nodeId: configuration.items[0].settings.nodeId as unknown as NodeId,
          name: configuration.items[0].name,
          settings: configuration.items[0].settings
        }
      ],
      client
    );
    expect(read).toHaveBeenCalled();
    expect(result).toEqual({
      content: [],
      type: 'time-values'
    });
    expect(logger.error).toHaveBeenCalledWith(`Received 0 node results, requested 1 nodes. Request done in 0 ms`);
  });

  it('should not subscribe if session is not set', async () => {
    await expect(south.subscribe(configuration.items)).rejects.toThrow('OPCUA client not set');
  });

  it('should not subscribe if session is not set', async () => {
    await expect(south.subscribe([])).resolves.not.toThrow();
  });

  it('should not subscribe if already subscribe', async () => {
    const stream = new CustomStream();
    stream.terminate = jest.fn();
    const monitorFn = jest.fn().mockReturnValue(stream);
    south['client'] = {
      createSubscription2: jest.fn().mockReturnValue({ terminate: jest.fn(), monitor: monitorFn })
    } as unknown as ClientSession;

    south['subscription'] = { terminate: jest.fn(), monitor: monitorFn } as unknown as ClientSubscription;
    await south.subscribe([configuration.items[0]]);
    expect(south['client'].createSubscription2).not.toHaveBeenCalled();
    expect(monitorFn).toHaveBeenCalledTimes(1);
  });

  it('should properly manage subscriptions', async () => {
    const stream = new CustomStream();
    stream.terminate = jest.fn();
    const monitorFn = jest.fn().mockReturnValue(stream);
    south['client'] = {
      createSubscription2: jest.fn().mockReturnValue({ terminate: jest.fn(), monitor: monitorFn })
    } as unknown as ClientSession;

    (resolveNodeId as jest.Mock).mockImplementationOnce(() => {
      throw new Error('bad node id');
    });
    south.addContent = jest.fn();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    south['monitoredItems'].set(configuration.items[1].id, {} as unknown as ClientMonitoredItem);

    await south.subscribe([configuration.items[0], configuration.items[1], configuration.items[2]]);
    expect(south['client'].createSubscription2).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(monitorFn).toHaveBeenCalledTimes(1);
    expect(south.addContent).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      `Error when parsing node ID ${configuration.items[0].settings.nodeId} for item ${configuration.items[0].name}: bad node id`
    );
    expect(south['monitoredItems'].size).toBe(2);

    south.flushMessages = jest.fn();
    (parseOPCUAValue as jest.Mock).mockReturnValueOnce('').mockReturnValue('parsedValue');
    south['connector'].settings.maxNumberOfMessages = 2;
    stream.emit('changed', { value: { value: 1, dataType: DataType.Null }, sourceTimestamp: DateTime.now(), statusCode: StatusCodes.Good });
    stream.emit('changed', { value: { value: 1, dataType: DataType.Null }, sourceTimestamp: DateTime.now(), statusCode: StatusCodes.Good });
    expect(south.flushMessages).not.toHaveBeenCalled();
    stream.emit('changed', {
      value: { value: 1, dataType: DataType.Float },
      serverTimestamp: DateTime.now(),
      statusCode: StatusCodes.Good
    });
    expect(south.flushMessages).toHaveBeenCalledTimes(1);
    expect(south['bufferedValues']).toEqual([
      {
        item: configuration.items[2],
        timestamp: testData.constants.dates.FAKE_NOW,
        value: 'parsedValue',
        quality: 'Good'
      },
      {
        item: configuration.items[2],
        timestamp: testData.constants.dates.FAKE_NOW,
        value: 'parsedValue',
        quality: 'Good'
      }
    ]);
  });

  it('should properly unsubscribe', async () => {
    const removeAllListeners = jest.fn();
    const terminate = jest.fn();
    south['monitoredItems'].set(configuration.items[1].id, { removeAllListeners, terminate } as unknown as ClientMonitoredItem);

    await south.unsubscribe([configuration.items[0], configuration.items[1]]);

    expect(removeAllListeners).toHaveBeenCalledTimes(1);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(south['monitoredItems'].size).toBe(0);
  });

  it('should get throttling settings', () => {
    expect(south.getThrottlingSettings(configuration.settings)).toEqual({
      maxReadInterval: configuration.settings.throttling.maxReadInterval,
      readDelay: configuration.settings.throttling.readDelay
    });
    expect(south.getMaxInstantPerItem(configuration.settings)).toEqual(configuration.settings.throttling.maxInstantPerItem);
    expect(south.getOverlap(configuration.settings)).toEqual(configuration.settings.throttling.overlap);
  });

  it('should not flush messages if none in buffer', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    south.addContent = jest.fn();
    await south.flushMessages();
    expect(south.addContent).not.toHaveBeenCalled();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalled();
  });

  it('should flush messages', async () => {
    south['bufferedValues'] = [
      {
        item: { name: 'pointId', id: 'itemId' } as SouthConnectorItemEntity<SouthOPCUAItemSettings>,
        timestamp: testData.constants.dates.FAKE_NOW,
        value: 'value1',
        quality: 'quality1'
      },
      {
        item: { name: 'pointId', id: 'itemId' } as SouthConnectorItemEntity<SouthOPCUAItemSettings>,
        timestamp: testData.constants.dates.FAKE_NOW,
        value: 'value2',
        quality: 'quality2'
      }
    ];
    south['flushTimeout'] = setTimeout(() => null);

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    south.addContent = jest.fn();
    await south.flushMessages();
    expect(south.addContent).toHaveBeenCalledWith(
      {
        type: 'time-values',
        content: [
          {
            pointId: 'pointId',
            timestamp: testData.constants.dates.FAKE_NOW,
            data: {
              value: 'value1',
              quality: 'quality1'
            }
          },
          {
            pointId: 'pointId',
            timestamp: testData.constants.dates.FAKE_NOW,
            data: {
              value: 'value2',
              quality: 'quality2'
            }
          }
        ]
      },
      testData.constants.dates.FAKE_NOW,
      ['itemId']
    );
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalled();
  });

  it('should flush messages and manage addContent error', async () => {
    south['bufferedValues'] = [
      {
        item: { name: 'pointId', id: 'itemId' } as SouthConnectorItemEntity<SouthOPCUAItemSettings>,
        timestamp: testData.constants.dates.FAKE_NOW,
        value: 'value1',
        quality: 'quality1'
      }
    ];

    south.addContent = jest.fn().mockImplementationOnce(() => {
      throw new Error('cache content error');
    });
    await south.flushMessages();
    expect(logger.error).toHaveBeenCalledWith('Error when flushing messages: cache content error');
  });
});
