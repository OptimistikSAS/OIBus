import assert from 'node:assert/strict';
import EventEmitter from 'node:events';
import type { ReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { MqttClient } from 'mqtt';

import type { NorthMQTTSettings } from '../../../shared/model/connector/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/domain/engine.model';

import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type * as Utils from '../../service/utils';
import { createCacheServiceMock } from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { buildNorthEntity, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type { OIBusMQTTValue } from '../../transformers/connector-types.model';
import type NorthMQTTClass from './north-mqtt';

const nodeRequire = createRequire(import.meta.url);

// A real emitter: the connector reacts to the client's 'connect', 'error' and 'close' events
class MockMqttClient extends EventEmitter {
  connected = true;
  publishAsync = mock.fn(async (..._args: Array<unknown>) => undefined);
  end = mock.fn((..._args: Array<unknown>) => undefined);
  removeAllListeners = mock.fn(() => this);
}

// The stream is only handed to the (mocked) streamToString
const readStream = {} as ReadStream;
const metadata: CacheMetadata = {
  contentFile: 'file.json',
  contentSize: 100,
  numberOfElement: 1,
  createdAt: '2020-02-02T02:02:02.222Z',
  contentType: 'mqtt'
};
const values: Array<OIBusMQTTValue> = [
  { topic: 'topic1', payload: '123' },
  { topic: 'topic2', payload: 'abc' }
];

describe('NorthMQTT', () => {
  let NorthMQTT: typeof NorthMQTTClass;
  let north: NorthMQTTClass;
  let configuration: NorthConnectorEntity<NorthMQTTSettings>;
  let logger: PinoLogger;
  let mqttClient: MockMqttClient;
  let connectAsync: Mock<(url: string, ...args: Array<unknown>) => Promise<MockMqttClient>>;
  let connect: Mock<(url: string, ...args: Array<unknown>) => MockMqttClient>;
  let createConnectionOptions: Mock<(id: string, ...args: Array<unknown>) => Promise<object>>;
  let streamToString: Mock<typeof Utils.streamToString>;

  const mqttExports = { __esModule: true, default: {} };
  const utilsMqttExports: Record<string, unknown> = {};
  const utilsExports: typeof Utils = { ...nodeRequire('../../service/utils') };

  before(() => {
    mockModule(nodeRequire, 'mqtt', mqttExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/utils-mqtt', utilsMqttExports);
    // No transformation here: don't pay for loading every transformer
    mockModule(nodeRequire, '../../service/transformer.service', {});
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    NorthMQTT = reloadModule<{ default: typeof NorthMQTTClass }>(nodeRequire, './north-mqtt').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    mqttClient = new MockMqttClient();
    connectAsync = mock.fn(async () => mqttClient);
    connect = mock.fn(() => mqttClient);
    createConnectionOptions = mock.fn(async () => ({}));
    streamToString = mock.fn(async () => '[]');
    Object.assign(mqttExports.default, { connectAsync, connect });
    Object.assign(utilsMqttExports, { createConnectionOptions });
    // delay: super.connect() waits for runMinDelay before checking the cache, and setTimeout is mocked
    Object.assign(utilsExports, { streamToString, delay: async () => undefined });
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
    north = new NorthMQTT(configuration, createCacheServiceMock());
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  /** Gives the connector the mocked MQTT client */
  const setClient = () => {
    north['client'] = mqttClient as unknown as MqttClient;
  };

  /** Makes mqtt.connect() return the client, which then emits this event */
  const emitOnTestConnection = (event: string, payload: unknown) => {
    connect.mock.mockImplementation(() => {
      setImmediate(() => mqttClient.emit(event, payload));
      return mqttClient;
    });
  };

  it('should retrieve supported types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['mqtt']);
  });

  it('should properly connect', async () => {
    mock.method(north, 'disconnect', async () => undefined);

    await north.start();

    assert.strictEqual(createConnectionOptions.mock.calls.length, 1);
    assert.deepStrictEqual(createConnectionOptions.mock.calls[0].arguments[0], configuration.id);
    assert.strictEqual(connectAsync.mock.calls.length, 1);
    assert.deepStrictEqual(connectAsync.mock.calls[0].arguments[0], configuration.settings.url);
    assert.ok(logger.info.mock.calls.some(c => c.arguments[0] === `MQTT North connector "${configuration.name}" connected`));
  });

  it('should properly connect and clear existing timeout', async () => {
    north['reconnectTimeout'] = setTimeout(() => null);

    await north.start();

    // Timeout was cleared — reconnectTimeout should be null after successful connect
    assert.strictEqual(north['reconnectTimeout'], null);
  });

  it('should handle connection error and trigger reconnect', async () => {
    connectAsync.mock.mockImplementationOnce(async () => {
      throw new Error('Connection failed');
    });
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.connect();

    assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === `Error while connecting to the MQTT broker: Connection failed`));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should not reconnect if disabled on error', async () => {
    connectAsync.mock.mockImplementationOnce(async () => {
      throw new Error('Connection failed');
    });
    north.connectorConfiguration.enabled = false;
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await north.connect();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    // No reconnect timeout should be set
    assert.strictEqual(north['reconnectTimeout'], null);
  });

  it('should handle runtime MQTT error events', async () => {
    await north.connect();
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    mqttClient.emit('error', new Error('Runtime error'));

    assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'MQTT Client error: Runtime error'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should handle unintentional close event', async () => {
    await north.connect();
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);
    north['disconnecting'] = false;

    mqttClient.emit('close');

    assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'MQTT Client closed unintentionally'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should handle intentional close event', async () => {
    await north.connect();
    north['disconnecting'] = true;

    mqttClient.emit('close');

    assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'MQTT Client intentionally disconnected'));
  });

  it('should properly disconnect', async () => {
    setClient();
    north['reconnectTimeout'] = setTimeout(() => null);

    await north.disconnect();

    assert.strictEqual(mqttClient.removeAllListeners.mock.calls.length, 1);
    assert.strictEqual(mqttClient.end.mock.calls.length, 1);
    assert.deepStrictEqual(mqttClient.end.mock.calls[0].arguments, [true]);
    assert.strictEqual(north['client'], null);
  });

  it('should properly test connection', async () => {
    emitOnTestConnection('connect', { sessionPresent: false });

    const testResult = await north.testConnection();

    assert.strictEqual(connect.mock.calls.length, 1);
    assert.deepStrictEqual(connect.mock.calls[0].arguments[0], configuration.settings.url);
    assert.strictEqual(mqttClient.end.mock.calls.length, 1);
    assert.deepStrictEqual(testResult, { items: [{ key: 'SessionPresent', value: 'false' }] });
  });

  it('should populate all properties from connack in test connection', async () => {
    emitOnTestConnection('connect', {
      sessionPresent: true,
      properties: {
        maximumQoS: 1,
        retainAvailable: true,
        wildcardSubscriptionAvailable: true,
        sharedSubscriptionAvailable: false,
        maximumPacketSize: 256,
        serverKeepAlive: 30,
        topicAliasMaximum: 10
      }
    });

    const testResult = await north.testConnection();

    assert.ok(testResult.items.some(item => item.key === 'WildcardSubscriptions'));
    assert.ok(testResult.items.some(item => item.key === 'SharedSubscriptions'));
    assert.ok(testResult.items.some(item => item.key === 'MaxPacketSize'));
    assert.ok(testResult.items.some(item => item.key === 'ServerKeepAlive'));
    assert.ok(testResult.items.some(item => item.key === 'TopicAliasMaximum'));
  });

  it('should reject test connection when the MQTT client emits an error', async () => {
    const error = new Error('Connection refused');
    emitOnTestConnection('error', error);

    await assert.rejects(north.testConnection(), error);

    assert.strictEqual(mqttClient.end.mock.calls.length, 1);
    assert.deepStrictEqual(mqttClient.end.mock.calls[0].arguments, [true]);
  });

  it('should throw error if connector is in reconnecting state', async () => {
    north['reconnectTimeout'] = setTimeout(() => null);

    await assert.rejects(north.handleContent(readStream, metadata), /Connector is reconnecting\.\.\./);
  });

  it('should throw error if client is not set/connected', async () => {
    north['client'] = null;
    streamToString.mock.mockImplementation(async () => JSON.stringify(values));

    await assert.rejects(north.handleContent(readStream, metadata), /MQTT client not set\. The connector cannot write values/);
  });

  it('should handle content success', async () => {
    streamToString.mock.mockImplementation(async () => JSON.stringify(values));
    setClient();

    await north.handleContent(readStream, metadata);

    assert.strictEqual(streamToString.mock.calls.length, 1);
    assert.deepStrictEqual(streamToString.mock.calls[0].arguments, [readStream]);
    assert.strictEqual(mqttClient.publishAsync.mock.calls.length, 2);
    assert.deepStrictEqual(mqttClient.publishAsync.mock.calls[0].arguments, ['topic1', '123', { qos: 1 }]);
  });

  it('should handle publish errors and trigger reconnect', async () => {
    streamToString.mock.mockImplementation(async () => JSON.stringify([values[0]]));
    setClient();
    mqttClient.publishAsync.mock.mockImplementationOnce(async () => {
      throw new Error('Publish failed');
    });
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await assert.rejects(north.handleContent(readStream, metadata), /Publish failed/);

    assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'MQTT Publish error: Publish failed'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });
});
