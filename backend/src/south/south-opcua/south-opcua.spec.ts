import nodeOPCUAClient, {
  AggregateFunction,
  DataType,
  HistoryReadRequest,
  ReadProcessedDetails,
  ReadRawModifiedDetails,
  StatusCodes,
  TimestampsToReturn
} from 'node-opcua-client';

import fs from 'node:fs/promises';
import SouthOPCUA, { MAX_NUMBER_OF_NODE_TO_LOG } from './south-opcua';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { randomUUID } from 'crypto';
import path from 'node:path';
import { SouthOPCUAItemSettings, SouthOPCUASettings } from '../../../../shared/model/south-settings.model';
import { HistoryReadValueIdOptions } from 'node-opcua-types/source/_generated_opcua_types';
import Stream from 'node:stream';
import { createFolder } from '../../service/utils';
import ConnectionService from '../../service/connection.service';
import { ClientSession } from 'node-opcua-client/source/client_session';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import testData from '../../tests/utils/test-data';
import { SouthConnectorEntity } from '../../model/south-connector.model';

class CustomStream extends Stream {
  constructor() {
    super();
  }

  terminate() {
    return;
  }
}

// Mock node-opcua-client
jest.mock('node-opcua-client', () => ({
  OPCUAClient: { createSession: jest.fn(() => ({})) },
  ClientSubscription: { create: jest.fn() },
  ClientMonitoredItem: { create: jest.fn() },
  MessageSecurityMode: { None: 1 },
  DataType: jest.requireActual('node-opcua-client').DataType,
  StatusCodes: jest.requireActual('node-opcua-client').StatusCodes,
  SecurityPolicy: jest.requireActual('node-opcua-client').SecurityPolicy,
  AttributeIds: jest.requireActual('node-opcua-client').AttributeIds,
  UserTokenType: jest.requireActual('node-opcua-client').UserTokenType,
  TimestampsToReturn: jest.requireActual('node-opcua-client').TimestampsToReturn,
  AggregateFunction: jest.requireActual('node-opcua-client').AggregateFunction,
  ReadRawModifiedDetails: jest.fn(() => ({})),
  HistoryReadRequest: jest.requireActual('node-opcua-client').HistoryReadRequest,
  ReadProcessedDetails: jest.fn(() => ({}))
}));
jest.mock('node-opcua-certificate-manager', () => ({ OPCUACertificateManager: jest.fn(() => ({})) }));
// Mock only the randomUUID function because other functions are used by OPCUA
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn()
}));
jest.mock('node:fs/promises');
jest.mock('../../service/utils');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
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

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

