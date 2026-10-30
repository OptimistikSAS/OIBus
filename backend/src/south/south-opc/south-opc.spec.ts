import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type { SouthOPCItemSettings, SouthOPCSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import testData from '../../tests/utils/test-data';
import { assertContains, createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthOpcClass from './south-opc';

const nodeRequire = createRequire(import.meta.url);

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
    agentUrl: 'http://localhost:2224',
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
  buildItem('id1', 'item1', { nodeId: 'ns=3;s=Random', aggregate: 'raw', resampling: 'none' }),
  buildItem('id2', 'item2', { nodeId: 'ns=3;s=Counter', aggregate: 'raw' }),
  buildItem('id3', 'item3', { nodeId: 'ns=3;s=Triangle', aggregate: 'average', resampling: '10s' }, { scanMode: testData.scanMode.list[1] })
]);

const testReadOptions = () => {
  const { startTime, endTime } = testData.south.itemTestingSettings.history!;
  return {
    method: 'PUT',
    body: JSON.stringify({
      host: configuration.settings.host,
      serverName: configuration.settings.serverName,
      mode: 'hda',
      aggregate: configuration.items[0].settings.aggregate,
      resampling: configuration.items[0].settings.resampling,
      startTime,
      endTime,
      items: [{ nodeId: configuration.items[0].settings.nodeId, name: configuration.items[0].name }]
    }),
    headers: { 'Content-Type': 'application/json' }
  };
};

