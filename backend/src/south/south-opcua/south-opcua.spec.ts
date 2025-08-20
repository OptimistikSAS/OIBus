import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import ConnectionServiceMock from '../../tests/__mocks__/service/connection-service.mock';
import nodeOPCUAMock from '../../tests/__mocks__/node-opcua.mock';
import fs from 'node:fs/promises';
import SouthOPCUA, { MAX_NUMBER_OF_NODE_TO_LOG } from './south-opcua';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { randomUUID } from 'crypto';
import { SouthOPCUAItemSettings, SouthOPCUASettings } from '../../../shared/model/south-settings.model';
import Stream from 'node:stream';
import { initOPCUACertificateFolders, toOPCUASecurityPolicy, toOPCUASecurityMode, createSessionConfigs } from '../../service/utils-opcua';
import { HistoryReadValueIdOptions } from 'node-opcua-types/source/_generated_opcua_types';
import {
  OPCUAClient,
  AggregateFunction,
  ClientSession,
  DataType,
  DataValue,
  HistoryReadRequest,
  ReadProcessedDetails,
  ReadRawModifiedDetails,
  resolveNodeId,
  StatusCodes,
  TimestampsToReturn,
  Variant
} from 'node-opcua';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import testData from '../../tests/utils/test-data';
import { mockBaseFolders } from '../../tests/utils/test-utils';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import { DateTime } from 'luxon';
import { connectionService } from '../../service/connection.service';

class CustomStream extends Stream {
  constructor() {
    super();
  }

  terminate() {
    return;
  }
}

// Mock node-opcua-client
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

const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

