import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { SouthItemSettings, SouthOPCItemSettings, SouthOPCSettings } from '../../../shared/model/south-settings.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type SouthOpcClass from './south-opc';
import type { OpcHdaReadOptions, OpcRawValue, OpcServerInfo } from '@oibus/opc-classic';

const nodeRequire = createRequire(import.meta.url);

const FAKE_SERVER_INFO: OpcServerInfo = { vendorInfo: 'Matrikon Inc', productVersion: '1.9.8629', serverState: 'running' };

/**
 * Stands in for the real `@oibus/opc-classic` package (which spawns a native child process)
 * — south-opc.ts's own behavior is what's under test here, not the package's process-management or
 * multi-connection concurrency logic, which has its own dedicated spec in that package's own repo
 * (https://github.com/OptimistikSAS/opc-classic).
 */
class FakeOpcConnection {
  static instances: Array<FakeOpcConnection> = [];
  static connectMock = mock.fn(async (_host: string, _serverName: string, _mode: string): Promise<FakeOpcConnection> => {
    const instance = new FakeOpcConnection();
    FakeOpcConnection.instances.push(instance);
    return instance;
  });

  serverInfo: OpcServerInfo = FAKE_SERVER_INFO;
  read = mock.fn(
    async (_startTime: string, _endTime: string, _nodeIds: Array<string>, _options?: OpcHdaReadOptions): Promise<Array<OpcRawValue>> => []
  );
  disconnect = mock.fn(async () => undefined);

  static connect(host: string, serverName: string, mode: string): Promise<FakeOpcConnection> {
    return FakeOpcConnection.connectMock(host, serverName, mode);
  }

  static latest(): FakeOpcConnection {
    return FakeOpcConnection.instances[FakeOpcConnection.instances.length - 1];
  }
}