describe('South OPC', () => {
  let SouthOpc: typeof SouthOpcClass;
  let south: SouthOpcClass;
  let logger: PinoLogger;
  let southCacheRepository: Mocked<SouthCacheRepository>;

  const createHttpRequestMocks = () => ({
    HTTPRequest: mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(200))
  });
  const httpRequestExports = createHttpRequestMocks();

  before(() => {
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
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
    southCacheRepository = createMock<SouthCacheRepository>({ getItemsLastValues: () => new Map() });
    Object.assign(httpRequestExports, createHttpRequestMocks());
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = createSouth();
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly connect to remote agent and disconnect', async () => {
    await south.connect();

    const connectCall = httpRequestExports.HTTPRequest.mock.calls[0];
    assertContains(connectCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}/connect`
    });
    assert.deepStrictEqual(connectCall.arguments[1], {
      method: 'PUT',
      body: JSON.stringify({ host: configuration.settings.host, serverName: configuration.settings.serverName, mode: 'hda' }),
      headers: { 'Content-Type': 'application/json' }
    });

    await south.disconnect();
    const disconnectCall = httpRequestExports.HTTPRequest.mock.calls[1];
    assertContains(disconnectCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}/disconnect`
    });
    assert.deepStrictEqual(disconnectCall.arguments[1], { method: 'DELETE' });
  });

  it('should properly reconnect when connection fails', async () => {
    httpRequestExports.HTTPRequest.mock.mockImplementationOnce(async () => {
      throw new Error('connection failed');
    });

    await south.connect();

    assertContains(httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}/connect`
    });
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);

    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 2);
  });

  it('should not reconnect when disconnecting', async () => {
    httpRequestExports.HTTPRequest.mock.mockImplementation(async () => {
      throw new Error('connection failed');
    });
    south['disconnecting'] = true;
    const disconnect = mock.method(south, 'disconnect', async () => undefined);

    await south.connect();

    assert.strictEqual(disconnect.mock.calls.length, 0);
    // no timer should be set — tick confirms no retry
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
  });

  it('should properly clear reconnect timeout on disconnect when not connected', async () => {
    httpRequestExports.HTTPRequest.mock.mockImplementation(async () => {
      throw new Error('connection failed');
    });

    await south.connect();
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);

    await south.disconnect();
    // After disconnect, timer should be cleared — advancing time must NOT trigger another call
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
    assert.ok(
      logger.error.mock.calls.some(
        c =>
          c.arguments[0].includes('Error while sending connection HTTP request') &&
          c.arguments[0].includes(`${configuration.settings.retryInterval} ms`)
      )
    );
  });

  it('should properly clear reconnect timeout on disconnect when connected', async () => {
    httpRequestExports.HTTPRequest.mock.mockImplementation(async () => {
      throw new Error('disconnection failed');
    });
    httpRequestExports.HTTPRequest.mock.mockImplementationOnce(async () => createMockResponse(200));

    await south.connect();
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);

    await south.disconnect();
    // disconnect sends its own request (which fails), no clearTimeout path taken
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 2);
    assert.ok(logger.error.mock.calls.some(c => c.arguments[0].includes('Error while sending disconnection HTTP request')));
  });

  it('should test connection successfully', async () => {
    await assert.doesNotReject(south.testConnection());
  });

  it('should test connection fail', async () => {
    httpRequestExports.HTTPRequest.mock.mockImplementation(async () => createMockResponse(400, 'bad request'));
    await assert.rejects(
      south.testConnection(),
      new Error('Error occurred when sending connect command to remote agent with status 400. bad request')
    );

    httpRequestExports.HTTPRequest.mock.mockImplementation(async () => createMockResponse(500, 'another error'));
    await assert.rejects(south.testConnection(), new Error('Error occurred when sending connect command to remote agent with status 500'));
  });

  it('should get data from Remote agent', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const addContent = mock.method(south, 'addContent', async () => undefined);
    httpRequestExports.HTTPRequest.mock.mockImplementation(async () =>
      createMockResponse(200, {
        recordCount: 1,
        content: [{ pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', data: { value: 10 } }],
        maxInstantRetrieved: '2020-02-01T00:00:00.000Z'
      })
    );
    httpRequestExports.HTTPRequest.mock.mockImplementationOnce(
      async () =>
        createMockResponse(200, {
          recordCount: 2,
          // pointId joins each value back to its item (via the name-keyed map built from
          // resampledItems) so the caching-strategy filtering step can look up the item's own
          // strategy/last-cached state before addContent.
          content: [
            { pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', data: { value: 10 } },
            { pointId: 'item2', timestamp: '2020-03-01T00:00:00.000Z', data: { value: 20 } }
          ],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        }),
      0
    );
    httpRequestExports.HTTPRequest.mock.mockImplementationOnce(
      async () => createMockResponse(200, { recordCount: 0, content: [], maxInstantRetrieved: '2020-03-01T00:00:00.000Z' }),
      1
    );

    const result = await south.historyQuery(configuration.items, startTime, endTime);

    const firstCall = httpRequestExports.HTTPRequest.mock.calls[0];
    assertContains(firstCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}/read`
    });
    assert.deepStrictEqual(firstCall.arguments[1], {
      method: 'PUT',
      body: JSON.stringify({
        host: configuration.settings.host,
        serverName: configuration.settings.serverName,
        mode: 'hda',
        maxReadValues: 3600,
        intervalReadDelay: 200,
        aggregate: 'raw',
        resampling: 'none',
        startTime,
        endTime,
        items: [
          { name: 'item1', nodeId: 'ns=3;s=Random' },
          { name: 'item2', nodeId: 'ns=3;s=Counter' }
        ]
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const thirdGroupCall = httpRequestExports.HTTPRequest.mock.calls[1];
    assert.deepStrictEqual(JSON.parse((thirdGroupCall.arguments[1] as { body: string }).body).items, [
      { name: 'item3', nodeId: 'ns=3;s=Triangle' }
    ]);

    assert.deepStrictEqual(result, {
      trackedInstant: '2020-03-01T00:00:00.001Z',
      value: { content: [], maxInstantRetrieved: '2020-03-01T00:00:00.000Z', recordCount: 0 }
    });
    assert.strictEqual(addContent.mock.calls.length, 1);
    assert.deepStrictEqual(addContent.mock.calls[0].arguments, [
      {
        type: 'record-list',
        content: [
          { pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', value: 10 },
          { pointId: 'item2', timestamp: '2020-03-01T00:00:00.000Z', value: 20 }
        ]
      },
      testData.constants.dates.FAKE_NOW,
      [configuration.items[0], configuration.items[1]]
    ]);
    assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
      { itemId: 'id1', value: 10, instant: '2020-02-01T00:00:00.000Z' },
      { itemId: 'id2', value: 20, instant: '2020-03-01T00:00:00.000Z' }
    ]);

    assert.ok(logger.debug.mock.calls.some(c => c.arguments[1] === 'No result found. Request done in 0 ms'));

    const noUpdateInstant = await south.historyQuery([configuration.items[0]], result!.trackedInstant!, endTime);
    assert.deepStrictEqual(noUpdateInstant, {
      trackedInstant: null,
      value: {
        content: [{ pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', data: { value: 10 } }],
        maxInstantRetrieved: '2020-02-01T00:00:00.000Z',
        recordCount: 1
      }
    });
  });

  describe('caching strategy filtering', () => {
    const buildCachedItem = (id: string, name: string, overrides: Partial<SouthConnectorItemEntity<SouthOPCItemSettings>>) =>
      buildItem(id, name, { nodeId: 'ns=3;s=Random', aggregate: 'raw', resampling: 'none' }, overrides);

    /** What SouthCacheRepository.getItemsLastValues returns for items cached at 2020-01-01T00:00:00.000Z with the given values. */
    const lastValues = (...entries: Array<[itemId: string, value: unknown]>) =>
      new Map(entries.map(([itemId, value]) => [itemId, { value, trackedInstant: '2020-01-01T00:00:00.000Z' }]));

    const mockSingleValueResponse = (pointId: string, value: number, timestamp: string) => {
      httpRequestExports.HTTPRequest.mock.mockImplementation(async () =>
        createMockResponse(200, { recordCount: 1, content: [{ pointId, timestamp, data: { value } }], maxInstantRetrieved: timestamp })
      );
    };

    it('suppresses a no-change value under the onChange strategy', async () => {
      const item = buildCachedItem('id1', 'item1', { cachingStrategy: 'onChange' });
      south = createSouth(buildConfiguration([item]));
      const addContent = mock.method(south, 'addContent', async () => undefined);
      southCacheRepository.getItemsLastValues.mock.mockImplementationOnce(() => lastValues(['id1', 10]));

      mockSingleValueResponse('item1', 10, '2020-01-01T00:01:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.strictEqual(addContent.mock.calls.length, 1);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], { type: 'record-list', content: [] });
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], []);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], []);
    });

    it('caches a threshold-exceeding change under the threshold (absolute) strategy', async () => {
      const item = buildCachedItem('id1', 'item1', { cachingStrategy: 'threshold', thresholdType: 'absolute', threshold: 5 });
      south = createSouth(buildConfiguration([item]));
      const addContent = mock.method(south, 'addContent', async () => undefined);
      southCacheRepository.getItemsLastValues.mock.mockImplementationOnce(() => lastValues(['id1', 10]));

      // |20 - 10| = 10 > 5 → cached
      mockSingleValueResponse('item1', 20, '2020-01-01T00:01:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.strictEqual(addContent.mock.calls.length, 1);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], {
        type: 'record-list',
        content: [{ pointId: 'item1', timestamp: '2020-01-01T00:01:00.000Z', value: 20 }]
      });
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [item]);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
        { itemId: 'id1', value: 20, instant: '2020-01-01T00:01:00.000Z' }
      ]);
    });

    it('computes the threshold (percentage-of-span) strategy correctly', async () => {
      // rangeLow=0, rangeHigh=100 → span=100; threshold=10 (%) → 10% of span = 10
      const item = buildCachedItem('id1', 'item1', {
        cachingStrategy: 'threshold',
        thresholdType: 'percentage',
        threshold: 10,
        rangeLow: 0,
        rangeHigh: 100
      });
      south = createSouth(buildConfiguration([item]));
      const addContent = mock.method(south, 'addContent', async () => undefined);

      // |15 - 10| = 5, not > 10 → suppressed
      southCacheRepository.getItemsLastValues.mock.mockImplementationOnce(() => lastValues(['id1', 10]));
      mockSingleValueResponse('item1', 15, '2020-01-01T00:01:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], []);

      // |25 - 10| = 15 > 10 → cached
      southCacheRepository.getItemsLastValues.mock.mockImplementationOnce(() => lastValues(['id1', 10]));
      mockSingleValueResponse('item1', 25, '2020-01-01T00:02:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:01:00.000Z', '2022-01-01T00:00:00.000Z');
      assert.deepStrictEqual(addContent.mock.calls[1].arguments[0], {
        type: 'record-list',
        content: [{ pointId: 'item1', timestamp: '2020-01-01T00:02:00.000Z', value: 25 }]
      });
      assert.deepStrictEqual(addContent.mock.calls[1].arguments[2], [item]);
    });

    it('caches on maxCachingInterval heartbeat even without a qualifying change', async () => {
      const item = buildCachedItem('id1', 'item1', { cachingStrategy: 'onChange', maxCachingInterval: 1000 });
      south = createSouth(buildConfiguration([item]));
      const addContent = mock.method(south, 'addContent', async () => undefined);
      // Same value as previous, but 2000ms have elapsed (> maxCachingInterval of 1000ms)
      southCacheRepository.getItemsLastValues.mock.mockImplementationOnce(() => lastValues(['id1', 10]));

      mockSingleValueResponse('item1', 10, '2020-01-01T00:00:02.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [item]);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
        { itemId: 'id1', value: 10, instant: '2020-01-01T00:00:02.000Z' }
      ]);
    });

    it('always caches the very first read for an item, regardless of strategy', async () => {
      const item = buildCachedItem('id1', 'item1', { cachingStrategy: 'onChange' });
      south = createSouth(buildConfiguration([item]));
      const addContent = mock.method(south, 'addContent', async () => undefined);
      // No prior cached state for this item: getItemsLastValues returns an empty Map by default

      mockSingleValueResponse('item1', 10, '2020-01-01T00:00:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [item]);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
        { itemId: 'id1', value: 10, instant: '2020-01-01T00:00:00.000Z' }
      ]);
    });

    it('calls saveItemsLastValues with exactly the cached subset, excluding suppressed items', async () => {
      const cachedItem = buildCachedItem('id1', 'item1', { cachingStrategy: 'onChange' });
      const suppressedItem = buildCachedItem('id2', 'item2', { cachingStrategy: 'onChange' });
      const config = buildConfiguration([cachedItem, suppressedItem]);
      south = createSouth(config);
      const addContent = mock.method(south, 'addContent', async () => undefined);

      southCacheRepository.getItemsLastValues.mock.mockImplementationOnce(() => lastValues(['id1', 1], ['id2', 2]));
      httpRequestExports.HTTPRequest.mock.mockImplementation(async () =>
        createMockResponse(200, {
          recordCount: 2,
          content: [
            { pointId: 'item1', timestamp: '2020-01-01T00:01:00.000Z', data: { value: 99 } }, // changed → cached
            { pointId: 'item2', timestamp: '2020-01-01T00:01:00.000Z', data: { value: 2 } } // unchanged → suppressed
          ],
          maxInstantRetrieved: '2020-01-01T00:01:00.000Z'
        })
      );

      await south.historyQuery(config.items, '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [cachedItem]);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
        { itemId: 'id1', value: 99, instant: '2020-01-01T00:01:00.000Z' }
      ]);
    });
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    httpRequestExports.HTTPRequest.mock.mockImplementation(async () => createMockResponse(500));
    httpRequestExports.HTTPRequest.mock.mockImplementationOnce(async () => createMockResponse(400, 'bad request'));
    mock.method(south, 'disconnect', async () => undefined);
    const connect = mock.method(south, 'connect', async () => undefined);

    await assert.rejects(
      south.historyQuery(configuration.items, startTime, endTime),
      new Error('Error occurred when querying remote agent with status 400: bad request')
    );
    assert.strictEqual(connect.mock.calls.length, 1);

    south['disconnecting'] = true;
    await assert.rejects(
      south.historyQuery(configuration.items, startTime, endTime),
      new Error('Error occurred when querying remote agent with status 500')
    );
    // no reconnection while disconnecting
    assert.strictEqual(connect.mock.calls.length, 1);
  });

  it('should manage fetch error', async () => {
    httpRequestExports.HTTPRequest.mock.mockImplementation(async () => {
      throw new Error('bad request');
    });

    await assert.rejects(
      south.historyQuery(configuration.items, '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
      new Error('bad request')
    );
  });

  it('should test item', async () => {
    httpRequestExports.HTTPRequest.mock.mockImplementation(async () => {
      mock.timers.tick(25);
      return createMockResponse(200, {
        recordCount: 2,
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
        maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
      });
    });

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    const testCall = httpRequestExports.HTTPRequest.mock.calls[0];
    assertContains(testCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}-test/read`
    });
    assert.deepStrictEqual(testCall.arguments[1], testReadOptions());
    assert.strictEqual(result.queryDuration, 25);
    assert.strictEqual(result.connectionDuration, 0);
  });

  it('should test item and throw error if bad status', async () => {
    httpRequestExports.HTTPRequest.mock.mockImplementation(async () => createMockResponse(400));

    await assert.rejects(
      south.testItem(configuration.items[0], testData.south.itemTestingSettings),
      new Error('Error occurred when sending connect command to remote agent. 400')
    );

    const testCall = httpRequestExports.HTTPRequest.mock.calls[0];
    assertContains(testCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}-test/read`
    });
    assert.deepStrictEqual(testCall.arguments[1], testReadOptions());
  });
});
