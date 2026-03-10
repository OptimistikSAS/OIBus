import NorthREST from './north-rest';
import { NorthRESTSettings } from '../../../shared/model/north-settings.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import pino from 'pino';
import CacheService from '../../service/cache/cache.service';
import { HTTPRequest, ReqOptions } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import { ReadStream } from 'node:fs';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { CacheMetadata } from '../../../shared/model/engine.model';
import FormData from 'form-data';
import EventEmitter from 'node:events';
import { buildNorthConfiguration } from '../../tests/utils/test-utils';

// --- Mocks ---
jest.mock('../../service/http-request.utils');
jest.mock('../../service/utils');
jest.mock('form-data');
// Mock encryption service
jest.mock('../../service/encryption.service', () => ({
  encryptionService: {
    decryptText: jest.fn().mockImplementation(text => Promise.resolve(text))
  }
}));

const logger: pino.Logger = new PinoLogger();
const cacheService: CacheService = new CacheServiceMock() as unknown as CacheService;
const httpRequestMock = HTTPRequest as jest.MockedFunction<typeof HTTPRequest>;

// Mock Stream Implementation
class MockReadStream extends EventEmitter {
  closed = false;
  destroyed = false;
  path: string;

  constructor(path: string) {
    super();
    this.path = path;
  }

  pipe<T>(dest: T) {
    return dest;
  }
  destroy() {
    this.destroyed = true;
  }
}

