import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import net from 'node:net';
import Stream from 'node:stream';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';

import type {
  SouthModbusItemSettings,
  SouthModbusItemSettingsModbusType,
  SouthModbusSettings
} from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type * as UtilsModbus from '../../service/utils-modbus';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthModbusClass from './south-modbus';

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

const buildItem = (
  id: string,
  name: string,
  settings: SouthModbusItemSettings,
  overrides: Partial<SouthConnectorItemEntity<SouthModbusItemSettings>> = {}
): SouthConnectorItemEntity<SouthModbusItemSettings> => ({
  id,
  name,
  enabled: true,
  settings,
  scanMode: testData.scanMode.list[0],
  group: null,
  syncWithGroup: false,
  maxReadInterval: null,
  readDelay: null,
  startTimeOffset: null,
  endTimeOffset: null,
  recoveryStrategy: null,
  cachingStrategy: 'allValues',
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: '',
  ...overrides
});

const holdingRegister = (address: string): SouthModbusItemSettings => ({
  address,
  modbusType: 'holding-register',
  data: { dataType: 'uint16', multiplierCoefficient: 1 }
});
const coil = (address: string): SouthModbusItemSettings => ({ address, modbusType: 'coil' });

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
    buildItem('id1', 'HoldingRegister', holdingRegister('0x4E80')),
    buildItem('id2', 'HoldingRegister', holdingRegister('20097')),
    buildItem('id3', 'InputRegister', {
      address: '0x3E81',
      modbusType: 'input-register',
      data: { dataType: 'uint16', multiplierCoefficient: 1 }
    }),
    buildItem('id4', 'DiscreteInput', { address: '0x1E82', modbusType: 'discrete-input' }),
    buildItem('id5', 'Coil', coil('0x0E83')),
    buildItem('id6', 'HoldingRegister', {
      address: '0x0E88',
      modbusType: 'holding-register',
      data: { dataType: 'bit', bitIndex: 1, multiplierCoefficient: 1 }
    })
  ],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

const withSettings = (settings: Partial<SouthModbusSettings>) => ({
  ...configuration,
  settings: { ...configuration.settings, ...settings }
});

const lastValues = (...values: Array<[itemId: string, value: string, instant: string]>) =>
  new Map(
    values.map(([itemId, value, instant]) => [itemId, { itemId, groupId: null, queryTime: instant, value, trackedInstant: instant }])
  );

const registersResponse = async (_addr: number, count: number) => ({ response: { body: { valuesAsBuffer: Buffer.alloc(count * 2) } } });
const bitsResponse = (bit: number) => async (_addr: number, count: number) => ({
  response: { body: { valuesAsArray: Array(count).fill(bit) } }
});
const modbusError = async (): Promise<never> => {
  throw new Error('modbus function error');
};

const logged = (logMock: Mock<(...args: Array<unknown>) => unknown>, message: string) =>
  logMock.mock.calls.some(c => (c.arguments[0] as string).includes(message));

