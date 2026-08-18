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
import type { SouthItemSettings, SouthPIItemSettings, SouthPISettings } from '../../../shared/model/south-settings.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type SouthPiClass from './south-pi';

const nodeRequire = createRequire(import.meta.url);

describe('South PI', () => {
  let SouthPi: typeof SouthPiClass;
  let south: SouthPiClass;

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

    SouthPi = reloadModule<{ default: typeof SouthPiClass }>(nodeRequire, './south-pi').default;
  });

  const configuration: SouthConnectorEntity<SouthPISettings, SouthPIItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'osisoft-pi',
    description: 'my test connector',
    enabled: true,
    settings: {
      agentUrl: 'http://localhost:2224',
      retryInterval: 1000
    },
    groups: [],
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: { type: 'point-id', piPoint: 'FACTORY.WORKSHOP.POINT.ID1' },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        startTimeOffset: 0,
        endTimeOffset: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: { type: 'point-query', piQuery: '*' },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        startTimeOffset: 0,
        endTimeOffset: null,
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
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthPi(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly connect to remote agent and disconnect', async () => {
    await south.connect();

    const connectCall = httpRequestExports.HTTPRequest.mock.calls[0];
    assertContains(connectCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/connect`
    });
    assert.deepStrictEqual(connectCall.arguments[1], {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });

    await south.disconnect();
    const disconnectCall = httpRequestExports.HTTPRequest.mock.calls[1];
    assertContains(disconnectCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/disconnect`
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
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/connect`
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
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 2);
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) =>
        (c.arguments[0] as string).includes('Error while sending disconnection HTTP request')
      )
    );
  });

  it('should test connection successfully using an isolated test session', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(200));
    const connectSpy = mock.method(south, 'connect');
    const disconnectSpy = mock.method(south, 'disconnect');

    await assert.doesNotReject(south.testConnection());

    // testConnection() must never call the connector's own live connect()/disconnect() lifecycle methods...
    assert.strictEqual(connectSpy.mock.calls.length, 0);
    assert.strictEqual(disconnectSpy.mock.calls.length, 0);
    // ...nor touch the connector's own connected flag.
    assert.strictEqual((south as unknown as Record<string, unknown>)['connected'], false);

    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 2);
    const [connectCall, disconnectCall] = httpRequestExports.HTTPRequest.mock.calls;
    assertContains(connectCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}-test/connect`
    });
    assertContains(disconnectCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}-test/disconnect`
    });
    assert.deepStrictEqual(disconnectCall.arguments[1], { method: 'DELETE' });
  });

  it('should test connection fail', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(400, 'bad request'));
    await assert.rejects(
      south.testConnection(),
      new Error('Error occurred when sending connect command to remote agent with status 400. bad request')
    );

    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(500, 'another error'));
    await assert.rejects(south.testConnection(), new Error('Error occurred when sending connect command to remote agent with status 500'));

    // Only the isolated test session was ever contacted, never the live one.
    assertContains(httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}-test/connect`
    });
  });

  it('should leave a live connection untouched by testConnection()', async () => {
    // Establish a real, live connection first.
    await south.connect();
    assert.strictEqual((south as unknown as Record<string, unknown>)['connected'], true);

    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => createMockResponse(200));

    await assert.doesNotReject(south.testConnection());

    // The live session survives: connected flag untouched, and none of testConnection's calls hit the live endpoints.
    assert.strictEqual((south as unknown as Record<string, unknown>)['connected'], true);
    for (const call of httpRequestExports.HTTPRequest.mock.calls) {
      const href = (call.arguments[0] as URL).href ?? String(call.arguments[0]);
      assert.ok(!href.endsWith(`/api/pi/${configuration.id}/connect`), `unexpected live connect call: ${href}`);
      assert.ok(!href.endsWith(`/api/pi/${configuration.id}/disconnect`), `unexpected live disconnect call: ${href}`);
      assert.ok(href.includes(`${configuration.id}-test`), `expected test-session call, got: ${href}`);
    }
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
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
          logs: ['log1', 'log2'],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        });
      if (callCount === 2)
        return createMockResponse(200, {
          recordCount: 1,
          content: [{ timestamp: '2020-02-01T00:00:00.000Z' }],
          logs: [],
          maxInstantRetrieved: '2020-02-01T00:00:00.000Z'
        });
      return createMockResponse(200, { recordCount: 0, content: [], logs: [], maxInstantRetrieved: '2020-03-01T00:00:00.000Z' });
    });

    const result = await south.historyQuery(configuration.items, startTime, endTime);

    const firstCall = httpRequestExports.HTTPRequest.mock.calls[0];
    assertContains(firstCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/read`
    });
    assert.deepStrictEqual(firstCall.arguments[1], {
      method: 'PUT',
      body: JSON.stringify({
        startTime,
        endTime,
        items: [
          { name: 'item1', type: 'pointId', piPoint: 'FACTORY.WORKSHOP.POINT.ID1' },
          { name: 'item2', type: 'pointQuery', piQuery: '*' }
        ]
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    assert.deepStrictEqual(result, {
      trackedInstant: '2020-03-01T00:00:00.000Z',
      value: { timestamp: '2020-03-01T00:00:00.000Z' }
    });
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], {
      type: 'time-values',
      content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
    });
    assert.strictEqual(addContentMock.mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [configuration.items[0], configuration.items[1]]);
    assert.ok(logger.warn.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[1] === 'log1'));
    assert.ok(logger.warn.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[1] === 'log2'));

    const resultNoUpdateInstant = await south.historyQuery(configuration.items, result!.trackedInstant!, endTime);
    assert.deepStrictEqual(resultNoUpdateInstant, {
      trackedInstant: null,
      value: { timestamp: '2020-02-01T00:00:00.000Z' }
    });

    const noResult = await south.historyQuery(configuration.items, startTime, endTime);
    assert.deepStrictEqual(noResult, { trackedInstant: null, value: null });
    assert.ok(
      logger.debug.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[1] === 'No result found. Request done in 0 ms')
    );
    assert.strictEqual(logger.warn.mock.calls.length, 2);
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

    await assert.rejects(
      south.historyQuery(configuration.items, startTime, endTime),
      new Error('Error occurred when querying remote agent with status 400: bad request')
    );
    await assert.rejects(
      south.historyQuery(configuration.items, startTime, endTime),
      new Error('Error occurred when querying remote agent with status 500')
    );
  });

  it('should manage fetch error on connect', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
      throw new Error('bad request');
    });

    await assert.rejects(south.historyQuery(configuration.items, startTime, endTime), new Error('bad request'));

    await south.start();
    await assert.rejects(south.historyQuery(configuration.items, startTime, endTime), new Error('bad request'));
  });

  it('should test item using an isolated test session, not the live connect/disconnect endpoints', async () => {
    let callCount = 0;
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) => {
      callCount++;
      // First call is connect (15 ms), second is read (25 ms), third is disconnect.
      mock.timers.tick(callCount === 1 ? 15 : callCount === 2 ? 25 : 0);
      return createMockResponse(200, {
        recordCount: 2,
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
        maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
      });
    });

    const connectSpy = mock.method(south, 'connect');
    const disconnectSpy = mock.method(south, 'disconnect');

    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        startTime,
        endTime,
        items: [
          {
            name: configuration.items[0].name,
            type: configuration.items[0].settings.type === 'point-id' ? 'pointId' : 'pointQuery',
            piPoint: configuration.items[0].settings.piPoint,
            piQuery: configuration.items[0].settings.piQuery
          }
        ]
      }),
      headers: { 'Content-Type': 'application/json' }
    };

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    // testItem() must never call the connector's own live connect()/disconnect() lifecycle methods...
    assert.strictEqual(connectSpy.mock.calls.length, 0);
    assert.strictEqual(disconnectSpy.mock.calls.length, 0);
    // ...nor touch the connector's own connected flag.
    assert.strictEqual((south as unknown as Record<string, unknown>)['connected'], false);

    // Every HTTP call must target the isolated `-test` session id, never the live one.
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 3);
    const [connectCall, readCall, disconnectCall] = httpRequestExports.HTTPRequest.mock.calls;
    assertContains(connectCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}-test/connect`
    });
    assert.deepStrictEqual(connectCall.arguments[1], {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    assertContains(readCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}-test/read`
    });
    assert.deepStrictEqual(readCall.arguments[1], fetchOptions);
    assertContains(disconnectCall.arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}-test/disconnect`
    });
    assert.deepStrictEqual(disconnectCall.arguments[1], { method: 'DELETE' });

    assert.strictEqual(result.connectionDuration, 15);
    assert.strictEqual(result.queryDuration, 25);

    await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
    assert.strictEqual(connectSpy.mock.calls.length, 0);
    assert.strictEqual(disconnectSpy.mock.calls.length, 0);
  });

  it('should test item and throw error if bad status, still disconnecting the test session only', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, options?: { method: string }) =>
      options?.method === 'DELETE' ? createMockResponse(200) : createMockResponse(400)
    );

    const connectSpy = mock.method(south, 'connect');
    const disconnectSpy = mock.method(south, 'disconnect');

    await assert.rejects(
      south.testItem(configuration.items[0], testData.south.itemTestingSettings),
      new Error('Error occurred when sending connect command to remote agent. 400')
    );

    // Even on failure, the live connect()/disconnect() lifecycle must never be invoked.
    assert.strictEqual(connectSpy.mock.calls.length, 0);
    assert.strictEqual(disconnectSpy.mock.calls.length, 0);
    assert.strictEqual((south as unknown as Record<string, unknown>)['connected'], false);

    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    assertContains(httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}-test/connect`
    });
    assertContains(httpRequestExports.HTTPRequest.mock.calls[1].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}-test/read`
    });
    assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[1].arguments[1], {
      method: 'PUT',
      body: JSON.stringify({
        startTime,
        endTime,
        items: [
          {
            name: configuration.items[0].name,
            type: configuration.items[0].settings.type === 'point-id' ? 'pointId' : 'pointQuery',
            piPoint: configuration.items[0].settings.piPoint,
            piQuery: configuration.items[0].settings.piQuery
          }
        ]
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    // The test session is still torn down even though the read failed.
    assertContains(httpRequestExports.HTTPRequest.mock.calls[2].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}-test/disconnect`
    });
    assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[2].arguments[1], { method: 'DELETE' });
  });

  it('should leave a live connection untouched by testItem()', async () => {
    // Establish a real, live connection first.
    await south.connect();
    assert.strictEqual((south as unknown as Record<string, unknown>)['connected'], true);
    const callsAfterConnect = httpRequestExports.HTTPRequest.mock.calls.length;

    httpRequestExports.HTTPRequest = mock.fn(async (_url: URL | string, _options?: unknown) =>
      createMockResponse(200, {
        recordCount: 1,
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }],
        maxInstantRetrieved: '2020-02-01T00:00:00.000Z'
      })
    );

    await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    // The live session survives: connected flag untouched, and none of testItem's calls hit the live endpoints.
    assert.strictEqual((south as unknown as Record<string, unknown>)['connected'], true);
    for (const call of httpRequestExports.HTTPRequest.mock.calls) {
      const href = (call.arguments[0] as URL).href ?? String(call.arguments[0]);
      assert.ok(!href.endsWith(`/api/pi/${configuration.id}/connect`), `unexpected live connect call: ${href}`);
      assert.ok(!href.endsWith(`/api/pi/${configuration.id}/disconnect`), `unexpected live disconnect call: ${href}`);
      assert.ok(href.includes(`${configuration.id}-test`), `expected test-session call, got: ${href}`);
    }
    assert.strictEqual(callsAfterConnect, 1);
  });
});
