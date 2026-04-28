import NorthOIAnalytics from './north-oianalytics';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthOIAnalyticsSettings } from '../../../shared/model/north-settings.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import CertificateRepositoryMock from '../../tests/__mocks__/repository/config/certificate-repository.mock';
import OIAnalyticsRegistrationRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import { HTTPRequest } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import { buildHttpOptions, getHost, getUrl, testOIAnalyticsConnection } from '../../service/utils-oianalytics';
import { streamToString } from '../../service/utils';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import CacheService from '../../service/cache/cache.service';
import testData from '../../tests/utils/test-data';
import { ReadStream } from 'node:fs';
import { buildNorthEntity } from '../../tests/utils/test-utils';

// Mock dependencies
jest.mock('node:fs', () => jest.requireActual<typeof import('node:fs')>('node:fs'));
jest.mock('node:zlib');
jest.mock('../../service/http-request.utils');
jest.mock('../../service/utils-oianalytics');
jest.mock('../../service/utils');

describe('NorthOIAnalytics', () => {
  let north: NorthOIAnalytics;
  let logger: pino.Logger;
  let cacheService: CacheService;

  // Repositories
  const certificateRepository = new CertificateRepositoryMock();
  const oIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();

  // Test Data
  let configuration: NorthConnectorEntity<NorthOIAnalyticsSettings>;

  // Mock Streams
  const mockGzipStream = {
    pipe: jest.fn(),
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from('gzipped-chunk');
    }
  };
  const mockReadStream = {
    pipe: jest.fn().mockReturnValue(mockGzipStream),
    on: jest.fn(),
    read: jest.fn(),
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from('file-chunk');
    }
  } as unknown as ReadStream;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new PinoLogger();
    cacheService = new CacheServiceMock();

    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
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
    // Default mock implementations
    (buildHttpOptions as jest.Mock).mockResolvedValue({
      headers: { 'custom-header': 'val' },
      auth: { type: 'basic' },
      timeout: 30000
    });
    (getHost as jest.Mock).mockReturnValue('https://mock-host');
    (getUrl as jest.Mock).mockImplementation((endpoint, host) => new URL(endpoint, host));
    (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200));
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.completed);

    (streamToString as jest.Mock).mockResolvedValue('stream-content-string');

    (zlib.createGzip as jest.Mock).mockReturnValue(mockGzipStream);

    north = new NorthOIAnalytics(configuration, logger, cacheService, certificateRepository, oIAnalyticsRegistrationRepository);
  });

  it('should properly call test utils function', async () => {
    await expect(north.testConnection()).resolves.not.toThrow();

    expect(testOIAnalyticsConnection).toHaveBeenCalledWith(
      configuration.settings.useOiaModule,
      testData.oIAnalytics.registration.completed,
      configuration.settings.specificSettings,
      configuration.settings.timeout * 1000,
      certificateRepository,
      false
    );
  });

  it('should return correct types', () => {
    expect(north.supportedTypes()).toEqual(['any', 'time-values', 'oianalytics']);
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

      expect(streamToString).toHaveBeenCalledWith(mockReadStream);

      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({ href: expect.stringContaining('/api/oianalytics/oibus/time-values') }),
        expect.objectContaining({
          body: 'stream-content-string',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          query: expect.objectContaining({ dataSourceId: configuration.name })
        })
      );
    });

    it('should send values with compression if enabled', async () => {
      north['connector'].settings.compress = true;

      await north.handleContent(mockReadStream, metadata);

      expect(mockReadStream.pipe).toHaveBeenCalled();
      expect(zlib.createGzip).toHaveBeenCalledWith({ level: 9 });
      expect(streamToString).toHaveBeenCalledWith(mockGzipStream);

      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({ href: expect.stringContaining('/api/oianalytics/oibus/time-values/compressed') }),
        expect.objectContaining({
          body: 'stream-content-string'
        })
      );
    });

    it('should throw OIBusError on fetch failure', async () => {
      (HTTPRequest as jest.Mock).mockRejectedValue(new Error('Network Error'));
      await expect(north.handleContent(mockReadStream, metadata)).rejects.toThrow('Fail to reach values endpoint');
    });

    it('should throw OIBusError on non-ok response', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(500, 'Internal Server Error'));
      await expect(north.handleContent(mockReadStream, metadata)).rejects.toThrow('Error 500: Internal Server Error');
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

    it('should upload file as a streaming multipart body', async () => {
      await north.handleContent(mockReadStream, metadata);

      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({ href: expect.stringContaining('/api/oianalytics/file-uploads') }),
        expect.objectContaining({
          body: expect.any(Readable),
          query: expect.objectContaining({ dataSourceId: configuration.name }),
          headers: expect.objectContaining({
            'content-type': expect.stringContaining('multipart/form-data; boundary=OIBusBoundary')
          })
        })
      );
    });

    it('should stream the correct multipart content for the file', async () => {
      await north.handleContent(mockReadStream, metadata);

      const body: Readable = (HTTPRequest as jest.Mock).mock.calls[0][1].body;
      const chunks: Array<Buffer> = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const bodyStr = Buffer.concat(chunks).toString();

      expect(bodyStr).toContain('Content-Disposition: form-data; name="file"; filename="test-file.txt"');
      expect(bodyStr).toContain('Content-Type: application/octet-stream');
      expect(bodyStr).toContain('file-chunk');
    });

    it('should compress file if enabled and not .gz', async () => {
      north['connector'].settings.compress = true;

      await north.handleContent(mockReadStream, metadata);

      expect(mockReadStream.pipe).toHaveBeenCalled();
      expect(zlib.createGzip).toHaveBeenCalledWith({ level: 9 });

      const body: Readable = (HTTPRequest as jest.Mock).mock.calls[0][1].body;
      const chunks: Array<Buffer> = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const bodyStr = Buffer.concat(chunks).toString();

      expect(bodyStr).toContain('filename="test-file.txt.gz"');
      expect(bodyStr).toContain('gzipped-chunk');
    });

    it('should NOT compress file if enabled but already .gz', async () => {
      north['connector'].settings.compress = true;
      const gzMetadata = { ...metadata, contentFile: 'archive.tar.gz' };

      await north.handleContent(mockReadStream, gzMetadata);

      expect(mockReadStream.pipe).not.toHaveBeenCalled();

      const body: Readable = (HTTPRequest as jest.Mock).mock.calls[0][1].body;
      const chunks: Array<Buffer> = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const bodyStr = Buffer.concat(chunks).toString();

      expect(bodyStr).toContain('filename="archive.tar.gz"');
      expect(bodyStr).toContain('file-chunk');
    });

    it('should throw OIBusError on fetch failure', async () => {
      (HTTPRequest as jest.Mock).mockRejectedValue(new Error('Network Error'));
      await expect(north.handleContent(mockReadStream, metadata)).rejects.toThrow('Fail to reach file endpoint');
    });

    it('should throw OIBusError on non-ok response', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));
      await expect(north.handleContent(mockReadStream, metadata)).rejects.toThrow('Error 400: Bad Request');
    });
  });
});