describe('SouthOPCUA', () => {
  let south: SouthOPCUA;
  const configuration: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings> = {
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
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 15000,
      authentication: {
        type: 'none',
        password: null,
        keyFilePath: null
      },
      securityMode: 'None',
      securityPolicy: 'None',
      keepSessionAlive: false
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Random',
          mode: 'HA',
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
          mode: 'HA',
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
          mode: 'HA',
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
          mode: 'DA'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Counter',
          mode: 'DA'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Triangle',
          mode: 'DA'
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    const connectionService = new ConnectionService(logger);
    south = new SouthOPCUA(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder',
      connectionService
    );
  });

  it('should be properly initialized', async () => {
    south.initOpcuaCertificateFolders = jest.fn();
    south.connect = jest.fn();
    south.createSession = jest.fn();
    await south.start();
    await south.start();
    expect(south.initOpcuaCertificateFolders).toHaveBeenCalledTimes(2);
    // createSession should not be called right after starting, because
    // it will be eventually called when the first session is needed
    expect(south.createSession).not.toHaveBeenCalled();
    expect(south.connect).toHaveBeenCalledTimes(2);
  });

  it('should properly connect and disconnect to OPCUA server without password', async () => {
    south.disconnect = jest.fn();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const expectedOptions = {
      applicationName: 'OIBus',
      clientName: 'southId',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1
      },
      securityMode: nodeOPCUAClient.MessageSecurityMode.None,
      securityPolicy: 'None',
      endpointMustExist: false,
      keepSessionAlive: false,
      keepPendingSessionsOnDisconnect: false,
      requestedSessionTimeout: 15000,
      clientCertificateManager: { state: 2 }
    };
    const expectedUserIdentity = { type: 0 };

    await south.start();

    // retrieving a session to trigger the creation of a session
    await south.connection.getSession();
    expect(nodeOPCUAClient.OPCUAClient.createSession).toHaveBeenCalledWith(
      configuration.settings.url,
      expectedUserIdentity,
      expectedOptions
    );
    expect(logger.info).toHaveBeenCalledWith(`OPCUA ${configuration.name} connected`);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly manage connection error', async () => {
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connection error');
    });

    await south.start();

    try {
      await south.connection.getSession();
    } catch {
      expect(logger.error).toHaveBeenCalledWith(`Error while connecting to the OPCUA server. ${new Error('connection error')}`);
      await south.disconnect();
    }
  });

  it('should properly manage history query', async () => {
    const performMessageTransaction = jest
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
                  statusCode: {
                    value: StatusCodes.Good,
                    description: 'ok'
                  }
                },
                {
                  serverTimestamp: new Date(testData.constants.dates.FAKE_NOW),
                  value: {
                    value: [0, 456],
                    dataType: DataType.UInt64
                  },
                  statusCode: {
                    value: StatusCodes.Good,
                    description: 'ok'
                  }
                },
                {
                  serverTimestamp: new Date('2023-12-12T00:00:00.000Z'),
                  value: {
                    value: [0, 789],
                    dataType: DataType.Int64
                  },
                  statusCode: {
                    value: StatusCodes.Good,
                    description: 'ok'
                  }
                },
                {
                  serverTimestamp: new Date('2023-12-12T00:00:00.000Z'),
                  value: {
                    value: [0x0a],
                    dataType: DataType.ByteString
                  },
                  statusCode: {
                    value: StatusCodes.Good,
                    description: 'ok'
                  }
                },
                {
                  serverTimestamp: new Date('2023-12-12T00:00:00.000Z'),
                  value: {
                    value: new Date('2023-12-12T00:00:00.000Z'),
                    dataType: DataType.DateTime
                  },
                  statusCode: {
                    value: StatusCodes.Good,
                    description: 'ok'
                  }
                },
                {
                  serverTimestamp: new Date('2023-12-12T00:00:00.000Z'),
                  value: {
                    value: null,
                    dataType: DataType.Null
                  },
                  statusCode: {
                    value: StatusCodes.Good,
                    description: 'ok'
                  }
                }
              ]
            },
            statusCode: { value: StatusCodes.Good, description: 'ok' },
            continuationPoint: false
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
                  statusCode: {
                    value: StatusCodes.Good,
                    description: 'ok'
                  }
                },
                {
                  sourceTimestamp: new Date(testData.constants.dates.FAKE_NOW),
                  value: {
                    value: false,
                    dataType: DataType.Boolean
                  },
                  statusCode: {
                    value: StatusCodes.Bad,
                    description: 'not ok'
                  }
                }
              ]
            },
            statusCode: { value: StatusCodes.Bad, description: 'not ok' },
            continuationPoint: true
          },
          {
            statusCode: { value: StatusCodes.Bad, description: 'not ok' },
            continuationPoint: false
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
            statusCode: { value: StatusCodes.Good, description: 'ok' },
            continuationPoint: false
          }
        ]
      });
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({
      performMessageTransaction,
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
          data: { value: '123', quality: JSON.stringify({ value: StatusCodes.Good, description: 'ok' }) },
          pointId: configuration.items[0].name,
          timestamp: testData.constants.dates.FAKE_NOW
        },
        {
          data: { value: '456', quality: JSON.stringify({ value: StatusCodes.Good, description: 'ok' }) },
          pointId: configuration.items[0].name,
          timestamp: testData.constants.dates.FAKE_NOW
        },
        {
          data: { value: '789', quality: JSON.stringify({ value: StatusCodes.Good, description: 'ok' }) },
          pointId: configuration.items[0].name,
          timestamp: '2023-12-12T00:00:00.000Z'
        },
        {
          data: { value: '10', quality: JSON.stringify({ value: StatusCodes.Good, description: 'ok' }) },
          pointId: configuration.items[0].name,
          timestamp: '2023-12-12T00:00:00.000Z'
        },
        {
          data: {
            value: '2023-12-12T00:00:00.000Z',
            quality: JSON.stringify({ value: StatusCodes.Good, description: 'ok' })
          },
          pointId: configuration.items[0].name,
          timestamp: '2023-12-12T00:00:00.000Z'
        },
        {
          data: { value: '1', quality: JSON.stringify({ value: StatusCodes.Good, description: 'ok' }) },
          pointId: configuration.items[1].name,
          timestamp: testData.constants.dates.FAKE_NOW
        },
        {
          data: { value: '0', quality: JSON.stringify({ value: StatusCodes.Bad, description: 'not ok' }) },
          pointId: configuration.items[1].name,
          timestamp: testData.constants.dates.FAKE_NOW
        }
      ]
    });
  });

  it('should properly manage history query with status not good', async () => {
    const performMessageTransaction = jest.fn().mockReturnValue({
      responseHeader: {
        serviceResult: {
          isNot: jest.fn().mockReturnValue(true),
          description: 'not ok'
        }
      }
    });
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({
      performMessageTransaction,
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
        statusCode: { value: StatusCodes.Bad, description: 'not ok' },
        continuationPoint: false
      });
    }
    const performMessageTransaction = jest.fn().mockReturnValue({
      responseHeader: {
        serviceResult: {
          isNot: jest.fn().mockReturnValue(true),
          description: 'ok'
        }
      },
      results
    });
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({
      performMessageTransaction,
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
      `not ok with status code ${StatusCodes.Bad}: [${configuration.items[0].name}..${configuration.items[0].name}]`
    );
  });

  it('should properly manage history query with associated node not found', async () => {
    const performMessageTransaction = jest.fn().mockReturnValue({
      responseHeader: {
        serviceResult: {
          isNot: jest.fn().mockReturnValue(true),
          description: 'not ok'
        }
      }
    });
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({
      performMessageTransaction,
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
    const performMessageTransaction = jest.fn().mockImplementation(() => {
      throw new Error('opcua read error');
    });
    const close = jest.fn().mockImplementationOnce(() => {
      return new Promise<void>(resolve => {
        setTimeout(() => resolve(), 1000);
      });
    });
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ performMessageTransaction, close });
    south.addContent = jest.fn();

    await south.start();
    // In order to trigger the call to the 'close' function, there needs to be a session created,
    // because otherwise the 'close' function will not be called
    // If this is not called, the 'disconnect' function will resolve right away, without calling the 'close' function
    await south.connection.getSession();
    south.disconnect();
    await expect(
      south.historyQuery(
        configuration.items.filter(item => item.settings.mode === 'HA'),
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
        configuration.items.filter(item => item.settings.mode === 'HA'),
        testData.constants.dates.FAKE_NOW,
        testData.constants.dates.FAKE_NOW
      )
    ).rejects.toThrow('opcua read error');

    await south.connect();
  });

  it('should filter HA items', () => {
    const result = south.filterHistoryItems(configuration.items);
    expect(result).toEqual(configuration.items.filter(item => item.settings.mode === 'HA'));
  });

  it('should not query items if session is not set', async () => {
    south.addContent = jest.fn();
    await south.historyQuery(configuration.items, testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW);
    expect(south.addContent).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('OPCUA session not set. The connector cannot read values');
  });

  it('should properly query items', async () => {
    const read = jest.fn().mockReturnValue([
      { value: { value: 1, dataType: DataType.Float }, statusCode: { value: 0 } },
      { value: { value: 2, dataType: DataType.Double }, statusCode: { value: 0 } },
      { value: { value: 3, dataType: DataType.UInt16 }, statusCode: { value: 0 } }
    ]);
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addContent = jest.fn();

    await south.start();
    await south.lastPointQuery(configuration.items);
    const expectedItemsToRead = configuration.items.filter(item => item.settings.mode === 'DA');

    expect(logger.debug).toHaveBeenCalledWith(
      `Read ${expectedItemsToRead.length} nodes ` +
        `[${expectedItemsToRead[0].settings.nodeId}...${expectedItemsToRead[expectedItemsToRead.length - 1].settings.nodeId}]`
    );
    expect(read).toHaveBeenCalledWith(expectedItemsToRead.map(item => ({ nodeId: item.settings.nodeId })));
    expect(south.addContent).toHaveBeenCalledWith({
      type: 'time-values',
      content: [
        {
          pointId: expectedItemsToRead[0].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: {
            value: '1',
            quality: JSON.stringify({ value: 0 })
          }
        },
        {
          pointId: expectedItemsToRead[1].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: {
            value: '2',
            quality: JSON.stringify({ value: 0 })
          }
        },
        {
          pointId: expectedItemsToRead[2].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: {
            value: '3',
            quality: JSON.stringify({ value: 0 })
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
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ read, close });
    south.addContent = jest.fn();

    await south.start();
    // In order to trigger the call to the 'close' function, there needs to be a session created,
    // because otherwise the 'close' function will not be called
    // If this is not called, the 'disconnect' function will resolve right away, without calling the 'close' function
    await south.connection.getSession();
    south.disconnect();
    await expect(south.lastPointQuery(configuration.items)).rejects.toThrow('opcua read error');
    const expectedItemsToRead = configuration.items.filter(item => item.settings.mode === 'DA');

    expect(read).toHaveBeenCalledWith(expectedItemsToRead.map(item => ({ nodeId: item.settings.nodeId })));
    expect(south.addContent).not.toHaveBeenCalled();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue({
      ...configuration,
      enabled: false
    });
    jest.advanceTimersByTime(1000);
    await south.start();
    await expect(south.lastPointQuery(configuration.items)).rejects.toThrow('opcua read error');

    await south.connect();
    await south.connect();
  });

  it('should not query items when no DA items', async () => {
    const read = jest.fn().mockReturnValue(null);
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addContent = jest.fn();

    await south.start();
    await south.lastPointQuery([configuration.items[0], configuration.items[1], configuration.items[2]]);
    expect(south.addContent).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('should properly query one item', async () => {
    const read = jest.fn().mockReturnValue([]);
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addContent = jest.fn();

    await south.start();
    await south.lastPointQuery([configuration.items[3]]);
    expect(logger.debug).toHaveBeenCalledWith(`Read node ${configuration.items[3].settings.nodeId}`);
    expect(read).toHaveBeenCalledWith([{ nodeId: configuration.items[3].settings.nodeId }]);
  });

  it('should properly query items and log error when not same number of items and values', async () => {
    const read = jest.fn().mockReturnValue([
      { value: { value: 1, dataType: DataType.Float }, statusCode: { value: 0 } },
      { value: { value: 2, dataType: DataType.Double }, statusCode: { value: 0 } }
    ]);
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addContent = jest.fn();

    await south.start();
    await south.lastPointQuery(configuration.items);
    const expectedItemsToRead = configuration.items.filter(item => item.settings.mode === 'DA');
    expect(logger.error).toHaveBeenCalledWith(
      `Received 2 node results, requested ${expectedItemsToRead.length} nodes. Request done in 0 ms`
    );
    expect(read).toHaveBeenCalledWith(expectedItemsToRead.map(item => ({ nodeId: item.settings.nodeId })));
    expect(south.addContent).toHaveBeenCalledWith({
      type: 'time-values',
      content: [
        {
          pointId: expectedItemsToRead[0].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: {
            value: '1',
            quality: JSON.stringify({ value: 0 })
          }
        },
        {
          pointId: expectedItemsToRead[1].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: {
            value: '2',
            quality: JSON.stringify({ value: 0 })
          }
        }
      ]
    });
  });

  it('should not query items if session is not set', async () => {
    south.addContent = jest.fn();
    await south.lastPointQuery(configuration.items);
    expect(south.addContent).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('OPCUA session not set. The connector cannot read values');
  });

  it('should not subscribe if not items provided', async () => {
    await south.subscribe([]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should not subscribe if session is not set', async () => {
    await south.subscribe(configuration.items);
    expect(logger.error).toHaveBeenCalledWith('OPCUA client could not subscribe to items: session not set');
  });

  it('should properly subscribe', async () => {
    const stream = new CustomStream();
    stream.terminate = jest.fn();
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ close: jest.fn() });
    (nodeOPCUAClient.ClientSubscription.create as jest.Mock).mockReturnValue({ terminate: jest.fn() });
    (nodeOPCUAClient.ClientMonitoredItem.create as jest.Mock).mockReturnValue(stream);
    south.addContent = jest.fn();

    await south.start();
    await south.subscribe([configuration.items[0]]);
    expect(nodeOPCUAClient.ClientSubscription.create).toHaveBeenCalledTimes(1);
    expect(nodeOPCUAClient.ClientMonitoredItem.create).toHaveBeenCalledTimes(1);
    stream.emit('changed', { value: { value: 1, dataType: DataType.Null }, statusCode: { value: 0 } });
    expect(south.addContent).not.toHaveBeenCalled();
    stream.emit('changed', { value: { value: 1, dataType: DataType.Float }, statusCode: { value: 0 } });
    expect(south.addContent).toHaveBeenCalledWith({
      type: 'time-values',
      content: [
        {
          pointId: configuration.items[0].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: {
            value: '1',
            quality: JSON.stringify({ value: 0 })
          }
        }
      ]
    });

    await south.unsubscribe([configuration.items[0]]);
    expect(stream.terminate).toHaveBeenCalledTimes(1);

    await south.unsubscribe([configuration.items[1]]);
    await south.disconnect();
  });

  it('should copy certificates', async () => {
    jest.spyOn(fs, 'stat').mockImplementation(() => {
      throw new Error('does not exist');
    });
    jest.spyOn(path, 'join').mockImplementationOnce(() => 'stubFolder');
    fs.copyFile = jest.fn();

    await south.initOpcuaCertificateFolders('certFolder');
    expect(createFolder).toHaveBeenCalledTimes(10);
  });

  it('should test DA item', async () => {
    const read = jest.fn();
    const close = jest.fn();
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ read, close });

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
    await south.testItem(configuration.items[3], callback);
    expect(south.getDAValues).toHaveBeenCalled();
  });

  it('should test HA item', async () => {
    const read = jest.fn();
    const close = jest.fn();
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ read, close });

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
    await south.testItem(configuration.items[1], callback);

    expect(south.getHAValues).toHaveBeenCalled();
    expect(south.disconnect).toHaveBeenCalled();
  });

  it('should test HA item and manage error', async () => {
    const read = jest.fn();
    const close = jest.fn();
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ read, close });

    south.disconnect = jest.fn();
    south.getHAValues = jest.fn().mockImplementationOnce(() => {
      throw new Error('ha error');
    });

    const callback = jest.fn();
    await expect(south.testItem(configuration.items[1], callback)).rejects.toThrow('ha error');

    expect(south.getHAValues).toHaveBeenCalled();
    expect(south.disconnect).toHaveBeenCalled();
  });

  it('getValueHA() in case of a test', async () => {
    const performMessageTransaction = jest.fn().mockReturnValue({
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
                statusCode: {
                  value: StatusCodes.Good,
                  description: 'ok'
                }
              }
            ]
          },
          statusCode: { value: StatusCodes.Good, description: 'ok' },
          continuationPoint: false
        }
      ]
    });
    const session = { performMessageTransaction } as unknown as ClientSession;

    await south.start();
    await south.getHAValues([configuration.items[0]], testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, session, true);
    expect(performMessageTransaction).toHaveBeenCalled();
  });
});

