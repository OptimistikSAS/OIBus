import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import NorthMQTT from './north-mqtt';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthMQTTSettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import { flushPromises, mockBaseFolders } from '../../tests/utils/test-utils';
import CacheService from '../../service/cache/cache.service';
import TransformerService, { createTransformer } from '../../service/transformer.service';
import TransformerServiceMock from '../../tests/__mocks__/service/transformer-service.mock';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { getFilenameWithoutRandomId } from '../../service/utils';
import mqtt from 'mqtt';
import Stream from 'node:stream';
import fs from 'node:fs/promises';

jest.mock('node:fs/promises');
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));
const logger: pino.Logger = new PinoLogger();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const cacheService: CacheService = new CacheServiceMock();
const transformerService: TransformerService = new TransformerServiceMock();
const oiBusTransformer: OIBusTransformer = new OIBusTransformerMock() as unknown as OIBusTransformer;

jest.mock(
  '../../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
    }
);
jest.mock('../../service/utils');
jest.mock('../../service/transformer.service');
jest.mock('mqtt');

let configuration: NorthConnectorEntity<NorthMQTTSettings>;
let north: NorthMQTT;

class CustomStream extends Stream {
  constructor() {
    super();
  }

  publishAsync() {
    return;
  }

  end() {
    return;
  }
}

describe('NorthMQTT', () => {
  const mqttStream = new CustomStream();
  mqttStream.publishAsync = jest.fn();
  mqttStream.end = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
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
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (getFilenameWithoutRandomId as jest.Mock).mockReturnValue('example.file');
    (mqtt.connect as jest.Mock).mockImplementation(() => mqttStream);

    north = new NorthMQTT(
      configuration,
      transformerService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
  });

  it('should properly connect', async () => {
    north.start();
    const expectedOptions = {
      clean: !configuration.settings.persistent,
      clientId: configuration.id,
      rejectUnauthorized: false,
      connectTimeout: 1000,
      reconnectPeriod: 0,
      queueQoSZero: false
    };
    await flushPromises();
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, expectedOptions);
    mqttStream.emit('connect');
    expect(logger.info).toHaveBeenCalledWith(`Connected to ${configuration.settings.url}`);
  });

  it('should properly disconnect', async () => {
    await north.disconnect();

    expect(logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...');
  });

  it('should properly manage clear timeout', async () => {
    north['reconnectTimeout'] = setTimeout(() => null);
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    north.connectToBroker = jest.fn().mockImplementationOnce(() => {
      throw new Error('connect error');
    });
    await north.connect();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`Connection error: ${new Error('connect error')}`);

    north['reconnectTimeout'] = setTimeout(() => null);
    await north.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  });

  it('should properly manage reconnection on connection failure', async () => {
    north.connect = jest.fn();
    north.disconnect = jest.fn().mockImplementationOnce(() => Promise.resolve());
    north.connectToBroker({
      clean: !configuration.settings.persistent,
      clientId: configuration.id,
      rejectUnauthorized: false,
      connectTimeout: 1000,
      reconnectPeriod: 1000,
      queueQoSZero: false
    });
    mqttStream.emit('error', new Error('error'));
    await flushPromises();
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`MQTT Client error: ${new Error('error')}`);
  });

  it('should properly test connection', async () => {
    const expectedOptions = {
      clientId: 'northId1',
      clean: false,
      rejectUnauthorized: false,
      connectTimeout: 1000,
      reconnectPeriod: 0,
      queueQoSZero: false
    };
    north.testConnectionToBroker = jest.fn();
    await north.testConnection();

    expect(north.testConnectionToBroker).toHaveBeenCalledWith(expectedOptions);
  });

  it('should properly test connection to broker', async () => {
    const options = {
      clientId: 'northId1',
      clean: false,
      rejectUnauthorized: false,
      connectTimeout: 1000,
      reconnectPeriod: 0,
      queueQoSZero: false
    };
    (mqttStream.end as jest.Mock).mockClear();
    north.testConnectionToBroker(options).catch(() => null);
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
    mqttStream.end = jest.fn();
    north.testConnectionToBroker(options).catch(() => null);
    mqttStream.emit('error', new Error('connection error'));
    expect(mqtt.connect).toHaveBeenCalledWith(configuration.settings.url, options);
    expect(mqttStream.end).toHaveBeenCalledWith(true);
    expect(logger.error).toHaveBeenCalledWith(`MQTT connection error. ${new Error('connection error')}`);
    await flushPromises();
  });

  it('should properly manage all connection options', async () => {
    const options = {
      rejectUnauthorized: configuration.settings.rejectUnauthorized,
      reconnectPeriod: 0, // managed by OIBus
      connectTimeout: configuration.settings.connectTimeout,
      clientId: configuration.id,
      queueQoSZero: false
    };
    const result1 = await north.createConnectionOptions();
    expect(result1).toEqual({ ...options, clean: false });

    north['connector'].settings.authentication = {
      type: 'basic',
      username: 'user',
      password: 'pass'
    };
    const result2 = await north.createConnectionOptions();
    expect(result2).toEqual({ ...options, clean: false, username: 'user', password: 'pass' });

    (fs.readFile as jest.Mock).mockReturnValueOnce('cert content').mockReturnValueOnce('key content').mockReturnValueOnce('ca content');
    north['connector'].settings.authentication = {
      type: 'cert',
      certFilePath: 'cert',
      keyFilePath: 'key',
      caFilePath: 'ca'
    };
    north['connector'].settings.qos = '0';
    const result3 = await north.createConnectionOptions();
    expect(result3).toEqual({ ...options, cert: 'cert content', key: 'key content', ca: 'ca content' });
    expect(fs.readFile).toHaveBeenCalledTimes(3);

    north['connector'].settings.authentication = {
      type: 'cert',
      certFilePath: '',
      keyFilePath: '',
      caFilePath: ''
    };
    north['connector'].settings.qos = '1';
    const result4 = await north.createConnectionOptions();
    expect(result4).toEqual({ ...options, clean: false, cert: '', key: '', ca: '' });
    expect(fs.readFile).toHaveBeenCalledTimes(3);
  });

  it('should handle content', async () => {
    const values = [
      {
        topic: 'topic1',
        payload: 123
      },
      {
        topic: 'topic2',
        payload: 'my payload'
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(values));

    const publishAsyncFn = jest
      .fn()
      .mockReturnValueOnce({ isGood: jest.fn().mockReturnValueOnce(true) })
      .mockReturnValueOnce({ isGood: jest.fn().mockReturnValueOnce(false), name: 'error' });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    north['client'] = {
      publishAsync: publishAsyncFn
    };

    await north.handleContent({
      contentFile: 'path/to/file/example-123456789.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'mqtt',
      source: 'south',
      options: {}
    });

    expect(publishAsyncFn).toHaveBeenCalledTimes(2);
    expect(publishAsyncFn).toHaveBeenCalledWith(values[0].topic, values[0].payload, {
      qos: parseInt(configuration.settings.qos)
    });
    expect(publishAsyncFn).toHaveBeenCalledWith(values[1].topic, values[1].payload, {
      qos: parseInt(configuration.settings.qos)
    });
  });

  it('should throw error if client is not set when handling content', async () => {
    (fs.readFile as jest.Mock).mockReturnValueOnce('[{}]');
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'mqtt',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow('MQTT client not set');
  });

  it('should ignore data if bad content type', async () => {
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(`Unsupported data type: any (file path/to/file/example-123456789.file)`);
  });
});
