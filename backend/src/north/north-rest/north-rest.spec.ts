import assert from 'node:assert/strict';
import { ReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { NorthRESTSettings } from '../../../shared/model/connector/north-settings.model';
import type { CacheMetadata } from '../../../shared/model/domain/engine.model';

import type * as HttpRequestUtils from '../../service/http-request.utils';
import { createCacheServiceMock } from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import { assertContains, buildNorthEntity, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type NorthRESTClass from './north-rest';

const nodeRequire = createRequire(import.meta.url);

// The stream is only handed to the (mocked) HTTP request, never read
const fileStream = {} as ReadStream;
const metadata = (contentFile: string): CacheMetadata => ({
  contentFile,
  contentSize: 0,
  numberOfElement: 0,
  createdAt: '',
  contentType: 'any'
});

const buildConfiguration = (settings: Partial<NorthRESTSettings> = {}) =>
  buildNorthEntity<NorthRESTSettings>('rest', {
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
    },
    ...settings
  });

describe('NorthREST', () => {
  let NorthREST: typeof NorthRESTClass;
  let north: NorthRESTClass;

  let HTTPRequest: Mock<typeof HttpRequestUtils.HTTPRequest>;
  const httpRequestExports: typeof HttpRequestUtils = { ...nodeRequire('../../service/http-request.utils') };

  const createNorth = (settings: Partial<NorthRESTSettings> = {}) => {
    north = new NorthREST(buildConfiguration(settings), createCacheServiceMock());
  };

  before(() => {
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: { decryptText: async (text: string) => text }
    });
    // No transformation here: don't pay for loading every transformer
    mockModule(nodeRequire, '../../service/transformer.service', {});
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => new PinoLogger() },
      default: class {}
    });

    NorthREST = reloadModule<{ default: typeof NorthRESTClass }>(nodeRequire, './north-rest').default;
  });

  beforeEach(() => {
    HTTPRequest = mock.fn(async () => createMockResponse(200, 'OK'));
    httpRequestExports.HTTPRequest = HTTPRequest;
    createNorth();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should return any', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['any']);
  });

  it('should test connection successfully', async () => {
    const testResult = await north.testConnection();

    const [url, options] = HTTPRequest.mock.calls[0].arguments;
    assert.strictEqual(url.toString(), 'https://api.example.com/health');
    assert.strictEqual(options?.method, 'GET');
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
    HTTPRequest.mock.mockImplementationOnce(async () => createMockResponse(500, 'Error'));

    await assert.rejects(north.testConnection(), /HTTP request failed with status code 500/);
  });

  it('should fail test connection on fetch error', async () => {
    HTTPRequest.mock.mockImplementationOnce(async () => {
      throw new Error('Network error');
    });
    await assert.rejects(north.testConnection(), /Fetch error: Network error/);
  });

  it('should use Basic Auth', async () => {
    createNorth({ authentication: { type: 'basic', username: 'u', password: 'p' } });

    await north.testConnection();

    assert.deepStrictEqual(HTTPRequest.mock.calls[0].arguments[1]?.auth, { type: 'basic', username: 'u', password: 'p' });
  });

  it('should use Bearer Token', async () => {
    createNorth({ authentication: { type: 'bearer', token: 'my-token' } });

    await north.testConnection();

    assert.deepStrictEqual(HTTPRequest.mock.calls[0].arguments[1]?.auth, { type: 'bearer', token: 'my-token' });
  });

  it('should handle API Key in Header', async () => {
    createNorth({ authentication: { type: 'api-key', apiKey: 'X-API-Key', apiValue: 'secret', addTo: 'header' } });

    await north.testConnection();

    assertContains(HTTPRequest.mock.calls[0].arguments[1]?.headers, { 'X-API-Key': 'secret' });
  });

  it('should handle API Key in Query Params', async () => {
    createNorth({ authentication: { type: 'api-key', apiKey: 'api_key', apiValue: 'secret', addTo: 'query-params' } });

    await north.testConnection();

    const url = HTTPRequest.mock.calls[0].arguments[0] as URL;
    assert.strictEqual(url.searchParams.get('api_key'), 'secret');
  });

  it('should upload file successfully via multipart stream', async () => {
    createNorth({
      authentication: { type: 'none' },
      headers: [{ key: 'X-Custom', value: 'custom' }],
      queryParams: [{ key: 'q1', value: 'v1' }]
    });
    HTTPRequest.mock.mockImplementationOnce(async () => createMockResponse(201, 'Created'));

    await north.handleContent(fileStream, metadata('file.txt'));

    const [url, options] = HTTPRequest.mock.calls[0].arguments;
    assert.strictEqual(url.toString(), 'https://api.example.com/upload');
    assert.ok((options?.headers as Record<string, string>)['content-type'].startsWith('multipart/form-data; boundary=OIBusBoundary'));
    assertContains(options?.headers, { 'X-Custom': 'custom' });
    assertContains(options?.query, { q1: 'v1' });
  });

  for (const [format, contentFile, contentType] of [
    ['JSON', 'file.json', 'application/json'],
    ['TXT', 'file.txt', 'text/plain'],
    ['CSV', 'file.csv', 'text/csv']
  ]) {
    it(`should upload file successfully via raw body (${format})`, async () => {
      north.connectorConfiguration.settings.sendAs = 'body';
      HTTPRequest.mock.mockImplementationOnce(async () => createMockResponse(201, 'Created'));

      await north.handleContent(fileStream, metadata(contentFile));

      const [url, options] = HTTPRequest.mock.calls[0].arguments;
      assert.strictEqual(url.toString(), 'https://api.example.com/upload');
      assertContains(options?.headers, { 'content-type': contentType });
    });
  }

  it('should upload file via raw body (XML) and manage http error', async () => {
    north.connectorConfiguration.settings.sendAs = 'body';
    HTTPRequest.mock.mockImplementationOnce(async () => {
      throw new Error('http error');
    });

    await assert.rejects(
      north.handleContent(fileStream, metadata('file.xml')),
      new Error('Failed to reach file endpoint "https://api.example.com/upload": http error')
    );

    const [url, options] = HTTPRequest.mock.calls[0].arguments;
    assert.strictEqual(url.toString(), 'https://api.example.com/upload');
    assertContains(options?.headers, { 'content-type': 'application/xml' });
  });

  it('should actually stream file content through the multipart generator', async () => {
    // The mocked HTTPRequest never consumes the body, so the multipart async-generator never
    // iterates the source stream by itself. Use a real async-iterable stream and drain the resulting body manually.
    const realFileStream = Readable.from([Buffer.from('chunk-a'), Buffer.from('chunk-b')]) as unknown as ReadStream;

    await north.handleContent(realFileStream, metadata('real-file.txt'));

    const chunks: Array<Buffer> = [];
    for await (const chunk of HTTPRequest.mock.calls[0].arguments[1]?.body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const full = Buffer.concat(chunks).toString();
    assert.ok(full.includes('chunk-a'));
    assert.ok(full.includes('chunk-b'));
  });

  it('should handle upload failures (HTTP 500)', async () => {
    HTTPRequest.mock.mockImplementationOnce(async () => createMockResponse(500, 'Server Error'));

    await assert.rejects(north.handleContent(fileStream, metadata('file.txt')), /HTTP request failed with status code 500/);
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
