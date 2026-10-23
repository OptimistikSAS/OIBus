import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type {
  SouthItemSettings,
  SouthOIAnalyticsItemSettings,
  SouthOIAnalyticsSettings
} from '../../../shared/model/connector/south-settings.model';
import type { SouthConnectorItemTestingSettings } from '../../../shared/model/domain/south-connector.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type CertificateRepository from '../../repository/config/certificate.repository';
import type OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import type { ReqOptions, ReqResponse, ReqURL } from '../../service/http-request.utils';
import type * as Utils from '../../service/utils';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import testData from '../../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthOIAnalyticsClass from './south-oianalytics';

const nodeRequire = createRequire(import.meta.url);

interface ParseDataResult {
  formattedResult: Array<unknown>;
  maxInstant?: string;
}

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
      startTimeOffset: 0,
      endTimeOffset: null,
      recoveryStrategy: null,
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    }
  ],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

describe('SouthOIAnalytics', () => {
  let SouthOIAnalytics: typeof SouthOIAnalyticsClass;
  let south: SouthOIAnalyticsClass;

  let logger: PinoLogger;
  let certificateRepository: Mocked<CertificateRepository>;
  let HTTPRequest: Mock<(url: ReqURL, options?: ReqOptions) => Promise<ReqResponse>>;

  const httpRequestExports: Record<string, unknown> = {};

  // utils-oianalytics pulls the Azure SDK: it stays fully mocked
  const createUtilsOianalyticsMocks = () => ({
    buildHttpOptions: mock.fn(async () => ({ headers: {}, auth: {}, timeout: 30000 })),
    getHost: mock.fn(() => 'http://mock-host'),
    getUrl: mock.fn((endpoint: string, host: string) => new URL(endpoint, host)),
    parseData: mock.fn((): ParseDataResult => ({
      formattedResult: [],
      maxInstant: '2023-01-01T00:00:00.000Z'
    })),
    testOIAnalyticsConnection: mock.fn(async () => undefined)
  });
  const utilsOianalyticsExports = createUtilsOianalyticsMocks();

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({
    formatQueryParams: mock.fn((): Record<string, string> => ({ formatted: 'query' })),
    persistResults: mock.fn(async () => undefined),
    formatInstant: mock.fn((instant: unknown) => instant)
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    mockModule(nodeRequire, '../../service/utils-oianalytics', utilsOianalyticsExports);
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthOIAnalytics = reloadModule<{ default: typeof SouthOIAnalyticsClass }>(nodeRequire, './south-oianalytics').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    certificateRepository = createMock<CertificateRepository>();
    HTTPRequest = mock.fn(async () => createMockResponse(200, {}));
    httpRequestExports.HTTPRequest = HTTPRequest;
    Object.assign(utilsOianalyticsExports, createUtilsOianalyticsMocks());
    Object.assign(utilsExports, createUtilsMocks());

    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    south = new SouthOIAnalytics(
      baseConfiguration,
      mock.fn(
        async (_southId: string, _data: OIBusContent, _queryTime: string, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>) =>
          undefined
      ),
      createMock<SouthCacheRepository>(),
      'cacheFolder',
      certificateRepository,
      createMock<OIAnalyticsRegistrationRepository>({ get: () => testData.oIAnalytics.registration.completed })
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
      HTTPRequest.mock.mockImplementation(async () => createMockResponse(200, mockData));
      utilsExports.formatQueryParams.mock.mockImplementation(() => ({ some: 'query' }));

      const result = await south.queryData(baseConfiguration.items[0], 'start', 'end');

      assert.deepStrictEqual(utilsExports.formatQueryParams.mock.calls[0].arguments, [
        'start',
        'end',
        baseConfiguration.items[0].settings.queryParams
      ]);
      assert.strictEqual(HTTPRequest.mock.calls.length, 1);
      const [urlArg, optionsArg] = HTTPRequest.mock.calls[0].arguments;
      assert.strictEqual((urlArg as URL).href, 'http://mock-host/api/endpoint');
      assert.deepStrictEqual(optionsArg!.query, { some: 'query' });
      assert.deepStrictEqual(result, mockData);
    });

    it('should throw if query request fails', async () => {
      HTTPRequest.mock.mockImplementation(async () => createMockResponse(400, 'Bad Request'));

      await assert.rejects(south.queryData(baseConfiguration.items[0], 'start', 'end'), {
        message: 'HTTP request failed with status code 400 and message: Bad Request'
      });
    });
  });

  describe('testItem', () => {
    it('should return the CSV content sent by the connector', async () => {
      const mockRawData = [{ raw: 'data' }];
      const mockFormatted = [{ pointId: 'p1', timestamp: '2023-02-01T12:00:00.000Z', value: 12, unit: '°C' }];

      HTTPRequest.mock.mockImplementation(async () => {
        mock.timers.tick(25);
        return createMockResponse(200, mockRawData);
      });
      utilsOianalyticsExports.parseData.mock.mockImplementation(() => ({ formattedResult: mockFormatted }));
      utilsExports.formatInstant.mock.mockImplementation(() => '2023-02-01');

      const testingSettings = {
        history: { startTime: 'start', endTime: 'end' }
      } as SouthConnectorItemTestingSettings;

      const result = await south.testItem(baseConfiguration.items[0], testingSettings);

      assert.strictEqual(HTTPRequest.mock.calls.length, 1);
      assert.deepStrictEqual(utilsOianalyticsExports.parseData.mock.calls[0].arguments, [mockRawData]);
      assert.ok(result.result.type === 'any');
      assert.match(result.result.filePath, /sql-.*\.csv$/);
      assert.strictEqual(result.result.content, 'pointId,timestamp,value,unit\r\np1,2023-02-01,12,°C');
      assert.strictEqual(result.connectionDuration, 0);
      assert.strictEqual(result.queryDuration, 25);
    });
  });

  describe('historyQuery', () => {
    it('should process items, persist results, and return max instant', async () => {
      const item = baseConfiguration.items[0];
      const mockRaw = [{ raw: 1 }];
      const mockFormatted = [{ pointId: 'p1', timestamp: '2023-02-01T12:00:00.000Z', value: 12, unit: '°C' }];
      const maxInstant = '2023-02-01T12:00:00.000Z';
      utilsExports.formatInstant.mock.mockImplementation(() => '2023-02-01');

      HTTPRequest.mock.mockImplementation(async () => createMockResponse(200, mockRaw));
      utilsOianalyticsExports.parseData.mock.mockImplementation(() => ({ formattedResult: mockFormatted, maxInstant }));

      const resultInstant = await south.historyQuery([item], 'start', 'end');

      assert.strictEqual(HTTPRequest.mock.calls.length, 1);
      assert.deepStrictEqual(utilsOianalyticsExports.parseData.mock.calls[0].arguments, [mockRaw]);
      assert.strictEqual(utilsExports.persistResults.mock.calls.length, 1);
      const persistArgs = utilsExports.persistResults.mock.calls[0].arguments as Array<unknown>;
      assert.deepStrictEqual(persistArgs[0], [{ pointId: 'p1', timestamp: '2023-02-01', value: 12, unit: '°C' }]);
      assert.deepStrictEqual(utilsExports.formatInstant.mock.calls[0].arguments, [
        '2023-02-01T12:00:00.000Z',
        { type: 'string', format: 'yyyy-MM-dd', timezone: 'Europe/Paris', locale: 'en-En' }
      ]);
      assert.deepStrictEqual(persistArgs[1], item.settings.serialization);
      assert.strictEqual(persistArgs[2], baseConfiguration.name);
      assert.deepStrictEqual(persistArgs[3], item);
      assert.strictEqual(persistArgs[4], testData.constants.dates.FAKE_NOW);
      assert.strictEqual(persistArgs[5], path.resolve('cacheFolder', 'tmp'));
      assert.strictEqual(typeof persistArgs[6], 'function');

      assert.strictEqual(
        logger.info.mock.calls.some(c => c.arguments[1].includes(`Found ${mockFormatted.length} results`)),
        true
      );
      assert.deepStrictEqual(resultInstant, { trackedInstant: '2023-02-01T12:00:00.000Z', value: mockFormatted[0] });
    });

    it('should handle empty results gracefully', async () => {
      const item = baseConfiguration.items[0];

      HTTPRequest.mock.mockImplementation(async () => createMockResponse(200, []));
      utilsOianalyticsExports.parseData.mock.mockImplementation(() => ({ formattedResult: [], maxInstant: 'default' }));

      await south.historyQuery([item], 'start', 'end');

      assert.strictEqual(utilsExports.persistResults.mock.calls.length, 0);
      assert.strictEqual(
        logger.debug.mock.calls.some(c => c.arguments[1].includes('No result found')),
        true
      );
    });

    it('should update maxInstant correctly across multiple items', async () => {
      const items = [
        { ...baseConfiguration.items[0], name: 'i1' },
        { ...baseConfiguration.items[0], name: 'i2' }
      ];

      HTTPRequest.mock.mockImplementation(async () => createMockResponse(200, []));
      utilsOianalyticsExports.parseData.mock.mockImplementation(() => ({ formattedResult: [], maxInstant: '2023-01-01' }));
      utilsOianalyticsExports.parseData.mock.mockImplementationOnce(() => ({ formattedResult: [], maxInstant: '2023-01-02' }));

      const result = await south.historyQuery(items, 'start', 'end');

      assert.deepStrictEqual(result, { trackedInstant: '2023-01-02', value: null });
    });
  });
});
