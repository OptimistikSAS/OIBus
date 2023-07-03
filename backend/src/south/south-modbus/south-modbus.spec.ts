import SouthModbus from './south-modbus';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { SouthConnectorItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import net from 'node:net';
import Stream from 'node:stream';
import { SouthModbusSettings } from '../../../../shared/model/south-settings.model';

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
const database = new DatabaseMock();
jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return {
        southCacheRepository: {
          database
        }
      };
    }
);

jest.mock(
  '../../service/south-connector-metrics.service',
  () =>
    function () {
      return {
        updateMetrics: jest.fn(),
        get stream() {
          return { stream: 'myStream' };
        },
        metrics: {
          numberOfValuesRetrieved: 1,
          numberOfFilesRetrieved: 1
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

const items: Array<SouthConnectorItemDTO> = [
  {
    id: 'id1',
    name: 'HoldingRegister',
    connectorId: 'southId',
    settings: {
      modbusType: 'holdingRegister',
      dataType: 'UInt16',
      address: '0x4E80',
      multiplierCoefficient: 1
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'HoldingRegister',
    connectorId: 'southId',
    settings: {
      modbusType: 'holdingRegister',
      dataType: 'UInt16',
      address: '20097',
      multiplierCoefficient: 1
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id3',
    name: 'InputRegister',
    connectorId: 'southId',
    settings: {
      modbusType: 'inputRegister',
      dataType: 'UInt16',
      address: '0x3E81',
      multiplierCoefficient: 1
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id4',
    name: 'DiscreteInput',
    connectorId: 'southId',
    settings: {
      modbusType: 'discreteInput',
      dataType: 'UInt16',
      address: '0x1E82',
      multiplierCoefficient: 1
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id5',
    name: 'Coil',
    connectorId: 'southId',
    settings: {
      modbusType: 'coil',
      dataType: 'UInt16',
      address: '0x0E83',
      multiplierCoefficient: 1
    },
    scanModeId: 'scanModeId1'
  }
];

let south: SouthModbus;
const configuration: SouthConnectorDTO = {
  id: 'southId',
  name: 'south',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  history: {
    maxInstantPerItem: true,
    maxReadInterval: 3600,
    readDelay: 0
  },
  settings: {
    port: 502,
    host: '127.0.0.1',
    slaveId: 1,
    addressOffset: 'Modbus',
    endianness: 'Big Endian',
    swapBytesInWords: false,
    swapWordsInDWords: false,
    retryInterval: 10000
  }
};
const nowDateString = '2020-02-02T02:02:02.222Z';
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

class CustomStream extends Stream {
  constructor() {
    super();
  }

  connect(_connectionObject: any, _callback: any) {}
  end() {}
}

describe('SouthModbus', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockReturnValue({
      connect(_connectionObject: any, callback: any) {
        callback();
      },
      on() {
        jest.fn();
      }
    });

    south = new SouthModbus(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true
    );
  });

  it('should fail to connect and try again', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const mockedEmitter = new CustomStream();
    mockedEmitter.connect = (_connectionObject: any, callback: any) => {
      callback();
    };

    // Mock node:net Socket constructor and the used function
    (net.Socket as unknown as jest.Mock).mockImplementation(() => mockedEmitter);

    await south.disconnect();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    await south.connect();
    expect(net.Socket).toHaveBeenCalledTimes(1);
    mockedEmitter.emit('error', 'connect error');
    await flushPromises();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith('Modbus socket error: connect error');
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(net.Socket).toHaveBeenCalledTimes(2);
    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  });

  it('should read coil', async () => {
    await expect(south.readCoil(1234)).rejects.toThrowError('Read coil error: Modbus client not set');

    await south.start();
    const result = await south.readCoil(1234);
    expect(readCoils).toHaveBeenCalledTimes(1);
    expect(readCoils).toHaveBeenCalledWith(1234, 1);
    expect(result).toEqual(123);
  });

  it('should read discrete input', async () => {
    await expect(south.readDiscreteInputRegister(1234)).rejects.toThrowError('Read discrete input error: Modbus client not set');

    await south.start();
    const result = await south.readDiscreteInputRegister(1234);
    expect(readDiscreteInputs).toHaveBeenCalledTimes(1);
    expect(readDiscreteInputs).toHaveBeenCalledWith(1234, 1);
    expect(result).toEqual(123);
  });

  it('should read input', async () => {
    await expect(south.readInputRegister(1234, 1, 'UInt16')).rejects.toThrowError('Read input error: Modbus client not set');

    south.getNumberOfWords = jest.fn().mockReturnValue(2);
    south.getValueFromBuffer = jest.fn().mockReturnValue(123);
    await south.start();
    const result = await south.readInputRegister(1234, 1, 'UInt16');
    expect(readInputRegisters).toHaveBeenCalledTimes(1);
    expect(readInputRegisters).toHaveBeenCalledWith(1234, 2);
    expect(result).toEqual(123);
    expect(south.getValueFromBuffer).toHaveBeenCalledWith(Buffer.from([1, 2, 3, 4]), 1, 'UInt16');
  });

  it('should read holding', async () => {
    await expect(south.readHoldingRegister(1234, 1, 'UInt16')).rejects.toThrowError('Read holding error: Modbus client not set');

    south.getNumberOfWords = jest.fn().mockReturnValue(2);
    south.getValueFromBuffer = jest.fn().mockReturnValue(123);
    await south.start();
    const result = await south.readHoldingRegister(1234, 1, 'UInt16');
    expect(readHoldingRegisters).toHaveBeenCalledTimes(1);
    expect(readHoldingRegisters).toHaveBeenCalledWith(1234, 2);
    expect(result).toEqual(123);
    expect(south.getValueFromBuffer).toHaveBeenCalledWith(Buffer.from([1, 2, 3, 4]), 1, 'UInt16');
  });

  it('should query last point', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      return callback();
    });

    south.disconnect = jest.fn();
    south.connect = jest.fn();
    south.modbusFunction = jest
      .fn()
      .mockImplementationOnce(() => {
        const error = { ...new Error('modbus function error'), err: 'Offline' };
        error.err = 'Offline';
        throw error;
      })
      .mockImplementationOnce(() => {
        const error = { ...new Error('modbus function error'), err: 'Offline' };
        error.err = 'another error';
        throw error;
      })
      .mockImplementation(() => {
        return true;
      });
    await south.lastPointQuery([items[1]]);
    expect(logger.error).toHaveBeenCalledWith(`Modbus server ${configuration.settings.host}:${configuration.settings.port} offline`);
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(configuration.settings.retryInterval);
    expect(south.connect).toHaveBeenCalledTimes(1);
    await expect(south.lastPointQuery([items[0]])).rejects.toThrowError('another error');
    jest.clearAllMocks();
    await south.lastPointQuery([items[2]]);
    expect(south.modbusFunction).toHaveBeenCalledTimes(1);
    expect(south.disconnect).not.toHaveBeenCalled();
    expect(south.connect).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should call read coil method', async () => {
    south.readCoil = jest.fn().mockReturnValue(123);
    south.addValues = jest.fn();
    await south.modbusFunction(items[4]);
    expect(south.readCoil).toHaveBeenCalledTimes(1);
    expect(south.addValues).toHaveBeenCalledTimes(1);
    expect(south.addValues).toHaveBeenCalledWith([
      {
        pointId: items[4].name,
        timestamp: nowDateString,
        data: { value: JSON.stringify(123) }
      }
    ]);
  });

  it('should call readDiscreteInputRegister method', async () => {
    south.readDiscreteInputRegister = jest.fn().mockReturnValue(123);
    south.addValues = jest.fn();
    await south.modbusFunction(items[3]);
    expect(south.readDiscreteInputRegister).toHaveBeenCalledTimes(1);
    expect(south.addValues).toHaveBeenCalledTimes(1);
    expect(south.addValues).toHaveBeenCalledWith([
      {
        pointId: items[3].name,
        timestamp: nowDateString,
        data: { value: JSON.stringify(123) }
      }
    ]);
  });

  it('should call readInputRegister method', async () => {
    south.readInputRegister = jest.fn().mockReturnValue(123);
    south.addValues = jest.fn();
    await south.modbusFunction(items[2]);
    expect(south.readInputRegister).toHaveBeenCalledTimes(1);
    expect(south.addValues).toHaveBeenCalledTimes(1);
    expect(south.addValues).toHaveBeenCalledWith([
      {
        pointId: items[2].name,
        timestamp: nowDateString,
        data: { value: JSON.stringify(123) }
      }
    ]);
  });

  it('should call readHoldingRegister method', async () => {
    south.readHoldingRegister = jest.fn().mockReturnValue(123);
    south.addValues = jest.fn();
    await south.modbusFunction(items[1]);
    expect(south.readHoldingRegister).toHaveBeenCalledTimes(1);
    expect(south.addValues).toHaveBeenCalledTimes(1);
    expect(south.addValues).toHaveBeenCalledWith([
      {
        pointId: items[1].name,
        timestamp: nowDateString,
        data: { value: JSON.stringify(123) }
      }
    ]);
  });

  it('should call readHoldingRegister method', async () => {
    south.addValues = jest.fn();
    configuration.settings.addressOffset = 'JBus';
    const item: SouthConnectorItemDTO = {
      id: 'bad',
      connectorId: 'connectorId',
      name: 'Bad Item',
      scanModeId: 'id',
      settings: {
        modbusType: 'bad type',
        address: '1010'
      }
    };
    await expect(south.modbusFunction(item)).rejects.toThrowError(`Wrong Modbus type "${item.settings.modbusType}" for point ${item.name}`);
    expect(south.addValues).not.toHaveBeenCalled();
  });

  it('should retrieve number of words', () => {
    expect(south.getNumberOfWords('UInt16')).toEqual(1);
    expect(south.getNumberOfWords('Int16')).toEqual(1);
    expect(south.getNumberOfWords('UInt32')).toEqual(2);
    expect(south.getNumberOfWords('Int32')).toEqual(2);
    expect(south.getNumberOfWords('Float')).toEqual(2);
    expect(south.getNumberOfWords('BigUInt64')).toEqual(4);
    expect(south.getNumberOfWords('BigInt64')).toEqual(4);
    expect(south.getNumberOfWords('Double')).toEqual(4);
    expect(south.getNumberOfWords('other')).toEqual(1);
  });

  it('should get value from buffer', () => {
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4]), 1, 'UInt16')).toEqual(258);
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4]), 1, 'UInt32')).toEqual(50594050);
    configuration.settings.swapWordsInDWords = true;
    configuration.settings.swapBytesInWords = true;
    configuration.settings.endianness = 'Little Endian';
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4]), 1, 'UInt32')).toEqual(50594050);
    expect(south.getValueFromBuffer(Buffer.from([1, 2, 3, 4]), 1, 'UInt16')).toEqual(258);
  });

  it('should test connection with mssql', async () => {
    // TODO
    await expect(SouthModbus.testConnection({} as SouthModbusSettings, logger, encryptionService)).rejects.toThrow(
      'TODO: method needs to be implemented'
    );
    expect(logger.trace).toHaveBeenCalledWith(`Testing connection`);
  });
});
