import nodeOPCUAClient, {
  AggregateFunction,
  HistoryReadRequest,
  ReadProcessedDetails,
  ReadRawModifiedDetails,
  StatusCodes,
  TimestampsToReturn
} from 'node-opcua-client';

import fs from 'node:fs/promises';
import SouthOPCUA, { MAX_NUMBER_OF_NODE_TO_LOG } from './south-opcua';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { randomUUID } from 'crypto';
import path from 'node:path';

import { SouthConnectorItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import {
  SouthOPCUAItemSettings,
  SouthOPCUASettings,
  SouthOPCUASettingsAuthentication
} from '../../../../shared/model/south-settings.model';
import { HistoryReadValueIdOptions } from 'node-opcua-types/source/_generated_opcua_types';
import Stream from 'node:stream';
import { createFolder } from '../../service/utils';

class CustomStream extends Stream {
  constructor() {
    super();
  }

  terminate() {}
}

// Mock node-opcua-client
jest.mock('node-opcua-client', () => ({
  OPCUAClient: { createSession: jest.fn() },
  ClientSubscription: { create: jest.fn() },
  ClientMonitoredItem: { create: jest.fn() },
  MessageSecurityMode: { None: 1 },
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

// Mock only the randomUUID function because other functions are used by OPCUA
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn()
}));

const addValues = jest.fn();
const addFile = jest.fn();

const logger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const items: Array<SouthConnectorItemDTO<SouthOPCUAItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    connectorId: 'southId',
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
    connectorId: 'southId',
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
    connectorId: 'southId',
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
    connectorId: 'southId',
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
    connectorId: 'southId',
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
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Triangle',
      mode: 'DA'
    },
    scanModeId: 'scanModeId2'
  }
];
const nowDateString = '2020-02-02T02:02:02.222Z';

let south: SouthOPCUA;

