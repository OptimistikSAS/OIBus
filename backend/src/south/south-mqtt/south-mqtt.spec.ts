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
import { createConnectionOptions, createContent, parseMessage } from '../../service/utils-mqtt';
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
          topic: 'my/first/topic',
          valueType: 'number'
        },
        scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          topic: 'my/+/+/topic/with/wildcard/#',
          valueType: 'string'
        },
        scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          topic: 'my/wrong/topic////',
          valueType: 'string'
        },
        scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
      },
      {
        id: 'id4',
        name: 'item4',
        enabled: true,
        settings: {
          topic: 'json/topic',
          valueType: 'json',
          jsonPayload: {
            useArray: true,
            dataArrayPath: '',
            pointIdOrigin: 'oibus',
            valuePath: 'received.value',
            otherFields: [
              { name: 'appId', path: 'received.appId' },
              { name: 'messageType', path: 'received.message.type' }
            ],
            timestampOrigin: 'payload',
            timestampPayload: {
              timestampPath: 'received.timestamp',
              timestampType: 'string',
              timezone: 'Europe/Paris',
              timestampFormat: 'yyyy-MM-dd HH:mm:ss'
            }
          }
        },
        scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
      },
      {
        id: 'id5',
        name: 'item5',
        enabled: true,
        settings: {
          topic: 'json/topic',
          valueType: 'json',
          jsonPayload: {
            useArray: false,
            dataArrayPath: '',
            pointIdOrigin: 'payload',
            pointIdPath: 'received.reference',
            valuePath: 'received.value',
            otherFields: [
              { name: 'appId', path: 'received.appId' },
              { name: 'messageType', path: 'received.message.type' }
            ],
            timestampOrigin: 'payload',
            timestampPayload: {
              timestampPath: 'received.timestamp',
              timestampType: 'unix-epoch-ms'
            }
          }
        },
        scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
      },
      {
        id: 'id6',
        name: 'item6',
        enabled: true,
        settings: {
          topic: 'json/topic',
          valueType: 'json',
          jsonPayload: {
            useArray: true,
            dataArrayPath: 'myArray',
            pointIdOrigin: 'payload',
            pointIdPath: 'received.reference',
            valuePath: 'received.value',
            otherFields: [
              { name: 'appId', path: 'received.appId' },
              { name: 'messageType', path: 'received.message.type' }
            ],
            timestampOrigin: 'oibus'
          }
        },
        scanMode: { id: 'subscription', name: 'subscription', description: '', cron: '' }
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
    mqttStream.removeAllListeners();
  });

  it('should properly connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    south.subscribe = jest.fn();
    south.disconnect = jest.fn();
    (parseMessage as jest.Mock).mockReturnValueOnce({});
    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await south.connect();
    expect(createConnectionOptions).toHaveBeenCalledWith(configuration.id, configuration.settings, logger);
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.url, {});
    expect(logger.info).toHaveBeenCalledWith(`MQTT South connector "south" connected`);
    south['connector'].settings.maxNumberOfMessages = 10;
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises(); // Flush message promise

    expect(parseMessage).not.toHaveBeenCalled();
    south['connector'].settings.maxNumberOfMessages = 1;
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });

    await flushPromises(); // Flush message promise
    expect(logger.trace).toHaveBeenCalledWith('MQTT message for topic myTopic: myMessage, dup:false, qos:1, retain:false');
    expect(parseMessage).toHaveBeenCalledTimes(2); // two messages stored
    expect(parseMessage).toHaveBeenCalledWith('myTopic', 'myMessage', configuration.items, logger);

    (parseMessage as jest.Mock).mockImplementationOnce(() => {
      throw new Error('handle message error');
    });
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises(); // Flush message error promise
    expect(logger.error).toHaveBeenCalledWith('Error when flushing messages: Error: handle message error');

    mqttStream.emit('error', new Error('error'));
    await flushPromises(); // Flush disconnect promise
    expect(logger.error).toHaveBeenCalledWith(`MQTT Client error: ${new Error('error')}`); // Not called because promise is already resolved
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2); // because of flushMessage
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

    await south.start();

    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should not flush message if limit is not trigger', async () => {
    south['connector'].settings.maxNumberOfMessages = 2;
    south.subscribe = jest.fn();
    south.flushMessages = jest.fn();
    south.start();
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

    south.start();
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

    south.start();
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
    const callback = jest.fn();
    south.testItem(configuration.items[0], { history: undefined }, callback);

    await flushPromises();
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises();
    expect(mqttStream.subscribeAsync).toHaveBeenCalledTimes(1);
    expect(mqttStream.subscribeAsync).toHaveBeenCalledWith(configuration.items[0].settings.topic);

    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledTimes(1);
    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledWith(configuration.items[0].settings.topic);
    expect(mqttStream.end).toHaveBeenCalledWith(true);
    expect(createContent).toHaveBeenCalledWith(configuration.items[0], 'myMessage', testData.constants.dates.FAKE_NOW, logger);
    expect(south.disconnect).toHaveBeenCalledTimes(1);
  });

  it('should properly test item and manage unsubscribe error', async () => {
    south.disconnect = jest.fn();
    mqttStream.unsubscribeAsync = jest.fn().mockImplementationOnce(() => {
      throw new Error('unsubscribe error');
    });
    const callback = jest.fn();
    let error;
    south.testItem(configuration.items[0], { history: undefined }, callback).catch(err => (error = err));

    await flushPromises();
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises();

    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledTimes(1);
    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledWith(configuration.items[0].settings.topic);
    expect(mqttStream.end).not.toHaveBeenCalled();
    expect(createContent).not.toHaveBeenCalled();
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
    const callback = jest.fn();
    let error;
    south.testItem(configuration.items[0], { history: undefined }, callback).catch(err => (error = err));

    await flushPromises();

    expect(createContent).not.toHaveBeenCalled();
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(error).toEqual(`Error when testing item ${configuration.items[0].settings.topic}: subscribe error`);
  });
});
