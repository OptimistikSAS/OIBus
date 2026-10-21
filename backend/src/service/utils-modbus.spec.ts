import assert from 'node:assert/strict';
import net from 'node:net';
import { afterEach, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';

import type {
  SouthModbusItemSettingsDataDataType,
  SouthModbusSettings,
  SouthModbusSettingsEndianness
} from '../../shared/model/connector/south-settings.model';

import { createMock } from '../tests/utils/test-utils';
import {
  connectSocket,
  getNumberOfWords,
  getValueFromBuffer,
  parseAddress,
  readBuffer,
  readCoil,
  readDiscreteInputRegister,
  readHoldingRegister,
  readInputRegister
} from './utils-modbus';

describe('Modbus Utilities', () => {
  describe('readCoil', () => {
    it('should read a coil and return the value as string', async () => {
      const client = createMock<ModbusTCPClient>({ readCoils: async () => ({ response: { body: { valuesAsArray: [true] } } }) });
      const result = await readCoil(client, 0);
      assert.strictEqual(result, 'true');
      assert.deepStrictEqual(client.readCoils.mock.calls[0].arguments, [0, 1]);
    });
  });

  describe('readDiscreteInputRegister', () => {
    it('should read a discrete input and return the value as string', async () => {
      const client = createMock<ModbusTCPClient>({ readDiscreteInputs: async () => ({ response: { body: { valuesAsArray: [false] } } }) });
      const result = await readDiscreteInputRegister(client, 0);
      assert.strictEqual(result, 'false');
      assert.deepStrictEqual(client.readDiscreteInputs.mock.calls[0].arguments, [0, 1]);
    });
  });

  describe('readInputRegister', () => {
    it('should read an input register and return the value as string', async () => {
      const client = createMock<ModbusTCPClient>({
        readInputRegisters: async () => ({ response: { body: { valuesAsBuffer: Buffer.from([0x00, 0x01]) } } })
      });
      const result = await readInputRegister(client, 0, false, false, 'big-endian', 1, 'uint16', undefined);
      assert.strictEqual(result, '1');
      assert.deepStrictEqual(client.readInputRegisters.mock.calls[0].arguments, [0, 1]);
    });
  });

  describe('readHoldingRegister', () => {
    it('should read a holding register and return the value as string', async () => {
      const client = createMock<ModbusTCPClient>({
        readHoldingRegisters: async () => ({ response: { body: { valuesAsBuffer: Buffer.from([0x00, 0x01]) } } })
      });
      const result = await readHoldingRegister(client, 0, false, false, 'big-endian', 1, 'uint16', undefined);
      assert.strictEqual(result, '1');
      assert.deepStrictEqual(client.readHoldingRegisters.mock.calls[0].arguments, [0, 1]);
    });
  });

  describe('getValueFromBuffer', () => {
    const cases: Array<{
      label: string;
      bytes: Array<number>;
      dataType: SouthModbusItemSettingsDataDataType;
      swapWords: boolean;
      swapBytes: boolean;
      endianness: SouthModbusSettingsEndianness;
      bitIndex?: number;
      expected: string;
    }> = [
      {
        label: 'uint16',
        bytes: [0x00, 0x01],
        dataType: 'uint16',
        swapWords: false,
        swapBytes: false,
        endianness: 'big-endian',
        expected: '1'
      },
      {
        label: 'uint16 with swaping word',
        bytes: [0x00, 0x01],
        dataType: 'uint16',
        swapWords: false,
        swapBytes: true,
        endianness: 'big-endian',
        expected: '256'
      },
      {
        label: 'int32 with two swap',
        bytes: [0x00, 0x00, 0x00, 0x01],
        dataType: 'int32',
        swapWords: true,
        swapBytes: true,
        endianness: 'little-endian',
        expected: '65536'
      },
      {
        label: 'int32 with swap word only',
        bytes: [0x00, 0x00, 0x00, 0x01],
        dataType: 'int32',
        swapWords: false,
        swapBytes: true,
        endianness: 'little-endian',
        expected: '1'
      },
      {
        label: 'int32 with swap dword only',
        bytes: [0x00, 0x00, 0x00, 0x01],
        dataType: 'int32',
        swapWords: true,
        swapBytes: false,
        endianness: 'little-endian',
        expected: '16777216'
      },
      {
        label: 'bit index 0',
        bytes: [0x00, 0x01],
        dataType: 'bit',
        swapWords: false,
        swapBytes: false,
        endianness: 'big-endian',
        bitIndex: 0,
        expected: '1'
      },
      {
        label: 'bit index 1',
        bytes: [0x00, 0x02],
        dataType: 'bit',
        swapWords: false,
        swapBytes: false,
        endianness: 'big-endian',
        bitIndex: 1,
        expected: '1'
      }
    ];
    for (const { label, bytes, dataType, swapWords, swapBytes, endianness, bitIndex, expected } of cases) {
      it(`should return the correct value for ${label}`, () => {
        assert.strictEqual(getValueFromBuffer(Buffer.from(bytes), 1, dataType, swapWords, swapBytes, endianness, bitIndex), expected);
      });
    }
  });

  describe('readBuffer', () => {
    const minusOne = (length: number) => new Array(length).fill(0xff);
    const cases: Array<{
      dataType: SouthModbusItemSettingsDataDataType;
      tests: Array<{
        label: string;
        bytes: Array<number>;
        endianness?: SouthModbusSettingsEndianness;
        bitIndex?: number;
        expected: string;
      }>;
    }> = [
      {
        dataType: 'uint16',
        tests: [
          { label: 'uint16BE', bytes: [0x00, 0x01], endianness: 'big-endian', expected: '1' },
          { label: 'uint16LE', bytes: [0x01, 0x00], endianness: 'little-endian', expected: '1' }
        ]
      },
      {
        dataType: 'int16',
        tests: [
          { label: 'int16BE', bytes: minusOne(2), endianness: 'big-endian', expected: '-1' },
          { label: 'int16LE', bytes: minusOne(2), endianness: 'little-endian', expected: '-1' }
        ]
      },
      {
        dataType: 'uint32',
        tests: [
          { label: 'uint32BE', bytes: [0x00, 0x00, 0x00, 0x01], endianness: 'big-endian', expected: '1' },
          { label: 'uint32LE', bytes: [0x01, 0x00, 0x00, 0x00], endianness: 'little-endian', expected: '1' }
        ]
      },
      {
        dataType: 'int32',
        tests: [
          { label: 'int32BE', bytes: minusOne(4), endianness: 'big-endian', expected: '-1' },
          { label: 'int32LE', bytes: minusOne(4), endianness: 'little-endian', expected: '-1' }
        ]
      },
      {
        dataType: 'big-uint64',
        tests: [
          { label: 'bigUint64BE', bytes: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01], endianness: 'big-endian', expected: '1' },
          { label: 'bigUint64LE', bytes: [0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], endianness: 'little-endian', expected: '1' }
        ]
      },
      {
        dataType: 'big-int64',
        tests: [
          { label: 'bigInt64BE', bytes: minusOne(8), endianness: 'big-endian', expected: '-1' },
          { label: 'bigInt64LE', bytes: minusOne(8), endianness: 'little-endian', expected: '-1' }
        ]
      },
      {
        dataType: 'float',
        tests: [
          { label: 'floatBE', bytes: [0x40, 0x49, 0x0f, 0xdb], endianness: 'big-endian', expected: '3.1415927410125732' },
          { label: 'floatLE', bytes: [0xdb, 0x0f, 0x49, 0x40], endianness: 'little-endian', expected: '3.1415927410125732' }
        ]
      },
      {
        dataType: 'double',
        tests: [
          {
            label: 'doubleBE',
            bytes: [0x40, 0x09, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18],
            endianness: 'big-endian',
            expected: '3.141592653589793'
          },
          {
            label: 'doubleLE',
            bytes: [0x18, 0x2d, 0x44, 0x54, 0xfb, 0x21, 0x09, 0x40],
            endianness: 'little-endian',
            expected: '3.141592653589793'
          }
        ]
      },
      {
        dataType: 'bit',
        tests: [
          { label: 'bit 0 as 0', bytes: [0x00, 0x00], bitIndex: 0, expected: '0' },
          { label: 'bit 0 as 1', bytes: [0x00, 0x01], bitIndex: 0, expected: '1' },
          { label: 'bit 1 as 0', bytes: [0x00, 0x01], bitIndex: 1, expected: '0' },
          { label: 'bit 1 as 1', bytes: [0x00, 0x02], bitIndex: 1, expected: '1' },
          { label: 'bit 15 as 1', bytes: [0x80, 0x00], bitIndex: 15, expected: '1' },
          { label: 'bit 15 as 0', bytes: [0x00, 0x00], bitIndex: 15, expected: '0' }
        ]
      }
    ];
    for (const { dataType, tests } of cases) {
      describe(dataType, () => {
        for (const { label, bytes, endianness = 'big-endian', bitIndex = 0, expected } of tests) {
          it(`should read ${label}`, () => {
            assert.strictEqual(readBuffer(Buffer.from(bytes), dataType, endianness, bitIndex), expected);
          });
        }
      });
    }
  });

  describe('parseAddress', () => {
    it('should parse a hexadecimal address', () => {
      assert.strictEqual(parseAddress('0x1A'), 26);
      assert.strictEqual(parseAddress('0X1a'), 26);
    });

    it('should parse a decimal address', () => {
      assert.strictEqual(parseAddress('42'), 42);
    });
  });

  describe('getNumberOfWords', () => {
    for (const { dataType, expected } of [
      { dataType: 'uint16', expected: 1 },
      { dataType: 'int32', expected: 2 },
      { dataType: 'double', expected: 4 }
    ]) {
      it(`should return ${expected} for ${dataType}`, () => {
        assert.strictEqual(getNumberOfWords(dataType), expected);
      });
    }
  });
});

