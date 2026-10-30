import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import Stream from 'node:stream';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import { DateTime } from 'luxon';
import type { ClientMonitoredItem, ClientSession, ClientSubscription, OPCUAClientOptions } from 'node-opcua';
// The values come from the node-opcua sub-packages: loading the whole node-opcua costs ~0.7 s
import { AttributeIds, NodeClass } from 'node-opcua-data-model';
import { NodeId } from 'node-opcua-nodeid';
import { TimestampsToReturn } from 'node-opcua-service-read';
import { StatusCodes } from 'node-opcua-status-code';
import { HistoryReadRequest, MessageSecurityMode, UserTokenType } from 'node-opcua-types';
import { DataType } from 'node-opcua-variant';

import type { OIBusPointRecord } from '../../../shared/model/common/content.model';
import type { Instant } from '../../../shared/model/common/types';
import type { SouthOPCUAItemSettings, SouthOPCUASettings } from '../../../shared/model/connector/south-settings.model';
import { SouthConnectorExploreEntry } from '../../../shared/model/domain/south-connector.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, flushPromises, type Mocked, mockModule, reloadModule, seq } from '../../tests/utils/test-utils';
import manifest from './manifest';
import type SouthOPCUAClass from './south-opcua';

const nodeRequire = createRequire(import.meta.url);

class CustomStream extends Stream {
  terminate() {
    return;
  }
}

const DEVICE_ERROR_CODES = [
  'BadCommunicationError',
  'BadNoCommunication',
  'BadNotConnected',
  'BadDeviceFailure',
  'BadOutOfService',
  'BadTimeout'
];

const opcuaOptions = {
  applicationName: 'OIBus',
  clientName: 'connectorName-connectorId',
  connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
  securityMode: 1,
  securityPolicy: 'none',
  endpointMustExist: false,
  keepSessionAlive: false,
  keepPendingSessionsOnDisconnect: false,
  requestedSessionTimeout: 15000,
  clientCertificateManager: { state: 2 }
};
const opcuaUserIdentity = { type: 0 };

const haSettings = (nodeId: string): SouthOPCUAItemSettings => ({ nodeId, mode: 'ha', haMode: { aggregate: 'raw', resampling: 'none' } });

