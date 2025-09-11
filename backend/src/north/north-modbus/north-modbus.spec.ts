import NorthModbus from './north-modbus';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import csv from 'papaparse';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthModbusSettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import { flushPromises } from '../../tests/utils/test-utils';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { getFilenameWithoutRandomId } from '../../service/utils';
import Stream from 'node:stream';
import net from 'node:net';
import fs from 'node:fs/promises';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';
import { OIBusModbusValue } from '../../service/transformers/connector-types.model';

jest.mock('node:fs/promises');
jest.mock('node:net');
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
jest.mock('../../service/utils');

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
jest.mock('../../service/transformer.service');
jest.mock('papaparse');

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

// Error codes handled by the test function
// With the expected error messages to throw
const ERROR_CODES = {
  ENOTFOUND: 'Please check host and port',
  ECONNREFUSED: 'Please check host and port',
  DEFAULT: 'Unable to connect to socket' // For exceptions that we aren't explicitly specifying
} as const;

type ErrorCodes = keyof typeof ERROR_CODES;

class ModbusError extends Error {
  private code: ErrorCodes;

  constructor(message: string, code: ErrorCodes) {
    super();
    this.name = 'ModbusError';
    this.message = message;
    this.code = code;
  }
}

describe('NorthModbus', () => {
  let configuration: NorthConnectorEntity<NorthModbusSettings>;
  let north: NorthModbus;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      port: 502,
      host: '127.0.0.1',
      slaveId: 1,
      addressOffset: 'modbus',
      endianness: 'big-endian',
      swapBytesInWords: false,
      swapWordsInDWords: false,
      retryInterval: 10000
    };
    (csv.unparse as jest.Mock).mockReturnValue('csv content');
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (getFilenameWithoutRandomId as jest.Mock).mockReturnValue('example.file');

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockReturnValue({
      connect(_connectionObject: unknown, callback: () => Promise<void>): Promise<void> {
        return callback();
      },
      on() {
        jest.fn();
      }
    });

    north = new NorthModbus(configuration, logger, 'cacheFolder', cacheService);
  });

  it('should properly manage connection', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const mockedEmitter = new CustomStream();
    mockedEmitter.connect = jest.fn((_connectionObject: unknown, _callback: () => Promise<void>): Promise<void> => {
      return _callback();
    });
    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockImplementation(() => mockedEmitter);
    north.disconnect = jest.fn();

    await north.connect();
    expect(net.Socket).toHaveBeenCalledTimes(1);
    expect(mockedEmitter.connect).toHaveBeenCalledWith(
      { host: configuration.settings.host, port: configuration.settings.port },
      expect.any(Function)
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Connecting Modbus socket into ${configuration.settings.host}:${configuration.settings.port}`
    );
    expect(logger.info).toHaveBeenCalledWith(`Modbus socket connected to ${configuration.settings.host}:${configuration.settings.port}`);

    north['disconnecting'] = true;
    mockedEmitter.emit('error', 'connect error');
    await flushPromises();
    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1); // because of cron jobs

    north['disconnecting'] = false;
    mockedEmitter.emit('error', new Error('connect error'));
    await flushPromises();
    expect(north.disconnect).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith('Modbus socket error: connect error');
  });

  it('should properly disconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    await north.disconnect();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    north['reconnectTimeout'] = setTimeout(() => null);
    const mockedEmitter = { end: jest.fn() };
    north['socket'] = mockedEmitter as unknown as net.Socket;

    await north.disconnect();
    expect(mockedEmitter.end).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should throw error if client is not set when handling content', async () => {
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'modbus',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow('Modbus client not set. The connector cannot write values');
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

  it('should properly call handle values when handling compatible content', async () => {
    const values: Array<OIBusModbusValue> = [
      {
        address: '0x001',
        value: 123,
        modbusType: 'register'
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(values));
    const mockedClient = {} as unknown as ModbusTCPClient;
    north['modbusClient'] = mockedClient;
    north['handleValues'] = jest.fn();
    await north.handleContent({
      contentFile: 'path/to/file/example-123456789.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'modbus',
      source: 'south',
      options: {}
    });
    expect(north['handleValues']).toHaveBeenCalledWith(mockedClient, values);
  });

  it('handle values to call modbus function', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    const values: Array<OIBusModbusValue> = [
      {
        address: '0x001',
        value: 123,
        modbusType: 'register'
      },
      {
        address: '0x002',
        value: 456,
        modbusType: 'coil'
      }
    ];
    north['modbusFunction'] = jest.fn();
    await north['handleValues'](mockedClient, values);
    expect(north['modbusFunction']).toHaveBeenCalledWith(mockedClient, values[0]);
    expect(north['modbusFunction']).toHaveBeenCalledWith(mockedClient, values[1]);
    expect(north['modbusFunction']).toHaveBeenCalledTimes(2);
  });

  it('modbusFunction() should throw error if bad modbus type', async () => {
    const values = [
      {
        address: '0x001',
        value: 123,
        modbusType: 'bad'
      }
    ];
    const writeSingleCoilFn = jest.fn();
    const writeSingleRegisterFn = jest.fn();

    const modbusClient = {
      writeSingleCoil: writeSingleCoilFn,
      writeSingleRegister: writeSingleRegisterFn
    } as unknown as ModbusTCPClient;

    await expect(north['modbusFunction'](modbusClient, values[0] as unknown as OIBusModbusValue)).rejects.toThrow(
      `Wrong Modbus type "bad" for address 1`
    );
    expect(writeSingleCoilFn).not.toHaveBeenCalled();
    expect(writeSingleRegisterFn).not.toHaveBeenCalled();
  });

  it('should write coil', async () => {
    const values: Array<OIBusModbusValue> = [
      {
        address: '0x002',
        value: true,
        modbusType: 'coil'
      }
    ];

    const writeSingleCoilFn = jest.fn();
    const writeSingleRegisterFn = jest.fn();
    const modbusClient = {
      writeSingleCoil: writeSingleCoilFn,
      writeSingleRegister: writeSingleRegisterFn
    } as unknown as ModbusTCPClient;

    await north['modbusFunction'](modbusClient, values[0]);

    expect(writeSingleCoilFn).toHaveBeenCalledTimes(1);
    expect(writeSingleRegisterFn).not.toHaveBeenCalled();
    expect(writeSingleCoilFn).toHaveBeenCalledWith(2, true);
  });

  it('should write register', async () => {
    const values: Array<OIBusModbusValue> = [
      {
        address: '1',
        value: 123,
        modbusType: 'register'
      }
    ];

    const writeSingleCoilFn = jest.fn();
    const writeSingleRegisterFn = jest.fn();
    const modbusClient = {
      writeSingleCoil: writeSingleCoilFn,
      writeSingleRegister: writeSingleRegisterFn
    } as unknown as ModbusTCPClient;

    north['connector'].settings.addressOffset = 'jbus';

    await north['modbusFunction'](modbusClient, values[0]);

    expect(writeSingleCoilFn).not.toHaveBeenCalled();
    expect(writeSingleRegisterFn).toHaveBeenCalledTimes(1);
    expect(writeSingleRegisterFn).toHaveBeenCalledWith(0, 123);
  });

  it('should properly test connection', async () => {
    const end = jest.fn();
    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockReturnValue({
      connect(_connectionObject: unknown, callback: () => Promise<void>): Promise<void> {
        return callback();
      },
      on: jest.fn(),
      end
    });

    await expect(north.testConnection()).resolves.not.toThrow();
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('should properly manage error on test connection failure', async () => {
    let code: ErrorCodes;
    const errorMessage = 'Error creating connection to socket';

    for (code in ERROR_CODES) {
      // Mock node:net Socket constructor and the used function
      (net.Socket as unknown as jest.Mock).mockReturnValueOnce({
        connect(_connectionObject: unknown, _callback: () => Promise<void>) {
          throw new ModbusError(errorMessage, code);
        },
        on: jest.fn(),
        end: jest.fn()
      });

      await expect(north.testConnection()).rejects.toThrow(new Error(`${ERROR_CODES[code]}: ${errorMessage}`));
    }
  });
});
