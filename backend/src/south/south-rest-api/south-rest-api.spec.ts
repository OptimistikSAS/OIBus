import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import SouthRestAPI from './south-rest-api';
import { SouthRestAPIItemSettings, SouthRestAPISettings } from '../../../shared/model/south-settings.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import pino from 'pino';
import testData from '../../tests/utils/test-data';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import fs from 'node:fs/promises';
import { HTTPRequest, ReqOptions } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import * as utils from '../../service/utils';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { Stats } from 'node:fs';
import { OIBusRawContent } from '../../../shared/model/engine.model';

// --- Mocks ---
jest.mock('../../service/utils', () => {
  const actualUtils = jest.requireActual('../../service/utils');
  return {
    ...actualUtils,
    formatInstant: jest.fn((instant: string) => instant), // Simple identity mock by default
    convertDateTimeToInstant: jest.fn(val => {
      // Mock conversion for trackMaxInstant logic
      if (val === '2024-01-01') return testData.constants.dates.DATE_1;
      if (val === '2024-01-02') return testData.constants.dates.DATE_2;
      return 0;
    }),
    generateRandomId: jest.fn(() => 'random-id'),
    sanitizeFilename: jest.fn(name => name)
  };
});
jest.mock('../../service/http-request.utils');
jest.mock('node:fs/promises');

const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();
const fsMock = jest.mocked(fs, { shallow: false });
const httpRequestMock = HTTPRequest as jest.MockedFunction<typeof HTTPRequest>;
const formatInstantMock = utils.formatInstant as jest.Mock;

// --- Test Data Helpers ---
const baseConfiguration: SouthConnectorEntity<SouthRestAPISettings, SouthRestAPIItemSettings> = {
  id: 'south-rest',
  name: 'REST',
  type: 'rest-api',
  description: 'Rest connector',
  enabled: true,
  settings: {
    throttling: { maxReadInterval: 900, readDelay: 5, overlap: 10 },
    host: 'https://api.example.com/',
    acceptUnauthorized: true,
    authentication: 'basic',
    username: 'rest-user',
    password: 'rest-password',
    token: 'bearer-token',
    test: { endpoint: '/health', method: 'GET', successCode: 200 },
    timeout: 15,
    useProxy: false
  },
  items: []
};

const createConfiguration = () => structuredClone(baseConfiguration);
const createItem = (overrides?: Partial<SouthRestAPIItemSettings>): SouthConnectorItemEntity<SouthRestAPIItemSettings> => ({
  id: 'item-1',
  name: 'Test Item',
  enabled: true,
  scanMode: testData.scanMode.list[0],
  settings: {
    endpoint: '/data',
    method: 'GET',
    returnType: 'body',
    queryParams: [],
    headers: [],
    trackingInstant: { trackInstant: false },
    ...overrides
  }
});

const getRequestOptions = (index = 0): ReqOptions => httpRequestMock.mock.calls[index][1] as ReqOptions;