const buildItem = (
  id: string,
  name: string,
  settings: SouthOPCUAItemSettings,
  scanMode = testData.scanMode.list[0]
): SouthConnectorItemEntity<SouthOPCUAItemSettings> => ({
  id,
  name,
  description: null,
  enabled: true,
  settings,
  scanMode,
  group: null,
  syncWithGroup: false,
  maxReadInterval: 3600,
  readDelay: 0,
  startTimeOffset: 0,
  endTimeOffset: null,
  recoveryStrategy: 'oldest',
  cachingStrategy: 'allValues',
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

// Built fresh for each test: the connector keeps a reference to it and some tests mutate its settings.
const buildConfiguration = (): SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings> => ({
  id: 'southId',
  name: 'south',
  type: 'opcua',
  description: 'my test connector',
  enabled: true,
  settings: {
    url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
    connectionTimeout: 15000,
    retryInterval: 10000,
    readTimeout: 15000,
    maxParallelRun: 1,
    subscription: {
      publishingInterval: 150,
      maxKeepAliveCount: 10,
      numberOfMessageBeforeFlush: 1000,
      delayBetweenFlush: 1000
    },
    authentication: { type: 'none' },
    securityMode: 'none',
    securityPolicy: 'none',
    keepSessionAlive: false
  },
  groups: [],
  items: [
    buildItem('id1', 'item1', haSettings('ns=3;s=Random')),
    buildItem('id2', 'item2', haSettings('ns=3;s=Counter')),
    buildItem('id3', 'item3', haSettings('ns=3;s=Triangle'), testData.scanMode.list[1]),
    buildItem('id1', 'item1', { nodeId: 'ns=3;s=Random', mode: 'da', timestampOrigin: 'oibus' }),
    buildItem('id2', 'item2', { nodeId: 'ns=3;s=Counter', mode: 'da', timestampOrigin: 'point' }),
    buildItem('id3', 'item3', { nodeId: 'ns=3;s=Triangle', mode: 'da', timestampOrigin: 'server' }, testData.scanMode.list[1])
  ],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

/** The five server status values read by testConnection (State, ManufacturerName, ProductName, SoftwareVersion, BuildNumber). */
const serverStatusValues = (state = 0) => [
  { statusCode: { value: 0 }, value: { value: state } },
  { statusCode: { value: 0 }, value: { value: 'Prosys OPC' } },
  { statusCode: { value: 0 }, value: { value: 'OPC UA Server' } },
  { statusCode: { value: 0 }, value: { value: '1.2.3' } },
  { statusCode: { value: 0 }, value: { value: '1234' } }
];

const stringDataValue = (value: string, timestamp: Instant, timestampField: 'sourceTimestamp' | 'serverTimestamp' = 'sourceTimestamp') => ({
  [timestampField]: new Date(timestamp),
  value: { value, dataType: DataType.String },
  statusCode: StatusCodes.Good
});

const historyReadResponse = (dataValues: Array<unknown>, continuationPoint = false) => ({
  responseHeader: { serviceResult: StatusCodes.Good },
  results: [{ historyData: { dataValues }, statusCode: StatusCodes.Good, continuationPoint }]
});

const notOkHistoryRead = () =>
  mock.fn(() => ({ responseHeader: { serviceResult: { isNot: mock.fn(() => true), description: 'not ok' } } }));

const daNode = (item: SouthConnectorItemEntity<SouthOPCUAItemSettings>) => ({
  nodeId: NodeId.resolveNodeId(item.settings.nodeId),
  name: item.name,
  settings: item.settings
});

const goodTimeValue = (pointId: string, value: unknown): OIBusPointRecord => ({
  pointId,
  timestamp: testData.constants.dates.FAKE_NOW,
  value: value as string,
  quality: 'Good'
});

/** What SouthCacheRepository.getItemsLastValues returns for items cached at DATE_1 with the given values. */
const lastValues = (...entries: Array<[itemId: string, value: unknown]>) =>
  new Map(entries.map(([itemId, value]) => [itemId, { value, trackedInstant: testData.constants.dates.DATE_1 }]));

/** A one-level address space of `variableCount` Variables (`ns=1;s=V<i>`), each with an EngineeringUnits
 *  and an EURange property, answering every read with a description/unit/range and counting requests. */
function mockAddressSpace(variableCount: number) {
  const variableIds = Array.from({ length: variableCount }, (_, i) => `ns=1;s=V${i}`);
  const browse = mock.fn(async (arg: unknown) => {
    if (typeof arg === 'string') {
      return {
        references: variableIds.map(nodeId => ({
          nodeId,
          displayName: { text: nodeId },
          browseName: { toString: () => nodeId },
          nodeClass: NodeClass.Variable
        })),
        continuationPoint: null
      };
    }
    return (arg as Array<string>).map(nodeId => ({
      references: [
        { nodeId: `${nodeId}.EU`, browseName: { name: 'EngineeringUnits' }, nodeClass: NodeClass.Variable },
        { nodeId: `${nodeId}.Range`, browseName: { name: 'EURange' }, nodeClass: NodeClass.Variable }
      ]
    }));
  });
  const answerRead = (arg: unknown): Array<unknown> =>
    (arg as Array<{ nodeId: string; attributeId: number }>).map(({ nodeId, attributeId }) => {
      if (nodeId.endsWith('.EU')) return { statusCode: { value: 0 }, value: { value: { displayName: { text: 'bar' } } } };
      if (nodeId.endsWith('.Range')) return { statusCode: { value: 0 }, value: { value: { low: 0, high: 10 } } };
      if (attributeId === AttributeIds.Description)
        return { statusCode: { value: 0 }, value: { value: { text: `${nodeId} description` } } };
      return { statusCode: { value: 0 }, value: { value: 1, dataType: DataType.Double } };
    });
  const read = mock.fn(async (arg: unknown): Promise<Array<unknown>> => answerRead(arg));
  const session = createMock<ClientSession>({ browse, read });
  return { variableIds, browse, read, answerRead, session };
}

describe('SouthOPCUA', () => {
  let SouthOPCUA: typeof SouthOPCUAClass;
  let south: SouthOPCUAClass;
  let configuration: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>;
  let logger: PinoLogger;
  let southCacheRepository: Mocked<SouthCacheRepository>;

  const createUtilsOpcuaMocks = () => ({
    createSessionConfigs: mock.fn(() => ({ options: opcuaOptions, userIdentity: opcuaUserIdentity })),
    createOPCUASession: mock.fn(async (..._args: Array<unknown>): Promise<ClientSession> => createMock<ClientSession>()),
    getHistoryReadRequest: mock.fn(() => new HistoryReadRequest()),
    getTimestamp: mock.fn(() => testData.constants.dates.FAKE_NOW),
    logMessages: mock.fn(),
    parseOPCUAValue: mock.fn((): string | null => null)
  });
  const utilsOpcuaExports = createUtilsOpcuaMocks();

  const createOpcuaMocks = () => ({
    OPCUAClient: { create: mock.fn((_options?: OPCUAClientOptions): unknown => null) },
    readOperationLimits: mock.fn(async (_session: unknown): Promise<{ maxNodesPerRead?: number; maxNodesPerBrowse?: number }> => ({})),
    resolveNodeId: mock.fn((nodeId: unknown) => nodeId)
  });
  const opcuaExports = {
    __esModule: true,
    AttributeIds,
    MessageSecurityMode,
    NodeClass,
    StatusCodes,
    TimestampsToReturn,
    UserTokenType,
    ...createOpcuaMocks()
  };

  before(() => {
    mockModule(nodeRequire, 'node-opcua', opcuaExports);
    mockModule(nodeRequire, '../../service/utils-opcua', utilsOpcuaExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthOPCUA = reloadModule<{ default: typeof SouthOPCUAClass }>(nodeRequire, './south-opcua').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    southCacheRepository = createMock<SouthCacheRepository>({ getItemsLastValues: () => new Map() });
    Object.assign(utilsOpcuaExports, createUtilsOpcuaMocks());
    Object.assign(opcuaExports, createOpcuaMocks());
    configuration = buildConfiguration();

    mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthOPCUA(
      configuration,
      mock.fn(async () => undefined),
      southCacheRepository,
      'cacheFolder'
    );
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  /** Gives the connector a shared session whose subscription monitors items through `stream`. */
  const mockSubscription = () => {
    const stream = new CustomStream();
    const monitor = mock.fn(() => stream);
    const subscription = Object.assign(new EventEmitter(), { terminate: mock.fn(async () => undefined), monitor });
    const createSubscription2 = mock.fn(async () => subscription);
    south['session'] = createMock<ClientSession>({ createSubscription2 });
    return { stream, monitor, subscription, createSubscription2 };
  };

  const loggedErrors = (message: string, argumentIndex = 0) =>
    logger.error.mock.calls.filter(call => call.arguments[argumentIndex] === message).length;

  it('should be properly initialized', async () => {
    const connect = mock.method(south, 'connect', async () => undefined);
    const createSession = mock.method(south, 'createSession', async () => createMock<ClientSession>());
    await south.start();
    await south.start();
    // createSession should not be called right after starting, because
    // it will be eventually called when the first session is needed.
    // The cert is loaded inside createSession (not in start) so we don't assert here.
    assert.strictEqual(createSession.mock.calls.length, 0);
    assert.strictEqual(connect.mock.calls.length, 2);
  });

  it('should properly connect', async () => {
    const session = createMock<ClientSession>();
    const createSession = mock.method(south, 'createSession', async () => session);
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    south['reconnectTimeout'] = setTimeout(() => null);
    south['flushTimeout'] = setTimeout(() => null);
    await south.connect();
    // A single shared session is created — reused by both queries and, if the connector has
    // subscription-mode items, the subscription itself (see subscribe()).
    assert.strictEqual(createSession.mock.calls.length, 1);
    assert.strictEqual(south['session'], session);
    assert.strictEqual(disconnect.mock.calls.length, 0);
  });

  it('should properly create a real OPCUA session', async () => {
    const createdSession = createMock<ClientSession>();
    utilsOpcuaExports.createOPCUASession.mock.mockImplementationOnce(async () => createdSession);

    const session = await south.createSession();

    assert.strictEqual(session, createdSession);
    assert.strictEqual(utilsOpcuaExports.createSessionConfigs.mock.calls.length, 1);
    assert.strictEqual(utilsOpcuaExports.createOPCUASession.mock.calls.length, 1);
    assert.deepStrictEqual(utilsOpcuaExports.createOPCUASession.mock.calls[0].arguments, [
      configuration.settings.url,
      opcuaUserIdentity,
      opcuaOptions,
      configuration.settings.connectionTimeout
    ]);
    assert.ok(
      logger.info.mock.calls.some(
        c => typeof c.arguments[0] === 'string' && c.arguments[0].startsWith(`Connected to OPCUA server ${configuration.settings.url}`)
      )
    );
  });

  it('should not reconnect if disconnecting', async () => {
    mock.method(south, 'createSession', () => {
      throw new Error('get session error');
    });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    south['disconnecting'] = true;
    await south.connect();
    assert.strictEqual(loggedErrors('Error while connecting to the OPCUA server: get session error'), 1);
    assert.strictEqual(disconnect.mock.calls.length, 1);
  });

  it('should properly reconnect if not disconnecting', async () => {
    mock.method(south, 'createSession', () => {
      throw new Error('get session error');
    });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    south['disconnecting'] = false;
    await south.connect();
    assert.strictEqual(loggedErrors('Error while connecting to the OPCUA server: get session error'), 1);
    assert.strictEqual(disconnect.mock.calls.length, 1);
  });

  it('should not schedule a reconnect after a failed connect when the connector is disabled', async () => {
    mock.method(south, 'createSession', () => {
      throw new Error('get session error');
    });
    mock.method(south, 'disconnect', async () => undefined);
    south['disconnecting'] = false;
    south['connector'].enabled = false;
    await south.connect();
    assert.strictEqual(south['reconnectTimeout'], null);
  });

  it('should properly disconnect', async () => {
    await south.disconnect();

    south['flushTimeout'] = setTimeout(() => null);
    south['reconnectTimeout'] = setTimeout(() => null);
    south['subscriptionWatchdog'] = setTimeout(() => null);
    const subscription = createMock<ClientSubscription>();
    const session = createMock<ClientSession>();
    south['subscription'] = subscription;
    south['session'] = session;
    south['monitoredItems'].set('someItem', createMock<ClientMonitoredItem>());

    await south.disconnect();
    assert.strictEqual(subscription.terminate.mock.calls.length, 1);
    assert.strictEqual(session.close.mock.calls.length, 1);
    assert.strictEqual(south['session'], null);
    assert.strictEqual(south['subscriptionWatchdog'], null);
    assert.strictEqual(south['monitoredItems'].size, 0);
  });

  it('should properly test connection', async () => {
    const session = createMock<ClientSession>({ read: async () => serverStatusValues() });
    const createSession = mock.method(south, 'createSession', async () => session);
    const testResult = await south.testConnection();
    assert.strictEqual(createSession.mock.calls.length, 1);
    assert.strictEqual(session.read.mock.calls.length, 1);
    assert.strictEqual(session.close.mock.calls.length, 1);
    assert.strictEqual(testResult.items.length, 5);
    assert.deepStrictEqual(testResult.items[0], { key: 'State', value: 'Running' });
  });

  it('should reuse the already-open shared session for testConnection and not close it', async () => {
    const session = createMock<ClientSession>({ read: async () => serverStatusValues() });
    south['session'] = session;
    const createSession = mock.method(south, 'createSession', async () => createMock<ClientSession>());

    const testResult = await south.testConnection();

    // The persistent session is reused, not replaced, and must not be closed by this call —
    // it's still owned by connect()/disconnect(), not by testConnection().
    assert.strictEqual(createSession.mock.calls.length, 0);
    assert.strictEqual(session.read.mock.calls.length, 1);
    assert.strictEqual(session.close.mock.calls.length, 0);
    assert.strictEqual(south['session'], session);
    assert.strictEqual(testResult.items.length, 5);
  });

  it('should properly test connection with graceful degradation when session.read throws', async () => {
    const session = createMock<ClientSession>({
      read: async () => {
        throw new Error('Read not supported');
      }
    });
    const createSession = mock.method(south, 'createSession', async () => session);
    const testResult = await south.testConnection();
    assert.strictEqual(createSession.mock.calls.length, 1);
    assert.strictEqual(session.read.mock.calls.length, 1);
    assert.strictEqual(session.close.mock.calls.length, 1);
    assert.deepStrictEqual(testResult, { items: [] });
  });

  it('should skip data values with bad status codes or null values', async () => {
    const session = createMock<ClientSession>({
      read: async () => [
        { statusCode: { value: 0 }, value: { value: 0 } }, // State Good — included (Running)
        { statusCode: { value: 0 }, value: { value: 'Prosys OPC' } }, // ManufacturerName Good — included
        { statusCode: { value: 0x80350000 }, value: { value: 'bad' } }, // ProductName Bad status — skipped
        { statusCode: { value: 0 }, value: { value: null } }, // SoftwareVersion null value — skipped
        { statusCode: { value: 0 }, value: { value: '1234' } } // BuildNumber Good — included
      ]
    });
    mock.method(south, 'createSession', async () => session);
    const testResult = await south.testConnection();
    assert.strictEqual(testResult.items.length, 3);
    assert.deepStrictEqual(testResult.items[0], { key: 'State', value: 'Running' });
    assert.deepStrictEqual(testResult.items[1], { key: 'ManufacturerName', value: 'Prosys OPC' });
    assert.deepStrictEqual(testResult.items[2], { key: 'BuildNumber', value: '1234' });
  });

  it('should fall back to numeric string for unknown state values', async () => {
    // State = unknown value not in labels
    mock.method(south, 'createSession', async () => createMock<ClientSession>({ read: async () => serverStatusValues(99) }));
    const testResult = await south.testConnection();
    assert.deepStrictEqual(testResult.items[0], { key: 'State', value: '99' });
  });

  it('should test connection with endpoint discovery, security policies, and aggregates', async () => {
    const endpointClient = {
      connect: mock.fn(async () => undefined),
      getEndpoints: mock.fn(async () => [
        {
          securityMode: MessageSecurityMode.None,
          securityPolicyUri: 'http://opcfoundation.org/UA/SecurityPolicy#None',
          userIdentityTokens: [{ tokenType: UserTokenType.Anonymous }, { tokenType: UserTokenType.UserName }]
        },
        {
          securityMode: MessageSecurityMode.SignAndEncrypt,
          securityPolicyUri: 'http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256',
          userIdentityTokens: [{ tokenType: UserTokenType.Certificate }]
        }
      ]),
      disconnect: mock.fn(async () => undefined)
    };
    let endpointClientOptions: OPCUAClientOptions | undefined;
    opcuaExports.OPCUAClient.create.mock.mockImplementation((options?: OPCUAClientOptions) => {
      endpointClientOptions = options;
      return endpointClient;
    });
    const session = createMock<ClientSession>({
      read: async () => serverStatusValues(),
      browse: async () => ({ references: [{ displayName: { text: 'Average' } }, { displayName: { text: 'Minimum' } }] })
    });
    mock.method(south, 'createSession', async () => session);

    const testResult = await south.testConnection();

    assert.ok(testResult.items.some(i => i.key === 'State'));
    assert.ok(testResult.items.some(i => i.key === 'SecurityModes'));
    assert.ok(testResult.items.some(i => i.key === 'SecurityPolicies'));
    assert.ok(testResult.items.some(i => i.key === 'AuthenticationModes'));
    assert.ok(testResult.items.some(i => i.key === 'SupportedAggregates'));
    assert.strictEqual(endpointClient.connect.mock.calls.length, 1);
    assert.strictEqual(endpointClient.disconnect.mock.calls.length, 1);
    assert.strictEqual(endpointClientOptions?.transportTimeout, configuration.settings.connectionTimeout);
  });

  it('should test connection and fall back to raw values for unmapped security mode, empty policy uri, and unmapped token type', async () => {
    const endpointClient = {
      connect: mock.fn(async () => undefined),
      getEndpoints: mock.fn(async () => [
        {
          securityMode: 99, // not present in SECURITY_MODE_LABELS
          securityPolicyUri: undefined,
          userIdentityTokens: [{ tokenType: 42 }] // not present in AUTH_TYPE_LABELS
        }
      ]),
      disconnect: mock.fn(async () => undefined)
    };
    opcuaExports.OPCUAClient.create.mock.mockImplementation(() => endpointClient);
    mock.method(south, 'createSession', async () => createMock<ClientSession>({ read: async () => serverStatusValues() }));

    const testResult = await south.testConnection();

    assert.ok(testResult.items.some(i => i.key === 'SecurityModes' && i.value === '99'));
    assert.ok(!testResult.items.some(i => i.key === 'SecurityPolicies'));
    assert.ok(testResult.items.some(i => i.key === 'AuthenticationModes' && i.value === '42'));
  });

  it('should properly throw error if test fails', async () => {
    const createSession = mock.method(south, 'createSession', () => {
      throw new Error('get session error');
    });
    await assert.rejects(async () => south.testConnection(), /get session error/);
    assert.strictEqual(createSession.mock.calls.length, 1);
  });

  it('should properly test ha item', async () => {
    const session = createMock<ClientSession>();
    const createSession = mock.method(south, 'createSession', async () => session);
    const getDAValues = mock.method(south, 'getDAValues', async () => []);
    const getHAValues = mock.method(south, 'getHAValues', async () => ({ value: null, trackedInstant: null }));

    const result = await south.testItem(configuration.items[0], {
      history: {
        startTime: testData.constants.dates.DATE_1,
        endTime: testData.constants.dates.DATE_2
      }
    });
    assert.deepStrictEqual(getHAValues.mock.calls[0].arguments, [
      [configuration.items[0]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      session,
      true
    ]);
    assert.strictEqual(opcuaExports.resolveNodeId.mock.calls.length, 0);
    assert.strictEqual(getDAValues.mock.calls.length, 0);
    assert.strictEqual(createSession.mock.calls.length, 1);
    assert.strictEqual(session.close.mock.calls.length, 1);
    assert.strictEqual(typeof result.connectionDuration, 'number');
    assert.strictEqual(typeof result.queryDuration, 'number');
  });

  it('should properly test da item', async () => {
    const session = createMock<ClientSession>();
    const createSession = mock.method(south, 'createSession', async () => session);
    mock.method(south, 'getDAValues', async () => []);
    mock.method(south, 'getHAValues', async () => ({ value: null, trackedInstant: null }));

    const result = await south.testItem(configuration.items[3], { history: undefined });
    assert.deepStrictEqual(opcuaExports.resolveNodeId.mock.calls[0].arguments, [configuration.items[0].settings.nodeId]);
    assert.strictEqual(createSession.mock.calls.length, 1);
    assert.strictEqual(session.close.mock.calls.length, 1);
    assert.strictEqual(typeof result.connectionDuration, 'number');
    assert.strictEqual(typeof result.queryDuration, 'number');
  });

  it('should measure connection and query durations separately for testItem', async () => {
    mock.method(south, 'createSession', async () => {
      mock.timers.tick(50);
      return createMock<ClientSession>();
    });
    mock.method(south, 'getDAValues', async () => {
      mock.timers.tick(20);
      return [];
    });

    const result = await south.testItem(configuration.items[3], { history: undefined });

    assert.strictEqual(result.connectionDuration, 50);
    assert.strictEqual(result.queryDuration, 20);
  });

  it('should reuse the already-open shared session for testItem and not close it', async () => {
    const session = createMock<ClientSession>();
    south['session'] = session;
    const createSession = mock.method(south, 'createSession', async () => createMock<ClientSession>());
    const getDAValues = mock.method(south, 'getDAValues', async () => []);

    const result = await south.testItem(configuration.items[3], { history: undefined });

    assert.deepStrictEqual(getDAValues.mock.calls[0].arguments, [
      [{ nodeId: configuration.items[3].settings.nodeId, name: configuration.items[3].name, settings: configuration.items[3].settings }],
      session,
      { itemId: configuration.items[3].id, itemName: configuration.items[3].name }
    ]);
    // The persistent session is reused, not replaced, and must not be closed by this call.
    assert.strictEqual(createSession.mock.calls.length, 0);
    assert.strictEqual(session.close.mock.calls.length, 0);
    assert.strictEqual(south['session'], session);
    // No session was created, so there's nothing to attribute connection time to.
    assert.strictEqual(result.connectionDuration, 0);
  });

  it('should properly throw error if test item fails', async () => {
    const createSession = mock.method(south, 'createSession', () => {
      throw new Error('get session error');
    });
    const getDAValues = mock.method(south, 'getDAValues', async () => []);
    const getHAValues = mock.method(south, 'getHAValues', async () => ({ value: null, trackedInstant: null }));

    await assert.rejects(async () => south.testItem(configuration.items[3], { history: undefined }), /get session error/);
    assert.strictEqual(createSession.mock.calls.length, 1);
    assert.strictEqual(getDAValues.mock.calls.length, 0);
    assert.strictEqual(getHAValues.mock.calls.length, 0);
  });

  it('should properly manage history query', async () => {
    const getHAValues = mock.method(south, 'getHAValues', async () => ({ value: null, trackedInstant: null }));
    const session = createMock<ClientSession>();
    south['session'] = session;
    await south.historyQuery(
      [configuration.items[0], configuration.items[1], configuration.items[2]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2
    );

    assert.deepStrictEqual(getHAValues.mock.calls[0].arguments, [
      [configuration.items[0], configuration.items[1], configuration.items[2]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      session
    ]);
    // The shared session is unaffected by a successful query
    assert.strictEqual(south['session'], session);
  });

  it('should trigger a full reconnect on non-device error, without swallowing the error', async () => {
    south['session'] = createMock<ClientSession>();
    mock.method(south, 'getHAValues', () => {
      throw new Error('history error');
    });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);

    await assert.rejects(
      async () =>
        south.historyQuery(
          [configuration.items[0], configuration.items[1], configuration.items[2]],
          testData.constants.dates.DATE_1,
          testData.constants.dates.DATE_2
        ),
      /history error/
    );

    // A non-device error means the session/channel itself is broken — the whole connector
    // reconnects (same path a subscription failure already uses), rather than swapping just
    // this one session.
    assert.strictEqual(disconnect.mock.calls.length, 1);
  });

  it('should not trigger a reconnect on non-device error while already disconnecting', async () => {
    south['session'] = createMock<ClientSession>();
    mock.method(south, 'getHAValues', () => {
      throw new Error('history error');
    });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
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

    assert.strictEqual(disconnect.mock.calls.length, 0);
  });

  it('should reconnect only once when two concurrent queries hit the same non-device session failure', async () => {
    // Use the real disconnect() (not mocked, unlike other tests here) so its synchronous
    // `this.disconnecting = true` guard — the mechanism this test is verifying — actually runs.
    const failedSession = createMock<ClientSession>();
    south['session'] = failedSession;
    mock.method(south, 'getHAValues', () => Promise.reject(new Error('history error')));
    mock.method(south, 'connect', async () => undefined);

    const items = [configuration.items[0], configuration.items[1], configuration.items[2]];
    const results = await Promise.allSettled([
      south.historyQuery(items, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2),
      south.historyQuery(items, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2)
    ]);

    assert.ok(results.every(r => r.status === 'rejected'));
    // Both calls fail on the same shared session and each calls triggerReconnect(), but
    // disconnect() sets `disconnecting = true` synchronously as its first statement, so
    // triggerReconnect()'s guard means only the first call actually closes the session — the
    // second call's triggerReconnect() is a synchronous no-op.
    assert.strictEqual(failedSession.close.mock.calls.length, 1);
  });

  it('should skip HA group without reconnect on device/PLC error (e.g. BadNoCommunication)', async () => {
    const session = createMock<ClientSession>();
    south['session'] = session;
    mock.method(south, 'getHAValues', () => {
      throw new Error('BadNoCommunication: device unreachable');
    });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    const result = await south.historyQuery(
      [configuration.items[0], configuration.items[1], configuration.items[2]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2
    );
    assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    assert.strictEqual(disconnect.mock.calls.length, 0);
    // Session is untouched
    assert.strictEqual(south['session'], session);
  });

  it('should return early and skip getHAValues when client not set', async () => {
    const getHAValues = mock.method(south, 'getHAValues', async () => ({ value: null, trackedInstant: null }));

    const result = await south.historyQuery(
      [configuration.items[0], configuration.items[1], configuration.items[2]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2
    );

    assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    assert.strictEqual(getHAValues.mock.calls.length, 0);
  });

  it('should properly get HA values with response status not good', async () => {
    const historyReadRequest = new HistoryReadRequest();
    utilsOpcuaExports.getHistoryReadRequest.mock.mockImplementation(() => historyReadRequest);
    const historyRead = notOkHistoryRead();
    mock.method(south, 'addContent', async () => undefined);
    // Only throw on the first resolveNodeId call; subsequent calls resolve normally
    opcuaExports.resolveNodeId.mock.mockImplementationOnce(() => {
      throw new Error('node id error');
    });

    await south.getHAValues(
      [configuration.items[0], configuration.items[0], configuration.items[1]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      createMock<ClientSession>({ historyRead })
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
      loggedErrors(
        `Error when parsing node ID ${configuration.items[0].settings.nodeId} for item ${configuration.items[0].name}: node id error`,
        1
      ),
      1
    );
    assert.strictEqual(loggedErrors('Error while reading history: not ok', 1), 1);
    assert.strictEqual(loggedErrors('No result found in response', 1), 1);
  });

  it('should properly retrieve HA values with associated node not found', async () => {
    const historyReadRequest = new HistoryReadRequest();
    utilsOpcuaExports.getHistoryReadRequest.mock.mockImplementation(() => historyReadRequest);
    const historyRead = notOkHistoryRead();
    mock.method(south, 'addContent', async () => undefined);

    await south.getHAValues(
      [configuration.items[0], configuration.items[1]],
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      createMock<ClientSession>({ historyRead })
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
    assert.strictEqual(loggedErrors('Error while reading history: not ok', 1), 1);
    assert.strictEqual(loggedErrors('No result found in response', 1), 1);
  });

  it('getHAValues() in case of a test', async () => {
    const historyRead = mock.fn(() =>
      historyReadResponse([
        stringDataValue('123', testData.constants.dates.FAKE_NOW),
        stringDataValue('456', testData.constants.dates.FAKE_NOW)
      ])
    );
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation(() => '123');
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementationOnce(() => '');

    const result = await south.getHAValues(
      [configuration.items[0]],
      testData.constants.dates.FAKE_NOW,
      testData.constants.dates.FAKE_NOW,
      createMock<ClientSession>({ historyRead }),
      true
    );
    assert.ok(historyRead.mock.calls.length >= 1);
    assert.deepStrictEqual(result, {
      value: {
        quality: 'Good',
        value: '123',
        pointId: 'item1',
        timestamp: testData.constants.dates.FAKE_NOW
      },
      trackedInstant: '2021-01-02T00:00:00.000Z'
    });
  });

  it('getHAValues() in case of run time', async () => {
    const historyRead = mock.fn(() => historyReadResponse([stringDataValue('789', testData.constants.dates.DATE_2)]));
    historyRead.mock.mockImplementationOnce(() =>
      historyReadResponse(
        [
          stringDataValue('123', testData.constants.dates.DATE_2),
          stringDataValue('123', testData.constants.dates.DATE_1, 'serverTimestamp')
        ],
        true
      )
    );
    const addContent = mock.method(south, 'addContent', async () => undefined);
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation(() => '456');
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementationOnce(() => '123');

    await south.getHAValues(
      [configuration.items[0]],
      testData.constants.dates.FAKE_NOW,
      testData.constants.dates.FAKE_NOW,
      createMock<ClientSession>({ historyRead }),
      false
    );
    assert.strictEqual(historyRead.mock.calls.length, 2);
    assert.strictEqual(addContent.mock.calls.length, 1);
    assert.deepStrictEqual(addContent.mock.calls[0].arguments, [
      {
        content: [
          {
            quality: 'Good',
            value: '123',
            pointId: 'item1',
            timestamp: testData.constants.dates.DATE_2
          },
          {
            quality: 'Good',
            value: '456',
            pointId: 'item1',
            timestamp: testData.constants.dates.DATE_1
          }
        ],
        type: 'record-list'
      },
      testData.constants.dates.FAKE_NOW,
      [configuration.items[0]]
    ]);
  });

  it('getHAValues() in case of a bad result status code', async () => {
    const historyRead = mock.fn(() => ({
      responseHeader: { serviceResult: StatusCodes.Good },
      results: [
        { statusCode: StatusCodes.Bad, continuationPoint: false },
        { statusCode: StatusCodes.BadDataLost, continuationPoint: false },
        { statusCode: StatusCodes.Bad, continuationPoint: false }
      ]
    }));

    const result = await south.getHAValues(
      [configuration.items[0], configuration.items[1], configuration.items[2]],
      testData.constants.dates.FAKE_NOW,
      testData.constants.dates.FAKE_NOW,
      createMock<ClientSession>({ historyRead }),
      true
    );
    assert.ok(historyRead.mock.calls.length >= 1);
    assert.deepStrictEqual(result, { value: null, trackedInstant: null });
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
    const historyRead = mock.fn(() => ({
      responseHeader: { serviceResult: StatusCodes.Good },
      results: [{ historyData: {}, statusCode: StatusCodes.Good, continuationPoint: false }]
    }));

    await south.getHAValues(
      [configuration.items[0]],
      testData.constants.dates.FAKE_NOW,
      testData.constants.dates.FAKE_NOW,
      createMock<ClientSession>({ historyRead }),
      true
    );
    assert.ok(historyRead.mock.calls.length >= 1);
  });

  describe('filter items', () => {
    const subscription = { id: 'subscription' };
    const polled = testData.scanMode.list[0];
    const filterItem = (
      id: string,
      mode: 'ha' | 'da',
      scanMode: object,
      groupScanMode: object | null,
      syncWithGroup = false
    ): SouthConnectorItemEntity<SouthOPCUAItemSettings> =>
      ({
        id,
        enabled: true,
        settings: { mode },
        scanMode,
        group: groupScanMode ? { scanMode: groupScanMode } : null,
        syncWithGroup
      }) as unknown as SouthConnectorItemEntity<SouthOPCUAItemSettings>;

    const items = [
      filterItem('id1', 'ha', polled, null), // history: kept
      filterItem('id2', 'ha', subscription, null),
      filterItem('id3', 'ha', polled, polled, true), // history: kept
      filterItem('id4', 'ha', polled, subscription, true),
      filterItem('id5', 'ha', polled, subscription), // history: kept
      filterItem('id6', 'ha', subscription, polled),
      filterItem('id7', 'da', subscription, polled),
      filterItem('id8', 'da', polled, subscription, true),
      filterItem('id9', 'da', polled, subscription), // direct: kept
      filterItem('id10', 'da', subscription, polled),
      filterItem('id11', 'da', polled, polled, true) // direct: kept
    ];

    it('should filter HA items', () => {
      assert.deepStrictEqual(south.filterHistoryItems(items), [items[0], items[2], items[4]]);
    });

    it('should filter direct items (DA mode only, non-subscription scanMode)', () => {
      assert.deepStrictEqual(south.filterDirectItems(items), [items[8], items[10]]);
    });
  });

  it('should return null and skip getDAValues when client not set', async () => {
    const getDAValues = mock.method(south, 'getDAValues', async () => []);
    const result = await south.directQuery(configuration.items);
    assert.strictEqual(result, null);
    assert.strictEqual(getDAValues.mock.calls.length, 0);
  });

  it('should do nothing on query last point if no nodes to read', async () => {
    south['session'] = createMock<ClientSession>();
    const getDAValues = mock.method(south, 'getDAValues', async () => []);
    const addContent = mock.method(south, 'addContent', async () => undefined);
    await south.directQuery([]);
    assert.strictEqual(getDAValues.mock.calls.length, 0);
    assert.strictEqual(addContent.mock.calls.length, 0);
  });

  it('should query last point (only one)', async () => {
    const session = createMock<ClientSession>();
    south['session'] = session;
    const getDAValues = mock.method(south, 'getDAValues', async () => testData.oibusContent[0].content as Array<OIBusPointRecord>);
    const addContent = mock.method(south, 'addContent', async () => undefined);
    await south.directQuery([configuration.items[0], configuration.items[3]]);
    assert.deepStrictEqual(getDAValues.mock.calls[0].arguments, [
      [{ nodeId: configuration.items[3].settings.nodeId, name: configuration.items[3].name, settings: configuration.items[3].settings }],
      session,
      {}
    ]);
    assert.strictEqual(addContent.mock.calls.length, 1);
    // The shared session is unaffected by a successful query
    assert.strictEqual(south['session'], session);
  });

  it('should trigger a full reconnect on non-device error, without swallowing the error', async () => {
    const failedSession = createMock<ClientSession>();
    south['session'] = failedSession;
    const getDAValues = mock.method(south, 'getDAValues', () => {
      throw new Error('opcua read error');
    });
    const addContent = mock.method(south, 'addContent', async () => undefined);
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    await assert.rejects(async () => south.directQuery([configuration.items[0], configuration.items[3]]), /opcua read error/);
    assert.deepStrictEqual(getDAValues.mock.calls[0].arguments, [
      [{ nodeId: configuration.items[3].settings.nodeId, name: configuration.items[3].name, settings: configuration.items[3].settings }],
      failedSession,
      {}
    ]);
    assert.strictEqual(addContent.mock.calls.length, 0);
    // A non-device error means the session/channel itself is broken — the whole connector
    // reconnects (same path a subscription failure already uses), rather than swapping just
    // this one session.
    assert.strictEqual(disconnect.mock.calls.length, 1);
  });

  it('should not trigger a reconnect on non-device error while already disconnecting', async () => {
    south['session'] = createMock<ClientSession>();
    mock.method(south, 'getDAValues', () => {
      throw new Error('opcua read error');
    });
    const addContent = mock.method(south, 'addContent', async () => undefined);
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    const connect = mock.method(south, 'connect', async () => undefined);
    south['disconnecting'] = true;
    await assert.rejects(async () => south.directQuery([configuration.items[0], configuration.items[3]]), /opcua read error/);
    assert.strictEqual(addContent.mock.calls.length, 0);
    assert.strictEqual(connect.mock.calls.length, 0);
    assert.strictEqual(disconnect.mock.calls.length, 0);
  });

  it('should query last point and skip group without reconnect on device/PLC error (e.g. BadCommunicationError)', async () => {
    const session = createMock<ClientSession>();
    south['session'] = session;
    mock.method(south, 'getDAValues', () => {
      throw new Error('BadCommunicationError: PLC channel offline');
    });
    const addContent = mock.method(south, 'addContent', async () => undefined);
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    // directQuery must return null (skip group) without throwing and without disconnecting
    const result = await south.directQuery([configuration.items[0], configuration.items[3]]);
    assert.strictEqual(result, null);
    assert.strictEqual(addContent.mock.calls.length, 0);
    assert.strictEqual(disconnect.mock.calls.length, 0);
    // Session is untouched
    assert.strictEqual(south['session'], session);
  });

  it('should not query items if bad node id', async () => {
    south['session'] = createMock<ClientSession>();
    const getDAValues = mock.method(south, 'getDAValues', async () => []);
    opcuaExports.resolveNodeId.mock.mockImplementation(() => {
      throw new Error('bad node id');
    });

    await south.directQuery([configuration.items[3], configuration.items[4], configuration.items[5]]);
    assert.strictEqual(getDAValues.mock.calls.length, 0);
    assert.strictEqual(logger.error.mock.calls.length, 3);
  });

  it('getDAValues() should properly retrieve data', async () => {
    const read = mock.fn(async () => [
      stringDataValue('123', testData.constants.dates.FAKE_NOW),
      stringDataValue('456', testData.constants.dates.FAKE_NOW)
    ]);
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation(() => '123');
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementationOnce(() => '');

    const result = await south.getDAValues(
      [daNode(configuration.items[0]), daNode(configuration.items[1])],
      createMock<ClientSession>({ read })
    );
    assert.strictEqual(read.mock.calls.length, 1);
    assert.deepStrictEqual(result, [
      {
        quality: 'Good',
        value: '123',
        pointId: 'item2',
        timestamp: testData.constants.dates.FAKE_NOW
      }
    ]);
  });

  it('getDAValues() should properly retrieve empty data', async () => {
    const read = mock.fn(async () => []);

    const result = await south.getDAValues([daNode(configuration.items[0])], createMock<ClientSession>({ read }));
    assert.strictEqual(read.mock.calls.length, 1);
    assert.deepStrictEqual(result, []);
    assert.strictEqual(loggedErrors('Received 0 node results, requested 1 nodes. Request done in 0 ms', 1), 1);
  });

  it('getDAValues() should throw when session.read() fails (propagated to directQuery catch)', async () => {
    const session = createMock<ClientSession>({
      read: async () => {
        throw new Error('BadSessionClosed');
      }
    });
    await assert.rejects(async () => south.getDAValues([daNode(configuration.items[0])], session), /BadSessionClosed/);
  });

  it('getDAValues() should throw BadTimeout when session.read() does not respond within readTimeout', async () => {
    // read() returns a Promise that never resolves (simulates a hanging PLC/server)
    const session = createMock<ClientSession>({
      read: () =>
        new Promise<never>(() => {
          /* empty */
        })
    });

    const getDAValuesPromise = south.getDAValues([daNode(configuration.items[3])], session);
    // Register the assertion BEFORE ticking so the rejection handler is already attached
    // when mock.timers.tick fires synchronously — otherwise the promise is briefly unhandled.
    const assertion = assert.rejects(getDAValuesPromise, /BadTimeout/);
    mock.timers.tick(configuration.settings.readTimeout);
    await assertion;
  });

  it('should return null and not disconnect when DA read times out (treated as device error)', async () => {
    south['session'] = createMock<ClientSession>();
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    // getDAValues is mocked here, so its BadTimeout rejection is simulated directly.
    mock.method(south, 'getDAValues', () => Promise.reject(new Error('BadTimeout: DA read timed out after 15000 ms')));

    const result = await south.directQuery([configuration.items[3]]);

    assert.strictEqual(result, null);
    assert.strictEqual(disconnect.mock.calls.length, 0);
    assert.ok(
      logger.warn.mock.calls.some(c => c.arguments[1].includes('BadTimeout') && c.arguments[1].includes('device/PLC error, session kept'))
    );
  });

  it('should use the already-connected shared session when subscribing', async () => {
    const { createSubscription2 } = mockSubscription();
    const createSession = mock.method(south, 'createSession', async () => createMock<ClientSession>());

    await south.subscribe(configuration.items);

    // subscribe() reuses the shared session established by connect() — it never opens a session
    // of its own, so a server capping concurrent sessions per client at 1 is never exceeded.
    assert.strictEqual(createSession.mock.calls.length, 0);
    assert.strictEqual(createSubscription2.mock.calls.length, 1);
  });

  it('should create the subscription from the subscription settings', async () => {
    const { createSubscription2 } = mockSubscription();
    configuration.settings.subscription = {
      ...configuration.settings.subscription,
      publishingInterval: 500,
      maxKeepAliveCount: 20
    };

    await south.subscribe(configuration.items);

    assert.deepStrictEqual(createSubscription2.mock.calls[0].arguments, [
      {
        requestedPublishingInterval: 500,
        requestedLifetimeCount: 200,
        requestedMaxKeepAliveCount: 20,
        maxNotificationsPerPublish: 0,
        publishingEnabled: true,
        priority: 10
      }
    ]);
  });

  it('should not subscribe if no items', async () => {
    const { createSubscription2, monitor } = mockSubscription();

    await south.subscribe([]);

    assert.strictEqual(southCacheRepository.getItemsLastValues.mock.calls.length, 0);
    assert.strictEqual(createSubscription2.mock.calls.length, 0);
    assert.strictEqual(monitor.mock.calls.length, 0);
    assert.strictEqual(south['subscription'], null);
  });

  it('should not subscribe if already subscribe', async () => {
    const { createSubscription2, monitor } = mockSubscription();
    south['subscription'] = createMock<ClientSubscription>({ monitor });

    await south.subscribe([configuration.items[0]]);
    assert.strictEqual(createSubscription2.mock.calls.length, 0);
    assert.strictEqual(monitor.mock.calls.length, 1);
  });

  it('should properly manage subscriptions', async () => {
    const { stream, monitor, createSubscription2 } = mockSubscription();
    // Only throw on the first resolveNodeId call (for items[0]); items[1] is skipped; items[2] succeeds
    opcuaExports.resolveNodeId.mock.mockImplementationOnce(() => {
      throw new Error('bad node id');
    });
    const addContent = mock.method(south, 'addContent', async () => undefined);
    south['monitoredItems'].set(configuration.items[1].id, createMock<ClientMonitoredItem>());

    await south.subscribe([configuration.items[0], configuration.items[1], configuration.items[2]]);
    assert.strictEqual(createSubscription2.mock.calls.length, 1);
    assert.strictEqual(monitor.mock.calls.length, 1);
    assert.strictEqual(addContent.mock.calls.length, 0);
    assert.strictEqual(
      loggedErrors(
        `Error when parsing node ID ${configuration.items[0].settings.nodeId} for item ${configuration.items[0].name}: bad node id`
      ),
      1
    );
    assert.strictEqual(south['monitoredItems'].size, 2);

    const flushMessages = mock.method(south, 'flushMessages', async () => undefined);
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation(() => 'parsedValue');
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementationOnce(() => '');
    south['connector'].settings.subscription.numberOfMessageBeforeFlush = 2;
    stream.emit('changed', { value: { value: 1, dataType: DataType.Null }, sourceTimestamp: DateTime.now(), statusCode: StatusCodes.Good });
    stream.emit('changed', { value: { value: 1, dataType: DataType.Null }, sourceTimestamp: DateTime.now(), statusCode: StatusCodes.Good });
    assert.strictEqual(flushMessages.mock.calls.length, 0);
    stream.emit('changed', {
      value: { value: 1, dataType: DataType.Float },
      serverTimestamp: DateTime.now(),
      statusCode: StatusCodes.Good
    });
    assert.strictEqual(flushMessages.mock.calls.length, 1);
    const bufferedValue = {
      item: configuration.items[2],
      timestamp: testData.constants.dates.FAKE_NOW,
      value: 'parsedValue',
      quality: 'Good'
    };
    assert.deepStrictEqual(south['bufferedValues'], [bufferedValue, bufferedValue]);
  });

  it('should re-register monitored items after reconnect (monitoredItems cleared on disconnect)', async () => {
    const { monitor } = mockSubscription();

    // First subscribe — registers one monitored item
    await south.subscribe([configuration.items[2]]);
    assert.strictEqual(monitor.mock.calls.length, 1);
    assert.strictEqual(south['monitoredItems'].size, 1);

    // Simulate disconnect (as triggered by watchdog or terminated event)
    south['session'] = createMock<ClientSession>();
    await south.disconnect();
    assert.strictEqual(south['monitoredItems'].size, 0);

    // Simulate reconnect: new session + new subscription
    const newSubscription = Object.assign(new EventEmitter(), { terminate: mock.fn(async () => undefined), monitor });
    south['session'] = createMock<ClientSession>({ createSubscription2: async () => newSubscription });

    // subscribe() must re-register the item, not skip it
    await south.subscribe([configuration.items[2]]);
    assert.strictEqual(monitor.mock.calls.length, 2);
    assert.strictEqual(south['monitoredItems'].size, 1);
  });

  it('should properly unsubscribe', async () => {
    const monitoredItem = createMock<ClientMonitoredItem>();
    south['monitoredItems'].set(configuration.items[1].id, monitoredItem);

    await south.unsubscribe([configuration.items[0], configuration.items[1]]);

    assert.strictEqual(monitoredItem.removeAllListeners.mock.calls.length, 1);
    assert.strictEqual(monitoredItem.terminate.mock.calls.length, 1);
    assert.strictEqual(south['monitoredItems'].size, 0);
  });

  it('should not flush messages if none in buffer', async () => {
    const addContent = mock.method(south, 'addContent', async () => undefined);
    const previousTimeout = setTimeout(() => null);
    south['flushTimeout'] = previousTimeout;

    await south.flushMessages();

    assert.strictEqual(addContent.mock.calls.length, 0);
    assert.strictEqual(southCacheRepository.saveItemsLastValues.mock.calls.length, 0);
    assert.strictEqual(logger.debug.mock.calls.length, 0);
    assert.deepStrictEqual(south['bufferedValues'], []);
    // The pending flush is replaced by a new one, which flushes (and re-arms) after delayBetweenFlush
    const rescheduledTimeout = south['flushTimeout'];
    assert.ok(rescheduledTimeout);
    assert.notStrictEqual(rescheduledTimeout, previousTimeout);
    mock.timers.tick(configuration.settings.subscription.delayBetweenFlush - 1);
    assert.strictEqual(south['flushTimeout'], rescheduledTimeout);
    mock.timers.tick(1);
    assert.notStrictEqual(south['flushTimeout'], rescheduledTimeout);
  });

  it('should flush messages', async () => {
    // Two distinct item objects: flushMessages passes each buffered item object once
    const item = () => ({ name: 'pointId', id: 'itemId' }) as SouthConnectorItemEntity<SouthOPCUAItemSettings>;
    south['bufferedValues'] = [
      { item: item(), timestamp: testData.constants.dates.FAKE_NOW, value: 'value1', quality: 'quality1' },
      { item: item(), timestamp: testData.constants.dates.FAKE_NOW, value: 'value2', quality: 'quality2' }
    ];
    south['flushTimeout'] = setTimeout(() => null);

    const addContent = mock.method(south, 'addContent', async () => undefined);
    await south.flushMessages();
    assert.deepStrictEqual(addContent.mock.calls[0].arguments, [
      {
        type: 'record-list',
        content: [
          { pointId: 'pointId', timestamp: testData.constants.dates.FAKE_NOW, value: 'value1', quality: 'quality1' },
          { pointId: 'pointId', timestamp: testData.constants.dates.FAKE_NOW, value: 'value2', quality: 'quality2' }
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

    mock.method(south, 'addContent', async () => {
      throw new Error('cache content error');
    });
    await south.flushMessages();
    assert.strictEqual(loggedErrors('Error when flushing messages: cache content error'), 1);
  });

  it('should log disconnect error and still schedule reconnect when disconnect() also throws during connect recovery', async () => {
    mock.method(south, 'createSession', () => {
      throw new Error('connect session error');
    });
    mock.method(south, 'disconnect', async () => {
      throw new Error('disconnect error');
    });
    south['disconnecting'] = false;

    await south.connect();

    assert.strictEqual(loggedErrors('Error while connecting to the OPCUA server: connect session error'), 1);
    assert.strictEqual(loggedErrors('Error while disconnecting after failed connect: disconnect error'), 1);
    assert.notStrictEqual(south['reconnectTimeout'], null);
  });

  it('should skip HA group without reconnect for every device error code', async () => {
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    const getHAValues = mock.method(south, 'getHAValues');

    for (const code of DEVICE_ERROR_CODES) {
      const session = createMock<ClientSession>();
      south['session'] = session;
      getHAValues.mock.mockImplementation(() => {
        throw new Error(`${code}: server reported device offline`);
      });

      const result = await south.historyQuery([configuration.items[0]], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

      assert.deepStrictEqual(result, { trackedInstant: null, value: null }, `Expected null for ${code}`);
      assert.strictEqual(disconnect.mock.calls.length, 0, `Expected no disconnect for ${code}`);
      assert.strictEqual(south['session'], session, `Expected session preserved for ${code}`);
    }
  });

  it('should skip DA group without reconnect for every device error code', async () => {
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    const getDAValues = mock.method(south, 'getDAValues');

    for (const code of DEVICE_ERROR_CODES) {
      const session = createMock<ClientSession>();
      south['session'] = session;
      getDAValues.mock.mockImplementation(() => {
        throw new Error(`${code}: server reported device offline`);
      });

      const result = await south.directQuery([configuration.items[3]]);

      assert.strictEqual(result, null, `Expected null for ${code}`);
      assert.strictEqual(disconnect.mock.calls.length, 0, `Expected no disconnect for ${code}`);
      assert.strictEqual(south['session'], session, `Expected session preserved for ${code}`);
    }
  });

  it('should skip HA group without reconnect on node-opcua secure-channel transaction timeout', async () => {
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    const session = createMock<ClientSession>();
    south['session'] = session;
    mock.method(south, 'getHAValues', () => {
      throw new Error('Transaction has timed out ( timeout = 15000 ms , request = ReadRequest)');
    });

    const result = await south.historyQuery([configuration.items[0]], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    assert.strictEqual(disconnect.mock.calls.length, 0);
    assert.strictEqual(south['session'], session);
  });

  it('should skip DA group without reconnect on node-opcua secure-channel transaction timeout', async () => {
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    const session = createMock<ClientSession>();
    south['session'] = session;
    mock.method(south, 'getDAValues', () => {
      throw new Error('Transaction has timed out ( timeout = 15000 ms , request = ReadRequest)');
    });

    const result = await south.directQuery([configuration.items[3]]);

    assert.strictEqual(result, null);
    assert.strictEqual(disconnect.mock.calls.length, 0);
    assert.strictEqual(south['session'], session);
  });

  it('should log a bounded message (no per-item name list) in HA device error log, however many items', async () => {
    const manyItems = Array.from({ length: 13 }, (_, i) => ({ ...configuration.items[0], id: `id${i}`, name: `item${i}` }));
    south['session'] = createMock<ClientSession>();
    mock.method(south, 'getHAValues', () => {
      throw new Error('BadTimeout: device timeout');
    });
    mock.method(south, 'disconnect', async () => undefined);

    await south.historyQuery(manyItems, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    const deviceErrorLog = logger.warn.mock.calls.find(c => c.arguments[1]?.startsWith('HA read failed for 13 item(s)'));
    assert.ok(deviceErrorLog, 'Expected item count in device error log');
    assert.ok(
      !deviceErrorLog.arguments[1].includes('item0'),
      'Expected no per-item name preview — the log context carries item/group identity instead'
    );
    // None of manyItems share a group (group: null in the fixture), so the structured context is empty.
    assert.deepStrictEqual(deviceErrorLog.arguments[0], {});
  });

  it('should log a bounded message (no per-item name list) in DA device error log, however many nodes', async () => {
    const manyItems = Array.from({ length: 12 }, (_, i) => ({ ...configuration.items[3], id: `id${i}`, name: `daItem${i}` }));
    south['session'] = createMock<ClientSession>();
    mock.method(south, 'getDAValues', () => {
      throw new Error('BadDeviceFailure: device failure');
    });
    mock.method(south, 'disconnect', async () => undefined);

    const result = await south.directQuery(manyItems);

    assert.strictEqual(result, null);
    const deviceErrorLog = logger.warn.mock.calls.find(c => c.arguments[1]?.startsWith('DA read failed for 12 node(s)'));
    assert.ok(deviceErrorLog, 'Expected node count in device error log');
    assert.ok(
      !deviceErrorLog.arguments[1].includes('daItem0'),
      'Expected no per-item name preview — the log context carries item/group identity instead'
    );
    // None of manyItems share a group (group: null in the fixture), so the structured context is empty.
    assert.deepStrictEqual(deviceErrorLog.arguments[0], {});
  });

  it('should carry group identity in the HA device error log context when items belong to a synced group', async () => {
    const group = {
      id: 'groupId1',
      name: 'group 1',
      scanMode: configuration.items[0].scanMode!,
      startTimeOffset: null,
      endTimeOffset: null,
      maxReadInterval: null,
      readDelay: null,
      recoveryStrategy: null,
      cachingStrategy: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const groupedItems = Array.from({ length: 3 }, (_, i) => ({
      ...configuration.items[0],
      id: `id${i}`,
      name: `item${i}`,
      group,
      syncWithGroup: true
    }));
    south['session'] = createMock<ClientSession>();
    mock.method(south, 'getHAValues', () => {
      throw new Error('BadTimeout: device timeout');
    });
    mock.method(south, 'disconnect', async () => undefined);

    await south.historyQuery(groupedItems, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    const deviceErrorLog = logger.warn.mock.calls.find(c => c.arguments[1]?.startsWith('HA read failed for 3 item(s)'));
    assert.ok(deviceErrorLog, 'Expected item count in device error log');
    assert.deepStrictEqual(deviceErrorLog.arguments[0], { groupId: 'groupId1', groupName: 'group 1' });
  });

  it('should log error when flushMessages() rejects from the changed handler', async () => {
    const { stream } = mockSubscription();
    mock.method(south, 'addContent', async () => undefined);
    await south.subscribe([configuration.items[2]]);

    const flushError = new Error('unexpected flush error');
    mock.method(south, 'flushMessages', async () => {
      throw flushError;
    });
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation(() => 'parsedValue');
    south['connector'].settings.subscription.numberOfMessageBeforeFlush = 1;

    stream.emit('changed', { value: { value: 1, dataType: DataType.Float }, statusCode: StatusCodes.Good });
    // Two microtask turns are needed: one for the async fn rejection to propagate,
    // one for the .catch() handler to fire. flushPromises() (setImmediate-based, not faked)
    // drains the entire queue before the test resumes.
    await flushPromises();

    assert.ok(
      logger.error.mock.calls.some(
        c => c.arguments[0].includes('Error flushing messages from subscription') && c.arguments[0].includes(flushError.message)
      )
    );
  });

  it('should trigger reconnect when subscription emits terminated event', async () => {
    const { subscription } = mockSubscription();
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    await south.subscribe([configuration.items[2]]);

    subscription.emit('terminated');
    await flushPromises();

    assert.strictEqual(disconnect.mock.calls.length, 1);
    assert.strictEqual(loggedErrors('OPC-UA subscription terminated by server. Triggering reconnect'), 1);
  });

  it('should not trigger reconnect on terminated event when already disconnecting', async () => {
    const { subscription } = mockSubscription();
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    await south.subscribe([configuration.items[2]]);
    south['disconnecting'] = true;

    subscription.emit('terminated');
    await flushPromises();

    assert.strictEqual(disconnect.mock.calls.length, 0);
  });

  it('should reset watchdog when subscription emits keepalive event', async () => {
    const { subscription } = mockSubscription();
    await south.subscribe([configuration.items[2]]);

    const watchdogBefore = south['subscriptionWatchdog'];
    subscription.emit('keepalive');
    const watchdogAfter = south['subscriptionWatchdog'];

    assert.ok(watchdogBefore !== null);
    assert.ok(watchdogAfter !== null);
    // A new timer was set (the reference changes after resetSubscriptionWatchdog)
    assert.notStrictEqual(watchdogBefore, watchdogAfter);
  });

  it('should log warning when subscription emits status_changed event', async () => {
    const { subscription } = mockSubscription();
    await south.subscribe([configuration.items[2]]);

    subscription.emit('status_changed', StatusCodes.BadTimeout);

    assert.ok(logger.warn.mock.calls.some(c => c.arguments[0].includes('OPC-UA subscription status changed')));
  });

  it('should reset watchdog when a changed event is received on a monitored item', async () => {
    const { stream } = mockSubscription();
    mock.method(south, 'addContent', async () => undefined);
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation(() => 'parsedValue');
    await south.subscribe([configuration.items[2]]);

    const watchdogBefore = south['subscriptionWatchdog'];
    stream.emit('changed', { value: { value: 1, dataType: DataType.Float }, statusCode: StatusCodes.Good });
    const watchdogAfter = south['subscriptionWatchdog'];

    assert.ok(watchdogBefore !== null);
    assert.ok(watchdogAfter !== null);
    assert.notStrictEqual(watchdogBefore, watchdogAfter);
  });

  it('should trigger reconnect when the subscription is silent for as long as its lifetime, whatever the readTimeout is', async () => {
    mockSubscription();
    configuration.settings.readTimeout = 100;
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    await south.subscribe([configuration.items[2]]);

    // The lifetime is 10 times the keep alive period: 150 ms * 10 * 10
    mock.timers.tick(15_000 - 1);
    await flushPromises();
    assert.strictEqual(disconnect.mock.calls.length, 0);

    mock.timers.tick(1);
    await flushPromises();

    assert.strictEqual(disconnect.mock.calls.length, 1);
    assert.ok(logger.error.mock.calls.some(c => c.arguments[0].includes('no keepalive or data received for 15000 ms')));
  });

  it('should use the keep alive period revised by the server for the watchdog', async () => {
    // The server revises the subscription: a keep alive every 30 s
    const { subscription } = mockSubscription();
    Object.assign(subscription, { publishingInterval: 3000, maxKeepAliveCount: 10 });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    await south.subscribe([configuration.items[2]]);

    mock.timers.tick(300_000 - 1);
    await flushPromises();
    assert.strictEqual(disconnect.mock.calls.length, 0);

    mock.timers.tick(1);
    await flushPromises();
    assert.strictEqual(disconnect.mock.calls.length, 1);
    assert.ok(logger.error.mock.calls.some(c => c.arguments[0].includes('no keepalive or data received for 300000 ms')));
  });

  it('should schedule a reconnect after triggerReconnect() successfully disconnects', async () => {
    const { subscription } = mockSubscription();
    mock.method(south, 'disconnect', async () => undefined);
    const connect = mock.method(south, 'connect', async () => undefined);
    await south.subscribe([configuration.items[2]]);

    subscription.emit('terminated');
    await flushPromises();

    assert.ok(south['reconnectTimeout'] !== null, 'reconnectTimeout should be armed after a successful disconnect');

    mock.timers.tick(configuration.settings.retryInterval);
    await flushPromises();
    assert.strictEqual(connect.mock.calls.length, 1);
  });

  it('should not schedule a reconnect after triggerReconnect() if the connector was disabled while disconnecting', async () => {
    const { subscription } = mockSubscription();
    mock.method(south, 'disconnect', async () => undefined);
    mock.method(south, 'connect', async () => undefined);
    south['connector'].enabled = false;
    await south.subscribe([configuration.items[2]]);

    subscription.emit('terminated');
    await flushPromises();

    assert.strictEqual(south['reconnectTimeout'], null);
  });

  it('should not call disconnect() when triggerReconnect() runs while already disconnecting', async () => {
    mockSubscription();
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    await south.subscribe([configuration.items[2]]);
    south['disconnecting'] = true;

    south['triggerReconnect']();
    await flushPromises();

    assert.strictEqual(disconnect.mock.calls.length, 0);
  });

  it('should log error when triggerReconnect disconnect() rejects', async () => {
    const { subscription } = mockSubscription();
    mock.method(south, 'disconnect', async () => {
      throw new Error('disconnect failed');
    });
    await south.subscribe([configuration.items[2]]);

    subscription.emit('terminated');
    await flushPromises();

    assert.ok(logger.error.mock.calls.some(c => c.arguments[0].includes('Error during reconnect after subscription issue')));
  });

  it('explore should lazily create a session when not connected', async () => {
    const session = createMock<ClientSession>({ browse: async () => ({ references: [], continuationPoint: null }) });
    const createSession = mock.method(south, 'createSession', async () => session);

    const entries = await south.explore(null);

    assert.strictEqual(createSession.mock.calls.length, 1);
    assert.deepStrictEqual(entries, []);
  });

  it('explore should surface the connection error when the session cannot be created', async () => {
    mock.method(south, 'createSession', async () => {
      throw new Error('connection refused');
    });

    await assert.rejects(() => south.explore(null), { message: 'connection refused' });
  });

  it('explore should browse the root and map references', async () => {
    const browse = mock.fn(async (_nodeId: unknown) => ({
      references: [
        { nodeId: 'ns=0;i=85', displayName: { text: 'Objects' }, browseName: { toString: () => 'Objects' }, nodeClass: NodeClass.Object },
        {
          nodeId: 'ns=1;s=Temperature',
          displayName: { text: 'Temperature' },
          browseName: { toString: () => 'Temperature' },
          nodeClass: NodeClass.Variable
        },
        { nodeId: 'ns=1;s=Start', displayName: { text: 'Start' }, browseName: { toString: () => 'Start' }, nodeClass: NodeClass.Method }
      ],
      continuationPoint: null
    }));
    const session = createMock<ClientSession>({ browse, browseNext: async () => ({ references: [], continuationPoint: null }) });
    mock.method(south, 'createSession', async () => session);
    await south.connect();

    const entries = await south.explore(null);

    // Only one level browse - any other call is the batched property browse for the level's Variables
    assert.deepStrictEqual(
      browse.mock.calls.filter(call => typeof call.arguments[0] === 'string').map(call => call.arguments[0]),
      ['ns=0;i=85']
    );
    assert.deepStrictEqual(entries, [
      { id: 'ns=0;i=85', name: 'Objects', metadata: { type: 'Object', nodeId: 'ns=0;i=85' }, hasChildren: true },
      { id: 'ns=1;s=Temperature', name: 'Temperature', metadata: { type: 'Variable', nodeId: 'ns=1;s=Temperature' }, hasChildren: true },
      { id: 'ns=1;s=Start', name: 'Start', metadata: { type: 'Method', nodeId: 'ns=1;s=Start' }, hasChildren: false }
    ]);
  });

  it('explore should browse a given parent and follow continuation points', async () => {
    const browse = mock.fn(async (_nodeId: unknown) => ({
      references: [{ nodeId: 'ns=1;s=A', displayName: { text: 'A' }, browseName: { toString: () => 'A' }, nodeClass: NodeClass.Variable }],
      continuationPoint: Buffer.from([1])
    }));
    const browseNext = mock.fn(async () => ({
      references: [{ nodeId: 'ns=1;s=B', displayName: null, browseName: { toString: () => 'B' }, nodeClass: NodeClass.Variable }],
      continuationPoint: null
    }));
    mock.method(south, 'createSession', async () => createMock<ClientSession>({ browse, browseNext }));
    await south.connect();

    const entries = await south.explore('ns=1;s=Folder');

    assert.strictEqual(browse.mock.calls[0].arguments[0], 'ns=1;s=Folder');
    assert.strictEqual(browseNext.mock.calls.length, 1);
    assert.deepStrictEqual(entries, [
      { id: 'ns=1;s=A', name: 'A', metadata: { type: 'Variable', nodeId: 'ns=1;s=A' }, hasChildren: true },
      { id: 'ns=1;s=B', name: 'B', metadata: { type: 'Variable', nodeId: 'ns=1;s=B' }, hasChildren: true }
    ]);
  });

  it('explore should rethrow a session-expired error with a clear message', async () => {
    const session = createMock<ClientSession>({
      browse: async () => {
        throw new Error('BadSessionIdInvalid');
      }
    });
    mock.method(south, 'createSession', async () => session);
    await south.connect();

    await assert.rejects(
      () => south.explore(null),
      (error: Error) => error.message.includes('explore session expired')
    );
  });

  it('explore should rethrow non-session errors as-is', async () => {
    const session = createMock<ClientSession>({
      browse: async () => {
        throw new Error('some other error');
      }
    });
    mock.method(south, 'createSession', async () => session);
    await south.connect();

    await assert.rejects(() => south.explore(null), { message: 'some other error' });
  });

  it('explore should attach current value, description, unit and range for variables that expose them', async () => {
    const browse = mock.fn(async (arg: unknown) => {
      if (typeof arg === 'string') {
        return {
          references: [
            {
              nodeId: 'ns=1;s=Temperature',
              displayName: { text: 'Temperature' },
              browseName: { toString: () => 'Temperature' },
              nodeClass: NodeClass.Variable
            },
            { nodeId: 'ns=1;s=Flag', displayName: { text: 'Flag' }, browseName: { toString: () => 'Flag' }, nodeClass: NodeClass.Variable }
          ],
          continuationPoint: null
        };
      }
      // batched property-discovery browse: one BrowseResult per requested variable, same order
      return (arg as Array<string>).map(nodeId =>
        nodeId === 'ns=1;s=Temperature'
          ? {
              references: [
                { nodeId: 'ns=1;s=Temperature.EU', browseName: { name: 'EngineeringUnits' }, nodeClass: NodeClass.Variable },
                { nodeId: 'ns=1;s=Temperature.Range', browseName: { name: 'EURange' }, nodeClass: NodeClass.Variable }
              ]
            }
          : { references: [] }
      );
    });
    const read = mock.fn(async (arg: unknown) => {
      const valuesByNodeIdAndAttribute: Record<string, unknown> = {
        [`ns=1;s=Temperature|${AttributeIds.Value}`]: { statusCode: { value: 0 }, value: { value: 21.5, dataType: DataType.Double } },
        [`ns=1;s=Temperature|${AttributeIds.Description}`]: { statusCode: { value: 0 }, value: { value: { text: 'Reactor temperature' } } },
        [`ns=1;s=Flag|${AttributeIds.Value}`]: { statusCode: { value: 0 }, value: { value: true, dataType: DataType.Boolean } },
        // No description exposed for Flag - left out rather than set to an empty string
        [`ns=1;s=Flag|${AttributeIds.Description}`]: { statusCode: { value: StatusCodes.BadAttributeIdInvalid.value }, value: {} },
        [`ns=1;s=Temperature.EU|${AttributeIds.Value}`]: { statusCode: { value: 0 }, value: { value: { displayName: { text: '°C' } } } },
        [`ns=1;s=Temperature.Range|${AttributeIds.Value}`]: { statusCode: { value: 0 }, value: { value: { low: -20, high: 120 } } }
      };
      return (arg as Array<{ nodeId: string; attributeId: number }>).map(
        ({ nodeId, attributeId }) => valuesByNodeIdAndAttribute[`${nodeId}|${attributeId}`]
      );
    });
    mock.method(south, 'createSession', async () => createMock<ClientSession>({ browse, read }));
    await south.connect();
    // parseOPCUAValue itself is unit-tested separately (utils-opcua.spec.ts) and mocked here — just
    // prove explore() wires the read DataValue through to it and uses whatever it returns, in order
    // (Temperature is read before Flag, matching the browsed reference order).
    utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation(
      seq(
        () => '21.5',
        () => 'true'
      )
    );

    const entries = await south.explore(null);

    assert.deepStrictEqual(entries, [
      {
        id: 'ns=1;s=Temperature',
        name: 'Temperature',
        metadata: {
          nodeId: 'ns=1;s=Temperature',
          type: 'Variable',
          value: '21.5',
          description: 'Reactor temperature',
          unit: '°C',
          min: -20,
          max: 120
        },
        hasChildren: true
      },
      {
        id: 'ns=1;s=Flag',
        name: 'Flag',
        metadata: { nodeId: 'ns=1;s=Flag', type: 'Variable', value: 'true' },
        hasChildren: true
      }
    ]);
    // 1 top-level browse + 1 batched property-discovery browse (never one browse per variable)
    assert.strictEqual(browse.mock.calls.length, 2);
    // 1 batched description+value read + 1 batched property-value read (never one read per variable)
    assert.strictEqual(read.mock.calls.length, 2);
    assert.strictEqual((read.mock.calls[0].arguments[0] as Array<unknown>).length, 4);
  });

  it('explore should skip value/unit reads entirely when the browsed level has no variables', async () => {
    const browse = mock.fn(async () => ({
      references: [
        { nodeId: 'ns=1;s=Folder', displayName: { text: 'Folder' }, browseName: { toString: () => 'Folder' }, nodeClass: NodeClass.Object }
      ],
      continuationPoint: null
    }));
    const read = mock.fn(async () => []);
    mock.method(south, 'createSession', async () => createMock<ClientSession>({ browse, read }));
    await south.connect();

    const entries = await south.explore(null);

    assert.deepStrictEqual(entries, [
      { id: 'ns=1;s=Folder', name: 'Folder', metadata: { nodeId: 'ns=1;s=Folder', type: 'Object' }, hasChildren: true }
    ]);
    assert.strictEqual(browse.mock.calls.length, 1); // only the top-level browse — no property-discovery browse
    assert.strictEqual(read.mock.calls.length, 0);
  });

  it('explore should return plain entries when reading value/unit fails (server does not support it)', async () => {
    const session = createMock<ClientSession>({
      browse: async (arg: unknown) => {
        if (typeof arg === 'string') {
          return {
            references: [
              {
                nodeId: 'ns=1;s=Temperature',
                displayName: { text: 'Temperature' },
                browseName: { toString: () => 'Temperature' },
                nodeClass: NodeClass.Variable
              }
            ],
            continuationPoint: null
          };
        }
        throw new Error('BadNotSupported');
      },
      read: async () => {
        throw new Error('BadNotSupported');
      }
    });
    mock.method(south, 'createSession', async () => session);
    await south.connect();

    const entries = await south.explore(null);

    assert.deepStrictEqual(entries, [
      {
        id: 'ns=1;s=Temperature',
        name: 'Temperature',
        metadata: { nodeId: 'ns=1;s=Temperature', type: 'Variable' },
        hasChildren: true
      }
    ]);
  });

  describe('caching strategy filtering', () => {
    const buildDaItem = (id: string, name: string, overrides: Partial<SouthConnectorItemEntity<SouthOPCUAItemSettings>> = {}) => ({
      ...configuration.items[3],
      id,
      name,
      settings: { ...configuration.items[3].settings, nodeId: `ns=3;s=${name}` },
      ...overrides
    });

    const buildHaItem = (id: string, name: string, overrides: Partial<SouthConnectorItemEntity<SouthOPCUAItemSettings>> = {}) => ({
      ...configuration.items[0],
      id,
      name,
      settings: { ...configuration.items[0].settings, nodeId: `ns=3;s=${name}` },
      ...overrides
    });

    describe('direct/DA query path (directQuery)', () => {
      beforeEach(() => {
        south['session'] = createMock<ClientSession>();
      });

      it('should suppress a no-change value under cachingStrategy=onChange', async () => {
        const item = buildDaItem('daId1', 'daItem1', { cachingStrategy: 'onChange' });
        mock.method(south, 'getDAValues', async () => [goodTimeValue('daItem1', 42)]);
        const addContent = mock.method(south, 'addContent', async () => undefined);
        southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['daId1', 42]));

        await south.directQuery([item]);

        assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], { type: 'record-list', content: [] });
        assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], []);
        assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments, ['southId', []]);
      });

      it('should cache a threshold-exceeding change', async () => {
        const item = buildDaItem('daId1', 'daItem1', { cachingStrategy: 'threshold', thresholdType: 'absolute', threshold: 5 });
        mock.method(south, 'getDAValues', async () => [goodTimeValue('daItem1', 42)]);
        const addContent = mock.method(south, 'addContent', async () => undefined);
        southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['daId1', 30]));

        await south.directQuery([item]);

        assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], { type: 'record-list', content: [goodTimeValue('daItem1', 42)] });
        assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [item]);
        assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
          { itemId: 'daId1', value: 42, instant: testData.constants.dates.FAKE_NOW }
        ]);
      });

      it('should compute a percentage-of-span threshold correctly, caching one item and suppressing another', async () => {
        // rangeLow=0, rangeHigh=100 -> span=100; threshold=10% -> 10 absolute units
        const thresholdSettings = {
          cachingStrategy: 'threshold',
          thresholdType: 'percentage',
          threshold: 10,
          rangeLow: 0,
          rangeHigh: 100
        } as const;
        const overItem = buildDaItem('daId1', 'daItem1', thresholdSettings);
        const underItem = buildDaItem('daId2', 'daItem2', thresholdSettings);
        mock.method(south, 'getDAValues', async () => [goodTimeValue('daItem1', 42), goodTimeValue('daItem2', 25)]);
        const addContent = mock.method(south, 'addContent', async () => undefined);
        southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['daId1', 20], ['daId2', 20]));

        await south.directQuery([overItem, underItem]);

        assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], { type: 'record-list', content: [goodTimeValue('daItem1', 42)] });
        assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [overItem]);
      });

      it('should cache when maxCachingInterval elapses even without a qualifying change', async () => {
        const item = buildDaItem('daId1', 'daItem1', { cachingStrategy: 'onChange', maxCachingInterval: 1000 });
        mock.method(south, 'getDAValues', async () => [goodTimeValue('daItem1', 42)]);
        const addContent = mock.method(south, 'addContent', async () => undefined);
        // Identical value (no onChange-qualifying diff), but the cached instant is far in the past.
        southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['daId1', 42]));

        await south.directQuery([item]);

        assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], { type: 'record-list', content: [goodTimeValue('daItem1', 42)] });
      });

      it('should always cache the very first read for an item regardless of strategy', async () => {
        const item = buildDaItem('daId1', 'daItem1', { cachingStrategy: 'onChange' });
        mock.method(south, 'getDAValues', async () => [goodTimeValue('daItem1', 42)]);
        const addContent = mock.method(south, 'addContent', async () => undefined);
        // getItemsLastValues default mock returns an empty Map (no prior cached state)

        await south.directQuery([item]);

        assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], { type: 'record-list', content: [goodTimeValue('daItem1', 42)] });
      });

      it('should call saveItemsLastValues with exactly the items actually cached in the cycle', async () => {
        const suppressedItem = buildDaItem('daId1', 'daItem1', { cachingStrategy: 'onChange' });
        const cachedItem = buildDaItem('daId2', 'daItem2', { cachingStrategy: 'onChange' });
        mock.method(south, 'getDAValues', async () => [goodTimeValue('daItem1', 42), goodTimeValue('daItem2', 7)]);
        mock.method(south, 'addContent', async () => undefined);
        southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['daId1', 42], ['daId2', 1]));

        await south.directQuery([suppressedItem, cachedItem]);

        assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments, [
          'southId',
          [{ itemId: 'daId2', value: 7, instant: testData.constants.dates.FAKE_NOW }]
        ]);
      });
    });

    describe('polling/HA query path (getHAValues)', () => {
      const singleRoundTripSession = (pointValue: string) =>
        createMock<ClientSession>({
          historyRead: () => historyReadResponse([stringDataValue(pointValue, testData.constants.dates.FAKE_NOW)])
        });

      beforeEach(() => {
        utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation(() => '42');
      });

      it('should suppress a no-change value under cachingStrategy=onChange', async () => {
        const item = buildHaItem('haId1', 'haItem1', { cachingStrategy: 'onChange' });
        const addContent = mock.method(south, 'addContent', async () => undefined);
        southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['haId1', '42']));

        await south.getHAValues(
          [item],
          testData.constants.dates.FAKE_NOW,
          testData.constants.dates.FAKE_NOW,
          singleRoundTripSession('42'),
          false
        );

        assert.strictEqual(addContent.mock.calls.length, 1);
        assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], { type: 'record-list', content: [] });
        assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], []);
        assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments, ['southId', []]);
      });

      it('should always cache the very first read for an item regardless of strategy', async () => {
        const item = buildHaItem('haId1', 'haItem1', { cachingStrategy: 'onChange' });
        const addContent = mock.method(south, 'addContent', async () => undefined);
        // getItemsLastValues default mock returns an empty Map (no prior cached state)

        await south.getHAValues(
          [item],
          testData.constants.dates.FAKE_NOW,
          testData.constants.dates.FAKE_NOW,
          singleRoundTripSession('42'),
          false
        );

        assert.strictEqual((addContent.mock.calls[0].arguments[0]?.content as Array<unknown>).length, 1);
        assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [item]);
      });
    });

    describe('subscription path (never wrote to south_item_cache before this feature)', () => {
      it('should suppress a no-change value at push time (never buffered, addContent not called for it)', async () => {
        const { stream } = mockSubscription();
        const item = buildHaItem('subId1', 'subItem1', { cachingStrategy: 'onChange' });
        southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['subId1', 'parsedValue']));

        await south.subscribe([item]);
        utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation(() => 'parsedValue');
        stream.emit('changed', {
          value: { value: 1, dataType: DataType.Null },
          sourceTimestamp: DateTime.now(),
          statusCode: StatusCodes.Good
        });

        assert.deepStrictEqual(south['bufferedValues'], []);
      });

      it('should cache a changed value at push time and persist it via saveItemsLastValues on flush', async () => {
        const { stream } = mockSubscription();
        const item = buildHaItem('subId1', 'subItem1', { cachingStrategy: 'onChange' });
        // No prior cached state: first value is always cached regardless of strategy.

        await south.subscribe([item]);
        utilsOpcuaExports.parseOPCUAValue.mock.mockImplementation(() => 'parsedValue');
        stream.emit('changed', {
          value: { value: 1, dataType: DataType.Null },
          sourceTimestamp: DateTime.now(),
          statusCode: StatusCodes.Good
        });

        assert.strictEqual(south['bufferedValues'].length, 1);
        assert.strictEqual(south['bufferedValues'][0].item, item);

        const addContent = mock.method(south, 'addContent', async () => undefined);
        await south.flushMessages();

        assert.strictEqual(addContent.mock.calls.length, 1);
        assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [item]);
        assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments, [
          'southId',
          [{ itemId: 'subId1', value: 'parsedValue', instant: testData.constants.dates.FAKE_NOW }]
        ]);
      });
    });
  });

  it('discover should flatten a recursive walk into one record per Variable, never descending into a Variable itself', async () => {
    const browseForDiscovery = mock.method(south, 'browseForDiscovery', async (parentId: string | null) => {
      if (parentId === null) {
        return [
          { id: 'ns=1;s=Folder', name: 'Folder', metadata: { nodeId: 'ns=1;s=Folder', type: 'Object' }, hasChildren: true },
          {
            id: 'ns=1;s=Temperature',
            name: 'Temperature',
            metadata: { nodeId: 'ns=1;s=Temperature', type: 'Variable' },
            hasChildren: true
          }
        ];
      }
      if (parentId === 'ns=1;s=Folder') {
        return [
          {
            id: 'ns=1;s=Folder.Pressure',
            name: 'Pressure',
            metadata: { nodeId: 'ns=1;s=Folder.Pressure', type: 'Variable' },
            hasChildren: false
          }
        ];
      }
      // Would only be reached if discover() incorrectly descended into a Variable's own properties.
      throw new Error(`unexpected browseForDiscovery(${parentId})`);
    });

    const records = await south.discover({ rootNodeId: null });

    // Depth-first: the root's first entry (the folder) is fully walked — pushing its Pressure leaf —
    // before the loop moves on to the root's second entry (Temperature).
    assert.deepStrictEqual(records, [
      // `path` is relative to the discovery root, so that two Variables of the same name in different folders differ
      { id: 'ns=1;s=Folder.Pressure', name: 'Pressure', path: 'Folder/Pressure', nodeId: 'ns=1;s=Folder.Pressure', type: 'Variable' },
      { id: 'ns=1;s=Temperature', name: 'Temperature', path: 'Temperature', nodeId: 'ns=1;s=Temperature', type: 'Variable' }
    ]);
    // The fields the manifest tells the user about
    assert.ok(records.every(record => Object.keys(record).every(field => manifest.discovery!.recordFields!.includes(field))));
    assert.strictEqual(browseForDiscovery.mock.calls.length, 2);
  });

  it('discover should record a picked Variable itself and walk a picked folder, paths starting with its name', async () => {
    const readNodesForDiscovery = mock.method(south, 'readNodesForDiscovery', async (): Promise<Array<SouthConnectorExploreEntry>> => [
      { id: 'ns=1;s=Flow', name: 'Flow', metadata: { nodeId: 'ns=1;s=Flow', type: 'Variable', unit: 'L/min' }, hasChildren: true },
      { id: 'ns=1;s=Pumps', name: 'Pumps', metadata: { nodeId: 'ns=1;s=Pumps', type: 'Object' }, hasChildren: true }
    ]);
    const browseForDiscovery = mock.method(south, 'browseForDiscovery', async (): Promise<Array<SouthConnectorExploreEntry>> => [
      { id: 'ns=1;s=Pumps.Speed', name: 'Speed', metadata: { nodeId: 'ns=1;s=Pumps.Speed', type: 'Variable' }, hasChildren: true },
      // picked as well: recorded once
      { id: 'ns=1;s=Flow', name: 'Flow', metadata: { nodeId: 'ns=1;s=Flow', type: 'Variable', unit: 'L/min' }, hasChildren: true }
    ]);

    const records = await south.discover({ nodeIds: ['ns=1;s=Flow', 'ns=1;s=Pumps'], rootNodeId: 'ignored' });

    assert.deepStrictEqual(readNodesForDiscovery.mock.calls[0].arguments, [['ns=1;s=Flow', 'ns=1;s=Pumps']]);
    assert.deepStrictEqual(browseForDiscovery.mock.calls[0].arguments, ['ns=1;s=Pumps']);
    assert.deepStrictEqual(records, [
      { id: 'ns=1;s=Flow', name: 'Flow', path: 'Flow', nodeId: 'ns=1;s=Flow', type: 'Variable', unit: 'L/min' },
      { id: 'ns=1;s=Pumps.Speed', name: 'Speed', path: 'Pumps/Speed', nodeId: 'ns=1;s=Pumps.Speed', type: 'Variable' }
    ]);
  });

  it('readNodesForDiscovery should read the picked nodes name and class, and the static metadata of the Variables', async () => {
    const { read, answerRead, session } = mockAddressSpace(1);
    read.mock.mockImplementation(async (arg: unknown) => {
      const nodes = arg as Array<{ nodeId: string; attributeId: number }>;
      if (nodes.some(node => node.attributeId === AttributeIds.NodeClass)) {
        return nodes.map(({ nodeId, attributeId }) =>
          attributeId === AttributeIds.NodeClass
            ? { statusCode: { value: 0 }, value: { value: nodeId === 'ns=1;s=V0' ? NodeClass.Variable : NodeClass.Object } }
            : { statusCode: { value: 0 }, value: { value: { text: `${nodeId} name` } } }
        );
      }
      return answerRead(arg);
    });
    mock.method(south, 'createSession', async () => session);
    await south.connect();

    const entries = await south.readNodesForDiscovery(['ns=1;s=V0', 'ns=1;s=Folder']);

    assert.deepStrictEqual(entries, [
      {
        id: 'ns=1;s=V0',
        name: 'ns=1;s=V0 name',
        metadata: { nodeId: 'ns=1;s=V0', type: 'Variable', description: 'ns=1;s=V0 description', unit: 'bar', min: 0, max: 10 },
        hasChildren: true
      },
      { id: 'ns=1;s=Folder', name: 'ns=1;s=Folder name', metadata: { nodeId: 'ns=1;s=Folder', type: 'Object' }, hasChildren: true }
    ]);
  });

  it('readNodesForDiscovery should fail on a picked node that does not exist', async () => {
    const { read, session } = mockAddressSpace(0);
    read.mock.mockImplementation(async (arg: unknown) =>
      (arg as Array<unknown>).map(() => ({ statusCode: { value: 0x80340000, name: 'BadNodeIdUnknown' }, value: { value: null } }))
    );
    mock.method(south, 'createSession', async () => session);
    await south.connect();

    await assert.rejects(south.readNodesForDiscovery(['ns=1;s=Gone']), new Error('Node ns=1;s=Gone could not be read: BadNodeIdUnknown'));
  });

  it('discover should default to browsing from the root when the scope has no rootNodeId', async () => {
    const browseForDiscovery = mock.method(south, 'browseForDiscovery', async () => []);

    await south.discover({});

    assert.strictEqual(browseForDiscovery.mock.calls[0].arguments[0], null);
  });

  it('discover should start from the configured rootNodeId', async () => {
    const browseForDiscovery = mock.method(south, 'browseForDiscovery', async () => []);

    await south.discover({ rootNodeId: 'ns=1;s=CustomRoot' });

    assert.strictEqual(browseForDiscovery.mock.calls[0].arguments[0], 'ns=1;s=CustomRoot');
  });

  it('discover should return an empty array for an empty subtree', async () => {
    mock.method(south, 'browseForDiscovery', async () => []);

    const records = await south.discover({ rootNodeId: 'ns=1;s=Empty' });

    assert.deepStrictEqual(records, []);
  });

  it('discover should record static metadata (description, unit, range) but never read live values, unlike explore', async () => {
    const { browse, read, session } = mockAddressSpace(1);
    mock.method(south, 'createSession', async () => session);
    await south.connect();

    const records = await south.discover({ rootNodeId: 'ns=1;s=Folder' });

    // No `value` - a monitored node's identity in the diff never depends on its live value, which would
    // otherwise change on every single run. Static metadata, on the other hand, is exactly what the diff
    // should notice changing.
    assert.deepStrictEqual(records, [
      {
        id: 'ns=1;s=V0',
        name: 'ns=1;s=V0',
        path: 'ns=1;s=V0',
        nodeId: 'ns=1;s=V0',
        type: 'Variable',
        description: 'ns=1;s=V0 description',
        unit: 'bar',
        min: 0,
        max: 10
      }
    ]);
    const readAttributes = read.mock.calls.flatMap(call => call.arguments[0] as Array<{ nodeId: string; attributeId: number }>);
    assert.ok(!readAttributes.some(node => node.nodeId === 'ns=1;s=V0' && node.attributeId === AttributeIds.Value));
    // 1 folder browse + 1 batched property browse; the Variable itself is never walked into.
    assert.strictEqual(browse.mock.calls.length, 2);
  });

  it('discover should fail the run, instead of silently dropping metadata, when a metadata request fails', async () => {
    const { read, session } = mockAddressSpace(1);
    read.mock.mockImplementation(async () => {
      throw new Error('BadTooManyOperations');
    });
    mock.method(south, 'createSession', async () => session);
    await south.connect();

    await assert.rejects(() => south.discover({ rootNodeId: 'ns=1;s=Folder' }), { message: 'BadTooManyOperations' });
  });

  it("should split metadata reads and browses into chunks within the server's advertised operation limits", async () => {
    opcuaExports.readOperationLimits.mock.mockImplementation(async () => ({ maxNodesPerRead: 4, maxNodesPerBrowse: 2 }));
    const { variableIds, browse, read, session } = mockAddressSpace(5);
    mock.method(south, 'createSession', async () => session);
    await south.connect();

    const entries = await south.explore('ns=1;s=Folder');

    // Every chunk respects its limit...
    for (const call of read.mock.calls) {
      assert.ok((call.arguments[0] as Array<unknown>).length <= 4);
    }
    const propertyBrowses = browse.mock.calls.filter(call => Array.isArray(call.arguments[0]));
    assert.deepStrictEqual(
      propertyBrowses.map(call => (call.arguments[0] as Array<string>).length),
      [2, 2, 1]
    );
    // 5 variables x (description + value) = 10 attributes in chunks of 4, then 10 properties in chunks of 4
    assert.strictEqual(read.mock.calls.length, 6);
    // ...and the results are still stitched back to the right variable, in order.
    assert.deepStrictEqual(
      entries.map(entry => [entry.id, entry.metadata.description, entry.metadata.unit, entry.metadata.max]),
      variableIds.map(nodeId => [nodeId, `${nodeId} description`, 'bar', 10])
    );
  });

  it('should read the operation limits once per session, not once per request', async () => {
    const { session } = mockAddressSpace(2);
    mock.method(south, 'createSession', async () => session);
    await south.connect();

    await south.explore('ns=1;s=Folder');
    await south.explore('ns=1;s=Folder');

    assert.strictEqual(opcuaExports.readOperationLimits.mock.calls.length, 1);
  });

  it('should fall back to a default batch size when the server limits are unreadable, unadvertised or unlimited (0)', async () => {
    const createSession = mock.method(south, 'createSession');
    for (const limits of [
      async () => {
        throw new Error('BadNodeIdUnknown');
      },
      async () => ({}),
      async () => ({ maxNodesPerRead: 0, maxNodesPerBrowse: 0 })
    ]) {
      opcuaExports.readOperationLimits.mock.mockImplementation(limits);
      const { read, browse, session } = mockAddressSpace(600);
      createSession.mock.mockImplementation(async () => session);
      await south.connect();

      await south.explore('ns=1;s=Folder');

      // 1200 description+value attributes -> 2 chunks of at most 1000; then 1200 properties -> 2 chunks
      assert.deepStrictEqual(
        read.mock.calls.map(call => (call.arguments[0] as Array<unknown>).length),
        [1000, 200, 1000, 200]
      );
      assert.strictEqual(browse.mock.calls.filter(call => Array.isArray(call.arguments[0])).length, 1);
    }
  });
});
