import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  connectSocket,
  getNumberOfWords,
  getValueFromBuffer,
  readBuffer,
  readCoil,
  readDiscreteInputRegister,
  readHoldingRegister,
  readInputRegister
} from './utils-modbus';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';
import { SouthModbusSettings } from '../../shared/model/south-settings.model';
import net from 'node:net';
import Stream from 'node:stream';

describe('Modbus Utilities', () => {
  let mockClient: {
    readCoils: ReturnType<typeof mock.fn>;
    readDiscreteInputs: ReturnType<typeof mock.fn>;
    readInputRegisters: ReturnType<typeof mock.fn>;
    readHoldingRegisters: ReturnType<typeof mock.fn>;
  };

  beforeEach(() => {
    mockClient = {
      readCoils: mock.fn(),
      readDiscreteInputs: mock.fn(),
      readInputRegisters: mock.fn(),
      readHoldingRegisters: mock.fn()
    };
  });

  describe('readCoil', () => {
    it('should read a coil and return the value as string', async () => {
      const mockResponse = { response: { body: { valuesAsArray: [true] } } };
      mockClient.readCoils.mock.mockImplementation(async () => mockResponse);
      const result = await readCoil(mockClient as unknown as ModbusTCPClient, 0);
      assert.strictEqual(result, 'true');
      assert.deepStrictEqual(mockClient.readCoils.mock.calls[0].arguments, [0, 1]);
    });
  });

  describe('readDiscreteInputRegister', () => {
    it('should read a discrete input and return the value as string', async () => {
      const mockResponse = { response: { body: { valuesAsArray: [false] } } };
      mockClient.readDiscreteInputs.mock.mockImplementation(async () => mockResponse);
      const result = await readDiscreteInputRegister(mockClient as unknown as ModbusTCPClient, 0);
      assert.strictEqual(result, 'false');
      assert.deepStrictEqual(mockClient.readDiscreteInputs.mock.calls[0].arguments, [0, 1]);
    });
  });

  describe('readInputRegister', () => {
    it('should read an input register and return the value as string', async () => {
      const mockBuffer = Buffer.from([0x00, 0x01]);
      const mockResponse = { response: { body: { valuesAsBuffer: mockBuffer } } };
      mockClient.readInputRegisters.mock.mockImplementation(async () => mockResponse);
      const result = await readInputRegister(
        mockClient as unknown as ModbusTCPClient,
        0,
        false,
        false,
        'big-endian',
        1,
        'uint16',
        undefined
      );
      assert.strictEqual(result, '1');
      assert.deepStrictEqual(mockClient.readInputRegisters.mock.calls[0].arguments, [0, 1]);
    });
  });

  describe('readHoldingRegister', () => {
    it('should read a holding register and return the value as string', async () => {
      const mockBuffer = Buffer.from([0x00, 0x01]);
      const mockResponse = { response: { body: { valuesAsBuffer: mockBuffer } } };
      mockClient.readHoldingRegisters.mock.mockImplementation(async () => mockResponse);
      const result = await readHoldingRegister(
        mockClient as unknown as ModbusTCPClient,
        0,
        false,
        false,
        'big-endian',
        1,
        'uint16',
        undefined
      );
      assert.strictEqual(result, '1');
      assert.deepStrictEqual(mockClient.readHoldingRegisters.mock.calls[0].arguments, [0, 1]);
    });
  });

  describe('getValueFromBuffer', () => {
    it('should return the correct value for uint16', () => {
      const buffer = Buffer.from([0x00, 0x01]);
      const result = getValueFromBuffer(buffer, 1, 'uint16', false, false, 'big-endian', undefined);
      assert.strictEqual(result, '1');
    });

    it('should return the correct value for uint16 with swaping word', () => {
      const buffer = Buffer.from([0x00, 0x01]);
      const result = getValueFromBuffer(buffer, 1, 'uint16', false, true, 'big-endian', undefined);
      assert.strictEqual(result, '256');
    });

    it('should return the correct value for int32 with two swap', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x01]);
      const result = getValueFromBuffer(buffer, 1, 'int32', true, true, 'little-endian', undefined);
      assert.strictEqual(result, '65536');
    });

    it('should return the correct value for int32 with swap word only', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x01]);
      const result = getValueFromBuffer(buffer, 1, 'int32', false, true, 'little-endian', undefined);
      assert.strictEqual(result, '1');
    });

    it('should return the correct value for int32 with swap dword only', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x01]);
      const result = getValueFromBuffer(buffer, 1, 'int32', true, false, 'little-endian', undefined);
      assert.strictEqual(result, '16777216');
    });

    it('should return the correct value for bit index 0', () => {
      const buffer = Buffer.from([0x00, 0x01]);
      const result = getValueFromBuffer(buffer, 1, 'bit', false, false, 'big-endian', 0);
      assert.strictEqual(result, '1');
    });

    it('should return the correct value for bit index 1', () => {
      const buffer = Buffer.from([0x00, 0x02]);
      const result = getValueFromBuffer(buffer, 1, 'bit', false, false, 'big-endian', 1);
      assert.strictEqual(result, '1');
    });
  });

  describe('readBuffer', () => {
    const createBuffer = (hexValues: Array<number>): Buffer => Buffer.from(hexValues);

    describe('uint16', () => {
      it('should read uint16BE', () => {
        const buffer = createBuffer([0x00, 0x01]);
        assert.strictEqual(readBuffer(buffer, 'uint16', 'big-endian', 0), '1');
      });
      it('should read uint16LE', () => {
        const buffer = createBuffer([0x01, 0x00]);
        assert.strictEqual(readBuffer(buffer, 'uint16', 'little-endian', 0), '1');
      });
    });

    describe('int16', () => {
      it('should read int16BE', () => {
        const buffer = createBuffer([0xff, 0xff]);
        assert.strictEqual(readBuffer(buffer, 'int16', 'big-endian', 0), '-1');
      });
      it('should read int16LE', () => {
        const buffer = createBuffer([0xff, 0xff]);
        assert.strictEqual(readBuffer(buffer, 'int16', 'little-endian', 0), '-1');
      });
    });

    describe('uint32', () => {
      it('should read uint32BE', () => {
        const buffer = createBuffer([0x00, 0x00, 0x00, 0x01]);
        assert.strictEqual(readBuffer(buffer, 'uint32', 'big-endian', 0), '1');
      });
      it('should read uint32LE', () => {
        const buffer = createBuffer([0x01, 0x00, 0x00, 0x00]);
        assert.strictEqual(readBuffer(buffer, 'uint32', 'little-endian', 0), '1');
      });
    });

    describe('int32', () => {
      it('should read int32BE', () => {
        const buffer = createBuffer([0xff, 0xff, 0xff, 0xff]);
        assert.strictEqual(readBuffer(buffer, 'int32', 'big-endian', 0), '-1');
      });
      it('should read int32LE', () => {
        const buffer = createBuffer([0xff, 0xff, 0xff, 0xff]);
        assert.strictEqual(readBuffer(buffer, 'int32', 'little-endian', 0), '-1');
      });
    });

    describe('big-uint64', () => {
      it('should read bigUint64BE', () => {
        const buffer = createBuffer([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
        assert.strictEqual(readBuffer(buffer, 'big-uint64', 'big-endian', 0), '1');
      });
      it('should read bigUint64LE', () => {
        const buffer = createBuffer([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        assert.strictEqual(readBuffer(buffer, 'big-uint64', 'little-endian', 0), '1');
      });
    });

    describe('big-int64', () => {
      it('should read bigInt64BE', () => {
        const buffer = createBuffer([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
        assert.strictEqual(readBuffer(buffer, 'big-int64', 'big-endian', 0), '-1');
      });
      it('should read bigInt64LE', () => {
        const buffer = createBuffer([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
        assert.strictEqual(readBuffer(buffer, 'big-int64', 'little-endian', 0), '-1');
      });
    });

    describe('float', () => {
      it('should read floatBE', () => {
        const buffer = createBuffer([0x40, 0x49, 0x0f, 0xdb]);
        assert.strictEqual(readBuffer(buffer, 'float', 'big-endian', 0), '3.1415927410125732');
      });
      it('should read floatLE', () => {
        const buffer = createBuffer([0xdb, 0x0f, 0x49, 0x40]);
        assert.strictEqual(readBuffer(buffer, 'float', 'little-endian', 0), '3.1415927410125732');
      });
    });

    describe('double', () => {
      it('should read doubleBE', () => {
        const buffer = createBuffer([0x40, 0x09, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18]);
        assert.strictEqual(readBuffer(buffer, 'double', 'big-endian', 0), '3.141592653589793');
      });
      it('should read doubleLE', () => {
        const buffer = createBuffer([0x18, 0x2d, 0x44, 0x54, 0xfb, 0x21, 0x09, 0x40]);
        assert.strictEqual(readBuffer(buffer, 'double', 'little-endian', 0), '3.141592653589793');
      });
    });

    describe('bit', () => {
      it('should read bit 0 as 0', () => {
        const buffer = createBuffer([0x00, 0x00]);
        assert.strictEqual(readBuffer(buffer, 'bit', 'big-endian', 0), '0');
      });
      it('should read bit 0 as 1', () => {
        const buffer = createBuffer([0x00, 0x01]);
        assert.strictEqual(readBuffer(buffer, 'bit', 'big-endian', 0), '1');
      });
      it('should read bit 1 as 0', () => {
        const buffer = createBuffer([0x00, 0x01]);
        assert.strictEqual(readBuffer(buffer, 'bit', 'big-endian', 1), '0');
      });
      it('should read bit 1 as 1', () => {
        const buffer = createBuffer([0x00, 0x02]);
        assert.strictEqual(readBuffer(buffer, 'bit', 'big-endian', 1), '1');
      });
      it('should read bit 15 as 1', () => {
        const buffer = createBuffer([0x80, 0x00]);
        assert.strictEqual(readBuffer(buffer, 'bit', 'big-endian', 15), '1');
      });
      it('should read bit 15 as 0', () => {
        const buffer = createBuffer([0x00, 0x00]);
        assert.strictEqual(readBuffer(buffer, 'bit', 'big-endian', 15), '0');
      });
    });
  });

  describe('getNumberOfWords', () => {
    it('should return 1 for uint16', () => {
      assert.strictEqual(getNumberOfWords('uint16'), 1);
    });
    it('should return 2 for int32', () => {
      assert.strictEqual(getNumberOfWords('int32'), 2);
    });
    it('should return 4 for double', () => {
      assert.strictEqual(getNumberOfWords('double'), 4);
    });
  });
});

class CustomStream extends Stream {
  constructor() {
    super();
  }

  connect() {
    return;
  }

  destroy() {
    return;
  }
}

describe('connectSocket', () => {
  const mockConnectionSettings: SouthModbusSettings = {
    host: '127.0.0.1',
    port: 502,
    connectTimeout: 30000
  } as SouthModbusSettings;

  let mockSocket: net.Socket;
  let mockConnect: ReturnType<typeof mock.fn>;
  let mockDestroy: ReturnType<typeof mock.fn>;
  let mockRemoveAllListeners: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    mockSocket = new CustomStream() as unknown as net.Socket;
    mockConnect = mock.fn();
    mockDestroy = mock.fn();
    mockRemoveAllListeners = mock.fn();
    mockSocket.connect = mockConnect as unknown as net.Socket['connect'];
    mockSocket.destroy = mockDestroy as unknown as net.Socket['destroy'];
    mockSocket.removeAllListeners = mockRemoveAllListeners as unknown as net.Socket['removeAllListeners'];
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('successful connection', () => {
    it('should resolve when socket connects', async () => {
      const connectPromise = connectSocket(mockSocket, mockConnectionSettings);
      mockSocket.emit('connect');
      await assert.doesNotReject(connectPromise);
      assert.deepStrictEqual(mockConnect.mock.calls[0].arguments, [
        {
          host: mockConnectionSettings.host,
          port: mockConnectionSettings.port
        }
      ]);
      assert.strictEqual(mockRemoveAllListeners.mock.calls.length, 0);
    });
  });

  describe('connection timeout', () => {
    it('should reject with timeout error', async () => {
      mock.timers.enable({ apis: ['setTimeout'] });
      const connectPromise = connectSocket(mockSocket, mockConnectionSettings);
      mock.timers.tick(30000);
      await assert.rejects(connectPromise, { message: 'Modbus connection timeout after 30000 ms' });
      assert.ok(mockDestroy.mock.calls.length > 0);
    });
  });

  describe('connection error', () => {
    it('should reject with socket error', async () => {
      const testError = new Error('Connection refused');
      const connectPromise = connectSocket(mockSocket, mockConnectionSettings);
      mockSocket.emit('error', testError);
      await assert.rejects(connectPromise, testError);
      assert.ok(mockDestroy.mock.calls.length > 0);
    });
  });

  describe('cleanup', () => {
    it('should remove all listeners and destroy socket on error', async () => {
      const connectPromise = connectSocket(mockSocket, mockConnectionSettings);
      mockSocket.emit('error', new Error('ECONNREFUSED'));
      await assert.rejects(connectPromise);
      assert.ok(mockRemoveAllListeners.mock.calls.length > 0);
      assert.ok(mockDestroy.mock.calls.length > 0);
    });

    it('should remove all listeners and destroy socket on timeout', async () => {
      mock.timers.enable({ apis: ['setTimeout'] });
      const connectPromise = connectSocket(mockSocket, mockConnectionSettings);
      mock.timers.tick(30000);
      await assert.rejects(connectPromise);
      assert.ok(mockRemoveAllListeners.mock.calls.length > 0);
      assert.ok(mockDestroy.mock.calls.length > 0);
    });
  });
});