jest.mock('../../service/connection.service', () => ({
  connectionService: new ConnectionServiceMock('', '')
}));

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
      sharedConnection: null,
      connectionSettings: {
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        authentication: {
          type: 'none'
        },
        securityMode: 'none',
        securityPolicy: 'none',
        keepSessionAlive: false
      },
      retryInterval: 10_000,
      readTimeout: 15_000,
      flushMessageTimeout: 1000,
      maxNumberOfMessages: 1000
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
        scanModeId: 'scanModeId1'
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
        scanModeId: 'scanModeId1'
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
        scanModeId: 'scanModeId2'
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
        scanModeId: 'scanModeId1'
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
        scanModeId: 'scanModeId1'
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
        scanModeId: 'scanModeId2'
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);
    (toOPCUASecurityPolicy as jest.Mock).mockReturnValue('none');
    (toOPCUASecurityMode as jest.Mock).mockReturnValue(1);
    (createSessionConfigs as jest.Mock).mockReturnValue({ options: opcuaOptions, userIdentity: opcuaUserIdentity });

    south = new SouthOPCUA(
      configuration,
      addContentCallback,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should get throttling settings', () => {
    expect(south.getThrottlingSettings(configuration.settings)).toEqual({
      maxReadInterval: configuration.settings.throttling.maxReadInterval,
      readDelay: configuration.settings.throttling.readDelay
    });
    expect(south.getMaxInstantPerItem(configuration.settings)).toEqual(configuration.settings.throttling.maxInstantPerItem);
    expect(south.getOverlap(configuration.settings)).toEqual(configuration.settings.throttling.overlap);
  });

  it('should be properly initialized', async () => {
    south.connect = jest.fn();
    south.createSession = jest.fn();
    await south.start();
    await south.start();
    expect(initOPCUACertificateFolders).toHaveBeenCalledTimes(2);
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith(south['baseFolders'].cache);
    // createSession should not be called right after starting, because
    // it will be eventually called when the first session is needed
    expect(south.createSession).not.toHaveBeenCalled();
    expect(south.connect).toHaveBeenCalledTimes(2);
  });

  it('should not reconnect if disconnecting', async () => {
    south.getSession = jest.fn().mockImplementation(() => {
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

  it('should properly connect and disconnect to OPCUA server without password', async () => {
    south.disconnect = jest.fn();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    await south.start();

    // retrieving a session to trigger the creation of a session
    await south.getSession();
    expect(OPCUAClient.createSession).toHaveBeenCalledWith(configuration.settings.connectionSettings!.url, opcuaUserIdentity, opcuaOptions);
    expect(logger.info).toHaveBeenCalledWith(`OPCUA South connector "${configuration.name}" connected`);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly manage connection error', async () => {
    (OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connection error');
    });

    await south.start();

    try {
      await south.getSession();
    } catch {
      expect(logger.error).toHaveBeenCalledWith(`Error while connecting to the OPCUA server. ${new Error('connection error')}`);
      await south.disconnect();
    }
  });

  it('should close session', async () => {
    await south.closeSession();
    const client = { close: jest.fn() } as unknown as ClientSession;
    south['client'] = client;
    await south.closeSession();
    expect(client.close).toHaveBeenCalledTimes(1);
  });

  it('should properly manage history query', async () => {
    const historyRead = jest
      .fn()
      .mockReturnValueOnce({
        responseHeader: {
          serviceResult: {
            isNot: jest.fn().mockReturnValue(false)
          }
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
                  serverTimestamp: new Date(testData.constants.dates.FAKE_NOW),
                  value: {
                    value: [0, 456],
                    dataType: DataType.UInt64
                  },
                  statusCode: StatusCodes.Good
                },
                {
                  serverTimestamp: new Date('2023-12-12T00:00:00.000Z'),
                  value: {
                    value: [0, 789],
                    dataType: DataType.Int64
                  },
                  statusCode: StatusCodes.Good
                },
                {
                  serverTimestamp: new Date('2023-12-12T00:00:00.000Z'),
                  value: {
                    value: [0x0a],
                    dataType: DataType.ByteString
                  },
                  statusCode: StatusCodes.Good
                },
                {
                  serverTimestamp: new Date('2023-12-12T00:00:00.000Z'),
                  value: {
                    value: new Date('2023-12-12T00:00:00.000Z'),
                    dataType: DataType.DateTime
                  },
                  statusCode: StatusCodes.Good
                },
                {
                  serverTimestamp: new Date('2023-12-12T00:00:00.000Z'),
                  value: {
                    value: null,
                    dataType: DataType.Null
                  },
                  statusCode: StatusCodes.Good
                }
              ]
            },
            statusCode: StatusCodes.Good,
            continuationPoint: []
          },
          {
            historyData: {
              dataValues: [
                {
                  sourceTimestamp: new Date(testData.constants.dates.FAKE_NOW),
                  value: {
                    value: true,
                    dataType: DataType.Boolean
                  },
                  statusCode: StatusCodes.Good
                },
                {
                  sourceTimestamp: new Date(testData.constants.dates.FAKE_NOW),
                  value: {
                    value: false,
                    dataType: DataType.Boolean
                  },
                  statusCode: StatusCodes.Bad
                }
              ]
            },
            statusCode: StatusCodes.Bad,
            continuationPoint: ['']
          },
          {
            historyData: { dataValues: [] },
            statusCode: StatusCodes.Good,
            continuationPoint: []
          },
          {
            statusCode: StatusCodes.Bad,
            continuationPoint: null
          }
        ]
      })
      .mockReturnValue({
        responseHeader: {
          serviceResult: {
            isNot: jest.fn().mockReturnValue(false)
          }
        },
        results: [
          {
            historyData: {
              dataValues: []
            },
            statusCode: StatusCodes.Good,
            continuationPoint: false
          }
        ]
      });
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({
      historyRead,
      close: jest.fn()
    });

    south.addContent = jest.fn();
    await south.start();

    await south.historyQuery(
      [configuration.items[0], configuration.items[1], configuration.items[2]],
      testData.constants.dates.FAKE_NOW,
      testData.constants.dates.FAKE_NOW
    );

    expect(south.addContent).toHaveBeenCalledWith({
      type: 'time-values',
      content: [
        {
          data: { value: '123', quality: StatusCodes.Good.name },
          pointId: configuration.items[0].name,
          timestamp: testData.constants.dates.FAKE_NOW
        },
        {
          data: { value: '456', quality: StatusCodes.Good.name },
          pointId: configuration.items[0].name,
          timestamp: testData.constants.dates.FAKE_NOW
        },
        {
          data: { value: '789', quality: StatusCodes.Good.name },
          pointId: configuration.items[0].name,
          timestamp: '2023-12-12T00:00:00.000Z'
        },
        {
          data: { value: '10', quality: StatusCodes.Good.name },
          pointId: configuration.items[0].name,
          timestamp: '2023-12-12T00:00:00.000Z'
        },
        {
          data: {
            value: '2023-12-12T00:00:00.000Z',
            quality: StatusCodes.Good.name
          },
          pointId: configuration.items[0].name,
          timestamp: '2023-12-12T00:00:00.000Z'
        }
      ]
    });
  });

  it('should properly parse boolean values', async () => {
    expect(
      south.parseOPCUAValue('item1', {
        value: true,
        dataType: DataType.Boolean
      } as Variant)
    ).toEqual('1');
    expect(
      south.parseOPCUAValue('item1', {
        value: false,
        dataType: DataType.Boolean
      } as Variant)
    ).toEqual('0');
    expect(
      south.parseOPCUAValue('item1', {
        value: null,
        dataType: DataType.Null
      } as Variant)
    ).toEqual('');
    expect(logger.debug).not.toHaveBeenCalled();
    expect(
      south.parseOPCUAValue('item1', {
        value: 'test',
        dataType: DataType.Variant
      } as Variant)
    ).toEqual('');
    expect(logger.debug).toHaveBeenCalledWith(`Item item1 with value test of type ${DataType.Variant} could not be parsed`);
  });

  it('should properly manage history query with status not good', async () => {
    const historyRead = jest.fn().mockReturnValue({
      responseHeader: {
        serviceResult: {
          isNot: jest.fn().mockReturnValue(true),
          description: 'not ok'
        }
      }
    });
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({
      historyRead,
      close: jest.fn()
    });

    south.addContent = jest.fn();
    await south.start();

    await south.historyQuery(
      [configuration.items[0], configuration.items[1]],
      testData.constants.dates.FAKE_NOW,
      testData.constants.dates.FAKE_NOW
    );

    expect(logger.error).toHaveBeenCalledWith('Error while reading history: not ok');
    expect(logger.error).toHaveBeenCalledWith('No result found in response');
  });

  it('should properly manage history query and log with mor than max', async () => {
    const results = [];
    for (let i = 0; i < MAX_NUMBER_OF_NODE_TO_LOG + 1; i++) {
      results.push({
        historyData: {
          dataValues: []
        },
        statusCode: StatusCodes.Bad,
        continuationPoint: false
      });
    }
    const historyRead = jest.fn().mockReturnValue({
      responseHeader: {
        serviceResult: {
          isNot: jest.fn().mockReturnValue(true),
          description: 'ok'
        }
      },
      results
    });
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({
      historyRead,
      close: jest.fn()
    });

    south.addContent = jest.fn();
    await south.start();

    await south.historyQuery(
      [
        configuration.items[0],
        configuration.items[0],
        configuration.items[0],
        configuration.items[0],
        configuration.items[0],
        configuration.items[0],
        configuration.items[0],
        configuration.items[0],
        configuration.items[0],
        configuration.items[0],
        configuration.items[0]
      ],
      testData.constants.dates.FAKE_NOW,
      testData.constants.dates.FAKE_NOW
    );

    expect(logger.debug).toHaveBeenCalledWith(
      `${StatusCodes.Bad.name} status code (${StatusCodes.Bad.description}): [${configuration.items[0].name}..${configuration.items[0].name}]`
    );
  });

  it('should properly manage history query with associated node not found', async () => {
    const historyRead = jest.fn().mockReturnValue({
      responseHeader: {
        serviceResult: {
          isNot: jest.fn().mockReturnValue(true),
          description: 'not ok'
        }
      }
    });
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({
      historyRead,
      close: jest.fn()
    });

    south.addContent = jest.fn();
    await south.start();

    await south.historyQuery(
      [configuration.items[0], configuration.items[1]],
      testData.constants.dates.FAKE_NOW,
      testData.constants.dates.FAKE_NOW
    );

    expect(logger.error).toHaveBeenCalledWith('Error while reading history: not ok');
    expect(logger.error).toHaveBeenCalledWith('No result found in response');
  });

  it('should properly manage history query and catch read error', async () => {
    const historyRead = jest.fn().mockImplementation(() => {
      throw new Error('opcua read error');
    });
    const close = jest.fn().mockImplementationOnce(() => {
      return new Promise<void>(resolve => {
        setTimeout(() => resolve(), 1000);
      });
    });
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({ historyRead, close });
    south.addContent = jest.fn();

    await south.start();
    // In order to trigger the call to the 'close' function, there needs to be a session created,
    // because otherwise the 'close' function will not be called
    // If this is not called, the 'disconnect' function will resolve right away, without calling the 'close' function
    await south.getSession();
    south.disconnect();
    await expect(
      south.historyQuery(
        configuration.items.filter(item => item.settings.mode === 'ha'),
        testData.constants.dates.FAKE_NOW,
        testData.constants.dates.FAKE_NOW
      )
    ).rejects.toThrow('opcua read error');
    expect(south.addContent).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue({
      ...configuration,
      enabled: false
    });
    await south.start();
    await expect(
      south.historyQuery(
        configuration.items.filter(item => item.settings.mode === 'ha'),
        testData.constants.dates.FAKE_NOW,
        testData.constants.dates.FAKE_NOW
      )
    ).rejects.toThrow('opcua read error');
  });

  it('should filter HA items', () => {
    const result = south.filterHistoryItems(configuration.items);
    expect(result).toEqual(configuration.items.filter(item => item.settings.mode === 'ha'));
  });

  it('should properly query items', async () => {
    const read = jest.fn().mockReturnValue([
      {
        value: { value: 1, dataType: DataType.Float },
        sourceTimestamp: new Date(testData.constants.dates.DATE_1),
        serverTimestamp: new Date(testData.constants.dates.DATE_2),
        statusCode: StatusCodes.Good
      },
      {
        value: { value: 2, dataType: DataType.Double },
        sourceTimestamp: new Date(testData.constants.dates.DATE_1),
        serverTimestamp: new Date(testData.constants.dates.DATE_2),
        statusCode: StatusCodes.Good
      },
      {
        value: { value: 3, dataType: DataType.UInt16 },
        sourceTimestamp: new Date(testData.constants.dates.DATE_1),
        serverTimestamp: new Date(testData.constants.dates.DATE_2),
        statusCode: StatusCodes.Good
      }
    ]);
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addContent = jest.fn();

    await south.start();
    await south.lastPointQuery(configuration.items);
    const expectedItemsToRead = configuration.items.filter(item => item.settings.mode === 'da');

    expect(logger.debug).toHaveBeenCalledWith(
      `Read ${expectedItemsToRead.length} nodes ` +
        `[${expectedItemsToRead[0].settings.nodeId}...${expectedItemsToRead[expectedItemsToRead.length - 1].settings.nodeId}]`
    );
    expect(read).toHaveBeenCalledWith(
      expectedItemsToRead.map(item => ({ nodeId: item.settings.nodeId, name: item.name, settings: item.settings }))
    );
    expect(south.addContent).toHaveBeenCalledWith({
      type: 'time-values',
      content: [
        {
          pointId: expectedItemsToRead[0].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: {
            value: '1',
            quality: StatusCodes.Good.name
          }
        },
        {
          pointId: expectedItemsToRead[1].name,
          timestamp: testData.constants.dates.DATE_1,
          data: {
            value: '2',
            quality: StatusCodes.Good.name
          }
        },
        {
          pointId: expectedItemsToRead[2].name,
          timestamp: testData.constants.dates.DATE_2,
          data: {
            value: '3',
            quality: StatusCodes.Good.name
          }
        }
      ]
    });
  });

  it('should properly query items and catch read error', async () => {
    const read = jest.fn().mockImplementation(() => {
      throw new Error('opcua read error');
    });
    const close = jest.fn().mockImplementationOnce(() => {
      return new Promise<void>(resolve => {
        setTimeout(() => resolve(), 1000);
      });
    });
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({ read, close });
    south.addContent = jest.fn();

    await south.start();
    // In order to trigger the call to the 'close' function, there needs to be a session created,
    // because otherwise the 'close' function will not be called
    // If this is not called, the 'disconnect' function will resolve right away, without calling the 'close' function
    await south.getSession();
    south.disconnect();
    await expect(south.lastPointQuery(configuration.items)).rejects.toThrow('opcua read error');
    const expectedItemsToRead = configuration.items.filter(item => item.settings.mode === 'da');

    expect(read).toHaveBeenCalledWith(
      expectedItemsToRead.map(item => ({ nodeId: item.settings.nodeId, name: item.name, settings: item.settings }))
    );
    expect(south.addContent).not.toHaveBeenCalled();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue({
      ...configuration,
      enabled: false
    });
    jest.advanceTimersByTime(1000);
    await south.start();
    await expect(south.lastPointQuery(configuration.items)).rejects.toThrow('opcua read error');
  });

  it('should not query items when no DA items', async () => {
    const read = jest.fn().mockReturnValue(null);
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addContent = jest.fn();

    await south.start();
    await south.lastPointQuery([configuration.items[0], configuration.items[1], configuration.items[2]]);
    expect(south.addContent).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('should not query items if bad node id', async () => {
    const read = jest.fn().mockReturnValue(null);
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addContent = jest.fn();
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

    await south.start();
    await south.lastPointQuery([configuration.items[3], configuration.items[4], configuration.items[5]]);
    expect(south.addContent).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(3);
  });

  it('should properly query one item', async () => {
    const read = jest.fn().mockReturnValue([]);
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addContent = jest.fn();

    await south.start();
    await south.lastPointQuery([configuration.items[3]]);
    expect(logger.debug).toHaveBeenCalledWith(`Read node ${configuration.items[3].settings.nodeId}`);
    expect(read).toHaveBeenCalledWith([
      { nodeId: configuration.items[3].settings.nodeId, name: configuration.items[3].name, settings: configuration.items[3].settings }
    ]);
  });

  it('should properly query items and log error when not same number of items and values', async () => {
    const read = jest.fn().mockReturnValue([
      { value: { value: 1, dataType: DataType.Float }, sourceTimestamp: new Date(), statusCode: StatusCodes.Good },
      { value: { value: 2, dataType: DataType.Double }, serverTimestamp: new Date(), statusCode: StatusCodes.Good }
    ]);
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addContent = jest.fn();

    await south.start();
    await south.lastPointQuery(configuration.items);
    const expectedItemsToRead = configuration.items.filter(item => item.settings.mode === 'da');
    expect(logger.error).toHaveBeenCalledWith(
      `Received 2 node results, requested ${expectedItemsToRead.length} nodes. Request done in 0 ms`
    );
    expect(read).toHaveBeenCalledWith(
      expectedItemsToRead.map(item => ({ nodeId: item.settings.nodeId, name: item.name, settings: item.settings }))
    );
    expect(south.addContent).toHaveBeenCalledWith({
      type: 'time-values',
      content: [
        {
          pointId: expectedItemsToRead[0].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: {
            value: '1',
            quality: StatusCodes.Good.name
          }
        },
        {
          pointId: expectedItemsToRead[1].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: {
            value: '2',
            quality: StatusCodes.Good.name
          }
        }
      ]
    });
  });

  it('should not subscribe if not items provided', async () => {
    await south.subscribe([]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should not subscribe if getSession fails', async () => {
    south.getSession = jest.fn().mockImplementationOnce(() => {
      throw new Error('get session error');
    });
    await south.subscribe([configuration.items[0]]);
    expect(logger.error).toHaveBeenCalledWith(`Error while connecting into OPCUA server: get session error`);
  });

  it('should not subscribe if bad node id', async () => {
    const stream = new CustomStream();
    stream.terminate = jest.fn();
    (resolveNodeId as jest.Mock).mockImplementationOnce(() => {
      throw new Error('bad node id');
    });
    const monitorFn = jest.fn().mockReturnValue(stream);
    const session = { close: jest.fn(), createSubscription2: jest.fn() };
    (OPCUAClient.createSession as jest.Mock).mockReturnValue(session);
    (session.createSubscription2 as jest.Mock).mockReturnValue({ terminate: jest.fn(), monitor: monitorFn });
    south.addContent = jest.fn();

    await south.start();
    await south.subscribe([configuration.items[0]]);
    expect(session.createSubscription2).toHaveBeenCalledTimes(1);
    expect(monitorFn).not.toHaveBeenCalled();
    expect(south.addContent).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      `Error when parsing node ID ${configuration.items[0].settings.nodeId} for item ${configuration.items[0].name}: bad node id`
    );
  });

  it('should properly subscribe', async () => {
    const stream = new CustomStream();
    stream.terminate = jest.fn();
    const monitorFn = jest.fn().mockReturnValue(stream);
    const session = { close: jest.fn(), createSubscription2: jest.fn() };
    (OPCUAClient.createSession as jest.Mock).mockReturnValue(session);
    (session.createSubscription2 as jest.Mock).mockReturnValue({ terminate: jest.fn(), monitor: monitorFn });
    south.addContent = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('add content error');
      })
      .mockImplementationOnce(() => Promise.resolve());

    south['connector'].settings.maxNumberOfMessages = 1;
    await south.start();
    await south.subscribe([configuration.items[0]]);
    await south.subscribe([configuration.items[0]]);
    expect(session.createSubscription2).toHaveBeenCalledTimes(1);
    expect(monitorFn).toHaveBeenCalledTimes(1);
    stream.emit('changed', { value: { value: 1, dataType: DataType.Null }, sourceTimestamp: DateTime.now(), statusCode: StatusCodes.Good });
    expect(south.addContent).not.toHaveBeenCalled();
    stream.emit('changed', {
      value: { value: 1, dataType: DataType.Float },
      serverTimestamp: DateTime.now(),
      statusCode: StatusCodes.Good
    });
    expect(south.addContent).toHaveBeenCalledWith({
      type: 'time-values',
      content: [
        {
          pointId: configuration.items[0].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: {
            value: '1',
            quality: StatusCodes.Good.name
          }
        }
      ]
    });
    stream.emit('changed', {
      value: { value: 1, dataType: DataType.Float },
      serverTimestamp: DateTime.now(),
      statusCode: StatusCodes.Good
    });
    expect(logger.error).toHaveBeenCalledWith('Error when flushing messages: Error: add content error');
    south['connector'].settings.maxNumberOfMessages = 1000;
    stream.emit('changed', {
      value: { value: 1, dataType: DataType.Float },
      serverTimestamp: DateTime.now(),
      statusCode: StatusCodes.Good
    });
    expect(south.addContent).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(1000); // Trigger flush timeout
    await south.flushMessages(); // do not trigger since it already have been done
    expect(south.addContent).toHaveBeenCalledTimes(3);

    await south.unsubscribe([configuration.items[0]]);
    expect(stream.terminate).toHaveBeenCalledTimes(1);

    await south.unsubscribe([configuration.items[1]]);
    await south.disconnect();
  });

  it('should test DA item', async () => {
    const read = jest.fn();
    const close = jest.fn();
    const session = { read, close };
    (OPCUAClient.createSession as jest.Mock).mockReturnValue(session);

    south.getDAValues = jest.fn().mockReturnValue({
      type: 'time-values',
      content: {
        pointId: 'id',
        timestamp: 'time',
        data: {
          value: 'value',
          quality: 'quality'
        }
      }
    });

    const callback = jest.fn();
    await south.testItem(configuration.items[3], testData.south.itemTestingSettings, callback);
    expect(south.getDAValues).toHaveBeenCalledWith(
      [{ nodeId: configuration.items[3].settings.nodeId, name: configuration.items[3].name, settings: configuration.items[3].settings }],
      session
    );
  });

  it('should test DA item with wrong node id', async () => {
    const read = jest.fn();
    const close = jest.fn();
    const session = { read, close };
    (OPCUAClient.createSession as jest.Mock).mockReturnValue(session);
    (resolveNodeId as jest.Mock).mockImplementationOnce(() => {
      throw new Error('bad node id');
    });
    south.getDAValues = jest.fn();

    const callback = jest.fn();
    await expect(south.testItem(configuration.items[3], testData.south.itemTestingSettings, callback)).rejects.toThrow('bad node id');
    expect(south.getDAValues).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it('should test HA item', async () => {
    const read = jest.fn();
    const close = jest.fn();
    const session = { read, close };
    (OPCUAClient.createSession as jest.Mock).mockReturnValue(session);

    south.disconnect = jest.fn();
    south.getHAValues = jest.fn().mockReturnValue([
      {
        pointId: 'id',
        timestamp: 'time',
        data: {
          value: 'value'
        }
      }
    ]);

    const callback = jest.fn();
    await south.testItem(configuration.items[1], testData.south.itemTestingSettings, callback);

    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    expect(south.getHAValues).toHaveBeenCalledWith([configuration.items[1]], startTime, endTime, session, true);
    expect(south.disconnect).toHaveBeenCalled();
  });

  it('should test HA item and manage error', async () => {
    const read = jest.fn();
    const close = jest.fn();
    const session = { read, close };
    (OPCUAClient.createSession as jest.Mock).mockReturnValue(session);

    south.disconnect = jest.fn();
    south.getHAValues = jest.fn().mockImplementationOnce(() => {
      throw new Error('ha error');
    });

    const callback = jest.fn();
    await expect(south.testItem(configuration.items[1], testData.south.itemTestingSettings, callback)).rejects.toThrow('ha error');

    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    expect(south.getHAValues).toHaveBeenCalledWith([configuration.items[1]], startTime, endTime, session, true);
    expect(south.disconnect).toHaveBeenCalled();
  });

  it('getValueHA() in case of a test', async () => {
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
              }
            ]
          },
          statusCode: StatusCodes.Good,
          continuationPoint: false
        }
      ]
    });
    const session = { historyRead } as unknown as ClientSession;

    await south.start();
    await south.getHAValues([configuration.items[0]], testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, session, true);
    expect(historyRead).toHaveBeenCalled();
  });

  it('getValueHA() should do nothing if bad node id', async () => {
    const historyRead = jest.fn();
    (resolveNodeId as jest.Mock).mockImplementationOnce(() => {
      throw new Error('bad node id');
    });
    const session = { historyRead } as unknown as ClientSession;

    await south.start();
    await south.getHAValues([configuration.items[0]], testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, session, true);
    expect(historyRead).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      `Error when parsing node ID ${configuration.items[0].settings.nodeId} for item ${configuration.items[0].name}: bad node id`
    );
  });

  it('getValueHA() should do nothing if no data values', async () => {
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
    const session = { historyRead } as unknown as ClientSession;

    await south.start();
    await south.getHAValues([configuration.items[0]], testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, session, true);
    expect(historyRead).toHaveBeenCalled();
  });

  it('getTimestamp() should properly retrieve correct timestamp', () => {
    const dataValueWithTimestamps: DataValue = {
      sourceTimestamp: new Date(testData.constants.dates.DATE_1),
      serverTimestamp: new Date(testData.constants.dates.DATE_2)
    } as DataValue;

    const dataValueWithoutTimestamps: DataValue = {
      sourceTimestamp: null,
      serverTimestamp: null
    } as DataValue;

    expect(
      south['getTimestamp'](
        dataValueWithTimestamps,
        {
          timestampOrigin: 'point'
        } as SouthOPCUAItemSettings,
        testData.constants.dates.FAKE_NOW
      )
    ).toEqual(testData.constants.dates.DATE_1);
    expect(
      south['getTimestamp'](
        dataValueWithTimestamps,
        {
          timestampOrigin: 'server'
        } as SouthOPCUAItemSettings,
        testData.constants.dates.FAKE_NOW
      )
    ).toEqual(testData.constants.dates.DATE_2);
    expect(
      south['getTimestamp'](
        dataValueWithTimestamps,
        {
          timestampOrigin: 'oibus'
        } as SouthOPCUAItemSettings,
        testData.constants.dates.FAKE_NOW
      )
    ).toEqual(testData.constants.dates.FAKE_NOW);

    expect(
      south['getTimestamp'](
        dataValueWithoutTimestamps,
        {
          timestampOrigin: 'point'
        } as SouthOPCUAItemSettings,
        testData.constants.dates.FAKE_NOW
      )
    ).toEqual(testData.constants.dates.FAKE_NOW);
    expect(
      south['getTimestamp'](
        dataValueWithoutTimestamps,
        {
          timestampOrigin: 'server'
        } as SouthOPCUAItemSettings,
        testData.constants.dates.FAKE_NOW
      )
    ).toEqual(testData.constants.dates.FAKE_NOW);
  });
});

