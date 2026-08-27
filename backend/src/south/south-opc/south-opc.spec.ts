import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, assertContains } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { SouthItemSettings, SouthOPCItemSettings, SouthOPCSettings } from '../../../shared/model/south-settings.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type SouthOpcClass from './south-opc';

const nodeRequire = createRequire(import.meta.url);

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

  const httpRequestExports = {
    HTTPRequest: mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(200))
  };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
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
      agentUrl: 'http://localhost:2224',
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
        updatedAt: ''
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: { nodeId: 'ns=3;s=Counter', aggregate: 'raw' },
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
        settings: { nodeId: 'ns=3;s=Triangle', aggregate: 'average', resampling: '10s' },
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
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(200));
    addContentCallback.mock.resetCalls();
    (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.resetCalls();
    (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(() => new Map());
    (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.resetCalls();
    (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementation(() => undefined);
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthOpc(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
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
    let callCount = 0;
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
      callCount++;
      if (callCount === 1) throw new Error('connection failed');
      return createMockResponse(200);
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
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
      throw new Error('connection failed');
    });
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;
    const disconnectMock1 = mock.fn(async () => undefined);
    south.disconnect = disconnectMock1;

    await south.connect();

    assert.strictEqual(disconnectMock1.mock.calls.length, 0);
    // no timer should be set — tick confirms no retry
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
  });

  it('should properly clear reconnect timeout on disconnect when not connected', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
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
        (c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes('Error while sending connection HTTP request') &&
          (c.arguments[0] as string).includes(`${configuration.settings.retryInterval} ms`)
      )
    );
  });

  it('should properly clear reconnect timeout on disconnect when connected', async () => {
    let callCount = 0;
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
      callCount++;
      if (callCount === 1) return createMockResponse(200);
      throw new Error('disconnection failed');
    });

    await south.connect();
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);

    await south.disconnect();
    // disconnect sends its own request (which fails), no clearTimeout path taken
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 2);
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('Error while sending disconnection HTTP request')
      )
    );
  });

  it('should test connection successfully', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(200));
    await assert.doesNotReject(south.testConnection());
  });

  it('should test connection fail', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(400, 'bad request'));
    await assert.rejects(
      south.testConnection(),
      new Error('Error occurred when sending connect command to remote agent with status 400. bad request')
    );

    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(500, 'another error'));
    await assert.rejects(south.testConnection(), new Error('Error occurred when sending connect command to remote agent with status 500'));
  });

  it('should get data from Remote agent', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const addContentMock = mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );
    let callCount = 0;
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
      callCount++;
      if (callCount === 1)
        return createMockResponse(200, {
          recordCount: 2,
          // pointId joins each value back to its item (via the name-keyed map built from
          // resampledItems) so the caching-strategy filtering step can look up the item's own
          // strategy/last-cached state before addContent.
          content: [
            { pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', data: { value: 10 } },
            { pointId: 'item2', timestamp: '2020-03-01T00:00:00.000Z', data: { value: 20 } }
          ],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        });
      if (callCount === 2) return createMockResponse(200, { recordCount: 0, content: [], maxInstantRetrieved: '2020-03-01T00:00:00.000Z' });
      return createMockResponse(200, {
        recordCount: 1,
        content: [{ pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', data: { value: 10 } }],
        maxInstantRetrieved: '2020-02-01T00:00:00.000Z'
      });
    });

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
    assert.strictEqual(addContentMock.mock.calls.length, 1);
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], {
      type: 'time-values',
      content: [
        { pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', data: { value: 10 } },
        { pointId: 'item2', timestamp: '2020-03-01T00:00:00.000Z', data: { value: 20 } }
      ]
    });
    assert.strictEqual(addContentMock.mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [configuration.items[0], configuration.items[1]]);
    assert.deepStrictEqual(
      (southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1],
      [
        { itemId: 'id1', value: 10, instant: '2020-02-01T00:00:00.000Z' },
        { itemId: 'id2', value: 20, instant: '2020-03-01T00:00:00.000Z' }
      ]
    );

    assert.ok(
      logger.debug.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[1] === 'No result found. Request done in 0 ms')
    );

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

    const mockSingleValueResponse = (pointId: string, value: number, timestamp: string) => {
      httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) =>
        createMockResponse(200, {
          recordCount: 1,
          content: [{ pointId, timestamp, data: { value } }],
          maxInstantRetrieved: timestamp
        })
      );
    };

    it('suppresses a no-change value under the onChange strategy', async () => {
      const item = buildItem({ id: 'id1', name: 'item1', cachingStrategy: 'onChange' });
      south = new SouthOpc(singleItemConfiguration(item), addContentCallback, southCacheRepository, 'cacheFolder');
      const addContentMock = mock.method(south, 'addContent', mock.fn(async () => undefined));
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(
        () => new Map([['id1', { itemId: 'id1', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 10, trackedInstant: '2020-01-01T00:00:00.000Z' }]])
      );

      mockSingleValueResponse('item1', 10, '2020-01-01T00:01:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.strictEqual(addContentMock.mock.calls.length, 1);
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], { type: 'time-values', content: [] });
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], []);
      assert.deepStrictEqual((southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1], []);
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
      const addContentMock = mock.method(south, 'addContent', mock.fn(async () => undefined));
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(
        () => new Map([['id1', { itemId: 'id1', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 10, trackedInstant: '2020-01-01T00:00:00.000Z' }]])
      );

      // |20 - 10| = 10 > 5 → cached
      mockSingleValueResponse('item1', 20, '2020-01-01T00:01:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.strictEqual(addContentMock.mock.calls.length, 1);
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], {
        type: 'time-values',
        content: [{ pointId: 'item1', timestamp: '2020-01-01T00:01:00.000Z', data: { value: 20 } }]
      });
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [item]);
      assert.deepStrictEqual((southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1], [
        { itemId: 'id1', value: 20, instant: '2020-01-01T00:01:00.000Z' }
      ]);
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
      const addContentMock = mock.method(south, 'addContent', mock.fn(async () => undefined));

      // |15 - 10| = 5, not > 10 → suppressed
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(
        () => new Map([['id1', { itemId: 'id1', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 10, trackedInstant: '2020-01-01T00:00:00.000Z' }]])
      );
      mockSingleValueResponse('item1', 15, '2020-01-01T00:01:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');
      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], []);

      // |25 - 10| = 15 > 10 → cached
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(
        () => new Map([['id1', { itemId: 'id1', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 10, trackedInstant: '2020-01-01T00:00:00.000Z' }]])
      );
      mockSingleValueResponse('item1', 25, '2020-01-01T00:02:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:01:00.000Z', '2022-01-01T00:00:00.000Z');
      assert.deepStrictEqual(addContentMock.mock.calls[1].arguments[0], {
        type: 'time-values',
        content: [{ pointId: 'item1', timestamp: '2020-01-01T00:02:00.000Z', data: { value: 25 } }]
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
      const addContentMock = mock.method(south, 'addContent', mock.fn(async () => undefined));
      // Same value as previous, but 2000ms have elapsed (> maxCachingInterval of 1000ms)
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(
        () => new Map([['id1', { itemId: 'id1', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 10, trackedInstant: '2020-01-01T00:00:00.000Z' }]])
      );

      mockSingleValueResponse('item1', 10, '2020-01-01T00:00:02.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [item]);
      assert.deepStrictEqual((southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1], [
        { itemId: 'id1', value: 10, instant: '2020-01-01T00:00:02.000Z' }
      ]);
    });

    it('always caches the very first read for an item, regardless of strategy', async () => {
      const item = buildItem({ id: 'id1', name: 'item1', cachingStrategy: 'onChange' });
      south = new SouthOpc(singleItemConfiguration(item), addContentCallback, southCacheRepository, 'cacheFolder');
      const addContentMock = mock.method(south, 'addContent', mock.fn(async () => undefined));
      // No prior cached state for this item
      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(() => new Map());

      mockSingleValueResponse('item1', 10, '2020-01-01T00:00:00.000Z');
      await south.historyQuery([item], '2020-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [item]);
      assert.deepStrictEqual((southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1], [
        { itemId: 'id1', value: 10, instant: '2020-01-01T00:00:00.000Z' }
      ]);
    });

    it('calls saveItemsLastValues with exactly the cached subset, excluding suppressed items', async () => {
      const cachedItem = buildItem({ id: 'id1', name: 'item1', cachingStrategy: 'onChange' });
      const suppressedItem = buildItem({ id: 'id2', name: 'item2', cachingStrategy: 'onChange' });
      const config = singleItemConfiguration(cachedItem);
      config.items = [cachedItem, suppressedItem];
      south = new SouthOpc(config, addContentCallback, southCacheRepository, 'cacheFolder');
      const addContentMock = mock.method(south, 'addContent', mock.fn(async () => undefined));

      (southCacheRepository.getItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.mockImplementationOnce(
        () =>
          new Map([
            ['id1', { itemId: 'id1', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 1, trackedInstant: '2020-01-01T00:00:00.000Z' }],
            ['id2', { itemId: 'id2', groupId: null, queryTime: '2020-01-01T00:00:00.000Z', value: 2, trackedInstant: '2020-01-01T00:00:00.000Z' }]
          ])
      );
      httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) =>
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

      assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [cachedItem]);
      assert.deepStrictEqual((southCacheRepository.saveItemsLastValues as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[1], [
        { itemId: 'id1', value: 99, instant: '2020-01-01T00:01:00.000Z' }
      ]);
    });
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    let callCount = 0;
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
      callCount++;
      if (callCount === 1) return createMockResponse(400, 'bad request');
      return createMockResponse(500);
    });
    south.disconnect = mock.fn(async () => undefined);
    const connectMock = mock.fn(async () => undefined);
    south.connect = connectMock;

    await assert.rejects(
      south.historyQuery(configuration.items, startTime, endTime),
      new Error('Error occurred when querying remote agent with status 400: bad request')
    );

    connectMock.mock.resetCalls();
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;
    await assert.rejects(
      south.historyQuery(configuration.items, startTime, endTime),
      new Error('Error occurred when querying remote agent with status 500')
    );
    assert.strictEqual(connectMock.mock.calls.length, 0);
  });

  it('should manage fetch error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
      throw new Error('bad request');
    });

    await assert.rejects(south.historyQuery(configuration.items, startTime, endTime), new Error('bad request'));
  });

  it('should test item', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
      mock.timers.tick(25);
      return createMockResponse(200, {
        recordCount: 2,
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
        maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
      });
    });

    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    const fetchOptions = {
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

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    const testCall = httpRequestExports.HTTPRequest.mock.calls[0];
    assertContains(testCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}-test/read`
    });
    assert.deepStrictEqual(testCall.arguments[1], fetchOptions);
    assert.strictEqual(result.queryDuration, 25);
    assert.strictEqual(result.connectionDuration, 0);
  });

  it('should test item and throw error if bad status', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(400));

    await assert.rejects(
      south.testItem(configuration.items[0], testData.south.itemTestingSettings),
      new Error('Error occurred when sending connect command to remote agent. 400')
    );

    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    const testCall = httpRequestExports.HTTPRequest.mock.calls[0];
    assertContains(testCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/opc/${configuration.id}-test/read`
    });
    assert.deepStrictEqual(testCall.arguments[1], {
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
    });
  });
});