describe('SouthOPCUA with basic auth', () => {
  let south: SouthOPCUA;
  const configuration: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings> = {
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
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 15000,
      authentication: {
        type: 'basic',
        username: 'myUser',
        password: 'pass',
        keyFilePath: '',
        certFilePath: ''
      },
      securityMode: 'None',
      securityPolicy: null,
      keepSessionAlive: false
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Random',
          mode: 'HA',
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
          mode: 'HA',
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
          mode: 'HA',
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
          mode: 'DA'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Counter',
          mode: 'DA'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Triangle',
          mode: 'DA'
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    const connectionService = new ConnectionService(logger);
    south = new SouthOPCUA(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder',
      connectionService
    );
  });

  it('should properly connect to OPCUA server with basic auth', async () => {
    const expectedOptions = {
      applicationName: 'OIBus',
      clientName: 'southId',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1
      },
      securityMode: nodeOPCUAClient.MessageSecurityMode.None,
      securityPolicy: undefined,
      endpointMustExist: false,
      keepSessionAlive: false,
      keepPendingSessionsOnDisconnect: false,
      requestedSessionTimeout: 15000,
      clientCertificateManager: null
    };
    const expectedUserIdentity = {
      type: 1,
      userName: configuration.settings.authentication.username,
      password: configuration.settings.authentication.password
    };

    await south.createSession();

    expect(nodeOPCUAClient.OPCUAClient.createSession).toHaveBeenCalledWith(
      configuration.settings.url,
      expectedUserIdentity,
      expectedOptions
    );
    expect(logger.info).toHaveBeenCalledWith(`OPCUA ${configuration.name} connected`);
  });
});

