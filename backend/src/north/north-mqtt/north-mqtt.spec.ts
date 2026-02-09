import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import NorthMQTT from './north-mqtt';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthMQTTSettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import mqtt, { MqttClient } from 'mqtt';
import EventEmitter from 'node:events';
import { OIBusMQTTValue } from '../../transformers/connector-types.model';
import { createConnectionOptions } from '../../service/utils-mqtt';
import { ReadStream } from 'node:fs';
import { streamToString } from '../../service/utils';
import { buildNorthConfiguration } from '../../tests/utils/test-utils';

// Mocks
jest.mock('node:fs/promises');
jest.mock('../../service/utils');
jest.mock('../../service/utils-mqtt');
jest.mock('../../service/transformer.service');
jest.mock('mqtt');

const logger: pino.Logger = new PinoLogger();
const cacheService: CacheService = new CacheServiceMock();
const oiBusTransformer: OIBusTransformer = new OIBusTransformerMock() as unknown as OIBusTransformer;

jest.mock(
  '../../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
    }
);

class MockMqttClient extends EventEmitter {
  connected = true;
  publishAsync = jest.fn().mockResolvedValue(undefined);
  end = jest.fn();
  removeAllListeners = jest.fn();
}

describe('NorthMQTT', () => {
  let configuration: NorthConnectorEntity<NorthMQTTSettings>;
  let north: NorthMQTT;
  let mockMqttClient: MockMqttClient;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    configuration = buildNorthConfiguration<NorthMQTTSettings>('mqtt', {
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
    });
    mockMqttClient = new MockMqttClient();

    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (mqtt.connectAsync as jest.Mock).mockResolvedValue(mockMqttClient);
    (createConnectionOptions as jest.Mock).mockReturnValue({});

    north = new NorthMQTT(configuration, logger, cacheService);
  });

  afterEach(async () => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should retrieve supported types', () => {
    expect(north.supportedTypes()).toEqual(['mqtt']);
  });

  it('should properly connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    north.disconnect = jest.fn();

    await north.start();

    expect(createConnectionOptions).toHaveBeenCalledWith(configuration.id, configuration.settings, logger);
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.url, {});
    expect(logger.info).toHaveBeenCalledWith(`MQTT North connector "${configuration.name}" connected`);
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly connect and clear existing timeout', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    north['reconnectTimeout'] = setTimeout(() => null);

    await north.start();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should handle connection error and trigger reconnect', async () => {
    const error = new Error('Connection failed');
    (mqtt.connectAsync as jest.Mock).mockRejectedValueOnce(error);
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    north.disconnect = jest.fn();

    await north.connect();

    expect(logger.error).toHaveBeenCalledWith(`Error while connecting to the MQTT broker: Connection failed`);
    expect(north.disconnect).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should not reconnect if disabled on error', async () => {
    const error = new Error('Connection failed');
    (mqtt.connectAsync as jest.Mock).mockRejectedValueOnce(error);
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    north.connectorConfiguration.enabled = false;
    north.disconnect = jest.fn();

    await north.connect();

    expect(north.disconnect).toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should handle runtime MQTT error events', async () => {
    await north.connect();
    north.disconnect = jest.fn();

    // Simulate 'error' event
    mockMqttClient.emit('error', new Error('Runtime error'));

    // Wait for promise queue if necessary, or check immediate effects
    expect(logger.error).toHaveBeenCalledWith('MQTT Client error: Runtime error');
    expect(north.disconnect).toHaveBeenCalled();
  });

  it('should handle unintentional close event', async () => {
    await north.connect();
    north.disconnect = jest.fn();
    north['disconnecting'] = false;

    mockMqttClient.emit('close');

    expect(logger.debug).toHaveBeenCalledWith('MQTT Client closed unintentionally');
    expect(north.disconnect).toHaveBeenCalled();
  });

  it('should handle intentional close event', async () => {
    await north.connect();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    north['disconnecting'] = true;

    mockMqttClient.emit('close');

    expect(logger.debug).toHaveBeenCalledWith('MQTT Client intentionally disconnected');
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly disconnect', async () => {
    north['client'] = mockMqttClient as unknown as MqttClient;
    north['reconnectTimeout'] = setTimeout(() => null);
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await north.disconnect();

    expect(mockMqttClient.removeAllListeners).toHaveBeenCalled();
    expect(mockMqttClient.end).toHaveBeenCalledWith(true);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(north['client']).toBeNull();
  });

  it('should properly test connection', async () => {
    await expect(north.testConnection()).resolves.not.toThrow();
    expect(mockMqttClient.end).toHaveBeenCalled();
  });

  it('should throw error if connector is in reconnecting state', async () => {
    north['reconnectTimeout'] = setTimeout(() => null);
    const readStream = {} as ReadStream;

    await expect(
      north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'mqtt'
      })
    ).rejects.toThrow('Connector is reconnecting...');
  });

  it('should throw error if client is not set/connected', async () => {
    north['client'] = null;
    const readStream = {} as ReadStream;
    const values: Array<OIBusMQTTValue> = [
      { topic: 'topic1', payload: '123' },
      { topic: 'topic2', payload: 'abc' }
    ];
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(values));

    await expect(
      north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'mqtt'
      })
    ).rejects.toThrow('MQTT client not set. The connector cannot write values');
  });

  it('should handle content success', async () => {
    const values: Array<OIBusMQTTValue> = [
      { topic: 'topic1', payload: '123' },
      { topic: 'topic2', payload: 'abc' }
    ];
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(values));

    north['client'] = mockMqttClient as unknown as MqttClient;
    const readStream = {} as ReadStream;

    await north.handleContent(readStream, {
      contentFile: 'file.json',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'mqtt'
    });

    expect(streamToString).toHaveBeenCalledWith(readStream);
    expect(mockMqttClient.publishAsync).toHaveBeenCalledTimes(2);
    expect(mockMqttClient.publishAsync).toHaveBeenCalledWith('topic1', '123', { qos: 1 });
  });

  it('should handle publish errors and trigger reconnect', async () => {
    const values: Array<OIBusMQTTValue> = [{ topic: 'topic1', payload: '123' }];
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(values));

    north['client'] = mockMqttClient as unknown as MqttClient;
    mockMqttClient.publishAsync.mockRejectedValueOnce(new Error('Publish failed'));

    // Spy on reconnect logic
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    north.disconnect = jest.fn();

    const readStream = {} as ReadStream;

    await expect(
      north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'mqtt'
      })
    ).rejects.toThrow('Publish failed');

    expect(logger.error).toHaveBeenCalledWith('MQTT Publish error: Publish failed');
    expect(north.disconnect).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalled();
  });
});
