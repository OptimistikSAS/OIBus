import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, flushPromises } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type SouthMQTTClass from './south-mqtt';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { SouthMQTTItemSettings, SouthMQTTSettings } from '../../../shared/model/south-settings.model';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type { MqttClient } from 'mqtt';

const nodeRequire = createRequire(import.meta.url);

class MqttStreamMock extends EventEmitter {
  subscribeAsync = mock.fn(async () => undefined);
  unsubscribeAsync = mock.fn(async () => undefined);
  end = mock.fn(() => undefined);
}

const mqttStream = new MqttStreamMock();

const mqttExports = {
  __esModule: true,
  default: {
    connectAsync: mock.fn(async () => mqttStream),
    connect: mock.fn((_url: string) => mqttStream)
  } as { connectAsync: ReturnType<typeof mock.fn>; connect: ReturnType<typeof mock.fn>; default?: unknown }
};
mqttExports.default.default = mqttExports.default;

const utilsMqttExports = {
  createConnectionOptions: mock.fn(async () => ({})),
  getItem: mock.fn(() => undefined as unknown)
};

describe('SouthMQTT', () => {
  let SouthMQTT: typeof SouthMQTTClass;
  let south: SouthMQTTClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(async (_southId: string, _data: unknown, _queryTime: string, _items: unknown) => undefined);
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const configuration: SouthConnectorEntity<SouthMQTTSettings, SouthMQTTItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'mqtt',
    description: 'my test connector',
    enabled: true,
    settings: {
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
      rejectUnauthorized: false,
      maxNumberOfMessages: 1,
      flushMessageTimeout: 1000
    },
    groups: [],
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: { topic: 'my/first/topic' },
        scanMode: {
          id: 'subscription',
          name: 'subscription',
          description: '',
          cron: '',
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: { topic: 'my/+/+/topic/with/wildcard/#' },
        scanMode: {
          id: 'subscription',
          name: 'subscription',
          description: '',
          cron: '',
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: { topic: 'my/wrong/topic////' },
        scanMode: {
          id: 'subscription',
          name: 'subscription',
          description: '',
          cron: '',
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null
      },
      {
        id: 'id4',
        name: 'item4',
        enabled: true,
        settings: { topic: 'json/topic' },
        scanMode: {
          id: 'subscription',
          name: 'subscription',
          description: '',
          cron: '',
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null
      },
      {
        id: 'id5',
        name: 'item5',
        enabled: true,
        settings: { topic: 'json/topic' },
        scanMode: {
          id: 'subscription',
          name: 'subscription',
          description: '',
          cron: '',
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null
      },
      {
        id: 'id6',
        name: 'item6',
        enabled: true,
        settings: { topic: 'json/topic' },
        scanMode: {
          id: 'subscription',
          name: 'subscription',
          description: '',
          cron: '',
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null
      }
    ],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

  before(() => {
    mockModule(nodeRequire, 'mqtt', mqttExports);
    mockModule(nodeRequire, '../../service/utils-mqtt', utilsMqttExports);
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    SouthMQTT = reloadModule<{ default: typeof SouthMQTTClass }>(nodeRequire, './south-mqtt').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    mqttStream.removeAllListeners();
    mqttStream.subscribeAsync = mock.fn(async () => undefined);
    mqttStream.unsubscribeAsync = mock.fn(async () => undefined);
    mqttStream.end = mock.fn(() => undefined);
    mqttExports.default.connectAsync = mock.fn(async () => mqttStream);
    mqttExports.default.connect = mock.fn((_url: string) => mqttStream);
    utilsMqttExports.createConnectionOptions = mock.fn(async () => ({}));
    utilsMqttExports.getItem = mock.fn(() => undefined as unknown);
    addContentCallback.mock.resetCalls();
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthMQTT(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly connect', async () => {
    mock.method(
      south,
      'subscribe',
      mock.fn(async () => undefined)
    );
    const disconnectMock = mock.method(
      south,
      'disconnect',
      mock.fn(async () => undefined)
    );
    const flushMessagesMock = mock.method(
      south,
      'flushMessages',
      mock.fn(async () => undefined)
    );
    utilsMqttExports.getItem = mock.fn(() => configuration.items[0] as unknown);

    await south.connect();

    assert.strictEqual(mqttExports.default.connectAsync.mock.calls.length, 1);
    assert.deepStrictEqual(mqttExports.default.connectAsync.mock.calls[0].arguments, [configuration.settings.url, {}]);
    assert.ok(
      logger.info.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === `MQTT South connector "south" connected`)
    );

    // maxNumberOfMessages = 1, first message should NOT flush yet (message count < max before buffering)
    configuration.settings.maxNumberOfMessages = 10;
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises();
    assert.strictEqual(flushMessagesMock.mock.calls.length, 0);

    configuration.settings.maxNumberOfMessages = 1;
    utilsMqttExports.getItem = mock.fn(() => configuration.items[0] as unknown);
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises();
    assert.ok(
      logger.trace.mock.calls.some(
        (c: { arguments: Array<unknown> }) => c.arguments[0] === 'MQTT message for topic myTopic: myMessage, dup:false, qos:1, retain:false'
      )
    );
    assert.strictEqual(flushMessagesMock.mock.calls.length, 1);

    utilsMqttExports.getItem = mock.fn(() => {
      throw new Error('getItem error');
    });
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises();
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === 'Error for topic myTopic: getItem error')
    );

    mqttStream.emit('error', new Error('error'));
    await flushPromises();
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) => (c.arguments[0] as string).includes(`MQTT Client error: `))
    );
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should properly connect and clear timeout', async () => {
    const priv = south as unknown as Record<string, unknown>;
    priv['reconnectTimeout'] = setTimeout(() => null, 60000);
    priv['flushTimeout'] = setTimeout(() => null, 60000);
    mock.method(
      south,
      'subscribe',
      mock.fn(async () => undefined)
    );

    utilsMqttExports.createConnectionOptions = mock.fn(async () => ({}));
    await south.start();

    assert.strictEqual(mqttExports.default.connectAsync.mock.calls.length, 1);
    assert.deepStrictEqual(mqttExports.default.connectAsync.mock.calls[0].arguments, [configuration.settings.url, {}]);
    // After start(), timeouts should have been cleared (set to null by connect())
    assert.strictEqual(priv['reconnectTimeout'], null);
  });

  it('should properly connect and manage unintentional close event', async () => {
    mock.method(
      south,
      'subscribe',
      mock.fn(async () => undefined)
    );
    utilsMqttExports.createConnectionOptions = mock.fn(async () => ({}));
    await south.connect();

    assert.strictEqual(mqttExports.default.connectAsync.mock.calls.length, 1);
    const priv = south as unknown as Record<string, unknown>;
    assert.strictEqual(priv['reconnectTimeout'], null);

    mqttStream.emit('close');
    assert.ok(logger.debug.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === 'MQTT Client closed unintentionally'));
    assert.notStrictEqual(priv['reconnectTimeout'], null);
  });

  it('should properly flush queued messages and reset the queue', async () => {
    const priv = south as unknown as Record<string, unknown>;
    priv['flushTimeout'] = setTimeout(() => null, 10000);

    const mockPayload = {
      topic: 'myTopic',
      message: 'myMessage',
      item: configuration.items[0],
      timestamp: testData.constants.dates.FAKE_NOW
    };
    (priv['bufferedMessages'] as Array<unknown>) = [mockPayload];

    await south.flushMessages();

    assert.strictEqual(addContentCallback.mock.calls.length, 1);
    assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments, [
      'southId',
      {
        content: JSON.stringify([
          {
            message: mockPayload.message,
            timestamp: mockPayload.timestamp,
            item: { id: mockPayload.item.id, name: mockPayload.item.name, topic: mockPayload.item.settings.topic }
          }
        ]),
        type: 'any-content'
      },
      testData.constants.dates.FAKE_NOW,
      [mockPayload.item]
    ]);

    assert.deepStrictEqual(priv['bufferedMessages'], []);
    // flushMessages always reschedules flushTimeout at the end
    assert.notStrictEqual(priv['flushTimeout'], null);
  });

  it('should not trigger callback if there are no messages to flush', async () => {
    const priv = south as unknown as Record<string, unknown>;
    priv['flushTimeout'] = setTimeout(() => null, 10000);
    (priv['bufferedMessages'] as Array<unknown>) = [];

    await south.flushMessages();

    assert.strictEqual(addContentCallback.mock.calls.length, 0);
    // flushMessages always reschedules flushTimeout at the end
    assert.notStrictEqual(priv['flushTimeout'], null);
  });

  it('should log error if fail to add content', async () => {
    const priv = south as unknown as Record<string, unknown>;
    const mockPayload = {
      topic: 'myTopic',
      message: 'myMessage',
      item: configuration.items[0],
      timestamp: testData.constants.dates.FAKE_NOW
    };
    (priv['bufferedMessages'] as Array<unknown>) = [mockPayload];
    mock.method(
      south,
      'addContent',
      mock.fn(async () => {
        throw new Error('add content error');
      })
    );

    await south.flushMessages();

    assert.ok(
      logger.error.mock.calls.some(
        (c: { arguments: Array<unknown> }) => c.arguments[0] === 'Error when flushing messages: add content error'
      )
    );
  });

  it('should properly connect and manage intentional close event', async () => {
    mock.method(
      south,
      'subscribe',
      mock.fn(async () => undefined)
    );
    utilsMqttExports.createConnectionOptions = mock.fn(async () => ({}));
    await south.connect();

    const priv = south as unknown as Record<string, unknown>;
    priv['disconnecting'] = true;
    mqttStream.emit('close');
    assert.ok(
      logger.debug.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === 'MQTT Client intentionally disconnected')
    );
    assert.strictEqual(priv['reconnectTimeout'], null);
  });

  it('should properly manage connect error and reconnect', async () => {
    mqttExports.default.connectAsync = mock.fn(async () => {
      throw new Error('connect error');
    });
    const disconnectMock = mock.method(
      south,
      'disconnect',
      mock.fn(async () => undefined)
    );

    await south.start();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    const priv = south as unknown as Record<string, unknown>;
    assert.notStrictEqual(priv['reconnectTimeout'], null);
  });

  it('should properly manage connect error and not reconnect if disabled', async () => {
    mqttExports.default.connectAsync = mock.fn(async () => {
      throw new Error('connect error');
    });
    const disconnectMock = mock.method(
      south,
      'disconnect',
      mock.fn(async () => undefined)
    );
    (south as unknown as Record<string, unknown>)['connector'] = { ...configuration, enabled: false };

    await south.connect();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    const priv = south as unknown as Record<string, unknown>;
    assert.strictEqual(priv['reconnectTimeout'], null);
  });

  it('should not flush message if limit is not triggered', async () => {
    configuration.settings.maxNumberOfMessages = 2;
    mock.method(
      south,
      'subscribe',
      mock.fn(async () => undefined)
    );
    const flushMessagesMock = mock.method(
      south,
      'flushMessages',
      mock.fn(async () => undefined)
    );
    utilsMqttExports.getItem = mock.fn(() => configuration.items[0] as unknown);

    south.connect();
    await flushPromises();
    mqttStream.emit('connect');
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises();
    assert.strictEqual(flushMessagesMock.mock.calls.length, 0);

    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises();
    assert.strictEqual(flushMessagesMock.mock.calls.length, 1);
    configuration.settings.maxNumberOfMessages = 1;
  });

  it('should properly disconnect', async () => {
    const priv = south as unknown as Record<string, unknown>;
    priv['reconnectTimeout'] = setTimeout(() => null, 60000);
    priv['client'] = mqttStream as unknown as MqttClient;

    await south.disconnect();

    assert.ok(
      !logger.info.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === 'Disconnecting from mqtt://localhost:1883...')
    );
    // After disconnect, reconnectTimeout should be null; flushTimeout cleared by disconnect after flushMessages
    assert.strictEqual(priv['reconnectTimeout'], null);
    assert.strictEqual(priv['flushTimeout'], null);

    // Second disconnect: flushMessages replaced with a no-op, so no new flushTimeout is set
    mock.method(
      south,
      'flushMessages',
      mock.fn(async () => undefined)
    );
    await south.disconnect();
    assert.strictEqual(priv['reconnectTimeout'], null);
    assert.strictEqual(priv['flushTimeout'], null);
  });

  it('should not subscribe if client is not set', async () => {
    await south.subscribe(configuration.items);
    assert.ok(
      logger.error.mock.calls.some(
        (c: { arguments: Array<unknown> }) => c.arguments[0] === 'MQTT client could not subscribe to items: client not set'
      )
    );
  });

  it('should properly subscribe when client is set', async () => {
    mqttStream.subscribeAsync = mock.fn(async () => {
      throw new Error('subscription error');
    });

    south.connect();
    await flushPromises();
    await south.subscribe(configuration.items);
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === `Subscription error: subscription error`)
    );
    assert.strictEqual(mqttStream.subscribeAsync.mock.calls.length, 1);
    assert.deepStrictEqual(mqttStream.subscribeAsync.mock.calls[0].arguments, [
      configuration.items.map(item => item.settings.topic),
      { qos: parseInt(configuration.settings.qos) }
    ]);
  });

  it('should not unsubscribe if client is not set', async () => {
    await south.unsubscribe(configuration.items);
    assert.ok(
      logger.warn.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === 'MQTT client is not set. Nothing to unsubscribe')
    );
  });

  it('should properly unsubscribe when client is set', async () => {
    mqttStream.unsubscribeAsync = mock.fn(async () => {
      throw new Error('unsubscription error');
    });

    south.connect();
    await flushPromises();
    await south.unsubscribe(configuration.items);
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === `Unsubscription error: unsubscription error`)
    );
    assert.strictEqual(mqttStream.unsubscribeAsync.mock.calls.length, 1);
    assert.deepStrictEqual(mqttStream.unsubscribeAsync.mock.calls[0].arguments, [configuration.items.map(item => item.settings.topic)]);
  });

  it('should properly test connection', async () => {
    const connackPacket = { sessionPresent: false };
    mqttExports.default.connect = mock.fn((_url: string) => {
      setImmediate(() => mqttStream.emit('connect', connackPacket));
      return mqttStream;
    });

    const testResult = await south.testConnection();

    assert.strictEqual(mqttStream.end.mock.calls.length, 1);
    assert.deepStrictEqual(testResult, { items: [{ key: 'SessionPresent', value: 'false' }] });
  });

  it('should properly test item', async () => {
    const disconnectMock = mock.method(
      south,
      'disconnect',
      mock.fn(async () => undefined)
    );
    mqttStream.unsubscribeAsync = mock.fn(async () => undefined);

    const testItemPromise = south.testItem(configuration.items[0], { history: undefined });

    await flushPromises();
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises();

    await testItemPromise;

    assert.strictEqual(mqttStream.subscribeAsync.mock.calls.length, 1);
    assert.deepStrictEqual(mqttStream.subscribeAsync.mock.calls[0].arguments, [configuration.items[0].settings.topic]);
    assert.strictEqual(mqttStream.unsubscribeAsync.mock.calls.length, 1);
    assert.deepStrictEqual(mqttStream.unsubscribeAsync.mock.calls[0].arguments, [configuration.items[0].settings.topic]);
    assert.strictEqual(mqttStream.end.mock.calls.length, 1);
    assert.deepStrictEqual(mqttStream.end.mock.calls[0].arguments, [true]);
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should properly test item and manage unsubscribe error', async () => {
    const disconnectMock = mock.method(
      south,
      'disconnect',
      mock.fn(async () => undefined)
    );
    mqttStream.unsubscribeAsync = mock.fn(async () => {
      throw new Error('unsubscribe error');
    });

    let error: unknown;
    const testItemPromise = south.testItem(configuration.items[0], { history: undefined }).catch(err => {
      error = err;
    });

    await flushPromises();
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises();
    await testItemPromise;

    assert.strictEqual(mqttStream.unsubscribeAsync.mock.calls.length, 1);
    assert.deepStrictEqual(mqttStream.unsubscribeAsync.mock.calls[0].arguments, [configuration.items[0].settings.topic]);
    assert.strictEqual(mqttStream.end.mock.calls.length, 0);
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.strictEqual(
      error,
      `Error when testing item ${configuration.items[0].settings.topic} (received message "myMessage"): unsubscribe error`
    );
  });

  it('should properly test item and manage subscribe error', async () => {
    const disconnectMock = mock.method(
      south,
      'disconnect',
      mock.fn(async () => undefined)
    );
    mqttStream.subscribeAsync = mock.fn(async () => {
      throw new Error('subscribe error');
    });

    let error: unknown;
    const testItemPromise = south.testItem(configuration.items[0], { history: undefined }).catch(err => {
      error = err;
    });

    await flushPromises();
    await testItemPromise;

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.strictEqual(error, `Error when testing item ${configuration.items[0].settings.topic}: subscribe error`);
  });
});
