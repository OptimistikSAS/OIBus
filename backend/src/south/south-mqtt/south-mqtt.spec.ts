import Stream from 'node:stream';
import mqtt, { MqttClient } from 'mqtt';
import SouthMQTT from './south-mqtt';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { SouthMQTTItemSettings, SouthMQTTSettings } from '../../../shared/model/south-settings.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { flushPromises } from '../../tests/utils/test-utils';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import { createConnectionOptions, getItem } from '../../service/utils-mqtt';
import testData from '../../tests/utils/test-data';

jest.mock('mqtt');
jest.mock('node:fs/promises');
jest.mock('../../service/utils');
jest.mock('../../service/utils-mqtt');

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

class CustomStream extends Stream {
  constructor() {
    super();
  }

  subscribeAsync() {
    return;
  }

  unsubscribeAsync() {
    return;
  }

  end() {
    return;
  }
}

describe('SouthMQTT', () => {
  let south: SouthMQTT;
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
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          topic: 'my/first/topic'
        },
        scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
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
        settings: {
          topic: 'my/+/+/topic/with/wildcard/#'
        },
        scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
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
        settings: {
          topic: 'my/wrong/topic////'
        },
        scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
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
        settings: {
          topic: 'json/topic'
        },
        scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
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
        settings: {
          topic: 'json/topic'
        },
        scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
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
        settings: {
          topic: 'json/topic'
        },
        scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' },
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null
      }
    ]
  };
  const mqttStream = new CustomStream();
  mqttStream.subscribeAsync = jest.fn();
  mqttStream.end = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (mqtt.connectAsync as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  afterEach(() => {
    jest.useRealTimers();
    mqttStream.removeAllListeners();
  });

  it('should properly connect', async () => {
    south.subscribe = jest.fn();
    south.disconnect = jest.fn();
    south.flushMessages = jest.fn();
    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    (getItem as jest.Mock).mockReturnValueOnce(configuration.items[0]);
    await south.connect();
    expect(createConnectionOptions).toHaveBeenCalledWith(configuration.id, configuration.settings, logger);
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.url, {});
    expect(logger.info).toHaveBeenCalledWith(`MQTT South connector "south" connected`);
    south['connector'].settings.maxNumberOfMessages = 10;
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises(); // Flush message promise

    expect(south.flushMessages).not.toHaveBeenCalled();
    south['connector'].settings.maxNumberOfMessages = 1;
    (getItem as jest.Mock).mockReturnValueOnce(configuration.items[0]);
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });

    await flushPromises(); // Flush message promise
    expect(logger.trace).toHaveBeenCalledWith('MQTT message for topic myTopic: myMessage, dup:false, qos:1, retain:false');
    expect(south.flushMessages).toHaveBeenCalledTimes(1);

    (getItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('getItem error');
    });
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises(); // Flush message error promise
    expect(logger.error).toHaveBeenCalledWith('Error for topic myTopic: getItem error');

    mqttStream.emit('error', new Error('error'));
    await flushPromises(); // Flush disconnect promise
    expect(logger.error).toHaveBeenCalledWith(`MQTT Client error: ${new Error('error')}`); // Not called because promise is already resolved
    expect(south.disconnect).toHaveBeenCalledTimes(1);
  });

  it('should properly connect and clear timeout', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    south['reconnectTimeout'] = setTimeout(() => null);
    south['flushTimeout'] = setTimeout(() => null);
    south.subscribe = jest.fn();

    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await south.start();
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.url, {});
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2); // because of reconnectTimeout and flushTimeout
  });

  it('should properly connect and manage unintentional close event', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    south.subscribe = jest.fn();
    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await south.connect();
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.url, {});
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    mqttStream.emit('close');
    expect(logger.debug).toHaveBeenCalledWith('MQTT Client closed unintentionally');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
  });

  it('should properly flush queued messages and reset the queue', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    // Create a dummy timeout to verify it gets cleared
    south['flushTimeout'] = setTimeout(() => null, 10000);

    // Mock the internal messages queue with some data
    const mockPayload = {
      topic: 'myTopic',
      message: 'myMessage',
      item: configuration.items[0],
      timestamp: testData.constants.dates.FAKE_NOW
    };
    south['bufferedMessages'] = [mockPayload];

    await south.flushMessages();

    expect(addContentCallback).toHaveBeenCalledTimes(1);
    expect(addContentCallback).toHaveBeenCalledWith(
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
      [mockPayload.item.id]
    );

    // Verify internal state was properly reset
    expect(south['bufferedMessages']).toEqual([]);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should not trigger callback if there are no messages to flush', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    south['flushTimeout'] = setTimeout(() => null, 10000);
    south['bufferedMessages'] = [];

    await south.flushMessages();

    expect(addContentCallback).not.toHaveBeenCalled();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should log error if fail to add content', async () => {
    const mockPayload = {
      topic: 'myTopic',
      message: 'myMessage',
      item: configuration.items[0],
      timestamp: testData.constants.dates.FAKE_NOW
    };
    south['bufferedMessages'] = [mockPayload];
    south.addContent = jest.fn().mockRejectedValueOnce(new Error('add content error'));

    await south.flushMessages();

    expect(logger.error).toHaveBeenCalledWith('Error when flushing messages: add content error');
  });

  it('should properly connect and manage intentional close event', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    south.subscribe = jest.fn();

    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await south.connect();
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.url, {});
    south['disconnecting'] = true;
    mqttStream.emit('close');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('MQTT Client intentionally disconnected');
  });

  it('should properly manage connect error and reconnect', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const error = new Error('connect error');
    mqtt.connectAsync = jest.fn().mockImplementationOnce(() => {
      throw error;
    });
    south.disconnect = jest.fn();

    await south.start();

    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should properly manage connect error and not reconnect if disabled', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const error = new Error('connect error');
    mqtt.connectAsync = jest.fn().mockImplementationOnce(() => {
      throw error;
    });
    south.disconnect = jest.fn();
    south['connector'].enabled = false;

    await south.connect();

    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should not flush message if limit is not trigger', async () => {
    south['connector'].settings.maxNumberOfMessages = 2;
    south.subscribe = jest.fn();
    south.flushMessages = jest.fn();
    south.connect();
    await flushPromises();
    mqttStream.emit('connect');
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises(); // Flush disconnect promise
    expect(south.flushMessages).not.toHaveBeenCalled();

    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises(); // Flush disconnect promise
    expect(south.flushMessages).toHaveBeenCalledTimes(1);
  });

  it('should properly disconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    south['reconnectTimeout'] = setTimeout(() => null);
    south['client'] = mqttStream as unknown as MqttClient;

    await south.disconnect();

    expect(logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...');
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);

    south.flushMessages = jest.fn();
    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  });

  it('should not subscribe if client is not set', async () => {
    await south.subscribe(configuration.items);
    expect(logger.error).toHaveBeenCalledWith('MQTT client could not subscribe to items: client not set');
  });

  it('should properly subscribe when client is set', async () => {
    mqttStream.subscribeAsync = jest.fn().mockImplementationOnce(() => {
      throw new Error('subscription error');
    });

    south.connect();
    await flushPromises();
    await south.subscribe(configuration.items);
    expect(logger.error).toHaveBeenCalledWith(`Subscription error: subscription error`);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(mqttStream.subscribeAsync).toHaveBeenCalledTimes(1);
    expect(mqttStream.subscribeAsync).toHaveBeenCalledWith(
      configuration.items.map(item => item.settings.topic),
      { qos: parseInt(configuration.settings.qos) }
    );
  });

  it('should not unsubscribe if client is not set', async () => {
    await south.unsubscribe(configuration.items);
    expect(logger.warn).toHaveBeenCalledWith('MQTT client is not set. Nothing to unsubscribe');
  });

  it('should properly unsubscribe when client is set', async () => {
    mqttStream.unsubscribeAsync = jest.fn().mockImplementationOnce(() => {
      throw new Error('unsubscription error');
    });

    south.connect();
    await flushPromises();
    await south.unsubscribe(configuration.items);
    expect(logger.error).toHaveBeenCalledWith(`Unsubscription error: unsubscription error`);
    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledTimes(1);
    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledWith(configuration.items.map(item => item.settings.topic));
  });

  it('should properly test connection', async () => {
    south.disconnect = jest.fn();
    await south.testConnection();
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
  });

  it('should properly test item', async () => {
    south.disconnect = jest.fn();
    mqttStream.unsubscribeAsync = jest.fn();

    south.testItem(configuration.items[0], { history: undefined });

    await flushPromises();
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises();
    expect(mqttStream.subscribeAsync).toHaveBeenCalledTimes(1);
    expect(mqttStream.subscribeAsync).toHaveBeenCalledWith(configuration.items[0].settings.topic);

    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledTimes(1);
    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledWith(configuration.items[0].settings.topic);
    expect(mqttStream.end).toHaveBeenCalledWith(true);
    expect(south.disconnect).toHaveBeenCalledTimes(1);
  });

  it('should properly test item and manage unsubscribe error', async () => {
    south.disconnect = jest.fn();
    mqttStream.unsubscribeAsync = jest.fn().mockImplementationOnce(() => {
      throw new Error('unsubscribe error');
    });
    let error;
    south.testItem(configuration.items[0], { history: undefined }).catch(err => (error = err));

    await flushPromises();
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises();

    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledTimes(1);
    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledWith(configuration.items[0].settings.topic);
    expect(mqttStream.end).not.toHaveBeenCalled();
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(error).toEqual(
      `Error when testing item ${configuration.items[0].settings.topic} (received message "myMessage"): unsubscribe error`
    );
  });

  it('should properly test item and manage subscribe error', async () => {
    south.disconnect = jest.fn();
    mqttStream.subscribeAsync = jest.fn().mockImplementationOnce(() => {
      throw new Error('subscribe error');
    });
    let error;
    south.testItem(configuration.items[0], { history: undefined }).catch(err => (error = err));

    await flushPromises();

    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(error).toEqual(`Error when testing item ${configuration.items[0].settings.topic}: subscribe error`);
  });
});
