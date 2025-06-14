import Stream from 'node:stream';
import fs from 'node:fs/promises';

import mqtt from 'mqtt';

import SouthMQTT from './south-mqtt';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { SouthConnectorDTO } from '../../../shared/model/south-connector.model';
import { SouthMQTTItemSettings, SouthMQTTSettings } from '../../../shared/model/south-settings.model';
import * as utils from '../../service/utils';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import testData from '../../tests/utils/test-data';
import { flushPromises, mockBaseFolders } from '../../tests/utils/test-utils';

jest.mock('mqtt');
jest.mock('node:fs/promises');
jest.mock('../../service/utils');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
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
        scanModeId: 'subscription'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          topic: 'my/+/+/topic/with/wildcard/#',
          valueType: 'string'
        },
        scanModeId: 'subscription'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          topic: 'my/wrong/topic////',
          valueType: 'string'
        },
        scanModeId: 'subscription'
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
        scanModeId: 'subscription'
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
        scanModeId: 'subscription'
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
        scanModeId: 'subscription'
      }
    ]
  };
  const mqttStream = new CustomStream();
  mqttStream.subscribeAsync = jest.fn();
  mqttStream.end = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);
    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should properly connect', async () => {
    south.subscribe = jest.fn();
    south.parseMessage = jest.fn();
    south.start();
    const expectedOptions = {
      clean: !configuration.settings.persistent,
      clientId: configuration.id,
      rejectUnauthorized: false,
      connectTimeout: 1000,
      reconnectPeriod: 0,
      queueQoSZero: false,
      resubscribe: configuration.settings.persistent,
      log: expect.any(Function)
    };
    await flushPromises();
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);
    mqttStream.emit('connect');
    expect(logger.info).toHaveBeenCalledWith(`Connected to ${configuration.settings.url}`);
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false, qos: 1, retain: false });
    await flushPromises(); // Flush disconnect promise
    expect(logger.trace).toHaveBeenCalledWith('MQTT message for topic myTopic: myMessage, dup:false, qos:1, retain:false');
    expect(south.parseMessage).toHaveBeenCalledTimes(1);
    expect(south.parseMessage).toHaveBeenCalledWith('myTopic', 'myMessage');

    (south.parseMessage as jest.Mock).mockImplementationOnce(() => {
      throw new Error('handle message error');
    });
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises(); // Flush disconnect promise
    expect(logger.error).toHaveBeenCalledWith('Error when flushing messages: Error: handle message error');

    mqttStream.emit('error', new Error('error'));
    await flushPromises(); // Flush disconnect promise
    expect(logger.error).toHaveBeenCalledWith(`MQTT Client error: ${new Error('error')}`); // Not called because promise is already resolved
  });

  it('should properly disconnect', async () => {
    await south.disconnect();

    expect(logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...');
  });

  it('should properly manage clear timeout', async () => {
    south['reconnectTimeout'] = setTimeout(() => null);
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    south.connectToBroker = jest.fn().mockImplementationOnce(() => {
      throw new Error('connect error');
    });
    await south.connect();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`Connection error: ${new Error('connect error')}`);

    south['reconnectTimeout'] = setTimeout(() => null);
    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(3);
  });

  it('should properly manage reconnection on connection failure', async () => {
    south.connect = jest.fn();
    south.disconnect = jest.fn().mockImplementationOnce(() => Promise.resolve());
    south.connectToBroker({
      clean: !configuration.settings.persistent,
      clientId: configuration.id,
      rejectUnauthorized: false,
      connectTimeout: 1000,
      reconnectPeriod: 1000,
      queueQoSZero: false
    });
    mqttStream.emit('error', new Error('error'));
    await flushPromises();
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`MQTT Client error: ${new Error('error')}`);
  });

  it('should properly manage reconnection on connection close', async () => {
    south.connect = jest.fn();
    south.disconnect = jest.fn().mockImplementationOnce(() => Promise.resolve());
    south.connectToBroker({
      clean: !configuration.settings.persistent,
      clientId: configuration.id,
      rejectUnauthorized: false,
      connectTimeout: 1000,
      reconnectPeriod: 1000,
      queueQoSZero: false
    });
    south['disconnecting'] = true;
    mqttStream.emit('close');
    await flushPromises();
    expect(south['reconnectTimeout']).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith('MQTT Client intentionally disconnected');

    south.connectToBroker({
      clean: !configuration.settings.persistent,
      clientId: configuration.id,
      rejectUnauthorized: false,
      connectTimeout: 1000,
      reconnectPeriod: 1000,
      queueQoSZero: false
    });
    south['disconnecting'] = false;
    mqttStream.emit('close');
    await flushPromises();
    expect(south['reconnectTimeout']).not.toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(`MQTT Client closed unintentionally`);
  });
});