describe('NorthREST', () => {
  let north: NorthREST;
  let configuration: NorthConnectorEntity<NorthRESTSettings>;

  beforeEach(() => {
    jest.clearAllMocks();

    configuration = buildNorthConfiguration<NorthRESTSettings>('rest', {
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

    // Default mocks
    httpRequestMock.mockResolvedValue(createMockResponse(200, 'OK'));
    (FormData as unknown as jest.Mock).mockImplementation(() => ({
      append: jest.fn(),
      getHeaders: jest.fn().mockReturnValue({ 'content-type': 'multipart/form-data; boundary=---' })
    }));

    north = new NorthREST(configuration, logger, cacheService);
  });

  afterEach(async () => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should return any', () => {
    expect(north.supportedTypes()).toEqual(['any']);
  });

  it('should test connection successfully', async () => {
    const testResult = await north.testConnection();

    const [url, options] = httpRequestMock.mock.calls[0];
    expect(url.toString()).toBe('https://api.example.com/health');
    expect(options!.method).toBe('GET');
    expect(testResult).toEqual({
      items: [
        { key: 'URL', value: 'https://api.example.com/health' },
        { key: 'Status Code', value: '200' }
      ]
    });
  });

  it('should fail test connection if status code does not match', async () => {
    configuration.settings.test.testSuccessCode = 200;
    configuration.settings.test.testMethod = 'POST';
    configuration.settings.test.body = 'test';
    httpRequestMock.mockResolvedValueOnce(createMockResponse(500, 'Error'));

    await expect(north.testConnection()).rejects.toThrow('HTTP request failed with status code 500');
  });

  it('should fail test connection on fetch error', async () => {
    httpRequestMock.mockRejectedValueOnce(new Error('Network error'));
    await expect(north.testConnection()).rejects.toThrow('Fetch error: Network error');
  });

  it('should use Basic Auth', async () => {
    configuration.settings.authentication = { type: 'basic', username: 'u', password: 'p' };
    north = new NorthREST(configuration, logger, cacheService);

    await north.testConnection();

    const options = httpRequestMock.mock.calls[0][1] as ReqOptions;
    expect(options.auth).toEqual({ type: 'basic', username: 'u', password: 'p' });
  });

  it('should use Bearer Token', async () => {
    configuration.settings.authentication = { type: 'bearer', token: 'my-token' };
    north = new NorthREST(configuration, logger, cacheService);

    await north.testConnection();

    const options = httpRequestMock.mock.calls[0][1] as ReqOptions;
    expect(options.auth).toEqual({ type: 'bearer', token: 'my-token' });
  });

  it('should handle API Key in Header', async () => {
    configuration.settings.authentication = { type: 'api-key', apiKey: 'X-API-Key', apiValue: 'secret', addTo: 'header' };
    north = new NorthREST(configuration, logger, cacheService);

    await north.testConnection();

    const options = httpRequestMock.mock.calls[0][1] as ReqOptions;
    expect(options.headers).toMatchObject({ 'X-API-Key': 'secret' });
  });

  it('should handle API Key in Query Params', async () => {
    configuration.settings.authentication = { type: 'api-key', apiKey: 'api_key', apiValue: 'secret', addTo: 'query-params' };
    north = new NorthREST(configuration, logger, cacheService);

    await north.testConnection();

    const url = httpRequestMock.mock.calls[0][0];
    expect((url as URL).searchParams.get('api_key')).toBe('secret');
  });

  it('should upload file successfully via FormData', async () => {
    configuration.settings.queryParams = [{ key: 'q1', value: 'v1' }];
    configuration.settings.headers = [{ key: 'X-Custom', value: 'custom' }];
    configuration.settings.sendAs = 'file';
    configuration.settings.authentication.type = 'none';
    north = new NorthREST(configuration, logger, cacheService);

    httpRequestMock.mockResolvedValueOnce(createMockResponse(201, 'Created'));

    const mockStream = new MockReadStream('path/to/file.txt') as unknown as ReadStream;

    await north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.txt' } as CacheMetadata);

    const [url, options] = httpRequestMock.mock.calls[0];

    // Check URL & Query Params
    expect(url.toString()).toBe('https://api.example.com/upload');

    // Check Headers
    expect(options!.headers).toMatchObject({ 'X-Custom': 'custom', 'content-type': 'multipart/form-data; boundary=---' });
    expect(options!.query).toMatchObject({ q1: 'v1' });

    // Verify FormData append
    const formDataInstance = (FormData as unknown as jest.Mock).mock.results[0].value;
    expect(formDataInstance.append).toHaveBeenCalledWith('file', mockStream, { filename: 'file.txt' });
  });

  it('should upload file successfully via raw body (JSON)', async () => {
    configuration.settings.sendAs = 'body';
    north = new NorthREST(configuration, logger, cacheService);

    httpRequestMock.mockResolvedValueOnce(createMockResponse(201, 'Created'));
    const mockStream = new MockReadStream('file.json') as unknown as ReadStream;

    await expect(north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.json' } as CacheMetadata)).resolves.not.toThrow();

    const [url, options] = httpRequestMock.mock.calls[0];
    expect(url!.toString()).toEqual('https://api.example.com/upload');
    expect(options!.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('should upload file via raw body (XML) and manage http error', async () => {
    configuration.settings.sendAs = 'body';
    north = new NorthREST(configuration, logger, cacheService);

    httpRequestMock.mockRejectedValueOnce(new Error('http error'));
    const mockStream = new MockReadStream('file.xml') as unknown as ReadStream;

    await expect(north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.xml' } as CacheMetadata)).rejects.toThrow(
      new Error('Failed to reach file endpoint "https://api.example.com/upload": http error')
    );

    const [url, options] = httpRequestMock.mock.calls[0];
    expect(url!.toString()).toEqual('https://api.example.com/upload');
    expect(options!.headers).toMatchObject({ 'content-type': 'application/xml' });
  });

  it('should upload file successfully via raw body (TXT)', async () => {
    configuration.settings.sendAs = 'body';
    north = new NorthREST(configuration, logger, cacheService);

    httpRequestMock.mockResolvedValueOnce(createMockResponse(201, 'Created'));
    const mockStream = new MockReadStream('file.txt') as unknown as ReadStream;

    await expect(north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.txt' } as CacheMetadata)).resolves.not.toThrow();
    const [url, options] = httpRequestMock.mock.calls[0];
    expect(url!.toString()).toEqual('https://api.example.com/upload');
    expect(options!.headers).toMatchObject({ 'content-type': 'text/plain' });
  });

  it('should upload file successfully via raw body (CSV)', async () => {
    configuration.settings.sendAs = 'body';
    north = new NorthREST(configuration, logger, cacheService);

    httpRequestMock.mockResolvedValueOnce(createMockResponse(201, 'Created'));
    const mockStream = new MockReadStream('file.csv') as unknown as ReadStream;

    await expect(north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.csv' } as CacheMetadata)).resolves.not.toThrow();
    const [url, options] = httpRequestMock.mock.calls[0];
    expect(url!.toString()).toEqual('https://api.example.com/upload');
    expect(options!.headers).toMatchObject({ 'content-type': 'text/csv' });
  });

  it('should upload file successfully via raw body (CSV)', async () => {
    configuration.settings.sendAs = 'body';
    north = new NorthREST(configuration, logger, cacheService);

    httpRequestMock.mockResolvedValueOnce(createMockResponse(201, 'Created'));
    const mockStream = new MockReadStream('file.csv') as unknown as ReadStream;

    await north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.csv' } as CacheMetadata);

    expect((httpRequestMock.mock.calls[0][1] as ReqOptions).headers).toMatchObject({ 'content-type': 'text/csv' });
  });

  it('should handle upload failures (HTTP 500)', async () => {
    httpRequestMock.mockResolvedValueOnce(createMockResponse(500, 'Server Error'));
    const mockStream = new MockReadStream('file.txt') as unknown as ReadStream;

    await expect(north.handleContent(mockStream, { contentType: 'any', contentFile: 'file.txt' } as CacheMetadata)).rejects.toThrow(
      'HTTP request failed with status code 500'
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
    expect(url.toString()).toEqual('https://api.example.com/upload');
    expect(reqOptions).toEqual({ headers: { key: 'value' } });
  });

  it('should properly handle empty basic auth', async () => {
    north.connectorConfiguration.settings.authentication.type = 'basic';
    north.connectorConfiguration.settings.authentication.username = '';

    expect(await north['getAuthorizationOptions']()).toBe(undefined);
  });

  it('should properly handle empty bearer token', async () => {
    north.connectorConfiguration.settings.authentication.type = 'bearer';
    north.connectorConfiguration.settings.authentication.token = '';

    expect(await north['getAuthorizationOptions']()).toBe(undefined);
  });

  it('should not get proxy if proxy url is not specified', async () => {
    configuration.settings.proxy.useProxy = true;
    configuration.settings.proxy.proxyUrl = '';
    north = new NorthREST(configuration, logger, cacheService);

    expect(() => north['getProxyOptions']()).toThrow('Proxy URL not specified');
  });

  it('should get proxy configuration', async () => {
    configuration.settings.proxy.useProxy = true;
    configuration.settings.proxy.proxyUrl = 'http://proxy:8080';
    configuration.settings.proxy.proxyUsername = 'user';
    configuration.settings.proxy.proxyPassword = 'pass';
    north = new NorthREST(configuration, logger, cacheService);

    const result = north['getProxyOptions']();
    expect(result.proxy).toEqual({
      url: 'http://proxy:8080',
      auth: { type: 'url', username: 'user', password: 'pass' }
    });
  });

  it('should get proxy configuration without username', async () => {
    configuration.settings.proxy.useProxy = true;
    configuration.settings.proxy.proxyUrl = 'http://proxy:8080';
    north = new NorthREST(configuration, logger, cacheService);

    const result = north['getProxyOptions']();
    expect(result.proxy).toEqual({
      url: 'http://proxy:8080'
    });
  });

  it('should manage error', () => {
    expect(north['getMessageFromError']('error')).toEqual('error');
    expect(north['getMessageFromError'](new Error('error'))).toEqual('error');
    expect(north['getMessageFromError'](new AggregateError([{ message: 'error', code: 500 }, { error: 'ignored error' }]))).toEqual(
      'message: error, code: 500'
    );
  });
});
