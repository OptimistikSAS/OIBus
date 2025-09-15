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

// Mock the jsmodbus client and Buffer methods
jest.mock('jsmodbus/dist/modbus-tcp-client');
// Mock net.Socket
jest.mock('net');

describe('Modbus Utilities', () => {
  const mockClient = {
    readCoils: jest.fn(),
    readDiscreteInputs: jest.fn(),
    readInputRegisters: jest.fn(),
    readHoldingRegisters: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('readCoil', () => {
    it('should read a coil and return the value as string', async () => {
      const mockResponse = { response: { body: { valuesAsArray: [true] } } };
      mockClient.readCoils.mockResolvedValue(mockResponse);
      const result = await readCoil(mockClient as unknown as ModbusTCPClient, 0);
      expect(result).toBe('true');
      expect(mockClient.readCoils).toHaveBeenCalledWith(0, 1);
    });
  });

  describe('readDiscreteInputRegister', () => {
    it('should read a discrete input and return the value as string', async () => {
      const mockResponse = { response: { body: { valuesAsArray: [false] } } };
      mockClient.readDiscreteInputs.mockResolvedValue(mockResponse);
      const result = await readDiscreteInputRegister(mockClient as unknown as ModbusTCPClient, 0);
      expect(result).toBe('false');
      expect(mockClient.readDiscreteInputs).toHaveBeenCalledWith(0, 1);
    });
  });

  describe('readInputRegister', () => {
    it('should read an input register and return the value as string', async () => {
      const mockBuffer = Buffer.from([0x00, 0x01]);
      const mockResponse = { response: { body: { valuesAsBuffer: mockBuffer } } };
      mockClient.readInputRegisters.mockResolvedValue(mockResponse);
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
      expect(result).toBe('1');
      expect(mockClient.readInputRegisters).toHaveBeenCalledWith(0, 1);
    });
  });

  describe('readHoldingRegister', () => {
    it('should read a holding register and return the value as string', async () => {
      const mockBuffer = Buffer.from([0x00, 0x01]);
      const mockResponse = { response: { body: { valuesAsBuffer: mockBuffer } } };
      mockClient.readHoldingRegisters.mockResolvedValue(mockResponse);
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
      expect(result).toBe('1');
      expect(mockClient.readHoldingRegisters).toHaveBeenCalledWith(0, 1);
    });
  });

  describe('getValueFromBuffer', () => {
    it('should return the correct value for uint16', () => {
      const buffer = Buffer.from([0x00, 0x01]);
      const result = getValueFromBuffer(buffer, 1, 'uint16', false, false, 'big-endian', undefined);
      expect(result).toBe('1');
    });

    it('should return the correct value for uint16 with swaping word', () => {
      const buffer = Buffer.from([0x00, 0x01]);
      const result = getValueFromBuffer(buffer, 1, 'uint16', false, true, 'big-endian', undefined);
      expect(result).toBe('256');
    });

    it('should return the correct value for int32 with two swap', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x01]);
      const result = getValueFromBuffer(buffer, 1, 'int32', true, true, 'little-endian', undefined);
      expect(result).toBe('65536');
    });

    it('should return the correct value for int32 with swap word only', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x01]);
      const result = getValueFromBuffer(buffer, 1, 'int32', false, true, 'little-endian', undefined);
      expect(result).toBe('1');
    });

    it('should return the correct value for int32 with swap dword only', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x01]);
      const result = getValueFromBuffer(buffer, 1, 'int32', true, false, 'little-endian', undefined);
      expect(result).toBe('16777216');
    });

    it('should return the correct value for bit index 0', () => {
      const buffer = Buffer.from([0x00, 0x01]);
      const result = getValueFromBuffer(buffer, 1, 'bit', false, false, 'big-endian', 0);
      expect(result).toBe('1');
    });

    it('should return the correct value for bit index 1', () => {
      const buffer = Buffer.from([0x00, 0x02]);
      const result = getValueFromBuffer(buffer, 1, 'bit', false, false, 'big-endian', 1);
      expect(result).toBe('1');
    });
  });

  describe('readBuffer', () => {
    // Helper to create a Buffer with known values for testing
    const createBuffer = (hexValues: Array<number>): Buffer => Buffer.from(hexValues);

    describe('uint16', () => {
      it('should read uint16BE', () => {
        const buffer = createBuffer([0x00, 0x01]);
        const result = readBuffer(buffer, 'uint16', 'big-endian', 0);
        expect(result).toBe('1');
      });
      it('should read uint16LE', () => {
        const buffer = createBuffer([0x01, 0x00]);
        const result = readBuffer(buffer, 'uint16', 'little-endian', 0);
        expect(result).toBe('1');
      });
    });

    describe('int16', () => {
      it('should read int16BE', () => {
        const buffer = createBuffer([0xff, 0xff]);
        const result = readBuffer(buffer, 'int16', 'big-endian', 0);
        expect(result).toBe('-1');
      });
      it('should read int16LE', () => {
        const buffer = createBuffer([0xff, 0xff]);
        const result = readBuffer(buffer, 'int16', 'little-endian', 0);
        expect(result).toBe('-1');
      });
    });

    describe('uint32', () => {
      it('should read uint32BE', () => {
        const buffer = createBuffer([0x00, 0x00, 0x00, 0x01]);
        const result = readBuffer(buffer, 'uint32', 'big-endian', 0);
        expect(result).toBe('1');
      });
      it('should read uint32LE', () => {
        const buffer = createBuffer([0x01, 0x00, 0x00, 0x00]);
        const result = readBuffer(buffer, 'uint32', 'little-endian', 0);
        expect(result).toBe('1');
      });
    });

    describe('int32', () => {
      it('should read int32BE', () => {
        const buffer = createBuffer([0xff, 0xff, 0xff, 0xff]);
        const result = readBuffer(buffer, 'int32', 'big-endian', 0);
        expect(result).toBe('-1');
      });
      it('should read int32LE', () => {
        const buffer = createBuffer([0xff, 0xff, 0xff, 0xff]);
        const result = readBuffer(buffer, 'int32', 'little-endian', 0);
        expect(result).toBe('-1');
      });
    });

    describe('big-uint64', () => {
      it('should read bigUint64BE', () => {
        const buffer = createBuffer([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
        const result = readBuffer(buffer, 'big-uint64', 'big-endian', 0);
        expect(result).toBe('1');
      });
      it('should read bigUint64LE', () => {
        const buffer = createBuffer([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        const result = readBuffer(buffer, 'big-uint64', 'little-endian', 0);
        expect(result).toBe('1');
      });
    });

    describe('big-int64', () => {
      it('should read bigInt64BE', () => {
        const buffer = createBuffer([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
        const result = readBuffer(buffer, 'big-int64', 'big-endian', 0);
        expect(result).toBe('-1');
      });
      it('should read bigInt64LE', () => {
        const buffer = createBuffer([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
        const result = readBuffer(buffer, 'big-int64', 'little-endian', 0);
        expect(result).toBe('-1');
      });
    });

    describe('float', () => {
      it('should read floatBE', () => {
        const buffer = createBuffer([0x40, 0x49, 0x0f, 0xdb]); // 3.1415927410125732
        const result = readBuffer(buffer, 'float', 'big-endian', 0);
        expect(result).toBe('3.1415927410125732');
      });
      it('should read floatLE', () => {
        const buffer = createBuffer([0xdb, 0x0f, 0x49, 0x40]); // 3.1415927410125732
        const result = readBuffer(buffer, 'float', 'little-endian', 0);
        expect(result).toBe('3.1415927410125732');
      });
    });

    describe('double', () => {
      it('should read doubleBE', () => {
        const buffer = createBuffer([0x40, 0x09, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18]); // 3.141592653589793
        const result = readBuffer(buffer, 'double', 'big-endian', 0);
        expect(result).toBe('3.141592653589793');
      });
      it('should read doubleLE', () => {
        const buffer = createBuffer([0x18, 0x2d, 0x44, 0x54, 0xfb, 0x21, 0x09, 0x40]); // 3.141592653589793
        const result = readBuffer(buffer, 'double', 'little-endian', 0);
        expect(result).toBe('3.141592653589793');
      });
    });

    describe('bit', () => {
      it('should read bit 0 as 0', () => {
        const buffer = createBuffer([0x00, 0x00]);
        const result = readBuffer(buffer, 'bit', 'big-endian', 0);
        expect(result).toBe('0');
      });
      it('should read bit 0 as 1', () => {
        const buffer = createBuffer([0x00, 0x01]);
        const result = readBuffer(buffer, 'bit', 'big-endian', 0);
        expect(result).toBe('1');
      });
      it('should read bit 1 as 0', () => {
        const buffer = createBuffer([0x00, 0x01]);
        const result = readBuffer(buffer, 'bit', 'big-endian', 1);
        expect(result).toBe('0');
      });
      it('should read bit 1 as 1', () => {
        const buffer = createBuffer([0x00, 0x02]);
        const result = readBuffer(buffer, 'bit', 'big-endian', 1);
        expect(result).toBe('1');
      });
      it('should read bit 15 as 1', () => {
        const buffer = createBuffer([0x80, 0x00]);
        const result = readBuffer(buffer, 'bit', 'big-endian', 15);
        expect(result).toBe('1');
      });
      it('should read bit 15 as 0', () => {
        const buffer = createBuffer([0x00, 0x00]);
        const result = readBuffer(buffer, 'bit', 'big-endian', 15);
        expect(result).toBe('0');
      });
    });
  });

  describe('getNumberOfWords', () => {
    it('should return 1 for uint16', () => {
      expect(getNumberOfWords('uint16')).toBe(1);
    });
    it('should return 2 for int32', () => {
      expect(getNumberOfWords('int32')).toBe(2);
    });
    it('should return 4 for double', () => {
      expect(getNumberOfWords('double')).toBe(4);
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
    port: 502
  } as SouthModbusSettings;

  let mockSocket: net.Socket;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = new CustomStream() as unknown as net.Socket;
    mockSocket.connect = jest.fn();
    mockSocket.destroy = jest.fn();
    mockSocket.removeAllListeners = jest.fn();
    (net.Socket as unknown as jest.Mock).mockImplementation(() => mockSocket);
  });

  describe('successful connection', () => {
    it('should resolve when socket connects', async () => {
      const connectPromise = connectSocket(mockSocket, mockConnectionSettings, 1000);
      // Simulate successful connection
      mockSocket.emit('connect');
      await expect(connectPromise).resolves.not.toThrow();
      expect(mockSocket.connect).toHaveBeenCalledWith({
        host: mockConnectionSettings.host,
        port: mockConnectionSettings.port
      });
      expect(mockSocket.removeAllListeners).not.toHaveBeenCalled();
    });
  });

  describe('connection timeout', () => {
    it('should reject with timeout error', async () => {
      jest.useFakeTimers();
      const connectPromise = connectSocket(mockSocket, mockConnectionSettings, 100);
      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(100);
      await expect(connectPromise).rejects.toThrow(new Error('Modbus connection timeout after 100 ms'));
      expect(mockSocket.destroy).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('connection error', () => {
    it('should reject with socket error', async () => {
      const testError = new Error('Connection refused');
      const connectPromise = connectSocket(mockSocket, mockConnectionSettings, 1000);
      // Simulate socket error
      mockSocket.emit('error', testError);
      await expect(connectPromise).rejects.toThrow(testError);
      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove all listeners and destroy socket on error', async () => {
      const connectPromise = connectSocket(mockSocket, mockConnectionSettings);
      mockSocket.emit('error', new Error('ECONNREFUSED'));
      await expect(connectPromise).rejects.toThrow();
      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('should remove all listeners and destroy socket on timeout', async () => {
      jest.useFakeTimers();
      const connectPromise = connectSocket(mockSocket, mockConnectionSettings, 100);
      jest.advanceTimersByTime(100);
      await expect(connectPromise).rejects.toThrow();
      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.destroy).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });
});