describe('SouthOPCUA with basic auth', () => {
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
      sharedConnection: null,
      readTimeout: 15_000,
      retryInterval: 10_000,
      connectionSettings: {
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        authentication: {
          type: 'basic',
          username: 'myUser',
          password: 'pass',
          keyFilePath: '',
          certFilePath: ''
        },
        securityMode: 'none',
        keepSessionAlive: false
      },
      flushMessageTimeout: 1000,
      maxNumberOfMessages: 1000
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
        scanModeId: 'scanModeId1'
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
        scanModeId: 'scanModeId1'
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
        scanModeId: 'scanModeId2'
      },
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Random',
          mode: 'da'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Counter',
          mode: 'da'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Triangle',
          mode: 'da'
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);
    (toOPCUASecurityPolicy as jest.Mock).mockReturnValue('none');
    (toOPCUASecurityMode as jest.Mock).mockReturnValue(1);
    (createSessionConfigs as jest.Mock).mockReturnValue({ options: opcuaOptions, userIdentity: opcuaUserIdentity });
    south = new SouthOPCUA(
      configuration,
      addContentCallback,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should properly connect to OPCUA server with basic auth', async () => {
    await south.createSession();

    expect(OPCUAClient.createSession).toHaveBeenCalledWith(configuration.settings.connectionSettings!.url, opcuaUserIdentity, opcuaOptions);
  });
});

