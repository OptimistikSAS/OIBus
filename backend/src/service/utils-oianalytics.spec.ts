import {
  getAuthorizationOptions,
  getHost,
  getHeaders,
  getProxyOptions,
  buildHttpOptions,
  parseData,
  OIATimeValues
} from './utils-oianalytics';
import { encryptionService } from './encryption.service';
import { ClientSecretCredential, ClientCertificateCredential } from '@azure/identity';
import CertificateRepository from '../repository/config/certificate.repository';
import { OIAnalyticsRegistration } from '../model/oianalytics-registration.model';
import { NorthOIAnalyticsSettingsSpecificSettings } from '../../shared/model/north-settings.model';
import { Certificate } from '../model/certificate.model';

// Mock dependencies
jest.mock('./encryption.service');
jest.mock('@azure/identity');

describe('utils-oianalytics', () => {
  let mockCertRepo: jest.Mocked<CertificateRepository>;

  // Setup mock functions for encryption service
  const mockEncrypt = encryptionService.encryptText as jest.Mock;
  const mockDecrypt = encryptionService.decryptText as jest.Mock;

  // Setup mock for Azure Identity
  const mockClientSecretCredential = ClientSecretCredential as jest.Mock;
  const mockClientCertificateCredential = ClientCertificateCredential as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockEncrypt.mockResolvedValue('encrypted-token');
    mockDecrypt.mockImplementation(async text => `decrypted-${text}`);

    // Mock Certificate Repository
    mockCertRepo = {
      findById: jest.fn()
    } as unknown as jest.Mocked<CertificateRepository>;

    // Mock Azure Identity instances
    mockClientSecretCredential.mockImplementation(() => ({
      getToken: jest.fn().mockResolvedValue({ token: 'azure-token' })
    }));
    mockClientCertificateCredential.mockImplementation(() => ({
      getToken: jest.fn().mockResolvedValue({ token: 'azure-token' })
    }));
  });

  describe('getAuthorizationOptions', () => {
    const mockRegistration: OIAnalyticsRegistration = { token: 'reg-token' } as OIAnalyticsRegistration;

    it('should return bearer token from registration settings if useOIAnalyticsRegistration is true', async () => {
      const result = await getAuthorizationOptions(true, mockRegistration, null, mockCertRepo);
      expect(result).toEqual({ type: 'bearer', token: 'reg-token' });
    });

    it('should return basic auth options', async () => {
      const settings = { authentication: 'basic', accessKey: 'user', secretKey: 'pass' } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = await getAuthorizationOptions(false, mockRegistration, settings, mockCertRepo);
      expect(result).toEqual({ type: 'basic', username: 'user', password: 'pass' });
    });

    it('should return undefined for basic auth if accessKey is missing', async () => {
      const settings = { authentication: 'basic', accessKey: '' } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = await getAuthorizationOptions(false, mockRegistration, settings, mockCertRepo);
      expect(result).toBeUndefined();
    });

    it('should handle aad-client-secret authentication', async () => {
      const settings = {
        authentication: 'aad-client-secret',
        tenantId: 'tid',
        clientId: 'cid',
        clientSecret: 'secret',
        scope: 'scope'
      } as NorthOIAnalyticsSettingsSpecificSettings;

      const result = await getAuthorizationOptions(false, mockRegistration, settings, mockCertRepo);

      expect(mockDecrypt).toHaveBeenCalledWith('secret');
      expect(mockClientSecretCredential).toHaveBeenCalledWith('tid', 'cid', 'decrypted-secret');
      expect(mockEncrypt).toHaveBeenCalledWith('Bearer azure-token'); // Buffer handling is internal to encrypt
      expect(result).toEqual({ type: 'bearer', token: 'encrypted-token' });
    });

    it('should handle aad-certificate authentication', async () => {
      const settings = {
        authentication: 'aad-certificate',
        certificateId: 'cert-1',
        tenantId: 'tid',
        clientId: 'cid',
        scope: 'scope'
      } as NorthOIAnalyticsSettingsSpecificSettings;

      mockCertRepo.findById.mockReturnValue({ certificate: 'cert-content', privateKey: 'pk' } as Certificate);

      const result = await getAuthorizationOptions(false, mockRegistration, settings, mockCertRepo);

      expect(mockCertRepo.findById).toHaveBeenCalledWith('cert-1');
      expect(mockDecrypt).toHaveBeenCalledWith('pk');
      expect(mockClientCertificateCredential).toHaveBeenCalledWith('tid', 'cid', {
        certificate: 'cert-content\ndecrypted-pk'
      });
      expect(result).toEqual({ type: 'bearer', token: 'encrypted-token' });
    });

    it('should return undefined for aad-certificate if certificate is not found', async () => {
      const settings = { authentication: 'aad-certificate', certificateId: 'missing' } as NorthOIAnalyticsSettingsSpecificSettings;
      mockCertRepo.findById.mockReturnValue(null);

      const result = await getAuthorizationOptions(false, mockRegistration, settings, mockCertRepo);
      expect(result).toBeUndefined();
    });
  });

  describe('getHost', () => {
    it('should return host from registration settings', () => {
      const reg = { host: 'reg-host' } as OIAnalyticsRegistration;
      expect(getHost(true, reg, null)).toBe('reg-host');
    });

    it('should return host from specific settings', () => {
      const specific = { host: 'spec-host' } as NorthOIAnalyticsSettingsSpecificSettings;
      expect(getHost(false, {} as OIAnalyticsRegistration, specific)).toBe('spec-host');
    });
  });

  describe('getHeaders', () => {
    it('should return empty headers if useApiGateway is false', async () => {
      const reg = { useApiGateway: false } as OIAnalyticsRegistration;
      const result = await getHeaders(true, reg);
      expect(result).toEqual({});
    });

    it('should return gateway headers if registered', async () => {
      const reg = {
        useApiGateway: true,
        status: 'REGISTERED',
        apiGatewayHeaderKey: 'x-key',
        apiGatewayHeaderValue: 'encrypted-val'
      } as OIAnalyticsRegistration;

      const result = await getHeaders(true, reg);

      expect(mockDecrypt).toHaveBeenCalledWith('encrypted-val');
      expect(result).toEqual({ 'x-key': 'decrypted-encrypted-val' });
    });
  });

  describe('getProxyOptions', () => {
    it('should return undefined proxy if useProxy is false (registration)', () => {
      const reg = { useProxy: false, acceptUnauthorized: true } as OIAnalyticsRegistration;
      const result = getProxyOptions(true, reg, null);
      expect(result).toEqual({ proxy: undefined, acceptUnauthorized: true });
    });

    it('should return undefined proxy if useProxy is false (specific)', () => {
      const spec = { useProxy: false, acceptUnauthorized: false } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = getProxyOptions(false, {} as OIAnalyticsRegistration, spec);
      expect(result).toEqual({ proxy: undefined, acceptUnauthorized: false });
    });

    it('should throw error if proxyUrl is missing (registration)', () => {
      const reg = { useProxy: true } as OIAnalyticsRegistration;
      expect(() => getProxyOptions(true, reg, null)).toThrow('Proxy URL not specified using registered OIAnalytics module');
    });

    it('should throw error if proxyUrl is missing (specific)', () => {
      const spec = { useProxy: true } as NorthOIAnalyticsSettingsSpecificSettings;
      expect(() => getProxyOptions(false, {} as OIAnalyticsRegistration, spec)).toThrow('Proxy URL not specified using specific settings');
    });

    it('should return proxy options without auth', () => {
      const spec = { useProxy: true, proxyUrl: 'http://proxy.com', acceptUnauthorized: true } as NorthOIAnalyticsSettingsSpecificSettings;
      const result = getProxyOptions(false, {} as OIAnalyticsRegistration, spec);
      expect(result).toEqual({
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
      expect(result).toEqual({
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
      await expect(buildHttpOptions('GET', true, reg, null, 1000, null)).rejects.toThrow('OIBus not registered in OIAnalytics');
    });

    it('should build full options object', async () => {
      const reg = {
        status: 'REGISTERED',
        token: 'token',
        useApiGateway: false,
        useProxy: false,
        acceptUnauthorized: false
      } as OIAnalyticsRegistration;

      const result = await buildHttpOptions('POST', true, reg, null, 5000, mockCertRepo);

      expect(result).toEqual({
        method: 'POST',
        headers: {},
        auth: { type: 'bearer', token: 'token' },
        proxy: undefined,
        timeout: 5000,
        acceptUnauthorized: false
      });
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

      expect(formattedResult).toHaveLength(2);
      expect(formattedResult[0]).toEqual({
        pointId: 'REF_1',
        timestamp: '2023-01-01T10:00:00.000Z',
        data: { value: 10, unit: '%' }
      });
      expect(formattedResult[1]).toEqual({
        pointId: 'REF_1',
        timestamp: '2023-01-01T10:05:00.000Z',
        data: { value: 20, unit: '%' }
      });
      expect(maxInstant).toBe('2023-01-01T10:05:00.000Z');
    });

    it('should handle mixed timestamps and find correct maxInstant', () => {
      const input: Array<OIATimeValues> = [
        {
          type: 'time-values',
          unit: { id: '1', label: 'U' },
          data: { id: 'd1', dataType: 'R', reference: 'R1', description: 'D' },
          timestamps: ['2023-01-02T00:00:00Z'], // Later date
          values: [100]
        },
        {
          type: 'time-values',
          unit: { id: '1', label: 'U' },
          data: { id: 'd2', dataType: 'R', reference: 'R2', description: 'D' },
          timestamps: ['2023-01-01T00:00:00Z'], // Earlier date
          values: [50]
        }
      ];

      const { maxInstant } = parseData(input);
      // maxInstant should be the later date
      expect(maxInstant).toBe('2023-01-02T00:00:00.000Z');
    });
  });
});
