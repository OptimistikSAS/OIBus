import assert from 'node:assert/strict';
import type { ReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import type net from 'node:net';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';

import type { NorthModbusSettings } from '../../../shared/model/connector/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/domain/engine.model';

import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type * as Utils from '../../service/utils';
import type * as UtilsModbus from '../../service/utils-modbus';
import { createCacheServiceMock } from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { buildNorthEntity, createMock, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type { OIBusModbusValue } from '../../transformers/connector-types.model';
import type NorthModbusClass from './north-modbus';

const nodeRequire = createRequire(import.meta.url);

// The stream is only handed to the (mocked) streamToString
const readStream = {} as ReadStream;
const metadata: CacheMetadata = {
  contentFile: 'file.json',
  contentSize: 100,
  numberOfElement: 1,
  createdAt: '2020-02-02T02:02:02.222Z',
  contentType: 'modbus'
};

describe('NorthModbus', () => {
  let NorthModbus: typeof NorthModbusClass;
  let north: NorthModbusClass;
  let configuration: NorthConnectorEntity<NorthModbusSettings>;
  let logger: PinoLogger;
  let connectSocket: Mock<typeof UtilsModbus.connectSocket>;
  let streamToString: Mock<typeof Utils.streamToString>;

  const utilsExports: typeof Utils = { ...nodeRequire('../../service/utils') };
  const utilsModbusExports: typeof UtilsModbus = { ...nodeRequire('../../service/utils-modbus') };

  before(() => {
    // The real net.Socket is created but never connected: connectSocket is mocked
    mockModule(nodeRequire, 'jsmodbus', { client: { TCP: class {} } });
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/utils-modbus', utilsModbusExports);
    // No transformation here: don't pay for loading every transformer
    mockModule(nodeRequire, '../../service/transformer.service', {});
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    NorthModbus = reloadModule<{ default: typeof NorthModbusClass }>(nodeRequire, './north-modbus').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    connectSocket = mock.fn(async () => undefined);
    streamToString = mock.fn(async () => '[]');
    Object.assign(utilsModbusExports, { connectSocket });
    // delay: super.connect() waits for runMinDelay before checking the cache, and setTimeout is mocked
    Object.assign(utilsExports, { streamToString, delay: async () => undefined });
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
    north = new NorthModbus(configuration, createCacheServiceMock());
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  /** Makes handleContent read these values and write them with a mocked modbus client */
  const prepareContent = (values: Array<OIBusModbusValue>) => {
    streamToString.mock.mockImplementation(async () => JSON.stringify(values));
    const modbusClient = createMock<ModbusTCPClient>();
    north['modbusClient'] = modbusClient;
    return modbusClient;
  };

  it('should retrieve supported types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['modbus']);
  });

  it('should properly connect', async () => {
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);
    north['reconnectTimeout'] = setTimeout(() => null);

    await north.connect();

    assert.strictEqual(connectSocket.mock.calls.length, 1);
    assert.deepStrictEqual(connectSocket.mock.calls[0].arguments[1], configuration.settings);
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
    north['disconnecting'] = true;

    // First fail
    connectSocket.mock.mockImplementationOnce(() => {
      throw new Error('connect error');
    });

    await north.connect();

    assert.strictEqual(connectSocket.mock.calls.length, 1);
    assert.strictEqual(disconnectMock.mock.calls.length, 1);

    // Second fail (clean state)
    north['disconnecting'] = false;
    connectSocket.mock.mockImplementationOnce(() => {
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
    north['reconnectTimeout'] = setTimeout(() => null);
    const mockedSocket = createMock<net.Socket>();
    north['socket'] = mockedSocket;

    await north.disconnect();

    assert.strictEqual(mockedSocket.destroy.mock.calls.length, 1);
    assert.strictEqual(north['modbusClient'], null);
  });

  it('should throw error if connector is in reconnecting state', async () => {
    north['reconnectTimeout'] = setTimeout(() => null);

    await assert.rejects(north.handleContent(readStream, metadata), /Connector is reconnecting\.\.\./);
  });

  it('should properly handle modbus content', async () => {
    const values: Array<OIBusModbusValue> = [
      { address: '0x001', value: 123, modbusType: 'register' },
      { address: '0x002', value: true, modbusType: 'coil' }
    ];
    const modbusClient = prepareContent(values);
    const modbusFnMock = mock.method(north, 'modbusFunction', async () => undefined);

    await north.handleContent(readStream, metadata);

    assert.strictEqual(streamToString.mock.calls.length, 1);
    assert.deepStrictEqual(streamToString.mock.calls[0].arguments, [readStream]);
    assert.strictEqual(modbusFnMock.mock.calls.length, 2);
    assert.deepStrictEqual(modbusFnMock.mock.calls[0].arguments, [modbusClient, values[0]]);
    assert.deepStrictEqual(modbusFnMock.mock.calls[1].arguments, [modbusClient, values[1]]);
  });

  it('should throw error if modbus client not set during content handling', async () => {
    prepareContent([]);
    north['modbusClient'] = null;
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);

    await assert.rejects(north.handleContent(readStream, metadata), /Modbus client not set\. The connector cannot write values/);

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should handle errors during processing and trigger reconnect', async () => {
    prepareContent([{ address: '0x001', value: 123, modbusType: 'register' }]);
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);
    mock.method(north, 'modbusFunction', async () => {
      throw new Error('write error');
    });

    await assert.rejects(north.handleContent(readStream, metadata), /write error/);

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should not trigger reconnect when disabled', async () => {
    north.connectorConfiguration.enabled = false;
    const disconnectMock = mock.method(north, 'disconnect', async () => undefined);
    await north['triggerReconnect']();
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.strictEqual(north['reconnectTimeout'], null);
  });

  it('should handle wrapped OIBus errors', async () => {
    prepareContent([{ address: '0x001', value: 123, modbusType: 'register' }]);
    mock.method(north, 'modbusFunction', async () => {
      throw { err: 'OIBusError', message: 'Something went wrong' };
    });

    await assert.rejects(north.handleContent(readStream, metadata), /OIBusError - Something went wrong/);
  });

  it('modbusFunction should write coil', async () => {
    const modbusClient = createMock<ModbusTCPClient>();

    await north.modbusFunction(modbusClient, { address: '0x002', value: true, modbusType: 'coil' });

    assert.strictEqual(modbusClient.writeSingleCoil.mock.calls.length, 1);
    assert.deepStrictEqual(modbusClient.writeSingleCoil.mock.calls[0].arguments, [2, true]);
    assert.strictEqual(modbusClient.writeSingleRegister.mock.calls.length, 0);
  });

  it('modbusFunction should write register', async () => {
    const modbusClient = createMock<ModbusTCPClient>();
    north.connectorConfiguration.settings.addressOffset = 'jbus';

    await north.modbusFunction(modbusClient, { address: '1', value: 123, modbusType: 'register' });

    // JBus offset means -1, so address 1 becomes 0
    assert.strictEqual(modbusClient.writeSingleRegister.mock.calls.length, 1);
    assert.deepStrictEqual(modbusClient.writeSingleRegister.mock.calls[0].arguments, [0, 123]);
    assert.strictEqual(modbusClient.writeSingleCoil.mock.calls.length, 0);
  });

  it('modbusFunction should throw error if bad modbus type', async () => {
    const value = { address: '0x001', value: 123, modbusType: 'bad' } as unknown as OIBusModbusValue;

    await assert.rejects(north.modbusFunction(createMock<ModbusTCPClient>(), value), /Wrong Modbus type "bad" for address 1/);
  });

  it('should properly test connection', async () => {
    await assert.doesNotReject(north.testConnection());
    assert.ok(connectSocket.mock.calls.some(c => c.arguments[1] === configuration.settings));
  });

  it('should properly manage error on test connection failure', async () => {
    // ENOTFOUND
    connectSocket.mock.mockImplementationOnce(async () => {
      throw { code: 'ENOTFOUND', message: 'Host not found' };
    });
    await assert.rejects(north.testConnection(), /Please check host and port: Host not found/);

    // ECONNREFUSED
    connectSocket.mock.mockImplementationOnce(async () => {
      throw { code: 'ECONNREFUSED', message: 'Connection refused' };
    });
    await assert.rejects(north.testConnection(), /Please check host and port: Connection refused/);

    // Default Error
    connectSocket.mock.mockImplementationOnce(async () => {
      throw { code: 'OTHER', message: 'Unknown error' };
    });
    await assert.rejects(north.testConnection(), /Unable to connect to socket: Unknown error/);
  });
});
