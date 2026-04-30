import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { ReadStream } from 'node:fs';
import {mockModule, reloadModule, buildNorthEntity, assertContains} from '../../tests/utils/test-utils';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import type { NorthRESTSettings } from '../../../shared/model/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/engine.model';
import type { ReqOptions } from '../../service/http-request.utils';
import type NorthRESTClass from './north-rest';

const nodeRequire = createRequire(import.meta.url);

class MockReadStream extends EventEmitter {
  closed = false;
  destroyed = false;
  path: string;

  constructor(filePath: string) {
    super();
    this.path = filePath;
  }

  pipe<T>(dest: T): T {
    return dest;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

describe('NorthREST', () => {
  let NorthREST: typeof NorthRESTClass;
  let north: NorthRESTClass;

  const logger = new PinoLogger();
  const cacheService = new CacheServiceMock();

  const httpRequestMock = mock.fn(async () => createMockResponse(200, 'OK'));
  const streamToStringMock = mock.fn(async () => '');
  const encryptionDecryptTextMock = mock.fn(async (text: string) => text);

  const httpRequestExports = {
    __esModule: true,
    HTTPRequest: httpRequestMock,
    retryableHttpStatusCodes: [429, 500, 502, 503, 504]
  };

  const utilsExports = {
    __esModule: true,
    streamToString: streamToStringMock
  };

  const encryptionExports = {
    __esModule: true,
    encryptionService: {
      decryptText: encryptionDecryptTextMock
    }
  };

  const cronExports = {
    CronJob: mock.fn(function () {
      return { stop: mock.fn(), start: mock.fn() };
    })
  };

  before(() => {
    mockModule(nodeRequire, 'cron', cronExports);
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/encryption.service', encryptionExports);
    mockModule(nodeRequire, '../../service/cache/cache.service', {
      __esModule: true,
      default: function () {
        return cacheService;
      }
    });
    NorthREST = reloadModule<{ default: typeof NorthRESTClass }>(nodeRequire, './north-rest').default;
  });

  beforeEach(() => {
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();
    httpRequestMock.mock.resetCalls();
    streamToStringMock.mock.resetCalls();
    encryptionDecryptTextMock.mock.resetCalls();

    httpRequestMock.mock.mockImplementation(async () => createMockResponse(200, 'OK'));
    encryptionDecryptTextMock.mock.mockImplementation(async (text: string) => text);

    const configuration = buildNorthEntity<NorthRESTSettings>('rest', {
      host: 'https://api.example.com/',
      endpoint: '/upload',
      method: 'POST',
      timeout: 30,
      acceptUnauthorized: true,
      authentication: {
        type: 'basic',
        username: 'user',
        password: 'password',
        token: 'token',
        apiKey: 'api-key',
        apiValue: 'encrypted-value',
        addTo: 'header'
      },
      headers: [],
      queryParams: [],
      successCode: 200,
      proxy: { useProxy: false },
      sendAs: 'file',
      test: {
        testEndpoint: '/health',
        testMethod: 'GET',
        testSuccessCode: 200
      }
    });

    north = new NorthREST(configuration, logger, cacheService);
  });

  afterEach(() => {
    mock.restoreAll();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should return any', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['any']);
  });

  it('should test connection successfully', async () => {
    const testResult = await north.testConnection();

    const [url, options] = httpRequestMock.mock.calls[0].arguments as [URL, ReqOptions];
    assert.strictEqual(url.toString(), 'https://api.example.com/health');
    assert.strictEqual(options.method, 'GET');
    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'URL', value: 'https://api.example.com/health' },
        { key: 'Status Code', value: '200' }
      ]
    });
  });

  it('should fail test connection if status code does not match', async () => {
    north.connectorConfiguration.settings.test.testSuccessCode = 200;
    north.connectorConfiguration.settings.test.testMethod = 'POST';
    north.connectorConfiguration.settings.test.body = 'test';
    httpRequestMock.mock.mockImplementationOnce(async () => createMockResponse(500, 'Error'));

    await assert.rejects(async () => north.testConnection(), /HTTP request failed with status code 500/);
  });

  it('should fail test connection on fetch error', async () => {
    httpRequestMock.mock.mockImplementationOnce(async () => {
      throw new Error('Network error');
    });
    await assert.rejects(async () => north.testConnection(), /Fetch error: Network error/);
  });

  it('should use Basic Auth', async () => {
    const configuration = buildNorthEntity<NorthRESTSettings>('rest', {
      host: 'https://api.example.com/',
      endpoint: '/upload',
      method: 'POST',
      timeout: 30,
      acceptUnauthorized: true,
      authentication: { type: 'basic', username: 'u', password: 'p' },
      headers: [],
      queryParams: [],
      successCode: 200,
      proxy: { useProxy: false },
      sendAs: 'file',
      test: { testEndpoint: '/health', testMethod: 'GET', testSuccessCode: 200 }
    });
    north = new NorthREST(configuration, logger, cacheService);

    await north.testConnection();

    const options = httpRequestMock.mock.calls[0].arguments[1] as ReqOptions;
    assert.deepStrictEqual(options.auth, { type: 'basic', username: 'u', password: 'p' });
  });

  it('should use Bearer Token', async () => {
    const configuration = buildNorthEntity<NorthRESTSettings>('rest', {
      host: 'https://api.example.com/',
      endpoint: '/upload',
      method: 'POST',
      timeout: 30,
      acceptUnauthorized: true,
      authentication: { type: 'bearer', token: 'my-token' },
      headers: [],
      queryParams: [],
      successCode: 200,
      proxy: { useProxy: false },
      sendAs: 'file',
      test: { testEndpoint: '/health', testMethod: 'GET', testSuccessCode: 200 }
    });
    north = new NorthREST(configuration, logger, cacheService);

    await north.testConnection();

    const options = httpRequestMock.mock.calls[0].arguments[1] as ReqOptions;
    assert.deepStrictEqual(options.auth, { type: 'bearer', token: 'my-token' });
  });

  it('should handle API Key in Header', async () => {
    const configuration = buildNorthEntity<NorthRESTSettings>('rest', {
      host: 'https://api.example.com/',
      endpoint: '/upload',
      method: 'POST',
      timeout: 30,
      acceptUnauthorized: true,
      authentication: { type: 'api-key', apiKey: 'X-API-Key', apiValue: 'secret', addTo: 'header' },
      headers: [],
      queryParams: [],
      successCode: 200,
      proxy: { useProxy: false },
      sendAs: 'file',
      test: { testEndpoint: '/health', testMethod: 'GET', testSuccessCode: 200 }
    });
    north = new NorthREST(configuration, logger, cacheService);

    await north.testConnection();

    const options = httpRequestMock.mock.calls[0].arguments[1] as ReqOptions;
    assertContains(options.headers as Record<string, unknown>, { 'X-API-Key': 'secret' });
  });

  it('should handle API Key in Query Params', async () => {
    const configuration = buildNorthEntity<NorthRESTSettings>('rest', {
      host: 'https://api.example.com/',
      endpoint: '/upload',
      method: 'POST',
      timeout: 30,
      acceptUnauthorized: true,
      authentication: { type: 'api-key', apiKey: 'api_key', apiValue: 'secret', addTo: 'query-params' },
      headers: [],
      queryParams: [],
      successCode: 200,
      proxy: { useProxy: false },
      sendAs: 'file',
      test: { testEndpoint: '/health', testMethod: 'GET', testSuccessCode: 200 }
    });
    north = new NorthREST(configuration, logger, cacheService);

    await north.testConnection();

    const url = httpRequestMock.mock.calls[0].arguments[0] as URL;
    assert.strictEqual((url as URL).searchParams.get('api_key'), 'secret');
  });

  it('should upload file successfully via multipart stream', async () => {
    const configuration = buildNorthEntity<NorthRESTSettings>('rest', {
      host: 'https://api.example.com/',
      endpoint: '/upload',
      method: 'POST',
      timeout: 30,
      acceptUnauthorized: true,
      authentication: { type: 'none' },
      headers: [{ key: 'X-Custom', value: 'custom' }],
      queryParams: [{ key: 'q1', value: 'v1' }],
      successCode: 200,
      proxy: { useProxy: false },
      sendAs: 'file',
      test: { testEndpoint: '/health', testMethod: 'GET', testSuccessCode: 200 }
    });
    north = new NorthREST(configuration, logger, cacheService);

    httpRequestMock.mock.mockImplementationOnce(async () => createMockResponse(201, 'Created'));

    const mockStream = new MockReadStream('path/to/file.txt') as unknown as ReadStream;

    await north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.txt' } as CacheMetadata);

    const [url, options] = httpRequestMock.mock.calls[0].arguments as [URL, ReqOptions];
    assert.strictEqual(url.toString(), 'https://api.example.com/upload');
    assert.ok((options.headers as Record<string, string>)['content-type'].startsWith('multipart/form-data; boundary=OIBusBoundary'));
    assertContains(options.headers as Record<string, unknown>, { 'X-Custom': 'custom' });
    assertContains(options.query as Record<string, unknown>, { q1: 'v1' });
  });

  it('should upload file successfully via raw body (JSON)', async () => {
    north.connectorConfiguration.settings.sendAs = 'body';

    httpRequestMock.mock.mockImplementationOnce(async () => createMockResponse(201, 'Created'));
    const mockStream = new MockReadStream('file.json') as unknown as ReadStream;

    await north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.json' } as CacheMetadata);

    const [url, options] = httpRequestMock.mock.calls[0].arguments as [URL, ReqOptions];
    assert.strictEqual(url.toString(), 'https://api.example.com/upload');
    assertContains(options.headers as Record<string, unknown>, { 'content-type': 'application/json' });
  });

  it('should upload file via raw body (XML) and manage http error', async () => {
    north.connectorConfiguration.settings.sendAs = 'body';

    httpRequestMock.mock.mockImplementationOnce(async () => {
      throw new Error('http error');
    });
    const mockStream = new MockReadStream('file.xml') as unknown as ReadStream;

    await assert.rejects(
      async () => north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.xml' } as CacheMetadata),
      new Error('Failed to reach file endpoint "https://api.example.com/upload": http error')
    );

    const [url, options] = httpRequestMock.mock.calls[0].arguments as [URL, ReqOptions];
    assert.strictEqual(url.toString(), 'https://api.example.com/upload');
    assertContains(options.headers as Record<string, unknown>, { 'content-type': 'application/xml' });
  });

  it('should upload file successfully via raw body (TXT)', async () => {
    north.connectorConfiguration.settings.sendAs = 'body';

    httpRequestMock.mock.mockImplementationOnce(async () => createMockResponse(201, 'Created'));
    const mockStream = new MockReadStream('file.txt') as unknown as ReadStream;

    await north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.txt' } as CacheMetadata);

    const [url, options] = httpRequestMock.mock.calls[0].arguments as [URL, ReqOptions];
    assert.strictEqual(url.toString(), 'https://api.example.com/upload');
    assertContains(options.headers as Record<string, unknown>, { 'content-type': 'text/plain' });
  });

  it('should upload file successfully via raw body (CSV)', async () => {
    north.connectorConfiguration.settings.sendAs = 'body';

    httpRequestMock.mock.mockImplementationOnce(async () => createMockResponse(201, 'Created'));
    const mockStream = new MockReadStream('file.csv') as unknown as ReadStream;

    await north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.csv' } as CacheMetadata);

    const options = httpRequestMock.mock.calls[0].arguments[1] as ReqOptions;
    assertContains(options.headers as Record<string, unknown>, { 'content-type': 'text/csv' });
  });

  it('should handle upload failures (HTTP 500)', async () => {
    httpRequestMock.mock.mockImplementationOnce(async () => createMockResponse(500, 'Server Error'));
    const mockStream = new MockReadStream('file.txt') as unknown as ReadStream;

    await assert.rejects(
      async () => north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.txt' } as CacheMetadata),
      /HTTP request failed with status code 500/
    );
  });

  it('should properly handle api key with existing headers', async () => {
    north.connectorConfiguration.settings.authentication.type = 'api-key';
    north.connectorConfiguration.settings.authentication.addTo = 'header';
    north.connectorConfiguration.settings.authentication.apiKey = 'key';
    north.connectorConfiguration.settings.authentication.apiValue = 'value';
    const url = new URL('https://api.example.com/upload');
    const reqOptions = { headers: {} };
    await north['handleApiKeyAuth'](reqOptions, url);
    assert.strictEqual(url.toString(), 'https://api.example.com/upload');
    assert.deepStrictEqual(reqOptions, { headers: { key: 'value' } });
  });

  it('should properly handle empty basic auth', async () => {
    north.connectorConfiguration.settings.authentication.type = 'basic';
    north.connectorConfiguration.settings.authentication.username = '';

    assert.strictEqual(await north['getAuthorizationOptions'](), undefined);
  });

  it('should properly handle empty bearer token', async () => {
    north.connectorConfiguration.settings.authentication.type = 'bearer';
    north.connectorConfiguration.settings.authentication.token = '';

    assert.strictEqual(await north['getAuthorizationOptions'](), undefined);
  });

  it('should not get proxy if proxy url is not specified', () => {
    north.connectorConfiguration.settings.proxy.useProxy = true;
    north.connectorConfiguration.settings.proxy.proxyUrl = '';

    assert.throws(() => north['getProxyOptions'](), /Proxy URL not specified/);
  });

  it('should get proxy configuration', () => {
    north.connectorConfiguration.settings.proxy.useProxy = true;
    north.connectorConfiguration.settings.proxy.proxyUrl = 'http://proxy:8080';
    north.connectorConfiguration.settings.proxy.proxyUsername = 'user';
    north.connectorConfiguration.settings.proxy.proxyPassword = 'pass';

    const result = north['getProxyOptions']();
    assert.deepStrictEqual(result.proxy, {
      url: 'http://proxy:8080',
      auth: { type: 'url', username: 'user', password: 'pass' }
    });
  });

  it('should get proxy configuration without username', () => {
    north.connectorConfiguration.settings.proxy.useProxy = true;
    north.connectorConfiguration.settings.proxy.proxyUrl = 'http://proxy:8080';

    const result = north['getProxyOptions']();
    assert.deepStrictEqual(result.proxy, { url: 'http://proxy:8080' });
  });

  it('should manage error', () => {
    assert.strictEqual(north['getMessageFromError']('error'), 'error');
    assert.strictEqual(north['getMessageFromError'](new Error('error')), 'error');
    assert.strictEqual(
      north['getMessageFromError'](new AggregateError([{ message: 'error', code: 500 }, { error: 'ignored error' }])),
      'message: error, code: 500'
    );
  });
});
