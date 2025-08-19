import ConnectionServiceMock from '../../tests/__mocks__/service/connection-service.mock';
import Stream from 'node:stream';
import mqtt from 'mqtt';
import SouthMQTT from './south-mqtt';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { SouthConnectorDTO } from '../../../shared/model/south-connector.model';
import { SouthMQTTItemSettings, SouthMQTTSettings } from '../../../shared/model/south-settings.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { flushPromises, mockBaseFolders } from '../../tests/utils/test-utils';
import { createConnectionOptions, createContent, parseMessage } from '../../service/utils-mqtt';
import { connectionService } from '../../service/connection.service';
import MqttClient, { ISubscriptionMap } from 'mqtt/lib/client';
import testData from '../../tests/utils/test-data';

jest.mock('mqtt');
jest.mock('node:fs/promises');
jest.mock('../../service/utils');
jest.mock('../../service/utils-mqtt');

const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);
jest.mock('../../service/connection.service', () => ({
  connectionService: new ConnectionServiceMock('', '')
}));

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

describe('SouthMQTT without authentication', () => {
  let south: SouthMQTT;
  const configuration: SouthConnectorDTO<SouthMQTTSettings, SouthMQTTItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'mqtt',
    description: 'my test connector',
    enabled: true,
    settings: {
      sharedConnection: null,
      connectionSettings: {
        url: 'mqtt://localhost:1883',
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
        rejectUnauthorized: false
      },
      retryInterval: 1000,
      readTimeout: 1000,
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
          valueType: 'number',
          qos: '1'
        },
        scanModeId: 'subscription'
      }
    ]
  };
  const mqttStream = new CustomStream();
  mqttStream.subscribeAsync = jest.fn();
  mqttStream.end = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);
    mqttStream.removeAllListeners();
    (mqtt.connectAsync as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(
      configuration,
      addContentCallback,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should properly connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    south.subscribe = jest.fn();
    south.disconnect = jest.fn();
    (parseMessage as jest.Mock).mockReturnValueOnce({});
    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await south.start();
    expect(createConnectionOptions).toHaveBeenCalledWith(configuration.id, configuration.settings.connectionSettings, logger);
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.connectionSettings!.url, {});
    expect(logger.info).toHaveBeenCalledWith(`Connected to ${configuration.settings.connectionSettings!.url}`);
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
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.connectionSettings!.url, {});
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2); // because of reconnectTimeout and flushTimeout
  });

  it('should properly connect and manage unintentional close event', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    south.subscribe = jest.fn();

    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await south.connect();
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.connectionSettings!.url, {});
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
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.connectionSettings!.url, {});
    south['disconnecting'] = true;
    mqttStream.emit('close');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('MQTT Client intentionally disconnected');
  });

  it('should properly manage connect error and reconnect', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const error = new Error('connect error');
    south.getSession = jest.fn().mockImplementationOnce(() => {
      throw error;
    });
    south.disconnect = jest.fn();

    await south.start();

    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(south.disconnect).toHaveBeenCalledWith(error);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should properly manage connect error and not reconnect if disabled', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const error = new Error('connect error');
    south.getSession = jest.fn().mockImplementationOnce(() => {
      throw error;
    });
    south.disconnect = jest.fn();
    south['connector'].enabled = false;

    await south.start();

    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(south.disconnect).toHaveBeenCalledWith(error);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly get session if shared connection', async () => {
    south['connector'].settings.sharedConnection = {
      connectorType: 'north',
      connectorId: 'northId'
    };
    (connectionService.getConnection as jest.Mock).mockReturnValueOnce({});
    expect(await south.getSession()).toEqual({});
    expect(connectionService.getConnection).toHaveBeenCalledWith('north', 'northId');
  });

  it('should properly get client session if already set', async () => {
    south.createSession = jest.fn();
    south['client'] = mqttStream as unknown as MqttClient.MqttClient;
    expect(await south.getSession()).toEqual(mqttStream);
    expect(connectionService.getConnection).not.toHaveBeenCalled();
    expect(south.createSession).not.toHaveBeenCalled();
  });

  it('should properly throw error if session not retrieved', async () => {
    south['connector'].settings.sharedConnection = {
      connectorType: 'north',
      connectorId: 'northId'
    };
    (connectionService.getConnection as jest.Mock).mockReturnValueOnce(null);
    await expect(south.getSession()).rejects.toThrow(new Error('Could not connect client'));
    expect(connectionService.getConnection).toHaveBeenCalledWith('north', 'northId');
  });

  it('should properly close session', async () => {
    south['client'] = mqttStream as unknown as MqttClient.MqttClient;
    await south.closeSession();
    expect(mqttStream.end).toHaveBeenCalledTimes(1);

    south['client'] = null;
    await south.closeSession();
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
  });

  it('should properly disconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    south.flushMessages = jest.fn();
    await south.disconnect();

    expect(logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...');
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly disconnect and clear timeout', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const client = { end: jest.fn() } as unknown as MqttClient.MqttClient;
    south.closeSession = jest.fn();
    south['client'] = client;
    south['connector'].settings.sharedConnection = null;
    (connectionService.isConnectionUsed as jest.Mock).mockReturnValueOnce(true);
    south['reconnectTimeout'] = setTimeout(() => null);
    south['flushTimeout'] = setTimeout(() => null);
    south.flushMessages = jest.fn();

    await south.disconnect(new Error('error'));

    expect(logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...');
    expect(south.closeSession).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  });

  it('should properly disconnect with shared connection', async () => {
    south['client'] = mqttStream as unknown as MqttClient.MqttClient;
    (connectionService.isConnectionUsed as jest.Mock).mockReturnValueOnce(false);
    south['connector'].settings.sharedConnection = {
      connectorType: 'north',
      connectorId: 'northId'
    };

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    south['reconnectTimeout'] = setTimeout(() => null);
    south['flushTimeout'] = setTimeout(() => null);
    south.flushMessages = jest.fn();
    await south.disconnect();

    expect(south.getSharedConnectionSettings()).toEqual({
      connectorType: 'north',
      connectorId: 'northId'
    });

    expect(connectionService.closeSession).toHaveBeenCalledWith('north', 'northId', configuration.id, false);
    expect(logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...');
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  });

  it('should properly test connection', async () => {
    south.getSession = jest.fn();
    south.disconnect = jest.fn();
    await south.testConnection();
    expect(south.getSession).toHaveBeenCalledTimes(1);
    expect(south.disconnect).toHaveBeenCalledTimes(1);
  });

  it('should properly test item', async () => {
    south.getSession = jest.fn().mockReturnValueOnce(mqttStream);
    south.disconnect = jest.fn();
    mqttStream.unsubscribeAsync = jest.fn();
    const callback = jest.fn();
    south.testItem(configuration.items[0], {}, callback);

    await flushPromises();
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises();
    expect(south.getSession).toHaveBeenCalledTimes(1);
    expect(mqttStream.subscribeAsync).toHaveBeenCalledTimes(1);
    expect(mqttStream.subscribeAsync).toHaveBeenCalledWith(configuration.items[0].settings.topic);

    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledTimes(1);
    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledWith(configuration.items[0].settings.topic);
    expect(mqttStream.end).toHaveBeenCalledWith(true);
    expect(createContent).toHaveBeenCalledWith(configuration.items[0], 'myMessage', testData.constants.dates.FAKE_NOW, logger);
    expect(south.disconnect).toHaveBeenCalledTimes(1);
  });

  it('should properly test item and manage unsubscribe error', async () => {
    south.getSession = jest.fn().mockReturnValueOnce(mqttStream);
    south.disconnect = jest.fn();
    mqttStream.unsubscribeAsync = jest.fn().mockImplementationOnce(() => {
      throw new Error('unsubscribe error');
    });
    const callback = jest.fn();
    let error;
    south.testItem(configuration.items[0], {}, callback).catch(err => (error = err));

    await flushPromises();
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises();
    expect(south.getSession).toHaveBeenCalledTimes(1);

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
    south.getSession = jest.fn().mockReturnValueOnce(mqttStream);
    south.disconnect = jest.fn();
    mqttStream.subscribeAsync = jest.fn().mockImplementationOnce(() => {
      throw new Error('subscribe error');
    });
    const callback = jest.fn();
    let error;
    south.testItem(configuration.items[0], {}, callback).catch(err => (error = err));

    await flushPromises();
    expect(south.getSession).toHaveBeenCalledTimes(1);

    expect(createContent).not.toHaveBeenCalled();
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(error).toEqual(`Error when testing item ${configuration.items[0].settings.topic}: subscribe error`);
  });

  it('should properly subscribe', async () => {
    south['client'] = mqttStream as unknown as MqttClient.MqttClient;
    await south.subscribe(configuration.items);
    expect(mqttStream.subscribeAsync).toHaveBeenCalledTimes(1);
    const expectedSubscriptions: ISubscriptionMap = {};

    expectedSubscriptions[configuration.items[0].settings.topic] = { qos: 1 };
    expect(mqttStream.subscribeAsync).toHaveBeenCalledWith(expectedSubscriptions);
  });

  it('should properly log error on subscribe error', async () => {
    south['client'] = mqttStream as unknown as MqttClient.MqttClient;
    mqttStream.subscribeAsync = jest.fn().mockImplementationOnce(() => {
      throw new Error('subscribe error');
    });
    await south.subscribe(configuration.items);
    expect(mqttStream.subscribeAsync).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`Subscription error: subscribe error`);
  });

  it('should properly log error on subscribe when client not set', async () => {
    south['client'] = null;
    await south.subscribe(configuration.items);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`MQTT client could not subscribe to items: client not set`);
  });

  it('should properly unsubscribe', async () => {
    south['client'] = mqttStream as unknown as MqttClient.MqttClient;
    await south.unsubscribe(configuration.items);
    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledTimes(1);
    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledWith(configuration.items.map(item => item.settings.topic));
  });

  it('should properly log error on unsubscribe error', async () => {
    south['client'] = mqttStream as unknown as MqttClient.MqttClient;
    mqttStream.unsubscribeAsync = jest.fn().mockImplementationOnce(() => {
      throw new Error('unsubscribe error');
    });
    await south.unsubscribe(configuration.items);
    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`Unsubscription error: unsubscribe error`);
  });

  it('should properly log error on unsubscribe when client not set', async () => {
    south['client'] = null;
    await south.unsubscribe(configuration.items);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(`MQTT client is not set. Nothing to unsubscribe`);
  });

  it('should properly do not flush if no message', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    south['bufferedMessages'] = [];
    south['flushTimeout'] = null;

    await south.flushMessages();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });
});
