import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { SouthMQTTItemSettings, SouthMQTTSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, flushPromises, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthMQTTClass from './south-mqtt';

const nodeRequire = createRequire(import.meta.url);

class MqttClientMock extends EventEmitter {
  subscribeAsync = mock.fn(async (..._args: Array<unknown>) => undefined);
  unsubscribeAsync = mock.fn(async (..._args: Array<unknown>) => undefined);
  end = mock.fn((..._args: Array<unknown>) => undefined);
}

const buildItem = (
  id: string,
  topic: string,
  overrides: Partial<SouthConnectorItemEntity<SouthMQTTItemSettings>> = {}
): SouthConnectorItemEntity<SouthMQTTItemSettings> => ({
  id,
  name: id.replace('id', 'item'),
  description: null,
  enabled: true,
  settings: { topic },
  scanMode: {
    id: 'subscription',
    name: 'subscription',
    description: '',
    type: 'cron',
    cron: '',
    interval: null,
    activationWindow: null,
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
  startTimeOffset: null,
  endTimeOffset: null,
  recoveryStrategy: null,
  cachingStrategy: 'allValues',
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
  ...overrides
});

const buildConfiguration = (): SouthConnectorEntity<SouthMQTTSettings, SouthMQTTItemSettings> => ({
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
    buildItem('id1', 'my/first/topic'),
    buildItem('id2', 'my/+/+/topic/with/wildcard/#'),
    buildItem('id3', 'my/wrong/topic////'),
    buildItem('id4', 'json/topic'),
    buildItem('id5', 'json/topic'),
    buildItem('id6', 'json/topic', { cachingStrategy: null })
  ],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

// The value cached for an item by a previous flush
const lastValue = (itemId: string, value: string, instant: string) => ({
  itemId,
  groupId: null,
  queryTime: instant,
  value,
  trackedInstant: instant
});

const logged = (logMock: Mock<(...args: Array<unknown>) => unknown>, message: string, argumentIndex = 0) =>
  logMock.mock.calls.some(c => c.arguments[argumentIndex] === message);

describe('SouthMQTT', () => {
  let SouthMQTT: typeof SouthMQTTClass;
  let south: SouthMQTTClass;
  let configuration: SouthConnectorEntity<SouthMQTTSettings, SouthMQTTItemSettings>;

  let logger: PinoLogger;
  let addContentCallback: Mock<ConstructorParameters<typeof SouthMQTTClass>[1]>;
  let southCacheRepository: Mocked<SouthCacheRepository>;
  let mqttClient: MqttClientMock;
  let connectAsync: Mock<(...args: Array<unknown>) => Promise<MqttClientMock>>;
  let connect: Mock<(url: string) => MqttClientMock>;

  // `mqtt` is used through its default export: its functions are set on that object per test
  const mqttDefault: Record<string, unknown> = {};
  mqttDefault.default = mqttDefault;
  const createUtilsMqttMocks = () => ({
    createConnectionOptions: mock.fn(async () => ({})),
    getItem: mock.fn((_topic: string, _items: Array<SouthConnectorItemEntity<SouthMQTTItemSettings>>) => configuration.items[0])
  });
  const utilsMqttExports = createUtilsMqttMocks();

  before(() => {
    mockModule(nodeRequire, 'mqtt', { __esModule: true, default: mqttDefault });
    mockModule(nodeRequire, '../../service/utils-mqtt', utilsMqttExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthMQTT = reloadModule<{ default: typeof SouthMQTTClass }>(nodeRequire, './south-mqtt').default;
  });

  beforeEach(() => {
    configuration = buildConfiguration();
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    southCacheRepository = createMock<SouthCacheRepository>({ getItemsLastValues: () => new Map() });
    mqttClient = new MqttClientMock();
    connectAsync = mock.fn(async () => mqttClient);
    connect = mock.fn((_url: string) => mqttClient);
    Object.assign(mqttDefault, { connectAsync, connect });
    Object.assign(utilsMqttExports, createUtilsMqttMocks());
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthMQTT(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly connect', async () => {
    mock.method(south, 'subscribe', async () => undefined);
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    const flushMessages = mock.method(south, 'flushMessages', async () => undefined);

    await south.connect();

    assert.strictEqual(connectAsync.mock.calls.length, 1);
    assert.deepStrictEqual(connectAsync.mock.calls[0].arguments, [configuration.settings.url, {}]);
    assert.ok(
      logger.info.mock.calls.some(c =>
        (c.arguments[0] as string).startsWith(`MQTT South connector "south" connected to "${configuration.settings.url}" in`)
      )
    );

    // maxNumberOfMessages = 1, first message should NOT flush yet (message count < max before buffering)
    configuration.settings.maxNumberOfMessages = 10;
    mqttClient.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises();
    assert.strictEqual(flushMessages.mock.calls.length, 0);

    configuration.settings.maxNumberOfMessages = 1;
    mqttClient.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises();
    assert.ok(logged(logger.trace, 'MQTT message for topic myTopic: myMessage, dup:false, qos:1, retain:false'));
    assert.strictEqual(flushMessages.mock.calls.length, 1);

    utilsMqttExports.getItem.mock.mockImplementation(() => {
      throw new Error('getItem error');
    });
    mqttClient.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises();
    assert.ok(logged(logger.error, 'Error for topic myTopic: getItem error'));

    mqttClient.emit('error', new Error('error'));
    await flushPromises();
    assert.ok(logger.error.mock.calls.some(c => (c.arguments[0] as string).includes(`MQTT Client error: `)));
    assert.strictEqual(disconnect.mock.calls.length, 1);
  });

  it('should properly connect and clear timeout', async () => {
    south['reconnectTimeout'] = setTimeout(() => null, 60000);
    south['flushTimeout'] = setTimeout(() => null, 60000);
    mock.method(south, 'subscribe', async () => undefined);

    await south.start();

    assert.strictEqual(connectAsync.mock.calls.length, 1);
    assert.deepStrictEqual(connectAsync.mock.calls[0].arguments, [configuration.settings.url, {}]);
    // After start(), timeouts should have been cleared (set to null by connect())
    assert.strictEqual(south['reconnectTimeout'], null);
  });

  it('should properly connect and manage unintentional close event', async () => {
    mock.method(south, 'subscribe', async () => undefined);
    await south.connect();

    assert.strictEqual(connectAsync.mock.calls.length, 1);
    assert.strictEqual(south['reconnectTimeout'], null);

    mqttClient.emit('close');
    assert.ok(logged(logger.debug, 'MQTT Client closed unintentionally'));
    assert.notStrictEqual(south['reconnectTimeout'], null);
  });

  it('should properly flush queued messages and reset the queue', async () => {
    south['flushTimeout'] = setTimeout(() => null, 10000);
    const mockPayload = {
      topic: 'myTopic',
      message: 'myMessage',
      item: configuration.items[0],
      timestamp: testData.constants.dates.FAKE_NOW
    };
    south['bufferedMessages'] = [mockPayload];

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
        type: 'file'
      },
      testData.constants.dates.FAKE_NOW,
      [mockPayload.item],
      null,
      null
    ]);

    assert.deepStrictEqual(south['bufferedMessages'], []);
    // flushMessages always reschedules flushTimeout at the end
    assert.notStrictEqual(south['flushTimeout'], null);
  });

  it('should flush one content per item when several items are buffered', async () => {
    south['flushTimeout'] = setTimeout(() => null, 10000);
    south['bufferedMessages'] = [
      { topic: 'topic1', message: 'a', item: configuration.items[0], timestamp: testData.constants.dates.FAKE_NOW },
      { topic: 'topic2', message: 'b', item: configuration.items[1], timestamp: testData.constants.dates.FAKE_NOW },
      { topic: 'topic1', message: 'c', item: configuration.items[0], timestamp: testData.constants.dates.FAKE_NOW }
    ];

    await south.flushMessages();

    // One addContent per item: item1 gets its two messages, item2 gets its one.
    assert.strictEqual(addContentCallback.mock.calls.length, 2);

    const [firstCall, secondCall] = addContentCallback.mock.calls;
    assert.deepStrictEqual(firstCall.arguments[3], [configuration.items[0]]);
    assert.ok(firstCall.arguments[1].type === 'file');
    assert.deepStrictEqual(JSON.parse(firstCall.arguments[1].content!), [
      { message: 'a', timestamp: testData.constants.dates.FAKE_NOW, item: { id: 'id1', name: 'item1', topic: 'my/first/topic' } },
      { message: 'c', timestamp: testData.constants.dates.FAKE_NOW, item: { id: 'id1', name: 'item1', topic: 'my/first/topic' } }
    ]);

    assert.deepStrictEqual(secondCall.arguments[3], [configuration.items[1]]);
    assert.ok(secondCall.arguments[1].type === 'file');
    assert.deepStrictEqual(JSON.parse(secondCall.arguments[1].content!), [
      {
        message: 'b',
        timestamp: testData.constants.dates.FAKE_NOW,
        item: { id: 'id2', name: 'item2', topic: 'my/+/+/topic/with/wildcard/#' }
      }
    ]);

    assert.deepStrictEqual(south['bufferedMessages'], []);
  });

  it('should not trigger callback if there are no messages to flush', async () => {
    south['flushTimeout'] = setTimeout(() => null, 10000);
    south['bufferedMessages'] = [];

    await south.flushMessages();

    assert.strictEqual(addContentCallback.mock.calls.length, 0);
    // flushMessages always reschedules flushTimeout at the end
    assert.notStrictEqual(south['flushTimeout'], null);
  });

  it('should log error if fail to add content', async () => {
    south['bufferedMessages'] = [
      { topic: 'myTopic', message: 'myMessage', item: configuration.items[0], timestamp: testData.constants.dates.FAKE_NOW }
    ];
    mock.method(south, 'addContent', async () => {
      throw new Error('add content error');
    });

    await south.flushMessages();

    assert.ok(logged(logger.error, 'Error when flushing messages: add content error'));
  });

  describe('caching strategy filtering', () => {
    let addContent: Mock<SouthMQTTClass['addContent']>;

    beforeEach(() => {
      addContent = mock.method(south, 'addContent', async () => undefined);
    });

    // Buffers one message per [item, message] pair
    const bufferMessages = (...messages: Array<[SouthConnectorItemEntity<SouthMQTTItemSettings>, string]>) => {
      south['bufferedMessages'] = messages.map(([item, message]) => ({
        topic: item.settings.topic,
        message,
        item,
        timestamp: testData.constants.dates.FAKE_NOW
      }));
    };

    it('should suppress a no-change value under cachingStrategy=onChange', async () => {
      bufferMessages([buildItem('id1', 'my/first/topic', { cachingStrategy: 'onChange' }), '42']);
      southCacheRepository.getItemsLastValues.mock.mockImplementation(
        () => new Map([['id1', lastValue('id1', '42', '2021-01-01T00:00:00.000Z')]])
      );

      await south.flushMessages();

      assert.strictEqual(addContent.mock.calls.length, 0);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments, ['southId', []]);
    });

    it('should cache a threshold-exceeding change', async () => {
      const item = buildItem('id1', 'my/first/topic', { cachingStrategy: 'threshold', thresholdType: 'absolute', threshold: 5 });
      bufferMessages([item, '42']);
      southCacheRepository.getItemsLastValues.mock.mockImplementation(
        () => new Map([['id1', lastValue('id1', '30', '2021-01-01T00:00:00.000Z')]])
      );

      await south.flushMessages();

      assert.strictEqual(addContent.mock.calls.length, 1);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [item]);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
        { itemId: 'id1', value: '42', instant: testData.constants.dates.FAKE_NOW }
      ]);
    });

    it('should cache when maxCachingInterval elapses even without a qualifying change', async () => {
      const item = buildItem('id1', 'my/first/topic', { cachingStrategy: 'onChange', maxCachingInterval: 1000 });
      bufferMessages([item, '42']);
      // previous cached value is identical (no onChange-qualifying diff), but 2h have elapsed since trackedInstant
      southCacheRepository.getItemsLastValues.mock.mockImplementation(
        () => new Map([['id1', lastValue('id1', '42', '2021-01-01T22:00:00.000Z')]])
      );

      await south.flushMessages();

      assert.strictEqual(addContent.mock.calls.length, 1);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [item]);
    });

    it('should always cache the very first read for an item regardless of strategy', async () => {
      const item = buildItem('id1', 'my/first/topic', { cachingStrategy: 'onChange' });
      bufferMessages([item, '42']);
      // getItemsLastValues default mock (set in beforeEach) returns an empty Map — no prior cached state

      await south.flushMessages();

      assert.strictEqual(addContent.mock.calls.length, 1);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [item]);
    });

    it('should call saveItemsLastValues with exactly the items actually cached in the cycle', async () => {
      bufferMessages(
        [buildItem('id1', 'my/first/topic', { cachingStrategy: 'onChange' }), '42'],
        [buildItem('id2', 'my/first/topic', { cachingStrategy: 'onChange' }), '7']
      );
      southCacheRepository.getItemsLastValues.mock.mockImplementation(
        () =>
          new Map([
            ['id1', lastValue('id1', '42', '2021-01-01T00:00:00.000Z')],
            ['id2', lastValue('id2', '1', '2021-01-01T00:00:00.000Z')]
          ])
      );

      await south.flushMessages();

      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments, [
        'southId',
        [{ itemId: 'id2', value: '7', instant: testData.constants.dates.FAKE_NOW }]
      ]);
    });
  });

  it('should properly connect and manage intentional close event', async () => {
    mock.method(south, 'subscribe', async () => undefined);
    await south.connect();

    south['disconnecting'] = true;
    mqttClient.emit('close');
    assert.ok(logged(logger.debug, 'MQTT Client intentionally disconnected'));
    assert.strictEqual(south['reconnectTimeout'], null);
  });

  it('should properly manage connect error and reconnect', async () => {
    connectAsync.mock.mockImplementation(async () => {
      throw new Error('connect error');
    });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);

    await south.start();

    assert.strictEqual(disconnect.mock.calls.length, 1);
    assert.notStrictEqual(south['reconnectTimeout'], null);
  });

  it('should properly manage connect error and not reconnect if disabled', async () => {
    connectAsync.mock.mockImplementation(async () => {
      throw new Error('connect error');
    });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    south['connector'] = { ...configuration, enabled: false };

    await south.connect();

    assert.strictEqual(disconnect.mock.calls.length, 1);
    assert.strictEqual(south['reconnectTimeout'], null);
  });

  it('should not flush message if limit is not triggered', async () => {
    configuration.settings.maxNumberOfMessages = 2;
    mock.method(south, 'subscribe', async () => undefined);
    const flushMessages = mock.method(south, 'flushMessages', async () => undefined);

    south.connect();
    await flushPromises();
    mqttClient.emit('connect');
    mqttClient.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises();
    assert.strictEqual(flushMessages.mock.calls.length, 0);

    mqttClient.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises();
    assert.strictEqual(flushMessages.mock.calls.length, 1);
  });

  it('should properly disconnect', async () => {
    south['reconnectTimeout'] = setTimeout(() => null, 60000);
    // A client the connector believes connected (MqttClientMock is not a full MqttClient)
    Object.assign(south, { client: mqttClient });

    await south.disconnect();

    assert.ok(!logged(logger.info, 'Disconnecting from mqtt://localhost:1883...'));
    // After disconnect, reconnectTimeout should be null; flushTimeout cleared by disconnect after flushMessages
    assert.strictEqual(south['reconnectTimeout'], null);
    assert.strictEqual(south['flushTimeout'], null);

    // Second disconnect: flushMessages replaced with a no-op, so no new flushTimeout is set
    mock.method(south, 'flushMessages', async () => undefined);
    await south.disconnect();
    assert.strictEqual(south['reconnectTimeout'], null);
    assert.strictEqual(south['flushTimeout'], null);
  });

  it('should not subscribe if client is not set', async () => {
    await south.subscribe(configuration.items);
    assert.ok(logged(logger.error, 'MQTT client could not subscribe to items: client not set'));
  });

  it('should properly subscribe when client is set', async () => {
    mqttClient.subscribeAsync.mock.mockImplementation(async () => {
      throw new Error('subscription error');
    });

    south.connect();
    await flushPromises();
    await south.subscribe(configuration.items);
    assert.ok(logged(logger.error, `Subscription error: subscription error`, 1));
    assert.strictEqual(mqttClient.subscribeAsync.mock.calls.length, 1);
    assert.deepStrictEqual(mqttClient.subscribeAsync.mock.calls[0].arguments, [
      configuration.items.map(item => item.settings.topic),
      { qos: parseInt(configuration.settings.qos) }
    ]);
  });

  it('should not unsubscribe if client is not set', async () => {
    await south.unsubscribe(configuration.items);
    assert.ok(logged(logger.warn, 'MQTT client is not set. Nothing to unsubscribe'));
  });

  it('should properly unsubscribe when client is set', async () => {
    mqttClient.unsubscribeAsync.mock.mockImplementation(async () => {
      throw new Error('unsubscription error');
    });

    south.connect();
    await flushPromises();
    await south.unsubscribe(configuration.items);
    assert.ok(logged(logger.error, `Unsubscription error: unsubscription error`, 1));
    assert.strictEqual(mqttClient.unsubscribeAsync.mock.calls.length, 1);
    assert.deepStrictEqual(mqttClient.unsubscribeAsync.mock.calls[0].arguments, [configuration.items.map(item => item.settings.topic)]);
  });

  it('should subscribe successfully without error when client is set', async () => {
    south.connect();
    await flushPromises();
    await south.subscribe(configuration.items);
    assert.strictEqual(mqttClient.subscribeAsync.mock.calls.length, 1);
    assert.ok(!logger.error.mock.calls.some(c => String(c.arguments[0]).startsWith('Subscription error')));
  });

  it('should unsubscribe successfully without error when client is set', async () => {
    south.connect();
    await flushPromises();
    await south.unsubscribe(configuration.items);
    assert.strictEqual(mqttClient.unsubscribeAsync.mock.calls.length, 1);
    assert.ok(!logger.error.mock.calls.some(c => String(c.arguments[0]).startsWith('Unsubscription error')));
  });

  it('should properly test connection', async () => {
    connect.mock.mockImplementation(() => {
      setImmediate(() => mqttClient.emit('connect', { sessionPresent: false }));
      return mqttClient;
    });

    const testResult = await south.testConnection();

    assert.strictEqual(mqttClient.end.mock.calls.length, 1);
    assert.deepStrictEqual(testResult, { items: [{ key: 'SessionPresent', value: 'false' }] });
  });

  it('should reject test connection when client emits an error', async () => {
    const connectionError = new Error('connection refused');
    connect.mock.mockImplementation(() => {
      setImmediate(() => mqttClient.emit('error', connectionError));
      return mqttClient;
    });

    await assert.rejects(south.testConnection(), connectionError);
    assert.strictEqual(mqttClient.end.mock.calls.length, 1);
    assert.deepStrictEqual(mqttClient.end.mock.calls[0].arguments, [true]);
  });

  it('should properly test connection and populate all connack properties', async () => {
    const connackPacket = {
      sessionPresent: true,
      properties: {
        maximumQoS: 1,
        retainAvailable: true,
        wildcardSubscriptionAvailable: true,
        sharedSubscriptionAvailable: false,
        maximumPacketSize: 1024,
        serverKeepAlive: 60,
        topicAliasMaximum: 10
      }
    };
    connect.mock.mockImplementation(() => {
      setImmediate(() => mqttClient.emit('connect', connackPacket));
      return mqttClient;
    });

    const testResult = await south.testConnection();

    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'SessionPresent', value: 'true' },
        { key: 'MaximumQoS', value: '1' },
        { key: 'RetainAvailable', value: 'true' },
        { key: 'WildcardSubscriptions', value: 'true' },
        { key: 'SharedSubscriptions', value: 'false' },
        { key: 'MaxPacketSize', value: '1024' },
        { key: 'ServerKeepAlive', value: '60s' },
        { key: 'TopicAliasMaximum', value: '10' }
      ]
    });
  });

  describe('testItem', () => {
    let disconnect: Mock<SouthMQTTClass['disconnect']>;

    beforeEach(() => {
      disconnect = mock.method(south, 'disconnect', async () => undefined);
    });

    // Runs testItem() on the first item, emitting `message` (if any) once the test client subscribed
    const testFirstItem = async (message?: string | Buffer, client = mqttClient) => {
      const testItemPromise = south.testItem(configuration.items[0], { history: undefined });
      // Marked as handled: it may reject before the caller awaits it
      testItemPromise.catch(() => undefined);
      await flushPromises();
      if (message !== undefined) {
        client.emit('message', 'myTopic', message, { dup: false });
        await flushPromises();
      }
      return testItemPromise;
    };

    it('should properly test item', async () => {
      await testFirstItem('myMessage');

      assert.strictEqual(mqttClient.subscribeAsync.mock.calls.length, 1);
      assert.deepStrictEqual(mqttClient.subscribeAsync.mock.calls[0].arguments, [configuration.items[0].settings.topic]);
      assert.strictEqual(mqttClient.unsubscribeAsync.mock.calls.length, 1);
      assert.deepStrictEqual(mqttClient.unsubscribeAsync.mock.calls[0].arguments, [configuration.items[0].settings.topic]);
      assert.strictEqual(mqttClient.end.mock.calls.length, 1);
      assert.deepStrictEqual(mqttClient.end.mock.calls[0].arguments, [true]);
      // testItem() must never invoke the connector's own disconnect() lifecycle method: it would tear
      // down this.client, the connector's persistent connection, instead of just the local test client.
      assert.strictEqual(disconnect.mock.calls.length, 0);
    });

    it('should decode Buffer message as string when testing item', async () => {
      connectAsync.mock.mockImplementation(async () => {
        mock.timers.tick(15);
        return mqttClient;
      });

      const testItemPromise = south.testItem(configuration.items[0], { history: undefined });
      await flushPromises();
      mock.timers.tick(25);
      mqttClient.emit('message', 'myTopic', Buffer.from('hello from PLC'), { dup: false });
      await flushPromises();

      const result = await testItemPromise;
      assert.ok(result.result.type === 'file');
      const parsed = JSON.parse(result.result.content!);
      assert.strictEqual(parsed[0].message, 'hello from PLC');
      assert.strictEqual(result.connectionDuration, 15);
      assert.strictEqual(result.queryDuration, 25);
      assert.strictEqual(mqttClient.end.mock.calls.length, 1);
      assert.strictEqual(disconnect.mock.calls.length, 0);
    });

    it('should properly test item and manage unsubscribe error', async () => {
      mqttClient.unsubscribeAsync.mock.mockImplementation(async () => {
        throw new Error('unsubscribe error');
      });

      await assert.rejects(
        testFirstItem('myMessage'),
        (error: unknown) =>
          error === `Error when testing item ${configuration.items[0].settings.topic} (received message "myMessage"): unsubscribe error`
      );

      assert.strictEqual(mqttClient.unsubscribeAsync.mock.calls.length, 1);
      assert.deepStrictEqual(mqttClient.unsubscribeAsync.mock.calls[0].arguments, [configuration.items[0].settings.topic]);
      // Even on the message-handling error path, the local test client must still be closed exactly once.
      assert.strictEqual(mqttClient.end.mock.calls.length, 1);
      assert.deepStrictEqual(mqttClient.end.mock.calls[0].arguments, [true]);
      assert.strictEqual(disconnect.mock.calls.length, 0);
    });

    it('should properly test item and manage subscribe error', async () => {
      mqttClient.subscribeAsync.mock.mockImplementation(async () => {
        throw new Error('subscribe error');
      });

      await assert.rejects(
        testFirstItem(),
        (error: unknown) => error === `Error when testing item ${configuration.items[0].settings.topic}: subscribe error`
      );

      // The local client was connected before subscribeAsync failed, so it must still be closed.
      assert.strictEqual(mqttClient.end.mock.calls.length, 1);
      assert.deepStrictEqual(mqttClient.end.mock.calls[0].arguments, [true]);
      assert.strictEqual(disconnect.mock.calls.length, 0);
    });

    it('should not close any client when testing item fails to connect', async () => {
      connectAsync.mock.mockImplementation(async () => {
        throw new Error('connect error');
      });

      await assert.rejects(
        testFirstItem(),
        (error: unknown) => error === `Error when testing item ${configuration.items[0].settings.topic}: connect error`
      );

      // No client was ever created, so there is nothing to close and disconnect() must not be called.
      assert.strictEqual(mqttClient.end.mock.calls.length, 0);
      assert.strictEqual(disconnect.mock.calls.length, 0);
    });

    it('should not touch or disconnect the connector own live client when testing item', async () => {
      // Establish the connector's own persistent connection first, on a client distinct from the one
      // testItem() will create, so a mix-up between the two is observable.
      const liveClient = mqttClient;
      await south.connect();
      assert.strictEqual(south['client'], liveClient);

      const testClient = new MqttClientMock();
      connectAsync.mock.mockImplementation(async () => testClient);

      await testFirstItem('myMessage', testClient);

      // The connector's live client must be left completely alone: not ended, not disconnected, still set.
      assert.strictEqual(liveClient.end.mock.calls.length, 0);
      assert.strictEqual(disconnect.mock.calls.length, 0);
      assert.strictEqual(south['client'], liveClient);

      // Only the local test client created inside testItem() gets closed.
      assert.strictEqual(testClient.end.mock.calls.length, 1);
      assert.deepStrictEqual(testClient.end.mock.calls[0].arguments, [true]);
    });
  });
});
