import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ReadStream } from 'node:fs';
import zlib from 'node:zlib';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, buildNorthEntity, assertContains } from '../../tests/utils/test-utils';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import CertificateRepositoryMock from '../../tests/__mocks__/repository/config/certificate-repository.mock';
import OIAnalyticsRegistrationRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import type { ReqOptions } from '../../service/http-request.utils';
import type { NorthOIAnalyticsSettings } from '../../../shared/model/north-settings.model';
import type NorthOIAnalyticsClass from './north-oianalytics';
import type CertificateRepository from '../../repository/config/certificate.repository';
import type OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';

const nodeRequire = createRequire(import.meta.url);

describe('NorthOIAnalytics', () => {
  let NorthOIAnalytics: typeof NorthOIAnalyticsClass;
  let north: NorthOIAnalyticsClass;

  const logger = new PinoLogger();
  const cacheService = new CacheServiceMock();
  const certificateRepository = new CertificateRepositoryMock() as unknown as CertificateRepository;
  const oIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock() as unknown as OIAnalyticsRegistrationRepository;

  const mockGzipStream = { pipe: mock.fn() };
  const readStreamPipeMock = mock.fn(() => mockGzipStream);
  const mockReadStream = {
    pipe: readStreamPipeMock,
    on: mock.fn(),
    read: mock.fn()
  } as unknown as ReadStream;

  const httpRequestMock = mock.fn(async (_url: URL, _options: ReqOptions) => createMockResponse(200));
  const streamToStringMock = mock.fn(async (_stream: unknown) => 'stream-content-string');

  const buildHttpOptionsMock = mock.fn(async () => ({
    headers: { 'custom-header': 'val' },
    auth: { type: 'basic' },
    timeout: 30000
  }));
  const getHostMock = mock.fn(() => 'https://mock-host');
  const getUrlMock = mock.fn((endpoint: string, host: string) => new URL(endpoint, host));
  const testOIAnalyticsConnectionMock = mock.fn(async () => undefined);

  const createGzipMock = mock.fn(() => mockGzipStream);

  const httpRequestExports = {
    __esModule: true,
    HTTPRequest: httpRequestMock,
    retryableHttpStatusCodes: [429, 500, 502, 503, 504]
  };

  const utilsExports = {
    __esModule: true,
    streamToString: streamToStringMock
  };

  const utilsOIAnalyticsExports = {
    __esModule: true,
    buildHttpOptions: buildHttpOptionsMock,
    getHost: getHostMock,
    getUrl: getUrlMock,
    testOIAnalyticsConnection: testOIAnalyticsConnectionMock
  };

  let configuration: ReturnType<typeof buildNorthEntity<NorthOIAnalyticsSettings>>;

  before(() => {
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/utils-oianalytics', utilsOIAnalyticsExports);
    mockModule(nodeRequire, 'node:fs', { __esModule: true });
    mockModule(nodeRequire, '../../service/cache/cache.service', {
      __esModule: true,
      default: function () {
        return cacheService;
      }
    });
    NorthOIAnalytics = reloadModule<{ default: typeof NorthOIAnalyticsClass }>(nodeRequire, './north-oianalytics').default;
  });

  beforeEach(() => {
    logger.trace.mock.resetCalls();
    logger.debug.mock.resetCalls();
    logger.info.mock.resetCalls();
    logger.warn.mock.resetCalls();
    logger.error.mock.resetCalls();
    httpRequestMock.mock.resetCalls();
    streamToStringMock.mock.resetCalls();
    buildHttpOptionsMock.mock.resetCalls();
    getHostMock.mock.resetCalls();
    getUrlMock.mock.resetCalls();
    testOIAnalyticsConnectionMock.mock.resetCalls();
    createGzipMock.mock.resetCalls();
    readStreamPipeMock.mock.resetCalls();
    (oIAnalyticsRegistrationRepository as unknown as OIAnalyticsRegistrationRepositoryMock).get.mock.resetCalls();

    // node:zlib is a built-in module and cannot be patched via mockModule; use mock.method instead
    mock.method(zlib, 'createGzip', createGzipMock as unknown as typeof zlib.createGzip);

    buildHttpOptionsMock.mock.mockImplementation(async () => ({
      headers: { 'custom-header': 'val' },
      auth: { type: 'basic' },
      timeout: 30000
    }));
    getHostMock.mock.mockImplementation(() => 'https://mock-host');
    getUrlMock.mock.mockImplementation((endpoint: string, host: string) => new URL(endpoint, host));
    httpRequestMock.mock.mockImplementation(async (_url: URL, _options: ReqOptions) => createMockResponse(200));
    streamToStringMock.mock.mockImplementation(async (_stream: unknown) => 'stream-content-string');
    (oIAnalyticsRegistrationRepository as unknown as OIAnalyticsRegistrationRepositoryMock).get.mock.mockImplementation(
      () => testData.oIAnalytics.registration.completed
    );

    configuration = buildNorthEntity<NorthOIAnalyticsSettings>('oianalytics', {
      useOiaModule: false,
      timeout: 30,
      compress: false,
      specificSettings: {
        host: 'https://mock-host',
        acceptUnauthorized: true,
        authentication: 'basic',
        accessKey: 'user',
        secretKey: 'pass',
        useProxy: false
      }
    });

    north = new NorthOIAnalytics(configuration, logger, cacheService, certificateRepository, oIAnalyticsRegistrationRepository);
  });

  afterEach(() => {
    mock.restoreAll();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should properly call test utils function', async () => {
    await north.testConnection();

    assert.strictEqual(testOIAnalyticsConnectionMock.mock.calls.length, 1);
    assert.deepStrictEqual(testOIAnalyticsConnectionMock.mock.calls[0].arguments, [
      configuration.settings.useOiaModule,
      testData.oIAnalytics.registration.completed,
      configuration.settings.specificSettings,
      configuration.settings.timeout * 1000,
      certificateRepository,
      false
    ]);
  });

  it('should return correct types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['any', 'time-values', 'oianalytics']);
  });

  describe('handleValues (time-values/oianalytics)', () => {
    const metadata = {
      contentFile: 'file.json',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values'
    };

    it('should send values as JSON without compression', async () => {
      await north.handleContent(mockReadStream, metadata);

      assert.strictEqual(streamToStringMock.mock.calls.length, 1);
      assert.deepStrictEqual(streamToStringMock.mock.calls[0].arguments, [mockReadStream]);

      assert.strictEqual(httpRequestMock.mock.calls.length, 1);
      const [url, options] = httpRequestMock.mock.calls[0].arguments as [URL, ReqOptions];
      assert.ok(url.href.includes('/api/oianalytics/oibus/time-values'));
      assertContains(options, { body: 'stream-content-string' });
      assertContains(options.headers as Record<string, unknown>, { 'Content-Type': 'application/json' });
      assertContains(options.query as Record<string, unknown>, { dataSourceId: configuration.name });
    });

    it('should send values with compression if enabled', async () => {
      north['connector'].settings.compress = true;

      await north.handleContent(mockReadStream, metadata);

      assert.strictEqual(readStreamPipeMock.mock.calls.length, 1);
      assert.strictEqual(createGzipMock.mock.calls.length, 1);
      assert.deepStrictEqual(createGzipMock.mock.calls[0].arguments, [{ level: 9 }]);

      assert.strictEqual(streamToStringMock.mock.calls.length, 1);
      assert.deepStrictEqual(streamToStringMock.mock.calls[0].arguments, [mockGzipStream]);

      assert.strictEqual(httpRequestMock.mock.calls.length, 1);
      const [url] = httpRequestMock.mock.calls[0].arguments as [URL, ReqOptions];
      assert.ok(url.href.includes('/api/oianalytics/oibus/time-values/compressed'));
    });

    it('should throw OIBusError on fetch failure', async () => {
      httpRequestMock.mock.mockImplementation(async (_url: URL, _options: ReqOptions) => {
        throw new Error('Network Error');
      });
      await assert.rejects(async () => north.handleContent(mockReadStream, metadata), /Fail to reach values endpoint/);
    });

    it('should throw OIBusError on non-ok response', async () => {
      httpRequestMock.mock.mockImplementation(async (_url: URL, _options: ReqOptions) => createMockResponse(500, 'Internal Server Error'));
      await assert.rejects(async () => north.handleContent(mockReadStream, metadata), /Error 500: Internal Server Error/);
    });
  });

  describe('handleFile (any)', () => {
    const metadata = {
      contentFile: 'test-file.txt',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: 'date',
      contentType: 'any'
    };

    it('should upload file using multipart stream', async () => {
      mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

      await north.handleContent(mockReadStream, metadata);

      assert.strictEqual(httpRequestMock.mock.calls.length, 1);
      const [url, options] = httpRequestMock.mock.calls[0].arguments as [URL, ReqOptions];
      assert.ok(url.href.includes('/api/oianalytics/file-uploads'));
      assertContains(options.query as Record<string, unknown>, { dataSourceId: configuration.name });
      assert.ok((options.headers as Record<string, string>)['content-type'].startsWith('multipart/form-data; boundary=OIBusBoundary'));

      mock.timers.reset();
    });

    it('should compress file if enabled and not .gz', async () => {
      north['connector'].settings.compress = true;

      await north.handleContent(mockReadStream, metadata);

      assert.strictEqual(readStreamPipeMock.mock.calls.length, 1);
      assert.strictEqual(createGzipMock.mock.calls.length, 1);
      assert.deepStrictEqual(createGzipMock.mock.calls[0].arguments, [{ level: 9 }]);

      assert.strictEqual(httpRequestMock.mock.calls.length, 1);
      const [url, options] = httpRequestMock.mock.calls[0].arguments as [URL, ReqOptions];
      assert.ok(url.href.includes('/api/oianalytics/file-uploads'));
      assert.ok((options.headers as Record<string, string>)['content-type'].startsWith('multipart/form-data; boundary=OIBusBoundary'));
    });

    it('should NOT compress file if enabled but already .gz', async () => {
      north['connector'].settings.compress = true;
      const gzMetadata = { ...metadata, contentFile: 'archive.tar.gz' };

      await north.handleContent(mockReadStream, gzMetadata);

      assert.strictEqual(readStreamPipeMock.mock.calls.length, 0);
      assert.strictEqual(createGzipMock.mock.calls.length, 0);

      assert.strictEqual(httpRequestMock.mock.calls.length, 1);
      const [url] = httpRequestMock.mock.calls[0].arguments as [URL, ReqOptions];
      assert.ok(url.href.includes('/api/oianalytics/file-uploads'));
    });

    it('should throw OIBusError on fetch failure', async () => {
      httpRequestMock.mock.mockImplementation(async (_url: URL, _options: ReqOptions) => {
        throw new Error('Network Error');
      });
      await assert.rejects(async () => north.handleContent(mockReadStream, metadata), /Fail to reach file endpoint/);
    });

    it('should throw OIBusError on non-ok response', async () => {
      httpRequestMock.mock.mockImplementation(async (_url: URL, _options: ReqOptions) => createMockResponse(400, 'Bad Request'));
      await assert.rejects(async () => north.handleContent(mockReadStream, metadata), /Error 400: Bad Request/);
    });
  });
});
