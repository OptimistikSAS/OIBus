import ConnectionServiceMock from '../../tests/__mocks__/service/connection-service.mock';
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
import { OIBusMQTTValue } from '../../service/transformers/connector-types.model';
import { createConnectionOptions } from '../../service/utils-mqtt';
import { connectionService } from '../../service/connection.service';
import MqttClient from 'mqtt/lib/client';

jest.mock('node:fs/promises');
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
jest.mock('../../service/connection.service', () => ({
  connectionService: new ConnectionServiceMock('', '')
}));
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
      sharedConnection: null,
      retryInterval: 1000,
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
      }
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (getFilenameWithoutRandomId as jest.Mock).mockReturnValue('example.file');
    mqttStream.removeAllListeners();
    (mqtt.connectAsync as jest.Mock).mockImplementation(() => mqttStream);

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
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    north.disconnect = jest.fn();
    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await north.start();
    expect(createConnectionOptions).toHaveBeenCalledWith(configuration.id, configuration.settings.connectionSettings, logger);
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.connectionSettings!.url, {});
    expect(logger.info).toHaveBeenCalledWith(`Connected to ${configuration.settings.connectionSettings!.url}`);

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
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.connectionSettings!.url, {});
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1); // because of reconnectTimeout
  });

  it('should properly connect and manage unintentional close event', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await north.connect();
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.connectionSettings!.url, {});
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    mqttStream.emit('close');
    expect(logger.debug).toHaveBeenCalledWith('MQTT Client closed unintentionally');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
  });

  it('should properly connect and manage intentional close event', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    (createConnectionOptions as jest.Mock).mockReturnValueOnce({});
    await north.connect();
    expect(mqtt.connectAsync).toHaveBeenCalledWith(configuration.settings.connectionSettings!.url, {});
    north['disconnecting'] = true;
    mqttStream.emit('close');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('MQTT Client intentionally disconnected');
  });

  it('should properly manage connect error and reconnect', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const error = new Error('connect error');
    north.getSession = jest.fn().mockImplementationOnce(() => {
      throw error;
    });
    north.disconnect = jest.fn();

    await north.start();

    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(north.disconnect).toHaveBeenCalledWith(error);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should properly manage connect error and not reconnect if disabled', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const error = new Error('connect error');
    north.getSession = jest.fn().mockImplementationOnce(() => {
      throw error;
    });
    north.disconnect = jest.fn();
    north['connector'].enabled = false;

    await north.start();

    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(north.disconnect).toHaveBeenCalledWith(error);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly get session if shared connection', async () => {
    north['connector'].settings.sharedConnection = {
      connectorType: 'north',
      connectorId: 'northId'
    };
    (connectionService.getConnection as jest.Mock).mockReturnValueOnce({});
    expect(await north.getSession()).toEqual({});
    expect(connectionService.getConnection).toHaveBeenCalledWith('north', 'northId');
  });

  it('should properly get client session if already set', async () => {
    north.createSession = jest.fn();
    north['client'] = mqttStream as unknown as MqttClient.MqttClient;
    expect(await north.getSession()).toEqual(mqttStream);
    expect(connectionService.getConnection).not.toHaveBeenCalled();
    expect(north.createSession).not.toHaveBeenCalled();
  });

  it('should properly throw error if session not retrieved', async () => {
    north['connector'].settings.sharedConnection = {
      connectorType: 'north',
      connectorId: 'northId'
    };
    (connectionService.getConnection as jest.Mock).mockReturnValueOnce(null);
    await expect(north.getSession()).rejects.toThrow(new Error('Could not connect client'));
    expect(connectionService.getConnection).toHaveBeenCalledWith('north', 'northId');
  });

  it('should properly close session', async () => {
    north['client'] = mqttStream as unknown as MqttClient.MqttClient;
    await north.closeSession();
    expect(mqttStream.end).toHaveBeenCalledTimes(1);

    north['client'] = null;
    await north.closeSession();
    expect(mqttStream.end).toHaveBeenCalledTimes(1);
  });

  it('should properly disconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await north.disconnect();

    expect(logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...');
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly disconnect and clear timeout', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const client = { end: jest.fn() } as unknown as MqttClient.MqttClient;
    north.closeSession = jest.fn();
    north['client'] = client;
    north['connector'].settings.sharedConnection = null;
    (connectionService.isConnectionUsed as jest.Mock).mockReturnValueOnce(true);
    north['reconnectTimeout'] = setTimeout(() => null);

    await north.disconnect(new Error('error'));

    expect(logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...');
    expect(north.closeSession).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should properly disconnect with shared connection', async () => {
    north['client'] = mqttStream as unknown as MqttClient.MqttClient;
    (connectionService.isConnectionUsed as jest.Mock).mockReturnValueOnce(false);
    north['connector'].settings.sharedConnection = {
      connectorType: 'north',
      connectorId: 'northId'
    };

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    north['reconnectTimeout'] = setTimeout(() => null);
    await north.disconnect();

    expect(north.getSharedConnectionSettings()).toEqual({
      connectorType: 'north',
      connectorId: 'northId'
    });

    expect(connectionService.closeSession).toHaveBeenCalledWith('north', 'northId', configuration.id, false);
    expect(logger.info).not.toHaveBeenCalledWith('Disconnecting from mqtt://localhost:1883...');
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should properly test connection', async () => {
    north.getSession = jest.fn();
    north.disconnect = jest.fn();
    await north.testConnection();
    expect(north.getSession).toHaveBeenCalledTimes(1);
    expect(north.disconnect).toHaveBeenCalledTimes(1);
  });

  it('should handle content', async () => {
    const values: Array<OIBusMQTTValue> = [
      {
        topic: 'topic1',
        payload: '123',
        qos: '1'
      },
      {
        topic: 'topic2',
        payload: 'my payload',
        qos: '1'
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
    expect(publishAsyncFn).toHaveBeenCalledWith(values[0].topic, values[0].payload, { qos: 1 });
    expect(publishAsyncFn).toHaveBeenCalledWith(values[1].topic, values[1].payload, { qos: 1 });
  });

  it('should manage handle content errors', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const values: Array<OIBusMQTTValue> = [
      {
        topic: 'topic1',
        payload: '123',
        qos: '1'
      },
      {
        topic: 'topic2',
        payload: 'my payload',
        qos: '1'
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
        contentType: 'mqtt',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new Error('error1'));

    expect(logger.error).toHaveBeenCalledWith(`Unexpected error on topic topic1: error1`);
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

    north['connector'].enabled = false;

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
    ).rejects.toThrow(new Error('error2'));
    expect(logger.error).toHaveBeenCalledWith(`Unexpected error on topic topic1: error2`);
    expect(north.disconnect).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
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
