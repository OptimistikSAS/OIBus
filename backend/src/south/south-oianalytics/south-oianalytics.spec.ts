import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import * as forge from 'node-forge';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type {
  SouthItemSettings,
  SouthOIAnalyticsItemSettings,
  SouthOIAnalyticsSettings
} from '../../../shared/model/connector/south-settings.model';
import type { ServerIdentity } from '../../../shared/model/domain/server-identity.model';
import type { SouthConnectorItemTestingSettings } from '../../../shared/model/domain/south-connector.model';

import type { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import type CertificateService from '../../service/certificate.service';
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
  serverTrust: { identity: null, trustOnFirstUse: false },
  settings: {
    useOiaModule: false,
    timeout: 30,
    specificSettings: {
      host: 'http://localhost:4200/',
      certificateValidation: 'standard',
      trustedCertificateId: null,
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
      description: null,
      enabled: true,
      settings: {
        endpoint: '/api/endpoint',
        queryParams: [{ key: 'agg', value: 'RAW' }]
      },
      scanMode: testData.scanMode.list[0],
      group: null,
      syncWithGroup: false,
      maxReadInterval: 3600,
      readDelay: 0,
      startTimeOffset: 0,
      endTimeOffset: null,
      recoveryStrategy: null,
      emptyIntervalStrategy: null,
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
  let addContentCallback: ReturnType<
    typeof mock.fn<
      (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
    >
  >;

  let logger: PinoLogger;
  let certificateService: Mocked<CertificateService>;
  let HTTPRequest: Mock<(url: ReqURL, options?: ReqOptions) => Promise<ReqResponse>>;

  const httpRequestExports: Record<string, unknown> = {};

  // utils-oianalytics pulls the Azure SDK, which is mocked
  const createUtilsOianalyticsMocks = () => ({
    buildHttpOptions: mock.fn(async () => ({ headers: {}, auth: {}, timeout: 30000 })),
    getHost: mock.fn(() => 'http://mock-host'),
    getUrl: mock.fn((endpoint: string, host: string) => new URL(endpoint, host)),
    parseData: mock.fn((): ParseDataResult => ({
      formattedResult: [],
      maxInstant: '2023-01-01T00:00:00.000Z'
    })),
    testOIAnalyticsConnection: mock.fn<(...args: Array<unknown>) => Promise<void>>(async () => undefined)
  });
  const utilsOianalyticsExports = createUtilsOianalyticsMocks();

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({
    formatQueryParams: mock.fn((): Record<string, string> => ({ formatted: 'query' }))
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../../service/http-request.utils', httpRequestExports);
    mockModule(nodeRequire, '@azure/identity', {});
    Object.assign(utilsOianalyticsExports, { ...nodeRequire('../../service/utils-oianalytics'), ...createUtilsOianalyticsMocks() });
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
    certificateService = createMock<CertificateService>();
    HTTPRequest = mock.fn(async () => createMockResponse(200, {}));
    httpRequestExports.HTTPRequest = HTTPRequest;
    Object.assign(utilsOianalyticsExports, createUtilsOianalyticsMocks());
    Object.assign(utilsExports, createUtilsMocks());

    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    addContentCallback = mock.fn(
      async (_southId: string, _data: OIBusContent, _queryTime: string, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>) =>
        undefined
    );
    south = new SouthOIAnalytics(
      baseConfiguration,
      addContentCallback,
      createMock<SouthCacheRepository>(),
      'cacheFolder',
      certificateService,
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

      const [useOiaModule, registration, specificSettings, request, acceptNotRegistered] =
        utilsOianalyticsExports.testOIAnalyticsConnection.mock.calls[0].arguments;
      assert.deepStrictEqual(
        [useOiaModule, registration, specificSettings, acceptNotRegistered],
        [
          baseConfiguration.settings.useOiaModule,
          testData.oIAnalytics.registration.completed,
          baseConfiguration.settings.specificSettings,
          false
        ]
      );
      // the request validates the certificate of OIAnalytics
      await (request as (url: URL, options: ReqOptions) => Promise<ReqResponse>)(new URL('http://localhost:4200/status'), {});
      assert.deepStrictEqual(HTTPRequest.mock.calls[0].arguments[1], { tls: {} });
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

      const testingSettings = {
        history: { startTime: 'start', endTime: 'end' }
      } as SouthConnectorItemTestingSettings;

      const result = await south.testItem(baseConfiguration.items[0], testingSettings);

      assert.strictEqual(HTTPRequest.mock.calls.length, 1);
      assert.deepStrictEqual(utilsOianalyticsExports.parseData.mock.calls[0].arguments, [mockRawData]);
      // the point records with their unit, as sent to the Norths
      assert.deepStrictEqual(result.result, { type: 'record-list', content: mockFormatted });
      assert.strictEqual(result.connectionDuration, 0);
      assert.strictEqual(result.queryDuration, 25);
    });
  });

  describe('historyQuery', () => {
    it('should send the point records of the items, and return max instant', async () => {
      const item = baseConfiguration.items[0];
      const mockRaw = [{ raw: 1 }];
      const mockFormatted = [{ pointId: 'p1', timestamp: '2023-02-01T12:00:00.000Z', value: 12, unit: '°C' }];
      const maxInstant = '2023-02-01T12:00:00.000Z';

      HTTPRequest.mock.mockImplementation(async () => createMockResponse(200, mockRaw));
      utilsOianalyticsExports.parseData.mock.mockImplementation(() => ({ formattedResult: mockFormatted, maxInstant }));

      const resultInstant = await south.historyQuery([item], 'start', 'end');

      assert.strictEqual(HTTPRequest.mock.calls.length, 1);
      assert.deepStrictEqual(utilsOianalyticsExports.parseData.mock.calls[0].arguments, [mockRaw]);
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments.slice(0, 4), [
        baseConfiguration.id,
        { type: 'record-list', content: mockFormatted },
        testData.constants.dates.FAKE_NOW,
        [item]
      ]);

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

      assert.strictEqual(addContentCallback.mock.calls.length, 0);
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

  describe('certificate of OIAnalytics', () => {
    const identity: ServerIdentity = { type: 'x509', fingerprint: 'AB:CD', details: { keyType: 'rsa' } };
    const certificateError = () =>
      new Error('fetch failed', { cause: Object.assign(new Error('self-signed certificate'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }) });
    const certificationAuthority = (): string => {
      const keys = forge.pki.rsa.generateKeyPair(1024);
      const certificate = forge.pki.createCertificate();
      certificate.publicKey = keys.publicKey;
      certificate.setSubject([{ shortName: 'CN', value: 'CA' }]);
      certificate.setIssuer([{ shortName: 'CN', value: 'CA' }]);
      certificate.setExtensions([{ name: 'basicConstraints', cA: true }]);
      certificate.sign(keys.privateKey, forge.md.sha256.create());
      return forge.pki.certificateToPem(certificate);
    };
    const build = (
      settings: Partial<SouthOIAnalyticsSettings>,
      registration: OIAnalyticsRegistration = testData.oIAnalytics.registration.completed
    ) =>
      new SouthOIAnalytics(
        { ...baseConfiguration, settings: { ...baseConfiguration.settings, ...settings } },
        addContentCallback,
        createMock<SouthCacheRepository>(),
        'cacheFolder',
        certificateService,
        createMock<OIAnalyticsRegistrationRepository>({ get: () => registration })
      );

    it('should validate the certificate against the trusted certificate of its specific settings', async () => {
      const pem = certificationAuthority();
      certificateService.findById.mock.mockImplementation(() => ({ ...testData.certificates.list[0], certificate: pem }));
      south = build({
        specificSettings: { ...baseConfiguration.settings.specificSettings!, certificateValidation: 'trusted', trustedCertificateId: 'ca' }
      });

      await south.queryData(baseConfiguration.items[0], 'start', 'end');

      assert.deepStrictEqual(HTTPRequest.mock.calls[0].arguments[1]!.tls, { ca: [pem] });
      assert.deepStrictEqual(certificateService.findById.mock.calls[0].arguments, ['ca']);
    });

    it('should validate the certificate as the registration does, when it uses it', async () => {
      const pem = certificationAuthority();
      certificateService.findById.mock.mockImplementation(() => ({ ...testData.certificates.list[0], certificate: pem }));
      south = build(
        { useOiaModule: true },
        { ...testData.oIAnalytics.registration.completed, certificateValidation: 'trusted', trustedCertificateId: 'registrationCa' }
      );

      await south.queryData(baseConfiguration.items[0], 'start', 'end');

      assert.deepStrictEqual(HTTPRequest.mock.calls[0].arguments[1]!.tls, { ca: [pem] });
      assert.deepStrictEqual(certificateService.findById.mock.calls[0].arguments, ['registrationCa']);
      assert.strictEqual(await south.retrieveServerIdentity(), null);
    });

    it('should keep the identity refused as pending, and tell how to trust it', async () => {
      HTTPRequest.mock.mockImplementation(async () => {
        throw certificateError();
      });
      mock.method(south['tlsServerTrust'], 'retrieveServerIdentity', async () => identity);

      await assert.rejects(south.queryData(baseConfiguration.items[0], 'start', 'end'), /which is not trusted: test the connection/);
      assert.deepStrictEqual(south.getPendingServerIdentity(), { identity, status: 'unknown' });
      assert.strictEqual(south.getServerIdentityTrustStatus(identity), 'unknown');
    });

    it('should tell to review the identity of OIAnalytics from the registration, when it uses it', async () => {
      HTTPRequest.mock.mockImplementation(async () => {
        throw certificateError();
      });
      south = build({ useOiaModule: true });

      await assert.rejects(
        south.queryData(baseConfiguration.items[0], 'start', 'end'),
        /review the identity of OIAnalytics from the registration/
      );
      assert.strictEqual(south.getPendingServerIdentity(), null);
    });

    it('should keep other errors', async () => {
      HTTPRequest.mock.mockImplementation(async () => {
        throw new Error('Network Error');
      });

      await assert.rejects(south.queryData(baseConfiguration.items[0], 'start', 'end'), { message: 'Network Error' });
    });
  });
});
