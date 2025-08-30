import SouthModbus from './south-modbus';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import net from 'node:net';
import Stream from 'node:stream';
import {
  SouthModbusItemSettings,
  SouthModbusItemSettingsModbusType,
  SouthModbusSettings
} from '../../../shared/model/south-settings.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import testData from '../../tests/utils/test-data';
import { flushPromises, mockBaseFolders } from '../../tests/utils/test-utils';

jest.mock('node:fs/promises');
jest.mock('node:net');
const readCoils = jest.fn().mockReturnValue({ response: { body: { valuesAsArray: [123] } } });
const readDiscreteInputs = jest.fn().mockReturnValue({ response: { body: { valuesAsArray: [123] } } });
const readInputRegisters = jest.fn().mockReturnValue({ response: { body: { valuesAsBuffer: Buffer.from([1, 2, 3, 4]) } } });
const readHoldingRegisters = jest.fn().mockReturnValue({ response: { body: { valuesAsBuffer: Buffer.from([1, 2, 3, 4]) } } });
jest.mock('jsmodbus', () => ({
  client: {
    TCP: jest.fn().mockImplementation(() => ({
      readHoldingRegisters,
      readInputRegisters,
      readDiscreteInputs,
      readCoils
    }))
  }
}));
jest.mock('../../service/utils');

const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

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

