import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type { OpcConnection, OpcHdaReadOptions, OpcRawValue, OpcServerInfo } from '@oibus/opc-classic';

import type { SouthOPCItemSettings, SouthOPCSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthOpcClass from './south-opc';

const nodeRequire = createRequire(import.meta.url);

const SERVER_INFO: OpcServerInfo = { vendorInfo: 'Matrikon Inc', productVersion: '1.9.8629', serverState: 'running' };

const buildItem = (
  id: string,
  name: string,
  settings: SouthOPCItemSettings,
  overrides: Partial<SouthConnectorItemEntity<SouthOPCItemSettings>> = {}
): SouthConnectorItemEntity<SouthOPCItemSettings> => ({
  id,
  name,
  description: null,
  enabled: true,
  settings,
  scanMode: testData.scanMode.list[0],
  group: null,
  syncWithGroup: false,
  maxReadInterval: 3600,
  readDelay: 0,
  startTimeOffset: 0,
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

const buildConfiguration = (
  items: Array<SouthConnectorItemEntity<SouthOPCItemSettings>>
): SouthConnectorEntity<SouthOPCSettings, SouthOPCItemSettings> => ({
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
  items,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

const configuration = buildConfiguration([
  buildItem('id1', 'item1', { nodeId: 'Random.Int1', aggregate: 'raw', resampling: 'none' }),
  buildItem('id2', 'item2', { nodeId: 'Random.Int2', aggregate: 'raw' }),
  buildItem('id3', 'item3', { nodeId: 'Triangle.Real8', aggregate: 'average', resampling: '10s' }, { scanMode: testData.scanMode.list[1] })
]);

const rawValue = (nodeId: string, timestamp: string, value: string): OpcRawValue => ({ nodeId, timestamp, value, quality: '0xC0' });

describe('South OPC', () => {
  let SouthOpc: typeof SouthOpcClass;
  let south: SouthOpcClass;
  let logger: PinoLogger;
  let southCacheRepository: Mocked<SouthCacheRepository>;
  // Every connection opened through the mocked package, in order: the live one and the isolated test ones
  let connections: Array<Mocked<OpcConnection>>;

  const createConnection = (read: (...args: Array<unknown>) => Promise<Array<OpcRawValue>> = async () => []) => {
    const connection = createMock<OpcConnection>({
      serverInfo: SERVER_INFO,
      read: read as (
        startTime: string,
        endTime: string,
        nodeIds: Array<string>,
        options?: OpcHdaReadOptions
      ) => Promise<Array<OpcRawValue>>,
      disconnect: async () => undefined
    });
    connections.push(connection);
    return connection;
  };
  const createOpcClassicMocks = () => ({
    OpcConnection: { connect: mock.fn(async (_host: string, _serverName: string, _mode: string) => createConnection()) }
  });
  const opcClassicExports = createOpcClassicMocks();
  const latestConnection = () => connections.at(-1)!;

  before(() => {
    mockModule(nodeRequire, '@oibus/opc-classic', opcClassicExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthOpc = reloadModule<{ default: typeof SouthOpcClass }>(nodeRequire, './south-opc').default;
  });

  const createSouth = (southConfiguration = configuration) =>
    new SouthOpc(
      southConfiguration,
      mock.fn(async () => undefined),
      southCacheRepository,
      'cacheFolder'
    );

  beforeEach(() => {
    logger = new PinoLogger();
    connections = [];
    southCacheRepository = createMock<SouthCacheRepository>({ getItemsLastValues: () => new Map() });
    Object.assign(opcClassicExports, createOpcClassicMocks());
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = createSouth();
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should connect to the OPC server and disconnect', async () => {
    await south.connect();
    assert.deepStrictEqual(opcClassicExports.OpcConnection.connect.mock.calls[0].arguments, [
      'localhost',
      'Matrikon.OPC.Simulation',
      'hda'
    ]);
    assert.ok(logger.info.mock.calls.some(c => c.arguments[0].includes('Connected to the OPC server Matrikon Inc (v1.9.8629)')));

    await south.disconnect();
    assert.strictEqual(latestConnection().disconnect.mock.calls.length, 1);
  });

  it('should reconnect after the retry interval when the connection fails', async () => {
    opcClassicExports.OpcConnection.connect.mock.mockImplementation(async () => {
      throw new Error('connection failed');
    });

    await south.connect();
    assert.strictEqual(opcClassicExports.OpcConnection.connect.mock.calls.length, 1);
    assert.ok(
      logger.error.mock.calls.some(
        c =>
          c.arguments[0].includes('Error while connecting to the OPC server') &&
          c.arguments[0].includes(`${configuration.settings.retryInterval} ms`)
      )
    );

    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(opcClassicExports.OpcConnection.connect.mock.calls.length, 2);
  });

  it('should not reconnect when disconnecting', async () => {
    opcClassicExports.OpcConnection.connect.mock.mockImplementation(async () => {
      throw new Error('connection failed');
    });
    south['disconnecting'] = true;
    const disconnect = mock.method(south, 'disconnect', async () => undefined);

    await south.connect();

    assert.strictEqual(disconnect.mock.calls.length, 0);
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(opcClassicExports.OpcConnection.connect.mock.calls.length, 1);
  });

  it('should clear the reconnect timeout on disconnect when not connected', async () => {
    opcClassicExports.OpcConnection.connect.mock.mockImplementation(async () => {
      throw new Error('connection failed');
    });

    await south.connect();
    await south.disconnect();

    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(opcClassicExports.OpcConnection.connect.mock.calls.length, 1);
  });

  it('should log a disconnection failure without scheduling a reconnection', async () => {
    await south.connect();
    latestConnection().disconnect.mock.mockImplementation(async () => {
      throw new Error('disconnection failed');
    });

    await south.disconnect();

    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(opcClassicExports.OpcConnection.connect.mock.calls.length, 1);
    assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'Error while disconnecting from the OPC server: disconnection failed'));
  });

  it('should test the connection with an isolated connection and return the server info', async () => {
    await south.connect();
    const liveConnection = latestConnection();

    const result = await south.testConnection();

    assert.deepStrictEqual(result, {
      items: [
        { key: 'Vendor', value: 'Matrikon Inc' },
        { key: 'Version', value: '1.9.8629' },
        { key: 'State', value: 'running' }
      ]
    });
    assert.strictEqual(south['connection'], liveConnection);
    assert.strictEqual(liveConnection.disconnect.mock.calls.length, 0);
    assert.strictEqual(connections.length, 2);
    assert.strictEqual(connections[1].disconnect.mock.calls.length, 1);
  });

  it('should propagate a connection failure from testConnection', async () => {
    opcClassicExports.OpcConnection.connect.mock.mockImplementation(async () => {
      throw new Error('Class not registered');
    });
    await assert.rejects(south.testConnection(), new Error('Class not registered'));
  });

  it('should throw from historyQuery when not connected', async () => {
    await assert.rejects(
      south.historyQuery(configuration.items, '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
      new Error('OPC server is not connected')
    );
  });

  it('should read the items grouped by aggregate and resampling, tracking the max instant of all groups', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    await south.connect();
    const connection = latestConnection();
    connection.read.mock.mockImplementationOnce(
      async () => [rawValue('Random.Int1', '2020-02-01T00:00:00.000Z', '1'), rawValue('Random.Int2', '2020-03-01T00:00:00.000Z', '2')],
      0
    );
    // A later timestamp in the second group: the tracked instant is the max of all groups
    connection.read.mock.mockImplementationOnce(async () => [rawValue('Triangle.Real8', '2020-04-01T00:00:00.000Z', '3')], 1);
    const addContent = mock.method(south, 'addContent', async () => undefined);

    const result = await south.historyQuery(configuration.items, startTime, endTime);

    assert.deepStrictEqual(
      connection.read.mock.calls.map(c => c.arguments),
      [
        [
          startTime,
          endTime,
          ['Random.Int1', 'Random.Int2'],
          { aggregate: 'raw', resampling: 'none', maxReadValues: 3600, intervalReadDelay: 200 }
        ],
        [startTime, endTime, ['Triangle.Real8'], { aggregate: 'average', resampling: '10s', maxReadValues: 3600, intervalReadDelay: 200 }]
      ]
    );
    assert.deepStrictEqual(result, {
      trackedInstant: '2020-04-01T00:00:00.001Z',
      value: { pointId: 'item3', timestamp: '2020-04-01T00:00:00.000Z', value: '3', quality: '0xC0' }
    });
    assert.deepStrictEqual(
      addContent.mock.calls.map(c => c.arguments),
      [
        [
          {
            type: 'record-list',
            content: [
              { pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', value: '1', quality: '0xC0' },
              { pointId: 'item2', timestamp: '2020-03-01T00:00:00.000Z', value: '2', quality: '0xC0' }
            ]
          },
          testData.constants.dates.FAKE_NOW,
          [configuration.items[0], configuration.items[1]]
        ],
        [
          { type: 'record-list', content: [{ pointId: 'item3', timestamp: '2020-04-01T00:00:00.000Z', value: '3', quality: '0xC0' }] },
          testData.constants.dates.FAKE_NOW,
          [configuration.items[2]]
        ]
      ]
    );
  });

  it('should return a null tracked instant when no value is found', async () => {
    await south.connect();
    const addContent = mock.method(south, 'addContent', async () => undefined);

    const result = await south.historyQuery(configuration.items, '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

    assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    assert.strictEqual(addContent.mock.calls.length, 0);
    assert.ok(logger.debug.mock.calls.some(c => c.arguments[1] === 'No result found. Request done in 0 ms'));
  });

  describe('caching strategy filtering', () => {
    const buildCachedItem = (id: string, name: string, overrides: Partial<SouthConnectorItemEntity<SouthOPCItemSettings>>) =>
      buildItem(id, name, { nodeId: `node-${id}`, aggregate: 'raw', resampling: 'none' }, overrides);

    /** What SouthCacheRepository.getItemsLastValues returns for items cached at 2020-01-01T00:00:00.000Z with the given values. */
    const lastValues = (...entries: Array<[itemId: string, value: unknown]>) =>
      new Map(entries.map(([itemId, value]) => [itemId, { value, trackedInstant: '2020-01-01T00:00:00.000Z' }]));

    const connectWith = async (items: Array<SouthConnectorItemEntity<SouthOPCItemSettings>>, ...values: Array<OpcRawValue>) => {
      south = createSouth(buildConfiguration(items));
      await south.connect();
      latestConnection().read.mock.mockImplementation(async () => values);
      return mock.method(south, 'addContent', async () => undefined);
    };

    it('suppresses a no-change value under the onChange strategy', async () => {
      const item = buildCachedItem('id1', 'item1', { cachingStrategy: 'onChange' });
      southCacheRepository.getItemsLastValues.mock.mockImplementationOnce(() => lastValues(['id1', '10']));
      const addContent = await connectWith([item], rawValue('node-id1', '2020-01-01T00:01:00.000Z', '10'));

      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], { type: 'record-list', content: [] });
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], []);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], []);
    });

    it('caches a threshold-exceeding change under the threshold (absolute) strategy', async () => {
      const item = buildCachedItem('id1', 'item1', { cachingStrategy: 'threshold', thresholdType: 'absolute', threshold: 5 });
      southCacheRepository.getItemsLastValues.mock.mockImplementationOnce(() => lastValues(['id1', '10']));
      // |20 - 10| = 10 > 5 → cached
      const addContent = await connectWith([item], rawValue('node-id1', '2020-01-01T00:01:00.000Z', '20'));

      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], {
        type: 'record-list',
        content: [{ pointId: 'item1', timestamp: '2020-01-01T00:01:00.000Z', value: '20', quality: '0xC0' }]
      });
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [item]);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
        { itemId: 'id1', value: '20', instant: '2020-01-01T00:01:00.000Z' }
      ]);
    });

    it('caches on maxCachingInterval heartbeat even without a qualifying change', async () => {
      const item = buildCachedItem('id1', 'item1', { cachingStrategy: 'onChange', maxCachingInterval: 1000 });
      // Same value as previous, but 2000ms have elapsed (> maxCachingInterval of 1000ms)
      southCacheRepository.getItemsLastValues.mock.mockImplementationOnce(() => lastValues(['id1', '10']));
      const addContent = await connectWith([item], rawValue('node-id1', '2020-01-01T00:00:02.000Z', '10'));

      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [item]);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
        { itemId: 'id1', value: '10', instant: '2020-01-01T00:00:02.000Z' }
      ]);
    });

    it('always caches the very first read for an item, regardless of strategy', async () => {
      const item = buildCachedItem('id1', 'item1', { cachingStrategy: 'onChange' });
      const addContent = await connectWith([item], rawValue('node-id1', '2020-01-01T00:00:00.000Z', '10'));

      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [item]);
    });

    it('calls saveItemsLastValues with exactly the cached subset, excluding suppressed items', async () => {
      const cachedItem = buildCachedItem('id1', 'item1', { cachingStrategy: 'onChange' });
      const suppressedItem = buildCachedItem('id2', 'item2', { cachingStrategy: 'onChange' });
      southCacheRepository.getItemsLastValues.mock.mockImplementationOnce(() => lastValues(['id1', '1'], ['id2', '2']));
      const addContent = await connectWith(
        [cachedItem, suppressedItem],
        rawValue('node-id1', '2020-01-01T00:01:00.000Z', '99'), // changed → cached
        rawValue('node-id2', '2020-01-01T00:01:00.000Z', '2') // unchanged → suppressed
      );

      await south.historyQuery([cachedItem, suppressedItem], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [cachedItem]);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
        { itemId: 'id1', value: '99', instant: '2020-01-01T00:01:00.000Z' }
      ]);
    });
  });

  it('should log, reconnect and rethrow on a query error', async () => {
    await south.connect();
    latestConnection().read.mock.mockImplementation(async () => {
      throw new Error('OPC RPC broken');
    });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    const connect = mock.method(south, 'connect', async () => undefined);

    await assert.rejects(
      south.historyQuery(configuration.items, '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
      new Error('OPC RPC broken')
    );

    assert.strictEqual(disconnect.mock.calls.length, 1);
    assert.strictEqual(connect.mock.calls.length, 1);
    assert.ok(logger.error.mock.calls.some(c => c.arguments[1] === 'Error while querying the OPC server: OPC RPC broken'));
  });

  it('should not reconnect after a query error while disconnecting', async () => {
    await south.connect();
    latestConnection().read.mock.mockImplementation(async () => {
      throw new Error('OPC RPC broken');
    });
    mock.method(south, 'disconnect', async () => undefined);
    const connect = mock.method(south, 'connect', async () => undefined);
    south['disconnecting'] = true;

    await assert.rejects(
      south.historyQuery(configuration.items, '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
      new Error('OPC RPC broken')
    );

    assert.strictEqual(connect.mock.calls.length, 0);
  });

  it('should test an item with an isolated connection, measuring the connection and the query separately', async () => {
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    opcClassicExports.OpcConnection.connect.mock.mockImplementation(async () => {
      mock.timers.tick(10);
      return createConnection(async () => {
        mock.timers.tick(25);
        return [rawValue('Random.Int1', '2020-02-01T00:00:00.000Z', '1')];
      });
    });

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    const connection = latestConnection();
    assert.deepStrictEqual(connection.read.mock.calls[0].arguments, [
      startTime,
      endTime,
      ['Random.Int1'],
      { aggregate: 'raw', resampling: 'none', maxReadValues: 3600, intervalReadDelay: 200 }
    ]);
    assert.strictEqual(connection.disconnect.mock.calls.length, 1);
    assert.deepStrictEqual(result, {
      result: { type: 'record-list', content: [{ pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', value: '1', quality: '0xC0' }] },
      connectionDuration: 10,
      queryDuration: 25
    });
  });

  it('should disconnect the isolated connection when testing an item fails', async () => {
    opcClassicExports.OpcConnection.connect.mock.mockImplementation(async () =>
      createConnection(async () => {
        throw new Error('bad node id');
      })
    );

    await assert.rejects(south.testItem(configuration.items[0], testData.south.itemTestingSettings), new Error('bad node id'));
    assert.strictEqual(latestConnection().disconnect.mock.calls.length, 1);
  });

  it('should leave the live connection untouched when testing an item', async () => {
    await south.connect();
    const liveConnection = latestConnection();

    await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    assert.strictEqual(south['connection'], liveConnection);
    assert.strictEqual(liveConnection.read.mock.calls.length, 0);
    assert.strictEqual(liveConnection.disconnect.mock.calls.length, 0);
  });
});
