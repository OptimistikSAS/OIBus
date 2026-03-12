import NorthModbus from './north-modbus';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthModbusSettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import Stream from 'node:stream';
import net from 'node:net';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';
import { OIBusModbusValue } from '../../transformers/connector-types.model';
import { connectSocket } from '../../service/utils-modbus';
import { streamToString } from '../../service/utils';
import { ReadStream } from 'node:fs';
import { buildNorthConfiguration } from '../../tests/utils/test-utils';

// Mocks
jest.mock('node:fs/promises');
jest.mock('node:net');
jest.mock('../../service/utils');
jest.mock('../../service/utils-modbus');
jest.mock('../../service/transformer.service');

const writeSingleCoil = jest.fn().mockReturnValue({ response: { body: { valuesAsArray: [123] } } });
const writeSingleRegister = jest.fn().mockReturnValue({ response: { body: { valuesAsArray: [123] } } });

jest.mock('jsmodbus', () => ({
  client: {
    TCP: jest.fn().mockImplementation(() => ({
      writeSingleRegister,
      writeSingleCoil
    }))
  }
}));

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

class CustomStream extends Stream {
  constructor() {
    super();
  }
  connect(_connectionObject: unknown, _callback: () => Promise<void>): Promise<void> {
    return Promise.resolve();
  }
  end() {
    return Promise.resolve();
  }
}