describe('South OPC', () => {
  let SouthOpc: typeof SouthOpcClass;
  let south: SouthOpcClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(
    async (_southId: string, _data: OIBusContent, _queryTime: string, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>) =>
      undefined
  );
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;

  const utilsExports = {
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => []),
    groupItemsByGroup: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' })),
    getErrorMessage: mock.fn((error: unknown) => {
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
        return (error as { message: string }).message;
      }
      return String(error);
    }),
    // Mirrors the real implementation in service/utils.ts — kept in sync manually since it's a
    // handful of lines and some tests assert the exact { itemId/itemName } / { groupId/groupName } shape.
    workUnitLogCtx: mock.fn((items: Array<{ id: string; name: string; group?: { id: string; name: string } | null }>) => {
      if (items.length === 0) return {};
      if (items.length === 1) return { itemId: items[0].id, itemName: items[0].name };
      const lead = items[0];
      return lead.group ? { groupId: lead.group.id, groupName: lead.group.name } : {};
    })
  };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '@oibus/opc-classic', { OpcConnection: FakeOpcConnection });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });

    SouthOpc = reloadModule<{ default: typeof SouthOpcClass }>(nodeRequire, './south-opc').default;
  });

  const configuration: SouthConnectorEntity<SouthOPCSettings, SouthOPCItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'opc',
    description: 'my test connector',
    enabled: true,
    settings: {
      retryInterval: 1000,
      host: 'localhost',
      serverName: 'Matrikon.OPC.Simulation',
      mode: 'hda'
    },
    groups: [],
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: { nodeId: 'Random.Int1', aggregate: 'raw', resampling: 'none' },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        startTimeOffset: 0,
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
        name: 'item2',
        enabled: true,
        settings: { nodeId: 'Random.Int2', aggregate: 'raw' },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        startTimeOffset: 0,
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
        name: 'item3',
        enabled: true,
        settings: { nodeId: 'Triangle.Real8', aggregate: 'average', resampling: '10s' },
        scanMode: testData.scanMode.list[1],
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        startTimeOffset: 0,
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
    FakeOpcConnection.instances = [];
    FakeOpcConnection.connectMock = mock.fn(async () => {
      const instance = new FakeOpcConnection();
      FakeOpcConnection.instances.push(instance);
      return instance;
    });
    addContentCallback.mock.resetCalls();
    (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.resetCalls();
    (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(() => new Map());
    (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.resetCalls();
    (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(() => undefined);
    for (const fn of [logger.trace, logger.debug, logger.info, logger.warn, logger.error]) {
      fn.mock.resetCalls();
    }
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthOpc(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('connects and disconnects the live connection', async () => {
    await south.connect();
    assert.strictEqual(FakeOpcConnection.connectMock.mock.calls.length, 1);
    assert.deepStrictEqual(FakeOpcConnection.connectMock.mock.calls[0].arguments, ['localhost', 'Matrikon.OPC.Simulation', 'hda']);
    const connection = FakeOpcConnection.latest();

    await south.disconnect();
    assert.strictEqual(connection.disconnect.mock.calls.length, 1);
  });

  it('reconnects after retryInterval when the connection fails', async () => {
    let callCount = 0;
    FakeOpcConnection.connectMock = mock.fn(async () => {
      callCount++;
      throw new Error('connection failed');
    });

    await south.connect();
    assert.strictEqual(callCount, 1);

    mock.timers.tick(configuration.settings.retryInterval);
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(callCount, 2);
  });

  it('does not reconnect when disconnecting', async () => {
    FakeOpcConnection.connectMock = mock.fn(async () => {
      throw new Error('connection failed');
    });
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;
    const disconnectMock1 = mock.fn(async () => undefined);
    south.disconnect = disconnectMock1;

    await south.connect();

    assert.strictEqual(disconnectMock1.mock.calls.length, 0);
    mock.timers.tick(configuration.settings.retryInterval);
    await Promise.resolve();
    assert.strictEqual(FakeOpcConnection.connectMock.mock.calls.length, 1);
  });

  it('clears the reconnect timeout on disconnect when never connected', async () => {
    FakeOpcConnection.connectMock = mock.fn(async () => {
      throw new Error('connection failed');
    });

    await south.connect();
    assert.strictEqual(FakeOpcConnection.connectMock.mock.calls.length, 1);

    await south.disconnect();
    mock.timers.tick(configuration.settings.retryInterval);
    await Promise.resolve();
    assert.strictEqual(FakeOpcConnection.connectMock.mock.calls.length, 1, 'no reconnect attempt after disconnect cleared the timer');
    assert.ok(
      logger.error.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes('Error while connecting to the OPC server') &&
          (c.arguments[0] as string).includes(`${configuration.settings.retryInterval} ms`)
      )
    );
  });

  it('clears the reconnect timeout on disconnect when connected, logging a disconnect failure', async () => {
    await south.connect();
    const connection = FakeOpcConnection.latest();
    connection.disconnect = mock.fn(async () => {
      throw new Error('disconnection failed');
    });

    await south.disconnect();
    mock.timers.tick(configuration.settings.retryInterval);
    await Promise.resolve();
    assert.strictEqual(FakeOpcConnection.connectMock.mock.calls.length, 1, 'no reconnect attempt scheduled by an explicit disconnect');
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('Error while disconnecting from the OPC server')
      )
    );
  });

  it('uses an isolated connection for testConnection, never the live one', async () => {
    await south.connect();
    const liveConnection = FakeOpcConnection.latest();

    await assert.doesNotReject(south.testConnection());

    assert.strictEqual((south as unknown as Record<string, unknown>)['connection'], liveConnection);
    assert.strictEqual(liveConnection.disconnect.mock.calls.length, 0);
    assert.strictEqual(FakeOpcConnection.instances.length, 2);
    assert.strictEqual(FakeOpcConnection.instances[1].disconnect.mock.calls.length, 1);
  });

  it('returns OPC server info from testConnection', async () => {
    const result = await south.testConnection();

    assert.deepStrictEqual(result, {
      items: [
        { key: 'Vendor', value: FAKE_SERVER_INFO.vendorInfo },
        { key: 'Version', value: FAKE_SERVER_INFO.productVersion },
        { key: 'State', value: FAKE_SERVER_INFO.serverState }
      ]
    });
  });

  it('propagates a connection failure from testConnection', async () => {
    FakeOpcConnection.connectMock = mock.fn(async () => {
      throw new Error('Class not registered');
    });
    await assert.rejects(south.testConnection(), { message: 'Class not registered' });
  });

  it('throws from historyQuery when not connected', async () => {
    await assert.rejects(south.historyQuery(configuration.items, '2020-01-01', '2020-01-02'), {
      message: 'OPC server is not connected'
    });
  });

  it('groups items by aggregate/resampling into separate read calls, tracking the max instant across groups', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    await south.connect();
    const connection = FakeOpcConnection.latest();
    const addContentMock = mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );

    let callCount = 0;
    connection.read = mock.fn(async () => {
      callCount++;
      if (callCount === 1) {
        // Group 1: item1 + item2 (raw/none)
        return [
          { nodeId: 'Random.Int1', timestamp: '2020-02-01T00:00:00.000Z', value: '1', quality: '0xC0' },
          { nodeId: 'Random.Int2', timestamp: '2020-03-01T00:00:00.000Z', value: '2', quality: '0xC0' }
        ];
      }
      // Group 2: item3 (average/10s) — a later timestamp than group 1's, to verify the tracked
      // instant is the true max across both groups, not just whichever group ran last.
      return [{ nodeId: 'Triangle.Real8', timestamp: '2020-04-01T00:00:00.000Z', value: '3', quality: '0xC0' }];
    });

    const result = await south.historyQuery(configuration.items, startTime, endTime);

    assert.strictEqual(connection.read.mock.calls.length, 2);
    assert.deepStrictEqual(connection.read.mock.calls[0].arguments, [
      startTime,
      endTime,
      ['Random.Int1', 'Random.Int2'],
      { aggregate: 'raw', resampling: 'none', maxReadValues: 3600, intervalReadDelay: 200 }
    ]);
    assert.deepStrictEqual(connection.read.mock.calls[1].arguments, [
      startTime,
      endTime,
      ['Triangle.Real8'],
      { aggregate: 'average', resampling: '10s', maxReadValues: 3600, intervalReadDelay: 200 }
    ]);

    assert.deepStrictEqual(result, {
      trackedInstant: '2020-04-01T00:00:00.001Z',
      value: { pointId: 'item3', timestamp: '2020-04-01T00:00:00.000Z', data: { value: '3', quality: '0xC0' } }
    });
    assert.strictEqual(addContentMock.mock.calls.length, 2);
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], {
      type: 'time-values',
      content: [
        { pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', data: { value: '1', quality: '0xC0' } },
        { pointId: 'item2', timestamp: '2020-03-01T00:00:00.000Z', data: { value: '2', quality: '0xC0' } }
      ]
    });
    assert.deepStrictEqual(addContentMock.mock.calls[1].arguments[0], {
      type: 'time-values',
      content: [{ pointId: 'item3', timestamp: '2020-04-01T00:00:00.000Z', data: { value: '3', quality: '0xC0' } }]
    });
    assert.deepStrictEqual(addContentMock.mock.calls[1].arguments[2], [configuration.items[2]]);
  });

  it('logs and returns null trackedInstant when no records are found', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    await south.connect();
    const connection = FakeOpcConnection.latest();
    connection.read = mock.fn(async () => []);

    const result = await south.historyQuery(configuration.items, startTime, endTime);

    assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) => typeof c.arguments[1] === 'string' && c.arguments[1].includes('No result found')
      )
    );
  });

  describe('caching strategy filtering', () => {
    const buildItem = (
      overrides: Partial<SouthConnectorItemEntity<SouthOPCItemSettings>>
    ): SouthConnectorItemEntity<SouthOPCItemSettings> => ({
      id: 'itemId',
      name: 'itemName',
      enabled: true,
      settings: { nodeId: 'ns=3;s=Random', aggregate: 'raw', resampling: 'none' },
      scanMode: testData.scanMode.list[0],
      group: null,
      syncWithGroup: false,
      maxReadInterval: 3600,
      readDelay: 0,
      startTimeOffset: 0,
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

    const singleItemConfiguration = (
      item: SouthConnectorItemEntity<SouthOPCItemSettings>
    ): SouthConnectorEntity<SouthOPCSettings, SouthOPCItemSettings> => ({
      ...configuration,
      items: [item]
    });

    // Mocks the live connection's next read() call to return a single raw value for the given
    // nodeId — the connection-based equivalent of the old HTTP-agent's mocked response.
    const mockSingleValueResponse = (connection: FakeOpcConnection, value: number, timestamp: string, nodeId = 'ns=3;s=Random') => {
      connection.read = mock.fn(async () => [{ nodeId, timestamp, value, quality: '0xC0' }]);
    };

    it('suppresses a no-change value under the onChange strategy', async () => {
      const item = buildItem({ id: 'id1', name: 'item1', cachingStrategy: 'onChange' });
      south = new SouthOpc(singleItemConfiguration(item), addContentCallback, southCacheRepository, 'cacheFolder');
      await south.connect();
      const connection = FakeOpcConnection.latest();
      const addContentMock = mock.method(
        south,
        'addContent',
        mock.fn(async () => undefined)
      );
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(
        () =>
          new Map([
            [
              'id1',
              { itemId: 'id1', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 10, trackedInstant: '2020-01-01T00:00:00.000Z' }
            ]
          ])
      );

      mockSingleValueResponse(connection, 10, '2020-01-01T00:01:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.strictEqual(addContentMock.mock.calls.length, 1);
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], { type: 'time-values', content: [] });
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], []);
      assert.deepStrictEqual(
        (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1],
        []
      );
    });

    it('caches a threshold-exceeding change under the threshold (absolute) strategy', async () => {
      const item = buildItem({
        id: 'id1',
        name: 'item1',
        cachingStrategy: 'threshold',
        thresholdType: 'absolute',
        threshold: 5
      });
      south = new SouthOpc(singleItemConfiguration(item), addContentCallback, southCacheRepository, 'cacheFolder');
      await south.connect();
      const connection = FakeOpcConnection.latest();
      const addContentMock = mock.method(
        south,
        'addContent',
        mock.fn(async () => undefined)
      );
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(
        () =>
          new Map([
            [
              'id1',
              { itemId: 'id1', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 10, trackedInstant: '2020-01-01T00:00:00.000Z' }
            ]
          ])
      );

      // |20 - 10| = 10 > 5 → cached
      mockSingleValueResponse(connection, 20, '2020-01-01T00:01:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.strictEqual(addContentMock.mock.calls.length, 1);
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], {
        type: 'time-values',
        content: [{ pointId: 'item1', timestamp: '2020-01-01T00:01:00.000Z', data: { value: 20, quality: '0xC0' } }]
      });
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [item]);
      assert.deepStrictEqual(
        (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1],
        [{ itemId: 'id1', value: 20, instant: '2020-01-01T00:01:00.000Z' }]
      );
    });

    it('computes the threshold (percentage-of-span) strategy correctly', async () => {
      // rangeLow=0, rangeHigh=100 → span=100; threshold=10 (%) → 10% of span = 10
      const item = buildItem({
        id: 'id1',
        name: 'item1',
        cachingStrategy: 'threshold',
        thresholdType: 'percentage',
        threshold: 10,
        rangeLow: 0,
        rangeHigh: 100
      });
      south = new SouthOpc(singleItemConfiguration(item), addContentCallback, southCacheRepository, 'cacheFolder');
      await south.connect();
      const connection = FakeOpcConnection.latest();
      const addContentMock = mock.method(
        south,
        'addContent',
        mock.fn(async () => undefined)
      );

      // |15 - 10| = 5, not > 10 → suppressed
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(
        () =>
          new Map([
            [
              'id1',
              { itemId: 'id1', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 10, trackedInstant: '2020-01-01T00:00:00.000Z' }
            ]
          ])
      );
      mockSingleValueResponse(connection, 15, '2020-01-01T00:01:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], []);

      // |25 - 10| = 15 > 10 → cached
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(
        () =>
          new Map([
            [
              'id1',
              { itemId: 'id1', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 10, trackedInstant: '2020-01-01T00:00:00.000Z' }
            ]
          ])
      );
      mockSingleValueResponse(connection, 25, '2020-01-01T00:02:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:01:00.000Z', '2022-01-01T00:00:00.000Z');
      assert.deepStrictEqual(addContentMock.mock.calls[1].arguments[0], {
        type: 'time-values',
        content: [{ pointId: 'item1', timestamp: '2020-01-01T00:02:00.000Z', data: { value: 25, quality: '0xC0' } }]
      });
      assert.deepStrictEqual(addContentMock.mock.calls[1].arguments[2], [item]);
    });

    it('caches on maxCachingInterval heartbeat even without a qualifying change', async () => {
      const item = buildItem({
        id: 'id1',
        name: 'item1',
        cachingStrategy: 'onChange',
        maxCachingInterval: 1000
      });
      south = new SouthOpc(singleItemConfiguration(item), addContentCallback, southCacheRepository, 'cacheFolder');
      await south.connect();
      const connection = FakeOpcConnection.latest();
      const addContentMock = mock.method(
        south,
        'addContent',
        mock.fn(async () => undefined)
      );
      // Same value as previous, but 2000ms have elapsed (> maxCachingInterval of 1000ms)
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(
        () =>
          new Map([
            [
              'id1',
              { itemId: 'id1', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 10, trackedInstant: '2020-01-01T00:00:00.000Z' }
            ]
          ])
      );

      mockSingleValueResponse(connection, 10, '2020-01-01T00:00:02.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [item]);
      assert.deepStrictEqual(
        (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1],
        [{ itemId: 'id1', value: 10, instant: '2020-01-01T00:00:02.000Z' }]
      );
    });

    it('always caches the very first read for an item, regardless of strategy', async () => {
      const item = buildItem({ id: 'id1', name: 'item1', cachingStrategy: 'onChange' });
      south = new SouthOpc(singleItemConfiguration(item), addContentCallback, southCacheRepository, 'cacheFolder');
      await south.connect();
      const connection = FakeOpcConnection.latest();
      const addContentMock = mock.method(
        south,
        'addContent',
        mock.fn(async () => undefined)
      );
      // No prior cached state for this item
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(() => new Map());

      mockSingleValueResponse(connection, 10, '2020-01-01T00:00:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [item]);
      assert.deepStrictEqual(
        (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1],
        [{ itemId: 'id1', value: 10, instant: '2020-01-01T00:00:00.000Z' }]
      );
    });

    it('calls saveItemsLastValues with exactly the cached subset, excluding suppressed items', async () => {
      // Distinct nodeIds: toTimeValues joins each raw value back to an item by nodeId, so two items
      // sharing one nodeId (buildItem's default) would collapse into a single lookup entry.
      const cachedItem = buildItem({
        id: 'id1',
        name: 'item1',
        cachingStrategy: 'onChange',
        settings: { nodeId: 'node1', aggregate: 'raw', resampling: 'none' }
      });
      const suppressedItem = buildItem({
        id: 'id2',
        name: 'item2',
        cachingStrategy: 'onChange',
        settings: { nodeId: 'node2', aggregate: 'raw', resampling: 'none' }
      });
      const config = singleItemConfiguration(cachedItem);
      config.items = [cachedItem, suppressedItem];
      south = new SouthOpc(config, addContentCallback, southCacheRepository, 'cacheFolder');
      await south.connect();
      const connection = FakeOpcConnection.latest();
      const addContentMock = mock.method(
        south,
        'addContent',
        mock.fn(async () => undefined)
      );

      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(
        () =>
          new Map([
            [
              'id1',
              { itemId: 'id1', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 1, trackedInstant: '2020-01-01T00:00:00.000Z' }
            ],
            [
              'id2',
              { itemId: 'id2', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 2, trackedInstant: '2020-01-01T00:00:00.000Z' }
            ]
          ])
      );
      connection.read = mock.fn(async () => [
        { nodeId: 'node1', timestamp: '2020-01-01T00:01:00.000Z', value: 99, quality: '0xC0' }, // changed → cached
        { nodeId: 'node2', timestamp: '2020-01-01T00:01:00.000Z', value: 2, quality: '0xC0' } // unchanged → suppressed
      ]);

      await south.historyQuery(config.items, '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [cachedItem]);
      assert.deepStrictEqual(
        (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1],
        [{ itemId: 'id1', value: 99, instant: '2020-01-01T00:01:00.000Z' }]
      );
    });
  });

  it('forces a reconnect and rethrows on a query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    await south.connect();
    const connection = FakeOpcConnection.latest();
    connection.read = mock.fn(async () => {
      throw new Error('OPC RPC broken');
    });
    const disconnectMock = mock.fn(async () => undefined);
    south.disconnect = disconnectMock;
    const connectMock = mock.fn(async () => undefined);
    south.connect = connectMock;

    await assert.rejects(south.historyQuery(configuration.items, startTime, endTime), { message: 'OPC RPC broken' });

    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.strictEqual(connectMock.mock.calls.length, 1);
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[1] as string).includes('Error while querying the OPC server: OPC RPC broken')
      )
    );
  });

  it('does not reconnect after a query error while disconnecting', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    await south.connect();
    const connection = FakeOpcConnection.latest();
    connection.read = mock.fn(async () => {
      throw new Error('OPC RPC broken');
    });
    south.disconnect = mock.fn(async () => undefined);
    const connectMock = mock.fn(async () => undefined);
    south.connect = connectMock;
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;

    await assert.rejects(south.historyQuery(configuration.items, startTime, endTime), { message: 'OPC RPC broken' });

    assert.strictEqual(connectMock.mock.calls.length, 0);
  });

  it('tests an item through an isolated connection, measuring connect and query durations separately', async () => {
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;

    FakeOpcConnection.connectMock = mock.fn(async () => {
      mock.timers.tick(10);
      const instance = new FakeOpcConnection();
      instance.read = mock.fn(async () => {
        mock.timers.tick(25);
        return [{ nodeId: 'Random.Int1', timestamp: '2020-02-01T00:00:00.000Z', value: '1', quality: '0xC0' }];
      });
      FakeOpcConnection.instances.push(instance);
      return instance;
    });

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    const connection = FakeOpcConnection.latest();

    assert.strictEqual(connection.read.mock.calls.length, 1);
    assert.deepStrictEqual(connection.read.mock.calls[0].arguments, [
      startTime,
      endTime,
      ['Random.Int1'],
      { aggregate: 'raw', resampling: 'none', maxReadValues: 3600, intervalReadDelay: 200 }
    ]);
    assert.strictEqual(connection.disconnect.mock.calls.length, 1);
    assert.deepStrictEqual(result.result, {
      type: 'time-values',
      content: [{ pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', data: { value: '1', quality: '0xC0' } }]
    });
    assert.strictEqual(result.connectionDuration, 10);
    assert.strictEqual(result.queryDuration, 25);
  });

  it('still disconnects the isolated connection when the read fails', async () => {
    FakeOpcConnection.connectMock = mock.fn(async () => {
      const instance = new FakeOpcConnection();
      instance.read = mock.fn(async () => {
        throw new Error('bad node id');
      });
      FakeOpcConnection.instances.push(instance);
      return instance;
    });

    await assert.rejects(south.testItem(configuration.items[0], testData.south.itemTestingSettings), { message: 'bad node id' });
    assert.strictEqual(FakeOpcConnection.latest().disconnect.mock.calls.length, 1);
  });

  it('leaves a live connection untouched by testItem()', async () => {
    await south.connect();
    const liveConnection = FakeOpcConnection.latest();

    await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    assert.strictEqual((south as unknown as Record<string, unknown>)['connection'], liveConnection);
    assert.strictEqual(liveConnection.read.mock.calls.length, 0);
    assert.strictEqual(liveConnection.disconnect.mock.calls.length, 0);
  });
});
