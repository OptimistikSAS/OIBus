import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, asLogger, assertContains } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { SouthRestItemSettings, SouthRestSettings } from '../../../shared/model/south-settings.model';
import type { ReqOptions } from '../../service/http-request.utils';
import type { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import type { OIBusFileContent } from '../../../shared/model/engine.model';
import type SouthRestClass from './south-rest';

const nodeRequire = createRequire(import.meta.url);

describe('SouthRestAPI connector', () => {
  let SouthRest: typeof SouthRestClass;
  let south: SouthRestClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn();
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const utilsExports = {
    convertDateTimeToInstant: mock.fn((val: unknown) => {
      if (val === '2024-01-01') return testData.constants.dates.DATE_1;
      if (val === '2024-01-02') return testData.constants.dates.DATE_2;
      return 0;
    }),
    formatInstant: mock.fn((instant: string) => instant),
    generateRandomId: mock.fn(() => 'random-id'),
    sanitizeFilename: mock.fn((name: unknown) => name),
    delay: mock.fn(async () => undefined),
    generateIntervals: mock.fn(() => []),
    groupItemsByGroup: mock.fn(() => []),
    validateCronExpression: mock.fn(() => ({ expression: '' }))
  };

  const httpRequestExports = {
    HTTPRequest: mock.fn(async () => createMockResponse(200))
  };

  const encryptionServiceInstance = new EncryptionServiceMock('', '');

  let fsMock: {
    writeFile: ReturnType<typeof mock.fn>;
    stat: ReturnType<typeof mock.fn>;
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
    mockModule(nodeRequire, '../../service/encryption.service', {
      encryptionService: encryptionServiceInstance
    });
    SouthRest = reloadModule<{ default: typeof SouthRestClass }>(nodeRequire, './south-rest').default;
  });

  // --- Test Data Helpers ---
  const baseConfiguration: SouthConnectorEntity<SouthRestSettings, SouthRestItemSettings> = {
    id: 'south-rest',
    name: 'REST',
    type: 'rest',
    description: 'Rest connector',
    enabled: true,
    settings: {
      host: 'https://api.example.com/',
      acceptUnauthorized: true,
      authentication: {
        type: 'basic',
        username: 'rest-user',
        password: 'rest-password',
        token: 'bearer-token'
      },
      test: { endpoint: '/health', method: 'GET', successCode: 200 },
      timeout: 15,
      proxy: {
        useProxy: false
      }
    },
    groups: [],
    items: [],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

  const createConfiguration = () => structuredClone(baseConfiguration);
  const createItem = (overrides?: Partial<SouthRestItemSettings>): SouthConnectorItemEntity<SouthRestItemSettings> => ({
    id: 'item-1',
    name: 'Test Item',
    enabled: true,
    scanMode: testData.scanMode.list[0],
    group: null,
    syncWithGroup: false,
    maxReadInterval: 900,
    readDelay: 5,
    overlap: 10,
    settings: {
      endpoint: '/data',
      method: 'GET',
      returnType: 'body',
      queryParams: [],
      headers: [],
      trackingInstant: { trackInstant: false },
      ...overrides
    },
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  });

  const getRequestOptions = (index = 0): ReqOptions => httpRequestExports.HTTPRequest.mock.calls[index].arguments[1] as ReqOptions;

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200));
    fsMock = {
      writeFile: mock.method(fs, 'writeFile', async () => undefined) as unknown as ReturnType<typeof mock.fn>,
      stat: mock.method(fs, 'stat', async () => ({ size: 100 })) as unknown as ReturnType<typeof mock.fn>
    };
    utilsExports.formatInstant = mock.fn((instant: string) => instant);
    utilsExports.convertDateTimeToInstant = mock.fn((val: unknown) => {
      if (val === '2024-01-01') return testData.constants.dates.DATE_1;
      if (val === '2024-01-02') return testData.constants.dates.DATE_2;
      return 0;
    });
    utilsExports.generateRandomId = mock.fn(() => 'random-id');
    utilsExports.sanitizeFilename = mock.fn((name: unknown) => name);
    southCacheService.getSouthCache = mock.fn(() => ({ southId: 'south-rest', scanModeId: 'mode-1', maxInstant: null }));
    addContentCallback.mock.resetCalls();
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });

    const config = createConfiguration();
    south = new SouthRest(config, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  // --------------------------------------------------------------------------
  // 1. Connection Testing
  // --------------------------------------------------------------------------

  it('should test connection successfully', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, 'OK'));
    await assert.doesNotReject(south.testConnection());
  });

  it('should fail test connection on HTTP error', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(500, 'Server Error'));
    await assert.rejects(
      south.testConnection(),
      new Error('HTTP request failed with status code 500, expected 200. Message: Server Error')
    );
  });

  it('should fail test connection on fetch error', async () => {
    httpRequestExports.HTTPRequest = mock.fn(async () => {
      throw new Error('http error');
    });
    await assert.rejects(south.testConnection(), new Error('Fetch error: http error'));
  });

  it('should handle API Key authentication in query params', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'api-key';
    config.settings.authentication.apiKey = 'api_key';
    config.settings.authentication.apiValue = 'secret';
    config.settings.authentication.addTo = 'query-params';
    config.settings.test.method = 'POST';
    config.settings.test.body = 'body';

    south = new SouthRest(config, addContentCallback, southCacheRepository, asLogger(logger), 'cacheFolder');
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, 'OK'));

    await south.testConnection();

    const url = httpRequestExports.HTTPRequest.mock.calls[0].arguments[0] as URL;
    assert.strictEqual(url.searchParams.get('api_key'), 'secret');
  });

  // --------------------------------------------------------------------------
  // 2. Query Data Logic (queryData)
  // --------------------------------------------------------------------------

  it('should replace @StartTime and @EndTime in Query Params', async () => {
    const item = createItem({
      queryParams: [
        { key: 'start', value: '@StartTime', dateTimeInput: { type: 'iso-string' } },
        { key: 'end', value: '@EndTime', dateTimeInput: { type: 'iso-string' } }
      ]
    });

    const fmtQueue = [testData.constants.dates.DATE_1, testData.constants.dates.DATE_2];
    let fmtIdx = 0;
    utilsExports.formatInstant = mock.fn(() => fmtQueue[fmtIdx++] ?? '');
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, { data: [] }));

    await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    const options = getRequestOptions();
    assert.deepStrictEqual(options.query, {
      start: testData.constants.dates.DATE_1,
      end: testData.constants.dates.DATE_2
    });
  });

  it('should replace @StartTime and @EndTime in Headers', async () => {
    const item = createItem({
      headers: [
        { key: 'X-Time-From', value: 'From @StartTime', dateTimeInput: { type: 'iso-string' } },
        { key: 'X-Time-To', value: 'From @EndTime', dateTimeInput: { type: 'iso-string' } }
      ]
    });

    const fmtQueue = ['2024-01-01', '2025-01-01'];
    let fmtIdx = 0;
    utilsExports.formatInstant = mock.fn(() => fmtQueue[fmtIdx++] ?? '');
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, {}));

    await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    const options = getRequestOptions();
    assertContains(options.headers as object, {
      'X-Time-From': 'From 2024-01-01',
      'X-Time-To': 'From 2025-01-01'
    });
  });

  it('should replace @StartTime and @EndTime in Body for POST requests', async () => {
    const item = createItem({
      method: 'POST',
      body: {
        content: '{"from": "@StartTime", "to": "@EndTime"}',
        dateTimeInput: { type: 'iso-string' }
      }
    });

    const fmtQueue = ['START', 'END'];
    let fmtIdx = 0;
    utilsExports.formatInstant = mock.fn(() => fmtQueue[fmtIdx++] ?? '');
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, {}));

    await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    const options = getRequestOptions();
    assert.strictEqual(options.body, '{"from": "START", "to": "END"}');
    assertContains(options.headers as object, { 'Content-Type': 'application/json' });
  });

  it('should not replace @StartTime and @EndTime in Body for POST requests', async () => {
    const item = createItem({
      method: 'POST',
      body: {
        content: '{"from": "StartTime", "to": "EndTime"}'
      }
    });

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, {}));

    await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    const options = getRequestOptions();
    assert.strictEqual(utilsExports.formatInstant.mock.calls.length, 0);
    assert.strictEqual(options.body, '{"from": "StartTime", "to": "EndTime"}');
    assertContains(options.headers as object, { 'Content-Type': 'application/json' });
  });

  it('should handle XML response types', async () => {
    const item = createItem({ returnType: 'body' });
    const xmlContent = '<root>data</root>';

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, xmlContent, { 'content-type': 'application/xml' }));

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    assert.ok((result.filename as string).includes('.xml'));
    assert.strictEqual(result.content, xmlContent);
  });

  it('should handle file downloads (returnType = file)', async () => {
    const item = createItem({ returnType: 'file' });

    const mockRes = createMockResponse(200, 'file-content', { 'content-disposition': 'attachment; filename="report.pdf"' });
    httpRequestExports.HTTPRequest = mock.fn(async () => mockRes);

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    assert.strictEqual(result.filename, '"report.pdf"');
    assert.strictEqual(result.content, 'file-content');
    assert.strictEqual(result.maxInstant, null);
  });

  it('should handle file downloads (returnType = file) without filename', async () => {
    const item = createItem({ returnType: 'file' });

    const mockRes = createMockResponse(200, 'file-content', { 'content-disposition': 'attachment; file="report.pdf"' });
    httpRequestExports.HTTPRequest = mock.fn(async () => mockRes);

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    assert.strictEqual(result.filename, 'REST-Test Item-random-id');
    assert.strictEqual(result.content, 'file-content');
    assert.strictEqual(result.maxInstant, null);
  });

  it('should handle file downloads (returnType = file) without content disposition', async () => {
    const item = createItem({ returnType: 'file' });

    const mockRes = createMockResponse(200, 'file-content', {});
    httpRequestExports.HTTPRequest = mock.fn(async () => mockRes);

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    assert.strictEqual(result.filename, 'REST-Test Item-random-id');
    assert.strictEqual(result.content, 'file-content');
    assert.strictEqual(result.maxInstant, null);
  });

  it('should parse JSON string response manually if content-type is missing/text', async () => {
    const item = createItem();
    const jsonString = '{"manual": "parse"}';

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, jsonString, { 'content-type': 'text/plain' }));

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    assert.deepStrictEqual(result.content, { manual: 'parse' });
    assert.ok((result.filename as string).includes('.json'));
  });

  it('should parse string response manually if content-type is missing/text', async () => {
    const item = createItem();
    const jsonString = '1';

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, jsonString, { 'content-type': 'text/plain' }));

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    assert.deepStrictEqual(result.content, '1');
    assert.strictEqual(result.filename, 'REST-Test Item-random-id.json');
  });

  it('should return raw content if parse fails', async () => {
    const item = createItem();
    const jsonString = '{]';

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, jsonString, { 'content-type': 'text/plain' }));

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    assert.deepStrictEqual(result.content, '{]');
    assert.strictEqual(result.filename, 'REST-Test Item-random-id');
  });

  it('should throw error if queryData response is not OK', async () => {
    const item = createItem();
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(404, 'Not Found'));

    await assert.rejects(
      south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2),
      new Error('HTTP request failed with status code 404 and message: Not Found')
    );
  });

  // --------------------------------------------------------------------------
  // 3. Max Instant Tracking
  // --------------------------------------------------------------------------

  it('should track max instant from JSON response', async () => {
    const item = createItem({
      trackingInstant: {
        trackInstant: true,
        jsonPath: '$.items[*].date',
        dateTimeInput: { type: 'iso-string' }
      }
    });

    const responseData = {
      items: [{ date: '2024-01-01' }, { date: '2024-01-02' }]
    };

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, responseData, { 'content-type': 'application/json' }));

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    assert.strictEqual(result.maxInstant, testData.constants.dates.DATE_2);
  });

  it('should return null max instant if json path finds nothing', async () => {
    const item = createItem({
      trackingInstant: {
        trackInstant: true,
        jsonPath: '$.missing',
        dateTimeInput: { type: 'iso-string' }
      }
    });

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, { data: [] }, { 'content-type': 'application/json' }));
    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    assert.strictEqual(result.maxInstant, null);
  });

  it('should return null max instant if not tracking instant with json result', async () => {
    const item = createItem({
      trackingInstant: {
        trackInstant: false
      }
    });

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, { data: [] }, { 'content-type': 'application/json' }));
    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    assert.strictEqual(result.maxInstant, null);
  });

  it('should track max instant from text response', async () => {
    const item = createItem({
      trackingInstant: {
        trackInstant: true,
        jsonPath: '$.items[*].date',
        dateTimeInput: { type: 'iso-string' }
      }
    });

    const responseData = JSON.stringify({
      items: [{ date: '2024-01-01' }, { date: '2024-01-02' }, { date: null }, { date: '2024-01-01' }]
    });

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, responseData, { 'content-type': 'application/text' }));

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    assert.strictEqual(result.maxInstant, testData.constants.dates.DATE_2);
  });

  it('should return null max instant if json path finds nothing from text', async () => {
    const item = createItem({
      trackingInstant: {
        trackInstant: true,
        jsonPath: '$.missing',
        dateTimeInput: { type: 'iso-string' }
      }
    });

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, { data: [] }, { 'content-type': 'application/text' }));
    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    assert.strictEqual(result.maxInstant, null);
  });

  it('should return null max instant if not tracking instant with text result', async () => {
    const item = createItem({
      trackingInstant: {
        trackInstant: false
      }
    });

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, { data: [] }, { 'content-type': 'application/text' }));
    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    assert.strictEqual(result.maxInstant, null);
  });

  // --------------------------------------------------------------------------
  // 4. History Query & File Handling
  // --------------------------------------------------------------------------

  it('should execute historyQuery for multiple items and save content', async () => {
    const item1 = createItem({ endpoint: '/item1' });

    let callCount = 0;
    mock.method(
      south,
      'queryData',
      mock.fn(async () => {
        callCount++;
        if (callCount === 1)
          return { filename: 'REST-Test Item-random-id.json', content: 'content', maxInstant: testData.constants.dates.DATE_2 };
        return { filename: 'REST-Test Item-random-id.json', content: 'content', maxInstant: testData.constants.dates.DATE_1 };
      })
    );

    await south.historyQuery([item1], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    assert.strictEqual(fsMock.writeFile.mock.calls.length, 1);
    assert.strictEqual(addContentCallback.mock.calls.length, 1);
    const cbArgs = addContentCallback.mock.calls[0].arguments;
    assert.strictEqual(cbArgs[0], 'south-rest');
    assertContains(cbArgs[1] as object, { type: 'any' });
    assert.ok((cbArgs[1] as { filePath: string }).filePath.includes('REST-Test Item-random-id.json'));
  });

  it('should update maxInstant across multiple items in historyQuery', async () => {
    const item1 = createItem({
      trackingInstant: { trackInstant: true, jsonPath: '$', dateTimeInput: { type: 'iso-string' } }
    });

    mock.method(
      south,
      'queryData',
      mock.fn(async () => ({ filename: 'f1', content: '', maxInstant: testData.constants.dates.DATE_1 }))
    );

    const result = await south.historyQuery([item1, item1], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    assert.deepStrictEqual(result, { trackedInstant: testData.constants.dates.DATE_1, value: '' });
  });

  it('should not add content if file is empty', async () => {
    const item = createItem();
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, {}));

    fsMock.stat.mock.mockImplementation(async () => ({ size: 0 }));

    await south.historyQuery([item], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    assert.strictEqual(fsMock.writeFile.mock.calls.length, 1);
    assert.strictEqual(addContentCallback.mock.calls.length, 0);
  });

  // --------------------------------------------------------------------------
  // 5. Test Item (Single Item Test)
  // --------------------------------------------------------------------------

  it('should test a single item', async () => {
    const item = createItem();
    const testingSettings: SouthConnectorItemTestingSettings = {
      history: { startTime: testData.constants.dates.DATE_1, endTime: testData.constants.dates.DATE_2 }
    };

    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, { test: 'ok' }, { 'content-type': 'application/json' }));

    const result = await south.testItem(item, testingSettings);

    assert.strictEqual(result.type, 'any');
    assert.strictEqual((result as OIBusFileContent).content, JSON.stringify({ test: 'ok' }));
    assert.notStrictEqual((result as OIBusFileContent).filePath, undefined);
  });

  // --------------------------------------------------------------------------
  // 6. Test Proxy options and authorizations
  // --------------------------------------------------------------------------

  it('should not get proxy if proxy url is not specified', () => {
    const config = createConfiguration();
    config.settings.proxy.useProxy = true;
    (south as unknown as Record<string, unknown>)['connector'] = config;
    assert.throws(
      () => (south as unknown as Record<string, Array<() => unknown>>)['getProxyOptions'](),
      new Error('Proxy URL not specified')
    );
  });

  it('should get proxy', () => {
    const config = createConfiguration();
    config.settings.proxy.useProxy = true;
    config.settings.proxy.proxyUrl = 'http://localhost:8080/';
    (south as unknown as Record<string, unknown>)['connector'] = config;
    assert.deepStrictEqual((south as unknown as Record<string, () => unknown>)['getProxyOptions'](), {
      proxy: { url: 'http://localhost:8080/' },
      acceptUnauthorized: config.settings.acceptUnauthorized
    });
  });

  it('should get proxy with auth', () => {
    const config = createConfiguration();
    config.settings.proxy.useProxy = true;
    config.settings.proxy.proxyUrl = 'http://localhost:8080/';
    config.settings.proxy.proxyUsername = 'username';
    config.settings.proxy.proxyPassword = 'password';
    (south as unknown as Record<string, unknown>)['connector'] = config;
    assert.deepStrictEqual((south as unknown as Record<string, () => unknown>)['getProxyOptions'](), {
      proxy: { url: 'http://localhost:8080/', auth: { type: 'url', username: 'username', password: 'password' } },
      acceptUnauthorized: config.settings.acceptUnauthorized
    });
  });

  it('should get basic auth', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'basic';
    config.settings.authentication.username = 'username';
    config.settings.authentication.password = 'password';
    (south as unknown as Record<string, unknown>)['connector'] = config;
    assert.deepStrictEqual(await (south as unknown as Record<string, () => Promise<unknown>>)['getAuthorizationOptions'](), {
      type: 'basic',
      username: 'username',
      password: 'password'
    });
  });

  it('should not get basic auth if no username', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'basic';
    config.settings.authentication.username = '';
    (south as unknown as Record<string, unknown>)['connector'] = config;
    assert.strictEqual(await (south as unknown as Record<string, () => Promise<unknown>>)['getAuthorizationOptions'](), undefined);
  });

  it('should get bearer auth', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'bearer';
    config.settings.authentication.token = 'token';
    (south as unknown as Record<string, unknown>)['connector'] = config;
    assert.deepStrictEqual(await (south as unknown as Record<string, () => Promise<unknown>>)['getAuthorizationOptions'](), {
      type: 'bearer',
      token: 'token'
    });
  });

  it('should not get bearer auth if no token', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'bearer';
    config.settings.authentication.token = '';
    (south as unknown as Record<string, unknown>)['connector'] = config;
    assert.strictEqual(await (south as unknown as Record<string, () => Promise<unknown>>)['getAuthorizationOptions'](), undefined);
  });

  it('should not get auth if api-key', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'api-key';
    (south as unknown as Record<string, unknown>)['connector'] = config;
    assert.strictEqual(await (south as unknown as Record<string, () => Promise<unknown>>)['getAuthorizationOptions'](), undefined);
  });

  it('should not get auth if none', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'none';
    (south as unknown as Record<string, unknown>)['connector'] = config;
    assert.strictEqual(await (south as unknown as Record<string, () => Promise<unknown>>)['getAuthorizationOptions'](), undefined);
  });

  it('should add API key to HEADERS when configured', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'api-key';
    config.settings.authentication.apiKey = 'X-Custom-Auth';
    config.settings.authentication.apiValue = 'secret-value';
    config.settings.authentication.addTo = 'header';
    (south as unknown as Record<string, unknown>)['connector'] = config;

    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data');

    await (south as unknown as Record<string, (o: ReqOptions, u: URL) => Promise<void>>)['handleApiKeyAuth'](options, url);

    assert.notStrictEqual(options.headers, undefined);
    assert.strictEqual((options.headers as Record<string, string>)['X-Custom-Auth'], 'secret-value');
    assert.strictEqual(url.searchParams.has('X-Custom-Auth'), false);
  });

  it('should add API key to QUERY PARAMS when configured', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'api-key';
    config.settings.authentication.apiKey = 'api_key';
    config.settings.authentication.apiValue = 'secret-value';
    config.settings.authentication.addTo = 'query-params';
    (south as unknown as Record<string, unknown>)['connector'] = config;

    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data?existing=true');

    await (south as unknown as Record<string, (o: ReqOptions, u: URL) => Promise<void>>)['handleApiKeyAuth'](options, url);

    assert.strictEqual(url.searchParams.get('api_key'), 'secret-value');
    assert.strictEqual(url.searchParams.get('existing'), 'true');
    assert.strictEqual(options.headers, undefined);
  });

  it('should NOT modify options or url if authentication is NOT api-key', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'basic';
    config.settings.authentication.apiKey = 'should-ignore';
    config.settings.authentication.apiValue = 'should-ignore';
    (south as unknown as Record<string, unknown>)['connector'] = config;

    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data');

    await (south as unknown as Record<string, (o: ReqOptions, u: URL) => Promise<void>>)['handleApiKeyAuth'](options, url);

    assert.strictEqual(options.headers, undefined);
    assert.strictEqual(url.searchParams.toString(), '');
  });

  it('should NOT modify options or url if apiKey or apiValue are missing', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'api-key';
    config.settings.authentication.addTo = 'header';
    (south as unknown as Record<string, unknown>)['connector'] = config;

    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data');

    config.settings.authentication.apiKey = '';
    config.settings.authentication.apiValue = 'some-value';
    await (south as unknown as Record<string, (o: ReqOptions, u: URL) => Promise<void>>)['handleApiKeyAuth'](options, url);
    assert.strictEqual(options.headers, undefined);

    config.settings.authentication.apiKey = 'some-key';
    config.settings.authentication.apiValue = '';
    await (south as unknown as Record<string, (o: ReqOptions, u: URL) => Promise<void>>)['handleApiKeyAuth'](options, url);
    assert.strictEqual(options.headers, undefined);
  });

  it('should append to existing headers object if it already exists', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'api-key';
    config.settings.authentication.apiKey = 'X-Auth';
    config.settings.authentication.apiValue = 'secret-value';
    config.settings.authentication.addTo = 'header';
    (south as unknown as Record<string, unknown>)['connector'] = config;

    const options: ReqOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    const url = new URL('https://api.example.com/data');

    await (south as unknown as Record<string, (o: ReqOptions, u: URL) => Promise<void>>)['handleApiKeyAuth'](options, url);

    assertContains(options.headers as object, {
      'Content-Type': 'application/json',
      'X-Auth': 'secret-value'
    });
  });
});
