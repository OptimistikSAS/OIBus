import { describe, it, before, beforeEach, afterEach, mock, type Mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import Stream from 'node:stream';
import testData from '../../tests/utils/test-data';
import {mockModule, reloadModule} from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import nodeOPCUAMock from '../../tests/__mocks__/node-opcua.mock';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { SouthOPCUAItemSettings, SouthOPCUASettings, SouthItemSettings } from '../../../shared/model/south-settings.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type SouthOPCUAClass from './south-opcua';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import {
  DataType,
  StatusCodes,
  SecurityPolicy,
  AttributeIds,
  UserTokenType,
  TimestampsToReturn,
  AggregateFunction,
  HistoryReadRequest,
  ClientSession,
  ClientSubscription,
  ClientMonitoredItem,
  NodeId
} from 'node-opcua';
import { DateTime } from 'luxon';

const nodeRequire = createRequire(import.meta.url);

class CustomStream extends Stream {
  constructor() {
    super();
  }

  terminate() {
    return;
  }
}

describe('SouthOPCUA', () => {
  let SouthOPCUA: typeof SouthOPCUAClass;
  let south: SouthOPCUAClass;

  const logger = new PinoLogger();
  const addContentCallback: Mock<(southId: string, data: OIBusContent, queryTime: string, items: SouthConnectorItemEntity<SouthItemSettings>[]) => Promise<void>> = mock.fn(async (_southId: string, _data: OIBusContent, _queryTime: string, _items: SouthConnectorItemEntity<SouthItemSettings>[]) => undefined);
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

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

  const utilsOpcuaExports = {
    createSessionConfigs: mock.fn(() => ({ options: opcuaOptions, userIdentity: opcuaUserIdentity })),
    getHistoryReadRequest: mock.fn(() => ({ requestHeader: {} }) as unknown as HistoryReadRequest),
    getTimestamp: mock.fn(() => testData.constants.dates.FAKE_NOW),
    initOPCUACertificateFolders: mock.fn(async () => undefined),
    logMessages: mock.fn(),
    parseOPCUAValue: mock.fn((): string | null => null),
    toOPCUASecurityMode: mock.fn(() => 1),
    toOPCUASecurityPolicy: mock.fn(() => 'none')
  };

  const utilsExports = {
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => ({ intervals: [], numberOfIntervalsDone: 0 })),
    groupItemsByGroup: mock.fn((_type: unknown, items: Array<unknown>) => [items]),
    validateCronExpression: mock.fn(() => ({ expression: '' })),
    checkAge: mock.fn(() => true),
    compress: mock.fn(async () => undefined),
    convertDateTimeToInstant: mock.fn((v: unknown) => v),
    convertDelimiter: mock.fn((v: unknown) => v),
    formatInstant: mock.fn((v: unknown) => v),
    generateCsvContent: mock.fn(() => ''),
    generateFilenameForSerialization: mock.fn(() => 'filename.csv'),
    generateReplacementParameters: mock.fn(() => []),
    logQuery: mock.fn(),
    persistResults: mock.fn(async () => undefined)
  };

  const cryptoExports = { ...nodeRequire('crypto'), randomUUID: mock.fn(() => 'randomUUID') };

  const opcuaModuleExports = {
    __esModule: true,
    ...nodeOPCUAMock,
    DataType,
    StatusCodes,
    SecurityPolicy,
    AttributeIds,
    UserTokenType,
    TimestampsToReturn,
    AggregateFunction,
    HistoryReadRequest
  };

  const configuration: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'opcua',
    description: 'my test connector',
    enabled: true,
    settings: {
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
    groups: [],
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
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
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
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
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
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
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
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
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
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
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
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

  before(() => {
    mockModule(nodeRequire, 'node-opcua', opcuaModuleExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/utils-opcua', utilsOpcuaExports);
    mockModule(nodeRequire, 'crypto', cryptoExports);
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    SouthOPCUA = reloadModule<{ default: typeof SouthOPCUAClass }>(nodeRequire, './south-opcua').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    addContentCallback.mock.resetCalls();
    for (const fn of [logger.trace, logger.debug, logger.info, logger.warn, logger.error]) {
      (fn as ReturnType<typeof mock.fn>).mock.resetCalls();
    }
    utilsOpcuaExports.createSessionConfigs.mock.resetCalls();
    utilsOpcuaExports.getHistoryReadRequest.mock.resetCalls();
    utilsOpcuaExports.getTimestamp.mock.resetCalls();
    utilsOpcuaExports.initOPCUACertificateFolders.mock.resetCalls();
    utilsOpcuaExports.logMessages.mock.resetCalls();
    utilsOpcuaExports.parseOPCUAValue.mock.resetCalls();
    utilsOpcuaExports.toOPCUASecurityMode.mock.resetCalls();
    utilsOpcuaExports.toOPCUASecurityPolicy.mock.resetCalls();
    cryptoExports.randomUUID.mock.resetCalls();
    nodeOPCUAMock.resolveNodeId.mock.resetCalls();
    // Reset the mock implementations to defaults
    utilsOpcuaExports.createSessionConfigs.mock.mockImplementation(() => ({ options: opcuaOptions, userIdentity: opcuaUserIdentity }));
    utilsOpcuaExports.getHistoryReadRequest.mock.mockImplementation(() => ({ requestHeader: {} }) as unknown as HistoryReadRequest);
    utilsOpcuaExports.getTimestamp.mock.mockImplementation(() => testData.constants.dates.FAKE_NOW);
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation(() => null);
    cryptoExports.randomUUID.mock.mockImplementation(() => 'randomUUID');
    nodeOPCUAMock.resolveNodeId.mock.mockImplementation((nodeId: unknown) => nodeId);

    mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthOPCUA(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should be properly initialized', async () => {
    const connectMock = mock.fn(async () => undefined);
    const createSessionMock = mock.fn(async (): Promise<ClientSession> => ({} as ClientSession));
    south.connect = connectMock;
    south.createSession = createSessionMock;
    await south.start();
    await south.start();
    assert.strictEqual(utilsOpcuaExports.initOPCUACertificateFolders.mock.calls.length, 2);
    assert.deepStrictEqual(utilsOpcuaExports.initOPCUACertificateFolders.mock.calls[0].arguments, ['cacheFolder']);
    assert.deepStrictEqual(utilsOpcuaExports.initOPCUACertificateFolders.mock.calls[1].arguments, ['cacheFolder']);
    // createSession should not be called right after starting, because
    // it will be eventually called when the first session is needed
    assert.strictEqual(createSessionMock.mock.calls.length, 0);
    assert.strictEqual(connectMock.mock.calls.length, 2);
  });

  it('should properly connect', async () => {
    const createSessionMock = mock.fn(async () => ({}) as unknown as ClientSession);
    const disconnectMock = mock.fn(async () => undefined);
    south.createSession = createSessionMock;
    south.disconnect = disconnectMock;
    south['reconnectTimeout'] = setTimeout(() => null);
    south['flushTimeout'] = setTimeout(() => null);
    await south.connect();
    assert.strictEqual(createSessionMock.mock.calls.length, 1);
    assert.strictEqual(disconnectMock.mock.calls.length, 0);
  });

  it('should not reconnect if disconnecting', async () => {
    south.createSession = mock.fn(() => {
      throw new Error('get session error');
    });
    const disconnectMock = mock.fn(async () => undefined);
    south.disconnect = disconnectMock;
    south['disconnecting'] = true;
    await south.connect();
    assert.strictEqual(
      (logger.error as ReturnType<typeof mock.fn>).mock.calls.filter(
        c => c.arguments[0] === 'Error while connecting to the OPCUA server: get session error'
      ).length,
      1
    );
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should properly reconnect if not disconnecting', async () => {
    south.createSession = mock.fn(() => {
      throw new Error('get session error');
    });
    const disconnectMock = mock.fn(async () => undefined);
    south.disconnect = disconnectMock;
    south['disconnecting'] = false;
    await south.connect();
    assert.strictEqual(
      (logger.error as ReturnType<typeof mock.fn>).mock.calls.filter(
        c => c.arguments[0] === 'Error while connecting to the OPCUA server: get session error'
      ).length,
      1
    );
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    // setTimeout should have been called for reconnect
  });

  it('should properly disconnect', async () => {
    await south.disconnect();

    south['flushTimeout'] = setTimeout(() => null);
    south['reconnectTimeout'] = setTimeout(() => null);
    const terminate = mock.fn(async () => undefined);
    const close = mock.fn(async () => undefined);
    south['subscription'] = { terminate } as unknown as ClientSubscription;
    south['client'] = { close } as unknown as ClientSession;

    await south.disconnect();
    assert.strictEqual(terminate.mock.calls.length, 1);
    assert.strictEqual(close.mock.calls.length, 1);
  });

  it('should properly test connection', async () => {
    const mockedClient = {
      close: mock.fn(async () => undefined),
      read: mock.fn(async () => [
        { statusCode: { value: 0 }, value: { value: 0 } }, // State = Running
        { statusCode: { value: 0 }, value: { value: 'Prosys OPC' } }, // ManufacturerName
        { statusCode: { value: 0 }, value: { value: 'OPC UA Server' } }, // ProductName
        { statusCode: { value: 0 }, value: { value: '1.2.3' } }, // SoftwareVersion
        { statusCode: { value: 0 }, value: { value: '1234' } } // BuildNumber
      ])
    };
    const createSessionMock = mock.fn(async () => mockedClient as unknown as ClientSession);
    south.createSession = createSessionMock;
    const fsMock = mock.method(fs, 'rm', async () => undefined);
    const testResult = await south.testConnection();
    assert.deepStrictEqual(utilsOpcuaExports.initOPCUACertificateFolders.mock.calls[0].arguments, ['opcua-test-randomUUID']);
    assert.strictEqual(createSessionMock.mock.calls.length, 1);
    assert.strictEqual(mockedClient.read.mock.calls.length, 1);
    assert.strictEqual(mockedClient.close.mock.calls.length, 1);
    assert.deepStrictEqual(fsMock.mock.calls[0].arguments, [path.resolve('opcua-test-randomUUID'), { recursive: true, force: true }]);
    assert.strictEqual(testResult.items.length, 5);
    assert.deepStrictEqual(testResult.items[0], { key: 'State', value: 'Running' });
    fsMock.mock.restore();
  });

  it('should properly test connection with graceful degradation when session.read throws', async () => {
    const mockedClient = {
      close: mock.fn(async () => undefined),
      read: mock.fn(async () => {
        throw new Error('Read not supported');
      })
    };
    const createSessionMock = mock.fn(async () => mockedClient as unknown as ClientSession);
    south.createSession = createSessionMock;
    const fsMock = mock.method(fs, 'rm', async () => undefined);
    const testResult = await south.testConnection();
    assert.strictEqual(createSessionMock.mock.calls.length, 1);
    assert.strictEqual(mockedClient.read.mock.calls.length, 1);
    assert.strictEqual(mockedClient.close.mock.calls.length, 1);
    assert.deepStrictEqual(testResult, { items: [] });
    fsMock.mock.restore();
  });

  it('should skip data values with bad status codes or null values', async () => {
    const mockedClient = {
      close: mock.fn(async () => undefined),
      read: mock.fn(async () => [
        { statusCode: { value: 0 }, value: { value: 0 } }, // State Good — included (Running)
        { statusCode: { value: 0 }, value: { value: 'Prosys OPC' } }, // ManufacturerName Good — included
        { statusCode: { value: 0x80350000 }, value: { value: 'bad' } }, // ProductName Bad status — skipped
        { statusCode: { value: 0 }, value: { value: null } }, // SoftwareVersion null value — skipped
        { statusCode: { value: 0 }, value: { value: '1234' } } // BuildNumber Good — included
      ])
    };
    south.createSession = mock.fn(async () => mockedClient as unknown as ClientSession);
    const fsMock = mock.method(fs, 'rm', async () => undefined);
    const testResult = await south.testConnection();
    assert.strictEqual(testResult.items.length, 3);
    assert.deepStrictEqual(testResult.items[0], { key: 'State', value: 'Running' });
    assert.deepStrictEqual(testResult.items[1], { key: 'ManufacturerName', value: 'Prosys OPC' });
    assert.deepStrictEqual(testResult.items[2], { key: 'BuildNumber', value: '1234' });
    fsMock.mock.restore();
  });

  it('should fall back to numeric string for unknown state values', async () => {
    const mockedClient = {
      close: mock.fn(async () => undefined),
      read: mock.fn(async () => [
        { statusCode: { value: 0 }, value: { value: 99 } }, // State = unknown value not in labels
        { statusCode: { value: 0 }, value: { value: 'Prosys OPC' } },
        { statusCode: { value: 0 }, value: { value: 'OPC UA Server' } },
        { statusCode: { value: 0 }, value: { value: '1.2.3' } },
        { statusCode: { value: 0 }, value: { value: '1234' } }
      ])
    };
    south.createSession = mock.fn(async () => mockedClient as unknown as ClientSession);
    const fsMock = mock.method(fs, 'rm', async () => undefined);
    const testResult = await south.testConnection();
    assert.deepStrictEqual(testResult.items[0], { key: 'State', value: '99' });
    fsMock.mock.restore();
  });

  it('should properly throw error if test fails', async () => {
    const createSessionMock = mock.fn(() => {
      throw new Error('get session error');
    });
    south.createSession = createSessionMock;
    const fsMock = mock.method(fs, 'rm', async () => undefined);
    await assert.rejects(async () => south.testConnection(), /get session error/);
    assert.deepStrictEqual(utilsOpcuaExports.initOPCUACertificateFolders.mock.calls[0].arguments, ['opcua-test-randomUUID']);
    assert.deepStrictEqual(fsMock.mock.calls[0].arguments, [path.resolve('opcua-test-randomUUID'), { recursive: true, force: true }]);
    assert.strictEqual(createSessionMock.mock.calls.length, 1);
    fsMock.mock.restore();
  });

  it('should properly test ha item', async () => {
    const mockedClient = { close: mock.fn(async () => undefined) };
    const createSessionMock = mock.fn(async () => mockedClient as unknown as ClientSession);
    const getDAValuesMock = mock.fn(async () => []);
    const getHAValuesMock = mock.fn(async () => ({ value: [], trackedInstant: null }));
    south.createSession = createSessionMock;
    south.getDAValues = getDAValuesMock;
    south.getHAValues = getHAValuesMock;
    const fsMock = mock.method(fs, 'rm', async () => undefined);

    await south.testItem(configuration.items[0], {
      history: {
        startTime: testData.constants.dates.DATE_1,
        endTime: testData.constants.dates.DATE_2
      }
    });
    assert.deepStrictEqual(getHAValuesMock.mock.calls[0].arguments, [
      [configuration.items[0]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      mockedClient,
      true
    ]);
    assert.strictEqual(nodeOPCUAMock.resolveNodeId.mock.calls.length, 0);
    assert.strictEqual(getDAValuesMock.mock.calls.length, 0);
    assert.deepStrictEqual(utilsOpcuaExports.initOPCUACertificateFolders.mock.calls[0].arguments, ['opcua-test-randomUUID']);
    assert.strictEqual(createSessionMock.mock.calls.length, 1);
    assert.strictEqual(mockedClient.close.mock.calls.length, 1);
    assert.deepStrictEqual(fsMock.mock.calls[0].arguments, [path.resolve('opcua-test-randomUUID'), { recursive: true, force: true }]);
    fsMock.mock.restore();
  });

  it('should properly test da item', async () => {
    const mockedClient = { close: mock.fn(async () => undefined) };
    const createSessionMock = mock.fn(async () => mockedClient as unknown as ClientSession);
    south.createSession = createSessionMock;
    south.getDAValues = mock.fn(async () => []);
    south.getHAValues = mock.fn(async () => ({ value: [], trackedInstant: null }));
    const fsMock = mock.method(fs, 'rm', async () => undefined);

    await south.testItem(configuration.items[3], { history: undefined });
    assert.deepStrictEqual(utilsOpcuaExports.initOPCUACertificateFolders.mock.calls[0].arguments, ['opcua-test-randomUUID']);
    assert.deepStrictEqual(nodeOPCUAMock.resolveNodeId.mock.calls[0].arguments, [configuration.items[0].settings.nodeId]);
    assert.strictEqual(createSessionMock.mock.calls.length, 1);
    assert.strictEqual(mockedClient.close.mock.calls.length, 1);
    assert.deepStrictEqual(fsMock.mock.calls[0].arguments, [path.resolve('opcua-test-randomUUID'), { recursive: true, force: true }]);
    fsMock.mock.restore();
  });

  it('should properly throw error if test item fails', async () => {
    const createSessionMock = mock.fn(() => {
      throw new Error('get session error');
    });
    const getDAValuesMock = mock.fn(async () => []);
    const getHAValuesMock = mock.fn(async () => ({ value: [], trackedInstant: null }));
    south.createSession = createSessionMock;
    south.getDAValues = getDAValuesMock;
    south.getHAValues = getHAValuesMock;
    const fsMock = mock.method(fs, 'rm', async () => undefined);

    await assert.rejects(async () => south.testItem(configuration.items[3], { history: undefined }), /get session error/);
    assert.deepStrictEqual(utilsOpcuaExports.initOPCUACertificateFolders.mock.calls[0].arguments, ['opcua-test-randomUUID']);
    assert.deepStrictEqual(fsMock.mock.calls[0].arguments, [path.resolve('opcua-test-randomUUID'), { recursive: true, force: true }]);
    assert.strictEqual(createSessionMock.mock.calls.length, 1);
    assert.strictEqual(getDAValuesMock.mock.calls.length, 0);
    assert.strictEqual(getHAValuesMock.mock.calls.length, 0);
    fsMock.mock.restore();
  });

  it('should properly manage history query', async () => {
    const getHAValuesMock = mock.fn(async () => ({ value: [], trackedInstant: null }));
    south.getHAValues = getHAValuesMock;
    south['client'] = {} as unknown as ClientSession;
    await south.historyQuery(
      [configuration.items[0], configuration.items[1], configuration.items[2]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2
    );

    assert.deepStrictEqual(getHAValuesMock.mock.calls[0].arguments, [
      [configuration.items[0], configuration.items[1], configuration.items[2]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      south['client']
    ]);
  });

  it('should properly manage history query and manage error', async () => {
    south.getHAValues = mock.fn(() => {
      throw new Error('history error');
    });
    south['client'] = {} as unknown as ClientSession;
    const disconnectMock = mock.fn(async () => undefined);
    south.disconnect = disconnectMock;
    await assert.rejects(
      async () =>
        south.historyQuery(
          [configuration.items[0], configuration.items[1], configuration.items[2]],
          testData.constants.dates.DATE_1,
          testData.constants.dates.DATE_2
        ),
      /history error/
    );
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    // setTimeout should have been called for reconnect (timer mocked)
  });

  it('should properly manage history query and manage error and not reconnect if disconnecting', async () => {
    south.getHAValues = mock.fn(() => {
      throw new Error('history error');
    });
    south['client'] = {} as unknown as ClientSession;
    const disconnectMock = mock.fn(async () => undefined);
    south.disconnect = disconnectMock;
    south['disconnecting'] = true;
    await assert.rejects(
      async () =>
        south.historyQuery(
          [configuration.items[0], configuration.items[1], configuration.items[2]],
          testData.constants.dates.DATE_1,
          testData.constants.dates.DATE_2
        ),
      /history error/
    );
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should throw error when querying history with client not set', async () => {
    const getHAValuesMock = mock.fn(async () => ({ value: [], trackedInstant: null }));
    south.getHAValues = getHAValuesMock;

    await assert.rejects(
      async () =>
        south.historyQuery(
          [configuration.items[0], configuration.items[1], configuration.items[2]],
          testData.constants.dates.DATE_1,
          testData.constants.dates.DATE_2
        ),
      /OPCUA client not set/
    );

    assert.strictEqual(getHAValuesMock.mock.calls.length, 0);
  });

  it('should properly get HA values with response status not good', async () => {
    const historyReadRequest = { requestHeader: {} } as unknown as HistoryReadRequest;
    utilsOpcuaExports.getHistoryReadRequest.mock.mockImplementation(() => historyReadRequest);

    const historyRead = mock.fn(() => ({
      responseHeader: {
        serviceResult: {
          isNot: mock.fn(() => true),
          description: 'not ok'
        }
      }
    }));
    const mockedClient = {
      historyRead,
      close: mock.fn()
    } as unknown as ClientSession;

    south.addContent = mock.fn(async () => undefined);
    // Only throw on the first resolveNodeId call; subsequent calls resolve normally
    let resolveCallCount18 = 0;
    nodeOPCUAMock.resolveNodeId.mock.mockImplementation((nodeId: unknown) => {
      resolveCallCount18++;
      if (resolveCallCount18 === 1) {
        throw new Error('node id error');
      }
      return nodeId;
    });

    await south.getHAValues(
      [configuration.items[0], configuration.items[0], configuration.items[1]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      mockedClient
    );

    assert.deepStrictEqual(utilsOpcuaExports.getHistoryReadRequest.mock.calls[0].arguments, [
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      'raw',
      'none',
      [
        { continuationPoint: undefined, dataEncoding: undefined, indexRange: undefined, nodeId: configuration.items[0].settings.nodeId },
        { continuationPoint: undefined, dataEncoding: undefined, indexRange: undefined, nodeId: configuration.items[1].settings.nodeId }
      ]
    ]);
    assert.ok(historyRead.mock.calls.length >= 1);
    assert.deepStrictEqual(historyReadRequest.requestHeader.timeoutHint, configuration.settings.readTimeout);
    assert.strictEqual(
      (logger.error as ReturnType<typeof mock.fn>).mock.calls.filter(
        c =>
          c.arguments[0] ===
          `Error when parsing node ID ${configuration.items[0].settings.nodeId} for item ${configuration.items[0].name}: node id error`
      ).length,
      1
    );
    assert.strictEqual(
      (logger.error as ReturnType<typeof mock.fn>).mock.calls.filter(c => c.arguments[0] === 'Error while reading history: not ok').length,
      1
    );
    assert.strictEqual(
      (logger.error as ReturnType<typeof mock.fn>).mock.calls.filter(c => c.arguments[0] === 'No result found in response').length,
      1
    );
  });

  it('should properly retrieve HA values with associated node not found', async () => {
    const historyReadRequest = { requestHeader: {} } as unknown as HistoryReadRequest;
    utilsOpcuaExports.getHistoryReadRequest.mock.mockImplementation(() => historyReadRequest);

    const historyRead = mock.fn(() => ({
      responseHeader: {
        serviceResult: {
          isNot: mock.fn(() => true),
          description: 'not ok'
        }
      }
    }));
    const mockedClient = {
      historyRead,
      close: mock.fn()
    } as unknown as ClientSession;
    south.addContent = mock.fn(async () => undefined);

    await south.getHAValues(
      [configuration.items[0], configuration.items[1]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      mockedClient
    );

    assert.deepStrictEqual(utilsOpcuaExports.getHistoryReadRequest.mock.calls[0].arguments, [
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      'raw',
      'none',
      [
        { continuationPoint: undefined, dataEncoding: undefined, indexRange: undefined, nodeId: configuration.items[0].settings.nodeId },
        { continuationPoint: undefined, dataEncoding: undefined, indexRange: undefined, nodeId: configuration.items[1].settings.nodeId }
      ]
    ]);
    assert.ok(historyRead.mock.calls.length >= 1);
    assert.deepStrictEqual(historyReadRequest.requestHeader.timeoutHint, configuration.settings.readTimeout);
    assert.strictEqual(
      (logger.error as ReturnType<typeof mock.fn>).mock.calls.filter(c => c.arguments[0] === 'Error while reading history: not ok').length,
      1
    );
    assert.strictEqual(
      (logger.error as ReturnType<typeof mock.fn>).mock.calls.filter(c => c.arguments[0] === 'No result found in response').length,
      1
    );
  });

  it('getHAValues() in case of a test', async () => {
    const historyReadRequest = { requestHeader: {} } as unknown as HistoryReadRequest;
    utilsOpcuaExports.getHistoryReadRequest.mock.mockImplementation(() => historyReadRequest);

    const historyRead = mock.fn(() => ({
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
            ],
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: ''
          },
          statusCode: StatusCodes.Good,
          continuationPoint: false
        }
      ]
    }));
    const client = { historyRead } as unknown as ClientSession;

    let parseCallCount = 0;
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation((): string | null => {
      parseCallCount++;
      return parseCallCount === 1 ? '' : '123';
    });
    const result = await south.getHAValues(
      [configuration.items[0]],
      testData.constants.dates.FAKE_NOW,
      testData.constants.dates.FAKE_NOW,
      client,
      true
    );
    assert.ok(historyRead.mock.calls.length >= 1);
    assert.deepStrictEqual(result, {
      value: [
        {
          data: { quality: 'Good', value: '123' },
          pointId: 'item1',
          timestamp: testData.constants.dates.FAKE_NOW
        }
      ],
      trackedInstant: '2021-01-02T00:00:00.000Z'
    });
  });

  it('getHAValues() in case of run time', async () => {
    const historyReadRequest = { requestHeader: {} } as unknown as HistoryReadRequest;
    utilsOpcuaExports.getHistoryReadRequest.mock.mockImplementation(() => historyReadRequest);

    let historyReadCallCount = 0;
    const historyRead = mock.fn(() => {
      historyReadCallCount++;
      if (historyReadCallCount === 1) {
        return {
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
                ],
                createdBy: '',
                updatedBy: '',
                createdAt: '',
                updatedAt: ''
              },
              statusCode: StatusCodes.Good,
              continuationPoint: true
            }
          ]
        };
      }
      return {
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
              ],
              createdBy: '',
              updatedBy: '',
              createdAt: '',
              updatedAt: ''
            },
            statusCode: StatusCodes.Good,
            continuationPoint: false
          }
        ]
      };
    });
    const client = { historyRead } as unknown as ClientSession;

    const addContentMock = mock.fn(async () => undefined);
    south.addContent = addContentMock;
    let parseCallCount = 0;
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation((): string | null => {
      parseCallCount++;
      return parseCallCount === 1 ? '123' : '456';
    });
    await south.getHAValues([configuration.items[0]], testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, client, false);
    assert.strictEqual(historyRead.mock.calls.length, 2);
    assert.strictEqual(addContentMock.mock.calls.length, 1);
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments, [
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
      [configuration.items[0]]
    ]);
  });

  it('getHAValues() in case of a bad result status code', async () => {
    const historyReadRequest = { requestHeader: {} } as unknown as HistoryReadRequest;
    utilsOpcuaExports.getHistoryReadRequest.mock.mockImplementation(() => historyReadRequest);

    const historyRead = mock.fn(() => ({
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
    }));
    const client = { historyRead } as unknown as ClientSession;

    const result = await south.getHAValues(
      [configuration.items[0], configuration.items[1], configuration.items[2]],
      testData.constants.dates.FAKE_NOW,
      testData.constants.dates.FAKE_NOW,
      client,
      true
    );
    assert.ok(historyRead.mock.calls.length >= 1);
    assert.deepStrictEqual(result, {
      value: [],
      trackedInstant: null
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
    assert.strictEqual(utilsOpcuaExports.logMessages.mock.calls.length, 1);
    assert.deepStrictEqual(utilsOpcuaExports.logMessages.mock.calls[0].arguments[0], expectedLogs);
  });

  it('getHAValues() should do nothing if no data values', async () => {
    const historyReadRequest = { requestHeader: {} } as unknown as HistoryReadRequest;
    utilsOpcuaExports.getHistoryReadRequest.mock.mockImplementation(() => historyReadRequest);

    const historyRead = mock.fn(() => ({
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
    }));
    const client = { historyRead } as unknown as ClientSession;

    await south.getHAValues([configuration.items[0]], testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW, client, true);
    assert.ok(historyRead.mock.calls.length >= 1);
  });

  describe('filter items', () => {
    const items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>> = [
      {
        id: 'id1', // kept
        enabled: true,
        settings: {
          mode: 'ha'
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false
      },
      {
        id: 'id2', // filtered out
        enabled: true,
        settings: {
          mode: 'ha'
        },
        scanMode: { id: 'subscription' },
        group: null,
        syncWithGroup: false
      },
      {
        id: 'id3', // kept
        enabled: true,
        settings: {
          mode: 'ha'
        },
        scanMode: testData.scanMode.list[0],
        group: {
          scanMode: { id: testData.scanMode.list[0] }
        },
        syncWithGroup: true
      },
      {
        id: 'id4', // filtered out
        enabled: true,
        settings: {
          mode: 'ha'
        },
        scanMode: testData.scanMode.list[0],
        group: {
          scanMode: { id: 'subscription' }
        },
        syncWithGroup: true
      },
      {
        id: 'id5', // kept
        enabled: true,
        settings: {
          mode: 'ha'
        },
        scanMode: testData.scanMode.list[0],
        group: {
          scanMode: { id: 'subscription' }
        },
        syncWithGroup: false
      },
      {
        id: 'id6', // filtered out
        enabled: true,
        settings: {
          mode: 'ha'
        },
        scanMode: { id: 'subscription' },
        group: {
          scanMode: { id: testData.scanMode.list[0] }
        },
        syncWithGroup: false
      },
      {
        id: 'id7', // filtered out
        enabled: true,
        settings: {
          mode: 'da'
        },
        scanMode: { id: 'subscription' },
        group: {
          scanMode: { id: testData.scanMode.list[0] }
        },
        syncWithGroup: false
      },
      {
        id: 'id8', // filtered out
        enabled: true,
        settings: {
          mode: 'da'
        },
        scanMode: testData.scanMode.list[0],
        group: {
          scanMode: { id: 'subscription' }
        },
        syncWithGroup: true
      },
      {
        id: 'id9', // filtered out
        enabled: true,
        settings: {
          mode: 'da'
        },
        scanMode: testData.scanMode.list[0],
        group: {
          scanMode: { id: 'subscription' }
        },
        syncWithGroup: false
      },
      {
        id: 'id10', // filtered out
        enabled: true,
        settings: {
          mode: 'da'
        },
        scanMode: { id: 'subscription' },
        group: {
          scanMode: { id: testData.scanMode.list[0] }
        },
        syncWithGroup: false
      },
      {
        id: 'id11', // filtered out
        enabled: true,
        settings: {
          mode: 'da'
        },
        scanMode: testData.scanMode.list[0],
        group: {
          scanMode: { id: testData.scanMode.list[0] }
        },
        syncWithGroup: true
      }
    ] as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>;

    it('should filter HA items', () => {
      const result = south.filterHistoryItems(items);
      assert.deepStrictEqual(result, [
        {
          id: 'id1',
          enabled: true,
          settings: {
            mode: 'ha'
          },
          scanMode: testData.scanMode.list[0],
          group: null,
          syncWithGroup: false
        },
        {
          id: 'id3',
          enabled: true,
          settings: {
            mode: 'ha'
          },
          scanMode: testData.scanMode.list[0],
          group: {
            scanMode: { id: testData.scanMode.list[0] }
          },
          syncWithGroup: true
        },
        {
          id: 'id5',
          enabled: true,
          settings: {
            mode: 'ha'
          },
          scanMode: testData.scanMode.list[0],
          group: {
            scanMode: { id: 'subscription' }
          },
          syncWithGroup: false
        }
      ]);
    });

    it('should filter DA items', () => {
      const result = south.filterHistoryItems(items);
      assert.deepStrictEqual(result, [
        {
          id: 'id1',
          enabled: true,
          settings: {
            mode: 'ha'
          },
          scanMode: testData.scanMode.list[0],
          group: null,
          syncWithGroup: false
        },
        {
          id: 'id3',
          enabled: true,
          settings: {
            mode: 'ha'
          },
          scanMode: testData.scanMode.list[0],
          group: {
            scanMode: { id: testData.scanMode.list[0] }
          },
          syncWithGroup: true
        },
        {
          id: 'id5',
          enabled: true,
          settings: {
            mode: 'ha'
          },
          scanMode: testData.scanMode.list[0],
          group: {
            scanMode: { id: 'subscription' }
          },
          syncWithGroup: false
        }
      ]);
    });
  });

  it('should properly throw error on query last point if client not set', async () => {
    const getDAValuesMock = mock.fn(async () => []);
    south.getDAValues = getDAValuesMock;
    await assert.rejects(async () => south.directQuery(configuration.items), /OPCUA client not set/);
    assert.strictEqual(getDAValuesMock.mock.calls.length, 0);
  });

  it('should do nothing on query last point if no nodes to read', async () => {
    south['client'] = {} as unknown as ClientSession;
    const getDAValuesMock = mock.fn(async () => []);
    const addContentMock = mock.fn(async () => undefined);
    south.getDAValues = getDAValuesMock;
    south.addContent = addContentMock;
    await south.directQuery([]);
    assert.strictEqual(getDAValuesMock.mock.calls.length, 0);
    assert.strictEqual(addContentMock.mock.calls.length, 0);
  });

  it('should query last point (only one)', async () => {
    const mockedClient = {} as unknown as ClientSession;
    south['client'] = mockedClient;
    const getDAValuesMock = mock.fn(
      async () => testData.oibusContent[0].content as ReturnType<typeof south.getDAValues> extends Promise<infer T> ? T : never
    );
    const addContentMock = mock.fn(async () => undefined);
    south.getDAValues = getDAValuesMock;
    south.addContent = addContentMock;
    await south.directQuery([configuration.items[0], configuration.items[3]]);
    assert.deepStrictEqual(getDAValuesMock.mock.calls[0].arguments, [
      [{ nodeId: configuration.items[3].settings.nodeId, name: configuration.items[3].name, settings: configuration.items[3].settings }],
      mockedClient
    ]);
    assert.strictEqual(addContentMock.mock.calls.length, 1);
  });

  it('should query last point (several) and fail and reconnect', async () => {
    const mockedClient = {} as unknown as ClientSession;
    south['client'] = mockedClient;
    const getDAValuesMock = mock.fn(() => {
      throw new Error('opcua read error');
    });
    const addContentMock = mock.fn(async () => undefined);
    const disconnectMock = mock.fn(async () => undefined);
    south.getDAValues = getDAValuesMock;
    south.addContent = addContentMock;
    south.disconnect = disconnectMock;
    south.connect = mock.fn(async () => undefined);
    await assert.rejects(async () => south.directQuery([configuration.items[0], configuration.items[3]]), /opcua read error/);
    assert.deepStrictEqual(getDAValuesMock.mock.calls[0].arguments, [
      [{ nodeId: configuration.items[3].settings.nodeId, name: configuration.items[3].name, settings: configuration.items[3].settings }],
      mockedClient
    ]);
    assert.strictEqual(addContentMock.mock.calls.length, 0);
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should query last point (several) and fail and not reconnect', async () => {
    const mockedClient = {} as unknown as ClientSession;
    south['client'] = mockedClient;
    const getDAValuesMock = mock.fn(() => {
      throw new Error('opcua read error');
    });
    const addContentMock = mock.fn(async () => undefined);
    const disconnectMock = mock.fn(async () => undefined);
    const connectMock = mock.fn(async () => undefined);
    south.getDAValues = getDAValuesMock;
    south.addContent = addContentMock;
    south.disconnect = disconnectMock;
    south.connect = connectMock;
    south['disconnecting'] = true;
    await assert.rejects(async () => south.directQuery([configuration.items[0], configuration.items[3]]), /opcua read error/);
    assert.deepStrictEqual(getDAValuesMock.mock.calls[0].arguments, [
      [{ nodeId: configuration.items[3].settings.nodeId, name: configuration.items[3].name, settings: configuration.items[3].settings }],
      mockedClient
    ]);
    assert.strictEqual(addContentMock.mock.calls.length, 0);
    assert.strictEqual(connectMock.mock.calls.length, 0);
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should not query items if bad node id', async () => {
    south['client'] = {} as unknown as ClientSession;
    const getDAValuesMock = mock.fn(async () => []);
    south.getDAValues = getDAValuesMock;
    let resolveCallCount = 0;
    nodeOPCUAMock.resolveNodeId.mock.mockImplementation(() => {
      resolveCallCount++;
      if (resolveCallCount <= 3) {
        throw new Error('bad node id');
      }
      return 'nodeId';
    });

    await south.directQuery([configuration.items[3], configuration.items[4], configuration.items[5]]);
    assert.strictEqual(getDAValuesMock.mock.calls.length, 0);
    assert.strictEqual((logger.error as ReturnType<typeof mock.fn>).mock.calls.length, 3);
  });

  it('getDAValues() should properly retrieve data', async () => {
    const read = mock.fn(async () => [
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

    let parseCallCount = 0;
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation((): string | null => {
      parseCallCount++;
      return parseCallCount === 1 ? '' : '123';
    });
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
    assert.strictEqual(read.mock.calls.length, 1);
    assert.deepStrictEqual(result, [
      {
        data: { quality: 'Good', value: '123' },
        pointId: 'item2',
        timestamp: testData.constants.dates.FAKE_NOW
      }
    ]);
  });

  it('getDAValues() should properly retrieve empty data', async () => {
    const read = mock.fn(async () => []);
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
    assert.strictEqual(read.mock.calls.length, 1);
    assert.deepStrictEqual(result, []);
    assert.strictEqual(
      (logger.error as ReturnType<typeof mock.fn>).mock.calls.filter(
        c => c.arguments[0] === `Received 0 node results, requested 1 nodes. Request done in 0 ms`
      ).length,
      1
    );
  });

  it('should not subscribe if session is not set', async () => {
    await assert.rejects(async () => south.subscribe(configuration.items), /OPCUA client not set/);
  });

  it('should not subscribe if no items', async () => {
    await assert.doesNotReject(async () => south.subscribe([]));
  });

  it('should not subscribe if already subscribe', async () => {
    const stream = new CustomStream();
    stream.terminate = mock.fn();
    const monitorFn = mock.fn(() => stream);
    const createSubscription2Mock = mock.fn(async () => ({ terminate: mock.fn(), monitor: monitorFn }));
    south['client'] = {
      createSubscription2: createSubscription2Mock
    } as unknown as ClientSession;

    south['subscription'] = { terminate: mock.fn(), monitor: monitorFn } as unknown as ClientSubscription;
    await south.subscribe([configuration.items[0]]);
    assert.strictEqual(createSubscription2Mock.mock.calls.length, 0);
    assert.strictEqual(monitorFn.mock.calls.length, 1);
  });

  it('should properly manage subscriptions', async () => {
    const stream = new CustomStream();
    stream.terminate = mock.fn();
    const monitorFn = mock.fn(() => stream);
    const createSubscription2Mock = mock.fn(async () => ({ terminate: mock.fn(), monitor: monitorFn }));
    south['client'] = {
      createSubscription2: createSubscription2Mock
    } as unknown as ClientSession;

    // Only throw on the first resolveNodeId call (for items[0]); items[1] is skipped; items[2] succeeds
    let resolveCallCount36 = 0;
    nodeOPCUAMock.resolveNodeId.mock.mockImplementation((nodeId: unknown) => {
      resolveCallCount36++;
      if (resolveCallCount36 === 1) {
        throw new Error('bad node id');
      }
      return nodeId;
    });
    const addContentMock = mock.fn(async () => undefined);
    south.addContent = addContentMock;

    south['monitoredItems'].set(configuration.items[1].id, {} as unknown as ClientMonitoredItem);

    await south.subscribe([configuration.items[0], configuration.items[1], configuration.items[2]]);
    assert.strictEqual(createSubscription2Mock.mock.calls.length, 1);
    assert.strictEqual(monitorFn.mock.calls.length, 1);
    assert.strictEqual(addContentMock.mock.calls.length, 0);
    assert.strictEqual(
      (logger.error as ReturnType<typeof mock.fn>).mock.calls.filter(
        c =>
          c.arguments[0] ===
          `Error when parsing node ID ${configuration.items[0].settings.nodeId} for item ${configuration.items[0].name}: bad node id`
      ).length,
      1
    );
    assert.strictEqual(south['monitoredItems'].size, 2);

    const flushMessagesMock = mock.fn(async () => undefined);
    south.flushMessages = flushMessagesMock;
    let parseCallCount = 0;
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation((): string | null => {
      parseCallCount++;
      return parseCallCount === 1 ? '' : 'parsedValue';
    });
    south['connector'].settings.maxNumberOfMessages = 2;
    stream.emit('changed', { value: { value: 1, dataType: DataType.Null }, sourceTimestamp: DateTime.now(), statusCode: StatusCodes.Good });
    stream.emit('changed', { value: { value: 1, dataType: DataType.Null }, sourceTimestamp: DateTime.now(), statusCode: StatusCodes.Good });
    assert.strictEqual(flushMessagesMock.mock.calls.length, 0);
    stream.emit('changed', {
      value: { value: 1, dataType: DataType.Float },
      serverTimestamp: DateTime.now(),
      statusCode: StatusCodes.Good
    });
    assert.strictEqual(flushMessagesMock.mock.calls.length, 1);
    assert.deepStrictEqual(south['bufferedValues'], [
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
    const removeAllListeners = mock.fn();
    const terminate = mock.fn(async () => undefined);
    south['monitoredItems'].set(configuration.items[1].id, { removeAllListeners, terminate } as unknown as ClientMonitoredItem);

    await south.unsubscribe([configuration.items[0], configuration.items[1]]);

    assert.strictEqual(removeAllListeners.mock.calls.length, 1);
    assert.strictEqual(terminate.mock.calls.length, 1);
    assert.strictEqual(south['monitoredItems'].size, 0);
  });

  it('should not flush messages if none in buffer', async () => {
    const addContentMock = mock.fn(async () => undefined);
    south.addContent = addContentMock;
    await south.flushMessages();
    assert.strictEqual(addContentMock.mock.calls.length, 0);
    // setTimeout called for next flush
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

    const addContentMock = mock.fn(async () => undefined);
    south.addContent = addContentMock;
    await south.flushMessages();
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments, [
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
      [
        { name: 'pointId', id: 'itemId' },
        { name: 'pointId', id: 'itemId' }
      ]
    ]);
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

    south.addContent = mock.fn(async () => {
      throw new Error('cache content error');
    });
    await south.flushMessages();
    assert.strictEqual(
      (logger.error as ReturnType<typeof mock.fn>).mock.calls.filter(
        c => c.arguments[0] === 'Error when flushing messages: cache content error'
      ).length,
      1
    );
  });
});
