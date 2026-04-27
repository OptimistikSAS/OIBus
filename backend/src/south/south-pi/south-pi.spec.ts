import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, asLogger, assertContains } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type { SouthPIItemSettings, SouthPISettings } from '../../../shared/model/south-settings.model';
import type SouthPiClass from './south-pi';

const nodeRequire = createRequire(import.meta.url);

describe('South PI', () => {
  let SouthPi: typeof SouthPiClass;
  let south: SouthPiClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn();
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const utilsExports = {
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => []),
    groupItemsByGroup: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' }))
  };

  const httpRequestExports = {
    HTTPRequest: mock.fn(async () => createMockResponse(200))
  };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
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
        overlap: 0,
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
        overlap: 0,
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
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200));
    addContentCallback.mock.resetCalls();
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthPi(configuration, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
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
    httpRequestExports.HTTPRequest = mock.fn(async () => {
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
    httpRequestExports.HTTPRequest = mock.fn(async () => {
      throw new Error('connection failed');
    });
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;
    south.disconnect = mock.fn(async () => undefined);

    await south.connect();

    assert.strictEqual((south.disconnect as ReturnType<typeof mock.fn>).mock.calls.length, 0);
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
  });

  it('should properly clear reconnect timeout on disconnect when not connected', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async () => {
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
    httpRequestExports.HTTPRequest = mock.fn(async () => {
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

  it('should test connection successfully', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200));
    await assert.doesNotReject(south.testConnection());
  });

  it('should test connection fail', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(400, 'bad request'));
    await assert.rejects(
      south.testConnection(),
      new Error('Error occurred when sending connect command to remote agent with status 400. bad request')
    );

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(500, 'another error'));
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
    httpRequestExports.HTTPRequest = mock.fn(async () => {
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
    assert.ok(logger.warn.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === 'log1'));
    assert.ok(logger.warn.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === 'log2'));

    const resultNoUpdateInstant = await south.historyQuery(configuration.items, result!.trackedInstant!, endTime);
    assert.deepStrictEqual(resultNoUpdateInstant, {
      trackedInstant: null,
      value: { timestamp: '2020-02-01T00:00:00.000Z' }
    });

    const noResult = await south.historyQuery(configuration.items, startTime, endTime);
    assert.deepStrictEqual(noResult, { trackedInstant: null, value: null });
    assert.ok(
      logger.debug.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === 'No result found. Request done in 0 ms')
    );
    assert.strictEqual(logger.warn.mock.calls.length, 2);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    let callCount = 0;
    httpRequestExports.HTTPRequest = mock.fn(async () => {
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

    httpRequestExports.HTTPRequest = mock.fn(async () => {
      throw new Error('bad request');
    });

    await assert.rejects(south.historyQuery(configuration.items, startTime, endTime), new Error('bad request'));

    await south.start();
    await assert.rejects(south.historyQuery(configuration.items, startTime, endTime), new Error('bad request'));
  });

  it('should test item', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async () =>
      createMockResponse(200, {
        recordCount: 2,
        content: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }],
        maxInstantRetrieved: '2020-03-01T00:00:00.000Z'
      })
    );

    south.connect = mock.fn(async () => undefined);
    south.disconnect = mock.fn(async () => undefined);

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

    await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    assert.strictEqual((south.connect as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.strictEqual((south.disconnect as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assertContains(httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/read`
    });
    assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[0].arguments[1], fetchOptions);

    await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
    assert.strictEqual((south.connect as ReturnType<typeof mock.fn>).mock.calls.length, 2);
    assert.strictEqual((south.disconnect as ReturnType<typeof mock.fn>).mock.calls.length, 2);
  });

  it('should test item and throw error if bad status', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(400));

    south.connect = mock.fn(async () => undefined);
    south.disconnect = mock.fn(async () => undefined);

    await assert.rejects(
      south.testItem(configuration.items[0], testData.south.itemTestingSettings),
      new Error('Error occurred when sending connect command to remote agent. 400')
    );
    assert.strictEqual((south.connect as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.strictEqual((south.disconnect as ReturnType<typeof mock.fn>).mock.calls.length, 1);

    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    assertContains(httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as object, {
      href: `${configuration.settings.agentUrl}/api/pi/${configuration.id}/read`
    });
    assert.deepStrictEqual(httpRequestExports.HTTPRequest.mock.calls[0].arguments[1], {
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
  });
});