describe('South Modbus', () => {
  let south: SouthModbus;
  const configuration: SouthConnectorEntity<SouthModbusSettings, SouthModbusItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'modbus',
    description: 'my test connector',
    enabled: true,
    settings: {
      port: 502,
      host: '127.0.0.1',
      slaveId: 1,
      addressOffset: 'modbus',
      endianness: 'big-endian',
      swapBytesInWords: false,
      swapWordsInDWords: false,
      retryInterval: 10000
    },
    items: [
      {
        id: 'id1',
        name: 'HoldingRegister',
        enabled: true,
        settings: {
          address: '0x4E80',
          modbusType: 'holding-register',
          data: {
            dataType: 'uint16',
            multiplierCoefficient: 1
          }
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id2',
        name: 'HoldingRegister',
        enabled: true,
        settings: {
          address: '20097',
          modbusType: 'holding-register',
          data: {
            dataType: 'uint16',
            multiplierCoefficient: 1
          }
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id3',
        name: 'InputRegister',
        enabled: true,
        settings: {
          address: '0x3E81',
          modbusType: 'input-register',
          data: {
            dataType: 'uint16',
            multiplierCoefficient: 1
          }
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id4',
        name: 'DiscreteInput',
        enabled: true,
        settings: {
          address: '0x1E82',
          modbusType: 'discrete-input'
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id5',
        name: 'Coil',
        enabled: true,
        settings: {
          address: '0x0E83',
          modbusType: 'coil'
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id6',
        name: 'HoldingRegister',
        enabled: true,
        settings: {
          address: '0x0E88',
          modbusType: 'holding-register',
          data: {
            dataType: 'bit',
            bitIndex: 1,
            multiplierCoefficient: 1
          }
        },
        scanMode: testData.scanMode.list[0]
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockReturnValue({
      connect(_connectionObject: unknown, callback: () => Promise<void>): Promise<void> {
        return callback();
      },
      on() {
        jest.fn();
      }
    });

    south = new SouthModbus(
      configuration,
      addContentCallback,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should fail to connect and try again', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const mockedEmitter = new CustomStream();
    mockedEmitter.connect = (_connectionObject: unknown, _callback: () => Promise<void>): Promise<void> => {
      return _callback();
    };

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockImplementation(() => mockedEmitter);

    await south.disconnect();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    await south.connect();
    expect(net.Socket).toHaveBeenCalledTimes(1);
    mockedEmitter.emit('error', 'connect error');
    await flushPromises();
    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

    await south.connect();
    expect(net.Socket).toHaveBeenCalledTimes(2);
    mockedEmitter.emit('error', 'connect error');
    await flushPromises();
    await south.connect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);

    expect(logger.error).toHaveBeenCalledWith('Modbus socket error: connect error');
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(net.Socket).toHaveBeenCalledTimes(3);
    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  });

  it('should read coil', async () => {
    await expect(south.readCoil(1234)).rejects.toThrow('Read coil error: Modbus client not set');

    await south.start();
    const result = await south.readCoil(1234);
    expect(readCoils).toHaveBeenCalledTimes(1);
    expect(readCoils).toHaveBeenCalledWith(1234, 1);
    expect(result).toEqual('123');
  });

  it('should read discrete input', async () => {
    await expect(south.readDiscreteInputRegister(1234)).rejects.toThrow('Read discrete input error: Modbus client not set');

    await south.start();
    const result = await south.readDiscreteInputRegister(1234);
    expect(readDiscreteInputs).toHaveBeenCalledTimes(1);
    expect(readDiscreteInputs).toHaveBeenCalledWith(1234, 1);
    expect(result).toEqual('123');
  });

  it('should read input', async () => {
    await expect(south.readInputRegister(1234, 1, 'uint16', 10)).rejects.toThrow('Read input error: Modbus client not set');

    south.getNumberOfWords = jest.fn().mockReturnValue(2);
    south.getValueFromBuffer = jest.fn().mockReturnValue(123);
    await south.start();
    const result = await south.readInputRegister(1234, 1, 'uint16', 10);
    expect(readInputRegisters).toHaveBeenCalledTimes(1);
    expect(readInputRegisters).toHaveBeenCalledWith(1234, 2);
    expect(result).toEqual(123);
    expect(south.getValueFromBuffer).toHaveBeenCalledWith(Buffer.from([1, 2, 3, 4]), 1, 'uint16', 10);
  });

  it('should read holding', async () => {
    await expect(south.readHoldingRegister(1234, 1, 'uint16', 10)).rejects.toThrow('Read holding error: Modbus client not set');

    south.getNumberOfWords = jest.fn().mockReturnValue(2);
    south.getValueFromBuffer = jest.fn().mockReturnValue(123);
    await south.start();
    const result = await south.readHoldingRegister(1234, 1, 'uint16', 10);
    expect(readHoldingRegisters).toHaveBeenCalledTimes(1);
    expect(readHoldingRegisters).toHaveBeenCalledWith(1234, 2);
    expect(result).toEqual(123);
    expect(south.getValueFromBuffer).toHaveBeenCalledWith(Buffer.from([1, 2, 3, 4]), 1, 'uint16', 10);
  });

  it('should query last point', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    south.disconnect = jest.fn();
    south.connect = jest.fn();
    south.addContent = jest.fn();
    south.modbusFunction = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('modbus function error');
      })
      .mockImplementationOnce(() => {
        throw {
          err: 'Offline',
          message: 'no connection to modbus server'
        };
      })
      .mockImplementation(() => {
        return [];
      });
    await expect(south.lastPointQuery([configuration.items[1]])).rejects.toThrow(new Error('modbus function error'));
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(south.connect).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    await expect(south.lastPointQuery([configuration.items[1]])).rejects.toThrow(new Error('Offline - no connection to modbus server'));
    jest.clearAllMocks();

    await south.lastPointQuery([configuration.items[2]]);
    expect(south.modbusFunction).toHaveBeenCalledTimes(1);
    expect(south.disconnect).not.toHaveBeenCalled();
    expect(south.connect).not.toHaveBeenCalled();
    expect(south.addContent).toHaveBeenCalledWith({ content: [], type: 'time-values' });
  });

  it('should call read coil method', async () => {
    south.readCoil = jest.fn().mockReturnValue('123');
    const values = await south.modbusFunction(configuration.items[4]);
    expect(south.readCoil).toHaveBeenCalledTimes(1);
    expect(values).toEqual([
      {
        pointId: configuration.items[4].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should call readDiscreteInputRegister method', async () => {
    south.readDiscreteInputRegister = jest.fn().mockReturnValue('123');
    const values = await south.modbusFunction(configuration.items[3]);
    expect(south.readDiscreteInputRegister).toHaveBeenCalledTimes(1);
    expect(values).toEqual([
      {
        pointId: configuration.items[3].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should call readInputRegister method', async () => {
    south.readInputRegister = jest.fn().mockReturnValue('123');
    const values = await south.modbusFunction(configuration.items[2]);
    expect(south.readInputRegister).toHaveBeenCalledTimes(1);
    expect(values).toEqual([
      {
        pointId: configuration.items[2].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should call readHoldingRegister method', async () => {
    south.readHoldingRegister = jest.fn().mockReturnValue('123');
    const values = await south.modbusFunction(configuration.items[1]);
    expect(south.readHoldingRegister).toHaveBeenCalledTimes(1);
    expect(values).toEqual([
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should call readHoldingRegister method', async () => {
    south.addContent = jest.fn();
    configuration.settings.addressOffset = 'jbus';
    const item: SouthConnectorItemEntity<SouthModbusItemSettings> = {
      id: 'bad',
      enabled: true,
      name: 'Bad Item',
      scanMode: testData.scanMode.list[0],
      settings: {
        modbusType: 'bad type' as SouthModbusItemSettingsModbusType,
        address: '1010'
      }
    };
    await expect(south.modbusFunction(item)).rejects.toThrow(`Wrong Modbus type "${item.settings.modbusType}" for point ${item.name}`);
  });

  it('should retrieve number of words', () => {
    expect(south.getNumberOfWords('bit')).toEqual(1);
    expect(south.getNumberOfWords('uint16')).toEqual(1);
    expect(south.getNumberOfWords('int16')).toEqual(1);
    expect(south.getNumberOfWords('uint32')).toEqual(2);
    expect(south.getNumberOfWords('int32')).toEqual(2);
    expect(south.getNumberOfWords('float')).toEqual(2);
    expect(south.getNumberOfWords('big-uint64')).toEqual(4);
    expect(south.getNumberOfWords('big-int64')).toEqual(4);
    expect(south.getNumberOfWords('double')).toEqual(4);
    expect(south.getNumberOfWords('other')).toEqual(1);
  });

  it('should get value from buffer', () => {
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4]), 1, 'uint16', undefined)).toEqual('258');
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4]), 1, 'int16', undefined)).toEqual('258');
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4]), 1, 'uint32', undefined)).toEqual('50594050');
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4]), 1, 'int32', undefined)).toEqual('50594050');
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]), 1, 'big-uint64', undefined)).toEqual('217299790240154880');
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]), 1, 'big-int64', undefined)).toEqual('217299790240154880');
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4]), 1, 'bit', 1)).toEqual('1');
    configuration.settings.swapWordsInDWords = true;
    configuration.settings.swapBytesInWords = true;
    configuration.settings.endianness = 'little-endian';
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4]), 1, 'uint32', 10)).toEqual('50594050');
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4]), 1, 'uint16', 10)).toEqual('258');
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4]), 1, 'bit', 1)).toEqual('1');
    configuration.settings.swapWordsInDWords = true;
    configuration.settings.swapBytesInWords = false;
    expect(south.getValueFromBuffer(Buffer.from([0x00, 0x00, 0x80, 0x3f]), 1, 'float', undefined)).toEqual('1');
    expect(south.getValueFromBuffer(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x3f]), 1, 'double', undefined)).toEqual(
      '0.0078125'
    );
  });
});