describe('connectSocket', () => {
  // partial settings: only the connection fields are read
  const connectionSettings = { host: '127.0.0.1', port: 502, connectTimeout: 30000 } as SouthModbusSettings;

  let socket: net.Socket;
  let connectMock: Mock<net.Socket['connect']>;
  let destroyMock: Mock<net.Socket['destroy']>;
  let removeAllListenersMock: Mock<net.Socket['removeAllListeners']>;

  beforeEach(() => {
    socket = new net.Socket();
    connectMock = mock.method(socket, 'connect', () => socket);
    destroyMock = mock.method(socket, 'destroy', () => socket);
    removeAllListenersMock = mock.method(socket, 'removeAllListeners', () => socket);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('successful connection', () => {
    it('should resolve when socket connects', async () => {
      const connectPromise = connectSocket(socket, connectionSettings);
      socket.emit('connect');
      await assert.doesNotReject(connectPromise);
      assert.deepStrictEqual(connectMock.mock.calls[0].arguments, [{ host: connectionSettings.host, port: connectionSettings.port }]);
      assert.strictEqual(removeAllListenersMock.mock.calls.length, 0);
    });
  });

  describe('connection timeout', () => {
    it('should reject with timeout error', async () => {
      mock.timers.enable({ apis: ['setTimeout'] });
      const connectPromise = connectSocket(socket, connectionSettings);
      mock.timers.tick(30000);
      await assert.rejects(connectPromise, { message: 'Modbus connection timeout after 30000 ms' });
      assert.ok(destroyMock.mock.calls.length > 0);
    });
  });

  describe('connection error', () => {
    it('should reject with socket error', async () => {
      const testError = new Error('Connection refused');
      const connectPromise = connectSocket(socket, connectionSettings);
      socket.emit('error', testError);
      await assert.rejects(connectPromise, testError);
      assert.ok(destroyMock.mock.calls.length > 0);
    });
  });

  describe('cleanup', () => {
    it('should remove all listeners and destroy socket on error', async () => {
      const connectPromise = connectSocket(socket, connectionSettings);
      socket.emit('error', new Error('ECONNREFUSED'));
      await assert.rejects(connectPromise);
      assert.ok(removeAllListenersMock.mock.calls.length > 0);
      assert.ok(destroyMock.mock.calls.length > 0);
    });

    it('should remove all listeners and destroy socket on timeout', async () => {
      mock.timers.enable({ apis: ['setTimeout'] });
      const connectPromise = connectSocket(socket, connectionSettings);
      mock.timers.tick(30000);
      await assert.rejects(connectPromise);
      assert.ok(removeAllListenersMock.mock.calls.length > 0);
      assert.ok(destroyMock.mock.calls.length > 0);
    });
  });
});
