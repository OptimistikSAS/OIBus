import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import NorthREST from './north-rest';
import { NorthRESTSettings } from '../../../shared/model/north-settings.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import pino from 'pino';
import CacheService from '../../service/cache/cache.service';
import { HTTPRequest, ReqOptions } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import * as utils from '../../service/utils';
import fs from 'node:fs';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import testData from '../../tests/utils/test-data';
import { CacheMetadata } from '../../../shared/model/engine.model';
import path from 'node:path';

// --- Mocks ---
jest.mock('../../service/http-request.utils');
jest.mock('../../service/utils');
// We need to mock 'fs' or specific functions. 'createReadStream' is used for FormData.
jest.mock('node:fs', () => {
  return {
    ...jest.requireActual('node:fs'),
    createReadStream: jest.fn()
  };
});

// Mock Encryption Service for Auth tests
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

class CustomError extends Error {
  constructor(message: string, code?: string | number) {
    super(message);
    this.code = code || '';
  }
  code: string | number;
}

const logger: pino.Logger = new PinoLogger();
const cacheService: CacheService = new CacheServiceMock() as unknown as CacheService;
const httpRequestMock = HTTPRequest as jest.MockedFunction<typeof HTTPRequest>;
const filesExistsMock = utils.filesExists as jest.Mock;
const createReadStreamMock = fs.createReadStream as jest.Mock;

// --- Test Data Helpers ---
const baseConfiguration: NorthConnectorEntity<NorthRESTSettings> = {
  id: 'north-rest',
  name: 'REST North',
  type: 'rest',
  description: 'Generic REST North',
  enabled: true,
  settings: {
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
    proxy: {
      useProxy: false
    },
    sendAs: 'file',
    test: {
      testEndpoint: '/health',
      testMethod: 'GET',
      testSuccessCode: 200
    }
  },
  caching: {
    trigger: {
      scanMode: testData.scanMode.list[0],
      numberOfElements: 250,
      numberOfFiles: 1
    },
    throttling: {
      runMinDelay: 200,
      maxSize: 30,
      maxNumberOfElements: 10_000
    },
    error: {
      retryInterval: 1_000,
      retryCount: 3,
      retentionDuration: 24
    },
    archive: {
      enabled: false,
      retentionDuration: 72
    }
  },
  subscriptions: [],
  transformers: []
};

const createConfiguration = (overrides?: Partial<NorthRESTSettings>): NorthConnectorEntity<NorthRESTSettings> => {
  const config = structuredClone(baseConfiguration);
  if (overrides) {
    Object.assign(config.settings, overrides);
    // Ensure proxy object structure is updated if useProxy is toggled
    if (overrides.proxy?.useProxy && !config.settings.proxy) {
      config.settings.proxy = { useProxy: true };
    }
  }
  return config;
};

const getRequestOptions = (index = 0): ReqOptions => {
  const call = httpRequestMock.mock.calls[index];
  if (!call) throw new Error(`No call at index ${index}`);
  return call[1] as ReqOptions;
};

const myReadStream = {
  pipe: jest.fn().mockReturnThis(),
  on: jest.fn().mockImplementation((_event, handler) => {
    handler();
    return this;
  }),
  pause: jest.fn(),
  close: jest.fn(),
  closed: false
};