describe('SouthMQTT with Basic Auth', () => {
  let south: SouthMQTT;
  const configuration: SouthConnectorDTO<SouthMQTTSettings, SouthMQTTItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'mqtt',
    description: 'my test connector',
    enabled: true,
    settings: {
      url: 'mqtt://localhost:1883',
      qos: '0',
      authentication: {
        type: 'basic',
        username: 'username',
        password: 'pass'
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
        scanModeId: 'subscription'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          topic: 'my/+/+/topic/with/wildcard/#',
          valueType: 'string'
        },
        scanModeId: 'subscription'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          topic: 'my/wrong/topic////',
          valueType: 'string'
        },
        scanModeId: 'subscription'
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
        scanModeId: 'subscription'
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
        scanModeId: 'subscription'
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
        scanModeId: 'subscription'
      }
    ]
  };

  const mqttStream = new CustomStream();
  mqttStream.subscribeAsync = jest.fn();
  mqttStream.unsubscribeAsync = jest.fn();
  mqttStream.end = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);
    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should properly connect', async () => {
    south.start();
    south.subscribe = jest.fn();
    south.parseMessage = jest.fn();
    await flushPromises();
    const expectedOptions = {
      clientId: configuration.id,
      rejectUnauthorized: false,
      username: 'username',
      password: 'pass',
      connectTimeout: 1000,
      reconnectPeriod: 0,
      queueQoSZero: false,
      log: expect.any(Function),
      resubscribe: false
    };
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);
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

  it('should check wildcard', () => {
    expect(south.wildcardTopic('/my/topic', '/my/topic')).toEqual([]);
    expect(south.wildcardTopic('/my/topic', '#')).toEqual(['/my/topic']);
    expect(south.wildcardTopic('/my/test/topic', '/my/+/topic')).toEqual(['test']);
    expect(south.wildcardTopic('/my/topic/test', '/my/topic/#')).toEqual(['test']);
    expect(south.wildcardTopic('/my/topic/test/leaf', '/my/topic/#')).toEqual(['test/leaf']);
    expect(south.wildcardTopic('/my/topic/test', '/my/topic/wrong/with/more/fields')).toEqual(null);
    expect(south.wildcardTopic('/my/topic/test', '/my/topic/test/with/more/fields')).toEqual(null);
  });

  it('should get timestamp', () => {
    expect(
      south.getTimestamp({}, configuration.items[3].settings.jsonPayload!.timestampPayload!, testData.constants.dates.FAKE_NOW)
    ).toEqual(testData.constants.dates.FAKE_NOW);
    expect(logger.warn).toHaveBeenCalledWith(
      `Timestamp not found for path ${configuration.items[3].settings.jsonPayload!.timestampPayload!.timestampPath!} in ${JSON.stringify(
        {}
      )}. Using OIBus timestamp "${testData.constants.dates.FAKE_NOW}" instead`
    );

    (utils.convertDateTimeToInstant as jest.Mock).mockImplementation(instant => instant);
    expect(
      south.getTimestamp(
        { received: { timestamp: '2023-01-01T00:00:00.000Z' } },
        configuration.items[3].settings.jsonPayload!.timestampPayload!,
        testData.constants.dates.FAKE_NOW
      )
    ).toEqual('2023-01-01T00:00:00.000Z');
  });

  it('should get pointId', () => {
    expect(south.getPointId({}, configuration.items[5].settings.jsonPayload!.pointIdPath!, configuration.items[5].name)).toEqual(
      configuration.items[5].name
    );
    expect(logger.warn).toHaveBeenCalledWith(
      `Point ID not found for path ${configuration.items[5].settings.jsonPayload!.pointIdPath!} in ${JSON.stringify({})}. Using item name "${
        configuration.items[5].name
      }" instead`
    );
    (utils.convertDateTimeToInstant as jest.Mock).mockImplementation(instant => instant);
    expect(
      south.getPointId(
        { received: { reference: 'PointReference' } },
        configuration.items[5].settings.jsonPayload!.pointIdPath!,
        configuration.items[5].name
      )
    ).toEqual('PointReference');
  });

  it('should format value', () => {
    const data = { received: { value: 123, appId: 'my app id', message: { type: 'test' } } };
    south.getPointId = jest.fn().mockImplementation((_data, _path, _name) => _name);
    expect(south.formatValues(configuration.items[4], data, testData.constants.dates.FAKE_NOW)).toEqual([
      {
        pointId: configuration.items[4].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: {
          value: 123,
          appId: 'my app id',
          messageType: 'test'
        }
      }
    ]);
    expect(south.getPointId).toHaveBeenCalledWith(
      data,
      configuration.items[4].settings.jsonPayload!.pointIdPath,
      configuration.items[4].name
    );
  });

  it('should format array values', async () => {
    const data = {
      myArray: [
        { received: { reference: 'reference', value: 123, appId: 'my app id', message: { type: 'test' } } },
        { received: { reference: 'reference', value: 456, appId: 'my app id', message: { type: 'test2' } } }
      ]
    };
    const expectedResults = [
      {
        pointId: 'reference',
        timestamp: testData.constants.dates.FAKE_NOW,
        data: {
          value: 123,
          appId: 'my app id',
          messageType: 'test'
        }
      },
      {
        pointId: 'reference',
        timestamp: testData.constants.dates.FAKE_NOW,
        data: {
          value: 456,
          appId: 'my app id',
          messageType: 'test2'
        }
      }
    ];

    const formattedResults = south.formatValues(configuration.items[5], data, testData.constants.dates.FAKE_NOW);
    expect(formattedResults).toEqual(expectedResults);

    const badItem = JSON.parse(JSON.stringify(configuration.items[5]));
    badItem.settings.jsonPayload.dataArrayPath = 'badArrayPath';
    let error;
    try {
      south.formatValues(badItem, data, testData.constants.dates.FAKE_NOW);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error(`Array not found for path ${badItem.settings.jsonPayload!.dataArrayPath!} in ${JSON.stringify(data)}`));

    try {
      south.formatValues(badItem, { badArrayPath: {} }, testData.constants.dates.FAKE_NOW);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(
      new Error(`Array not found for path ${badItem.settings.jsonPayload!.dataArrayPath!} in ${JSON.stringify({ badArrayPath: {} })}`)
    );
  });

  it('should format array values from root', async () => {
    const data = [
      { received: { reference: 'reference', value: 123, appId: 'my app id', message: { type: 'test' } } },
      { received: { reference: 'reference', value: 456, appId: 'my app id', message: { type: 'test2' } } }
    ];
    const expectedResults = [
      {
        pointId: configuration.items[3].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: {
          value: 123,
          appId: 'my app id',
          messageType: 'test'
        }
      },
      {
        pointId: configuration.items[3].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: {
          value: 456,
          appId: 'my app id',
          messageType: 'test2'
        }
      }
    ];

    const formattedResults = await south.formatValues(configuration.items[3], data, testData.constants.dates.FAKE_NOW);
    expect(formattedResults).toEqual(expectedResults);
  });

  it('should handle message', async () => {
    south.getItem = jest
      .fn()
      .mockReturnValueOnce(configuration.items[0])
      .mockReturnValueOnce(configuration.items[1])
      .mockReturnValue(configuration.items[5]);
    south.addContent = jest.fn();
    expect(south.parseMessage(configuration.items[0].settings.topic, '12')).toEqual([
      {
        pointId: configuration.items[0].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: {
          value: '12'
        }
      }
    ]);

    expect(south.parseMessage(configuration.items[1].settings.topic, 'my value')).toEqual([
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: {
          value: 'my value'
        }
      }
    ]);

    const expectValue = [
      {
        pointId: configuration.items[5].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: {
          value: 'my json value'
        }
      }
    ];
    south.formatValues = jest.fn().mockReturnValue(expectValue);
    expect(south.parseMessage(configuration.items[5].settings.topic, JSON.stringify({ json: 'object' }))).toEqual(expectValue);

    expect(south.parseMessage(configuration.items[5].settings.topic, 'not a json object')).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      `Could not handle message "not a json object" for topic "${configuration.items[5].settings.topic}". SyntaxError: Unexpected token 'o', "not a json object" is not valid JSON`
    );
  });

  it('should test item', async () => {
    const callback = jest.fn();

    south.formatValues = jest.fn().mockReturnValue([
      {
        pointId: 'pointId',
        timestamp: '2024-06-10T14:00:00.000Z',
        data: {
          value: 1234
        }
      }
    ]);

    south.testItem(configuration.items[0], testData.south.itemTestingSettings, callback);
    await flushPromises();
    expect(mqtt.connect).toHaveBeenCalled();
    expect(mqttStream.subscribeAsync).not.toHaveBeenCalled();
    mqttStream.emit('connect');
    expect(mqttStream.subscribeAsync).toHaveBeenCalledTimes(1);
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    await flushPromises();
    expect(mqttStream.unsubscribeAsync).toHaveBeenCalledTimes(1);
    expect(mqttStream.end).toHaveBeenCalledWith(true);
    expect(callback).toHaveBeenCalledWith({
      type: 'time-values',
      content: [{ data: { value: 'myMessage' }, pointId: configuration.items[0].name, timestamp: testData.constants.dates.FAKE_NOW }]
    });
  });

  it('should test item and reject on parse error', async () => {
    const callback = jest.fn();

    south['createContent'] = jest.fn().mockImplementationOnce(() => {
      throw new Error('format error');
    });

    const promise = south.testItem(configuration.items[0], testData.south.itemTestingSettings, callback);
    await flushPromises(); // flush options async
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    let error;
    promise.then().catch(err => (error = err));
    await flushPromises(); // flush unsubscribe
    expect(callback).not.toHaveBeenCalled();
    expect(error).toEqual('Error when testing item my/first/topic while parsing message myMessage: format error');
  });

  it('should test item and reject on sub error', async () => {
    const customMqttStream = new CustomStream();
    customMqttStream.subscribeAsync = jest.fn().mockImplementationOnce(() => {
      throw new Error('subscribeAsync error');
    });

    (mqtt.connect as jest.Mock).mockImplementationOnce(() => customMqttStream);

    const callback = jest.fn();

    const promise = south.testItem(configuration.items[0], testData.south.itemTestingSettings, callback);
    let error;
    promise.then().catch(err => (error = err));
    await flushPromises(); // flush options async
    customMqttStream.emit('connect');
    await flushPromises(); // flush sub async
    expect(callback).not.toHaveBeenCalled();
    expect(error).toEqual('Error while subscribing to my/first/topic: subscribeAsync error');
  });

  it('should test item and reject on conn error', async () => {
    south.subscribe = jest.fn();
    south.unsubscribe = jest.fn();
    south.disconnect = jest.fn();
    const callback = jest.fn();

    south.testItem(configuration.items[0], testData.south.itemTestingSettings, callback);
    mqttStream.emit('error', 'connect error');
  });

  it('should get item', async () => {
    const item = JSON.parse(JSON.stringify(configuration.items[1]));
    south.wildcardTopic = jest
      .fn()
      .mockReturnValueOnce(['bad', 'topic'])
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(['+', '+', '#'])
      .mockReturnValueOnce(['+', '+', '#'])
      .mockReturnValue([]);
    (southConnectorRepository.findAllItemsForSouth as jest.Mock)
      .mockReturnValueOnce([item])
      .mockReturnValueOnce([item])
      .mockReturnValueOnce([item, { ...item, id: 'anotherId' }])
      .mockReturnValueOnce([])
      .mockReturnValue([configuration.items[0]]);

    south.subscribe = jest.fn();
    south.unsubscribe = jest.fn();
    south.start();
    await flushPromises();
    await south.onItemChange();
    expect(() => south.getItem(item.settings.topic)).toThrow(new Error(`Item can't be determined from topic ${item.settings.topic}`));

    south.start();
    await flushPromises();
    await south.onItemChange();
    expect(() => south.getItem(item.settings.topic)).toThrow(new Error(`Item can't be determined from topic ${item.settings.topic}`));

    south.start();
    await flushPromises();
    await south.onItemChange();
    expect(() => south.getItem(item.settings.topic)).toThrow(
      new Error(
        `Topic "${item.settings.topic}" should be subscribed only once but it has the following subscriptions: ${JSON.stringify([
          item,
          { ...item, id: 'anotherId' }
        ])}`
      )
    );

    south.start();
    await flushPromises();
    await south.onItemChange();
    expect(() => south.getItem(item.settings.topic)).toThrow(new Error(`Item can't be determined from topic ${item.settings.topic}`));

    south.start();
    await flushPromises();
    await south.onItemChange();
    expect(south.getItem(configuration.items[0].settings.topic)).toEqual(configuration.items[0]);
  });
});

