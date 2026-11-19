import assert from 'node:assert/strict';
import { ReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import { PassThrough, Readable } from 'node:stream';
import zlib from 'node:zlib';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { NorthOIAnalyticsSettings } from '../../../shared/model/connector/north-settings.model';

import type OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import type CertificateService from '../../service/certificate.service';
import type * as HttpRequestUtils from '../../service/http-request.utils';
import type * as UtilsOIAnalytics from '../../service/utils-oianalytics';
import { createCacheServiceMock } from '../../tests/__mocks__/service/cache/cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import testData from '../../tests/utils/test-data';
import { assertContains, buildNorthEntity, createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type NorthOIAnalyticsClass from './north-oianalytics';

const nodeRequire = createRequire(import.meta.url);

const toReadStream = (stream: Readable) => stream as ReadStream;
const fileStreamOf = (content: string) => toReadStream(Readable.from([Buffer.from(content)]));
const readBody = async (body: unknown): Promise<string> => {
  const chunks: Array<Buffer> = [];
  for await (const chunk of body as AsyncIterable<Buffer>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

describe('NorthOIAnalytics', () => {
  let NorthOIAnalytics: typeof NorthOIAnalyticsClass;
  let north: NorthOIAnalyticsClass;

  let certificateService: Mocked<CertificateService>;
  let configuration: ReturnType<typeof buildNorthEntity<NorthOIAnalyticsSettings>>;
  let HTTPRequest: Mock<typeof HttpRequestUtils.HTTPRequest>;
  let createGzipMock: Mock<typeof zlib.createGzip>;
  let gzipSyncMock: Mock<typeof zlib.gzipSync>;

  // Real streams: gzipStream() wires the source into the gzip Transform via pipeline(), which needs genuine stream
  // objects. Fresh instances are created per test since pipeline() attaches listeners to / consumes them.
  let gzipStream: PassThrough;
  let fileStream: ReadStream;

  const httpRequestExports: typeof HttpRequestUtils = { ...nodeRequire('../../service/http-request.utils') };
  let utilsOIAnalyticsExports: typeof UtilsOIAnalytics;
  const createUtilsOIAnalyticsMocks = () => ({
    buildHttpOptions: mock.fn(async () => ({ headers: { 'custom-header': 'val' }, auth: { type: 'basic' as const }, timeout: 30000 })),
    testOIAnalyticsConnection: mock.fn(async () => undefined)
  });
  let utilsOIAnalyticsMocks: ReturnType<typeof createUtilsOIAnalyticsMocks>;

  before(() => {
    mockModule(nodeRequire, '@azure/identity', {});
    utilsOIAnalyticsExports = { ...nodeRequire('../../service/utils-oianalytics') };
    mockModule(nodeRequire, '../../service/utils-oianalytics', utilsOIAnalyticsExports);
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    // No transformation here: don't pay for loading every transformer
    mockModule(nodeRequire, '../../service/transformer.service', {});
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => new PinoLogger() },
      default: class {}
    });

    NorthOIAnalytics = reloadModule<{ default: typeof NorthOIAnalyticsClass }>(nodeRequire, './north-oianalytics').default;
  });

  beforeEach(() => {
    HTTPRequest = mock.fn(async () => createMockResponse(200));
    httpRequestExports.HTTPRequest = HTTPRequest;
    utilsOIAnalyticsMocks = createUtilsOIAnalyticsMocks();
    Object.assign(utilsOIAnalyticsExports, utilsOIAnalyticsMocks);

    gzipStream = new PassThrough();
    fileStream = toReadStream(new PassThrough());
    // node:zlib is a built-in module and cannot be patched via mockModule; use mock.method instead
    createGzipMock = mock.method(zlib, 'createGzip', () => gzipStream as zlib.Gzip);
    gzipSyncMock = mock.method(zlib, 'gzipSync', () => Buffer.from('gzipped-content'));

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
    certificateService = createMock<CertificateService>();
    north = new NorthOIAnalytics(
      configuration,
      createCacheServiceMock(),
      certificateService,
      createMock<OIAnalyticsRegistrationRepository>({ get: () => testData.oIAnalytics.registration.completed })
    );
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  /** The single HTTP request sent */
  const sentRequest = () => {
    assert.strictEqual(HTTPRequest.mock.calls.length, 1);
    const [url, options] = HTTPRequest.mock.calls[0].arguments;
    return { url: url as URL, options: options! };
  };

  it('should properly call test utils function', async () => {
    await north.testConnection();

    assert.strictEqual(utilsOIAnalyticsMocks.testOIAnalyticsConnection.mock.calls.length, 1);
    assert.deepStrictEqual(utilsOIAnalyticsMocks.testOIAnalyticsConnection.mock.calls[0].arguments, [
      configuration.settings.useOiaModule,
      testData.oIAnalytics.registration.completed,
      configuration.settings.specificSettings,
      configuration.settings.timeout * 1000,
      certificateService,
      false
    ]);
  });

  it('should return correct types', () => {
    assert.deepStrictEqual(north.supportedTypes(), ['file', 'oianalytics']);
  });

  describe('handleValues (oianalytics)', () => {
    const oianalyticsMetadata = {
      contentFile: 'file.json',
      contentSize: 100,
      numberOfElement: 2,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'oianalytics'
    };
    const compactTimeValues = {
      timestamps: ['2020-01-01T00:00:00.000Z', '2020-01-01T00:01:00.000Z'],
      values: [1.5, null],
      references: ['ref1', 'ref2']
    };
    const content = JSON.stringify(compactTimeValues);

    it('should stream the compact content as is, without compression', async () => {
      const compactFileStream = fileStreamOf(content);

      await north.handleContent(compactFileStream, oianalyticsMetadata);

      assert.strictEqual(createGzipMock.mock.calls.length, 0);
      const { url, options } = sentRequest();
      assert.strictEqual(url.pathname, '/api/oianalytics/oibus/time-values/compact');
      // The file stream itself is sent, not buffered
      assert.strictEqual(options.body, compactFileStream);
      assert.strictEqual(await readBody(options.body), content);
      assertContains(options.headers, { 'Content-Type': 'application/json' });
      assert.strictEqual(options.query, undefined);
    });

    it('should send the data source of the values', async () => {
      await north.handleContent(fileStreamOf(content), { ...oianalyticsMetadata, dataSource: { id: 'southId', name: 'My South' } });

      const { url } = sentRequest();
      assert.strictEqual(url.searchParams.get('dataSourceId'), 'southId');
      assert.strictEqual(url.searchParams.get('dataSourceName'), 'My South');
    });

    it('should not send any data source when the content has none', async () => {
      await north.handleContent(fileStreamOf(content), { ...oianalyticsMetadata, dataSource: null });

      const { url } = sentRequest();
      assert.strictEqual(url.search, '');
    });

    it('should send values with compression if enabled', async () => {
      north['connector'].settings.compress = true;

      await north.handleContent(fileStreamOf(content), oianalyticsMetadata);

      // the body is piped through createGzip — no synchronous gzip
      assert.strictEqual(createGzipMock.mock.calls.length, 1);
      assert.strictEqual(gzipSyncMock.mock.calls.length, 0);

      const { url, options } = sentRequest();
      assert.strictEqual(url.pathname, '/api/oianalytics/oibus/time-values/compact/compressed');
      assertContains(options, { body: gzipStream });
      assert.deepStrictEqual(JSON.parse(await readBody(gzipStream)), compactTimeValues);
    });

    it('should not handle record lists', async () => {
      await north.handleContent(fileStreamOf(content), { ...oianalyticsMetadata, contentType: 'record-list' });

      assert.strictEqual(HTTPRequest.mock.calls.length, 0);
    });

    it('should throw OIBusError on fetch failure', async () => {
      HTTPRequest.mock.mockImplementation(async () => {
        throw new Error('Network Error');
      });
      await assert.rejects(north.handleContent(fileStreamOf(content), oianalyticsMetadata), /Fail to reach values endpoint/);
    });

    it('should throw OIBusError on non-ok response', async () => {
      HTTPRequest.mock.mockImplementation(async () => createMockResponse(500, 'Internal Server Error'));
      await assert.rejects(north.handleContent(fileStreamOf(content), oianalyticsMetadata), /Error 500: Internal Server Error/);
    });
  });

  it('should resolve without doing anything for an unsupported content type', async () => {
    await north.handleContent(fileStream, {
      contentFile: 'file.bin',
      contentSize: 10,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'opcua'
    });

    assert.strictEqual(HTTPRequest.mock.calls.length, 0);
  });

  describe('handleFile (any)', () => {
    const metadata = {
      contentFile: 'test-file.txt',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: 'date',
      contentType: 'file'
    };

    it('should upload file using multipart stream', async () => {
      mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

      await north.handleContent(fileStream, metadata);

      const { url, options } = sentRequest();
      assert.strictEqual(url.pathname, '/api/oianalytics/oibus/file');
      assert.strictEqual(options.query, undefined);
      assert.ok((options.headers as Record<string, string>)['content-type'].startsWith('multipart/form-data; boundary=OIBusBoundary'));
    });

    it('should send the data source of the file', async () => {
      await north.handleContent(fileStream, { ...metadata, dataSource: { id: 'southId', name: 'My South' } });

      const { url } = sentRequest();
      assert.strictEqual(url.pathname, '/api/oianalytics/oibus/file');
      assert.strictEqual(url.searchParams.get('dataSourceId'), 'southId');
      assert.strictEqual(url.searchParams.get('dataSourceName'), 'My South');
    });

    it('should compress file if enabled and not .gz', async () => {
      north['connector'].settings.compress = true;

      await north.handleContent(fileStream, metadata);

      assert.strictEqual(createGzipMock.mock.calls.length, 1);
      assert.deepStrictEqual(createGzipMock.mock.calls[0].arguments, [{ level: 9 }]);
      const { url, options } = sentRequest();
      assert.strictEqual(url.pathname, '/api/oianalytics/oibus/file');
      assert.ok((options.headers as Record<string, string>)['content-type'].startsWith('multipart/form-data; boundary=OIBusBoundary'));
    });

    it('should NOT compress file if enabled but already .gz', async () => {
      north['connector'].settings.compress = true;

      await north.handleContent(fileStream, { ...metadata, contentFile: 'archive.tar.gz' });

      assert.strictEqual(createGzipMock.mock.calls.length, 0);
      assert.strictEqual(sentRequest().url.pathname, '/api/oianalytics/oibus/file');
    });

    it('should throw OIBusError on fetch failure', async () => {
      HTTPRequest.mock.mockImplementation(async () => {
        throw new Error('Network Error');
      });
      await assert.rejects(north.handleContent(fileStream, metadata), /Fail to reach file endpoint/);
    });

    it('should throw OIBusError on non-ok response', async () => {
      HTTPRequest.mock.mockImplementation(async () => createMockResponse(400, 'Bad Request'));
      await assert.rejects(north.handleContent(fileStream, metadata), /Error 400: Bad Request/);
    });

    it('should actually stream the file content through the multipart generator', async () => {
      // The mocked HTTPRequest never iterates the body, so the multipart async-generator is never driven.
      // Use a real async-iterable stream here and manually drain the resulting body to force the generator to run.
      await north.handleContent(toReadStream(Readable.from([Buffer.from('chunk-a'), Buffer.from('chunk-b')])), {
        ...metadata,
        contentFile: 'real-file.txt'
      });

      const full = await readBody(sentRequest().options.body);
      assert.ok(full.includes('chunk-a'));
      assert.ok(full.includes('chunk-b'));
    });

    it('should produce a valid multipart body even for an empty file stream', async () => {
      await north.handleContent(toReadStream(Readable.from([])), { ...metadata, contentFile: 'empty-file.txt' });

      const full = await readBody(sentRequest().options.body);
      assert.ok(full.includes('Content-Disposition'));
      assert.ok(full.includes('--\r\n'));
    });
  });
});