describe('South Modbus', () => {
  let SouthModbus: typeof SouthModbusClass;
  let south: SouthModbusClass;
  let logger: PinoLogger;
  let southCacheRepository: Mocked<SouthCacheRepository>;
  let addContent: Mock<SouthModbusClass['addContent']>;
  let mockedEmitter: CustomStream;
  let socketMock: ReturnType<typeof mock.method>;
  const mockedClient = createMock<ModbusTCPClient>();

  const realUtilsModbus: typeof UtilsModbus = nodeRequire('../../service/utils-modbus');
  const createUtilsModbusMocks = () => ({
    connectSocket: mock.fn(async (_socket: unknown, _settings: unknown): Promise<void> => undefined),
    readCoil: mock.fn(async (..._args: Array<unknown>): Promise<string | undefined> => undefined),
    readDiscreteInputRegister: mock.fn(async (..._args: Array<unknown>): Promise<string | undefined> => undefined),
    readHoldingRegister: mock.fn(async (..._args: Array<unknown>): Promise<string | undefined> => undefined),
    readInputRegister: mock.fn(async (..._args: Array<unknown>): Promise<string | undefined> => undefined)
  });
  const utilsModbusExports = { ...realUtilsModbus, ...createUtilsModbusMocks() };

  before(() => {
    // SUT does `new client.TCP(...)`: a regular function is required
    mockModule(nodeRequire, 'jsmodbus', {
      __esModule: true,
      client: {
        TCP: function () {
          return {};
        }
      }
    });
    mockModule(nodeRequire, '../../service/utils-modbus', utilsModbusExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthModbus = reloadModule<{ default: typeof SouthModbusClass }>(nodeRequire, './south-modbus').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    mockedEmitter = new CustomStream();
    // net.Socket is mocked on the real builtin, shared with the SUT. Called with `new`: a regular function is required
    const emitter = mockedEmitter;
    socketMock = mock.method(net, 'Socket', function () {
      return emitter;
    });
    Object.assign(utilsModbusExports, createUtilsModbusMocks());
    southCacheRepository = createMock<SouthCacheRepository>({ getItemsLastValues: () => new Map() });
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthModbus(
      configuration,
      mock.fn(async () => undefined),
      southCacheRepository,
      'cacheFolder'
    );
    addContent = mock.method(south, 'addContent', async () => undefined);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly connect', async () => {
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    south['reconnectTimeout'] = setTimeout(() => null, 1000);
    const setKeepAliveMock = mock.method(mockedEmitter, 'setKeepAlive');

    await south.connect();

    assert.strictEqual(socketMock.mock.calls.length, 1);
    assert.strictEqual(utilsModbusExports.connectSocket.mock.calls.length, 1);
    assert.deepStrictEqual(utilsModbusExports.connectSocket.mock.calls[0].arguments[1], configuration.settings);
    assert.ok(logged(logger.debug, `Connecting Modbus socket into ${configuration.settings.host}:${configuration.settings.port}`));
    assert.ok(logged(logger.info, `Modbus socket connected to ${configuration.settings.host}:${configuration.settings.port}`));
    assert.strictEqual(disconnect.mock.calls.length, 0);
    assert.strictEqual(setKeepAliveMock.mock.calls.length, 1);
    assert.deepStrictEqual(setKeepAliveMock.mock.calls[0].arguments, [true, configuration.settings.networkTimeout]);
  });

  it('should reconnect when socket closes unexpectedly between scans', async () => {
    const disconnect = mock.method(south, 'disconnect', async () => undefined);

    await south.connect();

    // Simulate an unexpected socket close (e.g. server-side idle timeout)
    mockedEmitter.emit('close');
    // Flush the async close handler (it awaits disconnect())
    await Promise.resolve();
    await Promise.resolve();

    assert.strictEqual(disconnect.mock.calls.length, 1);
    assert.ok(logged(logger.warn, 'Modbus socket closed unexpectedly'));

    // Ticking the retry interval should trigger a new connect (new Socket creation)
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 2);
  });

  it('should not reconnect when socket closes during an explicit disconnect', async () => {
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    south['disconnecting'] = true;

    await south.connect();

    // Simulate a close event while disconnecting is true
    mockedEmitter.emit('close');
    await Promise.resolve();
    await Promise.resolve();

    // The close handler must be a no-op when disconnecting
    assert.strictEqual(disconnect.mock.calls.length, 0);
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 1);
  });

  it('should properly reconnect on connect error when not disconnecting', async () => {
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    utilsModbusExports.connectSocket.mock.mockImplementationOnce(async () => {
      throw new Error('connect error');
    });

    // With disconnecting=false and connector.enabled=true, a retry timer should be set
    await south.connect();

    assert.strictEqual(disconnect.mock.calls.length, 1);
    assert.ok(logged(logger.error, 'Modbus socket error: connect error'));

    // Tick the retry interval — should trigger another connect attempt
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 2);
  });

  it('should not set retry timer when disconnecting is true', async () => {
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    south['disconnecting'] = true;
    utilsModbusExports.connectSocket.mock.mockImplementation(async () => {
      throw new Error('connect error');
    });

    await south.connect();

    assert.strictEqual(disconnect.mock.calls.length, 1);

    // No timer should have been set — ticking should NOT trigger another Socket creation
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 1);
  });

  it('should properly disconnect without active socket or timeout', async () => {
    await south.disconnect();
    // nothing should throw, socket is null by default
  });

  it('should properly disconnect with active socket and timeout', async () => {
    south['reconnectTimeout'] = setTimeout(() => null, 1000);
    const mockedSocket = createMock<net.Socket>();
    south['socket'] = mockedSocket;

    await south.disconnect();

    assert.strictEqual(mockedSocket.destroy.mock.calls.length, 1);
    assert.strictEqual(mockedSocket.removeAllListeners.mock.calls.length, 1);

    // Timer was cleared — ticking should not cause further side-effects
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(south['reconnectTimeout'], null);
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
    const modbusClient = createMock<ModbusTCPClient>({
      readHoldingRegisters: registersResponse,
      readInputRegisters: registersResponse,
      readCoils: bitsResponse(0),
      readDiscreteInputs: bitsResponse(1)
    });
    south['modbusClient'] = modbusClient;
    south['connector'] = withSettings({ batchQuery: true });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);

    await south.directQuery(configuration.items);

    // holding-register: 2 batches
    assert.strictEqual(modbusClient.readHoldingRegisters.mock.calls.length, 2);
    assert.deepStrictEqual(modbusClient.readHoldingRegisters.mock.calls[0].arguments, [3720, 1]); // id6 alone
    assert.deepStrictEqual(modbusClient.readHoldingRegisters.mock.calls[1].arguments, [20096, 2]); // id1 + id2 merged

    // input-register: 1 batch
    assert.strictEqual(modbusClient.readInputRegisters.mock.calls.length, 1);
    assert.deepStrictEqual(modbusClient.readInputRegisters.mock.calls[0].arguments, [16001, 1]);

    // coil: 1 batch
    assert.strictEqual(modbusClient.readCoils.mock.calls.length, 1);
    assert.deepStrictEqual(modbusClient.readCoils.mock.calls[0].arguments, [3715, 1]);

    // discrete-input: 1 batch
    assert.strictEqual(modbusClient.readDiscreteInputs.mock.calls.length, 1);
    assert.deepStrictEqual(modbusClient.readDiscreteInputs.mock.calls[0].arguments, [7810, 1]);

    assert.strictEqual(disconnect.mock.calls.length, 0);
    assert.strictEqual(addContent.mock.calls.length, 1);
    // All 6 items produce one value each
    assert.strictEqual(addContent.mock.calls[0].arguments[0].content!.length, 6);
    // Single shared timestamp for the whole scan cycle
    assert.strictEqual(addContent.mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
    // Item order now follows the grouped-read order (caching-strategy filtering builds itemsToCache
    // alongside the values as they're produced), not the original items array order — compare as a set.
    const cachedItems = addContent.mock.calls[0].arguments[2];
    assert.deepStrictEqual(
      [...cachedItems].sort((a, b) => a.id.localeCompare(b.id)),
      [...configuration.items].sort((a, b) => a.id.localeCompare(b.id))
    );
  });

  it('should query each item individually when batchQuery is false', async () => {
    // configuration.settings.batchQuery is already false — individual mode is the default.
    // Each of the 6 items must produce exactly one util-function call, regardless of address proximity.
    utilsModbusExports.readHoldingRegister.mock.mockImplementation(async () => '100');
    utilsModbusExports.readInputRegister.mock.mockImplementation(async () => '200');
    utilsModbusExports.readCoil.mock.mockImplementation(async () => '1');
    utilsModbusExports.readDiscreteInputRegister.mock.mockImplementation(async () => '0');
    south['modbusClient'] = mockedClient;

    await south.directQuery(configuration.items);

    // 3 holding-register items (id1, id2, id6) → 3 individual calls
    assert.strictEqual(utilsModbusExports.readHoldingRegister.mock.calls.length, 3);
    // 1 input-register (id3)
    assert.strictEqual(utilsModbusExports.readInputRegister.mock.calls.length, 1);
    // 1 coil (id5)
    assert.strictEqual(utilsModbusExports.readCoil.mock.calls.length, 1);
    // 1 discrete-input (id4)
    assert.strictEqual(utilsModbusExports.readDiscreteInputRegister.mock.calls.length, 1);

    assert.strictEqual(addContent.mock.calls.length, 1);
    // All 6 items produce a value
    assert.strictEqual(addContent.mock.calls[0].arguments[0].content!.length, 6);
    // All values share the single scan-cycle timestamp (modbusFunction's own timestamp is overridden)
    for (const v of addContent.mock.calls[0].arguments[0].content as Array<{ timestamp: string }>) {
      assert.strictEqual(v.timestamp, testData.constants.dates.FAKE_NOW);
    }
  });

  it('should apply jbus address offset (offset = -1)', async () => {
    utilsModbusExports.readHoldingRegister.mock.mockImplementation(async () => '42');
    south['modbusClient'] = mockedClient;
    south['connector'] = withSettings({ addressOffset: 'jbus' });

    await south.directQuery([configuration.items[0]]);

    assert.strictEqual(utilsModbusExports.readHoldingRegister.mock.calls.length, 1);
    // 0x4E80 = 20096, minus the jbus offset
    assert.strictEqual(utilsModbusExports.readHoldingRegister.mock.calls[0].arguments[1], 20095);
  });

  it('should merge non-consecutive items into one request when groupingGap covers the gap', async () => {
    // Three holding-register uint16 items at addresses 1, 3, 5 (gap of 2 between each).
    // With groupingGap = 2 all three should be merged into readHoldingRegisters(1, 5).
    // With groupingGap = 0 each item is its own request.
    const gapItems = [
      buildItem('var1', 'var1', holdingRegister('0x0001')),
      buildItem('var2', 'var2', holdingRegister('0x0003')),
      buildItem('var3', 'var3', holdingRegister('0x0005'))
    ];
    const modbusClient = createMock<ModbusTCPClient>({ readHoldingRegisters: registersResponse });
    south['modbusClient'] = modbusClient;

    // groupingGap = 0: gap of 2 exceeds tolerance → 3 separate requests
    south['connector'] = withSettings({ batchQuery: true, groupingGap: 0 });
    await south.directQuery(gapItems);
    assert.strictEqual(modbusClient.readHoldingRegisters.mock.calls.length, 3);
    assert.deepStrictEqual(modbusClient.readHoldingRegisters.mock.calls[0].arguments, [1, 1]);
    assert.deepStrictEqual(modbusClient.readHoldingRegisters.mock.calls[1].arguments, [3, 1]);
    assert.deepStrictEqual(modbusClient.readHoldingRegisters.mock.calls[2].arguments, [5, 1]);

    // groupingGap = 2: gap of 2 is within tolerance → 1 merged request covering addresses 1–5
    south['connector'] = withSettings({ batchQuery: true, groupingGap: 2 });
    await south.directQuery(gapItems);
    assert.strictEqual(modbusClient.readHoldingRegisters.mock.calls.length, 4);
    assert.deepStrictEqual(modbusClient.readHoldingRegisters.mock.calls[3].arguments, [1, 5]); // 5 words: addr 1..5
  });

  it('should handle directQuery error when disconnecting is true', async () => {
    // Use a single holding-register item to trigger readHoldingRegisters, which will throw
    south['modbusClient'] = createMock<ModbusTCPClient>({ readHoldingRegisters: modbusError });
    south['connector'] = withSettings({ batchQuery: true });
    south['disconnecting'] = true;
    const disconnect = mock.method(south, 'disconnect', async () => undefined);

    await assert.rejects(south.directQuery([configuration.items[1]]), new Error('modbus function error'));
    assert.strictEqual(disconnect.mock.calls.length, 1);

    // No retry timer set when disconnecting
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 0);
  });

  it('should handle directQuery error when not disconnecting', async () => {
    // Use a single holding-register item to trigger readHoldingRegisters, which will throw
    south['modbusClient'] = createMock<ModbusTCPClient>({ readHoldingRegisters: modbusError });
    south['connector'] = withSettings({ batchQuery: true });
    south['disconnecting'] = false;
    const disconnect = mock.method(south, 'disconnect', async () => undefined);

    await assert.rejects(south.directQuery([configuration.items[1]]), new Error('modbus function error'));
    assert.strictEqual(disconnect.mock.calls.length, 1);

    // Retry timer should have been set — tick triggers a connect (net.Socket call)
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 1);
  });

  it('should throw when directQuery is called without modbusClient', async () => {
    await assert.rejects(south.directQuery(configuration.items), new Error('Could not read address: Modbus client not set'));
  });

  it('should not keep resetting the reconnect timer when directQuery keeps failing while disconnected', async () => {
    // Regression test: previously, every failed directQuery call unconditionally called disconnect()
    // (which clears any pending reconnectTimeout) and then re-armed a brand new timer. If the scan
    // mode interval is shorter than retryInterval, each subsequent scan tick — now failing fast with
    // "Modbus client not set" because the connector is already disconnected — kept cancelling and
    // recreating the timer, so connect() was never actually retried: the query failed forever at
    // scan-mode rate without ever reconnecting.
    south['socket'] = mockedEmitter as unknown as net.Socket;
    south['modbusClient'] = createMock<ModbusTCPClient>({ readHoldingRegisters: modbusError });
    south['connector'] = withSettings({ batchQuery: true });
    const disconnectSpy = mock.method(south, 'disconnect');

    // First failure: the connection was actually live (socket/modbusClient set), so disconnect()
    // runs for real and a reconnect timer is scheduled.
    await assert.rejects(south.directQuery([configuration.items[1]]), new Error('modbus function error'));
    assert.strictEqual(disconnectSpy.mock.calls.length, 1);
    assert.strictEqual(south['modbusClient'], null);
    assert.notStrictEqual(south['reconnectTimeout'], null);

    // Simulate more scan-mode ticks firing before retryInterval elapses. Each hits the
    // "Modbus client not set" fast-fail path since the connector is still disconnected/reconnecting —
    // this must NOT call disconnect() again nor reset the pending reconnect timer.
    mock.timers.tick(configuration.settings.retryInterval / 2);
    await assert.rejects(south.directQuery(configuration.items), new Error('Could not read address: Modbus client not set'));
    mock.timers.tick(configuration.settings.retryInterval / 2 - 1);
    await assert.rejects(south.directQuery(configuration.items), new Error('Could not read address: Modbus client not set'));

    assert.strictEqual(disconnectSpy.mock.calls.length, 1);
    // No reconnect attempt yet — the original timer must still be the one counting down
    assert.strictEqual(socketMock.mock.calls.length, 0);

    // Advance past the *original* retryInterval (started at the first failure): if failed queries had
    // kept resetting the timer, connect() would still not fire here.
    mock.timers.tick(2);
    assert.strictEqual(socketMock.mock.calls.length, 1);
  });

  it('should call readCoil method', async () => {
    utilsModbusExports.readCoil.mock.mockImplementation(async () => '123');

    const values = await south.modbusFunction(mockedClient, configuration.items[4]);
    assert.strictEqual(utilsModbusExports.readCoil.mock.calls.length, 1);
    assert.deepStrictEqual(utilsModbusExports.readCoil.mock.calls[0].arguments, [mockedClient, 3715]);
    assert.deepStrictEqual(values, [
      { pointId: configuration.items[4].name, timestamp: testData.constants.dates.FAKE_NOW, data: { value: '123' } }
    ]);
  });

  it('should call readDiscreteInputRegister method', async () => {
    utilsModbusExports.readDiscreteInputRegister.mock.mockImplementation(async () => '123');

    const values = await south.modbusFunction(mockedClient, configuration.items[3]);
    assert.strictEqual(utilsModbusExports.readDiscreteInputRegister.mock.calls.length, 1);
    assert.deepStrictEqual(utilsModbusExports.readDiscreteInputRegister.mock.calls[0].arguments, [mockedClient, 7810]);
    assert.deepStrictEqual(values, [
      { pointId: configuration.items[3].name, timestamp: testData.constants.dates.FAKE_NOW, data: { value: '123' } }
    ]);
  });

  it('should call readInputRegister method', async () => {
    utilsModbusExports.readInputRegister.mock.mockImplementation(async () => '123');

    const item = configuration.items[2];
    const values = await south.modbusFunction(mockedClient, item);
    assert.strictEqual(utilsModbusExports.readInputRegister.mock.calls.length, 1);
    assert.deepStrictEqual(utilsModbusExports.readInputRegister.mock.calls[0].arguments, [
      mockedClient,
      16001,
      configuration.settings.swapWordsInDWords,
      configuration.settings.swapBytesInWords,
      configuration.settings.endianness,
      item.settings.data!.multiplierCoefficient,
      item.settings.data!.dataType,
      item.settings.data!.bitIndex
    ]);
    assert.deepStrictEqual(values, [{ pointId: item.name, timestamp: testData.constants.dates.FAKE_NOW, data: { value: '123' } }]);
  });

  it('should call readHoldingRegister method', async () => {
    utilsModbusExports.readHoldingRegister.mock.mockImplementation(async () => '123');

    const item = configuration.items[1];
    const values = await south.modbusFunction(mockedClient, item);
    assert.strictEqual(utilsModbusExports.readHoldingRegister.mock.calls.length, 1);
    assert.deepStrictEqual(utilsModbusExports.readHoldingRegister.mock.calls[0].arguments, [
      mockedClient,
      20097,
      configuration.settings.swapWordsInDWords,
      configuration.settings.swapBytesInWords,
      configuration.settings.endianness,
      item.settings.data!.multiplierCoefficient,
      item.settings.data!.dataType,
      item.settings.data!.bitIndex
    ]);
    assert.deepStrictEqual(values, [{ pointId: item.name, timestamp: testData.constants.dates.FAKE_NOW, data: { value: '123' } }]);
  });

  it('should throw an error on wrong modbus type', async () => {
    const item = buildItem('bad', 'Bad Item', { modbusType: 'bad type' as SouthModbusItemSettingsModbusType, address: '1010' });
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
      utilsModbusExports.connectSocket.mock.mockImplementation(async () => {
        throw new ModbusError(errorMessage, code);
      });
      await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]}: ${errorMessage}`));
    }
  });

  it('should properly test item', async () => {
    utilsModbusExports.connectSocket.mock.mockImplementation(async () => {
      mock.timers.tick(15);
    });
    utilsModbusExports.readHoldingRegister.mock.mockImplementation(async () => {
      mock.timers.tick(25);
      return undefined;
    });

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    assert.strictEqual(utilsModbusExports.connectSocket.mock.calls.length, 1);
    assert.strictEqual(socketMock.mock.calls.length, 1);
    assert.strictEqual(result.connectionDuration, 15);
    assert.strictEqual(result.queryDuration, 25);
  });

  it('should properly manage error on test item failure', async () => {
    const errorMessage = 'Error creating connection to socket';

    for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
      utilsModbusExports.connectSocket.mock.mockImplementation(async () => {
        throw new ModbusError(errorMessage, code);
      });
      await assert.rejects(
        south.testItem(configuration.items[0], testData.south.itemTestingSettings),
        new Error(`${ERROR_CODES[code]}: ${errorMessage}`)
      );
    }
  });

  describe('testItem with a running connector', () => {
    let liveSocket: Mocked<net.Socket>;
    let disconnect: Mock<SouthModbusClass['disconnect']>;
    let destroyMock: Mock<CustomStream['destroy']>;

    beforeEach(() => {
      // Simulate a running connector with its own live socket/modbusClient
      liveSocket = createMock<net.Socket>();
      south['socket'] = liveSocket;
      south['modbusClient'] = mockedClient;
      disconnect = mock.method(south, 'disconnect', async () => undefined);
      destroyMock = mock.method(mockedEmitter, 'destroy');
    });

    const assertLiveConnectionUntouched = () => {
      // testItem's own local socket (the mocked net.Socket instance) must be destroyed
      assert.strictEqual(destroyMock.mock.calls.length, 1);
      // The connector's own disconnect() must never be invoked by testItem
      assert.strictEqual(disconnect.mock.calls.length, 0);
      // The connector's live socket/modbusClient must be left untouched
      assert.strictEqual(south['socket'], liveSocket);
      assert.strictEqual(south['modbusClient'], mockedClient);
      assert.strictEqual(liveSocket.destroy.mock.calls.length, 0);
      assert.strictEqual(liveSocket.removeAllListeners.mock.calls.length, 0);
    };

    it('should close its own local socket on test item success without touching the connector live socket', async () => {
      await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

      assertLiveConnectionUntouched();
    });

    it('should close its own local socket on test item failure without touching the connector live socket', async () => {
      utilsModbusExports.connectSocket.mock.mockImplementation(async () => {
        throw new ModbusError('Error creating connection to socket', 'ECONNREFUSED');
      });

      await assert.rejects(south.testItem(configuration.items[0], testData.south.itemTestingSettings));

      assertLiveConnectionUntouched();
    });
  });

  it('should return null from directQuery when no items are queried', async () => {
    south['modbusClient'] = mockedClient;
    south['connector'] = withSettings({ batchQuery: true });

    const result = await south.directQuery([]);

    assert.strictEqual(result, null);
  });

  it('should merge consecutive coils into a single request and chunk within MAX_COIL_READ_COUNT', async () => {
    // Three consecutive coils (addresses 10, 11, 12) merge into one run (groupingGap = 0, gap of 1
    // is within tolerance) which is then chunked without exceeding MAX_COIL_READ_COUNT (2000).
    const bitItems = [buildItem('bit1', 'bit1', coil('10')), buildItem('bit2', 'bit2', coil('11')), buildItem('bit3', 'bit3', coil('12'))];
    const modbusClient = createMock<ModbusTCPClient>({ readCoils: bitsResponse(0) });
    south['modbusClient'] = modbusClient;
    south['connector'] = withSettings({ batchQuery: true, groupingGap: 0, addressOffset: 'modbus' });

    await south.directQuery(bitItems);

    assert.strictEqual(modbusClient.readCoils.mock.calls.length, 1);
    assert.deepStrictEqual(modbusClient.readCoils.mock.calls[0].arguments, [10, 3]);
  });

  it('should split a merged coil run into multiple requests when the span exceeds MAX_COIL_READ_COUNT', async () => {
    // With a large groupingGap the two coils (addresses 0 and 2500) are merged into a single run,
    // but the address span (2501) exceeds MAX_COIL_READ_COUNT (2000), forcing the chunking loop to
    // split them into two separate requests.
    const bitItems = [buildItem('bit1', 'bit1', coil('0')), buildItem('bit2', 'bit2', coil('2500'))];
    const modbusClient = createMock<ModbusTCPClient>({ readCoils: bitsResponse(0) });
    south['modbusClient'] = modbusClient;
    south['connector'] = withSettings({ batchQuery: true, groupingGap: 3000, addressOffset: 'modbus' });

    await south.directQuery(bitItems);

    assert.strictEqual(modbusClient.readCoils.mock.calls.length, 2);
    assert.deepStrictEqual(modbusClient.readCoils.mock.calls[0].arguments, [0, 1]);
    assert.deepStrictEqual(modbusClient.readCoils.mock.calls[1].arguments, [2500, 1]);
  });

  it('should split a merged register run into multiple requests when the span exceeds MAX_REGISTER_WORD_COUNT', async () => {
    // With a large groupingGap the two registers (addresses 0 and 200) are merged into a single run,
    // but the span (201 words) exceeds MAX_REGISTER_WORD_COUNT (125), forcing the chunking loop to
    // split them into two separate requests.
    const registerItems = [buildItem('reg1', 'reg1', holdingRegister('0')), buildItem('reg2', 'reg2', holdingRegister('200'))];
    const modbusClient = createMock<ModbusTCPClient>({ readHoldingRegisters: registersResponse });
    south['modbusClient'] = modbusClient;
    south['connector'] = withSettings({ batchQuery: true, groupingGap: 300, addressOffset: 'modbus' });

    await south.directQuery(registerItems);

    assert.strictEqual(modbusClient.readHoldingRegisters.mock.calls.length, 2);
    assert.deepStrictEqual(modbusClient.readHoldingRegisters.mock.calls[0].arguments, [0, 1]);
    assert.deepStrictEqual(modbusClient.readHoldingRegisters.mock.calls[1].arguments, [200, 1]);
  });

  describe('caching strategy filtering', () => {
    const inputRegister = {
      address: '0x3E81',
      modbusType: 'input-register',
      data: { dataType: 'uint16', multiplierCoefficient: 1 }
    } as const;
    const cachedValue = (value: string) => ({ pointId: 'Var1', timestamp: testData.constants.dates.FAKE_NOW, data: { value } });

    beforeEach(() => {
      south['modbusClient'] = mockedClient;
      utilsModbusExports.readHoldingRegister.mock.mockImplementation(async () => '42');
    });

    it('should suppress a no-change value under cachingStrategy=onChange', async () => {
      const item = buildItem('id1', 'Var1', holdingRegister('0x4E80'), { cachingStrategy: 'onChange' });
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['id1', '42', '2021-01-01T00:00:00.000Z']));

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, []);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], []);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], []);
    });

    it('should cache a threshold-exceeding change', async () => {
      const item = buildItem('id1', 'Var1', holdingRegister('0x4E80'), {
        cachingStrategy: 'threshold',
        thresholdType: 'absolute',
        threshold: 5
      });
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['id1', '30', '2021-01-01T00:00:00.000Z']));

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [cachedValue('42')]);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
        { itemId: 'id1', value: '42', instant: testData.constants.dates.FAKE_NOW }
      ]);
    });

    it('should compute a percentage-of-span threshold correctly, caching the value above it and suppressing the one below it', async () => {
      // rangeLow=0, rangeHigh=100 -> span=100; threshold=10% -> 10 absolute units
      // holding register: 42, diff from 20 = 22 > 10
      utilsModbusExports.readInputRegister.mock.mockImplementation(async () => '25'); // diff from 20 = 5 < 10
      const thresholdSettings = {
        cachingStrategy: 'threshold',
        thresholdType: 'percentage',
        threshold: 10,
        rangeLow: 0,
        rangeHigh: 100
      } as const;
      const overItem = buildItem('id1', 'Var1', holdingRegister('0x4E80'), thresholdSettings);
      const underItem = buildItem('id2', 'Var2', inputRegister, thresholdSettings);
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() =>
        lastValues(['id1', '20', '2021-01-01T00:00:00.000Z'], ['id2', '20', '2021-01-01T00:00:00.000Z'])
      );

      await south.directQuery([overItem, underItem]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [cachedValue('42')]);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [overItem]);
    });

    it('should cache when maxCachingInterval elapses even without a qualifying change', async () => {
      const item = buildItem('id1', 'Var1', holdingRegister('0x4E80'), { cachingStrategy: 'onChange', maxCachingInterval: 1000 });
      // previous cached value is identical (no onChange-qualifying diff), but 2h have elapsed since trackedInstant
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['id1', '42', '2021-01-01T22:00:00.000Z']));

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [cachedValue('42')]);
    });

    it('should always cache the very first read for an item regardless of strategy', async () => {
      const item = buildItem('id1', 'Var1', holdingRegister('0x4E80'), { cachingStrategy: 'onChange' });
      // getItemsLastValues default mock (set in beforeEach) returns an empty Map — no prior cached state

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [cachedValue('42')]);
    });

    it('should call saveItemsLastValues with exactly the items actually cached in the cycle', async () => {
      // holding register: 42, unchanged from previous -> suppressed
      utilsModbusExports.readInputRegister.mock.mockImplementation(async () => '7'); // changed from previous -> cached
      const suppressedItem = buildItem('id1', 'Var1', holdingRegister('0x4E80'), { cachingStrategy: 'onChange' });
      const cachedItem = buildItem('id2', 'Var2', inputRegister, { cachingStrategy: 'onChange' });
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() =>
        lastValues(['id1', '42', '2021-01-01T00:00:00.000Z'], ['id2', '1', '2021-01-01T00:00:00.000Z'])
      );

      await south.directQuery([suppressedItem, cachedItem]);

      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments, [
        'southId',
        [{ itemId: 'id2', value: '7', instant: testData.constants.dates.FAKE_NOW }]
      ]);
    });
  });
});
