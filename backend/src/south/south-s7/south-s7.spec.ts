import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { S7Endpoint } from '@st-one-io/nodes7';

import type { SouthS7ItemSettings, SouthS7Settings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthS7Class from './south-s7';

const nodeRequire = createRequire(import.meta.url);

class FakeS7Endpoint extends EventEmitter {
  connect = mock.fn(async (): Promise<void> => undefined);
  disconnect = mock.fn(async (): Promise<void> => undefined);
  isConnected = true;
}

class FakeS7ItemGroup {
  translationCB: ((name: string) => string | undefined) | null = null;
  setTranslationCB = mock.fn((cb: (name: string) => string | undefined) => {
    this.translationCB = cb;
  });
  addItems = mock.fn((_names: string | Array<string>) => undefined);
  removeItems = mock.fn((_names: string | Array<string>) => undefined);
  readAllItems: Mock<() => Promise<Record<string, unknown>>>;
  destroy = mock.fn(() => undefined);

  constructor(values: Record<string, unknown>) {
    this.readAllItems = mock.fn(async () => values);
  }
}

class S7Error extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'S7Error';
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
  items: [buildItem('id1', 'Var1', 'DB1,REAL0'), buildItem('id2', 'Var2', 'DB1,INT2'), buildItem('id3', 'Var3', 'DB1,BOOL4.0')],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

const remoteAddressResult = { items: [{ key: 'RemoteAddress', value: `${configuration.settings.host}:${configuration.settings.port}` }] };

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
  let latestEndpoint: FakeS7Endpoint;
  let latestGroup: FakeS7ItemGroup;
  let readAllItemsResult: Record<string, unknown>;

  // Builds an S7Endpoint constructor implementation, `customize` changing the behaviour of the created endpoint
  const endpointFactory = (customize: (endpoint: FakeS7Endpoint) => void = () => undefined) =>
    function (_options: unknown) {
      latestEndpoint = new FakeS7Endpoint();
      customize(latestEndpoint);
      return latestEndpoint;
    };
  const throwingConstructor = (error: Error) =>
    function () {
      throw error;
    };

  // SUT does `new S7Endpoint(...)` / `new S7ItemGroup(...)`: regular functions are required
  const createNodes7Mocks = () => ({
    S7Endpoint: mock.fn(endpointFactory()),
    S7ItemGroup: mock.fn(function (_endpoint: unknown) {
      latestGroup = new FakeS7ItemGroup(readAllItemsResult);
      return latestGroup;
    })
  });
  const nodes7Exports = { __esModule: true, ...createNodes7Mocks() };

  before(() => {
    mockModule(nodeRequire, '@st-one-io/nodes7', nodes7Exports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthS7 = reloadModule<{ default: typeof SouthS7Class }>(nodeRequire, './south-s7').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    readAllItemsResult = { Var1: 42, Var2: 7, Var3: true };
    Object.assign(nodes7Exports, createNodes7Mocks());
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

      assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 1);
      assert.deepStrictEqual(nodes7Exports.S7Endpoint.mock.calls[0].arguments[0], {
        host: configuration.settings.host,
        port: configuration.settings.port,
        rack: configuration.settings.rack,
        slot: configuration.settings.slot,
        srcTSAP: 0x0100,
        autoReconnect: 0,
        s7ConnOpts: { timeout: configuration.settings.requestTimeout }
      });
      assert.strictEqual(latestEndpoint.connect.mock.calls.length, 1);
      assert.ok(logged(logger.info, `S7 endpoint connected to ${configuration.settings.host}:${configuration.settings.port}`));
      assert.strictEqual(disconnect.mock.calls.length, 0);
    });

    it('should fail the connection after the connect timeout', async () => {
      nodes7Exports.S7Endpoint.mock.mockImplementation(
        endpointFactory(endpoint => endpoint.connect.mock.mockImplementation(() => new Promise<void>(() => undefined)))
      );

      const connection = south.connect();
      mock.timers.tick(configuration.settings.connectTimeout);
      await connection;

      assert.ok(logged(logger.error, `S7 endpoint error: Connection timeout after ${configuration.settings.connectTimeout} ms`));
      assert.strictEqual(disconnect.mock.calls.length, 1);
    });

    it('should use the correct srcTSAP for OP and S7Basic connection types', async () => {
      south['connector'] = { ...configuration, settings: { ...configuration.settings, connectionType: 'OP' } };
      await south.connect();
      assert.strictEqual((nodes7Exports.S7Endpoint.mock.calls[0].arguments[0] as { srcTSAP: number }).srcTSAP, 0x0200);

      south['connector'] = { ...configuration, settings: { ...configuration.settings, connectionType: 'S7Basic' } };
      await south.connect();
      assert.strictEqual((nodes7Exports.S7Endpoint.mock.calls[1].arguments[0] as { srcTSAP: number }).srcTSAP, 0x0300);
    });

    it('should reconnect when endpoint disconnects unexpectedly', async () => {
      await south.connect();
      latestEndpoint.emit('disconnect');
      await flushDisconnectHandler();

      assert.strictEqual(disconnect.mock.calls.length, 1);
      assert.ok(logged(logger.warn, 'S7 endpoint disconnected unexpectedly'));

      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 2);
    });

    it('should reconnect when endpoint emits an error', async () => {
      await south.connect();
      latestEndpoint.emit('error', new Error('boom'));
      await flushDisconnectHandler();

      assert.strictEqual(disconnect.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 2);
    });

    it('should not reconnect when disconnecting explicitly on unexpected disconnect', async () => {
      south['disconnecting'] = true;

      await south.connect();
      latestEndpoint.emit('disconnect');
      await flushDisconnectHandler();

      assert.strictEqual(disconnect.mock.calls.length, 0);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 1);
    });

    it('should not reconnect on unexpected disconnect when connector is disabled', async () => {
      south['connector'] = { ...configuration, enabled: false };

      await south.connect();
      latestEndpoint.emit('disconnect');
      await flushDisconnectHandler();

      assert.strictEqual(disconnect.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 1);
    });

    it('should properly reconnect on connect error when not disconnecting', async () => {
      nodes7Exports.S7Endpoint.mock.mockImplementationOnce(throwingConstructor(new Error('connect error')));

      await south.connect();

      assert.strictEqual(disconnect.mock.calls.length, 1);
      assert.ok(logged(logger.error, 'S7 endpoint error: connect error'));

      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 2);
    });

    it('should not set retry timer when disconnecting is true on connect error', async () => {
      south['disconnecting'] = true;
      nodes7Exports.S7Endpoint.mock.mockImplementation(throwingConstructor(new Error('connect error')));

      await south.connect();

      assert.strictEqual(disconnect.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 1);
    });

    it('should not set retry timer when connector is disabled on connect error', async () => {
      south['connector'] = { ...configuration, enabled: false };
      nodes7Exports.S7Endpoint.mock.mockImplementation(throwingConstructor(new Error('connect error')));

      await south.connect();

      assert.strictEqual(disconnect.mock.calls.length, 1);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 1);
    });

    describe('on directQuery error', () => {
      beforeEach(() => {
        nodes7Exports.S7ItemGroup.mock.mockImplementation(throwingConstructor(new Error('read error')));
        south['endpoint'] = createMock<S7Endpoint>({ isConnected: true });
      });

      it('should disconnect and schedule reconnect on directQuery error when not disconnecting', async () => {
        await assert.rejects(south.directQuery(configuration.items), new Error('read error'));
        assert.strictEqual(disconnect.mock.calls.length, 1);

        mock.timers.tick(configuration.settings.retryInterval);
        assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 1);
      });

      it('should disconnect but not schedule an additional reconnect on directQuery error when one is already pending', async () => {
        south['reconnectTimeout'] = setTimeout(() => null, 1000);

        await assert.rejects(south.directQuery(configuration.items), new Error('read error'));
        assert.strictEqual(disconnect.mock.calls.length, 1);

        mock.timers.tick(configuration.settings.retryInterval);
        assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 0);
      });

      it('should disconnect but not schedule reconnect on directQuery error when disconnecting', async () => {
        south['disconnecting'] = true;

        await assert.rejects(south.directQuery(configuration.items), new Error('read error'));
        assert.strictEqual(disconnect.mock.calls.length, 1);

        mock.timers.tick(configuration.settings.retryInterval);
        assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 0);
      });
    });
  });

  it('should properly disconnect without active endpoint or timeout', async () => {
    await south.disconnect();
  });

  it('should properly disconnect with active endpoint and timeout', async () => {
    south['reconnectTimeout'] = setTimeout(() => null, 1000);
    const mockedEndpoint = createMock<S7Endpoint>();
    south['endpoint'] = mockedEndpoint;

    await south.disconnect();

    assert.strictEqual(mockedEndpoint.removeAllListeners.mock.calls.length, 1);
    assert.strictEqual(mockedEndpoint.disconnect.mock.calls.length, 1);
    assert.strictEqual(south['reconnectTimeout'], null);
    assert.strictEqual(south['endpoint'], null);
  });

  it('should not throw when endpoint disconnect fails', async () => {
    south['endpoint'] = createMock<S7Endpoint>({
      disconnect: async () => {
        throw new Error('disconnect error');
      }
    });

    await assert.doesNotReject(south.disconnect());
    assert.ok(logged(logger.error, 'Error while disconnecting S7 endpoint: disconnect error'));
  });

  it('should throw when directQuery is called without a connected endpoint', async () => {
    await assert.rejects(south.directQuery(configuration.items), new Error('Could not read address: S7 client not set'));
  });

  it('should throw when directQuery is called with a disconnected endpoint', async () => {
    south['endpoint'] = createMock<S7Endpoint>({ isConnected: false });
    await assert.rejects(south.directQuery(configuration.items), new Error('Could not read address: S7 client not set'));
  });

  it('should query items via directQuery and add content', async () => {
    const fakeEndpoint = createMock<S7Endpoint>({ isConnected: true });
    south['endpoint'] = fakeEndpoint;

    const result = await south.directQuery(configuration.items);

    assert.strictEqual(nodes7Exports.S7ItemGroup.mock.calls.length, 1);
    assert.strictEqual(nodes7Exports.S7ItemGroup.mock.calls[0].arguments[0], fakeEndpoint);
    assert.strictEqual(latestGroup.addItems.mock.calls.length, 1);
    assert.deepStrictEqual(latestGroup.addItems.mock.calls[0].arguments[0], ['Var1', 'Var2', 'Var3']);
    assert.strictEqual(latestGroup.translationCB!('Var1'), 'DB1,REAL0');
    assert.strictEqual(latestGroup.translationCB!('Var2'), 'DB1,INT2');
    assert.strictEqual(latestGroup.destroy.mock.calls.length, 1);

    assert.strictEqual(addContent.mock.calls.length, 1);
    const content = addContent.mock.calls[0].arguments[0];
    assert.strictEqual(content.content!.length, 3);
    assert.deepStrictEqual(content.content, [timeValue('Var1', '42'), timeValue('Var2', '7'), timeValue('Var3', 'true')]);
    assert.deepStrictEqual(result, timeValue('Var3', 'true'));
  });

  it('should return null from directQuery when no items are provided', async () => {
    south['endpoint'] = createMock<S7Endpoint>({ isConnected: true });

    const result = await south.directQuery([]);
    assert.strictEqual(result, null);
  });

  describe('caching strategy filtering', () => {
    beforeEach(() => {
      south['endpoint'] = createMock<S7Endpoint>({ isConnected: true });
    });

    it('should suppress a no-change value under cachingStrategy=onChange', async () => {
      readAllItemsResult = { Var1: 42 };
      const item = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'onChange' });
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['id1', '42', '2021-01-01T00:00:00.000Z']));

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, []);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], []);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], []);
    });

    it('should cache a threshold-exceeding change', async () => {
      readAllItemsResult = { Var1: 42 };
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
      readAllItemsResult = { Var1: 42, Var2: 25 };
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
      readAllItemsResult = { Var1: 42 };
      const item = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'onChange', maxCachingInterval: 1000 });
      // previous cached value is identical (no onChange-qualifying diff), but 2h have elapsed since trackedInstant
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['id1', '42', '2020-12-31T22:00:00.000Z']));

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [timeValue('Var1', '42')]);
    });

    it('should always cache the very first read for an item regardless of strategy', async () => {
      readAllItemsResult = { Var1: 42 };
      const item = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'onChange' });
      // getItemsLastValues default mock returns an empty Map (no prior cached state)

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [timeValue('Var1', '42')]);
    });

    it('should call saveItemsLastValues with exactly the items actually cached in the cycle', async () => {
      readAllItemsResult = { Var1: 42, Var2: 7 };
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
    assert.strictEqual(latestEndpoint.connect.mock.calls.length, 1);
    assert.strictEqual(latestEndpoint.disconnect.mock.calls.length, 1);
  });

  it('should properly manage error on test connection failure', async () => {
    for (const { code, expected } of errorCases) {
      nodes7Exports.S7Endpoint.mock.mockImplementation(
        endpointFactory(endpoint =>
          endpoint.connect.mock.mockImplementation(async () => {
            throw new S7Error('boom', code);
          })
        )
      );
      await assert.rejects(south.testConnection(), new Error(`${expected}: boom`));
    }
  });

  it('should properly test item', async () => {
    nodes7Exports.S7Endpoint.mock.mockImplementation(
      endpointFactory(endpoint =>
        endpoint.connect.mock.mockImplementation(async () => {
          mock.timers.tick(15);
        })
      )
    );
    nodes7Exports.S7ItemGroup.mock.mockImplementation(function () {
      latestGroup = new FakeS7ItemGroup(readAllItemsResult);
      latestGroup.readAllItems.mock.mockImplementation(async () => {
        mock.timers.tick(25);
        return readAllItemsResult;
      });
      return latestGroup;
    });

    const content = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    assert.strictEqual(content.result.type, 'record-list');
    assert.deepStrictEqual(content.result.content, [{ pointId: 'Var1', timestamp: '2021-01-02T00:00:00.040Z', value: '42' }]);
    assert.strictEqual(content.connectionDuration, 15);
    assert.strictEqual(content.queryDuration, 25);
    assert.strictEqual(latestGroup.translationCB!('Var1'), 'DB1,REAL0');
    assert.strictEqual(latestEndpoint.disconnect.mock.calls.length, 1);
  });

  describe('when the temporary endpoint disconnect fails', () => {
    beforeEach(() => {
      nodes7Exports.S7Endpoint.mock.mockImplementation(
        endpointFactory(endpoint =>
          endpoint.disconnect.mock.mockImplementation(async () => {
            throw new Error('disconnect error');
          })
        )
      );
    });

    it('should properly test connection even when the temporary endpoint disconnect fails', async () => {
      const result = await south.testConnection();
      assert.deepStrictEqual(result, remoteAddressResult);
      assert.strictEqual(latestEndpoint.disconnect.mock.calls.length, 1);
    });

    it('should properly test item even when the temporary endpoint disconnect fails', async () => {
      const content = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
      assert.strictEqual(content.result.type, 'record-list');
      assert.strictEqual(latestEndpoint.disconnect.mock.calls.length, 1);
    });
  });

  it('should properly manage error on test item failure', async () => {
    for (const { code, expected } of errorCases) {
      nodes7Exports.S7Endpoint.mock.mockImplementation(
        endpointFactory(endpoint =>
          endpoint.connect.mock.mockImplementation(async () => {
            throw new S7Error('boom', code);
          })
        )
      );
      await assert.rejects(south.testItem(configuration.items[0], testData.south.itemTestingSettings), new Error(`${expected}: boom`));
    }
  });
});