describe('SouthOPCUA with certificate', () => {
  let south: SouthOPCUA;
  const configuration: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings> = {
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
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 15000,
      authentication: {
        type: 'cert',
        certFilePath: 'myCertPath',
        keyFilePath: 'myKeyPath',
        username: '',
        password: ''
      },
      securityMode: 'None',
      securityPolicy: 'None',
      keepSessionAlive: false
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Random',
          mode: 'HA',
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
          mode: 'HA',
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
          mode: 'HA',
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
          mode: 'DA'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Counter',
          mode: 'DA'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Triangle',
          mode: 'DA'
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    const connectionService = new ConnectionService(logger);
    south = new SouthOPCUA(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder',
      connectionService
    );
  });

  it('should properly connect to OPCUA server with basic auth', async () => {
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => Buffer.from('cert content'))
      .mockImplementationOnce(() => Buffer.from('key content'));
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const expectedOptions = {
      applicationName: 'OIBus',
      clientName: 'southId',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1
      },
      securityMode: nodeOPCUAClient.MessageSecurityMode.None,
      securityPolicy: 'None',
      endpointMustExist: false,
      keepSessionAlive: false,
      requestedSessionTimeout: 15000,
      keepPendingSessionsOnDisconnect: false,
      clientCertificateManager: null
    };
    const expectedUserIdentity = {
      type: 2,
      certificateData: Buffer.from('cert content'),
      privateKey: Buffer.from('key content').toString('utf8')
    };

    await south.createSession();

    expect(nodeOPCUAClient.OPCUAClient.createSession).toHaveBeenCalledWith(
      configuration.settings.url,
      expectedUserIdentity,
      expectedOptions
    );
    expect(logger.info).toHaveBeenCalledWith(`OPCUA ${configuration.name} connected`);
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
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 15000,
      authentication: {
        type: 'none',
        password: null,
        keyFilePath: null
      },
      securityMode: 'None',
      securityPolicy: 'None',
      keepSessionAlive: false
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Random',
          mode: 'HA',
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
          mode: 'HA',
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
          mode: 'HA',
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
          mode: 'DA'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Counter',
          mode: 'DA'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Triangle',
          mode: 'DA'
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

  const securityPolicies: Array<SouthOPCUASettings['securityPolicy']> = [
    'None',
    'Basic128',
    'Basic192',
    'Basic256',
    'Basic128Rsa15',
    'Basic192Rsa15',
    'Basic256Rsa15',
    'Basic256Sha256',
    'Aes128_Sha256_RsaOaep',
    'PubSub_Aes128_CTR',
    'PubSub_Aes256_CTR'
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    const connectionService = new ConnectionService(logger);
    south = new SouthOPCUA(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder',
      connectionService
    );
  });

  it('Connection settings are correct', async () => {
    const close = jest.fn();
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ close });

    await expect(south.testConnection()).resolves.not.toThrow();

    expect(close).toHaveBeenCalled();
  });

  it('Wrong URL', async () => {
    const error = new Error('BadTcpEndpointUrlInvalid');
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check the URL'));
  });

  it.each(securityPolicies)('Server does not support Security policy: %s', async securityPolicy => {
    configuration.settings.securityPolicy = securityPolicy;
    const error = new Error(`Cannot find an Endpoint matching  security mode: ${securityPolicy}`);

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Security Policy "${securityPolicy}" is not supported on the server`));
  });

  it.each(securityPolicies.slice(1))('Server did not trust certificate using Security policy: %s', async securityPolicy => {
    configuration.settings.securityPolicy = securityPolicy;
    const error = new Error('The connection may have been rejected by server');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check if the OIBus certificate has been trusted by the server'));
  });

  it('Wrong user credentials', async () => {
    configuration.settings.authentication.type = 'basic';
    const error = new Error('BadIdentityTokenRejected');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check username and password'));
  });

  it('Wrong certificate', async () => {
    configuration.settings.authentication = {
      type: 'cert',
      certFilePath: 'myCertPath',
      keyFilePath: 'myKeyPath',
      username: '',
      password: ''
    };
    const error = new Error('BadIdentityTokenRejected');

    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => Buffer.from('cert content'))
      .mockImplementationOnce(() => Buffer.from('key content'));
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check the certificate and key'));
  });

  it('Certificate file does not exist', async () => {
    configuration.settings.authentication = {
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
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Wrong file`));
  });

  it('Failed to read private key', async () => {
    configuration.settings.authentication = {
      type: 'cert',
      certFilePath: 'myCertPath',
      keyFilePath: 'myKeyPath',
      username: '',
      password: ''
    };
    const error = new Error('Failed to read private key');
    const keyPath = path.resolve(configuration.settings.authentication.keyFilePath!);
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => Buffer.from('cert content'))
      .mockImplementationOnce(() => Buffer.from('key content'));
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Could not read private key "${keyPath}"`));
  });

  it('Unknown error', async () => {
    configuration.settings.authentication = {
      type: 'none',
      certFilePath: '',
      keyFilePath: '',
      username: '',
      password: ''
    };

    const error = new Error('Unknown error');
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementation(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Unknown error'));
  });
});

describe('SouthOPCUA with shared connection', () => {
  let south: SouthOPCUA;
  const configuration: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings> = {
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
    sharedConnection: true,
    settings: {
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 15000,
      authentication: {
        type: 'none',
        password: null,
        keyFilePath: null
      },
      securityMode: 'None',
      securityPolicy: 'None',
      keepSessionAlive: false
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Random',
          mode: 'HA',
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
          mode: 'HA',
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
          mode: 'HA',
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
          mode: 'DA'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Counter',
          mode: 'DA'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          nodeId: 'ns=3;s=Triangle',
          mode: 'DA'
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime();

    const connectionService = new ConnectionService(logger);
    south = new SouthOPCUA(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder',
      connectionService
    );
  });

  it('should initialize connectionSettings', () => {
    // Initially sharedConnection is true
    expect(south.connectionSettings).toEqual({
      closeFnName: 'close',
      sharedConnection: true
    });
  });

  it('should properly name the connection', async () => {
    const createSessionConfigsSpy = jest.spyOn(south, 'createSessionConfigs');

    await south.createSession();

    expect(createSessionConfigsSpy).toHaveBeenCalledWith(
      configuration.settings,
      south['clientCertificateManager'],
      encryptionService,
      'Shared session'
    );
  });
});
