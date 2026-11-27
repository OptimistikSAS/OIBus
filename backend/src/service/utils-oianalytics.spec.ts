import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it, type Mock, mock } from 'node:test';

import { NorthOIAnalyticsSettingsSpecificSettings } from '../../shared/model/connector/north-settings.model';

import { OIAnalyticsRegistration } from '../model/oianalytics-registration.model';
import { NotFoundError } from '../model/types';
import { createMockResponse } from '../tests/__mocks__/undici.mock';
import testData from '../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../tests/utils/test-utils';
import type CertificateService from './certificate.service';
import { encryptionService } from './encryption.service';
import { HTTPRequest, type ReqResponse } from './http-request.utils';
import type { OIATimeValues } from './utils-oianalytics';

const nodeRequire = createRequire(import.meta.url);
const undiciModule = nodeRequire('undici');

// Mutable refs so the mocked azure/identity constructors below always call the mock.fn()
// currently in effect for the running test (reassigned in beforeEach).
let mockGetTokenCSC: Mock<(scope: string) => Promise<{ token: string }>>;
let mockGetTokenCCC: Mock<(scope: string) => Promise<{ token: string }>>;

// @azure/identity's published commonjs build re-exports its classes via non-configurable getters,
// so they can't be monkey-patched with Object.defineProperty on the real module. Replace the whole
// module in the require cache instead, then reload the SUT so it picks up these mocked classes.
mockModule(nodeRequire, '@azure/identity', {
  __esModule: true,
  ClientSecretCredential: function MockClientSecretCredential(this: { getToken: unknown }) {
    this.getToken = (scope: string) => mockGetTokenCSC(scope);
  },
  ClientCertificateCredential: function MockClientCertificateCredential(this: { getToken: unknown }) {
    this.getToken = (scope: string) => mockGetTokenCCC(scope);
  }
});

const {
  getAuthorizationOptions,
  getHost,
  getHeaders,
  getProxyOptions,
  getOIAnalyticsTlsSettings,
  getOIAnalyticsProbeTarget,
  toRegistrationNotTrustedError,
  buildHttpOptions,
  parseData,
  getUrl,
  testOIAnalyticsConnection,
  clearOIAnalyticsCredentialCache
} = reloadModule<typeof import('./utils-oianalytics')>(nodeRequire, './utils-oianalytics');

