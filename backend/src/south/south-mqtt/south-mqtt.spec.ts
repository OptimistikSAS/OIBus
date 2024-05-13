import Stream from 'node:stream';
import fs from 'node:fs/promises';

import mqtt from 'mqtt';

import SouthMQTT from './south-mqtt';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import { SouthMQTTItemSettings, SouthMQTTSettings } from '../../../../shared/model/south-settings.model';
import * as utils from '../../service/utils';

jest.mock('mqtt');
jest.mock('node:fs/promises');
jest.mock('../../service/utils');

const database = new DatabaseMock();
jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return {
        createSouthCacheScanModeTable: jest.fn(),
        southCacheRepository: {
          database
        }
      };
    }
);

jest.mock(
  '../../service/south-connector-metrics.service',
  () =>
    function () {
      return {
        initMetrics: jest.fn(),
        updateMetrics: jest.fn(),
        get stream() {
          return { stream: 'myStream' };
        },
        metrics: {
          numberOfValuesRetrieved: 1,
          numberOfFilesRetrieved: 1
        }
      };
    }
);

const addContentCallback = jest.fn();
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);
const logger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const items: Array<SouthConnectorItemDTO<SouthMQTTItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    connectorId: 'southId',
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
    connectorId: 'southId',
    settings: {
      topic: 'my/+/#/topic/with/wildcard/#',
      valueType: 'string'
    },
    scanModeId: 'subscription'
  },
  {
    id: 'id3',
    name: 'item3',
    enabled: true,
    connectorId: 'southId',
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
    connectorId: 'southId',
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
    connectorId: 'southId',
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
    connectorId: 'southId',
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
];

class CustomStream extends Stream {
  constructor() {
    super();
  }

  subscribe() {}

  unsubscribe() {}

  end() {}
}

let south: SouthMQTT;
const nowDateString = '2020-02-02T02:02:02.222Z';

describe('SouthMQTT without authentication', () => {
  const configuration: SouthConnectorDTO<SouthMQTTSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
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
      rejectUnauthorized: false
    }
  };
  const mqttStream = new CustomStream();
  mqttStream.subscribe = jest.fn();
  mqttStream.end = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);
    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should properly connect', async () => {
    await south.start();
    south.subscribe = jest.fn();
    south.handleMessage = jest.fn();
    const expectedOptions = {
      clean: !configuration.settings.persistent,
      clientId: configuration.id,
      rejectUnauthorized: false,
      connectTimeout: 1000,
      reconnectPeriod: 1000
    };
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);
    mqttStream.emit('connect');
    expect(logger.info).toHaveBeenCalledWith(`Connected to ${configuration.settings.url}`);
    mqttStream.emit('error', new Error('error'));
    expect(logger.error).toHaveBeenCalledWith(`MQTT connection error ${new Error('error')}`);
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    expect(logger.trace).toHaveBeenCalledWith('MQTT message for topic myTopic: myMessage, dup:false');
    expect(south.handleMessage).toHaveBeenCalledTimes(1);
    expect(south.handleMessage).toHaveBeenCalledWith('myTopic', 'myMessage');
  });

  it('should properly disconnect', async () => {
    await south.disconnect();

    expect(logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...');
  });
});

