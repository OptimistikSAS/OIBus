import NorthModbus from './north-modbus';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import csv from 'papaparse';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthModbusSettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import { flushPromises, mockBaseFolders } from '../../tests/utils/test-utils';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { getFilenameWithoutRandomId } from '../../service/utils';
import Stream from 'node:stream';
import net from 'node:net';
import fs from 'node:fs/promises';

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

    north = new NorthModbus(configuration, logger, mockBaseFolders(testData.north.list[0].id));
  });

  it('should fail to connect and try again', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const mockedEmitter = new CustomStream();
    mockedEmitter.connect = (_connectionObject: unknown, _callback: () => Promise<void>): Promise<void> => {
      return _callback();
    };

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockImplementation(() => mockedEmitter);

    await north.disconnect();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    await north.connect();
    expect(net.Socket).toHaveBeenCalledTimes(1);
    mockedEmitter.emit('error', 'connect error');
    await flushPromises();
    await north.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

    await north.connect();
    expect(net.Socket).toHaveBeenCalledTimes(2);
    mockedEmitter.emit('error', 'connect error');
    await flushPromises();
    await north.connect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(4);

    expect(logger.error).toHaveBeenCalledWith('Modbus socket error: connect error');
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(net.Socket).toHaveBeenCalledTimes(3);
    await north.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(4);
  });

  it('should throw error if client is not set when handling content', async () => {
    (fs.readFile as jest.Mock).mockReturnValueOnce('[{}]');
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

  it('modbusFunction() should throw error if bad modbus type', async () => {
    const values = [
      {
        address: '0x001',
        value: 123,
        modbusType: 'bad'
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(values));

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    north['client'] = {};

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
    ).rejects.toThrow(`Wrong Modbus type "bad" for address 1`);
  });

  it('should handle content', async () => {
    const values = [
      {
        address: '0x001',
        value: 123,
        modbusType: 'register'
      },
      {
        address: '0x002',
        value: true,
        modbusType: 'coil'
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(values));

    const writeSingleCoilFn = jest.fn();
    const writeSingleRegisterFn = jest.fn();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    north['client'] = {
      writeSingleCoil: writeSingleCoilFn,
      writeSingleRegister: writeSingleRegisterFn
    };

    await north.handleContent({
      contentFile: 'path/to/file/example-123456789.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'modbus',
      source: 'south',
      options: {}
    });

    expect(writeSingleCoilFn).toHaveBeenCalledTimes(1);
    expect(writeSingleRegisterFn).toHaveBeenCalledTimes(1);
    expect(writeSingleCoilFn).toHaveBeenCalledWith(2, true);
    expect(writeSingleRegisterFn).toHaveBeenCalledWith(1, 123);
  });

  it('modbusFunction() should write value with offset', async () => {
    const values = [
      {
        address: '1',
        value: 123,
        modbusType: 'register'
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(values));

    const writeSingleRegisterFn = jest.fn();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    north['client'] = {
      writeSingleRegister: writeSingleRegisterFn
    };
    north['connector'].settings.addressOffset = 'jbus';

    await north.handleContent({
      contentFile: 'path/to/file/example-123456789.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'modbus',
      source: 'south',
      options: {}
    });
    expect(writeSingleRegisterFn).toHaveBeenCalledWith(0, 123);
  });
});

describe('NorthModbus test connection', () => {
  let north: NorthModbus;
  let configuration: NorthConnectorEntity<NorthModbusSettings>;

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
  });

  // Error codes handled by the test function
  // With the expected error messages to throw
  const ERROR_CODES = {
    ENOTFOUND: 'Please check host and port.',
    ECONNREFUSED: 'Please check host and port.',
    DEFAULT: 'Unable to connect to socket.' // For exceptions that we aren't explicitly specifying
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

  it('Connecting to socket successfully', async () => {
    north = new NorthModbus(configuration, logger, mockBaseFolders(testData.north.list[0].id));

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockReturnValue({
      connect(_connectionObject: unknown, callback: () => Promise<void>): Promise<void> {
        return callback();
      },
      on: jest.fn(),
      end: jest.fn()
    });

    await expect(north.testConnection()).resolves.not.toThrow();
  });

  it('Unable to create connection to socket', async () => {
    let code: ErrorCodes;
    const errorMessage = 'Error creating connection to socket';

    for (code in ERROR_CODES) {
      (logger.error as jest.Mock).mockClear();
      (logger.info as jest.Mock).mockClear();

      // Mock node:net Socket constructor and the used function
      (net.Socket as unknown as jest.Mock).mockReturnValueOnce({
        connect(_connectionObject: unknown, _callback: () => Promise<void>) {
          throw new ModbusError(errorMessage, code);
        },
        on: jest.fn(),
        end: jest.fn()
      });

      await expect(north.testConnection()).rejects.toThrow(new Error(`${ERROR_CODES[code]} ${errorMessage}`));
    }
  });

  it('should fail to connect', async () => {
    north = new NorthModbus(configuration, logger, mockBaseFolders(testData.north.list[0].id));

    const mockedEmitter = new CustomStream();
    mockedEmitter.connect = (_connectionObject: unknown, _callback: () => Promise<void>) => {
      return _callback();
    };

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockImplementation(() => mockedEmitter);

    north.testConnection().catch(() => null);

    expect(net.Socket).toHaveBeenCalledTimes(1);
    mockedEmitter.emit('error', 'connect error');
    await flushPromises();
  });
});
