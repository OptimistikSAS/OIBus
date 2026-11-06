import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { SouthS7ItemSettings, SouthS7Settings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type { S7Address } from './s7-client/s7-address';
import type S7Client from './s7-client/s7-client';
import type { S7ClientOptions, S7ReadResult } from './s7-client/s7-client';
import type SouthS7Class from './south-s7';

const nodeRequire = createRequire(import.meta.url);

class ConnectionError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

const buildItem = (
  id: string,
  name: string,
  address: string,
  overrides: Partial<SouthConnectorItemEntity<SouthS7ItemSettings>> = {}
): SouthConnectorItemEntity<SouthS7ItemSettings> => ({
  id,
  name,
  description: null,
  enabled: true,
  settings: { address },
  scanMode: testData.scanMode.list[0],
  group: null,
  syncWithGroup: false,
  maxReadInterval: null,
  readDelay: null,
  startTimeOffset: null,
  endTimeOffset: null,
  recoveryStrategy: null,
  emptyIntervalStrategy: null,
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

const configuration: SouthConnectorEntity<SouthS7Settings, SouthS7ItemSettings> = {
  id: 'southId',
  name: 'south',
  type: 's7',
  description: 'my test connector',
  enabled: true,
  settings: {
    host: '127.0.0.1',
    port: 102,
    rack: 0,
    slot: 1,
    connectionType: 'PG',
    connectTimeout: 10000,
    requestTimeout: 15000,
    retryInterval: 10000
  },
  groups: [],
  items: [buildItem('id1', 'Var1', 'DB1,REAL0'), buildItem('id2', 'Var2', 'DB1,INT2'), buildItem('id3', 'Var3', 'DB1,X4.0')],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

const remoteAddressResult = {
  items: [
    { key: 'RemoteAddress', value: `${configuration.settings.host}:${configuration.settings.port}` },
    { key: 'PDU size', value: '240' }
  ]
};

const errorCases: Array<{ code: string; expected: string }> = [
  { code: 'ENOTFOUND', expected: 'Please check host and port' },
  { code: 'ECONNREFUSED', expected: 'Please check host and port' },
  { code: 'OTHER', expected: 'Unable to connect' }
];

const timeValue = (pointId: string, value: string) => ({ pointId, timestamp: testData.constants.dates.FAKE_NOW, value });

const lastValues = (...values: Array<[itemId: string, value: string, instant: string]>) =>
  new Map(
    values.map(([itemId, value, instant]) => [itemId, { itemId, groupId: null, queryTime: instant, value, trackedInstant: instant }])
  );

const logged = (logMock: Mock<(...args: Array<unknown>) => unknown>, message: string) =>
  logMock.mock.calls.some(c => (c.arguments[0] as string).includes(message));

// Flushes the async unexpected-disconnect handler (it awaits disconnect())
const flushDisconnectHandler = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('South S7', () => {
  let SouthS7: typeof SouthS7Class;
  let south: SouthS7Class;
  let logger: PinoLogger;
  let southCacheRepository: Mocked<SouthCacheRepository>;
  let addContent: Mock<SouthS7Class['addContent']>;
  let disconnect: Mock<SouthS7Class['disconnect']>;
  let latestClient: FakeS7Client;
  let readValues: Record<string, S7ReadResult>;

  // Reads the values of readValues, by address
  const fakeRead = async (addresses: Array<S7Address>): Promise<Array<S7ReadResult>> =>
    addresses.map(address => readValues[address.address] ?? { error: 'object does not exist' });

  class FakeS7Client extends EventEmitter {
    connect = mock.fn(async (): Promise<void> => undefined);
    disconnect = mock.fn(async (): Promise<void> => undefined);
    read = mock.fn(fakeRead);
    isConnected = true;
    pduSize = 240;
  }

  // Builds an S7Client constructor implementation, `customize` changing the behaviour of the created client
  const clientFactory = (customize: (client: FakeS7Client) => void = () => undefined) =>
    function (_options: S7ClientOptions) {
      latestClient = new FakeS7Client();
      customize(latestClient);
      return latestClient;
    };
  const throwingConstructor = (error: Error) =>
    function () {
      throw error;
    };

  // SUT does `new S7Client(...)`: a regular function is required
  const clientExports = { __esModule: true, default: mock.fn(clientFactory()) };

  before(() => {
    mockModule(nodeRequire, './s7-client/s7-client', clientExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthS7 = reloadModule<{ default: typeof SouthS7Class }>(nodeRequire, './south-s7').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    readValues = { 'DB1,REAL0': { value: 42 }, 'DB1,INT2': { value: 7 }, 'DB1,X4.0': { value: true } };
    clientExports.default = mock.fn(clientFactory());
    southCacheRepository = createMock<SouthCacheRepository>({ getItemsLastValues: () => new Map() });
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthS7(
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

  describe('with a mocked disconnect', () => {
    beforeEach(() => {
      disconnect = mock.method(south, 'disconnect', async () => undefined);
    });

    it('should properly connect with PG connection type', async () => {
      south['reconnectTimeout'] = setTimeout(() => null, 1000);

      await south.connect();

      assert.strictEqual(clientExports.default.mock.calls.length, 1);
      assert.deepStrictEqual(clientExports.default.mock.calls[0].arguments[0], {
        host: configuration.settings.host,
        port: configuration.settings.port,
        localTSAP: 0x0100,
        remoteTSAP: 0x0101,
        connectTimeout: configuration.settings.connectTimeout,
        requestTimeout: configuration.settings.requestTimeout
      });
      assert.strictEqual(latestClient.connect.mock.calls.length, 1);
      assert.ok(logged(logger.info, `S7 client connected to ${configuration.settings.host}:${configuration.settings.port} (PDU size 240)`));
      assert.strictEqual(disconnect.mock.calls.length, 0);
    });

    it('should put the connection type, the rack and the slot in the remote TSAP', async () => {
      south['connector'] = { ...configuration, settings: { ...configuration.settings, connectionType: 'OP', rack: 1, slot: 2 } };
      await south.connect();
      assert.strictEqual(clientExports.default.mock.calls[0].arguments[0].remoteTSAP, 0x0222);

      south['connector'] = { ...configuration, settings: { ...configuration.settings, connectionType: 'S7Basic', rack: 0, slot: 3 } };
      await south.connect();
      assert.strictEqual(clientExports.default.mock.calls[1].arguments[0].remoteTSAP, 0x0303);
    });

    it('should reconnect when the connection is lost', async () => {
      await south.connect();
      latestClient.emit('disconnect', new Error('Connection closed by the PLC'));
      await flushDisconnectHandler();

      assert.strictEqual(disconnect.mock.calls.length, 1);
      assert.ok(logged(logger.warn, 'S7 connection lost (Connection closed by the PLC)'));

      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(clientExports.default.mock.calls.length, 2);
    });

    it('should not reconnect when disconnecting explicitly on unexpected disconnect', async () => {
      south['disconnecting'] = true;

      await south.connect();
      latestClient.emit('disconnect', new Error('closed'));
      await flushDisconnectHandler();

      assert.strictEqual(disconnect.mock.calls.length, 0);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(clientExports.default.mock.calls.length, 1);
    });

    it('should not reconnect on unexpected disconnect when connector is disabled', async () => {
      south['connector'] = { ...configuration, enabled: false };

      await south.connect();
      latestClient.emit('disconnect', new Error('closed'));
      await flushDisconnectHandler();

      assert.strictEqual(disconnect.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(clientExports.default.mock.calls.length, 1);
    });

    it('should properly reconnect on connect error when not disconnecting', async () => {
      clientExports.default.mock.mockImplementationOnce(
        clientFactory(client =>
          client.connect.mock.mockImplementation(async () => {
            throw new Error('Connection timeout after 10000 ms');
          })
        )
      );

      await south.connect();

      assert.strictEqual(disconnect.mock.calls.length, 1);
      assert.ok(logged(logger.error, 'S7 connection error: Connection timeout after 10000 ms'));

      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(clientExports.default.mock.calls.length, 2);
    });

    it('should not set retry timer when disconnecting is true on connect error', async () => {
      south['disconnecting'] = true;
      clientExports.default.mock.mockImplementation(throwingConstructor(new Error('connect error')));

      await south.connect();

      assert.strictEqual(disconnect.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(clientExports.default.mock.calls.length, 1);
    });

    it('should not set retry timer when connector is disabled on connect error', async () => {
      south['connector'] = { ...configuration, enabled: false };
      clientExports.default.mock.mockImplementation(throwingConstructor(new Error('connect error')));

      await south.connect();

      assert.strictEqual(disconnect.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(clientExports.default.mock.calls.length, 1);
    });

    describe('on directQuery error', () => {
      beforeEach(() => {
        south['client'] = createMock<S7Client>({
          isConnected: true,
          read: async () => {
            throw new Error('Request timeout after 15000 ms');
          }
        });
      });

      it('should disconnect and schedule reconnect on directQuery error when not disconnecting', async () => {
        await assert.rejects(south.directQuery(configuration.items), new Error('Request timeout after 15000 ms'));
        assert.strictEqual(disconnect.mock.calls.length, 1);

        mock.timers.tick(configuration.settings.retryInterval);
        assert.strictEqual(clientExports.default.mock.calls.length, 1);
      });

      it('should disconnect but not schedule an additional reconnect on directQuery error when one is already pending', async () => {
        south['reconnectTimeout'] = setTimeout(() => null, 1000);

        await assert.rejects(south.directQuery(configuration.items), new Error('Request timeout after 15000 ms'));
        assert.strictEqual(disconnect.mock.calls.length, 1);

        mock.timers.tick(configuration.settings.retryInterval);
        assert.strictEqual(clientExports.default.mock.calls.length, 0);
      });

      it('should disconnect but not schedule reconnect on directQuery error when disconnecting', async () => {
        south['disconnecting'] = true;

        await assert.rejects(south.directQuery(configuration.items), new Error('Request timeout after 15000 ms'));
        assert.strictEqual(disconnect.mock.calls.length, 1);

        mock.timers.tick(configuration.settings.retryInterval);
        assert.strictEqual(clientExports.default.mock.calls.length, 0);
      });
    });
  });

  it('should properly disconnect without active client or timeout', async () => {
    await south.disconnect();
  });

  it('should properly disconnect with active client and timeout', async () => {
    south['reconnectTimeout'] = setTimeout(() => null, 1000);
    const mockedClient = createMock<S7Client>();
    south['client'] = mockedClient;

    await south.disconnect();

    assert.strictEqual(mockedClient.removeAllListeners.mock.calls.length, 1);
    assert.strictEqual(mockedClient.disconnect.mock.calls.length, 1);
    assert.strictEqual(south['reconnectTimeout'], null);
    assert.strictEqual(south['client'], null);
  });

  it('should not throw when client disconnect fails', async () => {
    south['client'] = createMock<S7Client>({
      disconnect: async () => {
        throw new Error('disconnect error');
      }
    });

    await assert.doesNotReject(south.disconnect());
    assert.ok(logged(logger.error, 'Error while disconnecting S7 client: disconnect error'));
  });

  it('should throw when directQuery is called without a connected client', async () => {
    await assert.rejects(south.directQuery(configuration.items), new Error('Could not read address: S7 client not set'));
  });

  it('should throw when directQuery is called with a disconnected client', async () => {
    south['client'] = createMock<S7Client>({ isConnected: false });
    await assert.rejects(south.directQuery(configuration.items), new Error('Could not read address: S7 client not set'));
  });

  it('should query items via directQuery and add content', async () => {
    const client = createMock<S7Client>({ isConnected: true, read: fakeRead });
    south['client'] = client;

    const result = await south.directQuery(configuration.items);

    assert.strictEqual(client.read.mock.calls.length, 1);
    assert.deepStrictEqual(
      client.read.mock.calls[0].arguments[0].map(address => [address.address, address.dataType, address.offset]),
      [
        ['DB1,REAL0', 'REAL', 0],
        ['DB1,INT2', 'INT', 2],
        ['DB1,X4.0', 'X', 4]
      ]
    );
    assert.strictEqual(addContent.mock.calls.length, 1);
    assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [
      timeValue('Var1', '42'),
      timeValue('Var2', '7'),
      timeValue('Var3', 'true')
    ]);
    assert.strictEqual(addContent.mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
    assert.deepStrictEqual(result, timeValue('Var3', 'true'));
  });

  it('should skip the items with an invalid address or a read error', async () => {
    readValues = { 'DB1,REAL0': { value: [1.5, 2.5] }, 'DB1,INT2': { error: 'address out of range' } };
    south['client'] = createMock<S7Client>({ isConnected: true, read: fakeRead });
    const items = [buildItem('id1', 'Var1', 'DB1,REAL0'), buildItem('id2', 'Var2', 'DB1,INT2'), buildItem('id3', 'Var3', 'DB1,FOO4')];

    await south.directQuery(items);

    assert.ok(logged(logger.error, 'Item "Var3" skipped: Invalid S7 address "DB1,FOO4": unknown data type "FOO"'));
    assert.ok(logged(logger.error, 'Could not read item "Var2" at address "DB1,INT2": address out of range'));
    assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [timeValue('Var1', '1.5,2.5')]);
  });

  it('should return null from directQuery when no items are provided', async () => {
    south['client'] = createMock<S7Client>({ isConnected: true, read: fakeRead });

    const result = await south.directQuery([]);
    assert.strictEqual(result, null);
  });

  describe('caching strategy filtering', () => {
    beforeEach(() => {
      south['client'] = createMock<S7Client>({ isConnected: true, read: fakeRead });
    });

    it('should suppress a no-change value under cachingStrategy=onChange', async () => {
      readValues = { 'DB1,REAL0': { value: 42 } };
      const item = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'onChange' });
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['id1', '42', '2021-01-01T00:00:00.000Z']));

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, []);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], []);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], []);
    });

    it('should cache a threshold-exceeding change', async () => {
      readValues = { 'DB1,REAL0': { value: 42 } };
      const item = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'threshold', thresholdType: 'absolute', threshold: 5 });
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['id1', '30', '2021-01-01T00:00:00.000Z']));

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [timeValue('Var1', '42')]);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
        { itemId: 'id1', value: '42', instant: testData.constants.dates.FAKE_NOW }
      ]);
    });

    it('should cache a percentage-of-span threshold-exceeding change and suppress one below it', async () => {
      // rangeLow=0, rangeHigh=100 -> span=100; threshold=10% -> 10 absolute units
      readValues = { 'DB1,REAL0': { value: 42 }, 'DB1,INT2': { value: 25 } };
      const thresholdSettings = {
        cachingStrategy: 'threshold',
        thresholdType: 'percentage',
        threshold: 10,
        rangeLow: 0,
        rangeHigh: 100
      } as const;
      const overItem = buildItem('id1', 'Var1', 'DB1,REAL0', thresholdSettings);
      const underItem = buildItem('id2', 'Var2', 'DB1,INT2', thresholdSettings);
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() =>
        lastValues(['id1', '20', '2021-01-01T00:00:00.000Z'], ['id2', '20', '2021-01-01T00:00:00.000Z'])
      );

      await south.directQuery([overItem, underItem]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [timeValue('Var1', '42')]);
    });

    it('should cache when maxCachingInterval elapses even without a qualifying change', async () => {
      readValues = { 'DB1,REAL0': { value: 42 } };
      const item = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'onChange', maxCachingInterval: 1000 });
      // previous cached value is identical (no onChange-qualifying diff), but 2h have elapsed since trackedInstant
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['id1', '42', '2020-12-31T22:00:00.000Z']));

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [timeValue('Var1', '42')]);
    });

    it('should always cache the very first read for an item regardless of strategy', async () => {
      readValues = { 'DB1,REAL0': { value: 42 } };
      const item = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'onChange' });
      // getItemsLastValues default mock returns an empty Map (no prior cached state)

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [timeValue('Var1', '42')]);
    });

    it('should call saveItemsLastValues with exactly the items actually cached in the cycle', async () => {
      readValues = { 'DB1,REAL0': { value: 42 }, 'DB1,INT2': { value: 7 } };
      const suppressedItem = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'onChange' });
      const cachedItem = buildItem('id2', 'Var2', 'DB1,INT2', { cachingStrategy: 'onChange' });
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

  it('should properly test connection', async () => {
    const result = await south.testConnection();
    assert.deepStrictEqual(result, remoteAddressResult);
    assert.strictEqual(latestClient.connect.mock.calls.length, 1);
    assert.strictEqual(latestClient.disconnect.mock.calls.length, 1);
  });

  it('should properly manage error on test connection failure', async () => {
    for (const { code, expected } of errorCases) {
      clientExports.default.mock.mockImplementation(
        clientFactory(client =>
          client.connect.mock.mockImplementation(async () => {
            throw new ConnectionError('boom', code);
          })
        )
      );
      await assert.rejects(south.testConnection(), new Error(`${expected}: boom`));
    }
  });

  it('should properly test item', async () => {
    clientExports.default.mock.mockImplementation(
      clientFactory(client => {
        client.connect.mock.mockImplementation(async () => {
          mock.timers.tick(15);
        });
        client.read.mock.mockImplementation(async addresses => {
          mock.timers.tick(25);
          return fakeRead(addresses);
        });
      })
    );

    const content = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    assert.strictEqual(content.result.type, 'record-list');
    assert.deepStrictEqual(content.result.content, [{ pointId: 'Var1', timestamp: '2021-01-02T00:00:00.040Z', value: '42' }]);
    assert.strictEqual(content.connectionDuration, 15);
    assert.strictEqual(content.queryDuration, 25);
    assert.strictEqual(latestClient.read.mock.calls[0].arguments[0][0].address, 'DB1,REAL0');
    assert.strictEqual(latestClient.disconnect.mock.calls.length, 1);
  });

  it('should reject the test of an item with an invalid address without connecting', async () => {
    await assert.rejects(
      south.testItem(buildItem('id', 'Var', 'DB1,REAL'), testData.south.itemTestingSettings),
      new Error('Invalid S7 address "DB1,REAL": expected <type><offset>[.<bit or length>][.<array length>]')
    );
    assert.strictEqual(clientExports.default.mock.calls.length, 0);
  });

  it('should reject the test of an item the PLC cannot read', async () => {
    readValues = {};
    await assert.rejects(
      south.testItem(configuration.items[0], testData.south.itemTestingSettings),
      new Error('Could not read address "DB1,REAL0": object does not exist')
    );
    assert.strictEqual(latestClient.disconnect.mock.calls.length, 1);
  });

  describe('when the temporary client disconnect fails', () => {
    beforeEach(() => {
      clientExports.default.mock.mockImplementation(
        clientFactory(client =>
          client.disconnect.mock.mockImplementation(async () => {
            throw new Error('disconnect error');
          })
        )
      );
    });

    it('should properly test connection even when the temporary client disconnect fails', async () => {
      const result = await south.testConnection();
      assert.deepStrictEqual(result, remoteAddressResult);
      assert.strictEqual(latestClient.disconnect.mock.calls.length, 1);
    });

    it('should properly test item even when the temporary client disconnect fails', async () => {
      const content = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
      assert.strictEqual(content.result.type, 'record-list');
      assert.strictEqual(latestClient.disconnect.mock.calls.length, 1);
    });
  });

  it('should properly manage error on test item failure', async () => {
    for (const { code, expected } of errorCases) {
      clientExports.default.mock.mockImplementation(
        clientFactory(client =>
          client.connect.mock.mockImplementation(async () => {
            throw new ConnectionError('boom', code);
          })
        )
      );
      await assert.rejects(south.testItem(configuration.items[0], testData.south.itemTestingSettings), new Error(`${expected}: boom`));
    }
  });
});