describe('SouthMQTT with Cert', () => {
  let south: SouthMQTT;
  const configuration: SouthConnectorDTO<SouthMQTTSettings, SouthMQTTItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'mqtt',
    description: 'my test connector',
    enabled: true,
    settings: {
      url: 'mqtt://localhost:1883',
      qos: '0',
      authentication: {
        type: 'cert',
        certFilePath: 'myCert',
        keyFilePath: 'myKey',
        caFilePath: 'myCa',
        username: '',
        password: ''
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
        scanModeId: 'subscription'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          topic: 'my/+/+/topic/with/wildcard/#',
          valueType: 'string'
        },
        scanModeId: 'subscription'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          topic: 'my/wrong/topic////',
          valueType: 'string'
        },
        scanModeId: 'subscription'
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
        scanModeId: 'subscription'
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
        scanModeId: 'subscription'
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
        scanModeId: 'subscription'
      }
    ]
  };

  const mqttStream = new CustomStream();
  mqttStream.subscribeAsync = jest.fn();
  mqttStream.end = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);
    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should properly connect', async () => {
    (fs.readFile as jest.Mock).mockReturnValueOnce('myCert').mockReturnValueOnce('myKey').mockReturnValueOnce('myCa');
    south.subscribe = jest.fn();
    south.parseMessage = jest.fn();
    south.start();

    await flushPromises();
    const expectedOptions = {
      clientId: configuration.id,
      rejectUnauthorized: false,
      cert: 'myCert',
      key: 'myKey',
      ca: 'myCa',
      connectTimeout: 1000,
      reconnectPeriod: 0,
      queueQoSZero: false,
      log: expect.any(Function),
      resubscribe: false
    };
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);

    await south.disconnect();
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
  });
});

