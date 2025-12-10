import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import SouthRestAPI from './south-rest-api';
import { SouthRestAPIItemSettings, SouthRestAPISettings } from '../../../shared/model/south-settings.model';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import pino from 'pino';
import testData from '../../tests/utils/test-data';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { HTTPRequest, ReqOptions } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import * as utils from '../../service/utils';

jest.mock('../../service/utils', () => {
  const actualUtils = jest.requireActual('../../service/utils');
  return {
    ...actualUtils,
    formatInstant: jest.fn((instant: string) => instant)
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

const baseConfiguration: SouthConnectorEntity<SouthRestAPISettings, SouthRestAPIItemSettings> = {
  id: 'south-rest',
  name: 'REST',
  type: 'rest-api',
  description: 'Rest connector',
  enabled: true,
  settings: {
    throttling: {
      maxReadInterval: 900,
      readDelay: 5,
      overlap: 10
    },
    host: 'https://api.example.com/',
    acceptUnauthorized: true,
    authentication: 'basic',
    username: 'rest-user',
    password: 'rest-password',
    token: 'bearer-token',
    test: {
      endpoint: '/health',
      method: 'GET',
      successCode: 200
    },
    timeout: 15,
    useProxy: true,
    proxyUrl: 'http://proxy.local:8080',
    proxyUsername: 'proxy-user',
    proxyPassword: 'proxy-pass'
  },
  items: []
};

const createConfiguration = (): SouthConnectorEntity<SouthRestAPISettings, SouthRestAPIItemSettings> => structuredClone(baseConfiguration);

const getRequestOptions = (index: number): ReqOptions => {
  const call = httpRequestMock.mock.calls[index];
  if (!call) {
    throw new Error(`Missing HTTP request call at index ${index}`);
  }
  return call[1] as ReqOptions;
};

describe('SouthRestAPI connector', () => {
  let south: SouthRestAPI;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    formatInstantMock.mockImplementation((instant: string) => instant);
    fsMock.writeFile.mockResolvedValue();
    fsMock.stat.mockResolvedValue({ size: 42 } as unknown as Stats);
    southCacheService.getSouthCache.mockReturnValue({
      southId: 'south-rest',
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: null
    });

    const configuration = createConfiguration();
    south = new SouthRestAPI(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should expose throttling metadata', () => {
    const settings = south['connector'].settings;
    expect(south.getThrottlingSettings(settings)).toEqual({
      maxReadInterval: settings.throttling.maxReadInterval,
      readDelay: settings.throttling.readDelay
    });
    expect(south.getMaxInstantPerItem(settings)).toBe(true);
    expect(south.getOverlap(settings)).toBe(settings.throttling.overlap);
  });

  it('should test connection and propagate HTTP failures', async () => {
    httpRequestMock
      .mockResolvedValueOnce(createMockResponse(200, {}, { 'content-type': 'application/json' }))
      .mockResolvedValueOnce(createMockResponse(500, 'fatal', { 'content-type': 'text/plain' }));

    await expect(south.testConnection()).resolves.not.toThrow();
    const firstOptions = getRequestOptions(0);
    expect((httpRequestMock.mock.calls[0][0] as URL).toString()).toBe('https://api.example.com/health');
    expect(firstOptions).toMatchObject({
      method: 'GET',
      proxy: { url: 'http://proxy.local:8080', auth: { type: 'url', username: 'proxy-user', password: 'proxy-pass' } },
      acceptUnauthorized: true,
      timeout: 15000,
      auth: { type: 'basic', username: 'rest-user', password: 'rest-password' }
    });

    await expect(south.testConnection()).rejects.toThrow('HTTP request failed with status code 500, expected 200. Message: "fatal"');
  });

  it('should fall back to default test settings when optional fields are missing', async () => {
    const configuration = createConfiguration();
    configuration.settings.test.endpoint = '';
    configuration.settings.test.method = undefined as unknown as 'GET';
    configuration.settings.test.successCode = 0;
    configuration.settings.authentication = 'none';
    const instance = new SouthRestAPI(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, {}, { 'content-type': 'application/json' }));

    await expect(instance.testConnection()).resolves.not.toThrow();
    const [url, options] = httpRequestMock.mock.calls[0];
    expect((url as URL).toString()).toBe('https://api.example.com/');
    expect((options as ReqOptions).method).toBe('GET');
  });

  it('should surface fetch errors during test connection', async () => {
    httpRequestMock.mockRejectedValueOnce(new Error('network'));
    await expect(south.testConnection()).rejects.toThrow('Fetch error Error: network');
  });

  it('should reject when proxy configuration is incomplete', async () => {
    const configuration = createConfiguration();
    configuration.settings.useProxy = true;
    configuration.settings.proxyUrl = undefined;
    const instance = new SouthRestAPI(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    await expect(instance.testConnection()).rejects.toThrow('Proxy URL not specified');
  });

  it('should include body when testing POST or PUT methods', async () => {
    const configuration = createConfiguration();
    configuration.settings.test.method = 'POST';
    configuration.settings.test.body = '{"test": "data"}';
    const instance = new SouthRestAPI(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    httpRequestMock.mockResolvedValueOnce(createMockResponse(200, {}, { 'content-type': 'application/json' }));

    await expect(instance.testConnection()).resolves.not.toThrow();
    const [url, options] = httpRequestMock.mock.calls[0];
    expect((url as URL).toString()).toBe('https://api.example.com/health');
    expect((options as ReqOptions).method).toBe('POST');
    expect((options as ReqOptions).body).toBe('{"test": "data"}');
  });

  it('should return undefined auth when authentication is api-key', async () => {
    const configuration = createConfiguration();
    configuration.settings.authentication = 'api-key';
    configuration.settings.apiKey = 'X-API-Key';
    configuration.settings.apiValue = 'encrypted-api-value';
    configuration.settings.addTo = 'header';
    const instance = new SouthRestAPI(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');

    const response = createMockResponse(200, [], { 'content-type': 'application/json' });
    httpRequestMock.mockResolvedValueOnce(response);

    await instance.testConnection();
    const options = getRequestOptions(httpRequestMock.mock.calls.length - 1);
    expect(options.auth).toBeUndefined();
  });
});
