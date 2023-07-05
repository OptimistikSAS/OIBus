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

jest.mock('mqtt');
jest.mock('node:fs/promises');
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

const addValues = jest.fn();
const addFile = jest.fn();
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);
const logger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const items: Array<SouthConnectorItemDTO<SouthMQTTItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    connectorId: 'southId',
    settings: {
      topic: 'my/first/topic'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    connectorId: 'southId',
    settings: {
      topic: 'my/+/#/topic/with/wildcard/#'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id3',
    name: 'item3',
    connectorId: 'southId',
    settings: {
      topic: 'my/wrong/topic////'
    },
    scanModeId: 'scanModeId2'
  }
];

class CustomStream extends Stream {
  constructor() {
    super();
  }

  subscribe() {}

  end() {}
}

let south: SouthMQTT;

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
      readDelay: 0
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
  const mqttStream = new CustomStream();
  mqttStream.subscribe = jest.fn();
  mqttStream.end = jest.fn();
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder', true);
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
    expect(south.subscribe).toHaveBeenCalledTimes(1);
    mqttStream.emit('error', new Error('error'));
    expect(logger.error).toHaveBeenCalledWith(`MQTT connection error ${new Error('error')}`);
    mqttStream.emit('message', 'myTopic', 'myMessage', { dup: false });
    expect(logger.trace).toHaveBeenCalledWith('MQTT message for topic myTopic: myMessage, dup:false');
    expect(south.handleMessage).toHaveBeenCalledTimes(1);
    expect(south.handleMessage).toHaveBeenCalledWith('myTopic', 'myMessage');
  });

  it('should properly test connection', async () => {
    SouthMQTT.testConnection(configuration.settings, logger, encryptionService);
    mqttStream.emit('connect');

    const expectedOptions = {
      clientId: 'oibus-test',
      rejectUnauthorized: false,
      clean: false,
      connectTimeout: 1000,
      reconnectPeriod: 1000
    };
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(`Connection test to ${configuration.settings.url} successful`);
    expect(logger.debug).toHaveBeenCalledWith(`Disconnected from ${configuration.settings.url}`);
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
      readDelay: 0
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
    jest.useFakeTimers();

    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder', true);
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

  it('should properly test connection', async () => {
    SouthMQTT.testConnection(configuration.settings, logger, encryptionService);

    await flushPromises();
    mqttStream.emit('connect');

    const expectedOptions = {
      clientId: 'oibus-test',
      rejectUnauthorized: false,
      username: 'username',
      password: 'pass',
      connectTimeout: 1000,
      reconnectPeriod: 1000
    };
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(`Connection test to ${configuration.settings.url} successful`);
    expect(logger.debug).toHaveBeenCalledWith(`Disconnected from ${configuration.settings.url}`);
  });
});

describe('SouthMQTT with Cert', () => {
  const mqttStream = new CustomStream();
  mqttStream.subscribe = jest.fn();
  mqttStream.end = jest.fn();
  const connector: SouthConnectorDTO<SouthMQTTSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
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

    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(connector, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder', true);
  });

  it('should properly connect', async () => {
    (fs.readFile as jest.Mock).mockReturnValueOnce('myCert').mockReturnValueOnce('myKey').mockReturnValueOnce('myCa');
    await south.start();
    south.subscribe = jest.fn();
    south.handleMessage = jest.fn();
    const expectedOptions = {
      clientId: connector.id,
      rejectUnauthorized: false,
      cert: 'myCert',
      key: 'myKey',
      ca: 'myCa',
      connectTimeout: 1000,
      reconnectPeriod: 1000
    };
    expect(mqtt.connect).toHaveBeenCalledWith(connector.settings.url, expectedOptions);

    await south.disconnect();
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
  });

  it('should properly test connection', async () => {
    (fs.readFile as jest.Mock).mockReturnValueOnce('myCert').mockReturnValueOnce('myKey').mockReturnValueOnce('myCa');

    SouthMQTT.testConnection(connector.settings, logger, encryptionService).then(() => {});
    await flushPromises();

    mqttStream.emit('connect');

    const expectedOptions = {
      clientId: 'oibus-test',
      cert: 'myCert',
      key: 'myKey',
      ca: 'myCa',
      rejectUnauthorized: false,
      connectTimeout: 1000,
      reconnectPeriod: 1000
    };
    expect(mqtt.connect).toHaveBeenCalledWith(connector.settings.url, expectedOptions);
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(`Connection test to ${connector.settings.url} successful`);
    expect(logger.debug).toHaveBeenCalledWith(`Disconnected from ${connector.settings.url}`);
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
      readDelay: 0
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

    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder', true);
  });

  it('should properly connect', async () => {
    await south.start();
    south.subscribe = jest.fn();
    south.handleMessage = jest.fn();
    const expectedOptions = {
      clientId: configuration.id,
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
    SouthMQTT.testConnection(configuration.settings, logger, encryptionService);
    mqttStream.emit('connect');

    const expectedOptions = {
      clientId: 'oibus-test',
      rejectUnauthorized: false,
      cert: '',
      key: '',
      ca: '',
      connectTimeout: 1000,
      reconnectPeriod: 1000
    };
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(`Connection test to ${configuration.settings.url} successful`);
    expect(logger.debug).toHaveBeenCalledWith(`Disconnected from ${configuration.settings.url}`);
  });

  it('should properly fail test connection', async () => {
    SouthMQTT.testConnection(configuration.settings, logger, encryptionService).catch(() => {});

    mqttStream.emit('error', new Error('connection error'));

    const expectedOptions = {
      clientId: 'oibus-test',
      rejectUnauthorized: false,
      cert: '',
      key: '',
      ca: '',
      connectTimeout: 1000,
      reconnectPeriod: 1000
    };
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);
    expect(mqttStream.end).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(`MQTT connection error ${new Error('connection error')}`);
  });
});