describe('utils-oianalytics', () => {
  let certificateService: Mocked<CertificateService>;
  let encryptTextMock: Mock<typeof encryptionService.encryptText>;
  let decryptTextMock: Mock<typeof encryptionService.decryptText>;

  beforeEach(() => {
    encryptTextMock = mock.method(encryptionService, 'encryptText', (_plainText?: string | null) => 'encrypted-token');
    decryptTextMock = mock.method(encryptionService, 'decryptText', (encryptedText?: string | null) => `decrypted-${encryptedText}`);
    certificateService = createMock<CertificateService>();

    mockGetTokenCSC = mock.fn(async () => ({ token: 'azure-token' }));
    mockGetTokenCCC = mock.fn(async () => ({ token: 'azure-token' }));
  });

  afterEach(() => {
    mock.restoreAll();
    clearOIAnalyticsCredentialCache();
  });

  describe('getAuthorizationOptions', () => {
    const mockRegistration: OIAnalyticsRegistration = { token: 'reg-token' } as OIAnalyticsRegistration;

    it('should return bearer token from registration settings if useOIAnalyticsRegistration is true', async () => {
      const result = await getAuthorizationOptions(true, mockRegistration, null, certificateService);
      assert.deepStrictEqual(result, { type: 'bearer', token: 'reg-token' });
    });

    it('should return basic auth options', async () => {
      const settings = { authentication: 'basic', accessKey: 'user', secretKey: 'pass' } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = await getAuthorizationOptions(false, mockRegistration, settings, certificateService);
      assert.deepStrictEqual(result, { type: 'basic', username: 'user', password: 'pass' });
    });

    it('should return undefined for basic auth if accessKey is missing', async () => {
      const settings = { authentication: 'basic', accessKey: '' } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = await getAuthorizationOptions(false, mockRegistration, settings, certificateService);
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

      const result = await getAuthorizationOptions(false, mockRegistration, settings, certificateService);

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

      certificateService.getKeyPair.mock.mockImplementation(() => ({
        name: 'certificate',
        certificate: 'cert-content',
        certificateChain: null,
        privateKey: 'pk'
      }));

      const result = await getAuthorizationOptions(false, mockRegistration, settings, certificateService);

      // the private key comes decrypted from the certificate service
      assert.deepStrictEqual(certificateService.getKeyPair.mock.calls[0].arguments, ['cert-1']);
      assert.strictEqual(mockGetTokenCCC.mock.calls.length, 1);
      assert.deepStrictEqual(mockGetTokenCCC.mock.calls[0].arguments, ['scope']);
      assert.deepStrictEqual(encryptTextMock.mock.calls[0].arguments, ['Bearer azure-token']);
      assert.deepStrictEqual(result, { type: 'bearer', token: 'encrypted-token' });
    });

    it('should reject for aad-certificate if certificate is not found', async () => {
      const settings = { authentication: 'aad-certificate', certificateId: 'missing' } as NorthOIAnalyticsSettingsSpecificSettings;
      certificateService.getKeyPair.mock.mockImplementation(() => {
        throw new NotFoundError('Certificate "missing" not found');
      });

      await assert.rejects(() => getAuthorizationOptions(false, mockRegistration, settings, certificateService), {
        message: 'Certificate "missing" not found'
      });
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
      const result = getHeaders(true, reg);
      assert.deepStrictEqual(result, {});
    });

    it('should return gateway headers if registered', async () => {
      const reg = {
        useApiGateway: true,
        status: 'REGISTERED',
        apiGatewayHeaderKey: 'x-key',
        apiGatewayHeaderValue: 'encrypted-val'
      } as OIAnalyticsRegistration;

      const result = getHeaders(true, reg);

      assert.deepStrictEqual(decryptTextMock.mock.calls[0].arguments, ['encrypted-val']);
      assert.deepStrictEqual(result, { 'x-key': 'decrypted-encrypted-val' });
    });
  });

  describe('getProxyOptions', () => {
    it('should return undefined proxy if useProxy is false (registration)', () => {
      const reg = { useProxy: false } as OIAnalyticsRegistration;
      const result = getProxyOptions(true, reg, null);
      assert.strictEqual(result, undefined);
    });

    it('should return undefined proxy if useProxy is false (specific)', () => {
      const spec = { useProxy: false } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = getProxyOptions(false, {} as OIAnalyticsRegistration, spec);
      assert.strictEqual(result, undefined);
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
      const spec = { useProxy: true, proxyUrl: 'http://proxy.com' } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = getProxyOptions(false, {} as OIAnalyticsRegistration, spec);
      assert.deepStrictEqual(result, { url: 'http://proxy.com' });
    });

    it('should return proxy options with auth', () => {
      const spec = {
        useProxy: true,
        proxyUrl: 'http://proxy.com',
        proxyUsername: 'user',
        proxyPassword: 'pwd'
      } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = getProxyOptions(false, {} as OIAnalyticsRegistration, spec);
      assert.deepStrictEqual(result, {
        url: 'http://proxy.com',
        auth: { type: 'url', username: 'user', password: 'pwd' }
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
        useProxy: false
      } as OIAnalyticsRegistration;

      const result = await buildHttpOptions('POST', true, reg, null, 5000, certificateService);

      assert.deepStrictEqual(result, {
        method: 'POST',
        headers: {},
        auth: { type: 'bearer', token: 'token' },
        proxy: undefined,
        timeout: 5000
      });
    });
  });

  describe('getOIAnalyticsTlsSettings', () => {
    it('should validate the certificate as the registration does', () => {
      const reg = { certificateValidation: 'trusted', trustedCertificateId: 'ca' } as OIAnalyticsRegistration;
      const spec = { certificateValidation: 'standard' } as NorthOIAnalyticsSettingsSpecificSettings;
      assert.deepStrictEqual(getOIAnalyticsTlsSettings(true, reg, spec), { certificateValidation: 'trusted', trustedCertificateId: 'ca' });
    });

    it('should validate the certificate as the specific settings do', () => {
      const reg = { certificateValidation: 'standard', trustedCertificateId: null } as OIAnalyticsRegistration;
      const spec = { certificateValidation: 'trusted', trustedCertificateId: 'server' } as NorthOIAnalyticsSettingsSpecificSettings;
      assert.deepStrictEqual(getOIAnalyticsTlsSettings(false, reg, spec), {
        certificateValidation: 'trusted',
        trustedCertificateId: 'server'
      });
    });
  });

  describe('getOIAnalyticsProbeTarget', () => {
    it('should read nothing from an http host', () => {
      const reg = { host: 'http://oia' } as OIAnalyticsRegistration;
      assert.strictEqual(getOIAnalyticsProbeTarget(true, reg, null, 1000), null);
    });

    it('should read the certificate of the registration host, directly', () => {
      const reg = { host: 'https://oia', useProxy: false } as OIAnalyticsRegistration;
      assert.deepStrictEqual(getOIAnalyticsProbeTarget(true, reg, null, 1000), {
        url: 'https://oia',
        defaultPort: 443,
        proxy: null,
        timeoutMs: 1000
      });
    });

    it('should read the certificate of the specific host, through its proxy', () => {
      const spec = {
        host: 'https://spec',
        useProxy: true,
        proxyUrl: 'http://proxy',
        proxyUsername: 'user',
        proxyPassword: 'pwd'
      } as NorthOIAnalyticsSettingsSpecificSettings;
      assert.deepStrictEqual(getOIAnalyticsProbeTarget(false, {} as OIAnalyticsRegistration, spec, 2000), {
        url: 'https://spec',
        defaultPort: 443,
        proxy: { url: 'http://proxy', username: 'user', password: 'decrypted-pwd' },
        timeoutMs: 2000
      });
    });
  });

  describe('toRegistrationNotTrustedError', () => {
    it('should tell to review the identity of OIAnalytics from the registration', () => {
      const error = Object.assign(new Error('self-signed certificate'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
      assert.match((toRegistrationNotTrustedError(error) as Error).message, /review the identity of OIAnalytics from the registration/);
    });

    it('should keep other errors', () => {
      const error = new Error('Network Error');
      assert.strictEqual(toRegistrationNotTrustedError(error), error);
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
          type: 'record-list',
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
        value: 10,
        unit: '%'
      });
      assert.deepStrictEqual(formattedResult[1], {
        pointId: 'REF_1',
        timestamp: '2023-01-01T10:05:00.000Z',
        value: 20,
        unit: '%'
      });
      assert.strictEqual(maxInstant, '2023-01-01T10:05:00.000Z');
    });

    it('should handle mixed timestamps and find correct maxInstant', () => {
      const input: Array<OIATimeValues> = [
        {
          type: 'record-list',
          unit: { id: '1', label: 'U' },
          data: { id: 'd1', dataType: 'R', reference: 'R1', description: 'D' },
          timestamps: ['2023-01-02T00:00:00Z'],
          values: [100]
        },
        {
          type: 'record-list',
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
    const mockRegistration = testData.oIAnalytics.registration.completed;
    const mockSpecificSettings = { host: 'https://spec-host' } as NorthOIAnalyticsSettingsSpecificSettings;
    let requestMock: Mock<(url: string | URL) => Promise<ReqResponse>>;

    beforeEach(() => {
      requestMock = mock.method(undiciModule, 'request', async (_url: string | URL) => createMockResponse(200, 'OK'));
    });

    it('should succeed when API returns 200', async () => {
      await assert.doesNotReject(testOIAnalyticsConnection(true, mockRegistration, null, HTTPRequest, false));

      assert.strictEqual(requestMock.mock.calls.length, 1);
      assert.ok(String(requestMock.mock.calls[0].arguments[0]).includes('/api/oianalytics/oibus/status'));
      assert.ok(String(requestMock.mock.calls[0].arguments[0]).includes('localhost:4200'));
    });

    it('should use specific settings host when useOIAnalyticsRegistration is false', async () => {
      await assert.doesNotReject(testOIAnalyticsConnection(false, mockRegistration, mockSpecificSettings, HTTPRequest, false));

      assert.strictEqual(requestMock.mock.calls.length, 1);
      assert.ok(String(requestMock.mock.calls[0].arguments[0]).includes('/api/oianalytics/oibus/status'));
      assert.ok(String(requestMock.mock.calls[0].arguments[0]).includes('spec-host'));
    });

    it('should throw error when fetch fails (Network Error)', async () => {
      const error = new Error('Network Error');
      requestMock.mock.mockImplementation(async () => {
        throw error;
      });

      await assert.rejects(testOIAnalyticsConnection(true, mockRegistration, null, HTTPRequest, false), {
        message: `Fetch error: ${error.message}`
      });
    });

    it('should throw error when API returns 500', async () => {
      requestMock.mock.mockImplementation(async () => createMockResponse(500, 'Internal Server Error'));

      await assert.rejects(
        testOIAnalyticsConnection(true, mockRegistration, null, HTTPRequest, false),
        /HTTP request failed with status code 500/
      );
    });

    describe('401 Handling', () => {
      it('should throw error on 401 if accept401AsSuccess is false', async () => {
        requestMock.mock.mockImplementation(async () => createMockResponse(401, 'Unauthorized'));

        await assert.rejects(
          testOIAnalyticsConnection(true, mockRegistration, null, HTTPRequest, false),
          /HTTP request failed with status code 401/
        );
      });

      it('should SUCCEED on 401 if accept401AsSuccess is true', async () => {
        requestMock.mock.mockImplementation(async () => createMockResponse(401, 'Unauthorized'));

        await assert.doesNotReject(testOIAnalyticsConnection(true, mockRegistration, null, HTTPRequest, true));
      });

      it('should still throw on other errors (e.g. 403) even if accept401AsSuccess is true', async () => {
        requestMock.mock.mockImplementation(async () => createMockResponse(403, 'Forbidden'));

        await assert.rejects(
          testOIAnalyticsConnection(true, mockRegistration, null, HTTPRequest, true),
          /HTTP request failed with status code 403/
        );
      });
    });

    it('should build the request URL through the API gateway when registration uses it', async () => {
      const gatewayRegistration = {
        ...mockRegistration,
        useApiGateway: true,
        apiGatewayBaseEndpoint: '/gateway'
      } as OIAnalyticsRegistration;

      await assert.doesNotReject(testOIAnalyticsConnection(true, gatewayRegistration, null, HTTPRequest, false));

      assert.strictEqual(requestMock.mock.calls.length, 1);
      assert.ok(String(requestMock.mock.calls[0].arguments[0]).includes('/gateway/api/oianalytics/oibus/status'));
    });
  });
});