describe('SouthOPCUA', () => {
  const connector: SouthConnectorDTO<SouthOPCUASettings> = {
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
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      authentication: {
        type: 'none',
        username: null,
        password: null,
        certFilePath: null,
        keyFilePath: null
      } as unknown as SouthOPCUASettingsAuthentication,
      securityMode: 'None',
      securityPolicy: 'None',
      keepSessionAlive: false
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    south = new SouthOPCUA(connector, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should be properly initialized', async () => {
    south.connectToOpcuaServer = jest.fn();
    south.initOpcuaCertificateFolders = jest.fn();
    await south.start();
    await south.start();
    expect(south.initOpcuaCertificateFolders).toHaveBeenCalledTimes(2);
    expect(south.connectToOpcuaServer).toHaveBeenCalledTimes(2);
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
      clientCertificateManager: { state: 2 }
    };
    const expectedUserIdentity = { type: 0 };

    await south.start();

    expect(nodeOPCUAClient.OPCUAClient.createSession).toHaveBeenCalledWith(connector.settings.url, expectedUserIdentity, expectedOptions);
    expect(logger.info).toHaveBeenCalledWith(`OPCUA ${connector.name} connected`);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly manage connection error', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connection error');
    });

    await south.start();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), connector.settings.retryInterval);
    expect(logger.error).toHaveBeenCalledWith(`Error while connecting to the OPCUA server. ${new Error('connection error')}`);
    await south.disconnect();
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
                  sourceTimestamp: new Date(nowDateString),
                  value: {
                    value: 123
                  },
                  statusCode: {
                    value: StatusCodes.Good,
                    description: 'ok'
                  }
                },
                {
                  serverTimestamp: new Date(nowDateString),
                  value: {
                    value: 123
                  },
                  statusCode: {
                    value: StatusCodes.Good,
                    description: 'ok'
                  }
                },
                {
                  serverTimestamp: new Date('2023-12-12T00:00:00.000Z'),
                  value: {
                    value: 456
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
                  sourceTimestamp: new Date(nowDateString),
                  value: {
                    value: 123
                  },
                  statusCode: {
                    value: StatusCodes.Good,
                    description: 'ok'
                  }
                },
                {
                  sourceTimestamp: new Date(nowDateString),
                  value: {
                    value: 123
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

    south.addValues = jest.fn();
    await south.start();

    await south.historyQuery([items[0], items[1], items[2]], nowDateString, nowDateString);

    expect(south.addValues).toHaveBeenCalledWith([
      {
        data: { value: 123, quality: JSON.stringify({ value: StatusCodes.Good, description: 'ok' }) },
        pointId: items[0].name,
        timestamp: nowDateString
      },
      {
        data: { value: 123, quality: JSON.stringify({ value: StatusCodes.Good, description: 'ok' }) },
        pointId: items[0].name,
        timestamp: nowDateString
      },
      {
        data: { value: 456, quality: JSON.stringify({ value: StatusCodes.Good, description: 'ok' }) },
        pointId: items[0].name,
        timestamp: '2023-12-12T00:00:00.000Z'
      },
      {
        data: { value: 123, quality: JSON.stringify({ value: StatusCodes.Good, description: 'ok' }) },
        pointId: items[1].name,
        timestamp: nowDateString
      },
      {
        data: { value: 123, quality: JSON.stringify({ value: StatusCodes.Bad, description: 'not ok' }) },
        pointId: items[1].name,
        timestamp: nowDateString
      }
    ]);
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

    south.addValues = jest.fn();
    await south.start();

    await south.historyQuery([items[0], items[1]], nowDateString, nowDateString);

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

    south.addValues = jest.fn();
    await south.start();

    await south.historyQuery(
      [items[0], items[0], items[0], items[0], items[0], items[0], items[0], items[0], items[0], items[0], items[0]],
      nowDateString,
      nowDateString
    );

    expect(logger.debug).toHaveBeenCalledWith(`not ok with status code ${StatusCodes.Bad}: [${items[0].name}..${items[0].name}]`);
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

    south.addValues = jest.fn();
    await south.start();

    await south.historyQuery([items[0], items[1]], nowDateString, nowDateString);

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
    south.addValues = jest.fn();

    await south.start();
    south.disconnect();
    await expect(
      south.historyQuery(
        items.filter(item => item.settings.mode === 'HA'),
        nowDateString,
        nowDateString
      )
    ).rejects.toThrow('opcua read error');
    expect(south.addValues).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await south.start();
    await expect(
      south.historyQuery(
        items.filter(item => item.settings.mode === 'HA'),
        nowDateString,
        nowDateString
      )
    ).rejects.toThrow('opcua read error');

    await south.connect();
  });

  it('should filter HA items', () => {
    const result = south.filterHistoryItems(items);
    expect(result).toEqual(items.filter(item => item.settings.mode === 'HA'));
  });

  it('should not query items if session is not set', async () => {
    south.addValues = jest.fn();
    await south.historyQuery(items, nowDateString, nowDateString);
    expect(south.addValues).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('OPCUA session not set. The connector cannot read values');
  });

  it('should properly query items', async () => {
    const read = jest.fn().mockReturnValue([
      { value: { value: 1 }, statusCode: { value: 0 } },
      { value: { value: 2 }, statusCode: { value: 0 } },
      { value: { value: 3 }, statusCode: { value: 0 } }
    ]);
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addValues = jest.fn();

    await south.start();
    await south.lastPointQuery(items);
    const expectedItemsToRead = items.filter(item => item.settings.mode === 'DA');

    expect(logger.debug).toHaveBeenCalledWith(
      `Read ${expectedItemsToRead.length} nodes ` +
        `[${expectedItemsToRead[0].settings.nodeId}...${expectedItemsToRead[expectedItemsToRead.length - 1].settings.nodeId}]`
    );
    expect(read).toHaveBeenCalledWith(expectedItemsToRead.map(item => ({ nodeId: item.settings.nodeId })));
    expect(south.addValues).toHaveBeenCalledWith([
      {
        pointId: expectedItemsToRead[0].name,
        timestamp: nowDateString,
        data: {
          value: 1,
          quality: JSON.stringify({ value: 0 })
        }
      },
      {
        pointId: expectedItemsToRead[1].name,
        timestamp: nowDateString,
        data: {
          value: 2,
          quality: JSON.stringify({ value: 0 })
        }
      },
      {
        pointId: expectedItemsToRead[2].name,
        timestamp: nowDateString,
        data: {
          value: 3,
          quality: JSON.stringify({ value: 0 })
        }
      }
    ]);
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
    south.addValues = jest.fn();

    await south.start();
    south.disconnect();
    await expect(south.lastPointQuery(items)).rejects.toThrow('opcua read error');
    const expectedItemsToRead = items.filter(item => item.settings.mode === 'DA');

    expect(read).toHaveBeenCalledWith(expectedItemsToRead.map(item => ({ nodeId: item.settings.nodeId })));
    expect(south.addValues).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await south.start();
    await expect(south.lastPointQuery(items)).rejects.toThrow('opcua read error');

    await south.connect();
  });

  it('should not query items when no DA items', async () => {
    const read = jest.fn().mockReturnValue(null);
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addValues = jest.fn();

    await south.start();
    await south.lastPointQuery([items[0], items[1], items[2]]);
    expect(south.addValues).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('should properly query items and manage null result', async () => {
    const read = jest.fn().mockReturnValue(null);
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addValues = jest.fn();

    await south.start();
    await south.lastPointQuery([items[3]]);
    expect(logger.debug).toHaveBeenCalledWith(`Read node ${items[3].settings.nodeId}`);
    expect(logger.error).toHaveBeenCalledWith(`Could not read nodes`);
    expect(read).toHaveBeenCalledWith([{ nodeId: items[3].settings.nodeId }]);
    expect(south.addValues).not.toHaveBeenCalled();
  });

  it('should properly query items and log error when not same number of items and values', async () => {
    const read = jest.fn().mockReturnValue([
      { value: { value: 1 }, statusCode: { value: 0 } },
      { value: { value: 2 }, statusCode: { value: 0 } }
    ]);
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ read });
    south.addValues = jest.fn();

    await south.start();
    await south.lastPointQuery(items);
    const expectedItemsToRead = items.filter(item => item.settings.mode === 'DA');
    expect(logger.error).toHaveBeenCalledWith(`Received 2 node results, requested ${expectedItemsToRead.length} nodes`);
    expect(read).toHaveBeenCalledWith(expectedItemsToRead.map(item => ({ nodeId: item.settings.nodeId })));
    expect(south.addValues).toHaveBeenCalledWith([
      {
        pointId: expectedItemsToRead[0].name,
        timestamp: nowDateString,
        data: {
          value: 1,
          quality: JSON.stringify({ value: 0 })
        }
      },
      {
        pointId: expectedItemsToRead[1].name,
        timestamp: nowDateString,
        data: {
          value: 2,
          quality: JSON.stringify({ value: 0 })
        }
      }
    ]);
  });

  it('should not query items if session is not set', async () => {
    south.addValues = jest.fn();
    await south.lastPointQuery(items);
    expect(south.addValues).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('OPCUA session not set. The connector cannot read values');
  });

  it('should not subscribe if not items provided', async () => {
    await south.subscribe([]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should not subscribe if session is not set', async () => {
    await south.subscribe(items);
    expect(logger.error).toHaveBeenCalledWith('OPCUA client could not subscribe to items: session not set');
  });

  it('should properly subscribe', async () => {
    const stream = new CustomStream();
    stream.terminate = jest.fn();
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ close: jest.fn() });
    (nodeOPCUAClient.ClientSubscription.create as jest.Mock).mockReturnValue({ terminate: jest.fn() });
    (nodeOPCUAClient.ClientMonitoredItem.create as jest.Mock).mockReturnValue(stream);
    south.addValues = jest.fn();

    await south.start();
    await south.subscribe([items[0]]);
    expect(nodeOPCUAClient.ClientSubscription.create).toHaveBeenCalledTimes(1);
    expect(nodeOPCUAClient.ClientMonitoredItem.create).toHaveBeenCalledTimes(1);
    expect(south.addValues).not.toHaveBeenCalled();

    stream.emit('changed', { value: { value: 1 }, statusCode: { value: 0 } });
    expect(south.addValues).toHaveBeenCalledWith([
      {
        pointId: items[0].name,
        timestamp: nowDateString,
        data: {
          value: 1,
          quality: JSON.stringify({ value: 0 })
        }
      }
    ]);

    await south.unsubscribe([items[0]]);
    expect(stream.terminate).toHaveBeenCalledTimes(1);

    await south.unsubscribe([items[1]]);
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
});