describe('SouthRestAPI connector', () => {
  let south: SouthRestAPI;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    // Default mocks
    fsMock.writeFile.mockResolvedValue();
    fsMock.stat.mockResolvedValue({ size: 100 } as Stats);
    southCacheService.getSouthCache.mockReturnValue({ southId: 'south-rest', scanModeId: 'mode-1', maxInstant: null });

    const config = createConfiguration();
    south = new SouthRestAPI(config, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // 1. Connection Testing (Existing + Refined)
  // --------------------------------------------------------------------------

  it('should test connection successfully', async () => {
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, 'OK'));
    await expect(south.testConnection()).resolves.not.toThrow();
  });

  it('should fail test connection on HTTP error', async () => {
    httpRequestMock.mockResolvedValueOnce(createMockResponse(500, 'Server Error'));
    await expect(south.testConnection()).rejects.toThrow('HTTP request failed with status code 500');
  });

  it('should fail test connection on fetch error', async () => {
    httpRequestMock.mockRejectedValueOnce(new Error('http error'));
    await expect(south.testConnection()).rejects.toThrow('Fetch error: http error');
  });

  it('should handle API Key authentication in query params', async () => {
    const config = createConfiguration();
    config.settings.authentication = 'api-key';
    config.settings.apiKey = 'api_key';
    config.settings.apiValue = 'secret';
    config.settings.addTo = 'query-params';
    config.settings.test.method = 'POST';
    config.settings.test.body = 'body';

    south = new SouthRestAPI(config, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, 'OK'));

    await south.testConnection();

    const url = httpRequestMock.mock.calls[0][0] as URL;
    expect(url.searchParams.get('api_key')).toBe('secret'); // Decrypted by mock is just the text
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

    formatInstantMock.mockReturnValueOnce(testData.constants.dates.DATE_1).mockReturnValueOnce(testData.constants.dates.DATE_2);
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, { data: [] }));

    await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    const options = getRequestOptions();
    expect(options.query).toEqual({
      start: testData.constants.dates.DATE_1,
      end: testData.constants.dates.DATE_2
    });
  });

  it('should replace @StartTime and @EndTime in Headers', async () => {
    const item = createItem({
      headers: [
        { key: 'X-Time-From', value: 'From @StartTime', dateTimeType: 'iso-string' },
        { key: 'X-Time-To', value: 'From @EndTime', dateTimeType: 'iso-string' }
      ]
    });

    formatInstantMock.mockReturnValueOnce('2024-01-01').mockReturnValueOnce('2025-01-01');
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, {}));

    await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    const options = getRequestOptions();
    expect(options.headers).toMatchObject({
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

    formatInstantMock.mockReturnValueOnce('START').mockReturnValueOnce('END');
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, {}));

    await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    const options = getRequestOptions();
    expect(options.body).toBe('{"from": "START", "to": "END"}');
    expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('should not replace @StartTime and @EndTime in Body for POST requests', async () => {
    const item = createItem({
      method: 'POST',
      body: {
        content: '{"from": "StartTime", "to": "EndTime"}'
      }
    });

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, {}));

    await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    const options = getRequestOptions();
    expect(formatInstantMock).not.toHaveBeenCalled();
    expect(options.body).toBe('{"from": "StartTime", "to": "EndTime"}');
    expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('should handle XML response types', async () => {
    const item = createItem({ returnType: 'body' }); // Hint logic mostly relies on content-type header
    const xmlContent = '<root>data</root>';

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, xmlContent, { 'content-type': 'application/xml' }));

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    expect(result.filename).toContain('.xml');
    expect(result.content).toBe(xmlContent);
  });

  it('should handle file downloads (returnType = file)', async () => {
    const item = createItem({ returnType: 'file' });

    // Mock response with arrayBuffer for file
    const mockRes = createMockResponse(200, 'file-content', { 'content-disposition': 'attachment; filename="report.pdf"' });

    httpRequestMock.mockResolvedValueOnce(mockRes);

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    // Filename sanitized
    expect(result.filename).toBe('"report.pdf"');
    // Content as string (connector logic converts buffer to string currently)
    expect(result.content).toBe('file-content');
    expect(result.maxInstant).toBeNull();
  });

  it('should handle file downloads (returnType = file) without filename', async () => {
    const item = createItem({ returnType: 'file' });

    // Mock response with arrayBuffer for file
    const mockRes = createMockResponse(200, 'file-content', { 'content-disposition': 'attachment; file="report.pdf"' });

    httpRequestMock.mockResolvedValueOnce(mockRes);

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    // Filename sanitized
    expect(result.filename).toBe('REST-Test Item-random-id');
    // Content as string (connector logic converts buffer to string currently)
    expect(result.content).toBe('file-content');
    expect(result.maxInstant).toBeNull();
  });

  it('should handle file downloads (returnType = file) without content disposition', async () => {
    const item = createItem({ returnType: 'file' });

    // Mock response with arrayBuffer for file
    const mockRes = createMockResponse(200, 'file-content', {});

    httpRequestMock.mockResolvedValueOnce(mockRes);

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    // Filename sanitized
    expect(result.filename).toBe('REST-Test Item-random-id');
    // Content as string (connector logic converts buffer to string currently)
    expect(result.content).toBe('file-content');
    expect(result.maxInstant).toBeNull();
  });

  it('should parse JSON string response manually if content-type is missing/text', async () => {
    const item = createItem();
    const jsonString = '{"manual": "parse"}';

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, jsonString, { 'content-type': 'text/plain' }));

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    expect(result.content).toEqual({ manual: 'parse' }); // It was parsed to object
    expect(result.filename).toContain('.json');
  });

  it('should parse string response manually if content-type is missing/text', async () => {
    const item = createItem();
    const jsonString = '1';

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, jsonString, { 'content-type': 'text/plain' }));

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    expect(result.content).toEqual('1');
    expect(result.filename).toEqual('REST-Test Item-random-id.json');
  });

  it('should return raw content if parse fails', async () => {
    const item = createItem();
    const jsonString = '{]';

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, jsonString, { 'content-type': 'text/plain' }));

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    expect(result.content).toEqual('{]');
    expect(result.filename).toEqual('REST-Test Item-random-id');
  });

  it('should throw error if queryData response is not OK', async () => {
    const item = createItem();
    httpRequestMock.mockResolvedValueOnce(createMockResponse(404, 'Not Found'));

    await expect(south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2)).rejects.toThrow(
      'HTTP request failed with status code 404'
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
      items: [
        { date: '2024-01-01' },
        { date: '2024-01-02' } // This is the max
      ]
    };

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, responseData, { 'content-type': 'application/json' }));

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    // See mock at top: 2024-01-02 -> testData.constants.dates.DATE_2
    expect(result.maxInstant).toBe(testData.constants.dates.DATE_2);
  });

  it('should return null max instant if json path finds nothing', async () => {
    const item = createItem({
      trackingInstant: {
        trackInstant: true,
        jsonPath: '$.missing',
        dateTimeInput: { type: 'iso-string' }
      }
    });

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, { data: [] }, { 'content-type': 'application/json' }));
    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    expect(result.maxInstant).toBeNull();
  });

  it('should return null max instant if not tracking instant with json result', async () => {
    const item = createItem({
      trackingInstant: {
        trackInstant: false
      }
    });

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, { data: [] }, { 'content-type': 'application/json' }));
    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    expect(result.maxInstant).toBeNull();
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
      items: [
        { date: '2024-01-01' },
        { date: '2024-01-02' }, // This is the max
        { date: null },
        { date: '2024-01-01' }
      ]
    });

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, responseData, { 'content-type': 'application/text' }));

    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    // See mock at top: 2024-01-02 -> testData.constants.dates.DATE_2
    expect(result.maxInstant).toBe(testData.constants.dates.DATE_2);
  });

  it('should return null max instant if json path finds nothing from text', async () => {
    const item = createItem({
      trackingInstant: {
        trackInstant: true,
        jsonPath: '$.missing',
        dateTimeInput: { type: 'iso-string' }
      }
    });

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, { data: [] }, { 'content-type': 'application/text' }));
    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    expect(result.maxInstant).toBeNull();
  });

  it('should return null max instant if not tracking instant with text result', async () => {
    const item = createItem({
      trackingInstant: {
        trackInstant: false
      }
    });

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, { data: [] }, { 'content-type': 'application/text' }));
    const result = await south.queryData(item, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    expect(result.maxInstant).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 4. History Query & File Handling
  // --------------------------------------------------------------------------

  it('should execute historyQuery for multiple items and save content', async () => {
    const item1 = createItem({ endpoint: '/item1' });
    const item2 = createItem({ endpoint: '/item2' });

    // Mock two responses
    south.queryData = jest
      .fn()
      .mockResolvedValueOnce({ filename: 'REST-Test Item-random-id.json', content: 'content', maxInstant: testData.constants.dates.DATE_2 })
      .mockResolvedValueOnce({
        filename: 'REST-Test Item-random-id.json',
        content: 'content',
        maxInstant: testData.constants.dates.DATE_1
      });

    await south.historyQuery([item1, item2], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    // Verify file writes
    expect(fsMock.writeFile).toHaveBeenCalledTimes(2);
    // Verify engine callback
    expect(addContentCallback).toHaveBeenCalledTimes(2);
    // Verify first call arguments for addContent
    expect(addContentCallback).toHaveBeenCalledWith(
      'south-rest',
      expect.objectContaining({ type: 'any', filePath: expect.stringContaining('REST-Test Item-random-id.json') })
    );
  });

  it('should get settings', async () => {
    const config = createConfiguration();
    expect(south.getThrottlingSettings(config.settings)).toEqual({
      maxReadInterval: config.settings.throttling.maxReadInterval,
      readDelay: config.settings.throttling.readDelay
    });
    expect(south.getMaxInstantPerItem(config.settings)).toEqual(true);
    expect(south.getOverlap(config.settings)).toEqual(config.settings.throttling.overlap);
  });

  it('should update maxInstant across multiple items in historyQuery', async () => {
    const item1 = createItem({
      trackingInstant: { trackInstant: true, jsonPath: '$', dateTimeInput: { type: 'iso-string' } }
    });

    // Mock response that triggers max instant logic (mocked to return specific number)
    // The connector calls queryData, which calls trackMaxInstant.
    // We'll trust the trackMaxInstant integration tested above.
    // Here we ensure historyQuery picks the max of the results.

    // item 1 returns null maxInstant (e.g. empty)
    // item 2 returns 5000 (mocking queryData return logic via spy would be cleaner, but we integrate)

    // Let's Spy on queryData to control return strictly
    const querySpy = jest.spyOn(south, 'queryData');
    querySpy
      .mockResolvedValueOnce({ filename: 'f1', content: '', maxInstant: testData.constants.dates.DATE_1 })
      .mockResolvedValueOnce({ filename: 'f2', content: '', maxInstant: testData.constants.dates.DATE_2 });

    const result = await south.historyQuery([item1, item1], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
    expect(result).toBe(testData.constants.dates.DATE_2);
  });

  it('should not add content if file is empty', async () => {
    const item = createItem();
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, {}));

    // fs.stat returns size 0
    fsMock.stat.mockResolvedValueOnce({ size: 0 } as Stats);

    await south.historyQuery([item], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);

    expect(fsMock.writeFile).toHaveBeenCalled();
    expect(addContentCallback).not.toHaveBeenCalled(); // Skipped because size 0
  });

  // --------------------------------------------------------------------------
  // 5. Test Item (Single Item Test)
  // --------------------------------------------------------------------------

  it('should test a single item', async () => {
    const item = createItem();
    const testingSettings: SouthConnectorItemTestingSettings = {
      history: { startTime: testData.constants.dates.DATE_1, endTime: testData.constants.dates.DATE_2 }
    };

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, { test: 'ok' }, { 'content-type': 'application/json' }));

    const result = await south.testItem(item, testingSettings);

    expect(result.type).toBe('any');
    expect(result.content).toEqual(JSON.stringify({ test: 'ok' }));
    expect((result as OIBusRawContent).filePath).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 6. Test Proxy options and authorizations
  // --------------------------------------------------------------------------

  it('should not get proxy if proxy url is not specified', async () => {
    const config = createConfiguration();
    config.settings.useProxy = true;
    south['connector'] = config;
    expect(() => south['getProxyOptions']()).toThrow(new Error('Proxy URL not specified'));
  });

  it('should get proxy', async () => {
    const config = createConfiguration();
    config.settings.useProxy = true;
    config.settings.proxyUrl = 'http://localhost:8080/';
    south['connector'] = config;
    expect(south['getProxyOptions']()).toEqual({
      proxy: { url: 'http://localhost:8080/' },
      acceptUnauthorized: config.settings.acceptUnauthorized
    });
  });

  it('should get proxy with auth', async () => {
    const config = createConfiguration();
    config.settings.useProxy = true;
    config.settings.proxyUrl = 'http://localhost:8080/';
    config.settings.proxyUsername = 'username';
    config.settings.proxyPassword = 'password';
    south['connector'] = config;
    expect(south['getProxyOptions']()).toEqual({
      proxy: { url: 'http://localhost:8080/', auth: { type: 'url', username: 'username', password: 'password' } },
      acceptUnauthorized: config.settings.acceptUnauthorized
    });
  });

  it('should get basic auth', async () => {
    const config = createConfiguration();
    config.settings.authentication = 'basic';
    config.settings.username = 'username';
    config.settings.password = 'password';
    south['connector'] = config;
    expect(await south['getAuthorizationOptions']()).toEqual({
      type: 'basic',
      username: 'username',
      password: 'password'
    });
  });

  it('should not get basic auth if no username', async () => {
    const config = createConfiguration();
    config.settings.authentication = 'basic';
    config.settings.username = '';
    south['connector'] = config;
    expect(await south['getAuthorizationOptions']()).toEqual(undefined);
  });

  it('should get bearer auth', async () => {
    const config = createConfiguration();
    config.settings.authentication = 'bearer';
    config.settings.token = 'token';
    south['connector'] = config;
    expect(await south['getAuthorizationOptions']()).toEqual({
      type: 'bearer',
      token: 'token'
    });
  });

  it('should not get bearer auth if no token', async () => {
    const config = createConfiguration();
    config.settings.authentication = 'bearer';
    config.settings.token = '';
    south['connector'] = config;
    expect(await south['getAuthorizationOptions']()).toEqual(undefined);
  });

  it('should not get auth if api-key', async () => {
    const config = createConfiguration();
    config.settings.authentication = 'api-key';
    south['connector'] = config;
    expect(await south['getAuthorizationOptions']()).toEqual(undefined);
  });

  it('should not get auth if none', async () => {
    const config = createConfiguration();
    config.settings.authentication = 'none';
    south['connector'] = config;
    expect(await south['getAuthorizationOptions']()).toEqual(undefined);
  });

  it('should add API key to HEADERS when configured', async () => {
    // 1. Setup Configuration
    const config = createConfiguration();
    config.settings.authentication = 'api-key';
    config.settings.apiKey = 'X-Custom-Auth';
    config.settings.apiValue = 'secret-value';
    config.settings.addTo = 'header';
    south['connector'] = config;

    // 2. Prepare Inputs
    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data');

    // 3. Execute (access private method via casting)
    await south['handleApiKeyAuth'](options, url);

    // 4. Assert
    expect(options.headers).toBeDefined();
    expect((options.headers as Record<string, string>)['X-Custom-Auth']).toBe('secret-value');
    expect(url.searchParams.has('X-Custom-Auth')).toBe(false);
  });

  it('should add API key to QUERY PARAMS when configured', async () => {
    // 1. Setup Configuration
    const config = createConfiguration();
    config.settings.authentication = 'api-key';
    config.settings.apiKey = 'api_key';
    config.settings.apiValue = 'secret-value';
    config.settings.addTo = 'query-params';
    south['connector'] = config;

    // 2. Prepare Inputs with existing params to ensure append works
    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data?existing=true');

    // 3. Execute
    await south['handleApiKeyAuth'](options, url);

    // 4. Assert
    expect(url.searchParams.get('api_key')).toBe('secret-value');
    expect(url.searchParams.get('existing')).toBe('true'); // Should preserve existing params
    expect(options.headers).toBeUndefined();
  });

  it('should NOT modify options or url if authentication is NOT api-key', async () => {
    // 1. Setup Configuration (Basic Auth)
    const config = createConfiguration();
    config.settings.authentication = 'basic';
    config.settings.apiKey = 'should-ignore'; // Even if these are present
    config.settings.apiValue = 'should-ignore';
    south['connector'] = config;

    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data');

    await south['handleApiKeyAuth'](options, url);

    // Assert nothing changed
    expect(options.headers).toBeUndefined();
    expect(url.searchParams.toString()).toBe('');
  });

  it('should NOT modify options or url if apiKey or apiValue are missing', async () => {
    const config = createConfiguration();
    config.settings.authentication = 'api-key';
    config.settings.addTo = 'header';
    south['connector'] = config;

    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data');

    // Case 1: Missing Key
    config.settings.apiKey = '';
    config.settings.apiValue = 'some-value';
    await south['handleApiKeyAuth'](options, url);
    expect(options.headers).toBeUndefined();

    // Case 2: Missing Value
    config.settings.apiKey = 'some-key';
    config.settings.apiValue = '';
    await south['handleApiKeyAuth'](options, url);
    expect(options.headers).toBeUndefined();
  });

  it('should append to existing headers object if it already exists', async () => {
    const config = createConfiguration();
    config.settings.authentication = 'api-key';
    config.settings.apiKey = 'X-Auth';
    config.settings.apiValue = 'secret-value';
    config.settings.addTo = 'header';
    south['connector'] = config;

    // Pre-fill headers (e.g. Content-Type)
    const options: ReqOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    const url = new URL('https://api.example.com/data');

    await south['handleApiKeyAuth'](options, url);

    expect(options.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Auth': 'secret-value'
    });
  });
});
