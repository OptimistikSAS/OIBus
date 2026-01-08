import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import NorthMQTT from './north-mqtt';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthMQTTSettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import { flushPromises } from '../../tests/utils/test-utils';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { getFilenameWithoutRandomId } from '../../service/utils';
import mqtt, { MqttClient } from 'mqtt';
import Stream from 'node:stream';
import fs from 'node:fs/promises';
import { OIBusMQTTValue } from '../../service/transformers/connector-types.model';
import { createConnectionOptions } from '../../service/utils-mqtt';

jest.mock('node:fs/promises');

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
jest.mock('../../service/utils');
jest.mock('../../service/utils-mqtt');
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
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (getFilenameWithoutRandomId as jest.Mock).mockReturnValue('example.file');
    (mqtt.connectAsync as jest.Mock).mockImplementation(() => mqttStream);

    north = new NorthMQTT(configuration, logger, 'cacheFolder', cacheService);
  });

  afterEach(async () => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
    mqttStream.removeAllListeners();
  });

  it('should properly connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    north.disconnect = jest.fn();
    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await north.start();
    expect(createConnectionOptions).toHaveBeenCalledWith(configuration.id, configuration.settings, logger);
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.url, {});
    expect(logger.info).toHaveBeenCalledWith(`MQTT North connector "${configuration.name}" connected`);

    mqttStream.emit('error', new Error('error'));
    await flushPromises(); // Flush disconnect promise
    expect(logger.error).toHaveBeenCalledWith(`MQTT Client error: ${new Error('error')}`); // Not called because promise is already resolved
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly connect and clear timeout', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    north['reconnectTimeout'] = setTimeout(() => null);

    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await north.start();
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.url, {});
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1); // because of reconnectTimeout
  });

  it('should properly connect and manage unintentional close event', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await north.connect();
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.url, {});
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    mqttStream.emit('close');
    expect(logger.debug).toHaveBeenCalledWith('MQTT Client closed unintentionally');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
  });

  it('should properly connect and manage intentional close event', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await north.connect();
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.url, {});
    north['disconnecting'] = true;
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
    north.disconnect = jest.fn();

    await north.start();

    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should properly manage connect error and not reconnect if disabled', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const error = new Error('connect error');
    mqtt.connectAsync = jest.fn().mockImplementationOnce(() => {
      throw error;
    });
    north.disconnect = jest.fn();
    north['connector'].enabled = false;

    await north.start();

    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly test connection', async () => {
    north.disconnect = jest.fn();
    await north.testConnection();
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
  });

  it('should handle content', async () => {
    const values: Array<OIBusMQTTValue> = [
      {
        topic: 'topic1',
        payload: '123'
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
      contentType: 'mqtt'
    });

    expect(publishAsyncFn).toHaveBeenCalledTimes(2);
    expect(publishAsyncFn).toHaveBeenCalledWith(values[0].topic, values[0].payload, {
      qos: parseInt(configuration.settings.qos)
    });
    expect(publishAsyncFn).toHaveBeenCalledWith(values[1].topic, values[1].payload, {
      qos: parseInt(configuration.settings.qos)
    });
  });

  it('should manage handle content errors', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const values: Array<OIBusMQTTValue> = [
      {
        topic: 'topic1',
        payload: '123'
      },
      {
        topic: 'topic2',
        payload: 'my payload'
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(values)).mockReturnValueOnce(JSON.stringify([values[0]]));

    const publishAsyncFn = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('error1');
      })
      .mockImplementationOnce(() => {
        throw new Error('error2');
      });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    north['client'] = {
      publishAsync: publishAsyncFn
    };

    north.disconnect = jest.fn();

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'mqtt'
      })
    ).rejects.toThrow(new Error('error1'));

    expect(logger.error).toHaveBeenCalledWith(`Unexpected error: error1`);
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

    north['connector'].enabled = false;
    north['reconnectTimeout'] = null;

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'mqtt'
      })
    ).rejects.toThrow(new Error('error2'));
    expect(logger.error).toHaveBeenCalledWith(`Unexpected error: error2`);
    expect(north.disconnect).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should throw error if client is reconnecting', async () => {
    north['client'] = {} as unknown as mqtt.MqttClient;
    north['reconnectTimeout'] = setTimeout(() => null);
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'mqtt'
      })
    ).rejects.toThrow('Connector is reconnecting...');
  });

  it('should properly disconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    north['reconnectTimeout'] = setTimeout(() => null);
    north['client'] = mqttStream as unknown as MqttClient;

    await north.disconnect();

    expect(logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...');
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

    await north.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should throw error if client is not set when handling content', async () => {
    (fs.readFile as jest.Mock).mockReturnValueOnce('[{}]');
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'mqtt'
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
        contentType: 'any'
      })
    ).rejects.toThrow(`Unsupported data type: any (file path/to/file/example-123456789.file)`);
  });
});