describe('NorthModbus', () => {
  let north: NorthModbus;
  let configuration: NorthConnectorEntity<NorthModbusSettings>;
  const mockedEmitter = new CustomStream();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    configuration = buildNorthConfiguration<NorthModbusSettings>('modbus', {
      port: 502,
      host: '127.0.0.1',
      slaveId: 1,
      addressOffset: 'modbus',
      endianness: 'big-endian',
      swapBytesInWords: false,
      swapWordsInDWords: false,
      retryInterval: 10000,
      connectTimeout: 30000
    });

    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (net.Socket as unknown as jest.Mock).mockImplementation(() => mockedEmitter);

    north = new NorthModbus(configuration, logger, cacheService);
  });

  afterEach(async () => {
    jest.useRealTimers();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should retrieve supported types', () => {
    expect(north.supportedTypes()).toEqual(['modbus']);
  });

  it('should properly connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    north.disconnect = jest.fn();
    north['reconnectTimeout'] = setTimeout(() => null);

    await north.connect();

    expect(net.Socket).toHaveBeenCalledTimes(1);
    expect(connectSocket).toHaveBeenCalledWith(mockedEmitter, configuration.settings);
    expect(logger.debug).toHaveBeenCalledWith(
      `Connecting Modbus socket into ${configuration.settings.host}:${configuration.settings.port}`
    );
    expect(logger.info).toHaveBeenCalledWith(`Modbus socket connected to ${configuration.settings.host}:${configuration.settings.port}`);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(north.disconnect).not.toHaveBeenCalled();
  });

  it('should properly reconnect on connect error', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    north.disconnect = jest.fn();
    north['disconnecting'] = true; // Simulating disconnect in progress

    // First Fail
    (connectSocket as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connect error');
    });

    await north.connect();

    expect(connectSocket).toHaveBeenCalledWith(mockedEmitter, configuration.settings);
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    // Should NOT schedule reconnect if already disconnecting
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    // Second Fail (Clean state)
    north['disconnecting'] = false;
    (connectSocket as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connect error');
    });

    await north.connect();

    expect(north.disconnect).toHaveBeenCalledTimes(2);
    // Should schedule reconnect
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Modbus socket error: connect error');
  });

  it('should properly disconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    // 1. Disconnect without active components
    await north.disconnect();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    // 2. Disconnect with active socket and timeout
    north['reconnectTimeout'] = setTimeout(() => null);
    const mockedSocket = { removeAllListeners: jest.fn(), destroy: jest.fn() };
    north['socket'] = mockedSocket as unknown as net.Socket;

    await north.disconnect();

    expect(mockedSocket.destroy).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(north['modbusClient']).toBeNull();
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
        contentType: 'modbus'
      })
    ).rejects.toThrow('Connector is reconnecting...');
  });

  it('should properly handle modbus content', async () => {
    const values: Array<OIBusModbusValue> = [
      { address: '0x001', value: 123, modbusType: 'register' },
      { address: '0x002', value: true, modbusType: 'coil' }
    ];

    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(values));
    const mockedClient = {} as unknown as ModbusTCPClient;
    north['modbusClient'] = mockedClient;

    // Spy on internal logic
    const modbusFnSpy = jest.spyOn(north, 'modbusFunction').mockResolvedValue(undefined);
    const readStream = {} as ReadStream;

    await north.handleContent(readStream, {
      contentFile: 'file.json',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'modbus'
    });

    expect(streamToString).toHaveBeenCalledWith(readStream);
    expect(modbusFnSpy).toHaveBeenCalledTimes(2);
    expect(modbusFnSpy).toHaveBeenCalledWith(mockedClient, values[0]);
    expect(modbusFnSpy).toHaveBeenCalledWith(mockedClient, values[1]);
  });

  it('should throw error if modbus client not set during content handling', async () => {
    const values: Array<OIBusModbusValue> = [];
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(values));

    north['modbusClient'] = null; // Client not ready
    north.disconnect = jest.fn();
    const readStream = {} as ReadStream;

    await expect(
      north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'modbus'
      })
    ).rejects.toThrow('Modbus client not set. The connector cannot write values');

    expect(north.disconnect).toHaveBeenCalled();
  });

  it('should handle errors during processing and trigger reconnect', async () => {
    const values: Array<OIBusModbusValue> = [{ address: '0x001', value: 123, modbusType: 'register' }];
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(values));

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    north['modbusClient'] = {} as unknown as ModbusTCPClient;
    north.disconnect = jest.fn();

    // Mock modbusFunction to throw
    jest.spyOn(north, 'modbusFunction').mockRejectedValueOnce(new Error('write error'));
    const readStream = {} as ReadStream;

    await expect(
      north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'modbus'
      })
    ).rejects.toThrow('write error');

    expect(north.disconnect).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalled(); // Should schedule reconnect
  });

  it('should not trigger reconnect when disabled', async () => {
    north.connectorConfiguration.enabled = false;
    north.disconnect = jest.fn();
    await north['triggerReconnect']();
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(north['reconnectTimeout']).toBeNull();
  });

  it('should handle wrapped OIBus errors', async () => {
    const values: Array<OIBusModbusValue> = [{ address: '0x001', value: 123, modbusType: 'register' }];
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(values));

    north['modbusClient'] = {} as unknown as ModbusTCPClient;

    // Mock throwing a structured error object
    jest.spyOn(north, 'modbusFunction').mockRejectedValueOnce({ err: 'OIBusError', message: 'Something went wrong' });
    const readStream = {} as ReadStream;

    await expect(
      north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'modbus'
      })
    ).rejects.toThrow('OIBusError - Something went wrong');
  });

  it('modbusFunction should write coil', async () => {
    const value: OIBusModbusValue = { address: '0x002', value: true, modbusType: 'coil' };

    const writeSingleCoilFn = jest.fn();
    const writeSingleRegisterFn = jest.fn();
    const modbusClient = {
      writeSingleCoil: writeSingleCoilFn,
      writeSingleRegister: writeSingleRegisterFn
    } as unknown as ModbusTCPClient;

    await north.modbusFunction(modbusClient, value);

    expect(writeSingleCoilFn).toHaveBeenCalledWith(2, true);
    expect(writeSingleRegisterFn).not.toHaveBeenCalled();
  });

  it('modbusFunction should write register', async () => {
    const value: OIBusModbusValue = { address: '1', value: 123, modbusType: 'register' };

    const writeSingleCoilFn = jest.fn();
    const writeSingleRegisterFn = jest.fn();
    const modbusClient = {
      writeSingleCoil: writeSingleCoilFn,
      writeSingleRegister: writeSingleRegisterFn
    } as unknown as ModbusTCPClient;

    // Change offset setting for this test
    north['connector'].settings.addressOffset = 'jbus';

    await north.modbusFunction(modbusClient, value);

    // JBus offset means -1, so address 1 becomes 0
    expect(writeSingleRegisterFn).toHaveBeenCalledWith(0, 123);
    expect(writeSingleCoilFn).not.toHaveBeenCalled();
  });

  it('modbusFunction should throw error if bad modbus type', async () => {
    const value = { address: '0x001', value: 123, modbusType: 'bad' };
    const modbusClient = {} as unknown as ModbusTCPClient;

    await expect(north.modbusFunction(modbusClient, value as unknown as OIBusModbusValue)).rejects.toThrow(
      'Wrong Modbus type "bad" for address 1'
    );
  });

  it('should properly test connection', async () => {
    await expect(north.testConnection()).resolves.not.toThrow();
    expect(connectSocket).toHaveBeenCalledWith(expect.any(Object), configuration.settings);
  });

  it('should properly manage error on test connection failure', async () => {
    // ENOTFOUND
    (connectSocket as jest.Mock).mockRejectedValueOnce({ code: 'ENOTFOUND', message: 'Host not found' });
    await expect(north.testConnection()).rejects.toThrow('Please check host and port: Host not found');

    // ECONNREFUSED
    (connectSocket as jest.Mock).mockRejectedValueOnce({ code: 'ECONNREFUSED', message: 'Connection refused' });
    await expect(north.testConnection()).rejects.toThrow('Please check host and port: Connection refused');

    // Default Error
    (connectSocket as jest.Mock).mockRejectedValueOnce({ code: 'OTHER', message: 'Unknown error' });
    await expect(north.testConnection()).rejects.toThrow('Unable to connect to socket: Unknown error');
  });
});