describe('SouthOPCUA with certificate', () => {
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
      sharedConnection: null,
      readTimeout: 15_000,
      retryInterval: 10_000,
      connectionSettings: {
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        authentication: {
          type: 'cert',
          certFilePath: 'myCertPath',
          keyFilePath: 'myKeyPath',
          username: '',
          password: ''
        },
        securityMode: 'sign',
        securityPolicy: 'none',
        keepSessionAlive: false
      },
      flushMessageTimeout: 1000,
      maxNumberOfMessages: 1000
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
        scanModeId: 'scanModeId1'
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
        scanModeId: 'scanModeId1'
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
        scanModeId: 'scanModeId2'
      },
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Random',
          mode: 'da'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Counter',
          mode: 'da'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Triangle',
          mode: 'da'
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);
    (toOPCUASecurityPolicy as jest.Mock).mockReturnValue('none');
    (toOPCUASecurityMode as jest.Mock).mockReturnValue(1);
    (createSessionConfigs as jest.Mock).mockReturnValue({ options: opcuaOptions, userIdentity: opcuaUserIdentity });

    south = new SouthOPCUA(
      configuration,
      addContentCallback,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should properly connect to OPCUA server with basic auth', async () => {
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => Buffer.from('cert content'))
      .mockImplementationOnce(() => Buffer.from('key content'));
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    await south.createSession();

    expect(OPCUAClient.createSession).toHaveBeenCalledWith(configuration.settings.connectionSettings!.url, opcuaUserIdentity, opcuaOptions);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should get resampling value', () => {
    expect(south.getResamplingValue('second')).toBe(1000);
    expect(south.getResamplingValue('10Seconds')).toBe(10 * 1000);
    expect(south.getResamplingValue('30Seconds')).toBe(30 * 1000);
    expect(south.getResamplingValue('minute')).toBe(60 * 1000);
    expect(south.getResamplingValue('hour')).toBe(3600 * 1000);
    expect(south.getResamplingValue('day')).toBe(24 * 3600 * 1000);
    expect(south.getResamplingValue('none')).toBe(undefined);
  });

  it('should get historyReadRequest', () => {
    const nodes: Array<HistoryReadValueIdOptions> = [
      { continuationPoint: undefined, dataEncoding: undefined, indexRange: undefined, nodeId: 'ns=3;i=1001' }
    ];
    expect(south.getHistoryReadRequest(testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, 'raw', 'none', nodes)).toEqual(
      new HistoryReadRequest({
        historyReadDetails: new ReadRawModifiedDetails({
          startTime: new Date(testData.constants.dates.FAKE_NOW),
          endTime: new Date(testData.constants.dates.FAKE_NOW),
          isReadModified: false,
          returnBounds: false
        }),
        nodesToRead: nodes,
        releaseContinuationPoints: false,
        timestampsToReturn: TimestampsToReturn.Both
      })
    );

    expect(
      south.getHistoryReadRequest(testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, 'average', 'none', nodes)
    ).toEqual(
      new HistoryReadRequest({
        historyReadDetails: new ReadProcessedDetails({
          startTime: new Date(testData.constants.dates.FAKE_NOW),
          endTime: new Date(testData.constants.dates.FAKE_NOW),
          aggregateType: Array(nodes.length).fill(AggregateFunction.Average)
        }),
        nodesToRead: nodes,
        releaseContinuationPoints: false,
        timestampsToReturn: TimestampsToReturn.Both
      })
    );

    expect(
      south.getHistoryReadRequest(testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, 'minimum', 'none', nodes)
    ).toEqual(
      new HistoryReadRequest({
        historyReadDetails: new ReadProcessedDetails({
          startTime: new Date(testData.constants.dates.FAKE_NOW),
          endTime: new Date(testData.constants.dates.FAKE_NOW),
          aggregateType: Array(nodes.length).fill(AggregateFunction.Minimum)
        }),
        nodesToRead: nodes,
        releaseContinuationPoints: false,
        timestampsToReturn: TimestampsToReturn.Both
      })
    );

    expect(
      south.getHistoryReadRequest(testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, 'maximum', 'none', nodes)
    ).toEqual(
      new HistoryReadRequest({
        historyReadDetails: new ReadProcessedDetails({
          startTime: new Date(testData.constants.dates.FAKE_NOW),
          endTime: new Date(testData.constants.dates.FAKE_NOW),
          aggregateType: Array(nodes.length).fill(AggregateFunction.Maximum)
        }),
        nodesToRead: nodes,
        releaseContinuationPoints: false,
        timestampsToReturn: TimestampsToReturn.Both
      })
    );

    expect(
      south.getHistoryReadRequest(testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, 'count', 'none', nodes)
    ).toEqual(
      new HistoryReadRequest({
        historyReadDetails: new ReadProcessedDetails({
          startTime: new Date(testData.constants.dates.FAKE_NOW),
          endTime: new Date(testData.constants.dates.FAKE_NOW),
          aggregateType: Array(nodes.length).fill(AggregateFunction.Count)
        }),
        nodesToRead: nodes,
        releaseContinuationPoints: false,
        timestampsToReturn: TimestampsToReturn.Both
      })
    );
  });
});

