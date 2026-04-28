import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import nodeOPCUAMock from '../../tests/__mocks__/node-opcua.mock';
import { DataType, StatusCodes, SecurityPolicy, AttributeIds } from 'node-opcua';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, asLogger, buildNorthEntity, seq } from '../../tests/utils/test-utils';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import type { NorthOPCUASettings } from '../../../shared/model/north-settings.model';
import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type { OIBusOPCUAValue } from '../../transformers/connector-types.model';
import type { ClientSession } from 'node-opcua';
import type NorthOPCUAClass from './north-opcua';

const nodeRequire = createRequire(import.meta.url);

const resolveNodeIdMock = mock.fn((id: unknown) => id);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OPCUACertificateManagerMock = mock.fn(function (this: any) {
  this.state = 0;
});

const nodeOpcuaExports = {
  __esModule: true,
  ...nodeOPCUAMock,
  DataType,
  StatusCodes,
  SecurityPolicy,
  AttributeIds,
  resolveNodeId: resolveNodeIdMock,
  OPCUACertificateManager: OPCUACertificateManagerMock
};

const opcuaOptions = {
  applicationName: 'OIBus',
  clientName: 'connectorName-connectorId',
  connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
  securityMode: 1,
  securityPolicy: 'none',
  endpointMustExist: false,
  keepSessionAlive: false
};
const opcuaUserIdentity = { type: 0 };