describe('SouthModbus test connection', () => {
  let south: SouthModbus;
  const configuration: SouthConnectorEntity<SouthModbusSettings, SouthModbusItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'modbus',
    description: 'my test connector',
    enabled: true,
    settings: {
      port: 502,
      host: '127.0.0.1',
      slaveId: 1,
      addressOffset: 'modbus',
      endianness: 'big-endian',
      swapBytesInWords: false,
      swapWordsInDWords: false,
      retryInterval: 10000
    },
    items: [
      {
        id: 'id1',
        name: 'HoldingRegister',
        enabled: true,
        settings: {
          address: '0x4E80',
          modbusType: 'holding-register',
          data: {
            dataType: 'uint16',
            multiplierCoefficient: 1
          }
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id2',
        name: 'HoldingRegister',
        enabled: true,
        settings: {
          address: '20097',
          modbusType: 'holding-register',
          data: {
            dataType: 'uint16',
            multiplierCoefficient: 1
          }
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id3',
        name: 'InputRegister',
        enabled: true,
        settings: {
          address: '0x3E81',
          modbusType: 'input-register',
          data: {
            dataType: 'uint16',
            multiplierCoefficient: 1
          }
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id4',
        name: 'DiscreteInput',
        enabled: true,
        settings: {
          address: '0x1E82',
          modbusType: 'discrete-input'
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id5',
        name: 'Coil',
        enabled: true,
        settings: {
          address: '0x0E83',
          modbusType: 'coil'
        },
        scanMode: testData.scanMode.list[0]
      },
      {
        id: 'id6',
        name: 'HoldingRegister',
        enabled: true,
        settings: {
          address: '0x0E88',
          modbusType: 'holding-register',
          data: {
            dataType: 'bit',
            bitIndex: 1,
            multiplierCoefficient: 1
          }
        },
        scanMode: testData.scanMode.list[0]
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);
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
    south = new SouthModbus(
      configuration,
      addContentCallback,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockReturnValue({
      connect(_connectionObject: unknown, callback: () => Promise<void>): Promise<void> {
        return callback();
      },
      on: jest.fn(),
      end: jest.fn()
    });

    await expect(south.testConnection()).resolves.not.toThrow();
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

      await expect(south.testConnection()).rejects.toThrow(new Error(`${ERROR_CODES[code]} ${errorMessage}`));
    }
  });

  it('should fail to connect', async () => {
    south = new SouthModbus(
      configuration,
      addContentCallback,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );

    const mockedEmitter = new CustomStream();
    mockedEmitter.connect = (_connectionObject: unknown, _callback: () => Promise<void>) => {
      return _callback();
    };

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockImplementation(() => mockedEmitter);

    south.testConnection().catch(() => null);

    expect(net.Socket).toHaveBeenCalledTimes(1);
    mockedEmitter.emit('error', 'connect error');
    await flushPromises();
  });

  it('Connecting to socket successfully when testing configuration.items', async () => {
    south = new SouthModbus(
      configuration,
      addContentCallback,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
    const callback = jest.fn();

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockReturnValue({
      connect(_connectionObject: unknown, callback: () => Promise<void>) {
        callback();
      },
      on: jest.fn(),
      end: jest.fn()
    });

    await expect(south.testItem(configuration.items[0], testData.south.itemTestingSettings, callback)).resolves.not.toThrow();
  });

  it('Unable to create connection to socket when testing configuration.items', async () => {
    let code: ErrorCodes;
    const errorMessage = 'Error creating connection to socket';
    const callback = jest.fn();

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

      await expect(south.testItem(configuration.items[0], testData.south.itemTestingSettings, callback)).rejects.toThrow(
        new Error(`${ERROR_CODES[code]} ${errorMessage}`)
      );
    }
  });

  it('should fail to connect when testing items', async () => {
    south = new SouthModbus(
      configuration,
      addContentCallback,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
    const callback = jest.fn();

    const mockedEmitter = new CustomStream();
    mockedEmitter.connect = (_connectionObject: unknown, _callback: () => Promise<void>) => {
      return _callback();
    };

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockImplementation(() => mockedEmitter);

    south.testItem(configuration.items[0], testData.south.itemTestingSettings, callback).catch(() => null);

    expect(net.Socket).toHaveBeenCalledTimes(1);
    mockedEmitter.emit('error', 'connect error');
    await flushPromises();
  });
});