describe('SouthMQTT with Basic Auth', () => {
  const mqttStream = new CustomStream();
  mqttStream.subscribe = jest.fn();
  mqttStream.end = jest.fn();
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      url: 'mqtt://localhost:1883',
      qos: 0,
      persistent: true,
      authentication: {
        type: 'basic',
        username: 'username',
        password: 'pass'
      },
      connectTimeout: 1000,
      reconnectPeriod: 1000,
      caPath: '',
      rejectUnauthorized: false,
      dataArrayPath: null,
      pointIdPath: 'name',
      qualityPath: 'quality',
      valuePath: 'value',
      timestampOrigin: 'oibus',
      timestampPath: 'timestamp',
      timestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
      timestampTimezone: 'Europe/Paris'
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);
    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should properly connect', async () => {
    await south.start();
    south.subscribe = jest.fn();
    south.handleMessage = jest.fn();
    const expectedOptions = {
      clientId: configuration.id,
      rejectUnauthorized: false,
      username: 'username',
      password: 'pass',
      connectTimeout: 1000,
      reconnectPeriod: 1000
    };
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);
  });

  it('should not subscribe if client is not set', async () => {
    await south.subscribe(items);
    expect(logger.error).toHaveBeenCalledWith('MQTT client could not subscribe to items: client not set');
  });

  it('should properly subscribe when client is set', async () => {
    mqttStream.subscribe = jest
      .fn()
      .mockImplementationOnce((_topic, _options, callback) => {
        callback('subscription error');
      })
      .mockImplementation((_topic, _options, callback) => {
        callback();
      });

    await south.start();
    await south.subscribe(items);
    expect(logger.error).toHaveBeenCalledWith(`Error in MQTT subscription for topic ${items[0].settings.topic}. subscription error`);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(mqttStream.subscribe).toHaveBeenCalledTimes(6);
    expect(mqttStream.subscribe).toHaveBeenCalledWith(items[0].settings.topic, { qos: configuration.settings.qos }, expect.any(Function));
    expect(mqttStream.subscribe).toHaveBeenCalledWith(items[1].settings.topic, { qos: configuration.settings.qos }, expect.any(Function));
    expect(mqttStream.subscribe).toHaveBeenCalledWith(items[2].settings.topic, { qos: configuration.settings.qos }, expect.any(Function));
    expect(mqttStream.subscribe).toHaveBeenCalledWith(items[3].settings.topic, { qos: configuration.settings.qos }, expect.any(Function));
    expect(mqttStream.subscribe).toHaveBeenCalledWith(items[4].settings.topic, { qos: configuration.settings.qos }, expect.any(Function));
    expect(mqttStream.subscribe).toHaveBeenCalledWith(items[5].settings.topic, { qos: configuration.settings.qos }, expect.any(Function));
  });

  it('should not unsubscribe if client is not set', async () => {
    await south.unsubscribe(items);
    expect(logger.warn).toHaveBeenCalledWith('MQTT client is not set. Nothing to unsubscribe');
  });

  it('should properly unsubscribe when client is set', async () => {
    mqttStream.unsubscribe = jest.fn();

    await south.start();
    await south.unsubscribe(items);
    expect(mqttStream.unsubscribe).toHaveBeenCalledTimes(6);
    expect(mqttStream.unsubscribe).toHaveBeenCalledWith(items[0].settings.topic);
    expect(mqttStream.unsubscribe).toHaveBeenCalledWith(items[1].settings.topic);
    expect(mqttStream.unsubscribe).toHaveBeenCalledWith(items[2].settings.topic);
    expect(mqttStream.unsubscribe).toHaveBeenCalledWith(items[3].settings.topic);
    expect(mqttStream.unsubscribe).toHaveBeenCalledWith(items[4].settings.topic);
    expect(mqttStream.unsubscribe).toHaveBeenCalledWith(items[5].settings.topic);
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
    expect(south.getTimestamp({}, items[3].settings.jsonPayload!.timestampPayload!, nowDateString)).toEqual(nowDateString);
    expect(logger.warn).toHaveBeenCalledWith(
      `Timestamp found for path ${items[3].settings.jsonPayload!.timestampPayload!.timestampPath!} in ${JSON.stringify(
        {}
      )}. Using OIBus timestamp "${nowDateString}" instead`
    );

    (utils.convertDateTimeToInstant as jest.Mock).mockImplementation(instant => instant);
    expect(
      south.getTimestamp(
        { received: { timestamp: '2023-01-01T00:00:00.000Z' } },
        items[3].settings.jsonPayload!.timestampPayload!,
        nowDateString
      )
    ).toEqual('2023-01-01T00:00:00.000Z');
  });

  it('should get pointId', () => {
    expect(south.getPointId({}, items[5].settings.jsonPayload!.pointIdPath!, items[5].name)).toEqual(items[5].name);
    expect(logger.warn).toHaveBeenCalledWith(
      `Point ID not found for path ${items[5].settings.jsonPayload!.pointIdPath!} in ${JSON.stringify({})}. Using item name "${
        items[5].name
      }" instead`
    );
    (utils.convertDateTimeToInstant as jest.Mock).mockImplementation(instant => instant);
    expect(
      south.getPointId({ received: { reference: 'PointReference' } }, items[5].settings.jsonPayload!.pointIdPath!, items[5].name)
    ).toEqual('PointReference');
  });

  it('should get item', async () => {
    south.wildcardTopic = jest.fn().mockReturnValueOnce(['bad', 'topic']).mockReturnValueOnce(null).mockReturnValue([]);
    (repositoryService.southItemRepository.listSouthItems as jest.Mock)
      .mockReturnValueOnce([items[1]])
      .mockReturnValueOnce([items[1]])
      .mockReturnValueOnce([items[1], { ...items[1], id: 'anotherId' }])
      .mockReturnValueOnce([])
      .mockReturnValue([items[1]]);

    south.subscribe = jest.fn();
    await south.start();
    await south.onItemChange();
    let error;
    try {
      south.getItem(items[1].settings.topic);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error(`Invalid point configuration: ${JSON.stringify(items[1])}`));

    await south.start();
    await south.onItemChange();
    try {
      south.getItem(items[1].settings.topic);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error(`Item can't be determined from topic ${items[1].settings.topic}`));

    await south.start();
    await south.onItemChange();
    try {
      south.getItem(items[1].settings.topic);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(
      new Error(
        `Topic "${items[1].settings.topic}" should be subscribed only once but it has the following subscriptions: ${JSON.stringify([
          items[1],
          { ...items[1], id: 'anotherId' }
        ])}`
      )
    );

    await south.start();
    await south.onItemChange();
    try {
      south.getItem(items[1].settings.topic);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error(`Item can't be determined from topic ${items[1].settings.topic}`));

    await south.start();
    await south.onItemChange();
    expect(south.getItem(items[1].settings.topic)).toEqual(items[1]);
  });

  it('should format value', () => {
    const data = { received: { value: 123, appId: 'my app id', message: { type: 'test' } } };
    south.getPointId = jest.fn().mockImplementation((_data, _path, _name) => _name);
    expect(south.formatValues(items[4], data, nowDateString)).toEqual([
      {
        pointId: items[4].name,
        timestamp: nowDateString,
        data: {
          value: 123,
          appId: 'my app id',
          messageType: 'test'
        }
      }
    ]);
    expect(south.getPointId).toHaveBeenCalledWith(data, items[4].settings.jsonPayload!.pointIdPath, items[4].name);
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
        timestamp: nowDateString,
        data: {
          value: 123,
          appId: 'my app id',
          messageType: 'test'
        }
      },
      {
        pointId: 'reference',
        timestamp: nowDateString,
        data: {
          value: 456,
          appId: 'my app id',
          messageType: 'test2'
        }
      }
    ];

    const formattedResults = south.formatValues(items[5], data, nowDateString);
    expect(formattedResults).toEqual(expectedResults);

    const badItem = JSON.parse(JSON.stringify(items[5]));
    badItem.settings.jsonPayload.dataArrayPath = 'badArrayPath';
    let error;
    try {
      south.formatValues(badItem, data, nowDateString);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error(`Array not found for path ${badItem.settings.jsonPayload!.dataArrayPath!} in ${JSON.stringify(data)}`));

    try {
      south.formatValues(badItem, { badArrayPath: {} }, nowDateString);
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
        pointId: items[3].name,
        timestamp: nowDateString,
        data: {
          value: 123,
          appId: 'my app id',
          messageType: 'test'
        }
      },
      {
        pointId: items[3].name,
        timestamp: nowDateString,
        data: {
          value: 456,
          appId: 'my app id',
          messageType: 'test2'
        }
      }
    ];

    const formattedResults = await south.formatValues(items[3], data, nowDateString);
    expect(formattedResults).toEqual(expectedResults);
  });

  it('should handle message', async () => {
    south.getItem = jest.fn().mockReturnValueOnce(items[0]).mockReturnValueOnce(items[1]).mockReturnValue(items[5]);
    south.addContent = jest.fn();
    await south.handleMessage(items[0].settings.topic, Buffer.from('12'));
    expect(south.addContent).toHaveBeenCalledWith({
      type: 'time-values',
      content: [
        {
          pointId: items[0].name,
          timestamp: nowDateString,
          data: {
            value: '12'
          }
        }
      ]
    });

    await south.handleMessage(items[1].settings.topic, Buffer.from('my value'));
    expect(south.addContent).toHaveBeenCalledWith({
      type: 'time-values',
      content: [
        {
          pointId: items[1].name,
          timestamp: nowDateString,
          data: {
            value: 'my value'
          }
        }
      ]
    });

    const expectValue = [
      {
        pointId: items[5].name,
        timestamp: nowDateString,
        data: {
          value: 'my json value'
        }
      }
    ];
    south.formatValues = jest.fn().mockReturnValue(expectValue);
    await south.handleMessage(items[5].settings.topic, Buffer.from(JSON.stringify({ json: 'object' })));
    expect(south.addContent).toHaveBeenCalledWith({ type: 'time-values', content: expectValue });

    await south.handleMessage(items[5].settings.topic, Buffer.from('not a json object'));
    expect(logger.error).toHaveBeenCalledWith(
      `Could not handle message "not a json object" for topic "${items[5].settings.topic}". SyntaxError: Unexpected token o in JSON at position 1`
    );
  });
});

