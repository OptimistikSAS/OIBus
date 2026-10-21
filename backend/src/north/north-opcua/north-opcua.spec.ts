import assert from 'node:assert/strict';
import type { ReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { ClientSession, OPCUAClient } from 'node-opcua';
// The enums come from the node-opcua sub-packages: loading the whole node-opcua costs ~0.7 s
import { AttributeIds } from 'node-opcua-data-model';
import { StatusCodes } from 'node-opcua-status-code';
import { MessageSecurityMode, UserTokenType } from 'node-opcua-types';
import { DataType } from 'node-opcua-variant';

import type { NorthOPCUASettings } from '../../../shared/model/connector/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/domain/engine.model';

import type * as Utils from '../../service/utils';
import { createCacheServiceMock } from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { buildNorthEntity, createMock, mockModule, reloadModule, seq } from '../../tests/utils/test-utils';
import type { OIBusOPCUAValue } from '../../transformers/connector-types.model';
import type NorthOPCUAClass from './north-opcua';

const nodeRequire = createRequire(import.meta.url);

// The stream is only handed to the (mocked) streamToString
const readStream = {} as ReadStream;
const metadata: CacheMetadata = {
  contentFile: 'file.json',
  contentSize: 100,
  numberOfElement: 1,
  createdAt: '2020-02-02T02:02:02.222Z',
  contentType: 'opcua'
};

type AsyncMock = Mock<(...args: Array<unknown>) => Promise<unknown>>;

describe('NorthOPCUA', () => {
  let NorthOPCUA: typeof NorthOPCUAClass;
  let north: NorthOPCUAClass;
  let logger: PinoLogger;
  let session: ClientSession;
  let sessionClose: AsyncMock;
  let sessionRead: AsyncMock;
  let sessionWrite: AsyncMock;
  let createSessionConfigs: AsyncMock;
  let createOPCUASession: AsyncMock;
  let resolveNodeId: Mock<(id: unknown) => unknown>;
  let createOPCUAClient: Mock<() => unknown>;
  let streamToString: Mock<typeof Utils.streamToString>;

  // Real enums, mocked client and node id resolution
  const nodeOpcuaExports: Record<string, unknown> = {
    __esModule: true,
    AttributeIds,
    DataType,
    MessageSecurityMode,
    StatusCodes,
    UserTokenType
  };
  const utilsOpcuaExports: Record<string, unknown> = {};
  const utilsExports: typeof Utils = { ...nodeRequire('../../service/utils') };

  before(() => {
    mockModule(nodeRequire, 'node-opcua', nodeOpcuaExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/utils-opcua', utilsOpcuaExports);
    // No transformation here: don't pay for loading every transformer
    mockModule(nodeRequire, '../../service/transformer.service', {});
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    NorthOPCUA = reloadModule<{ default: typeof NorthOPCUAClass }>(nodeRequire, './north-opcua').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    sessionClose = mock.fn(async () => undefined);
    sessionRead = mock.fn(async () => ({}));
    sessionWrite = mock.fn(async () => ({ isGood: () => true, name: 'Good' }));
    session = createMock<ClientSession>({ close: sessionClose, read: sessionRead, write: sessionWrite });
    createSessionConfigs = mock.fn(async () => ({ options: {}, userIdentity: {} }));
    createOPCUASession = mock.fn(async () => session);
    resolveNodeId = mock.fn((id: unknown) => id);
    createOPCUAClient = mock.fn(() => null);
    streamToString = mock.fn(async () => '[]');

    Object.assign(nodeOpcuaExports, { resolveNodeId, OPCUAClient: { create: createOPCUAClient } });
    Object.assign(utilsOpcuaExports, { createSessionConfigs, createOPCUASession });
    // delay: super.connect() waits for runMinDelay before checking the cache, and setTimeout is mocked
    Object.assign(utilsExports, { streamToString, delay: async () => undefined });
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });

    north = new NorthOPCUA(
      buildNorthEntity<NorthOPCUASettings>('opcua', {
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        retryInterval: 10000,
        authentication: { type: 'none', password: null },
        securityMode: 'none',
        securityPolicy: 'none',
        keepSessionAlive: false
      }),
      createCacheServiceMock()
    );
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  /** Makes handleContent read these values and write them with the mocked session */
  const prepareContent = (values: Array<OIBusOPCUAValue>) => {
    streamToString.mock.mockImplementation(async () => JSON.stringify(values));
    north.client = session;
  };

  /** Makes testConnection discover these endpoints */
  const mockEndpoints = (endpoints: Array<unknown>) => {
    const endpointClient = createMock<OPCUAClient>({ getEndpoints: async () => endpoints });
    createOPCUAClient.mock.mockImplementation(() => endpointClient);
    return endpointClient;
  };

  it('should return correct types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['opcua']);
  });

  it('should properly connect', async () => {
    north['reconnectTimeout'] = setTimeout(() => null);
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.connect();

    assert.strictEqual(createSessionConfigs.mock.calls.length, 1);
    assert.strictEqual(createOPCUASession.mock.calls.length, 1);
    assert.ok(logger.info.mock.calls.some(c => (c.arguments[0] as string).includes('connected')));
    // reconnectTimeout cleared — should be null after successful connect
    assert.strictEqual(north['reconnectTimeout'], null);
    assert.strictEqual(disconnectMock.mock.calls.length, 0);
  });

  it('should handle connection error and trigger reconnect', async () => {
    createOPCUASession.mock.mockImplementationOnce(async () => {
      throw new Error('Session creation failed');
    });
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.connect();

    assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'Error while connecting to the OPCUA server: Session creation failed'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    // reconnect timeout should be set
    assert.notStrictEqual(north['reconnectTimeout'], null);
  });

  it('should not reconnect if disconnecting', async () => {
    createOPCUASession.mock.mockImplementationOnce(async () => {
      throw new Error('Fail');
    });
    north['disconnecting'] = true;
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.connect();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    // No reconnect timeout set because disconnecting is true
    assert.strictEqual(north['reconnectTimeout'], null);
  });

  it('should properly disconnect', async () => {
    north.client = session;
    north['reconnectTimeout'] = setTimeout(() => null);

    await north.disconnect();

    assert.strictEqual(sessionClose.mock.calls.length, 1);
    assert.strictEqual(north.client, null);
  });

  it('should throw error if connector is in reconnecting state', async () => {
    north['reconnectTimeout'] = setTimeout(() => null);

    await assert.rejects(north.handleContent(readStream, metadata), /Connector is reconnecting\.\.\./);
  });

  it('should throw error if client is not set', async () => {
    prepareContent([
      { nodeId: 'ns=1;s=Tag1', value: 123 },
      { nodeId: 'ns=1;s=Tag2', value: 456 }
    ]);
    north.client = null;

    await assert.rejects(north.handleContent(readStream, metadata), /OPCUA client not set/);
  });

  it('should handle content success', async () => {
    prepareContent([
      { nodeId: 'ns=1;s=Tag1', value: 123 },
      { nodeId: 'ns=1;s=Tag2', value: 456 },
      { nodeId: 'ns=1;s=Tag3', value: 789 },
      { nodeId: 'ns=1;s=Tag4', value: 111 }
    ]);
    // Tag1: returns {value: 'bad'} → dataValue.value = 'bad', dataValue.value.value = undefined → "Could not read DataType"
    // Tag2: returns value but DataType string not in enum → "Invalid data type"
    // Tag3: valid DataType.Double but write fails
    // Tag4: valid DataType.Double and write succeeds
    sessionRead.mock.mockImplementation(
      seq<Promise<{ value: unknown }>>(
        async () => ({ value: 'bad' }),
        async () => ({ value: { value: { value: 'Bad' } } }),
        async () => ({ value: { value: { value: DataType.Double } } }),
        async () => ({ value: { value: { value: DataType.Double } } })
      )
    );
    sessionWrite.mock.mockImplementation(
      seq(
        async () => ({ isGood: () => false, name: 'Bad' }),
        async () => ({ isGood: () => true, name: 'Good' })
      )
    );

    await north.handleContent(readStream, metadata);

    // Tag1: read called with correct args
    assert.deepStrictEqual(sessionRead.mock.calls[0].arguments[0], { nodeId: 'ns=1;s=Tag1', attributeId: AttributeIds.DataType });
    // Tag4: write called with correct args (second write call, index 1)
    assert.deepStrictEqual(sessionWrite.mock.calls[1].arguments[0], {
      nodeId: 'ns=1;s=Tag4',
      attributeId: AttributeIds.Value,
      value: { value: { dataType: DataType.Double, value: 111 } }
    });
    assert.ok(logger.error.mock.calls.some(c => (c.arguments[0] as string).includes('Could not read DataType for node ID "ns=1;s=Tag1"')));
    assert.ok(logger.error.mock.calls.some(c => (c.arguments[0] as string).includes('Invalid data type for node ID "ns=1;s=Tag2"')));
    assert.ok(
      logger.error.mock.calls.some(c => (c.arguments[0] as string).includes('Failed to write value "789" for node ID "ns=1;s=Tag3"'))
    );
    assert.ok(
      logger.trace.mock.calls.some(c => (c.arguments[0] as string).includes('Value "111" written successfully on node ID "ns=1;s=Tag4"'))
    );
  });

  it('should handle bad node IDs without disconnecting', async () => {
    prepareContent([{ nodeId: 'bad-node', value: 123 }]);
    resolveNodeId.mock.mockImplementationOnce(() => {
      throw new Error('BadNodeId');
    });
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.handleContent(readStream, metadata);

    assert.ok(logger.error.mock.calls.some(c => (c.arguments[0] as string).includes('Error when parsing node ID')));
    assert.strictEqual(disconnectMock.mock.calls.length, 0);
  });

  it('should handle write error without disconnecting', async () => {
    prepareContent([{ nodeId: 'bad-node', value: 123 }]);
    sessionRead.mock.mockImplementation(async () => {
      throw new Error('BadNodeId');
    });
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.handleContent(readStream, metadata);

    assert.ok(logger.error.mock.calls.some(c => (c.arguments[0] as string).includes('Write error on node ID "bad-node": BadNodeId')));
    assert.strictEqual(disconnectMock.mock.calls.length, 0);
  });

  it('should handle critical errors and trigger reconnect', async () => {
    prepareContent([{ nodeId: 'tag1', value: 123 }]);
    sessionRead.mock.mockImplementation(async () => {
      throw new Error('Connection Lost');
    });
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await assert.rejects(north.handleContent(readStream, metadata), /Connection Lost/);

    assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'Unexpected OPCUA error: Connection Lost'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    // reconnect timeout should be set
    assert.notStrictEqual(north['reconnectTimeout'], null);
  });

  it('should properly test connection', async () => {
    await north.testConnection();

    assert.strictEqual(createOPCUASession.mock.calls.length, 1);
    assert.strictEqual(sessionClose.mock.calls.length, 1);
  });

  it('should discover endpoints and populate security info in test connection', async () => {
    const endpointClient = mockEndpoints([
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
    ]);

    const result = await north.testConnection();

    assert.ok(result.items.some(item => item.key === 'SecurityModes'));
    assert.ok(result.items.some(item => item.key === 'SecurityPolicies'));
    assert.ok(result.items.some(item => item.key === 'AuthenticationModes'));
    assert.strictEqual(endpointClient.connect.mock.calls.length, 1);
    assert.strictEqual(endpointClient.getEndpoints.mock.calls.length, 1);
    assert.strictEqual(endpointClient.disconnect.mock.calls.length, 1);
  });

  it('should populate server build info items when dataValues report Good status', async () => {
    const buildInfoDate = new Date('2024-01-01T00:00:00.000Z');
    const good = (value: unknown) => ({ statusCode: { value: StatusCodes.Good.value }, value: { value } });
    sessionRead.mock.mockImplementation(async () => [
      good(0), // State -> Running
      good('Acme Corp'), // ManufacturerName
      good('OIBus Simulation Server'), // ProductName
      good(buildInfoDate), // SoftwareVersion (Date branch)
      good('42') // BuildNumber
    ]);

    const result = await north.testConnection();

    assert.deepStrictEqual(
      result.items.find(item => item.key === 'State'),
      { key: 'State', value: 'Running' }
    );
    assert.deepStrictEqual(
      result.items.find(item => item.key === 'ManufacturerName'),
      { key: 'ManufacturerName', value: 'Acme Corp' }
    );
    assert.deepStrictEqual(
      result.items.find(item => item.key === 'ProductName'),
      { key: 'ProductName', value: 'OIBus Simulation Server' }
    );
    assert.deepStrictEqual(
      result.items.find(item => item.key === 'SoftwareVersion'),
      { key: 'SoftwareVersion', value: buildInfoDate.toISOString() }
    );
    assert.deepStrictEqual(
      result.items.find(item => item.key === 'BuildNumber'),
      { key: 'BuildNumber', value: '42' }
    );
    assert.strictEqual(sessionRead.mock.calls.length, 1);
    assert.strictEqual(sessionClose.mock.calls.length, 1);
  });

  it('should fall back to raw value when server state is not in the known labels', async () => {
    // State -> unknown, falls back to String(raw)
    sessionRead.mock.mockImplementation(async () => [{ statusCode: { value: StatusCodes.Good.value }, value: { value: 42 } }]);

    const result = await north.testConnection();

    assert.deepStrictEqual(
      result.items.find(item => item.key === 'State'),
      { key: 'State', value: '42' }
    );
  });

  it('should still test the connection when the server build info cannot be read', async () => {
    sessionRead.mock.mockImplementation(async () => {
      throw new Error('BadNodeIdUnknown');
    });

    const result = await north.testConnection();

    const buildInfoKeys = ['State', 'ManufacturerName', 'ProductName', 'SoftwareVersion', 'BuildNumber'];
    assert.ok(!result.items.some(item => buildInfoKeys.includes(item.key)));
    assert.strictEqual(sessionRead.mock.calls.length, 1);
  });

  it('should fall back to raw values for endpoint discovery when security mode, policy uri and identity tokens are unmapped or missing', async () => {
    mockEndpoints([
      { securityMode: MessageSecurityMode.Invalid, securityPolicyUri: undefined, userIdentityTokens: undefined },
      { securityMode: MessageSecurityMode.None, securityPolicyUri: 'no-hash-policy-uri', userIdentityTokens: [{ tokenType: 99 }] }
    ]);

    const result = await north.testConnection();

    const securityModes = result.items.find(item => item.key === 'SecurityModes');
    assert.ok(securityModes?.value.includes(String(MessageSecurityMode.Invalid)));
    const securityPolicies = result.items.find(item => item.key === 'SecurityPolicies');
    assert.ok(securityPolicies?.value.includes('no-hash-policy-uri'));
    const authModes = result.items.find(item => item.key === 'AuthenticationModes');
    assert.ok(authModes?.value.includes('99'));
  });

  it('should throw error if test fails', async () => {
    createOPCUASession.mock.mockImplementation(async () => {
      throw new Error('Auth failed');
    });

    await assert.rejects(north.testConnection(), /Auth failed/);
  });
});
