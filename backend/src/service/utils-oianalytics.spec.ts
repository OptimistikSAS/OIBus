import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  getAuthorizationOptions,
  getHost,
  getHeaders,
  getProxyOptions,
  buildHttpOptions,
  parseData,
  OIATimeValues,
  getUrl,
  testOIAnalyticsConnection
} from './utils-oianalytics';
import { encryptionService } from './encryption.service';
import CertificateRepository from '../repository/config/certificate.repository';
import { OIAnalyticsRegistration } from '../model/oianalytics-registration.model';
import { NorthOIAnalyticsSettingsSpecificSettings } from '../../shared/model/north-settings.model';
import { Certificate } from '../model/certificate.model';
import { createMockResponse } from '../tests/__mocks__/undici.mock';
import testData from '../tests/utils/test-data';

const nodeRequire = createRequire(import.meta.url);
const azureModule = nodeRequire('@azure/identity');
const undiciModule = nodeRequire('undici');

describe('utils-oianalytics', () => {
  let mockCertRepo: { findById: ReturnType<typeof mock.fn> };

  // Save original descriptors for azure/identity constructors
  let origCSCDescriptor: PropertyDescriptor;
  let origCCCDescriptor: PropertyDescriptor;

  let mockGetTokenCSC: ReturnType<typeof mock.fn>;
  let mockGetTokenCCC: ReturnType<typeof mock.fn>;

  let encryptTextMock: ReturnType<typeof mock.fn>;
  let decryptTextMock: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    encryptTextMock = mock.method(encryptionService, 'encryptText', async (_text: unknown) => 'encrypted-token') as ReturnType<typeof mock.fn>;
    decryptTextMock = mock.method(encryptionService, 'decryptText', async (text: unknown) => `decrypted-${text}`) as ReturnType<typeof mock.fn>;

    mockCertRepo = { findById: mock.fn() };

    mockGetTokenCSC = mock.fn(async () => ({ token: 'azure-token' }));
    mockGetTokenCCC = mock.fn(async () => ({ token: 'azure-token' }));

    origCSCDescriptor = Object.getOwnPropertyDescriptor(azureModule, 'ClientSecretCredential')!;
    origCCCDescriptor = Object.getOwnPropertyDescriptor(azureModule, 'ClientCertificateCredential')!;

    const getTokenCSC = mockGetTokenCSC;
    const getTokenCCC = mockGetTokenCCC;

    Object.defineProperty(azureModule, 'ClientSecretCredential', {
      value: function MockClientSecretCredential(this: unknown) {
        (this as { getToken: typeof getTokenCSC }).getToken = getTokenCSC;
      },
      writable: true,
      configurable: true
    });
    Object.defineProperty(azureModule, 'ClientCertificateCredential', {
      value: function MockClientCertificateCredential(this: unknown) {
        (this as { getToken: typeof getTokenCCC }).getToken = getTokenCCC;
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    mock.restoreAll();
    Object.defineProperty(azureModule, 'ClientSecretCredential', origCSCDescriptor);
    Object.defineProperty(azureModule, 'ClientCertificateCredential', origCCCDescriptor);
  });

  describe('getAuthorizationOptions', () => {
    const mockRegistration: OIAnalyticsRegistration = { token: 'reg-token' } as OIAnalyticsRegistration;

    it('should return bearer token from registration settings if useOIAnalyticsRegistration is true', async () => {
      const result = await getAuthorizationOptions(true, mockRegistration, null, mockCertRepo as unknown as CertificateRepository);
      assert.deepStrictEqual(result, { type: 'bearer', token: 'reg-token' });
    });

    it('should return basic auth options', async () => {
      const settings = { authentication: 'basic', accessKey: 'user', secretKey: 'pass' } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = await getAuthorizationOptions(false, mockRegistration, settings, mockCertRepo as unknown as CertificateRepository);
      assert.deepStrictEqual(result, { type: 'basic', username: 'user', password: 'pass' });
    });

    it('should return undefined for basic auth if accessKey is missing', async () => {
      const settings = { authentication: 'basic', accessKey: '' } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = await getAuthorizationOptions(false, mockRegistration, settings, mockCertRepo as unknown as CertificateRepository);
      assert.strictEqual(result, undefined);
    });

    it('should handle aad-client-secret authentication', async () => {
      const settings = {
        authentication: 'aad-client-secret',
        tenantId: 'tid',
        clientId: 'cid',
        clientSecret: 'secret',
        scope: 'scope'
      } as NorthOIAnalyticsSettingsSpecificSettings;

      const result = await getAuthorizationOptions(false, mockRegistration, settings, mockCertRepo as unknown as CertificateRepository);

      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, ['secret']);
      assert.strictEqual(mockGetTokenCSC.mock.calls.length, 1);
      assert.deepStrictEqual(mockGetTokenCSC.mock.calls[0].arguments, ['scope']);
      assert.deepStrictEqual(encryptTextMock.mock.calls[0].arguments, ['Bearer azure-token']);
      assert.deepStrictEqual(result, { type: 'bearer', token: 'encrypted-token' });
    });

    it('should handle aad-certificate authentication', async () => {
      const settings = {
        authentication: 'aad-certificate',
        certificateId: 'cert-1',
        tenantId: 'tid',
        clientId: 'cid',
        scope: 'scope'
      } as NorthOIAnalyticsSettingsSpecificSettings;

      mockCertRepo.findById.mock.mockImplementation(() => ({ certificate: 'cert-content', privateKey: 'pk' }) as Certificate);

      const result = await getAuthorizationOptions(false, mockRegistration, settings, mockCertRepo as unknown as CertificateRepository);

      assert.deepStrictEqual(mockCertRepo.findById.mock.calls[0].arguments, ['cert-1']);
      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, ['pk']);
      assert.strictEqual(mockGetTokenCCC.mock.calls.length, 1);
      assert.deepStrictEqual(mockGetTokenCCC.mock.calls[0].arguments, ['scope']);
      assert.deepStrictEqual(result, { type: 'bearer', token: 'encrypted-token' });
    });

    it('should return undefined for aad-certificate if certificate is not found', async () => {
      const settings = { authentication: 'aad-certificate', certificateId: 'missing' } as NorthOIAnalyticsSettingsSpecificSettings;
      mockCertRepo.findById.mock.mockImplementation(() => null);

      const result = await getAuthorizationOptions(false, mockRegistration, settings, mockCertRepo as unknown as CertificateRepository);
      assert.strictEqual(result, undefined);
    });
  });

  describe('getHost', () => {
    it('should return host from registration settings', () => {
      const reg = { host: 'reg-host' } as OIAnalyticsRegistration;
      assert.strictEqual(getHost(true, reg, null), 'reg-host');
    });

    it('should return host from specific settings', () => {
      const specific = { host: 'spec-host' } as NorthOIAnalyticsSettingsSpecificSettings;
      assert.strictEqual(getHost(false, {} as OIAnalyticsRegistration, specific), 'spec-host');
    });
  });

  describe('getHeaders', () => {
    it('should return empty headers if useApiGateway is false', async () => {
      const reg = { useApiGateway: false } as OIAnalyticsRegistration;
      const result = await getHeaders(true, reg);
      assert.deepStrictEqual(result, {});
    });

    it('should return gateway headers if registered', async () => {
      const reg = {
        useApiGateway: true,
        status: 'REGISTERED',
        apiGatewayHeaderKey: 'x-key',
        apiGatewayHeaderValue: 'encrypted-val'
      } as OIAnalyticsRegistration;

      const result = await getHeaders(true, reg);

      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, ['encrypted-val']);
      assert.deepStrictEqual(result, { 'x-key': 'decrypted-encrypted-val' });
    });
  });

  describe('getProxyOptions', () => {
    it('should return undefined proxy if useProxy is false (registration)', () => {
      const reg = { useProxy: false, acceptUnauthorized: true } as OIAnalyticsRegistration;
      const result = getProxyOptions(true, reg, null);
      assert.deepStrictEqual(result, { proxy: undefined, acceptUnauthorized: true });
    });

    it('should return undefined proxy if useProxy is false (specific)', () => {
      const spec = { useProxy: false, acceptUnauthorized: false } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = getProxyOptions(false, {} as OIAnalyticsRegistration, spec);
      assert.deepStrictEqual(result, { proxy: undefined, acceptUnauthorized: false });
    });

    it('should throw error if proxyUrl is missing (registration)', () => {
      const reg = { useProxy: true } as OIAnalyticsRegistration;
      assert.throws(() => getProxyOptions(true, reg, null), { message: 'Proxy URL not specified using registered OIAnalytics module' });
    });

    it('should throw error if proxyUrl is missing (specific)', () => {
      const spec = { useProxy: true } as NorthOIAnalyticsSettingsSpecificSettings;
      assert.throws(() => getProxyOptions(false, {} as OIAnalyticsRegistration, spec), {
        message: 'Proxy URL not specified using specific settings'
      });
    });

    it('should return proxy options without auth', () => {
      const spec = { useProxy: true, proxyUrl: 'http://proxy.com', acceptUnauthorized: true } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = getProxyOptions(false, {} as OIAnalyticsRegistration, spec);
      assert.deepStrictEqual(result, {
        proxy: { url: 'http://proxy.com' },
        acceptUnauthorized: true
      });
    });

    it('should return proxy options with auth', () => {
      const spec = {
        useProxy: true,
        proxyUrl: 'http://proxy.com',
        proxyUsername: 'user',
        proxyPassword: 'pwd',
        acceptUnauthorized: false
      } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = getProxyOptions(false, {} as OIAnalyticsRegistration, spec);
      assert.deepStrictEqual(result, {
        proxy: {
          url: 'http://proxy.com',
          auth: { type: 'url', username: 'user', password: 'pwd' }
        },
        acceptUnauthorized: false
      });
    });
  });

  describe('buildHttpOptions', () => {
    it('should throw error if registration status is invalid', async () => {
      const reg = { status: 'PENDING' } as OIAnalyticsRegistration;
      await assert.rejects(buildHttpOptions('GET', true, reg, null, 1000, null), { message: 'OIBus not registered in OIAnalytics' });
    });

    it('should build full options object', async () => {
      const reg = {
        status: 'REGISTERED',
        token: 'token',
        useApiGateway: false,
        useProxy: false,
        acceptUnauthorized: false
      } as OIAnalyticsRegistration;

      const result = await buildHttpOptions('POST', true, reg, null, 5000, mockCertRepo as unknown as CertificateRepository);

      assert.deepStrictEqual(result, {
        method: 'POST',
        headers: {},
        auth: { type: 'bearer', token: 'token' },
        proxy: undefined,
        timeout: 5000,
        acceptUnauthorized: false
      });
    });
  });

  describe('getUrl', () => {
    it('should return URL without API Gateway', () => {
      const result = getUrl('/my/endpoint', 'http://host:4200', { useApiGateway: false, apiGatewayBaseEndpoint: null });
      assert.deepStrictEqual(result, new URL('/my/endpoint', 'http://host:4200'));
    });

    it('should return URL with API Gateway', () => {
      const result = getUrl('/my/endpoint', 'http://host:4200', { useApiGateway: true, apiGatewayBaseEndpoint: '/oianalytics' });
      assert.deepStrictEqual(result, new URL('/oianalytics/my/endpoint', 'http://host:4200'));
    });
  });

  describe('parseData', () => {
    it('should parse OIAnalytics time values correctly', () => {
      const input: Array<OIATimeValues> = [
        {
          type: 'time-values',
          unit: { id: '1', label: '%' },
          data: {
            id: 'd1',
            dataType: 'RAW',
            reference: 'REF_1',
            description: 'desc'
          },
          timestamps: ['2023-01-01T10:00:00Z', '2023-01-01T10:05:00Z'],
          values: [10, 20]
        }
      ];

      const { formattedResult, maxInstant } = parseData(input);

      assert.strictEqual(formattedResult.length, 2);
      assert.deepStrictEqual(formattedResult[0], {
        pointId: 'REF_1',
        timestamp: '2023-01-01T10:00:00.000Z',
        data: { value: 10, unit: '%' }
      });
      assert.deepStrictEqual(formattedResult[1], {
        pointId: 'REF_1',
        timestamp: '2023-01-01T10:05:00.000Z',
        data: { value: 20, unit: '%' }
      });
      assert.strictEqual(maxInstant, '2023-01-01T10:05:00.000Z');
    });

    it('should handle mixed timestamps and find correct maxInstant', () => {
      const input: Array<OIATimeValues> = [
        {
          type: 'time-values',
          unit: { id: '1', label: 'U' },
          data: { id: 'd1', dataType: 'R', reference: 'R1', description: 'D' },
          timestamps: ['2023-01-02T00:00:00Z'],
          values: [100]
        },
        {
          type: 'time-values',
          unit: { id: '1', label: 'U' },
          data: { id: 'd2', dataType: 'R', reference: 'R2', description: 'D' },
          timestamps: ['2023-01-01T00:00:00Z'],
          values: [50]
        }
      ];

      const { maxInstant } = parseData(input);
      assert.strictEqual(maxInstant, '2023-01-02T00:00:00.000Z');
    });
  });

  describe('testOIAnalyticsConnection', () => {
    const mockRegistration = testData.oIAnalytics.registration.completed as OIAnalyticsRegistration;
    const mockSpecificSettings = { host: 'https://spec-host' } as NorthOIAnalyticsSettingsSpecificSettings;
    let requestMock: ReturnType<typeof mock.fn>;

    beforeEach(() => {
      requestMock = mock.method(undiciModule, 'request', async (_url: string | URL) => createMockResponse(200, 'OK')) as ReturnType<typeof mock.fn>;
    });

    it('should succeed when API returns 200', async () => {
      await assert.doesNotReject(testOIAnalyticsConnection(true, mockRegistration, null, 30000, null, false));

      assert.strictEqual(requestMock.mock.calls.length, 1);
      assert.ok(String(requestMock.mock.calls[0].arguments[0]).includes('/api/oianalytics/oibus/status'));
      assert.ok(String(requestMock.mock.calls[0].arguments[0]).includes('localhost:4200'));
    });

    it('should use specific settings host when useOIAnalyticsRegistration is false', async () => {
      await assert.doesNotReject(testOIAnalyticsConnection(false, mockRegistration, mockSpecificSettings, 30000, null, false));

      assert.strictEqual(requestMock.mock.calls.length, 1);
      assert.ok(String(requestMock.mock.calls[0].arguments[0]).includes('/api/oianalytics/oibus/status'));
      assert.ok(String(requestMock.mock.calls[0].arguments[0]).includes('spec-host'));
    });

    it('should throw error when fetch fails (Network Error)', async () => {
      const error = new Error('Network Error');
      requestMock.mock.mockImplementation(async () => {
        throw error;
      });

      await assert.rejects(testOIAnalyticsConnection(true, mockRegistration, null, 30000, null, false), {
        message: `Fetch error ${error}`
      });
    });

    it('should throw error when API returns 500', async () => {
      requestMock.mock.mockImplementation(async () => createMockResponse(500, 'Internal Server Error'));

      await assert.rejects(
        testOIAnalyticsConnection(true, mockRegistration, null, 30000, null, false),
        /HTTP request failed with status code 500/
      );
    });

    describe('401 Handling', () => {
      it('should throw error on 401 if accept401AsSuccess is false', async () => {
        requestMock.mock.mockImplementation(async () => createMockResponse(401, 'Unauthorized'));

        await assert.rejects(
          testOIAnalyticsConnection(true, mockRegistration, null, 30000, null, false),
          /HTTP request failed with status code 401/
        );
      });

      it('should SUCCEED on 401 if accept401AsSuccess is true', async () => {
        requestMock.mock.mockImplementation(async () => createMockResponse(401, 'Unauthorized'));

        await assert.doesNotReject(testOIAnalyticsConnection(true, mockRegistration, null, 30000, null, true));
      });

      it('should still throw on other errors (e.g. 403) even if accept401AsSuccess is true', async () => {
        requestMock.mock.mockImplementation(async () => createMockResponse(403, 'Forbidden'));

        await assert.rejects(
          testOIAnalyticsConnection(true, mockRegistration, null, 30000, null, true),
          /HTTP request failed with status code 403/
        );
      });
    });
  });
});
