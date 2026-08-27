import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { SouthItemSettings, SouthS7ItemSettings, SouthS7Settings } from '../../../shared/model/south-settings.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type { Instant } from '../../model/types';
import type SouthS7Class from './south-s7';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';

const nodeRequire = createRequire(import.meta.url);

class FakeS7Endpoint extends EventEmitter {
  connect = mock.fn(async (): Promise<void> => undefined);
  disconnect = mock.fn(async (): Promise<void> => undefined);
  isConnected = true;
}

class S7Error extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'S7Error';
    this.code = code;
  }
}

describe('South S7', () => {
  let SouthS7: typeof SouthS7Class;
  let south: SouthS7Class;

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
  let latestEndpoint: FakeS7Endpoint;
  let latestGroup: {
    setTranslationCB: ReturnType<typeof mock.fn>;
    addItems: ReturnType<typeof mock.fn>;
    removeItems: ReturnType<typeof mock.fn>;
    readAllItems: ReturnType<typeof mock.fn>;
    destroy: ReturnType<typeof mock.fn>;
    translationCB: ((name: string) => string | undefined) | null;
  };
  let readAllItemsResult: Record<string, unknown>;

  // nodes7 mock — SUT does `import { S7Endpoint, S7ItemGroup } from '@st-one-io/nodes7'` so we need
  // both at top level. Constructors must be regular functions (not arrows) since the SUT calls `new`.
  const nodes7Exports: {
    __esModule: boolean;
    S7Endpoint: ReturnType<typeof mock.fn>;
    S7ItemGroup: ReturnType<typeof mock.fn>;
  } = {
    __esModule: true,
    S7Endpoint: mock.fn(function () {
      latestEndpoint = new FakeS7Endpoint();
      return latestEndpoint;
    }),
    S7ItemGroup: mock.fn(function () {
      latestGroup = {
        setTranslationCB: mock.fn((cb: (name: string) => string | undefined) => {
          latestGroup.translationCB = cb;
        }),
        addItems: mock.fn((_names: string | Array<string>) => undefined),
        removeItems: mock.fn((_names: string | Array<string>) => undefined),
        readAllItems: mock.fn(async () => readAllItemsResult),
        destroy: mock.fn(() => undefined),
        translationCB: null
      };
      return latestGroup;
    })
  };

  before(() => {
    mockModule(nodeRequire, '@st-one-io/nodes7', nodes7Exports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });

    SouthS7 = reloadModule<{ default: typeof SouthS7Class }>(nodeRequire, './south-s7').default;
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
    items: [
      {
        id: 'id1',
        name: 'Var1',
        enabled: true,
        settings: { address: 'DB1,REAL0' },
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
        updatedAt: ''
      },
      {
        id: 'id2',
        name: 'Var2',
        enabled: true,
        settings: { address: 'DB1,INT2' },
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
        updatedAt: ''
      },
      {
        id: 'id3',
        name: 'Var3',
        enabled: true,
        settings: { address: 'DB1,BOOL4.0' },
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
        updatedAt: ''
      }
    ],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

  beforeEach(() => {
    readAllItemsResult = { Var1: 42, Var2: 7, Var3: true };
    nodes7Exports.S7Endpoint = mock.fn(function () {
      latestEndpoint = new FakeS7Endpoint();
      return latestEndpoint;
    });
    nodes7Exports.S7ItemGroup = mock.fn(function () {
      latestGroup = {
        setTranslationCB: mock.fn((cb: (name: string) => string | undefined) => {
          latestGroup.translationCB = cb;
        }),
        addItems: mock.fn((_names: string | Array<string>) => undefined),
        removeItems: mock.fn((_names: string | Array<string>) => undefined),
        readAllItems: mock.fn(async () => readAllItemsResult),
        destroy: mock.fn(() => undefined),
        translationCB: null
      };
      return latestGroup;
    });
    addContentCallback.mock.resetCalls();
    (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.resetCalls();
    (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(() => new Map());
    (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.resetCalls();
    (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(() => undefined);
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthS7(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly connect with PG connection type', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    (south as unknown as Record<string, unknown>)['reconnectTimeout'] = setTimeout(() => null, 1000);

    await south.connect();

    assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 1);
    assert.deepStrictEqual(nodes7Exports.S7Endpoint.mock.calls[0].arguments[0], {
      host: configuration.settings.host,
      port: configuration.settings.port,
      rack: configuration.settings.rack,
      slot: configuration.settings.slot,
      srcTSAP: 0x0100,
      autoReconnect: 0
    });
    assert.strictEqual(latestEndpoint.connect.mock.calls.length, 1);
    assert.ok(
      logger.info.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes(`S7 endpoint connected to ${configuration.settings.host}:${configuration.settings.port}`)
      )
    );
    assert.strictEqual(disconnectMock.mock.calls.length, 0);
  });

  it('should use the correct srcTSAP for OP and S7Basic connection types', async () => {
    south.disconnect = mock.fn(async (): Promise<void> => undefined);
    (south as unknown as Record<string, unknown>)['connector'] = {
      ...configuration,
      settings: { ...configuration.settings, connectionType: 'OP' }
    };
    await south.connect();
    assert.strictEqual((nodes7Exports.S7Endpoint.mock.calls[0].arguments[0] as { srcTSAP: number }).srcTSAP, 0x0200);

    nodes7Exports.S7Endpoint.mock.resetCalls();
    (south as unknown as Record<string, unknown>)['connector'] = {
      ...configuration,
      settings: { ...configuration.settings, connectionType: 'S7Basic' }
    };
    await south.connect();
    assert.strictEqual((nodes7Exports.S7Endpoint.mock.calls[0].arguments[0] as { srcTSAP: number }).srcTSAP, 0x0300);
  });

  it('should reconnect when endpoint disconnects unexpectedly', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;

    await south.connect();
    latestEndpoint.emit('disconnect');
    await Promise.resolve();
    await Promise.resolve();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.ok(
      logger.warn.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('S7 endpoint disconnected unexpectedly')
      )
    );

    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 2);
  });

  it('should reconnect when endpoint emits an error', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;

    await south.connect();
    latestEndpoint.emit('error', new Error('boom'));
    await Promise.resolve();
    await Promise.resolve();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 2);
  });

  it('should not reconnect when disconnecting explicitly on unexpected disconnect', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;

    await south.connect();
    latestEndpoint.emit('disconnect');
    await Promise.resolve();
    await Promise.resolve();

    assert.strictEqual(disconnectMock.mock.calls.length, 0);
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 1);
  });

  it('should not reconnect on unexpected disconnect when connector is disabled', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    (south as unknown as Record<string, unknown>)['connector'] = { ...configuration, enabled: false };

    await south.connect();
    latestEndpoint.emit('disconnect');
    await Promise.resolve();
    await Promise.resolve();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 1);
  });

  it('should properly reconnect on connect error when not disconnecting', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    nodes7Exports.S7Endpoint = mock.fn(function () {
      throw new Error('connect error');
    });

    await south.connect();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('S7 endpoint error: connect error')
      )
    );

    nodes7Exports.S7Endpoint = mock.fn(function () {
      latestEndpoint = new FakeS7Endpoint();
      return latestEndpoint;
    });
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 1);
  });

  it('should not set retry timer when disconnecting is true on connect error', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;
    nodes7Exports.S7Endpoint = mock.fn(function () {
      throw new Error('connect error');
    });

    await south.connect();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    nodes7Exports.S7Endpoint.mock.resetCalls();
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 0);
  });

  it('should not set retry timer when connector is disabled on connect error', async () => {
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    (south as unknown as Record<string, unknown>)['connector'] = { ...configuration, enabled: false };
    nodes7Exports.S7Endpoint = mock.fn(function () {
      throw new Error('connect error');
    });

    await south.connect();

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    nodes7Exports.S7Endpoint.mock.resetCalls();
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 0);
  });

  it('should properly disconnect without active endpoint or timeout', async () => {
    await south.disconnect();
  });

  it('should properly disconnect with active endpoint and timeout', async () => {
    (south as unknown as Record<string, unknown>)['reconnectTimeout'] = setTimeout(() => null, 1000);
    const mockedEndpoint = {
      removeAllListeners: mock.fn(),
      disconnect: mock.fn(async (): Promise<void> => undefined)
    };
    (south as unknown as Record<string, unknown>)['endpoint'] = mockedEndpoint;

    await south.disconnect();

    assert.strictEqual(mockedEndpoint.removeAllListeners.mock.calls.length, 1);
    assert.strictEqual(mockedEndpoint.disconnect.mock.calls.length, 1);
    assert.strictEqual((south as unknown as Record<string, unknown>)['reconnectTimeout'], null);
    assert.strictEqual((south as unknown as Record<string, unknown>)['endpoint'], null);
  });

  it('should not throw when endpoint disconnect fails', async () => {
    const mockedEndpoint = {
      removeAllListeners: mock.fn(),
      disconnect: mock.fn(async (): Promise<void> => {
        throw new Error('disconnect error');
      })
    };
    (south as unknown as Record<string, unknown>)['endpoint'] = mockedEndpoint;

    await assert.doesNotReject(south.disconnect());
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('Error while disconnecting S7 endpoint: disconnect error')
      )
    );
  });

  it('should throw when directQuery is called without a connected endpoint', async () => {
    await assert.rejects(south.directQuery(configuration.items), new Error('Could not read address: S7 client not set'));
  });

  it('should throw when directQuery is called with a disconnected endpoint', async () => {
    (south as unknown as Record<string, unknown>)['endpoint'] = { isConnected: false };
    await assert.rejects(south.directQuery(configuration.items), new Error('Could not read address: S7 client not set'));
  });

  it('should query items via directQuery and add content', async () => {
    const fakeEndpoint = { isConnected: true };
    (south as unknown as Record<string, unknown>)['endpoint'] = fakeEndpoint;
    const addContentMock = mock.fn(
      async (_data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void> =>
        undefined
    );
    south.addContent = addContentMock;

    const result = await south.directQuery(configuration.items);

    assert.strictEqual(nodes7Exports.S7ItemGroup.mock.calls.length, 1);
    assert.strictEqual(nodes7Exports.S7ItemGroup.mock.calls[0].arguments[0], fakeEndpoint);
    assert.strictEqual(latestGroup.addItems.mock.calls.length, 1);
    assert.deepStrictEqual(latestGroup.addItems.mock.calls[0].arguments[0], ['Var1', 'Var2', 'Var3']);
    assert.strictEqual(latestGroup.translationCB!('Var1'), 'DB1,REAL0');
    assert.strictEqual(latestGroup.translationCB!('Var2'), 'DB1,INT2');
    assert.strictEqual(latestGroup.destroy.mock.calls.length, 1);

    assert.strictEqual(addContentMock.mock.calls.length, 1);
    const content = addContentMock.mock.calls[0].arguments[0] as OIBusContent;
    assert.strictEqual(content.content!.length, 3);
    assert.deepStrictEqual(content.content, [
      { pointId: 'Var1', timestamp: testData.constants.dates.FAKE_NOW, data: { value: '42' } },
      { pointId: 'Var2', timestamp: testData.constants.dates.FAKE_NOW, data: { value: '7' } },
      { pointId: 'Var3', timestamp: testData.constants.dates.FAKE_NOW, data: { value: 'true' } }
    ]);
    assert.deepStrictEqual(result, { pointId: 'Var3', timestamp: testData.constants.dates.FAKE_NOW, data: { value: 'true' } });
  });

  it('should return null from directQuery when no items are provided', async () => {
    (south as unknown as Record<string, unknown>)['endpoint'] = { isConnected: true };
    south.addContent = mock.fn(async (): Promise<void> => undefined);

    const result = await south.directQuery([]);
    assert.strictEqual(result, null);
  });

  describe('caching strategy filtering', () => {
    const buildItem = (
      id: string,
      name: string,
      address: string,
      overrides: Partial<SouthConnectorItemEntity<SouthS7ItemSettings>> = {}
    ): SouthConnectorItemEntity<SouthS7ItemSettings> => ({
      ...configuration.items[0],
      id,
      name,
      settings: { address },
      cachingStrategy: 'allValues',
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
      ...overrides
    });

    it('should suppress a no-change value under cachingStrategy=onChange', async () => {
      (south as unknown as Record<string, unknown>)['endpoint'] = { isConnected: true };
      const addContentMock = mock.fn(
        async (_data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void> =>
          undefined
      );
      south.addContent = addContentMock;
      readAllItemsResult = { Var1: 42 };
      const item = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'onChange' });
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
        () =>
          new Map([
            [
              'id1',
              {
                itemId: 'id1',
                groupId: null,
                queryTime: '2021-01-01T00:00:00.000Z',
                value: '42',
                trackedInstant: '2021-01-01T00:00:00.000Z'
              }
            ]
          ])
      );

      await south.directQuery([item]);

      const content = addContentMock.mock.calls[0].arguments[0] as OIBusContent;
      assert.deepStrictEqual(content.content, []);
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], []);
      assert.deepStrictEqual(
        (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1],
        []
      );
    });

    it('should cache a threshold-exceeding change', async () => {
      (south as unknown as Record<string, unknown>)['endpoint'] = { isConnected: true };
      const addContentMock = mock.fn(
        async (_data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void> =>
          undefined
      );
      south.addContent = addContentMock;
      readAllItemsResult = { Var1: 42 };
      const item = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'threshold', thresholdType: 'absolute', threshold: 5 });
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
        () =>
          new Map([
            [
              'id1',
              {
                itemId: 'id1',
                groupId: null,
                queryTime: '2021-01-01T00:00:00.000Z',
                value: '30',
                trackedInstant: '2021-01-01T00:00:00.000Z'
              }
            ]
          ])
      );

      await south.directQuery([item]);

      const content = addContentMock.mock.calls[0].arguments[0] as OIBusContent;
      assert.deepStrictEqual(content.content, [{ pointId: 'Var1', timestamp: testData.constants.dates.FAKE_NOW, data: { value: '42' } }]);
      assert.deepStrictEqual(
        (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1],
        [{ itemId: 'id1', value: '42', instant: testData.constants.dates.FAKE_NOW }]
      );
    });

    it('should cache a percentage-of-span threshold-exceeding change and suppress one below it', async () => {
      (south as unknown as Record<string, unknown>)['endpoint'] = { isConnected: true };
      const addContentMock = mock.fn(
        async (_data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void> =>
          undefined
      );
      south.addContent = addContentMock;
      // rangeLow=0, rangeHigh=100 -> span=100; threshold=10% -> 10 absolute units
      readAllItemsResult = { Var1: 42, Var2: 25 };
      const overItem = buildItem('id1', 'Var1', 'DB1,REAL0', {
        cachingStrategy: 'threshold',
        thresholdType: 'percentage',
        threshold: 10,
        rangeLow: 0,
        rangeHigh: 100
      });
      const underItem = buildItem('id2', 'Var2', 'DB1,INT2', {
        cachingStrategy: 'threshold',
        thresholdType: 'percentage',
        threshold: 10,
        rangeLow: 0,
        rangeHigh: 100
      });
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
        () =>
          new Map([
            [
              'id1',
              {
                itemId: 'id1',
                groupId: null,
                queryTime: '2021-01-01T00:00:00.000Z',
                value: '20',
                trackedInstant: '2021-01-01T00:00:00.000Z'
              }
            ],
            [
              'id2',
              {
                itemId: 'id2',
                groupId: null,
                queryTime: '2021-01-01T00:00:00.000Z',
                value: '20',
                trackedInstant: '2021-01-01T00:00:00.000Z'
              }
            ]
          ])
      );

      await south.directQuery([overItem, underItem]);

      const content = addContentMock.mock.calls[0].arguments[0] as OIBusContent;
      assert.deepStrictEqual(content.content, [{ pointId: 'Var1', timestamp: testData.constants.dates.FAKE_NOW, data: { value: '42' } }]);
    });

    it('should cache when maxCachingInterval elapses even without a qualifying change', async () => {
      (south as unknown as Record<string, unknown>)['endpoint'] = { isConnected: true };
      const addContentMock = mock.fn(
        async (_data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void> =>
          undefined
      );
      south.addContent = addContentMock;
      readAllItemsResult = { Var1: 42 };
      const item = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'onChange', maxCachingInterval: 1000 });
      // previous cached value is identical (no onChange-qualifying diff), but 2h have elapsed since trackedInstant
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
        () =>
          new Map([
            [
              'id1',
              {
                itemId: 'id1',
                groupId: null,
                queryTime: '2020-12-31T22:00:00.000Z',
                value: '42',
                trackedInstant: '2020-12-31T22:00:00.000Z'
              }
            ]
          ])
      );

      await south.directQuery([item]);

      const content = addContentMock.mock.calls[0].arguments[0] as OIBusContent;
      assert.deepStrictEqual(content.content, [{ pointId: 'Var1', timestamp: testData.constants.dates.FAKE_NOW, data: { value: '42' } }]);
    });

    it('should always cache the very first read for an item regardless of strategy', async () => {
      (south as unknown as Record<string, unknown>)['endpoint'] = { isConnected: true };
      const addContentMock = mock.fn(
        async (_data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void> =>
          undefined
      );
      south.addContent = addContentMock;
      readAllItemsResult = { Var1: 42 };
      const item = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'onChange' });
      // getItemsLastValues default mock returns an empty Map (no prior cached state)

      await south.directQuery([item]);

      const content = addContentMock.mock.calls[0].arguments[0] as OIBusContent;
      assert.deepStrictEqual(content.content, [{ pointId: 'Var1', timestamp: testData.constants.dates.FAKE_NOW, data: { value: '42' } }]);
    });

    it('should call saveItemsLastValues with exactly the items actually cached in the cycle', async () => {
      (south as unknown as Record<string, unknown>)['endpoint'] = { isConnected: true };
      const addContentMock = mock.fn(
        async (_data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void> =>
          undefined
      );
      south.addContent = addContentMock;
      readAllItemsResult = { Var1: 42, Var2: 7 };
      const suppressedItem = buildItem('id1', 'Var1', 'DB1,REAL0', { cachingStrategy: 'onChange' });
      const cachedItem = buildItem('id2', 'Var2', 'DB1,INT2', { cachingStrategy: 'onChange' });
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(
        () =>
          new Map([
            [
              'id1',
              {
                itemId: 'id1',
                groupId: null,
                queryTime: '2021-01-01T00:00:00.000Z',
                value: '42',
                trackedInstant: '2021-01-01T00:00:00.000Z'
              }
            ],
            [
              'id2',
              {
                itemId: 'id2',
                groupId: null,
                queryTime: '2021-01-01T00:00:00.000Z',
                value: '1',
                trackedInstant: '2021-01-01T00:00:00.000Z'
              }
            ]
          ])
      );

      await south.directQuery([suppressedItem, cachedItem]);

      assert.deepStrictEqual((southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
        'southId',
        [{ itemId: 'id2', value: '7', instant: testData.constants.dates.FAKE_NOW }]
      ]);
    });
  });

  it('should disconnect and schedule reconnect on directQuery error when not disconnecting', async () => {
    nodes7Exports.S7ItemGroup = mock.fn(function () {
      throw new Error('read error');
    });
    (south as unknown as Record<string, unknown>)['endpoint'] = { isConnected: true };
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    south.addContent = mock.fn(async (): Promise<void> => undefined);

    await assert.rejects(south.directQuery(configuration.items), new Error('read error'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);

    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 1);
  });

  it('should disconnect but not schedule an additional reconnect on directQuery error when one is already pending', async () => {
    nodes7Exports.S7ItemGroup = mock.fn(function () {
      throw new Error('read error');
    });
    (south as unknown as Record<string, unknown>)['endpoint'] = { isConnected: true };
    (south as unknown as Record<string, unknown>)['reconnectTimeout'] = setTimeout(() => null, 1000);
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    south.addContent = mock.fn(async (): Promise<void> => undefined);

    await assert.rejects(south.directQuery(configuration.items), new Error('read error'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);

    nodes7Exports.S7Endpoint.mock.resetCalls();
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 0);
  });

  it('should disconnect but not schedule reconnect on directQuery error when disconnecting', async () => {
    nodes7Exports.S7ItemGroup = mock.fn(function () {
      throw new Error('read error');
    });
    (south as unknown as Record<string, unknown>)['endpoint'] = { isConnected: true };
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;
    const disconnectMock = mock.fn(async (): Promise<void> => undefined);
    south.disconnect = disconnectMock;
    south.addContent = mock.fn(async (): Promise<void> => undefined);

    await assert.rejects(south.directQuery(configuration.items), new Error('read error'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);

    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(nodes7Exports.S7Endpoint.mock.calls.length, 0);
  });

  it('should properly test connection', async () => {
    const result = await south.testConnection();
    assert.deepStrictEqual(result, {
      items: [{ key: 'RemoteAddress', value: `${configuration.settings.host}:${configuration.settings.port}` }]
    });
    assert.strictEqual(latestEndpoint.connect.mock.calls.length, 1);
    assert.strictEqual(latestEndpoint.disconnect.mock.calls.length, 1);
  });

  it('should properly manage error on test connection failure', async () => {
    const errorCases: Array<{ code: string; expected: string }> = [
      { code: 'ENOTFOUND', expected: 'Please check host and port' },
      { code: 'ECONNREFUSED', expected: 'Please check host and port' },
      { code: 'OTHER', expected: 'Unable to connect' }
    ];

    for (const { code, expected } of errorCases) {
      nodes7Exports.S7Endpoint = mock.fn(function () {
        const endpoint = new FakeS7Endpoint();
        endpoint.connect = mock.fn(async () => {
          throw new S7Error('boom', code);
        });
        return endpoint;
      });
      await assert.rejects(south.testConnection(), new Error(`${expected}: boom`));
    }
  });

  it('should properly test item', async () => {
    nodes7Exports.S7Endpoint = mock.fn(function () {
      latestEndpoint = new FakeS7Endpoint();
      latestEndpoint.connect = mock.fn(async () => {
        mock.timers.tick(15);
      });
      return latestEndpoint;
    });
    nodes7Exports.S7ItemGroup = mock.fn(function () {
      latestGroup = {
        setTranslationCB: mock.fn((cb: (name: string) => string | undefined) => {
          latestGroup.translationCB = cb;
        }),
        addItems: mock.fn((_names: string | Array<string>) => undefined),
        removeItems: mock.fn((_names: string | Array<string>) => undefined),
        readAllItems: mock.fn(async () => {
          mock.timers.tick(25);
          return readAllItemsResult;
        }),
        destroy: mock.fn(() => undefined),
        translationCB: null
      };
      return latestGroup;
    });

    const content = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    assert.strictEqual(content.result.type, 'time-values');
    assert.deepStrictEqual(content.result.content, [{ pointId: 'Var1', timestamp: '2021-01-02T00:00:00.040Z', data: { value: '42' } }]);
    assert.strictEqual(content.connectionDuration, 15);
    assert.strictEqual(content.queryDuration, 25);
    assert.strictEqual(latestGroup.translationCB!('Var1'), 'DB1,REAL0');
    assert.strictEqual(latestEndpoint.disconnect.mock.calls.length, 1);
  });

  it('should properly test connection even when the temporary endpoint disconnect fails', async () => {
    nodes7Exports.S7Endpoint = mock.fn(function () {
      const endpoint = new FakeS7Endpoint();
      endpoint.disconnect = mock.fn(async () => {
        throw new Error('disconnect error');
      });
      return endpoint;
    });

    const result = await south.testConnection();
    assert.deepStrictEqual(result, {
      items: [{ key: 'RemoteAddress', value: `${configuration.settings.host}:${configuration.settings.port}` }]
    });
    assert.strictEqual(latestEndpoint.disconnect.mock.calls.length, 1);
  });

  it('should properly test item even when the temporary endpoint disconnect fails', async () => {
    nodes7Exports.S7Endpoint = mock.fn(function () {
      const endpoint = new FakeS7Endpoint();
      endpoint.disconnect = mock.fn(async () => {
        throw new Error('disconnect error');
      });
      return endpoint;
    });

    const content = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    assert.strictEqual(content.result.type, 'time-values');
    assert.strictEqual(latestEndpoint.disconnect.mock.calls.length, 1);
  });

  it('should properly manage error on test item failure', async () => {
    const errorCases: Array<{ code: string; expected: string }> = [
      { code: 'ENOTFOUND', expected: 'Please check host and port' },
      { code: 'ECONNREFUSED', expected: 'Please check host and port' },
      { code: 'OTHER', expected: 'Unable to connect' }
    ];

    for (const { code, expected } of errorCases) {
      nodes7Exports.S7Endpoint = mock.fn(function () {
        const endpoint = new FakeS7Endpoint();
        endpoint.connect = mock.fn(async () => {
          throw new S7Error('boom', code);
        });
        return endpoint;
      });
      await assert.rejects(south.testItem(configuration.items[0], testData.south.itemTestingSettings), new Error(`${expected}: boom`));
    }
  });
});
