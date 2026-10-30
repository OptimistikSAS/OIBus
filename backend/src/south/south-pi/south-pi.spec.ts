import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type { SouthItemSettings, SouthPIItemSettings, SouthPISettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { ReqOptions, ReqResponse, ReqURL } from '../../service/http-request.utils';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import testData from '../../tests/utils/test-data';
import { assertContains, createMock, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthPiClass from './south-pi';

const nodeRequire = createRequire(import.meta.url);

type HTTPRequestFn = (url: ReqURL, options?: ReqOptions) => Promise<ReqResponse>;

const buildItem = (id: string, settings: SouthPIItemSettings): SouthConnectorItemEntity<SouthPIItemSettings> => ({
  id,
  name: id.replace('id', 'item'),
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
  cachingStrategy: null,
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
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
    buildItem('id1', { type: 'point-id', piPoint: 'FACTORY.WORKSHOP.POINT.ID1' }),
    buildItem('id2', { type: 'point-query', piQuery: '*' })
  ],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

const agentEndpoint = (endpoint: string) => `${configuration.settings.agentUrl}/api/pi/${configuration.id}/${endpoint}`;
const testSessionEndpoint = (endpoint: string) => `${configuration.settings.agentUrl}/api/pi/${configuration.id}-test/${endpoint}`;

// The read request sent for the first item, as testItem() builds it
const itemTestReadOptions = () => {
  const { startTime, endTime } = testData.south.itemTestingSettings.history!;
  const item = configuration.items[0];
  return {
    method: 'PUT',
    body: JSON.stringify({
      startTime,
      endTime,
      items: [
        {
          name: item.name,
          type: item.settings.type === 'point-id' ? 'pointId' : 'pointQuery',
          piPoint: item.settings.piPoint,
          piQuery: item.settings.piQuery
        }
      ]
    }),
    headers: { 'Content-Type': 'application/json' }
  };
};

describe('South PI', () => {
  let SouthPi: typeof SouthPiClass;
  let south: SouthPiClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  let HTTPRequest: Mock<HTTPRequestFn>;

  const httpRequestExports: Record<string, unknown> = {};
  // Replaces HTTPRequest by a fresh mock (empty call history) with the given implementation
  const mockHTTPRequest = (implementation: HTTPRequestFn = async () => createMockResponse(200)) => {
    HTTPRequest = mock.fn(implementation);
    httpRequestExports.HTTPRequest = HTTPRequest;
  };

  before(() => {
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthPi = reloadModule<{ default: typeof SouthPiClass }>(nodeRequire, './south-pi').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    mockHTTPRequest();
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthPi(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly connect to remote agent and disconnect', async () => {
    await south.connect();

    const connectCall = HTTPRequest.mock.calls[0];
    assertContains(connectCall.arguments[0], { href: agentEndpoint('connect') });
    assert.deepStrictEqual(connectCall.arguments[1], {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });

    await south.disconnect();
    const disconnectCall = HTTPRequest.mock.calls[1];
    assertContains(disconnectCall.arguments[0], { href: agentEndpoint('disconnect') });
    assert.deepStrictEqual(disconnectCall.arguments[1], { method: 'DELETE' });
  });

  it('should properly reconnect when connection fails', async () => {
    HTTPRequest.mock.mockImplementationOnce(async () => {
      throw new Error('connection failed');
    });

    await south.connect();

    assertContains(HTTPRequest.mock.calls[0].arguments[0], { href: agentEndpoint('connect') });
    assert.strictEqual(HTTPRequest.mock.calls.length, 1);

    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(HTTPRequest.mock.calls.length, 2);
  });

  it('should not reconnect when disconnecting', async () => {
    mockHTTPRequest(async () => {
      throw new Error('connection failed');
    });
    south['disconnecting'] = true;
    const disconnectMock1 = mock.fn(async () => undefined);
    south.disconnect = disconnectMock1;

    await south.connect();

    assert.strictEqual(disconnectMock1.mock.calls.length, 0);
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(HTTPRequest.mock.calls.length, 1);
  });

  it('should properly clear reconnect timeout on disconnect when not connected', async () => {
    mockHTTPRequest(async () => {
      throw new Error('connection failed');
    });

    await south.connect();
    assert.strictEqual(HTTPRequest.mock.calls.length, 1);

    await south.disconnect();
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(HTTPRequest.mock.calls.length, 1);
    assert.ok(
      logger.error.mock.calls.some(
        c =>
          c.arguments[0].includes('Error while sending connection HTTP request') &&
          c.arguments[0].includes(`${configuration.settings.retryInterval} ms`)
      )
    );
  });

  it('should properly clear reconnect timeout on disconnect when connected', async () => {
    mockHTTPRequest(async () => {
      throw new Error('disconnection failed');
    });
    HTTPRequest.mock.mockImplementationOnce(async () => createMockResponse(200));

    await south.connect();
    assert.strictEqual(HTTPRequest.mock.calls.length, 1);

    await south.disconnect();
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(HTTPRequest.mock.calls.length, 2);
    assert.ok(logger.error.mock.calls.some(c => c.arguments[0].includes('Error while sending disconnection HTTP request')));
  });

  it('should test connection successfully using an isolated test session', async () => {
    const connectSpy = mock.method(south, 'connect');
    const disconnectSpy = mock.method(south, 'disconnect');

    await assert.doesNotReject(south.testConnection());

    // testConnection() must never call the connector's own live connect()/disconnect() lifecycle methods...
    assert.strictEqual(connectSpy.mock.calls.length, 0);
    assert.strictEqual(disconnectSpy.mock.calls.length, 0);
    // ...nor touch the connector's own connected flag.
    assert.strictEqual(south['connected'], false);

    assert.strictEqual(HTTPRequest.mock.calls.length, 2);
    const [connectCall, disconnectCall] = HTTPRequest.mock.calls;
    assertContains(connectCall.arguments[0], { href: testSessionEndpoint('connect') });
    assertContains(disconnectCall.arguments[0], { href: testSessionEndpoint('disconnect') });
    assert.deepStrictEqual(disconnectCall.arguments[1], { method: 'DELETE' });
  });

  it('should test connection fail', async () => {
    mockHTTPRequest(async () => createMockResponse(400, 'bad request'));
    await assert.rejects(
      south.testConnection(),
      new Error('Error occurred when sending connect command to remote agent with status 400. bad request')
    );

    mockHTTPRequest(async () => createMockResponse(500, 'another error'));
    await assert.rejects(south.testConnection(), new Error('Error occurred when sending connect command to remote agent with status 500'));

    // Only the isolated test session was ever contacted, never the live one.
    assertContains(HTTPRequest.mock.calls[0].arguments[0], { href: testSessionEndpoint('connect') });
  });

  // The live session survives: none of the given calls hit the live endpoints
  const assertOnlyTestSessionCalls = (calls: Array<{ arguments: Parameters<HTTPRequestFn> }>) => {
    for (const call of calls) {
      const href = String(call.arguments[0]);
      assert.ok(!href.endsWith(`/api/pi/${configuration.id}/connect`), `unexpected live connect call: ${href}`);
      assert.ok(!href.endsWith(`/api/pi/${configuration.id}/disconnect`), `unexpected live disconnect call: ${href}`);
      assert.ok(href.includes(`${configuration.id}-test`), `expected test-session call, got: ${href}`);
    }
  };

  it('should leave a live connection untouched by testConnection()', async () => {
    // Establish a real, live connection first.
    await south.connect();
    assert.strictEqual(south['connected'], true);

    mockHTTPRequest();

    await assert.doesNotReject(south.testConnection());

    // The live session survives: connected flag untouched, and none of testConnection's calls hit the live endpoints.
    assert.strictEqual(south['connected'], true);
    assertOnlyTestSessionCalls(HTTPRequest.mock.calls);
  });

  it('should get data from Remote agent', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    const addContentMock = mock.method(south, 'addContent', async () => undefined);
    mockHTTPRequest(async () =>
      createMockResponse(200, { recordCount: 0, content: [], logs: [], maxInstantRetrieved: '2020-03-01T00:00:00.000Z' })
    );
    HTTPRequest.mock.mockImplementationOnce(
      async () =>
        createMockResponse(200, {
          recordCount: 2,
          content: [
            { pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', data: { value: 1, quality: 'Good' } },
            { pointId: 'item2', timestamp: '2020-03-01T00:00:00.000Z', data: { value: 2 } }
          ],
          logs: ['log1', 'log2'],
          maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
        }),
      0
    );
    HTTPRequest.mock.mockImplementationOnce(
      async () =>
        createMockResponse(200, {
          recordCount: 1,
          content: [{ pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', data: { value: 1 } }],
          logs: [],
          maxInstantRetrieved: '2020-02-01T00:00:00.000Z'
        }),
      1
    );

    const result = await south.historyQuery(configuration.items, startTime, endTime);

    const firstCall = HTTPRequest.mock.calls[0];
    assertContains(firstCall.arguments[0], { href: agentEndpoint('read') });
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
      value: { pointId: 'item2', timestamp: '2020-03-01T00:00:00.000Z', value: 2 }
    });
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], {
      type: 'record-list',
      content: [
        { pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', value: 1, quality: 'Good' },
        { pointId: 'item2', timestamp: '2020-03-01T00:00:00.000Z', value: 2 }
      ]
    });
    assert.strictEqual(addContentMock.mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [configuration.items[0], configuration.items[1]]);
    assert.ok(logger.warn.mock.calls.some(c => c.arguments[1] === 'log1'));
    assert.ok(logger.warn.mock.calls.some(c => c.arguments[1] === 'log2'));

    const resultNoUpdateInstant = await south.historyQuery(configuration.items, result!.trackedInstant!, endTime);
    assert.deepStrictEqual(resultNoUpdateInstant, {
      trackedInstant: null,
      value: { pointId: 'item1', timestamp: '2020-02-01T00:00:00.000Z', value: 1 }
    });

    const noResult = await south.historyQuery(configuration.items, startTime, endTime);
    assert.deepStrictEqual(noResult, { trackedInstant: null, value: null });
    assert.ok(logger.debug.mock.calls.some(c => c.arguments[1] === 'No result found. Request done in 0 ms'));
    assert.strictEqual(logger.warn.mock.calls.length, 2);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    mockHTTPRequest(async () => createMockResponse(500));
    HTTPRequest.mock.mockImplementationOnce(async () => createMockResponse(400, 'bad request'));

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

    mockHTTPRequest(async () => {
      throw new Error('bad request');
    });

    await assert.rejects(south.historyQuery(configuration.items, startTime, endTime), new Error('bad request'));

    await south.start();
    await assert.rejects(south.historyQuery(configuration.items, startTime, endTime), new Error('bad request'));
  });

  it('should test item using an isolated test session, not the live connect/disconnect endpoints', async () => {
    mockHTTPRequest(async () => {
      // First call is connect (15 ms), second is read (25 ms), third is disconnect.
      const callIndex = HTTPRequest.mock.callCount();
      mock.timers.tick(callIndex === 0 ? 15 : callIndex === 1 ? 25 : 0);
      return createMockResponse(200, {
        recordCount: 2,
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
        maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
      });
    });

    const connectSpy = mock.method(south, 'connect');
    const disconnectSpy = mock.method(south, 'disconnect');

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    // testItem() must never call the connector's own live connect()/disconnect() lifecycle methods...
    assert.strictEqual(connectSpy.mock.calls.length, 0);
    assert.strictEqual(disconnectSpy.mock.calls.length, 0);
    // ...nor touch the connector's own connected flag.
    assert.strictEqual(south['connected'], false);

    // Every HTTP call must target the isolated `-test` session id, never the live one.
    assert.strictEqual(HTTPRequest.mock.calls.length, 3);
    const [connectCall, readCall, disconnectCall] = HTTPRequest.mock.calls;
    assertContains(connectCall.arguments[0], { href: testSessionEndpoint('connect') });
    assert.deepStrictEqual(connectCall.arguments[1], {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    assertContains(readCall.arguments[0], { href: testSessionEndpoint('read') });
    assert.deepStrictEqual(readCall.arguments[1], itemTestReadOptions());
    assertContains(disconnectCall.arguments[0], { href: testSessionEndpoint('disconnect') });
    assert.deepStrictEqual(disconnectCall.arguments[1], { method: 'DELETE' });

    assert.strictEqual(result.connectionDuration, 15);
    assert.strictEqual(result.queryDuration, 25);

    await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
    assert.strictEqual(connectSpy.mock.calls.length, 0);
    assert.strictEqual(disconnectSpy.mock.calls.length, 0);
  });

  it('should test item and throw error if bad status, still disconnecting the test session only', async () => {
    mockHTTPRequest(async (_url, options) => (options?.method === 'DELETE' ? createMockResponse(200) : createMockResponse(400)));

    const connectSpy = mock.method(south, 'connect');
    const disconnectSpy = mock.method(south, 'disconnect');

    await assert.rejects(
      south.testItem(configuration.items[0], testData.south.itemTestingSettings),
      new Error('Error occurred when sending connect command to remote agent. 400')
    );

    // Even on failure, the live connect()/disconnect() lifecycle must never be invoked.
    assert.strictEqual(connectSpy.mock.calls.length, 0);
    assert.strictEqual(disconnectSpy.mock.calls.length, 0);
    assert.strictEqual(south['connected'], false);

    assertContains(HTTPRequest.mock.calls[0].arguments[0], { href: testSessionEndpoint('connect') });
    assertContains(HTTPRequest.mock.calls[1].arguments[0], { href: testSessionEndpoint('read') });
    assert.deepStrictEqual(HTTPRequest.mock.calls[1].arguments[1], itemTestReadOptions());
    // The test session is still torn down even though the read failed.
    assertContains(HTTPRequest.mock.calls[2].arguments[0], { href: testSessionEndpoint('disconnect') });
    assert.deepStrictEqual(HTTPRequest.mock.calls[2].arguments[1], { method: 'DELETE' });
  });

  it('should leave a live connection untouched by testItem()', async () => {
    // Establish a real, live connection first.
    await south.connect();
    assert.strictEqual(south['connected'], true);
    const callsAfterConnect = HTTPRequest.mock.calls.length;

    mockHTTPRequest(async () =>
      createMockResponse(200, {
        recordCount: 1,
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }],
        maxInstantRetrieved: '2020-02-01T00:00:00.000Z'
      })
    );

    await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    // The live session survives: connected flag untouched, and none of testItem's calls hit the live endpoints.
    assert.strictEqual(south['connected'], true);
    assertOnlyTestSessionCalls(HTTPRequest.mock.calls);
    assert.strictEqual(callsAfterConnect, 1);
  });
});