describe('SouthOPCUA test connection', () => {
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
      sharedConnection: null,
      readTimeout: 15_000,
      retryInterval: 10_000,
      connectionSettings: {
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        authentication: {
          type: 'none'
        },
        securityMode: 'sign-and-encrypt',
        securityPolicy: 'none',
        keepSessionAlive: false
      },
      flushMessageTimeout: 1000,
      maxNumberOfMessages: 1000
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
        scanModeId: 'scanModeId1'
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
        scanModeId: 'scanModeId1'
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
        scanModeId: 'scanModeId2'
      },
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Random',
          mode: 'da'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Counter',
          mode: 'da'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Triangle',
          mode: 'da'
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };

  // Mock UUID
  const uuid = 'test-uuid';
  (randomUUID as jest.Mock).mockReturnValue(uuid);

  class FileError extends Error {
    public code: string;
    public path: string;

    constructor(message: string, code = '', path = '') {
      super();
      this.name = 'FileError';
      this.message = message;
      this.code = code;
      this.path = path;
    }
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthOPCUA(
      configuration,
      addContentCallback,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('Connection settings are correct', async () => {
    const close = jest.fn();
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({ close });

    await expect(south.testConnection()).resolves.not.toThrow();

    expect(close).toHaveBeenCalled();
  });

  it('Certificate file does not exist', async () => {
    configuration.settings.connectionSettings!.authentication = {
      type: 'cert',
      certFilePath: 'myCertPath',
      keyFilePath: 'myKeyPath',
      username: '',
      password: ''
    };
    const error = new FileError('Wrong file', 'ENOENT', './foo/bar');
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => Buffer.from('cert content'))
      .mockImplementationOnce(() => Buffer.from('key content'));
    (OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Wrong file`));
  });

  it('Failed to read private key', async () => {
    configuration.settings.connectionSettings!.authentication = {
      type: 'cert',
      certFilePath: 'myCertPath',
      keyFilePath: 'myKeyPath',
      username: '',
      password: ''
    };
    const error = new Error('Failed to read private key');
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => Buffer.from('cert content'))
      .mockImplementationOnce(() => Buffer.from('key content'));
    (OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Failed to read private key`));
  });

  it('Unknown error', async () => {
    configuration.settings.connectionSettings!.authentication = {
      type: 'none',
      certFilePath: '',
      keyFilePath: '',
      username: '',
      password: ''
    };

    const error = new Error('Unknown error');
    (OPCUAClient.createSession as jest.Mock).mockImplementation(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Unknown error'));
  });

  it('getSharedConnectionSettings should retrieve shared connection settings', () => {
    expect(south.getSharedConnectionSettings()).toEqual({
      connectorType: undefined,
      connectorId: undefined
    });
  });
});