describe('SouthMQTT without Cert', () => {
  let south: SouthMQTT;
  const configuration: SouthConnectorDTO<SouthMQTTSettings, SouthMQTTItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'mqtt',
    description: 'my test connector',
    enabled: true,
    settings: {
      url: 'mqtt://localhost:1883',
      qos: '0',
      authentication: {
        type: 'cert',
        certFilePath: '',
        keyFilePath: '',
        caFilePath: '',
        username: '',
        password: ''
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
        scanModeId: 'subscription'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          topic: 'my/+/+/topic/with/wildcard/#',
          valueType: 'string'
        },
        scanModeId: 'subscription'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          topic: 'my/wrong/topic////',
          valueType: 'string'
        },
        scanModeId: 'subscription'
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
        scanModeId: 'subscription'
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
        scanModeId: 'subscription'
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
        scanModeId: 'subscription'
      }
    ]
  };

  const mqttStream = new CustomStream();
  mqttStream.subscribeAsync = jest.fn();
  mqttStream.end = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);
    mqttStream.removeAllListeners();
    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should properly connect', async () => {
    south.subscribe = jest.fn();
    south.parseMessage = jest.fn();
    south.start();

    await flushPromises();
    const expectedOptions = {
      clientId: 'southId',
      rejectUnauthorized: false,
      cert: '',
      key: '',
      ca: '',
      connectTimeout: 1000,
      reconnectPeriod: 0,
      queueQoSZero: false,
      log: expect.any(Function),
      resubscribe: false
    };
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);
  });

  it('should properly test connection to broker', async () => {
    const options = {
      clientId: 'oibus-test',
      rejectUnauthorized: false,
      cert: '',
      key: '',
      ca: '',
      connectTimeout: 1000,
      reconnectPeriod: 0,
      queueQoSZero: false,
      log: expect.any(Function),
      resubscribe: false
    };
    south.createConnectionOptions = jest.fn().mockReturnValueOnce(options);
    (mqttStream.end as jest.Mock).mockClear();
    south.testConnection();
    await flushPromises();
    mqttStream.emit('connect');
    expect(mqttStream.end).toHaveBeenCalledWith(true);
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(`Connection test to "${configuration.settings.url}" successful`);
    await flushPromises();
  });

  it('should properly fail test connection', async () => {
    const options = {
      clientId: 'oibus-test',
      rejectUnauthorized: false,
      cert: '',
      key: '',
      ca: '',
      connectTimeout: 1000,
      reconnectPeriod: 1000,
      queueQoSZero: false
    };
    south.createConnectionOptions = jest.fn().mockReturnValueOnce(options);
    mqttStream.end = jest.fn();
    south.testConnection().catch(() => null);
    await flushPromises();
    mqttStream.emit('error', new Error('connection error'));
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, options);
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
    expect(mqttStream.end).toHaveBeenCalledWith(true);
    expect(logger.error).toHaveBeenCalledWith(`MQTT connection error. ${new Error('connection error')}`);
    await flushPromises();
  });

  it('should log mqtt message', () => {
    south.mqttLog('log 1', { test: 'log2' });
    expect(logger.trace).toHaveBeenCalledWith(`log 1 ${JSON.stringify({ test: 'log2' })}`);
  });
});
