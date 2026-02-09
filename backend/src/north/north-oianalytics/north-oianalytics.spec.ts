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
import FormData from 'form-data';
import { buildHttpOptions, getHost, getUrl, testOIAnalyticsConnection } from '../../service/utils-oianalytics';
import { streamToString } from '../../service/utils';
import zlib from 'node:zlib';
import CacheService from '../../service/cache/cache.service';
import testData from '../../tests/utils/test-data';
import { ReadStream } from 'node:fs';
import { buildNorthConfiguration } from '../../tests/utils/test-utils';

// Mock dependencies
jest.mock('node:fs');
jest.mock('node:zlib');
jest.mock('form-data');
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
  const mockGzipStream = { pipe: jest.fn() };
  const mockReadStream = {
    pipe: jest.fn().mockReturnValue(mockGzipStream),
    on: jest.fn(),
    read: jest.fn()
  } as unknown as ReadStream;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new PinoLogger();
    cacheService = new CacheServiceMock();

    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration = buildNorthConfiguration<NorthOIAnalyticsSettings>('oianalytics', {
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
    // Simple URL mock that returns a URL object
    (getUrl as jest.Mock).mockImplementation((endpoint, host) => new URL(endpoint, host));
    (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200));
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.completed);

    // Mock streamToString to return a static string
    (streamToString as jest.Mock).mockResolvedValue('stream-content-string');

    // Mock zlib
    (zlib.createGzip as jest.Mock).mockReturnValue(mockGzipStream);

    // Mock FormData
    (FormData as unknown as jest.Mock).mockImplementation(() => ({
      append: jest.fn(),
      getHeaders: jest.fn().mockReturnValue({ 'content-type': 'multipart/form-data; boundary=---' })
    }));

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

      // Verify stream was read to string
      expect(streamToString).toHaveBeenCalledWith(mockReadStream);

      // Verify HTTP Request
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

      // Verify piping to gzip
      expect(mockReadStream.pipe).toHaveBeenCalled();
      expect(zlib.createGzip).toHaveBeenCalledWith({ level: 9 });

      // Verify streamToString called with the GZIP stream
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

    it('should upload file using FormData', async () => {
      await north.handleContent(mockReadStream, metadata);

      // Get the mocked FormData instance
      const formDataInstance = (FormData as unknown as jest.Mock).mock.results[0].value;

      // Verify file was appended correctly
      expect(formDataInstance.append).toHaveBeenCalledWith('file', mockReadStream, { filename: 'test-file.txt' });

      // Verify headers were merged
      expect(formDataInstance.getHeaders).toHaveBeenCalled();

      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({ href: expect.stringContaining('/api/oianalytics/file-uploads') }),
        expect.objectContaining({
          body: formDataInstance,
          query: expect.objectContaining({ dataSourceId: configuration.name }),
          headers: expect.objectContaining({
            'content-type': 'multipart/form-data; boundary=---'
          })
        })
      );
    });

    it('should compress file if enabled and not .gz', async () => {
      north['connector'].settings.compress = true;

      await north.handleContent(mockReadStream, metadata);

      expect(mockReadStream.pipe).toHaveBeenCalled();
      expect(zlib.createGzip).toHaveBeenCalledWith({ level: 9 });

      const formDataInstance = (FormData as unknown as jest.Mock).mock.results[0].value;
      // Should pass the compressed stream and update filename
      expect(formDataInstance.append).toHaveBeenCalledWith('file', mockGzipStream, { filename: 'test-file.txt.gz' });
    });

    it('should NOT compress file if enabled but already .gz', async () => {
      north['connector'].settings.compress = true;
      const gzMetadata = { ...metadata, contentFile: 'archive.tar.gz' };

      await north.handleContent(mockReadStream, gzMetadata);

      expect(mockReadStream.pipe).not.toHaveBeenCalled(); // No compression

      const formDataInstance = (FormData as unknown as jest.Mock).mock.results[0].value;
      expect(formDataInstance.append).toHaveBeenCalledWith('file', mockReadStream, { filename: 'archive.tar.gz' });
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