describe('SouthOPCUA with shared connection', () => {
  let south: SouthOPCUA;
  const configuration: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'opcua',
    description: 'my test connector',
    enabled: true,
    settings: {
      sharedConnection: {
        connectorId: 'nordId',
        connectorType: 'north'
      },
      throttling: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      readTimeout: 15000,
      flushMessageTimeout: 1000,
      maxNumberOfMessages: 1000,
      retryInterval: 10000
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
        scanModeId: 'scanModeId1'
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
        scanModeId: 'scanModeId1'
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
        scanModeId: 'scanModeId2'
      },
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Random',
          mode: 'da'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Counter',
          mode: 'da'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Triangle',
          mode: 'da'
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime();

    south = new SouthOPCUA(
      configuration,
      addContentCallback,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should getSession from shared connection', async () => {
    const client = {};
    (connectionService.getConnection as jest.Mock).mockReturnValueOnce(client);
    expect(await south.getSession()).toBe(client);
    expect(connectionService.getConnection).toHaveBeenCalledWith(
      configuration.settings.sharedConnection!.connectorType,
      configuration.settings.sharedConnection!.connectorId
    );
  });

  it('should getSession from shared connection and throw error if not found', async () => {
    (connectionService.getConnection as jest.Mock).mockReturnValueOnce(null);
    await expect(south.getSession()).rejects.toThrow(new Error('Could not connect client'));
    expect(connectionService.getConnection).toHaveBeenCalledWith(
      configuration.settings.sharedConnection!.connectorType,
      configuration.settings.sharedConnection!.connectorId
    );
  });

  it('getSharedConnectionSettings should retrieve shared connection settings', () => {
    expect(south.getSharedConnectionSettings()).toEqual({
      connectorType: configuration.settings.sharedConnection!.connectorType,
      connectorId: configuration.settings.sharedConnection!.connectorId
    });
  });

  it('should properly disconnect with reconnectTimeout', async () => {
    south['reconnectTimeout'] = setTimeout(() => null);
    south['client'] = {} as ClientSession;
    (connectionService.isConnectionUsed as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(connectionService.closeSession).toHaveBeenCalledWith(
      configuration.settings.sharedConnection!.connectorType,
      configuration.settings.sharedConnection!.connectorId,
      configuration.id,
      false
    );
    expect(connectionService.isConnectionUsed).toHaveBeenCalledWith('south', configuration.id, configuration.id);
    expect(south['client']).toBeNull();

    south['client'] = {} as ClientSession;
    await south.disconnect(new Error('error'));
    expect(connectionService.closeSession).toHaveBeenCalledWith(
      configuration.settings.sharedConnection!.connectorType,
      configuration.settings.sharedConnection!.connectorId,
      configuration.id,
      true
    );
  });
});