describe('SouthMQTT with Cert', () => {
  const mqttStream = new CustomStream();
  mqttStream.subscribe = jest.fn();
  mqttStream.end = jest.fn();
  const configuration: SouthConnectorDTO<SouthMQTTSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      url: 'mqtt://localhost:1883',
      qos: '0',
      persistent: true,
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
      rejectUnauthorized: false
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);
    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should properly connect', async () => {
    (fs.readFile as jest.Mock).mockReturnValueOnce('myCert').mockReturnValueOnce('myKey').mockReturnValueOnce('myCa');
    await south.start();
    south.subscribe = jest.fn();
    south.handleMessage = jest.fn();
    const expectedOptions = {
      clientId: configuration.id,
      rejectUnauthorized: false,
      cert: 'myCert',
      key: 'myKey',
      ca: 'myCa',
      connectTimeout: 1000,
      reconnectPeriod: 1000
    };
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);

    await south.disconnect();
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
  });
});

describe('SouthMQTT without Cert', () => {
  const mqttStream = new CustomStream();
  mqttStream.subscribe = jest.fn();
  mqttStream.end = jest.fn();
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      url: 'mqtt://localhost:1883',
      qos: 0,
      persistent: true,
      authentication: {
        type: 'cert',
        certPath: '',
        keyPath: ''
      },
      connectTimeout: 1000,
      reconnectPeriod: 1000,
      caPath: '',
      rejectUnauthorized: false,
      dataArrayPath: null,
      pointIdPath: 'name',
      qualityPath: 'quality',
      valuePath: 'value',
      timestampOrigin: 'oibus',
      timestampPath: 'timestamp',
      timestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
      timestampTimezone: 'Europe/Paris'
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);
    mqttStream.removeAllListeners();
    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should properly connect', async () => {
    await south.start();
    south.subscribe = jest.fn();
    south.handleMessage = jest.fn();
    const expectedOptions = {
      clientId: 'southId',
      rejectUnauthorized: false,
      cert: '',
      key: '',
      ca: '',
      connectTimeout: 1000,
      reconnectPeriod: 1000
    };
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);
  });

  it('should properly test connection', async () => {
    const expectedOptions = {
      clientId: 'southId',
      rejectUnauthorized: false,
      cert: '',
      key: '',
      ca: '',
      connectTimeout: 1000,
      reconnectPeriod: 1000
    };
    south.testConnectionToBroker = jest.fn();
    await south.testConnection();

    expect(south.testConnectionToBroker).toHaveBeenCalledWith(expectedOptions);
  });

  it('should properly test connection to broker', async () => {
    const options = {
      clientId: 'oibus-test',
      rejectUnauthorized: false,
      cert: '',
      key: '',
      ca: '',
      connectTimeout: 1000,
      reconnectPeriod: 1000
    };
    (mqttStream.end as jest.Mock).mockClear();
    south.testConnectionToBroker(options);
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
      reconnectPeriod: 1000
    };
    mqttStream.end = jest.fn();
    south.testConnectionToBroker(options).catch(() => {});
    mqttStream.emit('error', new Error('connection error'));
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, options);
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
    expect(mqttStream.end).toHaveBeenCalledWith(true);
    expect(logger.error).toHaveBeenCalledWith(`MQTT connection error. ${new Error('connection error')}`);
    await flushPromises();
  });
});
