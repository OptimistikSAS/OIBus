import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ReadStream } from 'node:fs';
import Stream from 'node:stream';
import testData from '../../tests/utils/test-data';
import {mockModule, reloadModule, buildNorthEntity} from '../../tests/utils/test-utils';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import type { NorthModbusSettings } from '../../../shared/model/north-settings.model';
import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type { OIBusModbusValue } from '../../transformers/connector-types.model';
import type NorthModbusClass from './north-modbus';
import type ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';

const nodeRequire = createRequire(import.meta.url);

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
  let NorthModbus: typeof NorthModbusClass;
  let north: NorthModbusClass;
  let configuration: NorthConnectorEntity<NorthModbusSettings>;

  const logger = new PinoLogger();
  const cacheService = new CacheServiceMock();
  const oiBusTransformer = new OIBusTransformerMock();

  const mockedEmitter = new CustomStream();

  const connectSocketFn = mock.fn(async () => undefined);
  const streamToStringFn = mock.fn(async () => '[]');

  const writeSingleCoilFn = mock.fn(async () => ({ response: { body: { valuesAsArray: [123] } } }));
  const writeSingleRegisterFn = mock.fn(async () => ({ response: { body: { valuesAsArray: [123] } } }));

  const modbusExports = {
    client: {
      TCP: function (this: { writeSingleRegister: typeof writeSingleRegisterFn; writeSingleCoil: typeof writeSingleCoilFn }) {
        this.writeSingleRegister = writeSingleRegisterFn;
        this.writeSingleCoil = writeSingleCoilFn;
      }
    }
  };

  const netExports = {
    __esModule: true,
    default: {
      Socket: function () {
        return mockedEmitter;
      }
    }
  };

  const transformerExports = {
    createTransformer: mock.fn(() => oiBusTransformer)
  };

  const utilsExports = {
    streamToString: streamToStringFn,
    checkAge: mock.fn(() => true),
    compress: mock.fn(async () => undefined),
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => []),
    groupItemsByGroup: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' }))
  };

  const utilsModbusExports = {
    connectSocket: connectSocketFn
  };

  before(() => {
    mockModule(nodeRequire, 'jsmodbus', modbusExports);
    mockModule(nodeRequire, 'node:net', netExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/utils-modbus', utilsModbusExports);
    mockModule(nodeRequire, '../../service/transformer.service', transformerExports);
    mockModule(nodeRequire, '../../service/cache/cache.service', {
      __esModule: true,
      default: function () {
        return cacheService;
      }
    });
    NorthModbus = reloadModule<{ default: typeof NorthModbusClass }>(nodeRequire, './north-modbus').default;
  });

  beforeEach(() => {
    transformerExports.createTransformer.mock.resetCalls();
    connectSocketFn.mock.resetCalls();
    connectSocketFn.mock.mockImplementation(async () => undefined);
    streamToStringFn.mock.resetCalls();
    streamToStringFn.mock.mockImplementation(async () => '[]');
    writeSingleCoilFn.mock.resetCalls();
    writeSingleRegisterFn.mock.resetCalls();
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();

    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });

    configuration = buildNorthEntity<NorthModbusSettings>('modbus', {
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

    north = new NorthModbus(configuration, logger, cacheService);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should retrieve supported types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['modbus']);
  });

  it('should properly connect', async () => {
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);
    (north as unknown as { reconnectTimeout: NodeJS.Timeout | null })['reconnectTimeout'] = setTimeout(() => null);

    await north.connect();

    assert.strictEqual(connectSocketFn.mock.calls.length, 1);
    assert.deepStrictEqual(connectSocketFn.mock.calls[0].arguments[1], configuration.settings);
    assert.ok(
      logger.debug.mock.calls.some(
        c => c.arguments[0] === `Connecting Modbus socket into ${configuration.settings.host}:${configuration.settings.port}`
      )
    );
    assert.ok(
      logger.info.mock.calls.some(
        c => c.arguments[0] === `Modbus socket connected to ${configuration.settings.host}:${configuration.settings.port}`
      )
    );
    assert.strictEqual(disconnectMock.mock.calls.length, 0);
  });

  it('should properly reconnect on connect error', async () => {
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);
    (north as unknown as { disconnecting: boolean })['disconnecting'] = true;

    // First fail
    connectSocketFn.mock.mockImplementationOnce(() => {
      throw new Error('connect error');
    });

    await north.connect();

    assert.strictEqual(connectSocketFn.mock.calls.length, 1);
    assert.strictEqual(disconnectMock.mock.calls.length, 1);

    // Second fail (clean state)
    (north as unknown as { disconnecting: boolean })['disconnecting'] = false;
    connectSocketFn.mock.mockImplementationOnce(() => {
      throw new Error('connect error');
    });

    await north.connect();

    assert.strictEqual(disconnectMock.mock.calls.length, 2);
    assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'Modbus socket error: connect error'));
  });

  it('should properly disconnect', async () => {
    // 1. Disconnect without active components
    await north.disconnect();

    // 2. Disconnect with active socket and timeout
    (north as unknown as { reconnectTimeout: NodeJS.Timeout | null })['reconnectTimeout'] = setTimeout(() => null);
    const mockedSocket = { removeAllListeners: mock.fn(), destroy: mock.fn() };
    (north as unknown as { socket: typeof mockedSocket })['socket'] = mockedSocket;

    await north.disconnect();

    assert.strictEqual(mockedSocket.destroy.mock.calls.length, 1);
    assert.strictEqual((north as unknown as { modbusClient: null })['modbusClient'], null);
  });

  it('should throw error if connector is in reconnecting state', async () => {
    (north as unknown as { reconnectTimeout: NodeJS.Timeout | null })['reconnectTimeout'] = setTimeout(() => null);
    const readStream = {} as ReadStream;

    await assert.rejects(async () => {
      await north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'modbus'
      });
    }, /Connector is reconnecting\.\.\./);
  });

  it('should properly handle modbus content', async () => {
    const values: Array<OIBusModbusValue> = [
      { address: '0x001', value: 123, modbusType: 'register' },
      { address: '0x002', value: true, modbusType: 'coil' }
    ];

    streamToStringFn.mock.mockImplementation(async () => JSON.stringify(values));
    const mockedClient = {} as unknown as ModbusTCPClient;
    (north as unknown as { modbusClient: ModbusTCPClient })['modbusClient'] = mockedClient;

    const modbusFnMock = mock.method(north, 'modbusFunction', async () => undefined);
    const readStream = {} as ReadStream;

    await north.handleContent(readStream, {
      contentFile: 'file.json',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'modbus'
    });

    assert.strictEqual(streamToStringFn.mock.calls.length, 1);
    assert.deepStrictEqual(streamToStringFn.mock.calls[0].arguments, [readStream]);
    assert.strictEqual(modbusFnMock.mock.calls.length, 2);
    assert.deepStrictEqual(modbusFnMock.mock.calls[0].arguments, [mockedClient, values[0]]);
    assert.deepStrictEqual(modbusFnMock.mock.calls[1].arguments, [mockedClient, values[1]]);
  });

  it('should throw error if modbus client not set during content handling', async () => {
    const values: Array<OIBusModbusValue> = [];
    streamToStringFn.mock.mockImplementation(async () => JSON.stringify(values));

    (north as unknown as { modbusClient: null })['modbusClient'] = null;
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);
    const readStream = {} as ReadStream;

    await assert.rejects(async () => {
      await north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'modbus'
      });
    }, /Modbus client not set\. The connector cannot write values/);

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should handle errors during processing and trigger reconnect', async () => {
    const values: Array<OIBusModbusValue> = [{ address: '0x001', value: 123, modbusType: 'register' }];
    streamToStringFn.mock.mockImplementation(async () => JSON.stringify(values));

    (north as unknown as { modbusClient: ModbusTCPClient })['modbusClient'] = {} as unknown as ModbusTCPClient;
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    mock.method(north, 'modbusFunction', async () => {
      throw new Error('write error');
    });
    const readStream = {} as ReadStream;

    await assert.rejects(async () => {
      await north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'modbus'
      });
    }, /write error/);

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should not trigger reconnect when disabled', async () => {
    north.connectorConfiguration.enabled = false;
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);
    await (north as unknown as { triggerReconnect: () => Promise<void> })['triggerReconnect']();
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.strictEqual((north as unknown as { reconnectTimeout: null })['reconnectTimeout'], null);
  });

  it('should handle wrapped OIBus errors', async () => {
    const values: Array<OIBusModbusValue> = [{ address: '0x001', value: 123, modbusType: 'register' }];
    streamToStringFn.mock.mockImplementation(async () => JSON.stringify(values));

    (north as unknown as { modbusClient: ModbusTCPClient })['modbusClient'] = {} as unknown as ModbusTCPClient;
    mock.method(north, 'modbusFunction', async () => {
      throw { err: 'OIBusError', message: 'Something went wrong' };
    });
    const readStream = {} as ReadStream;

    await assert.rejects(async () => {
      await north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'modbus'
      });
    }, /OIBusError - Something went wrong/);
  });

  it('modbusFunction should write coil', async () => {
    const value: OIBusModbusValue = { address: '0x002', value: true, modbusType: 'coil' };

    const writeSingleCoilLocal = mock.fn(async () => undefined);
    const writeSingleRegisterLocal = mock.fn(async () => undefined);
    const modbusClient = {
      writeSingleCoil: writeSingleCoilLocal,
      writeSingleRegister: writeSingleRegisterLocal
    } as unknown as ModbusTCPClient;

    await north.modbusFunction(modbusClient, value);

    assert.strictEqual(writeSingleCoilLocal.mock.calls.length, 1);
    assert.deepStrictEqual(writeSingleCoilLocal.mock.calls[0].arguments, [2, true]);
    assert.strictEqual(writeSingleRegisterLocal.mock.calls.length, 0);
  });

  it('modbusFunction should write register', async () => {
    const value: OIBusModbusValue = { address: '1', value: 123, modbusType: 'register' };

    const writeSingleCoilLocal = mock.fn(async () => undefined);
    const writeSingleRegisterLocal = mock.fn(async () => undefined);
    const modbusClient = {
      writeSingleCoil: writeSingleCoilLocal,
      writeSingleRegister: writeSingleRegisterLocal
    } as unknown as ModbusTCPClient;

    // Change offset setting for this test
    (north as unknown as { connector: { settings: { addressOffset: string } } })['connector'].settings.addressOffset = 'jbus';

    await north.modbusFunction(modbusClient, value);

    // JBus offset means -1, so address 1 becomes 0
    assert.strictEqual(writeSingleRegisterLocal.mock.calls.length, 1);
    assert.deepStrictEqual(writeSingleRegisterLocal.mock.calls[0].arguments, [0, 123]);
    assert.strictEqual(writeSingleCoilLocal.mock.calls.length, 0);
  });

  it('modbusFunction should throw error if bad modbus type', async () => {
    const value = { address: '0x001', value: 123, modbusType: 'bad' };
    const modbusClient = {} as unknown as ModbusTCPClient;

    await assert.rejects(async () => {
      await north.modbusFunction(modbusClient, value as unknown as OIBusModbusValue);
    }, /Wrong Modbus type "bad" for address 1/);
  });

  it('should properly test connection', async () => {
    await assert.doesNotReject(async () => {
      await north.testConnection();
    });
    assert.ok(connectSocketFn.mock.calls.some(c => c.arguments[1] === configuration.settings));
  });

  it('should properly manage error on test connection failure', async () => {
    // ENOTFOUND
    connectSocketFn.mock.mockImplementationOnce(async () => {
      throw { code: 'ENOTFOUND', message: 'Host not found' };
    });
    await assert.rejects(async () => {
      await north.testConnection();
    }, /Please check host and port: Host not found/);

    // ECONNREFUSED
    connectSocketFn.mock.mockImplementationOnce(async () => {
      throw { code: 'ECONNREFUSED', message: 'Connection refused' };
    });
    await assert.rejects(async () => {
      await north.testConnection();
    }, /Please check host and port: Connection refused/);

    // Default Error
    connectSocketFn.mock.mockImplementationOnce(async () => {
      throw { code: 'OTHER', message: 'Unknown error' };
    });
    await assert.rejects(async () => {
      await north.testConnection();
    }, /Unable to connect to socket: Unknown error/);
  });
});
