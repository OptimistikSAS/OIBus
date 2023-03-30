import Stream from 'node:stream';

import mqtt from 'mqtt';

import SouthMQTT from './south-mqtt';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import DatabaseMock from '../../tests/__mocks__/database.mock';

jest.mock('mqtt');
jest.mock('node:fs/promises');
const database = new DatabaseMock();
jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return {
        createCacheHistoryTable: jest.fn(),
        southCacheRepository: {
          database
        }
      };
    }
);

const addValues = jest.fn();
const addFile = jest.fn();

const logger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);
const items: Array<OibusItemDTO> = [
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
      nodeId: 'my/+/#/topic/with/wildcard/#'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id3',
    name: 'item3',
    connectorId: 'southId',
    settings: {
      nodeId: 'my/wrong/topic////'
    },
    scanModeId: 'scanModeId2'
  }
];

const mqttStream = new Stream();
// @ts-ignore
mqttStream.subscribe = jest.fn();

let south: SouthMQTT;
const configuration: SouthConnectorDTO = {
  id: 'southId',
  name: 'south',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  settings: {
    url: 'mqtt://localhost:1883',
    qos: 1,
    persistent: true,
    authentication: {
      type: 'none'
    },
    connectTimeout: 1000,
    keepalive: true,
    reconnectPeriod: 1000,
    keyFile: '',
    certFile: '',
    caFile: '',
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

describe('SouthMQTT', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    south = new SouthMQTT(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolde',
      true
    );
  });

  it('should properly connect', async () => {
    await south.start();
    south.subscribe = jest.fn();
    south.handleMessage = jest.fn();
    const expectedOptions = {
      clean: !configuration.settings.persistent,
      clientId: configuration.id,
      username: '',
      password: '',
      rejectUnauthorized: false,
      connectTimeout: 1000,
      reconnectPeriod: 1000,
      ca: '',
      cert: '',
      key: ''
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

  it('should properly disconnect', async () => {
    await south.disconnect();

    expect(logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...');
  });
});
