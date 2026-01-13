import SouthOIAnalytics from './south-oianalytics';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import { SouthOIAnalyticsItemSettings, SouthOIAnalyticsSettings } from '../../../shared/model/south-settings.model';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { HTTPRequest } from '../../service/http-request.utils';
import { buildHttpOptions, getHost, parseData } from '../../service/utils-oianalytics';
import { formatQueryParams, persistResults } from '../../service/utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import CertificateRepositoryMock from '../../tests/__mocks__/repository/config/certificate-repository.mock';
import OIAnalyticsRegistrationRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import pino from 'pino';
import testData from '../../tests/utils/test-data';
import path from 'node:path';

// Mock dependencies
jest.mock('../../service/http-request.utils');
jest.mock('../../service/utils-oianalytics');
jest.mock('../../service/utils');

describe('SouthOIAnalytics', () => {
  let south: SouthOIAnalytics;
  let logger: pino.Logger;
  let addContentCallback: jest.Mock;

  // Repositories
  const southCacheRepository = new SouthCacheRepositoryMock();
  const oIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();
  const certificateRepository = new CertificateRepositoryMock();

  // Test Data
  const baseConfiguration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'oianalytics',
    description: 'test connector',
    enabled: true,
    settings: {
      throttling: { maxReadInterval: 3600, readDelay: 0, overlap: 0 },
      useOiaModule: false,
      timeout: 30,
      specificSettings: {
        host: 'http://localhost:4200/',
        acceptUnauthorized: true,
        authentication: 'basic',
        accessKey: 'user',
        secretKey: 'pass',
        useProxy: false
      }
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          endpoint: '/api/endpoint',
          queryParams: [{ key: 'agg', value: 'RAW' }],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanMode: testData.scanMode.list[0]
      } as SouthConnectorItemEntity<SouthOIAnalyticsItemSettings>
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new PinoLogger();
    addContentCallback = jest.fn();

    // Default mock implementations for the utils we imported
    (buildHttpOptions as jest.Mock).mockResolvedValue({ headers: {}, auth: {}, timeout: 30000 });
    (getHost as jest.Mock).mockReturnValue('http://mock-host');
    (formatQueryParams as jest.Mock).mockReturnValue({ formatted: 'query' });
    (parseData as jest.Mock).mockReturnValue({ formattedResult: [], maxInstant: '2023-01-01T00:00:00.000Z' });
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(testData.oIAnalytics.registration.completed);

    south = new SouthOIAnalytics(
      baseConfiguration,
      addContentCallback,
      southCacheRepository,
      logger,
      'cacheFolder',
      certificateRepository,
      oIAnalyticsRegistrationRepository
    );
  });

  describe('Getters', () => {
    it('should return throttling settings', () => {
      expect(south.getThrottlingSettings(baseConfiguration.settings)).toEqual({
        maxReadInterval: 3600,
        readDelay: 0
      });
    });

    it('should return max instant per item setting', () => {
      expect(south.getMaxInstantPerItem(baseConfiguration.settings)).toBe(true);
    });

    it('should return overlap setting', () => {
      expect(south.getOverlap(baseConfiguration.settings)).toBe(0);
    });
  });

  describe('testConnection', () => {
    it('should succeed when API returns 200', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200, 'OK'));

      await expect(south.testConnection()).resolves.not.toThrow();

      expect(buildHttpOptions).toHaveBeenCalledWith(
        'GET',
        false,
        expect.anything(), // registration
        expect.anything(), // specific settings
        30000,
        certificateRepository
      );
      expect(getHost).toHaveBeenCalled();
      expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/api/optimistik/oibus/status' }), expect.anything());
    });

    it('should throw error when API returns non-200', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(500, 'Internal Server Error'));

      await expect(south.testConnection()).rejects.toThrow('HTTP request failed with status code 500');
    });

    it('should throw error when fetch fails', async () => {
      (HTTPRequest as jest.Mock).mockRejectedValue(new Error('Network Error'));

      await expect(south.testConnection()).rejects.toThrow('Fetch error Error: Network Error');
    });
  });

  describe('queryData (Internal)', () => {
    it('should build request correctly and return JSON data', async () => {
      const mockData = [{ val: 1 }];
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200, mockData));
      (formatQueryParams as jest.Mock).mockReturnValue({ some: 'query' });

      const result = await south.queryData(baseConfiguration.items[0], 'start', 'end');

      expect(formatQueryParams).toHaveBeenCalledWith('start', 'end', baseConfiguration.items[0].settings.queryParams);
      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({ href: 'http://mock-host/api/endpoint' }),
        expect.objectContaining({ query: { some: 'query' } })
      );
      expect(result).toEqual(mockData);
    });

    it('should throw if query request fails', async () => {
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(400, 'Bad Request'));

      await expect(south.queryData(baseConfiguration.items[0], 'start', 'end')).rejects.toThrow('HTTP request failed with status code 400');
    });
  });

  describe('testItem', () => {
    it('should parse and return formatted content', async () => {
      const mockRawData = [{ raw: 'data' }];
      const mockFormatted = [{ pointId: 'p1', value: 10 }];

      // Mock queryData logic by mocking HTTPRequest
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200, mockRawData));
      // Mock parseData logic
      (parseData as jest.Mock).mockReturnValue({ formattedResult: mockFormatted });

      const testingSettings = {
        history: { startTime: 'start', endTime: 'end' }
      } as SouthConnectorItemTestingSettings;

      const result = await south.testItem(baseConfiguration.items[0], testingSettings);

      expect(HTTPRequest).toHaveBeenCalled();
      expect(parseData).toHaveBeenCalledWith(mockRawData);
      expect(result).toEqual({ type: 'time-values', content: mockFormatted });
    });
  });

  describe('historyQuery', () => {
    it('should process items, persist results, and return max instant', async () => {
      const item = baseConfiguration.items[0];
      const mockRaw = [{ raw: 1 }];
      const mockFormatted = [{ pointId: 'p1' }];
      const maxInstant = '2023-02-01T12:00:00.000Z';

      // Mock data flow
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200, mockRaw));
      (parseData as jest.Mock).mockReturnValue({ formattedResult: mockFormatted, maxInstant });

      const resultInstant = await south.historyQuery([item], 'start', 'end');

      // Verification
      expect(HTTPRequest).toHaveBeenCalled(); // Called queryData
      expect(parseData).toHaveBeenCalledWith(mockRaw);
      expect(persistResults).toHaveBeenCalledWith(
        mockFormatted,
        item.settings.serialization,
        baseConfiguration.name,
        item.name,
        path.resolve('cacheFolder', 'tmp'),
        expect.any(Function), // addContent callback
        expect.anything() // logger
      );
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Found ${mockFormatted.length} results`));
      expect(resultInstant).toBe(maxInstant);
    });

    it('should handle empty results gracefully', async () => {
      const item = baseConfiguration.items[0];

      // Mock empty return
      (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200, []));
      (parseData as jest.Mock).mockReturnValue({ formattedResult: [], maxInstant: 'default' });

      await south.historyQuery([item], 'start', 'end');

      expect(persistResults).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('No result found'));
    });

    it('should update maxInstant correctly across multiple items', async () => {
      const items = [
        { ...baseConfiguration.items[0], name: 'i1' },
        { ...baseConfiguration.items[0], name: 'i2' }
      ];

      // First call returns instant A, second returns instant B (B > A)
      (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, [])).mockResolvedValueOnce(createMockResponse(200, []));

      (parseData as jest.Mock)
        .mockReturnValueOnce({ formattedResult: [], maxInstant: '2023-01-02' })
        .mockReturnValueOnce({ formattedResult: [], maxInstant: '2023-01-01' });

      const result = await south.historyQuery(items, 'start', 'end');

      expect(result).toBe('2023-01-02');
    });
  });
});
