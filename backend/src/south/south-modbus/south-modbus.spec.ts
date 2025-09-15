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
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import testData from '../../tests/utils/test-data';
import { connectSocket, readCoil, readDiscreteInputRegister, readHoldingRegister, readInputRegister } from '../../service/utils-modbus';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';

jest.mock('node:fs/promises');
jest.mock('node:net');
jest.mock('jsmodbus', () => ({
  client: {
    TCP: jest.fn().mockImplementation(() => ({}))
  }
}));
jest.mock('../../service/utils');
jest.mock('../../service/utils-modbus');

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
  const mockedEmitter = new CustomStream();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockImplementation(() => mockedEmitter);

    south = new SouthModbus(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  it('should properly connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    south.disconnect = jest.fn();
    south['reconnectTimeout'] = setTimeout(() => null);

    await south.connect();
    expect(net.Socket).toHaveBeenCalledTimes(1);
    expect(connectSocket).toHaveBeenCalledWith(mockedEmitter, configuration.settings);
    expect(logger.debug).toHaveBeenCalledWith(
      `Connecting Modbus socket into ${configuration.settings.host}:${configuration.settings.port}`
    );
    expect(logger.info).toHaveBeenCalledWith(`Modbus socket connected to ${configuration.settings.host}:${configuration.settings.port}`);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(south.disconnect).not.toHaveBeenCalled();
  });

  it('should properly reconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    south.disconnect = jest.fn();
    south['disconnecting'] = true;
    (connectSocket as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connect error');
    });
    await south.connect();
    expect(connectSocket).toHaveBeenCalledWith(mockedEmitter, configuration.settings);
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    south['disconnecting'] = false;
    (connectSocket as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connect error');
    });
    await south.connect();
    expect(south.disconnect).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Modbus socket error: connect error');
  });

  it('should properly disconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    await south.disconnect();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    south['reconnectTimeout'] = setTimeout(() => null);
    const mockedEmitter = { removeAllListeners: jest.fn(), destroy: jest.fn() };
    south['socket'] = mockedEmitter as unknown as net.Socket;

    await south.disconnect();
    expect(mockedEmitter.destroy).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should query last point', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    south['modbusClient'] = mockedClient;
    south.disconnect = jest.fn();
    south.addContent = jest.fn();
    south.modbusFunction = jest.fn().mockImplementation(() => {
      return [];
    });

    await south.lastPointQuery(configuration.items);
    expect(south.modbusFunction).toHaveBeenCalledTimes(configuration.items.length);
    expect(south.modbusFunction).toHaveBeenCalledWith(mockedClient, configuration.items[0]);
    expect(south.disconnect).not.toHaveBeenCalled();
    expect(south.addContent).toHaveBeenCalledWith({ content: [], type: 'time-values' });
  });

  it('should manage query last point error', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    south['modbusClient'] = {} as unknown as ModbusTCPClient;
    south['disconnecting'] = true;
    south.disconnect = jest.fn();
    south.addContent = jest.fn();
    south.modbusFunction = jest.fn().mockImplementation(() => {
      throw new Error('modbus function error');
    });
    await expect(south.lastPointQuery([configuration.items[1]])).rejects.toThrow(new Error('modbus function error'));
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    south['disconnecting'] = false;
    await expect(south.lastPointQuery([configuration.items[1]])).rejects.toThrow(new Error('modbus function error'));
    expect(south.disconnect).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should call read coil method', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    (readCoil as jest.Mock).mockReturnValueOnce('123');

    const values = await south.modbusFunction(mockedClient, configuration.items[4]);
    expect(readCoil).toHaveBeenCalledWith(mockedClient, 3715);
    expect(values).toEqual([
      {
        pointId: configuration.items[4].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should call readDiscreteInputRegister method', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    (readDiscreteInputRegister as jest.Mock).mockReturnValueOnce('123');

    const values = await south.modbusFunction(mockedClient, configuration.items[3]);
    expect(readDiscreteInputRegister).toHaveBeenCalledWith(mockedClient, 7810);
    expect(values).toEqual([
      {
        pointId: configuration.items[3].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should call readInputRegister method', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    (readInputRegister as jest.Mock).mockReturnValueOnce('123');

    const values = await south.modbusFunction(mockedClient, configuration.items[2]);
    expect(readInputRegister).toHaveBeenCalledWith(
      mockedClient,
      16001,
      configuration.settings.swapWordsInDWords,
      configuration.settings.swapBytesInWords,
      configuration.settings.endianness,
      configuration.items[2].settings.data!.multiplierCoefficient,
      configuration.items[2].settings.data!.dataType,
      configuration.items[2].settings.data!.bitIndex
    );
    expect(values).toEqual([
      {
        pointId: configuration.items[2].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should call readHoldingRegister method', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    (readHoldingRegister as jest.Mock).mockReturnValueOnce('123');

    const values = await south.modbusFunction(mockedClient, configuration.items[1]);
    expect(readHoldingRegister).toHaveBeenCalledWith(
      mockedClient,
      20097,
      configuration.settings.swapWordsInDWords,
      configuration.settings.swapBytesInWords,
      configuration.settings.endianness,
      configuration.items[1].settings.data!.multiplierCoefficient,
      configuration.items[1].settings.data!.dataType,
      configuration.items[1].settings.data!.bitIndex
    );
    expect(values).toEqual([
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should throw an error on wrong method', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
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
    await expect(south.modbusFunction(mockedClient, item)).rejects.toThrow(
      `Wrong Modbus type "${item.settings.modbusType}" for point "${item.name}"`
    );
  });

  it('should throw an error when client not set', async () => {
    south.modbusFunction = jest.fn();

    await expect(south.lastPointQuery(configuration.items)).rejects.toThrow(`Could not read address: Modbus client not set`);
    expect(south.modbusFunction).not.toHaveBeenCalled();
  });

  it('should properly test connection', async () => {
    await expect(south.testConnection()).resolves.not.toThrow();
    expect(connectSocket).toHaveBeenCalledWith(mockedEmitter, configuration.settings);
  });

  it('should properly manage error on test connection failure', async () => {
    let code: ErrorCodes;
    const errorMessage = 'Error creating connection to socket';

    for (code in ERROR_CODES) {
      (connectSocket as jest.Mock).mockImplementationOnce(() => {
        throw new ModbusError(errorMessage, code);
      });

      await expect(south.testConnection()).rejects.toThrow(new Error(`${ERROR_CODES[code]}: ${errorMessage}`));
    }
  });

  it('should properly test item', async () => {
    south = new SouthModbus(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
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

  it('should properly manage error on test item', async () => {
    let code: ErrorCodes;
    const errorMessage = 'Error creating connection to socket';
    const callback = jest.fn();

    for (code in ERROR_CODES) {
      (connectSocket as jest.Mock).mockImplementationOnce(() => {
        throw new ModbusError(errorMessage, code);
      });

      await expect(south.testItem(configuration.items[0], testData.south.itemTestingSettings, callback)).rejects.toThrow(
        new Error(`${ERROR_CODES[code]}: ${errorMessage}`)
      );
    }
  });

  it('should fail to connect when testing items', async () => {
    const callback = jest.fn();

    const mockedEmitter = new CustomStream();
    mockedEmitter.connect = (_connectionObject: unknown, _callback: () => Promise<void>) => {
      return _callback();
    };
    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockImplementation(() => mockedEmitter);

    south.testItem(configuration.items[0], testData.south.itemTestingSettings, callback).catch(() => null);

    expect(net.Socket).toHaveBeenCalledTimes(1);
  });
});