describe('NorthOPCUA', () => {
  let NorthOPCUA: typeof NorthOPCUAClass;
  let north: NorthOPCUAClass;
  let configuration: NorthConnectorEntity<NorthOPCUASettings>;
  let mockSession: ClientSession;

  const logger = new PinoLogger();
  const cacheService = new CacheServiceMock();
  const oiBusTransformer = new OIBusTransformerMock();

  const createSessionConfigsFn = mock.fn(() => ({ options: opcuaOptions, userIdentity: opcuaUserIdentity }));
  const initOPCUACertificateFoldersFn = mock.fn(async () => undefined);
  const streamToStringFn = mock.fn(async () => '[]');

  const transformerExports = {
    createTransformer: mock.fn(() => oiBusTransformer)
  };

  const utilsExports = {
    streamToString: streamToStringFn,
    checkAge: mock.fn(() => true),
    compress: mock.fn(async () => undefined),
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => []),
    groupItemsByGroup: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' }))
  };

  const utilsOpcuaExports = {
    createSessionConfigs: createSessionConfigsFn,
    initOPCUACertificateFolders: initOPCUACertificateFoldersFn
  };

  before(() => {
    mockModule(nodeRequire, 'node-opcua', nodeOpcuaExports);
    // crypto is used with randomUUID — mock via mock.method in beforeEach
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/utils-opcua', utilsOpcuaExports);
    mockModule(nodeRequire, '../../service/transformer.service', transformerExports);
    mockModule(nodeRequire, '../../service/cache/cache.service', {
      __esModule: true,
      default: function () {
        return cacheService;
      }
    });
    NorthOPCUA = reloadModule<{ default: typeof NorthOPCUAClass }>(nodeRequire, './north-opcua').default;
  });

  beforeEach(() => {
    // Reset all mock calls
    resolveNodeIdMock.mock.resetCalls();
    resolveNodeIdMock.mock.mockImplementation((id: unknown) => id);

    OPCUACertificateManagerMock.mock.resetCalls();

    createSessionConfigsFn.mock.resetCalls();
    createSessionConfigsFn.mock.mockImplementation(() => ({ options: opcuaOptions, userIdentity: opcuaUserIdentity }));

    initOPCUACertificateFoldersFn.mock.resetCalls();
    initOPCUACertificateFoldersFn.mock.mockImplementation(async () => undefined);

    streamToStringFn.mock.resetCalls();
    streamToStringFn.mock.mockImplementation(async () => '[]');

    transformerExports.createTransformer.mock.resetCalls();
    transformerExports.createTransformer.mock.mockImplementation(() => oiBusTransformer);

    nodeOPCUAMock.OPCUAClient.createSession.mock.resetCalls();
    nodeOPCUAMock.OPCUAClient.createSession.mock.mockImplementation(async () => mockSession);

    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();

    // Mock node:fs/promises methods in-place so the SUT's imported fs object is intercepted
    mock.method(fs, 'rm', async () => undefined);

    // Mock crypto.randomUUID in-place
    mock.method(nodeRequire('crypto'), 'randomUUID', () => 'randomUUID');

    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });

    configuration = buildNorthEntity<NorthOPCUASettings>('opcua', {
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      authentication: { type: 'none', password: null },
      securityMode: 'none',
      securityPolicy: 'none',
      keepSessionAlive: false
    });

    mockSession = {
      close: mock.fn(async () => undefined),
      read: mock.fn(async () => ({})),
      write: mock.fn(async () => ({ isGood: () => true, name: 'Good' }))
    } as unknown as ClientSession;

    // Re-apply createSession to pick up the new mockSession
    nodeOPCUAMock.OPCUAClient.createSession.mock.mockImplementation(async () => mockSession);

    north = new NorthOPCUA(configuration, asLogger(logger), cacheService);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should return correct types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['opcua']);
  });

  it('should be properly initialized', async () => {
    await north.start();
    assert.strictEqual(initOPCUACertificateFoldersFn.mock.calls.length, 1);
    assert.deepStrictEqual(initOPCUACertificateFoldersFn.mock.calls[0].arguments[0], 'cache');
  });

  it('should be properly initialized without initialising opcua certificate', async () => {
    // Simulate already-initialized certificate manager
    (north as unknown as { clientCertificateManager: object })['clientCertificateManager'] = {};
    await north.start();
    assert.strictEqual(initOPCUACertificateFoldersFn.mock.calls.length, 1);
    assert.deepStrictEqual(initOPCUACertificateFoldersFn.mock.calls[0].arguments[0], 'cache');
    // OPCUACertificateManager constructor should NOT be called again
    assert.strictEqual(OPCUACertificateManagerMock.mock.calls.length, 0);
  });

  it('should properly connect', async () => {
    (north as unknown as { reconnectTimeout: NodeJS.Timeout | null })['reconnectTimeout'] = setTimeout(() => null);
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.connect();

    assert.strictEqual(createSessionConfigsFn.mock.calls.length, 1);
    assert.strictEqual(nodeOPCUAMock.OPCUAClient.createSession.mock.calls.length, 1);
    assert.ok(logger.info.mock.calls.some(c => (c.arguments[0] as string).includes('connected')));
    // reconnectTimeout cleared — should be null after successful connect
    assert.strictEqual((north as unknown as { reconnectTimeout: null })['reconnectTimeout'], null);
    assert.strictEqual(disconnectMock.mock.calls.length, 0);
  });

  it('should handle connection error and trigger reconnect', async () => {
    const error = new Error('Session creation failed');
    nodeOPCUAMock.OPCUAClient.createSession.mock.mockImplementationOnce(async () => {
      throw error;
    });
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.connect();

    assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'Error while connecting to the OPCUA server: Session creation failed'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    // reconnect timeout should be set
    assert.notStrictEqual((north as unknown as { reconnectTimeout: NodeJS.Timeout | null })['reconnectTimeout'], null);
  });

  it('should not reconnect if disconnecting', async () => {
    nodeOPCUAMock.OPCUAClient.createSession.mock.mockImplementationOnce(async () => {
      throw new Error('Fail');
    });
    (north as unknown as { disconnecting: boolean })['disconnecting'] = true;
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.connect();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    // No reconnect timeout set because disconnecting is true
    assert.strictEqual((north as unknown as { reconnectTimeout: null })['reconnectTimeout'], null);
  });

  it('should properly disconnect', async () => {
    (north as unknown as { client: ClientSession })['client'] = mockSession;
    (north as unknown as { reconnectTimeout: NodeJS.Timeout | null })['reconnectTimeout'] = setTimeout(() => null);

    await north.disconnect();

    assert.strictEqual((mockSession.close as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.strictEqual((north as unknown as { client: null })['client'], null);
  });

  it('should throw error if connector is in reconnecting state', async () => {
    (north as unknown as { reconnectTimeout: NodeJS.Timeout | null })['reconnectTimeout'] = setTimeout(() => null);
    const readStream = {} as ReadStream;

    await assert.rejects(
      async () =>
        north.handleContent(readStream, {
          contentFile: 'file.json',
          contentSize: 100,
          numberOfElement: 1,
          createdAt: '2020-02-02T02:02:02.222Z',
          contentType: 'opcua'
        }),
      /Connector is reconnecting\.\.\./
    );
  });

  it('should throw error if client is not set', async () => {
    const values: Array<OIBusOPCUAValue> = [
      { nodeId: 'ns=1;s=Tag1', value: 123 },
      { nodeId: 'ns=1;s=Tag2', value: 456 }
    ];
    streamToStringFn.mock.mockImplementation(async () => JSON.stringify(values));
    const readStream = {} as ReadStream;

    await assert.rejects(
      async () =>
        north.handleContent(readStream, {
          contentFile: 'file.json',
          contentSize: 100,
          numberOfElement: 1,
          createdAt: '2020-02-02T02:02:02.222Z',
          contentType: 'opcua'
        }),
      /OPCUA client not set/
    );
  });

  it('should handle content success', async () => {
    const values: Array<OIBusOPCUAValue> = [
      { nodeId: 'ns=1;s=Tag1', value: 123 },
      { nodeId: 'ns=1;s=Tag2', value: 456 },
      { nodeId: 'ns=1;s=Tag3', value: 789 },
      { nodeId: 'ns=1;s=Tag4', value: 111 }
    ];
    streamToStringFn.mock.mockImplementation(async () => JSON.stringify(values));

    // Tag1: returns {value: 'bad'} → dataValue.value = 'bad', dataValue.value.value = undefined → "Could not read DataType"
    // Tag2: returns value but DataType string not in enum → "Invalid data type"
    // Tag3: valid DataType.Double but write fails
    // Tag4: valid DataType.Double and write succeeds
    const readMock = mockSession.read as ReturnType<typeof mock.fn>;
    readMock.mock.mockImplementation(
      seq(
        async () => ({ value: 'bad' }),
        async () => ({ value: { value: { value: 'Bad' } } }),
        async () => ({ value: { value: { value: DataType.Double } } }),
        async () => ({ value: { value: { value: DataType.Double } } })
      )
    );

    const writeMock = mockSession.write as ReturnType<typeof mock.fn>;
    writeMock.mock.mockImplementation(
      seq(
        async () => ({ isGood: () => false, name: 'Bad' }),
        async () => ({ isGood: () => true, name: 'Good' })
      )
    );

    (north as unknown as { client: ClientSession })['client'] = mockSession;
    const readStream = {} as ReadStream;

    await north.handleContent(readStream, {
      contentFile: 'file.json',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'opcua'
    });

    // Tag1: read called with correct args
    assert.deepStrictEqual(readMock.mock.calls[0].arguments[0], { nodeId: 'ns=1;s=Tag1', attributeId: AttributeIds.DataType });

    // Tag4: write called with correct args (second write call, index 1)
    assert.deepStrictEqual(writeMock.mock.calls[1].arguments[0], {
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
    const values = [{ nodeId: 'bad-node', value: 123 }];
    streamToStringFn.mock.mockImplementation(async () => JSON.stringify(values));

    resolveNodeIdMock.mock.mockImplementationOnce(() => {
      throw new Error('BadNodeId');
    });

    (north as unknown as { client: ClientSession })['client'] = mockSession;
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.handleContent({} as ReadStream, {
      contentFile: 'f',
      contentSize: 0,
      numberOfElement: 0,
      createdAt: '',
      contentType: 'opcua'
    });

    assert.ok(logger.error.mock.calls.some(c => (c.arguments[0] as string).includes('Error when parsing node ID')));
    assert.strictEqual(disconnectMock.mock.calls.length, 0);
  });

  it('should handle write error without disconnecting', async () => {
    const values = [{ nodeId: 'bad-node', value: 123 }];
    streamToStringFn.mock.mockImplementation(async () => JSON.stringify(values));

    const readMock = mockSession.read as ReturnType<typeof mock.fn>;
    readMock.mock.mockImplementation(async () => {
      throw new Error('BadNodeId');
    });
    (north as unknown as { client: ClientSession })['client'] = mockSession;
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.handleContent({} as ReadStream, {
      contentFile: 'f',
      contentSize: 0,
      numberOfElement: 0,
      createdAt: '',
      contentType: 'opcua'
    });

    assert.ok(logger.error.mock.calls.some(c => (c.arguments[0] as string).includes('Write error on node ID "bad-node": BadNodeId')));
    assert.strictEqual(disconnectMock.mock.calls.length, 0);
  });

  it('should handle critical errors and trigger reconnect', async () => {
    const values = [{ nodeId: 'tag1', value: 123 }];
    streamToStringFn.mock.mockImplementation(async () => JSON.stringify(values));

    const readMock = mockSession.read as ReturnType<typeof mock.fn>;
    readMock.mock.mockImplementation(async () => {
      throw new Error('Connection Lost');
    });

    (north as unknown as { client: ClientSession })['client'] = mockSession;
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await assert.rejects(
      async () =>
        north.handleContent({} as ReadStream, {
          contentFile: 'f',
          contentSize: 0,
          numberOfElement: 0,
          createdAt: '',
          contentType: 'opcua'
        }),
      /Connection Lost/
    );

    assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'Unexpected OPCUA error: Connection Lost'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    // reconnect timeout should be set
    assert.notStrictEqual((north as unknown as { reconnectTimeout: NodeJS.Timeout | null })['reconnectTimeout'], null);
  });

  it('should properly test connection', async () => {
    const mockSessionClose = mock.fn(async () => undefined);
    nodeOPCUAMock.OPCUAClient.createSession.mock.mockImplementation(async () => ({ close: mockSessionClose }));

    await north.testConnection();

    assert.strictEqual(initOPCUACertificateFoldersFn.mock.calls.length, 1);
    assert.ok((initOPCUACertificateFoldersFn.mock.calls[0].arguments[0] as string).includes('opcua-test-'));
    assert.strictEqual(nodeOPCUAMock.OPCUAClient.createSession.mock.calls.length, 1);
    assert.strictEqual(mockSessionClose.mock.calls.length, 1);
    assert.strictEqual((fs.rm as ReturnType<typeof mock.fn>).mock.calls.length, 1);
  });

  it('should throw error if test fails', async () => {
    nodeOPCUAMock.OPCUAClient.createSession.mock.mockImplementation(async () => {
      throw new Error('Auth failed');
    });

    await assert.rejects(async () => north.testConnection(), /Auth failed/);
    // cleanup should still be called even on error
    assert.strictEqual((fs.rm as ReturnType<typeof mock.fn>).mock.calls.length, 1);
  });
});
