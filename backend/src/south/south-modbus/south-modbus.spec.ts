import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Stream from 'node:stream';
import net from 'node:net';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, asLogger } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type {
  SouthModbusItemSettings,
  SouthModbusItemSettingsModbusType,
  SouthModbusSettings
} from '../../../shared/model/south-settings.model';
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
}

describe('South Modbus', () => {
  let SouthModbus: typeof SouthModbusClass;
  let south: SouthModbusClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn();
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
    connectSocket: mock.fn(async () => undefined),
    readCoil: mock.fn(async () => undefined),
    readDiscreteInputRegister: mock.fn(async () => undefined),
    readHoldingRegister: mock.fn(async () => undefined),
    readInputRegister: mock.fn(async () => undefined)
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
      connectTimeout: 30000
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
    utilsModbusExports.connectSocket = mock.fn(async () => undefined);
    utilsModbusExports.readCoil = mock.fn(async () => undefined);
    utilsModbusExports.readDiscreteInputRegister = mock.fn(async () => undefined);
    utilsModbusExports.readHoldingRegister = mock.fn(async () => undefined);
    utilsModbusExports.readInputRegister = mock.fn(async () => undefined);
    addContentCallback.mock.resetCalls();
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthModbus(configuration, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly connect', async () => {
    south.disconnect = mock.fn(async () => undefined);
    (south as unknown as Record<string, unknown>)['reconnectTimeout'] = setTimeout(() => null, 1000);

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
    assert.strictEqual((south.disconnect as ReturnType<typeof mock.fn>).mock.calls.length, 0);
  });

  it('should properly reconnect on connect error when not disconnecting', async () => {
    south.disconnect = mock.fn(async () => undefined);

    utilsModbusExports.connectSocket = mock.fn(async () => {
      throw new Error('connect error');
    });

    // With disconnecting=false and connector.enabled=true, a retry timer should be set
    await south.connect();

    assert.strictEqual((south.disconnect as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('Modbus socket error: connect error')
      )
    );

    // Tick the retry interval — should trigger another connect attempt
    utilsModbusExports.connectSocket = mock.fn(async () => undefined);
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 2);
  });

  it('should not set retry timer when disconnecting is true', async () => {
    south.disconnect = mock.fn(async () => undefined);
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;

    utilsModbusExports.connectSocket = mock.fn(async () => {
      throw new Error('connect error');
    });

    await south.connect();

    assert.strictEqual((south.disconnect as ReturnType<typeof mock.fn>).mock.calls.length, 1);

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

  it('should query items via directQuery', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    (south as unknown as Record<string, unknown>)['modbusClient'] = mockedClient;
    south.disconnect = mock.fn(async () => undefined);
    south.addContent = mock.fn(async () => undefined);
    south.modbusFunction = mock.fn(async () => []);

    await south.directQuery(configuration.items);

    assert.strictEqual((south.modbusFunction as ReturnType<typeof mock.fn>).mock.calls.length, configuration.items.length);
    assert.deepStrictEqual((south.modbusFunction as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
      mockedClient,
      configuration.items[0]
    ]);
    assert.strictEqual((south.disconnect as ReturnType<typeof mock.fn>).mock.calls.length, 0);
    assert.strictEqual((south.addContent as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.deepStrictEqual((south.addContent as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], {
      content: [],
      type: 'time-values'
    });
    assert.strictEqual((south.addContent as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
    assert.deepStrictEqual((south.addContent as ReturnType<typeof mock.fn>).mock.calls[0].arguments[2], configuration.items);
  });

  it('should handle directQuery error when disconnecting is true', async () => {
    (south as unknown as Record<string, unknown>)['modbusClient'] = {} as unknown as ModbusTCPClient;
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;
    south.disconnect = mock.fn(async () => undefined);
    south.addContent = mock.fn(async () => undefined);
    south.modbusFunction = mock.fn(async () => {
      throw new Error('modbus function error');
    });

    await assert.rejects(south.directQuery([configuration.items[1]]), new Error('modbus function error'));
    assert.strictEqual((south.disconnect as ReturnType<typeof mock.fn>).mock.calls.length, 1);

    // No retry timer set when disconnecting
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 0);
  });

  it('should handle directQuery error when not disconnecting', async () => {
    (south as unknown as Record<string, unknown>)['modbusClient'] = {} as unknown as ModbusTCPClient;
    (south as unknown as Record<string, unknown>)['disconnecting'] = false;
    south.disconnect = mock.fn(async () => undefined);
    south.addContent = mock.fn(async () => undefined);
    south.modbusFunction = mock.fn(async () => {
      throw new Error('modbus function error');
    });

    await assert.rejects(south.directQuery([configuration.items[1]]), new Error('modbus function error'));
    assert.strictEqual((south.disconnect as ReturnType<typeof mock.fn>).mock.calls.length, 1);

    // Retry timer should have been set — tick triggers a connect (net.Socket call)
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(socketMock.mock.calls.length, 1);
  });

  it('should throw when directQuery is called without modbusClient', async () => {
    south.modbusFunction = mock.fn(async () => []);
    await assert.rejects(south.directQuery(configuration.items), new Error('Could not read address: Modbus client not set'));
    assert.strictEqual((south.modbusFunction as ReturnType<typeof mock.fn>).mock.calls.length, 0);
  });

  it('should call readCoil method', async () => {
    const mockedClient = {} as unknown as ModbusTCPClient;
    utilsModbusExports.readCoil = mock.fn(async () => '123');

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
    utilsModbusExports.readDiscreteInputRegister = mock.fn(async () => '123');

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
    utilsModbusExports.readInputRegister = mock.fn(async () => '123');

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
    utilsModbusExports.readHoldingRegister = mock.fn(async () => '123');

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
    south.addContent = mock.fn(async () => undefined);
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
