import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Stream from 'node:stream';
import net from 'node:net';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type {
  SouthItemSettings,
  SouthModbusItemSettings,
  SouthModbusItemSettingsModbusType,
  SouthModbusSettings
} from '../../../shared/model/south-settings.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type { Instant } from '../../model/types';
import type SouthModbusClass from './south-modbus';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';

const nodeRequire = createRequire(import.meta.url);

// Error codes handled by the test function
const ERROR_CODES = {
  ENOTFOUND: 'Please check host and port',
  ECONNREFUSED: 'Please check host and port',
  DEFAULT: 'Unable to connect to socket'
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

class CustomStream extends Stream {
  connect(_connectionObject: unknown, _callback: () => Promise<void>): Promise<void> {
    return Promise.resolve();
  }

  end() {
    return Promise.resolve();
  }

  destroy() {
    return this;
  }

  setKeepAlive(_enable: boolean, _initialDelay?: number): this {
    return this;
  }
}

describe('South Modbus', () => {
  let SouthModbus: typeof SouthModbusClass;
  let south: SouthModbusClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(
    async (
      _southId: string,
      _data: OIBusContent,
      _queryTime: Instant,
      _items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ): Promise<void> => undefined
  );
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;
  let mockedEmitter: CustomStream;

  // Track the current Socket mock — updated in beforeEach via mock.method
  let socketMock: ReturnType<typeof mock.method>;

  // jsmodbus mock — SUT does `import { client } from 'jsmodbus'` so we need client at top level
  // TCP must use a regular function (not arrow) since the SUT calls it with `new`
  const jsmdbExports: {
    __esModule: boolean;
    client: { TCP: ReturnType<typeof mock.fn> };
    default: { client: { TCP: ReturnType<typeof mock.fn> } };
  } = {
    __esModule: true,
    client: {
      TCP: mock.fn(function () {
        return {};
      })
    },
    default: {
      client: {
        TCP: mock.fn(function () {
          return {};
        })
      }
    }
  };

  // utils-modbus mock
  const utilsModbusExports = {
    connectSocket: mock.fn(async (_socket: unknown, _settings: unknown): Promise<void> => undefined),
    readCoil: mock.fn(async (): Promise<string | undefined> => undefined),
    readDiscreteInputRegister: mock.fn(async (): Promise<string | undefined> => undefined),
    readHoldingRegister: mock.fn(async (): Promise<string | undefined> => undefined),
    readInputRegister: mock.fn(async (): Promise<string | undefined> => undefined),
    // parseAddress and getNumberOfWords use real implementations so address/grouping logic works correctly in tests
    parseAddress: (address: string): number => (/^0x[0-9a-f]+$/i.test(address) ? parseInt(address, 16) : parseInt(address, 10)),
    getNumberOfWords: (dataType: string): number => {
      if (['uint32', 'int32', 'float'].includes(dataType)) return 2;
      if (['big-uint64', 'big-int64', 'double'].includes(dataType)) return 4;
      return 1;
    },
    getValueFromBuffer: mock.fn((): string => '42')
  };

  // utils mock
  const utilsExports = {
    generateIntervals: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' })),
    delay: mock.fn(async () => undefined)
  };

  before(() => {
    mockModule(nodeRequire, 'jsmodbus', jsmdbExports);
    mockModule(nodeRequire, '../../service/utils-modbus', utilsModbusExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });

    SouthModbus = reloadModule<{ default: typeof SouthModbusClass }>(nodeRequire, './south-modbus').default;
  });

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
      retryInterval: 10000,
      connectTimeout: 30000,
      networkTimeout: 15000,
      batchQuery: false,
      groupingGap: 0
    },
    groups: [],
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
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
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
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
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
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id4',
        name: 'DiscreteInput',
        enabled: true,
        settings: {
          address: '0x1E82',
          modbusType: 'discrete-input'
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id5',
        name: 'Coil',
        enabled: true,
        settings: {
          address: '0x0E83',
          modbusType: 'coil'
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
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
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    mockedEmitter = new CustomStream();
    // Mock net.Socket on the real builtin — both test and SUT share the same module reference
    // Must use a regular function (not arrow) since Socket is called with `new`
    const emitter = mockedEmitter;
    socketMock = mock.method(net, 'Socket', function () {
      return emitter;
    });
    jsmdbExports.client.TCP = mock.fn(function () {
      return {};
    });
    jsmdbExports.default.client.TCP = mock.fn(function () {
      return {};
    });
    utilsModbusExports.connectSocket = mock.fn(async (_socket: unknown, _settings: unknown): Promise<void> => undefined);
    utilsModbusExports.readCoil = mock.fn(async (): Promise<string | undefined> => undefined);
    utilsModbusExports.readDiscreteInputRegister = mock.fn(async (): Promise<string | undefined> => undefined);
    utilsModbusExports.readHoldingRegister = mock.fn(async (): Promise<string | undefined> => undefined);
    utilsModbusExports.readInputRegister = mock.fn(async (): Promise<string | undefined> => undefined);
    utilsModbusExports.getValueFromBuffer = mock.fn((): string => '42');
    addContentCallback.mock.resetCalls();
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthModbus(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly connect', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    (south as unknown as Record<string, unknown>)['reconnectTimeout'] = setTimeout(() => null, 1000);
    const setKeepAliveMock = mock.method(mockedEmitter, 'setKeepAlive');

    await south.connect();

    assert.strictEqual(socketMock.mock.calls.length, 1);
    assert.strictEqual(utilsModbusExports.connectSocket.mock.calls.length, 1);
    assert.deepStrictEqual(utilsModbusExports.connectSocket.mock.calls[0].arguments[1], configuration.settings);
    assert.ok(
      logger.debug.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes(`Connecting Modbus socket into ${configuration.settings.host}:${configuration.settings.port}`)
      )
    );
    assert.ok(
      logger.info.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes(`Modbus socket connected to ${configuration.settings.host}:${configuration.settings.port}`)
      )
    );
    assert.strictEqual(disconnectMock.mock.calls.length, 0);
    assert.strictEqual(setKeepAliveMock.mock.calls.length, 1);
    assert.deepStrictEqual(setKeepAliveMock.mock.calls[0].arguments, [true, configuration.settings.networkTimeout]);
  });

  it('should reconnect when socket closes unexpectedly between scans', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;

    await south.connect();

    // Simulate an unexpected socket close (e.g. server-side idle timeout)
    mockedEmitter.emit('close');
    // Flush the async close handler (it awaits disconnect())
    await Promise.resolve();
    await Promise.resolve();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.ok(
      logger.warn.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('Modbus socket closed unexpectedly')
      )
    );

    // Ticking the retry interval should trigger a new connect (new Socket creation)
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 2);
  });

  it('should not reconnect when socket closes during an explicit disconnect', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;

    await south.connect();

    // Simulate a close event while disconnecting is true
    mockedEmitter.emit('close');
    await Promise.resolve();
    await Promise.resolve();

    // The close handler must be a no-op when disconnecting
    assert.strictEqual(disconnectMock.mock.calls.length, 0);
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 1);
  });

  it('should properly reconnect on connect error when not disconnecting', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;

    utilsModbusExports.connectSocket = mock.fn(async (_socket: unknown, _settings: unknown): Promise<void> => {
      throw new Error('connect error');
    });

    // With disconnecting=false and connector.enabled=true, a retry timer should be set
    await south.connect();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('Modbus socket error: connect error')
      )
    );

    // Tick the retry interval — should trigger another connect attempt
    utilsModbusExports.connectSocket = mock.fn(async (_socket: unknown, _settings: unknown): Promise<void> => undefined);
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 2);
  });

  it('should not set retry timer when disconnecting is true', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;

    utilsModbusExports.connectSocket = mock.fn(async (_socket: unknown, _settings: unknown): Promise<void> => {
      throw new Error('connect error');
    });

    await south.connect();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);

    // No timer should have been set — ticking should NOT trigger another Socket creation
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 1);
  });

  it('should properly disconnect without active socket or timeout', async () => {
    await south.disconnect();
    // nothing should throw, socket is null by default
  });

  it('should properly disconnect with active socket and timeout', async () => {
    // Set up a reconnect timeout and socket
    (south as unknown as Record<string, unknown>)['reconnectTimeout'] = setTimeout(() => null, 1000);
    const mockedSocket = { removeAllListeners: mock.fn(), destroy: mock.fn() };
    (south as unknown as Record<string, unknown>)['socket'] = mockedSocket;

    await south.disconnect();

    assert.strictEqual(mockedSocket.destroy.mock.calls.length, 1);
    assert.strictEqual(mockedSocket.removeAllListeners.mock.calls.length, 1);

    // Timer was cleared — ticking should not cause further side-effects
    mock.timers.tick(configuration.settings.retryInterval);
    // disconnect clears the timeout: after disconnect, reconnectTimeout should be null
    assert.strictEqual((south as unknown as Record<string, unknown>)['reconnectTimeout'], null);
  });

  it('should query items via directQuery with batched requests when batchQuery is true', async () => {
    // Test data addresses (addressOffset = 'modbus', offset = 0):
    //   id1: 0x4E80 = 20096  holding-register uint16 (1 word)
    //   id2: 20097            holding-register uint16 (1 word)  ← consecutive with id1
    //   id3: 0x3E81 = 16001  input-register   uint16 (1 word)
    //   id4: 0x1E82 = 7810   discrete-input
    //   id5: 0x0E83 = 3715   coil
    //   id6: 0x0E88 = 3720   holding-register bit    (1 word)
    //
    // Expected batches (sorted by address within each type):
    //   holding-register: [id6@3720,1word] + [id1@20096+id2@20097, 2words]  → 2 requests
    //   input-register:   [id3@16001, 1word]                                → 1 request
    //   discrete-input:   [id4@7810, count=1]                               → 1 request
    //   coil:             [id5@3715, count=1]                               → 1 request
    const readHoldingRegistersMock = mock.fn(async (_addr: number, count: number) => ({
      response: { body: { valuesAsBuffer: Buffer.alloc(count * 2) } }
    }));
    const readInputRegistersMock = mock.fn(async (_addr: number, count: number) => ({
      response: { body: { valuesAsBuffer: Buffer.alloc(count * 2) } }
    }));
    const readCoilsMock = mock.fn(async (_addr: number, count: number) => ({
      response: { body: { valuesAsArray: Array(count).fill(0) } }
    }));
    const readDiscreteInputsMock = mock.fn(async (_addr: number, count: number) => ({
      response: { body: { valuesAsArray: Array(count).fill(1) } }
    }));

    (south as unknown as Record<string, unknown>)['modbusClient'] = {
      readHoldingRegisters: readHoldingRegistersMock,
      readInputRegisters: readInputRegistersMock,
      readCoils: readCoilsMock,
      readDiscreteInputs: readDiscreteInputsMock
    };
    (south as unknown as Record<string, unknown>)['connector'] = {
      ...configuration,
      settings: { ...configuration.settings, batchQuery: true }
    };

    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    const addContentMock = mock.fn(
      async (_data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void> =>
        undefined
    );
    south.disconnect = disconnectMock;
    south.addContent = addContentMock;

    await south.directQuery(configuration.items);

    // holding-register: 2 batches
    assert.strictEqual(readHoldingRegistersMock.mock.calls.length, 2);
    assert.deepStrictEqual(readHoldingRegistersMock.mock.calls[0].arguments, [3720, 1]); // id6 alone
    assert.deepStrictEqual(readHoldingRegistersMock.mock.calls[1].arguments, [20096, 2]); // id1 + id2 merged

    // input-register: 1 batch
    assert.strictEqual(readInputRegistersMock.mock.calls.length, 1);
    assert.deepStrictEqual(readInputRegistersMock.mock.calls[0].arguments, [16001, 1]);

    // coil: 1 batch
    assert.strictEqual(readCoilsMock.mock.calls.length, 1);
    assert.deepStrictEqual(readCoilsMock.mock.calls[0].arguments, [3715, 1]);

    // discrete-input: 1 batch
    assert.strictEqual(readDiscreteInputsMock.mock.calls.length, 1);
    assert.deepStrictEqual(readDiscreteInputsMock.mock.calls[0].arguments, [7810, 1]);

    assert.strictEqual(disconnectMock.mock.calls.length, 0);
    assert.strictEqual(addContentMock.mock.calls.length, 1);
    // All 6 items produce one value each
    assert.strictEqual(addContentMock.mock.calls[0].arguments[0].content!.length, 6);
    // Single shared timestamp for the whole scan cycle
    assert.strictEqual(addContentMock.mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], configuration.items);
  });

  it('should query each item individually when batchQuery is false', async () => {
    // configuration.settings.batchQuery is already false — individual mode is the default.
    // Each of the 6 items must produce exactly one util-function call, regardless of address proximity.
    utilsModbusExports.readHoldingRegister = mock.fn(async (): Promise<string> => '100');
    utilsModbusExports.readInputRegister = mock.fn(async (): Promise<string> => '200');
    utilsModbusExports.readCoil = mock.fn(async (): Promise<string> => '1');
    utilsModbusExports.readDiscreteInputRegister = mock.fn(async (): Promise<string> => '0');

    (south as unknown as Record<string, unknown>)['modbusClient'] = {};
    const addContentMock = mock.fn(
      async (_data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void> =>
        undefined
    );
    south.addContent = addContentMock;

    await south.directQuery(configuration.items);

    // 3 holding-register items (id1, id2, id6) → 3 individual calls
    assert.strictEqual(utilsModbusExports.readHoldingRegister.mock.calls.length, 3);
    // 1 input-register (id3)
    assert.strictEqual(utilsModbusExports.readInputRegister.mock.calls.length, 1);
    // 1 coil (id5)
    assert.strictEqual(utilsModbusExports.readCoil.mock.calls.length, 1);
    // 1 discrete-input (id4)
    assert.strictEqual(utilsModbusExports.readDiscreteInputRegister.mock.calls.length, 1);

    assert.strictEqual(addContentMock.mock.calls.length, 1);
    // All 6 items produce a value
    assert.strictEqual(addContentMock.mock.calls[0].arguments[0].content!.length, 6);
    // All values share the single scan-cycle timestamp (modbusFunction's own timestamp is overridden)
    for (const v of addContentMock.mock.calls[0].arguments[0].content as Array<{ timestamp: string }>) {
      assert.strictEqual(v.timestamp, testData.constants.dates.FAKE_NOW);
    }
  });

  it('should apply jbus address offset (offset = -1)', async () => {
    utilsModbusExports.readHoldingRegister = mock.fn(async (): Promise<string> => '42');
    (south as unknown as Record<string, unknown>)['modbusClient'] = {};
    south.addContent = mock.fn(async (): Promise<void> => undefined);
    configuration.settings.addressOffset = 'jbus';

    await south.directQuery([configuration.items[0]]);

    assert.strictEqual(utilsModbusExports.readHoldingRegister.mock.calls.length, 1);
    configuration.settings.addressOffset = 'modbus'; // restore
  });

  it('should merge non-consecutive items into one request when groupingGap covers the gap', async () => {
    // Three holding-register uint16 items at addresses 1, 3, 5 (gap of 2 between each).
    // With groupingGap = 2 all three should be merged into readHoldingRegisters(1, 5).
    // With groupingGap = 0 each item is its own request.
    const makeItem = (id: string, address: string) => ({
      id,
      name: id,
      enabled: true,
      settings: { address, modbusType: 'holding-register' as const, data: { dataType: 'uint16' as const, multiplierCoefficient: 1 } },
      scanMode: testData.scanMode.list[0],
      group: null,
      syncWithGroup: false,
      maxReadInterval: null,
      readDelay: null,
      overlap: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    });
    const gapItems = [makeItem('var1', '0x0001'), makeItem('var2', '0x0003'), makeItem('var3', '0x0005')];

    const readHoldingRegistersMock = mock.fn(async (_addr: number, count: number) => ({
      response: { body: { valuesAsBuffer: Buffer.alloc(count * 2) } }
    }));
    (south as unknown as Record<string, unknown>)['modbusClient'] = { readHoldingRegisters: readHoldingRegistersMock };
    south.addContent = mock.fn(async (): Promise<void> => undefined);

    // groupingGap = 0: gap of 2 exceeds tolerance → 3 separate requests
    (south as unknown as Record<string, unknown>)['connector'] = {
      ...configuration,
      settings: { ...configuration.settings, batchQuery: true, groupingGap: 0 }
    };
    await south.directQuery(gapItems);
    assert.strictEqual(readHoldingRegistersMock.mock.calls.length, 3);
    assert.deepStrictEqual(readHoldingRegistersMock.mock.calls[0].arguments, [1, 1]);
    assert.deepStrictEqual(readHoldingRegistersMock.mock.calls[1].arguments, [3, 1]);
    assert.deepStrictEqual(readHoldingRegistersMock.mock.calls[2].arguments, [5, 1]);

    readHoldingRegistersMock.mock.resetCalls();

    // groupingGap = 2: gap of 2 is within tolerance → 1 merged request covering addresses 1–5
    (south as unknown as Record<string, unknown>)['connector'] = {
      ...configuration,
      settings: { ...configuration.settings, batchQuery: true, groupingGap: 2 }
    };
    await south.directQuery(gapItems);
    assert.strictEqual(readHoldingRegistersMock.mock.calls.length, 1);
    assert.deepStrictEqual(readHoldingRegistersMock.mock.calls[0].arguments, [1, 5]); // 5 words: addr 1..5
  });

  it('should handle directQuery error when disconnecting is true', async () => {
    // Use a single holding-register item to trigger readHoldingRegisters, which will throw
    const readHoldingRegistersMock = mock.fn(async (): Promise<never> => {
      throw new Error('modbus function error');
    });
    (south as unknown as Record<string, unknown>)['modbusClient'] = { readHoldingRegisters: readHoldingRegistersMock };
    (south as unknown as Record<string, unknown>)['connector'] = {
      ...configuration,
      settings: { ...configuration.settings, batchQuery: true }
    };
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    south.addContent = mock.fn(async (): Promise<void> => undefined);

    await assert.rejects(south.directQuery([configuration.items[1]]), new Error('modbus function error'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);

    // No retry timer set when disconnecting
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 0);
  });

  it('should handle directQuery error when not disconnecting', async () => {
    // Use a single holding-register item to trigger readHoldingRegisters, which will throw
    const readHoldingRegistersMock = mock.fn(async (): Promise<never> => {
      throw new Error('modbus function error');
    });
    (south as unknown as Record<string, unknown>)['modbusClient'] = { readHoldingRegisters: readHoldingRegistersMock };
    (south as unknown as Record<string, unknown>)['connector'] = {
      ...configuration,
      settings: { ...configuration.settings, batchQuery: true }
    };
    (south as unknown as Record<string, unknown>)['disconnecting'] = false;
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    south.addContent = mock.fn(async (): Promise<void> => undefined);

    await assert.rejects(south.directQuery([configuration.items[1]]), new Error('modbus function error'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);

    // Retry timer should have been set — tick triggers a connect (net.Socket call)
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 1);
  });

  it('should throw when directQuery is called without modbusClient', async () => {
    await assert.rejects(south.directQuery(configuration.items), new Error('Could not read address: Modbus client not set'));
  });

  it('should call readCoil method', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    utilsModbusExports.readCoil = mock.fn(async (): Promise<string | undefined> => '123');

    const values = await south.modbusFunction(mockedClient, configuration.items[4]);
    assert.strictEqual(utilsModbusExports.readCoil.mock.calls.length, 1);
    assert.deepStrictEqual(utilsModbusExports.readCoil.mock.calls[0].arguments, [mockedClient, 3715]);
    assert.deepStrictEqual(values, [
      {
        pointId: configuration.items[4].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should call readDiscreteInputRegister method', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    utilsModbusExports.readDiscreteInputRegister = mock.fn(async (): Promise<string | undefined> => '123');

    const values = await south.modbusFunction(mockedClient, configuration.items[3]);
    assert.strictEqual(utilsModbusExports.readDiscreteInputRegister.mock.calls.length, 1);
    assert.deepStrictEqual(utilsModbusExports.readDiscreteInputRegister.mock.calls[0].arguments, [mockedClient, 7810]);
    assert.deepStrictEqual(values, [
      {
        pointId: configuration.items[3].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should call readInputRegister method', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    utilsModbusExports.readInputRegister = mock.fn(async (): Promise<string | undefined> => '123');

    const values = await south.modbusFunction(mockedClient, configuration.items[2]);
    assert.strictEqual(utilsModbusExports.readInputRegister.mock.calls.length, 1);
    assert.deepStrictEqual(utilsModbusExports.readInputRegister.mock.calls[0].arguments, [
      mockedClient,
      16001,
      configuration.settings.swapWordsInDWords,
      configuration.settings.swapBytesInWords,
      configuration.settings.endianness,
      configuration.items[2].settings.data!.multiplierCoefficient,
      configuration.items[2].settings.data!.dataType,
      configuration.items[2].settings.data!.bitIndex
    ]);
    assert.deepStrictEqual(values, [
      {
        pointId: configuration.items[2].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should call readHoldingRegister method', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    utilsModbusExports.readHoldingRegister = mock.fn(async (): Promise<string | undefined> => '123');

    const values = await south.modbusFunction(mockedClient, configuration.items[1]);
    assert.strictEqual(utilsModbusExports.readHoldingRegister.mock.calls.length, 1);
    assert.deepStrictEqual(utilsModbusExports.readHoldingRegister.mock.calls[0].arguments, [
      mockedClient,
      20097,
      configuration.settings.swapWordsInDWords,
      configuration.settings.swapBytesInWords,
      configuration.settings.endianness,
      configuration.items[1].settings.data!.multiplierCoefficient,
      configuration.items[1].settings.data!.dataType,
      configuration.items[1].settings.data!.bitIndex
    ]);
    assert.deepStrictEqual(values, [
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should throw an error on wrong modbus type', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    south.addContent = mock.fn(async (): Promise<void> => undefined);
    configuration.settings.addressOffset = 'jbus';
    const item: SouthConnectorItemEntity<SouthModbusItemSettings> = {
      id: 'bad',
      enabled: true,
      name: 'Bad Item',
      scanMode: testData.scanMode.list[0],
      settings: {
        modbusType: 'bad type' as SouthModbusItemSettingsModbusType,
        address: '1010'
      },
      group: null,
      syncWithGroup: false,
      maxReadInterval: null,
      readDelay: null,
      overlap: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    await assert.rejects(
      south.modbusFunction(mockedClient, item),
      new Error(`Wrong Modbus type "${item.settings.modbusType}" for point "${item.name}"`)
    );
  });

  it('should properly test connection', async () => {
    await assert.doesNotReject(south.testConnection());
    assert.strictEqual(utilsModbusExports.connectSocket.mock.calls.length, 1);
    assert.deepStrictEqual(utilsModbusExports.connectSocket.mock.calls[0].arguments[1], configuration.settings);
  });

  it('should properly manage error on test connection failure', async () => {
    const errorMessage = 'Error creating connection to socket';

    for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
      utilsModbusExports.connectSocket = mock.fn(async () => {
        throw new ModbusError(errorMessage, code);
      });
      await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]}: ${errorMessage}`));
    }
  });

  it('should properly test item', async () => {
    await assert.doesNotReject(south.testItem(configuration.items[0], testData.south.itemTestingSettings));
    assert.strictEqual(utilsModbusExports.connectSocket.mock.calls.length, 1);
    assert.strictEqual(socketMock.mock.calls.length, 1);
  });

  it('should properly manage error on test item failure', async () => {
    const errorMessage = 'Error creating connection to socket';

    for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
      utilsModbusExports.connectSocket = mock.fn(async () => {
        throw new ModbusError(errorMessage, code);
      });
      await assert.rejects(
        south.testItem(configuration.items[0], testData.south.itemTestingSettings),
        new Error(`${ERROR_CODES[code]}: ${errorMessage}`)
      );
    }
  });
});