describe('SouthOPCUA with basic auth', () => {
  const connector: SouthConnectorDTO<SouthOPCUASettings> = {
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
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      authentication: {
        type: 'basic',
        username: 'myUser',
        password: 'pass',
        keyFilePath: '',
        certFilePath: ''
      } as unknown as SouthOPCUASettingsAuthentication,
      securityMode: 'None',
      securityPolicy: null,
      keepSessionAlive: false
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    south = new SouthOPCUA(connector, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
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
      clientCertificateManager: null
    };
    const expectedUserIdentity = {
      type: 1,
      userName: connector.settings.authentication.username,
      password: connector.settings.authentication.password
    };

    await south.connectToOpcuaServer();

    expect(nodeOPCUAClient.OPCUAClient.createSession).toHaveBeenCalledWith(connector.settings.url, expectedUserIdentity, expectedOptions);
    expect(logger.info).toHaveBeenCalledWith(`OPCUA ${connector.name} connected`);
  });
});

describe('SouthOPCUA with certificate', () => {
  const connector: SouthConnectorDTO<SouthOPCUASettings> = {
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
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      authentication: {
        type: 'cert',
        certFilePath: 'myCertPath',
        keyFilePath: 'myKeyPath',
        username: '',
        password: ''
      } as unknown as SouthOPCUASettingsAuthentication,
      securityMode: 'None',
      securityPolicy: 'None',
      keepSessionAlive: false
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    south = new SouthOPCUA(connector, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
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
      keepPendingSessionsOnDisconnect: false,
      clientCertificateManager: null
    };
    const expectedUserIdentity = {
      type: 2,
      certificateData: Buffer.from('cert content'),
      privateKey: Buffer.from('key content').toString('utf8')
    };

    await south.connectToOpcuaServer();

    expect(nodeOPCUAClient.OPCUAClient.createSession).toHaveBeenCalledWith(connector.settings.url, expectedUserIdentity, expectedOptions);
    expect(logger.info).toHaveBeenCalledWith(`OPCUA ${connector.name} connected`);
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
    expect(south.getHistoryReadRequest(nowDateString, nowDateString, 'raw', 'none', nodes)).toEqual(
      new HistoryReadRequest({
        historyReadDetails: new ReadRawModifiedDetails({
          startTime: new Date(nowDateString),
          endTime: new Date(nowDateString),
          isReadModified: false,
          returnBounds: false
        }),
        nodesToRead: nodes,
        releaseContinuationPoints: false,
        timestampsToReturn: TimestampsToReturn.Both
      })
    );

    expect(south.getHistoryReadRequest(nowDateString, nowDateString, 'average', 'none', nodes)).toEqual(
      new HistoryReadRequest({
        historyReadDetails: new ReadProcessedDetails({
          startTime: new Date(nowDateString),
          endTime: new Date(nowDateString),
          aggregateType: Array(nodes.length).fill(AggregateFunction.Average)
        }),
        nodesToRead: nodes,
        releaseContinuationPoints: false,
        timestampsToReturn: TimestampsToReturn.Both
      })
    );

    expect(south.getHistoryReadRequest(nowDateString, nowDateString, 'minimum', 'none', nodes)).toEqual(
      new HistoryReadRequest({
        historyReadDetails: new ReadProcessedDetails({
          startTime: new Date(nowDateString),
          endTime: new Date(nowDateString),
          aggregateType: Array(nodes.length).fill(AggregateFunction.Minimum)
        }),
        nodesToRead: nodes,
        releaseContinuationPoints: false,
        timestampsToReturn: TimestampsToReturn.Both
      })
    );

    expect(south.getHistoryReadRequest(nowDateString, nowDateString, 'maximum', 'none', nodes)).toEqual(
      new HistoryReadRequest({
        historyReadDetails: new ReadProcessedDetails({
          startTime: new Date(nowDateString),
          endTime: new Date(nowDateString),
          aggregateType: Array(nodes.length).fill(AggregateFunction.Maximum)
        }),
        nodesToRead: nodes,
        releaseContinuationPoints: false,
        timestampsToReturn: TimestampsToReturn.Both
      })
    );

    expect(south.getHistoryReadRequest(nowDateString, nowDateString, 'count', 'none', nodes)).toEqual(
      new HistoryReadRequest({
        historyReadDetails: new ReadProcessedDetails({
          startTime: new Date(nowDateString),
          endTime: new Date(nowDateString),
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
  const connector: SouthConnectorDTO<SouthOPCUASettings> = {
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
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      authentication: {
        type: 'none',
        username: null,
        password: null,
        certFilePath: null,
        keyFilePath: null
      } as unknown as SouthOPCUASettingsAuthentication,
      securityMode: 'None',
      securityPolicy: 'None',
      keepSessionAlive: false
    }
  };

  // Mock UUID
  const uuid = 'test-uuid';
  (randomUUID as jest.Mock).mockReturnValue(uuid);
  const tempCertFolder = `opcua-test-${uuid}`;

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

  const securityPolicies: SouthOPCUASettings['securityPolicy'][] = [
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

    south = new SouthOPCUA(connector, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  afterEach(async () => {
    expect((logger.trace as jest.Mock).mock.calls).toEqual([
      [`Created OPCUA temporary folder for certificates: ${tempCertFolder}`],
      ['OPCUA temporary folder deleted']
    ]);
  });

  it('Connection settings are correct', async () => {
    const close = jest.fn();
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ close });

    await expect(south.testConnection()).resolves.not.toThrow();

    expect(close).toHaveBeenCalled();
    expect((logger.info as jest.Mock).mock.calls).toEqual([
      [`Testing connection on "${connector.settings.url}"`],
      [`OPCUA connected on "${connector.settings.url}"`]
    ]);
  });

  it('Wrong URL', async () => {
    const error = new Error('BadTcpEndpointUrlInvalid');
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check the URL'));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA server. ${error}`]]);
  });

  it.each(securityPolicies)('Server does not support Security policy: %s', async securityPolicy => {
    connector.settings.securityPolicy = securityPolicy;
    const error = new Error(`Cannot find an Endpoint matching  security mode: ${securityPolicy}`);

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Security Policy "${securityPolicy}" is not supported on the server`));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA server. ${error}`]]);
  });

  it.each(securityPolicies.slice(1))('Server did not trust certificate using Security policy: %s', async securityPolicy => {
    connector.settings.securityPolicy = securityPolicy;
    const error = new Error('The connection may have been rejected by server');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check if the OIBus certificate has been trusted by the server'));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA server. ${error}`]]);
  });

  it('Wrong user credentials', async () => {
    connector.settings.authentication.type = 'basic';
    const error = new Error('BadIdentityTokenRejected');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check username and password'));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA server. ${error}`]]);
  });

  it('Wrong certificate', async () => {
    connector.settings.authentication = {
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

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA server. ${error}`]]);
  });

  it('Certificate file does not exist', async () => {
    connector.settings.authentication = {
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

    await expect(south.testConnection()).rejects.toThrow(new Error(`File "${error.path}" does not exist`));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA server. ${error}`]]);
  });

  it('Failed to read private key', async () => {
    connector.settings.authentication = {
      type: 'cert',
      certFilePath: 'myCertPath',
      keyFilePath: 'myKeyPath',
      username: '',
      password: ''
    };
    const error = new Error('Failed to read private key');
    const keyPath = path.resolve(connector.settings.authentication.keyFilePath!);
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => Buffer.from('cert content'))
      .mockImplementationOnce(() => Buffer.from('key content'));
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Could not read private key "${keyPath}"`));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA server. ${error}`]]);
  });

  it('Unknown error', async () => {
    connector.settings.authentication = {
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

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check logs'));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA server. ${error}`]]);
  });
});