describe('NorthREST connector', () => {
  let north: NorthREST;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    filesExistsMock.mockResolvedValue(true);

    createReadStreamMock.mockReturnValue(myReadStream);

    const config = createConfiguration();
    north = new NorthREST(config, logger, 'cacheFolder', cacheService);
  });

  // --------------------------------------------------------------------------
  // 1. Connection Testing
  // --------------------------------------------------------------------------

  it('should test connection successfully', async () => {
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, 'OK'));
    await expect(north.testConnection()).resolves.not.toThrow();

    const [url, options] = httpRequestMock.mock.calls[0];
    expect(url.toString()).toBe('https://api.example.com/health');
    expect(options!.method).toBe('GET');
  });

  it('should fail test connection if status code does not match', async () => {
    const config = createConfiguration();
    config.settings.test.testMethod = 'POST';
    config.settings.test.body = 'body';
    north['connector'] = config;
    httpRequestMock.mockResolvedValueOnce(createMockResponse(500, 'Error'));
    await expect(north.testConnection()).rejects.toThrow('HTTP request failed with status code 500');
  });

  afterEach(async () => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should fail test connection on fetch error', async () => {
    httpRequestMock.mockRejectedValueOnce(new Error('Network error'));
    await expect(north.testConnection()).rejects.toThrow('Fetch error: Network error');
  });

  // --------------------------------------------------------------------------
  // 2. Authentication Logic (Shared by Test & Handle)
  // --------------------------------------------------------------------------

  it('should use Basic Auth', async () => {
    const config = createConfiguration({ authentication: { type: 'basic', username: 'u', password: 'p' } });
    north = new NorthREST(config, logger, 'cacheFolder', cacheService);

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, 'OK'));
    await north.testConnection();

    const options = getRequestOptions();
    expect(options.auth).toEqual({ type: 'basic', username: 'u', password: 'p' });
  });

  it('should use Bearer Token', async () => {
    const config = createConfiguration({ authentication: { type: 'bearer', token: 'my-token' } });
    north = new NorthREST(config, logger, 'cacheFolder', cacheService);

    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, 'OK'));
    await north.testConnection();

    const options = getRequestOptions();
    expect(options.auth).toEqual({ type: 'bearer', token: 'my-token' });
  });

  it('should handle API Key in Header', async () => {
    const config = createConfiguration({
      authentication: { type: 'api-key', apiKey: 'X-API-Key', apiValue: 'secret', addTo: 'header' }
    });

    north = new NorthREST(config, logger, 'cacheFolder', cacheService);
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, 'OK'));

    await north.testConnection();

    const options = getRequestOptions();
    expect(options.auth).toBeUndefined(); // Standard auth field is unused
    expect(options.headers).toMatchObject({ 'X-API-Key': 'secret' });
  });

  it('should handle API Key in Query Params', async () => {
    const config = createConfiguration({
      authentication: { type: 'api-key', apiKey: 'api_key', apiValue: 'secret', addTo: 'query-params' }
    });

    north = new NorthREST(config, logger, 'cacheFolder', cacheService);
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, 'OK'));

    await north.testConnection();

    const [url] = httpRequestMock.mock.calls[0];
    expect((url as URL).searchParams.get('api_key')).toBe('secret');
  });

  // --------------------------------------------------------------------------
  // 3. File Handling (handleContent / handleFile)
  // --------------------------------------------------------------------------

  it('should throw error for unsupported content types', async () => {
    const metadata = { contentType: 'time-values', contentFile: 'test.json' } as CacheMetadata;
    await expect(north.handleContent(metadata)).rejects.toThrow('Unsupported data type');
  });

  it('should throw error if file does not exist', async () => {
    filesExistsMock.mockResolvedValue(false);
    const metadata = { contentType: 'any', contentFile: 'missing.txt' } as CacheMetadata;

    await expect(north.handleContent(metadata)).rejects.toThrow(`File ${path.resolve('missing.txt')} does not exist`);
  });

  it('should upload file successfully via FormData', async () => {
    const config = createConfiguration({
      endpoint: '/upload',
      queryParams: [{ key: 'q1', value: 'v1' }],
      headers: [{ key: 'X-Custom', value: 'custom' }]
    });
    north = new NorthREST(config, logger, 'cacheFolder', cacheService);

    httpRequestMock.mockResolvedValueOnce(createMockResponse(201, 'Created'));

    await north.handleContent({ contentType: 'any', contentFile: path.join('tmp', 'test.txt') } as CacheMetadata);

    const [url, options] = httpRequestMock.mock.calls[0];

    // Check URL & Query Params
    expect(url.toString()).toBe('https://api.example.com/upload');
    expect(options!.query).toEqual({ q1: 'v1' });

    // Check Headers (Custom + FormData headers)
    expect(options!.headers).toMatchObject({ 'X-Custom': 'custom' });
    // FormData headers usually include Content-Type with boundary, hard to match exact string manually
    expect(options!.headers).toHaveProperty('content-type');

    // Check Body (FormData)
    expect(options!.body).toBeDefined();
    // We confirm stream was created with the correct path
    expect(createReadStreamMock).toHaveBeenCalledWith(path.resolve('tmp', 'test.txt'));
    expect(myReadStream.close).toHaveBeenCalled();
  });

  it('should upload file successfully via raw body', async () => {
    const config = createConfiguration({
      endpoint: '/upload',
      sendAs: 'body',
      headers: [{ key: 'X-Custom', value: 'custom' }]
    });
    north = new NorthREST(config, logger, 'cacheFolder', cacheService);

    httpRequestMock.mockResolvedValueOnce(createMockResponse(201, 'Created'));

    await north.handleContent({ contentType: 'any', contentFile: path.join('tmp', 'test.txt') } as CacheMetadata);

    const [url, options] = httpRequestMock.mock.calls[0];
    // Check URL & Query Params
    expect(url.toString()).toBe('https://api.example.com/upload');

    // Check Headers (Custom + FormData headers)
    expect(options!.headers).toMatchObject({ 'X-Custom': 'custom', 'content-type': 'text/plain' });

    // Check Body (FormData)
    expect(options!.body).toBeDefined();
    // We confirm stream was created with the correct path
    expect(createReadStreamMock).toHaveBeenCalledWith(path.resolve('tmp', 'test.txt'));
    expect(myReadStream.close).toHaveBeenCalled();
  });

  it('should upload file successfully via raw body (csv)', async () => {
    const config = createConfiguration({
      endpoint: '/upload',
      sendAs: 'body',
      headers: [{ key: 'X-Custom', value: 'custom' }]
    });
    north = new NorthREST(config, logger, 'cacheFolder', cacheService);

    httpRequestMock.mockResolvedValueOnce(createMockResponse(201, 'Created'));

    await north.handleContent({ contentType: 'any', contentFile: path.join('tmp', 'test.csv') } as CacheMetadata);

    const [url, options] = httpRequestMock.mock.calls[0];
    // Check URL & Query Params
    expect(url.toString()).toBe('https://api.example.com/upload');

    // Check Headers (Custom + FormData headers)
    expect(options!.headers).toMatchObject({ 'X-Custom': 'custom', 'content-type': 'text/csv' });

    // Check Body (FormData)
    expect(options!.body).toBeDefined();
    // We confirm stream was created with the correct path
    expect(createReadStreamMock).toHaveBeenCalledWith(path.resolve('tmp', 'test.csv'));
    expect(myReadStream.close).toHaveBeenCalled();
  });

  it('should upload file successfully via raw body (json)', async () => {
    const config = createConfiguration({
      endpoint: '/upload',
      sendAs: 'body',
      headers: [{ key: 'X-Custom', value: 'custom' }]
    });
    north = new NorthREST(config, logger, 'cacheFolder', cacheService);

    httpRequestMock.mockResolvedValueOnce(createMockResponse(201, 'Created'));

    await north.handleContent({ contentType: 'any', contentFile: path.join('tmp', 'test.json') } as CacheMetadata);

    const [url, options] = httpRequestMock.mock.calls[0];
    // Check URL & Query Params
    expect(url.toString()).toBe('https://api.example.com/upload');

    // Check Headers (Custom + FormData headers)
    expect(options!.headers).toMatchObject({ 'X-Custom': 'custom', 'content-type': 'application/json' });

    // Check Body (FormData)
    expect(options!.body).toBeDefined();
    // We confirm stream was created with the correct path
    expect(createReadStreamMock).toHaveBeenCalledWith(path.resolve('tmp', 'test.json'));
    expect(myReadStream.close).toHaveBeenCalled();
  });

  it('should upload file successfully via raw body (xml)', async () => {
    const config = createConfiguration({
      endpoint: '/upload',
      sendAs: 'body',
      headers: [{ key: 'X-Custom', value: 'custom' }]
    });
    north = new NorthREST(config, logger, 'cacheFolder', cacheService);

    httpRequestMock.mockResolvedValueOnce(createMockResponse(201, 'Created'));

    await north.handleContent({ contentType: 'any', contentFile: path.join('tmp', 'test.xml') } as CacheMetadata);

    const [url, options] = httpRequestMock.mock.calls[0];
    // Check URL & Query Params
    expect(url.toString()).toBe('https://api.example.com/upload');

    // Check Headers (Custom + FormData headers)
    expect(options!.headers).toMatchObject({ 'X-Custom': 'custom', 'content-type': 'application/xml' });

    // Check Body (FormData)
    expect(options!.body).toBeDefined();
    // We confirm stream was created with the correct path
    expect(createReadStreamMock).toHaveBeenCalledWith(path.resolve('tmp', 'test.xml'));
    expect(myReadStream.close).toHaveBeenCalled();
  });

  it('should upload file successfully and not close stream if already closed', async () => {
    const config = createConfiguration({
      endpoint: '/upload',
      queryParams: [{ key: 'q1', value: 'v1' }],
      headers: [{ key: 'X-Custom', value: 'custom' }]
    });
    north = new NorthREST(config, logger, 'cacheFolder', cacheService);
    myReadStream.closed = true;
    httpRequestMock.mockResolvedValueOnce(createMockResponse(201, 'Created'));

    await north.handleContent({ contentType: 'any', contentFile: path.join('tmp', 'test.txt') } as CacheMetadata);

    expect(myReadStream.close).not.toHaveBeenCalled();
    myReadStream.closed = false;
  });

  it('should handle upload failures (HTTP 500)', async () => {
    httpRequestMock.mockResolvedValueOnce(createMockResponse(500, 'Server Error'));

    await expect(north.handleContent({ contentType: 'any', contentFile: path.join('tmp', 'test.txt') } as CacheMetadata)).rejects.toThrow(
      'HTTP request failed with status code 500'
    );
  });

  it('should handle network errors during upload and ensure stream closure', async () => {
    httpRequestMock.mockRejectedValueOnce(new Error('Connection Reset'));

    await expect(north.handleContent({ contentType: 'any', contentFile: path.join('tmp', 'test.txt') } as CacheMetadata)).rejects.toThrow(
      'Failed to reach file endpoint'
    ); // Checks OIBusError wrapping
    expect(myReadStream.close).toHaveBeenCalled();
  });

  it('should handle network errors during upload and do not close stream', async () => {
    myReadStream.closed = true;
    httpRequestMock.mockRejectedValueOnce(new Error('Connection Reset'));

    await expect(north.handleContent({ contentType: 'any', contentFile: path.join('tmp', 'test.txt') } as CacheMetadata)).rejects.toThrow(
      'Failed to reach file endpoint'
    ); // Checks OIBusError wrapping
    expect(myReadStream.close).not.toHaveBeenCalled();
    myReadStream.closed = false;
  });

  // --------------------------------------------------------------------------
  // 4. Test Proxy options and authorizations
  // --------------------------------------------------------------------------

  it('should not get proxy if proxy url is not specified', async () => {
    const config = createConfiguration();
    config.settings.proxy.useProxy = true;
    north['connector'] = config;
    expect(() => north['getProxyOptions']()).toThrow(new Error('Proxy URL not specified'));
  });

  it('should get proxy', async () => {
    const config = createConfiguration();
    config.settings.proxy.useProxy = true;
    config.settings.proxy.proxyUrl = 'http://localhost:8080/';
    north['connector'] = config;
    expect(north['getProxyOptions']()).toEqual({
      proxy: { url: 'http://localhost:8080/' },
      acceptUnauthorized: config.settings.acceptUnauthorized
    });
  });

  it('should get proxy with auth', async () => {
    const config = createConfiguration();
    config.settings.proxy.useProxy = true;
    config.settings.proxy.proxyUrl = 'http://localhost:8080/';
    config.settings.proxy.proxyUsername = 'username';
    config.settings.proxy.proxyPassword = 'password';
    north['connector'] = config;
    expect(north['getProxyOptions']()).toEqual({
      proxy: { url: 'http://localhost:8080/', auth: { type: 'url', username: 'username', password: 'password' } },
      acceptUnauthorized: config.settings.acceptUnauthorized
    });
  });

  it('should get basic auth', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'basic';
    config.settings.authentication.username = 'username';
    config.settings.authentication.password = 'password';
    north['connector'] = config;
    expect(await north['getAuthorizationOptions']()).toEqual({
      type: 'basic',
      username: 'username',
      password: 'password'
    });
  });

  it('should not get basic auth if no username', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'basic';
    config.settings.authentication.username = '';
    north['connector'] = config;
    expect(await north['getAuthorizationOptions']()).toEqual(undefined);
  });

  it('should get bearer auth', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'bearer';
    config.settings.authentication.token = 'token';
    north['connector'] = config;
    expect(await north['getAuthorizationOptions']()).toEqual({
      type: 'bearer',
      token: 'token'
    });
  });

  it('should not get bearer auth if no token', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'bearer';
    config.settings.authentication.token = '';
    north['connector'] = config;
    expect(await north['getAuthorizationOptions']()).toEqual(undefined);
  });

  it('should not get auth if api-key', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'api-key';
    north['connector'] = config;
    expect(await north['getAuthorizationOptions']()).toEqual(undefined);
  });

  it('should not get auth if none', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'none';
    north['connector'] = config;
    expect(await north['getAuthorizationOptions']()).toEqual(undefined);
  });

  it('should add API key to HEADERS when configured', async () => {
    // 1. Setup Configuration
    const config = createConfiguration();
    config.settings.authentication.type = 'api-key';
    config.settings.authentication.apiKey = 'X-Custom-Auth';
    config.settings.authentication.apiValue = 'secret-value';
    config.settings.authentication.addTo = 'header';
    north['connector'] = config;

    // 2. Prepare Inputs
    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data');

    // 3. Execute (access private method via casting)
    await north['handleApiKeyAuth'](options, url);

    // 4. Assert
    expect(options.headers).toBeDefined();
    expect((options.headers as Record<string, string>)['X-Custom-Auth']).toBe('secret-value');
    expect(url.searchParams.has('X-Custom-Auth')).toBe(false);
  });

  it('should add API key to QUERY PARAMS when configured', async () => {
    // 1. Setup Configuration
    const config = createConfiguration();
    config.settings.authentication.type = 'api-key';
    config.settings.authentication.apiKey = 'api_key';
    config.settings.authentication.apiValue = 'secret-value';
    config.settings.authentication.addTo = 'query-params';
    north['connector'] = config;

    // 2. Prepare Inputs with existing params to ensure append works
    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data?existing=true');

    // 3. Execute
    await north['handleApiKeyAuth'](options, url);

    // 4. Assert
    expect(url.searchParams.get('api_key')).toBe('secret-value');
    expect(url.searchParams.get('existing')).toBe('true'); // Should preserve existing params
    expect(options.headers).toBeUndefined();
  });

  it('should NOT modify options or url if authentication is NOT api-key', async () => {
    // 1. Setup Configuration (Basic Auth)
    const config = createConfiguration();
    config.settings.authentication.type = 'basic';
    config.settings.authentication.apiKey = 'should-ignore'; // Even if these are present
    config.settings.authentication.apiValue = 'should-ignore';
    north['connector'] = config;

    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data');

    await north['handleApiKeyAuth'](options, url);

    // Assert nothing changed
    expect(options.headers).toBeUndefined();
    expect(url.searchParams.toString()).toBe('');
  });

  it('should NOT modify options or url if apiKey or apiValue are missing', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'api-key';
    config.settings.authentication.addTo = 'header';
    north['connector'] = config;

    const options: ReqOptions = { method: 'GET' };
    const url = new URL('https://api.example.com/data');

    // Case 1: Missing Key
    config.settings.authentication.apiKey = '';
    config.settings.authentication.apiValue = 'some-value';
    await north['handleApiKeyAuth'](options, url);
    expect(options.headers).toBeUndefined();

    // Case 2: Missing Value
    config.settings.authentication.apiKey = 'some-key';
    config.settings.authentication.apiValue = '';
    await north['handleApiKeyAuth'](options, url);
    expect(options.headers).toBeUndefined();
  });

  it('should append to existing headers object if it already exists', async () => {
    const config = createConfiguration();
    config.settings.authentication.type = 'api-key';
    config.settings.authentication.apiKey = 'X-Auth';
    config.settings.authentication.apiValue = 'secret-value';
    config.settings.authentication.addTo = 'header';
    north['connector'] = config;

    // Pre-fill headers (e.g. Content-Type)
    const options: ReqOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    const url = new URL('https://api.example.com/data');

    await north['handleApiKeyAuth'](options, url);

    expect(options.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Auth': 'secret-value'
    });
  });

  // --------------------------------------------------------------------------
  // 5. Test Error Message
  // --------------------------------------------------------------------------

  it('should stringify non-Error objects', () => {
    // 1. Plain Object
    const resultObj = north['getMessageFromError']({ custom: 'error' });
    expect(resultObj).toBe('{"custom":"error"}');

    // 2. String literal
    const resultStr = north['getMessageFromError']('simple string error');
    expect(resultStr).toBe('"simple string error"');
  });

  it('should format a standard Error with message only', () => {
    const error = new CustomError('Something went wrong');
    const result = north['getMessageFromError'](error);
    expect(result).toBe('message: Something went wrong');
  });

  it('should format an Error with a code', () => {
    const error = new CustomError('Connection failed', 'ECONNRESET');

    const result = north['getMessageFromError'](error);
    expect(result).toBe('message: Connection failed, code: ECONNRESET');
  });

  it('should format an Error with numeric code', () => {
    const error = new CustomError('Http Failure', 500);

    const result = north['getMessageFromError'](error);
    expect(result).toBe('message: Http Failure, code: 500');
  });

  it('should handle AggregateError by including the main error and all children', () => {
    // AggregateError is available in Node.js >= 15.0.0
    const child1 = new Error('Child error 1');
    const child2 = new CustomError('Child error 2', 'CHILD_CODE');

    const aggError = new AggregateError([child1, child2], 'Main Aggregate Error');

    const result = north['getMessageFromError'](aggError);

    // Expectation: Main error first, then children, separated by semi-colons
    const expectedParts = ['message: Main Aggregate Error', 'message: Child error 1', 'message: Child error 2, code: CHILD_CODE'];
    expect(result).toBe(expectedParts.join('; '));
  });

  it('should skip empty messages or codes', () => {
    const error = new Error('');
    // No message, no code -> should return empty string for this specific error part
    // But the loop builds an array. If message/code are falsy, nothing is pushed.

    const result = north['getMessageFromError'](error);
    expect(result).toBe('');
  });

  it('should handle Error with code but no message', () => {
    const error = new CustomError('', 'NO_MSG_CODE');

    const result = north['getMessageFromError'](error);
    expect(result).toBe('code: NO_MSG_CODE');
  });
});
