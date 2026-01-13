import NorthOIAnalytics from './north-oianalytics';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthOIAnalyticsSettings } from '../../../shared/model/north-settings.model';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import CertificateRepositoryMock from '../../tests/__mocks__/repository/config/certificate-repository.mock';
import OIAnalyticsRegistrationRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import { HTTPRequest } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import FormData from 'form-data';
import { OIBusError } from '../../model/engine.model';
import { buildHttpOptions, getHost } from '../../service/utils-oianalytics';
import { compress, filesExists } from '../../service/utils';
import zlib from 'node:zlib';
import CacheService from '../../service/cache/cache.service';
import testData from '../../tests/utils/test-data';

// Mock dependencies
jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('node:path', () => {
  const actual = jest.requireActual('node:path');
  return {
    ...actual,
    parse: jest.fn(p => actual.parse(p)),
    resolve: jest.fn((...args) => actual.resolve(...args))
  };
});
jest.mock('node:zlib', () => ({
  gzipSync: jest.fn().mockReturnValue('gzipped-content')
}));
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
  const baseConfiguration: NorthConnectorEntity<NorthOIAnalyticsSettings> = {
    ...testData.north.list[0],
    id: 'northId',
    name: 'north',
    type: 'oianalytics',
    enabled: true,
    description: 'test connector',
    settings: {
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
    }
  };

  // Mock File Stream
  const mockReadStream = {
    pipe: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    pause: jest.fn(),
    close: jest.fn(),
    closed: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new PinoLogger();
    cacheService = new CacheServiceMock();
    mockReadStream.closed = false;

    // Default mock implementations
    (fsSync.createReadStream as jest.Mock).mockReturnValue(mockReadStream);
    (buildHttpOptions as jest.Mock).mockResolvedValue({
      headers: { 'custom-header': 'val' },
      auth: { type: 'basic' },
      timeout: 30000
    });
    (getHost as jest.Mock).mockReturnValue('https://mock-host');
    (filesExists as jest.Mock).mockResolvedValue(true);
    (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200));
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.completed);

    // Mock FormData methods
    (FormData as unknown as jest.Mock).mockImplementation(() => ({
      append: jest.fn(),
      getHeaders: jest.fn().mockReturnValue({ 'content-type': 'multipart/form-data' })
    }));

    north = new NorthOIAnalytics(
      baseConfiguration,
      logger,
      'cacheFolder',
      cacheService,
      certificateRepository,
      oIAnalyticsRegistrationRepository
    );
  });

  describe('testConnection', () => {
    it('should succeed when API returns 200', async () => {
      await expect(north.testConnection()).resolves.not.toThrow();

      expect(buildHttpOptions).toHaveBeenCalledWith('GET', false, expect.anything(), expect.anything(), 30000, certificateRepository);
      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({ href: 'https://mock-host/api/optimistik/oibus/status' }),
        expect.anything()
      );
    });

    it('should throw error when API returns non-200', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(500, 'Error'));
      await expect(north.testConnection()).rejects.toThrow('HTTP request failed with status code 500');
    });

    it('should throw error when fetch fails', async () => {
      (HTTPRequest as jest.Mock).mockRejectedValue(new Error('Network Error'));
      await expect(north.testConnection()).rejects.toThrow('Fetch error Error: Network Error');
    });
  });

  describe('handleValues (time-values)', () => {
    const mockValues: Array<OIBusTimeValue> = [{ pointId: 'p1', timestamp: '2023-01-01', data: { value: 1 } }];
    const metadata = {
      contentFile: 'file.json',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: 'date',
      contentType: 'time-values',
      source: 'south',
      options: {}
    };

    beforeEach(() => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockValues));
    });

    it('should send values as JSON', async () => {
      await north.handleContent(metadata);

      expect(buildHttpOptions).toHaveBeenCalledWith(
        'POST',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        30000,
        expect.anything()
      );
      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({ href: 'https://mock-host/api/oianalytics/oibus/time-values' }),
        expect.objectContaining({
          body: JSON.stringify(mockValues),
          headers: expect.objectContaining({ 'Content-Type': 'application/json' })
        })
      );
    });

    it('should compress values if enabled', async () => {
      north['connector'].settings.compress = true;

      await north.handleContent(metadata);

      expect(zlib.gzipSync).toHaveBeenCalled();
      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({ href: 'https://mock-host/api/oianalytics/oibus/time-values/compressed' }),
        expect.objectContaining({
          body: 'gzipped-content'
        })
      );
      north['connector'].settings.compress = false;
    });

    it('should throw OIBusError on failure', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));

      await expect(north.handleContent(metadata)).rejects.toThrow(OIBusError);
    });

    it('should throw OIBusError on HTTP failure', async () => {
      (HTTPRequest as jest.Mock).mockRejectedValue(new Error('Fail'));

      await expect(north.handleContent(metadata)).rejects.toThrow(OIBusError);
    });
  });

  describe('handleFile (any)', () => {
    const metadata = {
      contentFile: path.join('path', 'file.txt'),
      contentSize: 100,
      numberOfElement: 1,
      createdAt: 'date',
      contentType: 'any',
      source: 'south',
      options: {}
    };

    it('should upload file using FormData', async () => {
      await north.handleContent(metadata);

      expect(fsSync.createReadStream).toHaveBeenCalledWith(path.resolve('path', 'file.txt'));
      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({ href: 'https://mock-host/api/oianalytics/file-uploads' }),
        expect.objectContaining({
          body: expect.any(Object), // FormData mock
          headers: expect.objectContaining({ 'content-type': 'multipart/form-data' })
        })
      );
    });

    it('should throw if file does not exist', async () => {
      (filesExists as jest.Mock).mockResolvedValue(false);
      await expect(north.handleContent(metadata)).rejects.toThrow(`File ${path.join('path', 'file.txt')} does not exist`);
    });

    it('should compress file if enabled and not already gzip', async () => {
      north['connector'].settings.compress = true;
      (path.parse as jest.Mock).mockReturnValueOnce({ name: 'file', ext: '.txt', dir: 'path', base: 'file.txt' });
      (path.resolve as jest.Mock).mockReturnValueOnce(path.join('path', 'file.txt.gz'));
      // Mock that compressed file doesn't exist yet
      (filesExists as jest.Mock).mockImplementation(f => Promise.resolve(f === path.join('path', 'file.txt')));

      await north.handleContent(metadata);

      expect(compress).toHaveBeenCalledWith(path.join('path', 'file.txt'), path.join('path', 'file.txt.gz'));
      expect(fsSync.createReadStream).toHaveBeenCalledWith(path.join('path', 'file.txt.gz'));
      expect(fs.unlink).toHaveBeenCalledWith(path.join('path', 'file.txt.gz')); // Cleanup
      north['connector'].settings.compress = false;
    });

    it('should NOT compress if file is already .gz', async () => {
      const mockReadStream = { closed: true, close: jest.fn() };
      (fsSync.createReadStream as jest.Mock).mockReturnValue(mockReadStream);
      north['connector'].settings.compress = true;
      const gzMetadata = { ...metadata, contentFile: path.join('path', 'file.gz') };
      (path.parse as jest.Mock).mockReturnValue({ name: 'file', ext: '.gz', dir: 'path', base: 'file.gz' });

      await north.handleContent(gzMetadata);

      expect(compress).not.toHaveBeenCalled();
      expect(fsSync.createReadStream).toHaveBeenCalledWith(path.resolve('path', 'file.gz'));
      north['connector'].settings.compress = false;
      expect(mockReadStream.close).toHaveBeenCalledTimes(1);
    });

    it('should close stream and throw OIBusError on fetch error', async () => {
      (HTTPRequest as jest.Mock).mockRejectedValue(new Error('Fail'));

      await expect(north.handleContent(metadata)).rejects.toThrow(OIBusError);
    });

    it('should throw OIBusError on failure', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));

      await expect(north.handleContent(metadata)).rejects.toThrow(OIBusError);
    });
  });

  describe('supportedTypes', () => {
    it('should return correct types', () => {
      expect(north.supportedTypes()).toEqual(['any', 'time-values', 'oianalytics']);
    });

    it('should throw error for unsupported type', async () => {
      const metadata = {
        contentFile: 'file',
        contentSize: 0,
        numberOfElement: 0,
        createdAt: '',
        contentType: 'bad-type',
        source: '',
        options: {}
      };
      await expect(north.handleContent(metadata)).rejects.toThrow('Unsupported data type: bad-type');
    });
  });
});
