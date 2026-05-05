import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import CertificateRepositoryMock from '../../tests/__mocks__/repository/config/certificate-repository.mock';
import OIAnalyticsRegistrationRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type CertificateRepository from '../../repository/config/certificate.repository';
import type OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import type SouthOIAnalyticsClass from './south-oianalytics';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type { SouthOIAnalyticsItemSettings, SouthOIAnalyticsSettings } from '../../../shared/model/south-settings.model';
import type { SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';

const nodeRequire = createRequire(import.meta.url);

const logger = new PinoLogger();
const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
let southCacheService: SouthCacheServiceMock;
const certificateRepository = new CertificateRepositoryMock() as unknown as CertificateRepository;
const oIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock() as unknown as OIAnalyticsRegistrationRepository;

const httpRequestExports = {
  HTTPRequest: mock.fn(async () => createMockResponse(200, {}))
};

const utilsOianalyticsExports = {
  buildHttpOptions: mock.fn(async () => ({ headers: {}, auth: {}, timeout: 30000 })),
  getHost: mock.fn(() => 'http://mock-host'),
  getUrl: mock.fn((endpoint: string, host: string) => new URL(endpoint, host)),
  parseData: mock.fn(() => ({ formattedResult: [], maxInstant: '2023-01-01T00:00:00.000Z' })),
  testOIAnalyticsConnection: mock.fn(async () => undefined)
};

const utilsExports = {
  checkAge: mock.fn(() => true),
  compress: mock.fn(async () => undefined),
  delay: mock.fn(async () => undefined),
  generateIntervals: mock.fn(() => []),
  groupItemsByGroup: mock.fn(() => []),
  validateCronExpression: mock.fn(() => ({ expression: '' })),
  formatQueryParams: mock.fn(() => ({ formatted: 'query' })),
  persistResults: mock.fn(async () => undefined),
  generateReplacementParameters: mock.fn(() => []),
  formatInstant: mock.fn((inst: unknown) => inst),
  convertDateTimeToInstant: mock.fn((inst: unknown) => inst),
  logQuery: mock.fn(),
  generateCsvContent: mock.fn(() => ''),
  generateFilenameForSerialization: mock.fn(() => 'file.csv')
};

const baseConfiguration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = {
  id: 'southId',
  name: 'south',
  type: 'oianalytics',
  description: 'test connector',
  enabled: true,
  settings: {
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
  groups: [],
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
      scanMode: testData.scanMode.list[0],
      group: null,
      syncWithGroup: false,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    } as SouthConnectorItemEntity<SouthOIAnalyticsItemSettings>
  ],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

let SouthOIAnalytics: typeof SouthOIAnalyticsClass;
let addContentCallback: ReturnType<typeof mock.fn>;
let south: SouthOIAnalyticsClass;

describe('SouthOIAnalytics', () => {
  before(() => {
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    mockModule(nodeRequire, '../../service/utils-oianalytics', utilsOianalyticsExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    SouthOIAnalytics = reloadModule<{ default: typeof SouthOIAnalyticsClass }>(nodeRequire, './south-oianalytics').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    addContentCallback = mock.fn();

    // Reset mutable exports
    httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, {}));
    utilsOianalyticsExports.buildHttpOptions = mock.fn(async () => ({ headers: {}, auth: {}, timeout: 30000 }));
    utilsOianalyticsExports.getHost = mock.fn(() => 'http://mock-host');
    utilsOianalyticsExports.getUrl = mock.fn((endpoint: string, host: string) => new URL(endpoint, host));
    utilsOianalyticsExports.parseData = mock.fn(() => ({ formattedResult: [], maxInstant: '2023-01-01T00:00:00.000Z' }));
    utilsOianalyticsExports.testOIAnalyticsConnection = mock.fn(async () => undefined);
    utilsExports.formatQueryParams = mock.fn(() => ({ formatted: 'query' }));
    utilsExports.persistResults = mock.fn(async () => undefined);

    (oIAnalyticsRegistrationRepository as unknown as OIAnalyticsRegistrationRepositoryMock).get = mock.fn(
      () => testData.oIAnalytics.registration.completed
    );

    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

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

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('testConnection', () => {
    it('should properly call test utils function', async () => {
      const result = south.testConnection();
      await assert.doesNotReject(result);

      assert.deepStrictEqual(utilsOianalyticsExports.testOIAnalyticsConnection.mock.calls[0].arguments, [
        baseConfiguration.settings.useOiaModule,
        testData.oIAnalytics.registration.completed,
        baseConfiguration.settings.specificSettings,
        baseConfiguration.settings.timeout * 1000,
        certificateRepository,
        false
      ]);
    });
  });

  describe('queryData (Internal)', () => {
    it('should build request correctly and return JSON data', async () => {
      const mockData = [{ val: 1 }];
      httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, mockData));
      utilsExports.formatQueryParams = mock.fn(() => ({ some: 'query' }));

      const result = await south.queryData(baseConfiguration.items[0], 'start', 'end');

      assert.deepStrictEqual(utilsExports.formatQueryParams.mock.calls[0].arguments, [
        'start',
        'end',
        baseConfiguration.items[0].settings.queryParams
      ]);
      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      const [urlArg, optionsArg] = httpRequestExports.HTTPRequest.mock.calls[0].arguments as [URL, { query: unknown }];
      assert.strictEqual(urlArg.href, 'http://mock-host/api/endpoint');
      assert.deepStrictEqual(optionsArg.query, { some: 'query' });
      assert.deepStrictEqual(result, mockData);
    });

    it('should throw if query request fails', async () => {
      httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(400, 'Bad Request'));

      await assert.rejects(south.queryData(baseConfiguration.items[0], 'start', 'end'), {
        message: 'HTTP request failed with status code 400 and message: Bad Request'
      });
    });
  });

  describe('testItem', () => {
    it('should parse and return formatted content', async () => {
      const mockRawData = [{ raw: 'data' }];
      const mockFormatted = [{ pointId: 'p1', value: 10 }];

      httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, mockRawData));
      utilsOianalyticsExports.parseData = mock.fn(() => ({ formattedResult: mockFormatted }));

      const testingSettings = {
        history: { startTime: 'start', endTime: 'end' }
      } as SouthConnectorItemTestingSettings;

      const result = await south.testItem(baseConfiguration.items[0], testingSettings);

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      assert.strictEqual(utilsOianalyticsExports.parseData.mock.calls.length, 1);
      assert.deepStrictEqual(utilsOianalyticsExports.parseData.mock.calls[0].arguments, [mockRawData]);
      assert.deepStrictEqual(result, { type: 'time-values', content: mockFormatted });
    });
  });

  describe('historyQuery', () => {
    it('should process items, persist results, and return max instant', async () => {
      const item = baseConfiguration.items[0];
      const mockRaw = [{ raw: 1 }];
      const mockFormatted = [{ pointId: 'p1' }];
      const maxInstant = '2023-02-01T12:00:00.000Z';

      httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, mockRaw));
      utilsOianalyticsExports.parseData = mock.fn(() => ({ formattedResult: mockFormatted, maxInstant }));

      const resultInstant = await south.historyQuery([item], 'start', 'end');

      assert.strictEqual(httpRequestExports.HTTPRequest.mock.calls.length, 1);
      assert.deepStrictEqual(utilsOianalyticsExports.parseData.mock.calls[0].arguments, [mockRaw]);
      assert.strictEqual(utilsExports.persistResults.mock.calls.length, 1);
      const persistArgs = utilsExports.persistResults.mock.calls[0].arguments as Array<unknown>;
      assert.deepStrictEqual(persistArgs[0], mockFormatted);
      assert.deepStrictEqual(persistArgs[1], item.settings.serialization);
      assert.strictEqual(persistArgs[2], baseConfiguration.name);
      assert.deepStrictEqual(persistArgs[3], item);
      assert.strictEqual(persistArgs[4], testData.constants.dates.FAKE_NOW);
      assert.strictEqual(persistArgs[5], path.resolve('cacheFolder', 'tmp'));
      assert.strictEqual(typeof persistArgs[6], 'function');

      assert.strictEqual(
        (logger.info as ReturnType<typeof mock.fn>).mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(`Found ${mockFormatted.length} results`)
        ),
        true
      );
      assert.deepStrictEqual(resultInstant, { trackedInstant: '2023-02-01T12:00:00.000Z', value: { pointId: 'p1' } });
    });

    it('should handle empty results gracefully', async () => {
      const item = baseConfiguration.items[0];

      httpRequestExports.HTTPRequest = mock.fn(async () => createMockResponse(200, []));
      utilsOianalyticsExports.parseData = mock.fn(() => ({ formattedResult: [], maxInstant: 'default' }));

      await south.historyQuery([item], 'start', 'end');

      assert.strictEqual(utilsExports.persistResults.mock.calls.length, 0);
      assert.strictEqual(
        (logger.debug as ReturnType<typeof mock.fn>).mock.calls.some((c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes('No result found')
        ),
        true
      );
    });

    it('should update maxInstant correctly across multiple items', async () => {
      const items = [
        { ...baseConfiguration.items[0], name: 'i1' },
        { ...baseConfiguration.items[0], name: 'i2' }
      ];

      httpRequestExports.HTTPRequest = mock.fn(async () => {
        return createMockResponse(200, []);
      });

      let parseCallCount = 0;
      utilsOianalyticsExports.parseData = mock.fn(() => {
        parseCallCount++;
        if (parseCallCount === 1) return { formattedResult: [], maxInstant: '2023-01-02' };
        return { formattedResult: [], maxInstant: '2023-01-01' };
      });

      const result = await south.historyQuery(items, 'start', 'end');

      assert.deepStrictEqual(result, { trackedInstant: '2023-01-02', value: null });
    });
  });
});
