import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { SouthRestItemSettings, SouthRestSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { ReqOptions, ReqResponse } from '../../service/http-request.utils';
import type * as Utils from '../../service/utils';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import testData from '../../tests/utils/test-data';
import { assertContains, createMock, mockModule, reloadModule, seq } from '../../tests/utils/test-utils';
import type SouthRestClass from './south-rest';

const nodeRequire = createRequire(import.meta.url);

const { DATE_1, DATE_2 } = testData.constants.dates;

const createConfiguration = (): SouthConnectorEntity<SouthRestSettings, SouthRestItemSettings> => ({
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
});

const createItem = (overrides?: Partial<SouthRestItemSettings>): SouthConnectorItemEntity<SouthRestItemSettings> => ({
  id: 'item-1',
  name: 'Test Item',
  enabled: true,
  scanMode: testData.scanMode.list[0],
  group: null,
  syncWithGroup: false,
  maxReadInterval: 900,
  readDelay: 5,
  startTimeOffset: 10,
  endTimeOffset: null,
  recoveryStrategy: null,
  cachingStrategy: null,
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
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

describe('SouthRestAPI connector', () => {
  let SouthRest: typeof SouthRestClass;
  let south: SouthRestClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<ConstructorParameters<typeof SouthRestClass>[1]>;
  let HTTPRequest: Mock<(url: URL, options?: ReqOptions) => Promise<ReqResponse>>;
  let writeFile: Mock<typeof fs.writeFile>;
  let unlink: Mock<typeof fs.unlink>;
  let fileSize: number;

  const httpRequestExports: Record<string, unknown> = { HTTPRequest: undefined };

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({
    convertDateTimeToInstant: mock.fn((value: unknown) => {
      if (value === '2024-01-01') return DATE_1;
      if (value === '2024-01-02') return DATE_2;
      return 0;
    }),
    formatInstant: mock.fn((instant: string) => instant),
    generateRandomId: mock.fn(() => 'random-id'),
    sanitizeFilename: mock.fn((name: string) => name)
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthRest = reloadModule<{ default: typeof SouthRestClass }>(nodeRequire, './south-rest').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    HTTPRequest = mock.fn(async () => createMockResponse(200));
    httpRequestExports.HTTPRequest = HTTPRequest;
    Object.assign(utilsExports, createUtilsMocks());
    writeFile = mock.method(fs, 'writeFile', async () => undefined);
    fileSize = 100;
    mock.method(
      fs,
      'stat',
      mock.fn(async () => ({ size: fileSize }))
    );
    unlink = mock.method(fs, 'unlink', async () => undefined);
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });

    south = createSouth(createConfiguration());
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  const createSouth = (configuration: SouthConnectorEntity<SouthRestSettings, SouthRestItemSettings>) =>
    new SouthRest(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');

  // Recreates the connector with its settings edited by `edit`, and returns its configuration
  const configure = (edit: (settings: SouthRestSettings) => void) => {
    const configuration = createConfiguration();
    edit(configuration.settings);
    south = createSouth(configuration);
    return configuration;
  };

  const respondWith = (...args: Parameters<typeof createMockResponse>) =>
    HTTPRequest.mock.mockImplementation(async () => createMockResponse(...args));

  const getRequestOptions = (index = 0): ReqOptions => HTTPRequest.mock.calls[index].arguments[1]!;

  // --------------------------------------------------------------------------
  // 1. Connection Testing
  // --------------------------------------------------------------------------

  it('should test connection successfully', async () => {
    respondWith(200, 'OK');
    await assert.doesNotReject(south.testConnection());
  });

  it('should fail test connection on HTTP error', async () => {
    respondWith(500, 'Server Error');
    await assert.rejects(
      south.testConnection(),
      new Error('HTTP request failed with status code 500, expected 200. Message: Server Error')
    );
  });

  it('should fail test connection on fetch error', async () => {
    HTTPRequest.mock.mockImplementation(async () => {
      throw new Error('http error');
    });
    await assert.rejects(south.testConnection(), new Error('Fetch error: http error'));
  });

  it('should handle API Key authentication in query params', async () => {
    configure(settings => {
      settings.authentication.type = 'api-key';
      settings.authentication.apiKey = 'api_key';
      settings.authentication.apiValue = 'secret';
      settings.authentication.addTo = 'query-params';
      settings.test.method = 'POST';
      settings.test.body = 'body';
    });
    respondWith(200, 'OK');

    await south.testConnection();

    const url = HTTPRequest.mock.calls[0].arguments[0];
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
    utilsExports.formatInstant.mock.mockImplementation(
      seq(
        () => DATE_1,
        () => DATE_2
      )
    );
    respondWith(200, { data: [] });

    await south.queryData(item, DATE_1, DATE_2);

    assert.deepStrictEqual(getRequestOptions().query, { start: DATE_1, end: DATE_2 });
  });

  it('should turn a repeated query param key into an array instead of overwriting it', async () => {
    const item = createItem({
      queryParams: [
        { key: 'tag', value: 'a' },
        { key: 'tag', value: 'b' },
        { key: 'other', value: 'x' }
      ]
    });
    respondWith(200, { data: [] });

    await south.queryData(item, DATE_1, DATE_2);

    assert.deepStrictEqual(getRequestOptions().query, { tag: ['a', 'b'], other: 'x' });
  });

  it('should push additional values onto an already-converted array query param', async () => {
    const item = createItem({
      queryParams: [
        { key: 'tag', value: 'a' },
        { key: 'tag', value: 'b' },
        { key: 'tag', value: 'c' }
      ]
    });
    respondWith(200, { data: [] });

    await south.queryData(item, DATE_1, DATE_2);

    assert.deepStrictEqual(getRequestOptions().query, { tag: ['a', 'b', 'c'] });
  });

  it('should turn a repeated key into an array of substituted @StartTime/@EndTime values', async () => {
    const item = createItem({
      queryParams: [
        { key: 'tag', value: '@StartTime', dateTimeInput: { type: 'iso-string' } },
        { key: 'tag', value: '@EndTime', dateTimeInput: { type: 'iso-string' } }
      ]
    });
    utilsExports.formatInstant.mock.mockImplementation(
      seq(
        () => DATE_1,
        () => DATE_2
      )
    );
    respondWith(200, { data: [] });

    await south.queryData(item, DATE_1, DATE_2);

    assert.deepStrictEqual(getRequestOptions().query, { tag: [DATE_1, DATE_2] });
  });

  it('should apply an inline add() offset to @StartTime and @EndTime in Query Params', async () => {
    const item = createItem({
      queryParams: [
        { key: 'start', value: "@StartTime.add(-1, 'day')", dateTimeInput: { type: 'iso-string' } },
        { key: 'end', value: "@EndTime.add(1, 'day')", dateTimeInput: { type: 'iso-string' } }
      ]
    });
    respondWith(200, { data: [] });

    await south.queryData(item, DATE_1, DATE_2);

    assert.deepStrictEqual(getRequestOptions().query, {
      start: '2020-03-14T00:00:00.000Z',
      end: '2020-03-21T00:00:00.000Z'
    });
  });

  it('should replace @StartTime and @EndTime, plain and with an add() offset, when combined in the same field', async () => {
    const item = createItem({
      queryParams: [
        {
          key: 'range',
          value: "@StartTime|@EndTime|@StartTime.add(-2, 'hour')|@EndTime.add(2, 'hour')",
          dateTimeInput: { type: 'iso-string' }
        }
      ]
    });
    respondWith(200, { data: [] });

    await south.queryData(item, DATE_1, DATE_2);

    assert.deepStrictEqual(getRequestOptions().query, {
      range: `${DATE_1}|${DATE_2}|2020-03-14T22:00:00.000Z|2020-03-20T02:00:00.000Z`
    });
  });

  it('should replace @StartTime and @EndTime in Headers', async () => {
    const item = createItem({
      headers: [
        { key: 'X-Time-From', value: 'From @StartTime', dateTimeInput: { type: 'iso-string' } },
        { key: 'X-Time-To', value: 'From @EndTime', dateTimeInput: { type: 'iso-string' } }
      ]
    });
    utilsExports.formatInstant.mock.mockImplementation(
      seq(
        () => '2024-01-01',
        () => '2025-01-01'
      )
    );
    respondWith(200, {});

    await south.queryData(item, DATE_1, DATE_2);

    assertContains(getRequestOptions().headers as object, {
      'X-Time-From': 'From 2024-01-01',
      'X-Time-To': 'From 2025-01-01'
    });
  });

  it('should apply an inline add() offset to @StartTime and @EndTime in Headers', async () => {
    const item = createItem({
      headers: [
        {
          key: 'X-Window',
          value: "From @StartTime.add(-30, 'minute') to @EndTime.add(30, 'minute')",
          dateTimeInput: { type: 'iso-string' }
        }
      ]
    });
    respondWith(200, {});

    await south.queryData(item, DATE_1, DATE_2);

    assertContains(getRequestOptions().headers as object, {
      'X-Window': 'From 2020-03-14T23:30:00.000Z to 2020-03-20T00:30:00.000Z'
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
    utilsExports.formatInstant.mock.mockImplementation(
      seq(
        () => 'START',
        () => 'END'
      )
    );
    respondWith(200, {});

    await south.queryData(item, DATE_1, DATE_2);

    const options = getRequestOptions();
    assert.strictEqual(options.body, '{"from": "START", "to": "END"}');
    assertContains(options.headers as object, { 'Content-Type': 'application/json' });
  });

  it('should apply an inline add() offset to @StartTime and @EndTime in Body for POST requests', async () => {
    const item = createItem({
      method: 'POST',
      body: {
        content: `{"from": "@StartTime.add(-1, 'day')", "to": "@EndTime.add(1, 'day')"}`,
        dateTimeInput: { type: 'iso-string' }
      }
    });
    respondWith(200, {});

    await south.queryData(item, DATE_1, DATE_2);

    assert.strictEqual(getRequestOptions().body, '{"from": "2020-03-14T00:00:00.000Z", "to": "2020-03-21T00:00:00.000Z"}');
  });

  it('should not replace @StartTime and @EndTime in Body for POST requests', async () => {
    const item = createItem({
      method: 'POST',
      body: {
        content: '{"from": "StartTime", "to": "EndTime"}'
      }
    });
    respondWith(200, {});

    await south.queryData(item, DATE_1, DATE_2);

    const options = getRequestOptions();
    assert.strictEqual(utilsExports.formatInstant.mock.calls.length, 0);
    assert.strictEqual(options.body, '{"from": "StartTime", "to": "EndTime"}');
    assertContains(options.headers as object, { 'Content-Type': 'application/json' });
  });

  it('should handle XML response types', async () => {
    const xmlContent = '<root>data</root>';
    respondWith(200, xmlContent, { 'content-type': 'application/xml' });

    const result = await south.queryData(createItem({ returnType: 'body' }), DATE_1, DATE_2);
    assert.ok(result.filename.includes('.xml'));
    assert.strictEqual(result.content, xmlContent);
  });

  it('should handle file downloads (returnType = file)', async () => {
    respondWith(200, 'file-content', { 'content-disposition': 'attachment; filename="report.pdf"' });

    const result = await south.queryData(createItem({ returnType: 'file' }), DATE_1, DATE_2);

    assert.strictEqual(result.filename, '"report.pdf"');
    assert.strictEqual(result.content, 'file-content');
    assert.strictEqual(result.maxInstant, null);
  });

  it('should handle file downloads (returnType = file) without filename', async () => {
    respondWith(200, 'file-content', { 'content-disposition': 'attachment; file="report.pdf"' });

    const result = await south.queryData(createItem({ returnType: 'file' }), DATE_1, DATE_2);

    assert.strictEqual(result.filename, 'REST-Test Item-random-id');
    assert.strictEqual(result.content, 'file-content');
    assert.strictEqual(result.maxInstant, null);
  });

  it('should handle file downloads (returnType = file) without content disposition', async () => {
    respondWith(200, 'file-content', {});

    const result = await south.queryData(createItem({ returnType: 'file' }), DATE_1, DATE_2);

    assert.strictEqual(result.filename, 'REST-Test Item-random-id');
    assert.strictEqual(result.content, 'file-content');
    assert.strictEqual(result.maxInstant, null);
  });

  it('should keep the path of the host in the request URL', async () => {
    const configuration = configure(settings => {
      settings.host = 'https://api.example.com/base/';
    });
    respondWith(200, 'OK');

    await south.queryData(createItem({ endpoint: '/data' }), DATE_1, DATE_2);
    await south.testConnection();

    const urls = HTTPRequest.mock.calls.map(call => call.arguments[0].href);
    assert.deepStrictEqual(urls, [
      'https://api.example.com/base/data',
      `https://api.example.com/base/${configuration.settings.test.endpoint.replace(/^\/+/, '')}`
    ]);
  });

  it('should parse JSON string response manually if content-type is missing/text', async () => {
    const jsonString = '{"manual": "parse"}';
    respondWith(200, jsonString, { 'content-type': 'text/plain' });

    const result = await south.queryData(createItem(), DATE_1, DATE_2);
    // The raw text is kept: the content is written as is into the file
    assert.strictEqual(result.content, jsonString);
    assert.ok(result.filename.includes('.json'));
  });

  it('should parse string response manually if content-type is missing/text', async () => {
    respondWith(200, '1', { 'content-type': 'text/plain' });

    const result = await south.queryData(createItem(), DATE_1, DATE_2);
    assert.deepStrictEqual(result.content, '1');
    assert.strictEqual(result.filename, 'REST-Test Item-random-id.json');
  });

  it('should return raw content if parse fails', async () => {
    respondWith(200, '{]', { 'content-type': 'text/plain' });

    const result = await south.queryData(createItem(), DATE_1, DATE_2);
    assert.deepStrictEqual(result.content, '{]');
    assert.strictEqual(result.filename, 'REST-Test Item-random-id');
  });

  it('should throw error if queryData response is not OK', async () => {
    respondWith(404, 'Not Found');

    await assert.rejects(
      south.queryData(createItem(), DATE_1, DATE_2),
      new Error('HTTP request failed with status code 404 and message: Not Found')
    );
  });

  // --------------------------------------------------------------------------
  // 3. Max Instant Tracking
  // --------------------------------------------------------------------------

  describe('max instant tracking', () => {
    const trackedItem = (jsonPath: string) =>
      createItem({ trackingInstant: { trackInstant: true, jsonPath, dateTimeInput: { type: 'iso-string' } } });
    const untrackedItem = () => createItem({ trackingInstant: { trackInstant: false } });

    it('should track max instant from JSON response', async () => {
      respondWith(200, { items: [{ date: '2024-01-01' }, { date: '2024-01-02' }] }, { 'content-type': 'application/json' });

      const result = await south.queryData(trackedItem('$.items[*].date'), DATE_1, DATE_2);

      assert.strictEqual(result.maxInstant, DATE_2);
    });

    it('should return null max instant if json path finds nothing', async () => {
      respondWith(200, { data: [] }, { 'content-type': 'application/json' });
      const result = await south.queryData(trackedItem('$.missing'), DATE_1, DATE_2);
      assert.strictEqual(result.maxInstant, null);
    });

    it('should return null max instant if not tracking instant with json result', async () => {
      respondWith(200, { data: [] }, { 'content-type': 'application/json' });
      const result = await south.queryData(untrackedItem(), DATE_1, DATE_2);
      assert.strictEqual(result.maxInstant, null);
    });

    it('should track max instant from text response', async () => {
      const responseData = JSON.stringify({
        items: [{ date: '2024-01-01' }, { date: '2024-01-02' }, { date: null }, { date: '2024-01-01' }]
      });
      respondWith(200, responseData, { 'content-type': 'application/text' });

      const result = await south.queryData(trackedItem('$.items[*].date'), DATE_1, DATE_2);

      assert.strictEqual(result.maxInstant, DATE_2);
    });

    it('should return null max instant if json path finds nothing from text', async () => {
      respondWith(200, { data: [] }, { 'content-type': 'application/text' });
      const result = await south.queryData(trackedItem('$.missing'), DATE_1, DATE_2);
      assert.strictEqual(result.maxInstant, null);
    });

    it('should return null max instant if not tracking instant with text result', async () => {
      respondWith(200, { data: [] }, { 'content-type': 'application/text' });
      const result = await south.queryData(untrackedItem(), DATE_1, DATE_2);
      assert.strictEqual(result.maxInstant, null);
    });
  });

  // --------------------------------------------------------------------------
  // 4. History Query & File Handling
  // --------------------------------------------------------------------------

  it('should execute historyQuery for multiple items and save content', async () => {
    mock.method(
      south,
      'queryData',
      mock.fn(
        seq<ReturnType<SouthRestClass['queryData']>>(
          async () => ({ filename: 'REST-Test Item-random-id.json', content: 'content', maxInstant: DATE_2 }),
          async () => ({ filename: 'REST-Test Item-random-id.json', content: 'content', maxInstant: DATE_1 })
        )
      )
    );

    await south.historyQuery([createItem({ endpoint: '/item1' })], DATE_1, DATE_2);

    assert.strictEqual(writeFile.mock.calls.length, 1);
    assert.strictEqual(addContentCallback.mock.calls.length, 1);
    const [southId, content] = addContentCallback.mock.calls[0].arguments;
    assert.strictEqual(southId, 'south-rest');
    assert.ok(content.type === 'file');
    assert.ok(content.filePath.includes('REST-Test Item-random-id.json'));

    assert.strictEqual(unlink.mock.calls.length, 1, 'the temp file should be deleted from the south cache once sent');
    assert.strictEqual(unlink.mock.calls[0].arguments[0], content.filePath);
  });

  it('should log an error but not throw if deleting the temp file fails after caching', async () => {
    mock.method(south, 'queryData', async () => ({ filename: 'REST-Test Item-random-id.json', content: 'content', maxInstant: null }));
    unlink.mock.mockImplementation(async () => {
      throw new Error('EBUSY');
    });

    await south.historyQuery([createItem({ endpoint: '/item1' })], DATE_1, DATE_2);

    assert.strictEqual(addContentCallback.mock.calls.length, 1);
    assert.ok(logger.error.mock.calls.some(c => (c.arguments[1] as string).includes('Error when deleting file')));
  });

  it('should update maxInstant across multiple items in historyQuery', async () => {
    const item1 = createItem({
      trackingInstant: { trackInstant: true, jsonPath: '$', dateTimeInput: { type: 'iso-string' } }
    });
    mock.method(south, 'queryData', async () => ({ filename: 'f1', content: '', maxInstant: DATE_1 }));

    const result = await south.historyQuery([item1, item1], DATE_1, DATE_2);
    assert.deepStrictEqual(result, { trackedInstant: DATE_1, value: '' });
  });

  it('should not add content if file is empty', async () => {
    respondWith(200, {});
    fileSize = 0;

    await south.historyQuery([createItem()], DATE_1, DATE_2);

    assert.strictEqual(writeFile.mock.calls.length, 1);
    assert.strictEqual(addContentCallback.mock.calls.length, 0);
    assert.strictEqual(unlink.mock.calls.length, 1, 'the empty temp file should still be cleaned up');
  });

  it('should log an error but not throw if deleting an empty temp file fails', async () => {
    respondWith(200, {});
    fileSize = 0;
    unlink.mock.mockImplementation(async () => {
      throw new Error('EBUSY');
    });

    await south.historyQuery([createItem()], DATE_1, DATE_2);

    assert.strictEqual(addContentCallback.mock.calls.length, 0);
    assert.ok(
      logger.error.mock.calls.some(c => typeof c.arguments[1] === 'string' && c.arguments[1].includes('Error when deleting empty file'))
    );
  });

  // --------------------------------------------------------------------------
  // 5. Test Item (Single Item Test)
  // --------------------------------------------------------------------------

  it('should test a single item', async () => {
    HTTPRequest.mock.mockImplementation(async () => {
      mock.timers.tick(25);
      return createMockResponse(200, { test: 'ok' }, { 'content-type': 'application/json' });
    });

    const result = await south.testItem(createItem(), { history: { startTime: DATE_1, endTime: DATE_2 } });

    assert.ok(result.result.type === 'file');
    assert.strictEqual(result.result.content, JSON.stringify({ test: 'ok' }));
    assert.notStrictEqual(result.result.filePath, undefined);
    assert.strictEqual(result.connectionDuration, 0);
    assert.strictEqual(result.queryDuration, 25);
  });

  // --------------------------------------------------------------------------
  // 6. Test Proxy options and authorizations
  // --------------------------------------------------------------------------

  it('should not get proxy if proxy url is not specified', () => {
    configure(settings => {
      settings.proxy.useProxy = true;
    });
    assert.throws(() => south['getProxyOptions'](), new Error('Proxy URL not specified'));
  });

  it('should get proxy', () => {
    const configuration = configure(settings => {
      settings.proxy.useProxy = true;
      settings.proxy.proxyUrl = 'http://localhost:8080/';
    });
    assert.deepStrictEqual(south['getProxyOptions'](), {
      proxy: { url: 'http://localhost:8080/' },
      acceptUnauthorized: configuration.settings.acceptUnauthorized
    });
  });

  it('should get proxy with auth', () => {
    const configuration = configure(settings => {
      settings.proxy.useProxy = true;
      settings.proxy.proxyUrl = 'http://localhost:8080/';
      settings.proxy.proxyUsername = 'username';
      settings.proxy.proxyPassword = 'password';
    });
    assert.deepStrictEqual(south['getProxyOptions'](), {
      proxy: { url: 'http://localhost:8080/', auth: { type: 'url', username: 'username', password: 'password' } },
      acceptUnauthorized: configuration.settings.acceptUnauthorized
    });
  });

  it('should get basic auth', async () => {
    configure(settings => {
      settings.authentication.type = 'basic';
      settings.authentication.username = 'username';
      settings.authentication.password = 'password';
    });
    assert.deepStrictEqual(await south['getAuthorizationOptions'](), {
      type: 'basic',
      username: 'username',
      password: 'password'
    });
  });

  it('should not get basic auth if no username', async () => {
    configure(settings => {
      settings.authentication.type = 'basic';
      settings.authentication.username = '';
    });
    assert.strictEqual(await south['getAuthorizationOptions'](), undefined);
  });

  it('should get bearer auth', async () => {
    configure(settings => {
      settings.authentication.type = 'bearer';
      settings.authentication.token = 'token';
    });
    assert.deepStrictEqual(await south['getAuthorizationOptions'](), {
      type: 'bearer',
      token: 'token'
    });
  });

  it('should not get bearer auth if no token', async () => {
    configure(settings => {
      settings.authentication.type = 'bearer';
      settings.authentication.token = '';
    });
    assert.strictEqual(await south['getAuthorizationOptions'](), undefined);
  });

  it('should not get auth if api-key', async () => {
    configure(settings => {
      settings.authentication.type = 'api-key';
    });
    assert.strictEqual(await south['getAuthorizationOptions'](), undefined);
  });

  it('should not get auth if none', async () => {
    configure(settings => {
      settings.authentication.type = 'none';
    });
    assert.strictEqual(await south['getAuthorizationOptions'](), undefined);
  });

  it('should add API key to HEADERS when configured', async () => {
    configure(settings => {
      settings.authentication.type = 'api-key';
      settings.authentication.apiKey = 'X-Custom-Auth';
      settings.authentication.apiValue = 'secret-value';
      settings.authentication.addTo = 'header';
    });
    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data');

    await south['handleApiKeyAuth'](options, url);

    assert.notStrictEqual(options.headers, undefined);
    assert.strictEqual((options.headers as Record<string, string>)['X-Custom-Auth'], 'secret-value');
    assert.strictEqual(url.searchParams.has('X-Custom-Auth'), false);
  });

  it('should add API key to QUERY PARAMS when configured', async () => {
    configure(settings => {
      settings.authentication.type = 'api-key';
      settings.authentication.apiKey = 'api_key';
      settings.authentication.apiValue = 'secret-value';
      settings.authentication.addTo = 'query-params';
    });
    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data?existing=true');

    await south['handleApiKeyAuth'](options, url);

    assert.strictEqual(url.searchParams.get('api_key'), 'secret-value');
    assert.strictEqual(url.searchParams.get('existing'), 'true');
    assert.strictEqual(options.headers, undefined);
  });

  it('should NOT modify options or url if authentication is NOT api-key', async () => {
    configure(settings => {
      settings.authentication.type = 'basic';
      settings.authentication.apiKey = 'should-ignore';
      settings.authentication.apiValue = 'should-ignore';
    });
    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data');

    await south['handleApiKeyAuth'](options, url);

    assert.strictEqual(options.headers, undefined);
    assert.strictEqual(url.searchParams.toString(), '');
  });

  it('should NOT modify options or url if apiKey or apiValue are missing', async () => {
    const configuration = configure(settings => {
      settings.authentication.type = 'api-key';
      settings.authentication.addTo = 'header';
    });
    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data');

    configuration.settings.authentication.apiKey = '';
    configuration.settings.authentication.apiValue = 'some-value';
    await south['handleApiKeyAuth'](options, url);
    assert.strictEqual(options.headers, undefined);

    configuration.settings.authentication.apiKey = 'some-key';
    configuration.settings.authentication.apiValue = '';
    await south['handleApiKeyAuth'](options, url);
    assert.strictEqual(options.headers, undefined);
  });

  it('should append to existing headers object if it already exists', async () => {
    configure(settings => {
      settings.authentication.type = 'api-key';
      settings.authentication.apiKey = 'X-Auth';
      settings.authentication.apiValue = 'secret-value';
      settings.authentication.addTo = 'header';
    });
    const options: ReqOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    const url = new URL('https://api.example.com/data');

    await south['handleApiKeyAuth'](options, url);

    assertContains(options.headers as object, {
      'Content-Type': 'application/json',
      'X-Auth': 'secret-value'
    });
  });
});
