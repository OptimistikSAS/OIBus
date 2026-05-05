import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ReadStream } from 'node:fs';
import EventEmitter from 'node:events';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, buildNorthEntity } from '../../tests/utils/test-utils';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import type { NorthMQTTSettings } from '../../../shared/model/north-settings.model';
import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type { OIBusMQTTValue } from '../../transformers/connector-types.model';
import type { MqttClient } from 'mqtt';
import type NorthMQTTClass from './north-mqtt';

const nodeRequire = createRequire(import.meta.url);

class MockMqttClient extends EventEmitter {
  connected = true;
  publishAsync = mock.fn(async () => undefined);
  end = mock.fn(() => undefined);
  removeAllListeners = mock.fn(() => this);
}

describe('NorthMQTT', () => {
  let NorthMQTT: typeof NorthMQTTClass;
  let north: NorthMQTTClass;
  let configuration: NorthConnectorEntity<NorthMQTTSettings>;
  let mockMqttClient: MockMqttClient;

  const logger = new PinoLogger();
  const cacheService = new CacheServiceMock();
  const oiBusTransformer = new OIBusTransformerMock();

  const connectAsyncFn = mock.fn(async (_url: string, ..._args: Array<unknown>) => mockMqttClient);
  const connectFn = mock.fn((_url: string) => mockMqttClient);
  const streamToStringFn = mock.fn(async () => '[]');
  const createConnectionOptionsFn = mock.fn(async (_id: string) => ({}));

  const mqttExports = {
    __esModule: true,
    default: {
      connectAsync: connectAsyncFn,
      connect: connectFn
    }
  };

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

  const utilsMqttExports = {
    createConnectionOptions: createConnectionOptionsFn
  };

  before(() => {
    mockModule(nodeRequire, 'mqtt', mqttExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/utils-mqtt', utilsMqttExports);
    mockModule(nodeRequire, '../../service/transformer.service', transformerExports);
    mockModule(nodeRequire, '../../service/cache/cache.service', {
      __esModule: true,
      default: function () {
        return cacheService;
      }
    });
    NorthMQTT = reloadModule<{ default: typeof NorthMQTTClass }>(nodeRequire, './north-mqtt').default;
  });

  beforeEach(() => {
    mockMqttClient = new MockMqttClient();

    transformerExports.createTransformer.mock.resetCalls();
    connectAsyncFn.mock.resetCalls();
    connectAsyncFn.mock.mockImplementation(async () => mockMqttClient);
    connectFn.mock.resetCalls();
    connectFn.mock.mockImplementation((_url: string) => mockMqttClient);
    streamToStringFn.mock.resetCalls();
    streamToStringFn.mock.mockImplementation(async () => '[]');
    createConnectionOptionsFn.mock.resetCalls();
    createConnectionOptionsFn.mock.mockImplementation(async () => ({}));
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();

    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });

    configuration = buildNorthEntity<NorthMQTTSettings>('mqtt', {
      url: 'mqtt://localhost:1883',
      qos: '1',
      persistent: true,
      authentication: {
        type: 'none',
        username: '',
        password: '',
        caFilePath: '',
        certFilePath: '',
        keyFilePath: ''
      },
      connectTimeout: 1000,
      reconnectPeriod: 1000,
      rejectUnauthorized: false
    });

    north = new NorthMQTT(configuration, logger, cacheService);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should retrieve supported types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['mqtt']);
  });

  it('should properly connect', async () => {
    mock.method(north, 'disconnect', async () => undefined);

    await north.start();

    assert.strictEqual(createConnectionOptionsFn.mock.calls.length, 1);
    assert.deepStrictEqual(createConnectionOptionsFn.mock.calls[0].arguments[0], configuration.id);
    assert.strictEqual(connectAsyncFn.mock.calls.length, 1);
    assert.deepStrictEqual(connectAsyncFn.mock.calls[0].arguments[0], configuration.settings.url);
    assert.ok(logger.info.mock.calls.some(c => c.arguments[0] === `MQTT North connector "${configuration.name}" connected`));
  });

  it('should properly connect and clear existing timeout', async () => {
    (north as unknown as { reconnectTimeout: NodeJS.Timeout | null })['reconnectTimeout'] = setTimeout(() => null);

    await north.start();

    // Timeout was cleared — reconnectTimeout should be null after successful connect
    assert.strictEqual((north as unknown as { reconnectTimeout: null })['reconnectTimeout'], null);
  });

  it('should handle connection error and trigger reconnect', async () => {
    const error = new Error('Connection failed');
    connectAsyncFn.mock.mockImplementationOnce(async () => {
      throw error;
    });
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.connect();

    assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === `Error while connecting to the MQTT broker: Connection failed`));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should not reconnect if disabled on error', async () => {
    const error = new Error('Connection failed');
    connectAsyncFn.mock.mockImplementationOnce(async () => {
      throw error;
    });
    north.connectorConfiguration.enabled = false;
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.connect();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    // No reconnect timeout should be set
    assert.strictEqual((north as unknown as { reconnectTimeout: null })['reconnectTimeout'], null);
  });

  it('should handle runtime MQTT error events', async () => {
    await north.connect();
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    // Simulate 'error' event
    mockMqttClient.emit('error', new Error('Runtime error'));

    assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'MQTT Client error: Runtime error'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should handle unintentional close event', async () => {
    await north.connect();
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);
    (north as unknown as { disconnecting: boolean })['disconnecting'] = false;

    mockMqttClient.emit('close');

    assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'MQTT Client closed unintentionally'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should handle intentional close event', async () => {
    await north.connect();
    (north as unknown as { disconnecting: boolean })['disconnecting'] = true;

    mockMqttClient.emit('close');

    assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'MQTT Client intentionally disconnected'));
  });

  it('should properly disconnect', async () => {
    (north as unknown as { client: MqttClient })['client'] = mockMqttClient as unknown as MqttClient;
    (north as unknown as { reconnectTimeout: NodeJS.Timeout | null })['reconnectTimeout'] = setTimeout(() => null);

    await north.disconnect();

    assert.strictEqual(mockMqttClient.removeAllListeners.mock.calls.length, 1);
    assert.strictEqual(mockMqttClient.end.mock.calls.length, 1);
    assert.deepStrictEqual(mockMqttClient.end.mock.calls[0].arguments, [true]);
    assert.strictEqual((north as unknown as { client: null })['client'], null);
  });

  it('should properly test connection', async () => {
    const connackPacket = { sessionPresent: false };
    connectFn.mock.mockImplementation((_url: string) => {
      setImmediate(() => mockMqttClient.emit('connect', connackPacket));
      return mockMqttClient;
    });

    const testResult = await north.testConnection();

    assert.strictEqual(connectFn.mock.calls.length, 1);
    assert.deepStrictEqual(connectFn.mock.calls[0].arguments[0], configuration.settings.url);
    assert.strictEqual(mockMqttClient.end.mock.calls.length, 1);
    assert.deepStrictEqual(testResult, { items: [{ key: 'SessionPresent', value: 'false' }] });
  });

  it('should throw error if connector is in reconnecting state', async () => {
    (north as unknown as { reconnectTimeout: NodeJS.Timeout | null })['reconnectTimeout'] = setTimeout(() => null);
    const readStream = {} as ReadStream;

    await assert.rejects(async () => {
      await north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'mqtt'
      });
    }, /Connector is reconnecting\.\.\./);
  });

  it('should throw error if client is not set/connected', async () => {
    (north as unknown as { client: null })['client'] = null;
    const readStream = {} as ReadStream;
    const values: Array<OIBusMQTTValue> = [
      { topic: 'topic1', payload: '123' },
      { topic: 'topic2', payload: 'abc' }
    ];
    streamToStringFn.mock.mockImplementation(async () => JSON.stringify(values));

    await assert.rejects(async () => {
      await north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'mqtt'
      });
    }, /MQTT client not set\. The connector cannot write values/);
  });

  it('should handle content success', async () => {
    const values: Array<OIBusMQTTValue> = [
      { topic: 'topic1', payload: '123' },
      { topic: 'topic2', payload: 'abc' }
    ];
    streamToStringFn.mock.mockImplementation(async () => JSON.stringify(values));

    (north as unknown as { client: MqttClient })['client'] = mockMqttClient as unknown as MqttClient;
    const readStream = {} as ReadStream;

    await north.handleContent(readStream, {
      contentFile: 'file.json',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'mqtt'
    });

    assert.strictEqual(streamToStringFn.mock.calls.length, 1);
    assert.deepStrictEqual(streamToStringFn.mock.calls[0].arguments, [readStream]);
    assert.strictEqual(mockMqttClient.publishAsync.mock.calls.length, 2);
    assert.deepStrictEqual(mockMqttClient.publishAsync.mock.calls[0].arguments, ['topic1', '123', { qos: 1 }]);
  });

  it('should handle publish errors and trigger reconnect', async () => {
    const values: Array<OIBusMQTTValue> = [{ topic: 'topic1', payload: '123' }];
    streamToStringFn.mock.mockImplementation(async () => JSON.stringify(values));

    (north as unknown as { client: MqttClient })['client'] = mockMqttClient as unknown as MqttClient;
    mockMqttClient.publishAsync.mock.mockImplementationOnce(async () => {
      throw new Error('Publish failed');
    });

    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);
    const readStream = {} as ReadStream;

    await assert.rejects(async () => {
      await north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'mqtt'
      });
    }, /Publish failed/);

    assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'MQTT Publish error: Publish failed'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });
});
