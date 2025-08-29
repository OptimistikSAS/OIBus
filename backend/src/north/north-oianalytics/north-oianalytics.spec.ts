import fsSync from 'node:fs';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import NorthOIAnalytics from './north-oianalytics';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import { compress, filesExists } from '../../service/utils';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthOIAnalyticsSettings, NorthOIAnalyticsSettingsSpecificSettings } from '../../../shared/model/north-settings.model';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import zlib from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import testData from '../../tests/utils/test-data';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import CertificateRepository from '../../repository/config/certificate.repository';
import CertificateRepositoryMock from '../../tests/__mocks__/repository/config/certificate-repository.mock';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import OianalyticsRegistrationRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import { mockBaseFolders } from '../../tests/utils/test-utils';
import { HTTPRequest, ReqAuthOptions, ReqOptions, ReqProxyOptions } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
import FormData from 'form-data';
import { ClientCertificateCredential, ClientSecretCredential } from '@azure/identity';
import CacheService from '../../service/cache/cache.service';
import { OIBusError } from '../../model/engine.model';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';

jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('node:zlib', () => ({
  gzipSync: jest.fn().mockImplementation(data => `gzipped ${data}`)
}));
jest.mock('../../service/utils');
jest.mock('../../service/transformer.service');
jest.mock('@azure/identity', () => ({
  ClientSecretCredential: jest.fn().mockImplementation(() => ({
    getToken: () => ({ token: 'client-secret-token' })
  })),
  ClientCertificateCredential: jest.fn().mockImplementation(() => ({
    getToken: () => ({ token: 'client-certificate-token' })
  }))
}));
jest.mock('../../service/http-request.utils');
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const logger: pino.Logger = new PinoLogger();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OianalyticsRegistrationRepositoryMock();
const cacheService: CacheService = new CacheServiceMock();
const oiBusTransformer: OIBusTransformer = new OIBusTransformerMock() as unknown as OIBusTransformer;

jest.mock(
  '../../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
    }
);

const myReadStream = {
  pipe: jest.fn().mockReturnThis(),
  on: jest.fn().mockImplementation((_event, handler) => {
    handler();
    return this;
  }),
  pause: jest.fn(),
  close: jest.fn()
};
(fsSync.createReadStream as jest.Mock).mockReturnValue(myReadStream);

const timeValues: Array<OIBusTimeValue> = [
  {
    pointId: 'pointId1',
    timestamp: testData.constants.dates.FAKE_NOW,
    data: { value: '666', quality: 'good' }
  },
  {
    pointId: 'pointId2',
    timestamp: testData.constants.dates.FAKE_NOW,
    data: { value: '777', quality: 'good' }
  }
];

let north: NorthOIAnalytics;
let configuration: NorthConnectorEntity<NorthOIAnalyticsSettings>;

const hostname = 'https://hostname';
const testCases: Array<[string, NorthOIAnalyticsSettings]> = [
  [
    'without proxy',
    {
      useOiaModule: false,
      timeout: 30,
      compress: false,
      specificSettings: {
        host: hostname,
        acceptUnauthorized: false,
        authentication: 'basic',
        accessKey: 'anyUser',
        secretKey: 'anypass',
        useProxy: false
      }
    }
  ],
  [
    'with proxy',
    {
      useOiaModule: false,
      timeout: 30,
      compress: false,
      specificSettings: {
        host: hostname,
        acceptUnauthorized: false,
        authentication: 'basic',
        accessKey: 'anyUser',
        secretKey: 'anypass',
        useProxy: true,
        proxyUrl: 'http://localhost',
        proxyUsername: 'my username',
        proxyPassword: 'my password'
      }
    }
  ]
];

describe.each(testCases)('NorthOIAnalytics %s', (_, settings) => {
  let authOptions: ReqAuthOptions;
  let proxyOptions: { proxy?: ReqProxyOptions };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = settings as NorthOIAnalyticsSettings;
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200));
    (filesExists as jest.Mock).mockReturnValue(true);
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);

    authOptions = {
      type: 'basic',
      username: settings.specificSettings!.accessKey!,
      password: settings.specificSettings!.secretKey
    };
    proxyOptions = settings.specificSettings!.useProxy
      ? {
          proxy: {
            url: settings.specificSettings?.proxyUrl,
            auth: {
              type: 'url',
              username: settings.specificSettings?.proxyUsername,
              password: settings.specificSettings?.proxyPassword
            }
          } as ReqProxyOptions
        }
      : {};

    north = new NorthOIAnalytics(
      configuration,
      northConnectorRepository,
      scanModeRepository,
      certificateRepository,
      oIAnalyticsRegistrationRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
    await north.start();
  });

  afterEach(() => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should test connection', async () => {
    const expectedReqOptions: ReqOptions = {
      method: 'GET',
      acceptUnauthorized: false,
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    await expect(north.testConnection()).resolves.not.toThrow();
    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/optimistik/oibus/status` }),
      expectedReqOptions
    );
  });

  it('should manage timeout error on test connection', async () => {
    const expectedReqOptions: ReqOptions = {
      method: 'GET',
      acceptUnauthorized: false,
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    (HTTPRequest as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Timeout error');
    });

    await expect(north.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/optimistik/oibus/status` }),
      expectedReqOptions
    );
  });

  it('should manage bad response on test connection', async () => {
    const expectedReqOptions: ReqOptions = {
      method: 'GET',
      acceptUnauthorized: false,
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(400, 'statusText'));

    await expect(north.testConnection()).rejects.toThrow(`HTTP request failed with status code 400 and message: "statusText"`);

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/optimistik/oibus/status` }),
      expectedReqOptions
    );
  });

  it('should properly handle values', async () => {
    await north.start();

    const expectedReqOptions: ReqOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      query: { dataSourceId: configuration.name },
      body: JSON.stringify(timeValues),
      acceptUnauthorized: false,
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    await north.handleValues(timeValues);

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/oianalytics/oibus/time-values` }),
      expectedReqOptions
    );
  });

  it('should properly handle values and compress them', async () => {
    const newSettings = structuredClone(north['connector'].settings);
    newSettings.compress = true;
    north['connector'].settings = newSettings;

    const values: Array<OIBusTimeValue> = [
      {
        pointId: 'pointId1',
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '666', quality: 'good' }
      },
      {
        pointId: 'pointId2',
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '777', quality: 'good' }
      }
    ];

    const expectedReqOptions: ReqOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      query: { dataSourceId: configuration.name },
      body: `gzipped ${JSON.stringify(values)}`,
      acceptUnauthorized: false,
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(timeValues));

    await north.handleContent({
      contentFile: '/path/to/file/example-123.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'time-values',
      source: 'south',
      options: {}
    });

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/oianalytics/oibus/time-values/compressed` }),
      expectedReqOptions
    );
    expect(zlib.gzipSync).toHaveBeenCalledWith(JSON.stringify(values));
  });

  it('should ignore data if bad content type', async () => {
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'bad',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(`Unsupported data type: bad (file path/to/file/example-123456789.file)`);
  });

  it('should properly throw fetch error with values', async () => {
    await north.start();
    const error = new Error('error');
    (HTTPRequest as jest.Mock).mockRejectedValueOnce(error);

    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(timeValues));
    await expect(
      north.handleContent({
        contentFile: '/path/to/file/example-123.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'time-values',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError(`Fail to reach values endpoint ${hostname}/api/oianalytics/oibus/time-values. ${error}`, true));
  });

  it('should properly throw error on values bad response', async () => {
    await north.start();
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(400, 'statusText'));

    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      query: { dataSourceId: configuration.name },
      body: JSON.stringify(timeValues),
      acceptUnauthorized: false,
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(timeValues));
    await expect(
      north.handleContent({
        contentFile: '/path/to/file/example-123.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'time-values',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError(`Error 400: "statusText"`, false));

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/oianalytics/oibus/time-values` }),
      expectedReqOptions
    );
  });

  it('should properly handle files', async () => {
    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { dataSourceId: configuration.name },
      body: expect.any(FormData),
      acceptUnauthorized: false,
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any',
      source: 'south',
      options: {}
    });

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/oianalytics/file-uploads` }),
      expectedReqOptions
    );
  });

  it('should properly handle files and compress them', async () => {
    const newSettings = structuredClone(north['connector'].settings);
    newSettings.compress = true;
    north['connector'].settings = newSettings;

    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { dataSourceId: configuration.name },
      body: expect.any(FormData),
      acceptUnauthorized: false,
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };
    (filesExists as jest.Mock).mockReturnValueOnce(true).mockReturnValueOnce(false);

    await north.handleContent({
      contentFile: '/path/to/file/example-123456.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any',
      source: 'south',
      options: {}
    });

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/oianalytics/file-uploads` }),
      expectedReqOptions
    );
    expect(compress).toHaveBeenCalledWith(
      '/path/to/file/example-123456.file',
      path.resolve('/path', 'to', 'file', 'example.file-123456.gz')
    );
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('/path', 'to', 'file', 'example.file-123456.gz'));
  });

  it('should properly throw error when file does not exist', async () => {
    const filePath = '/path/to/file/example.file';
    (filesExists as jest.Mock).mockReturnValueOnce(false);
    await expect(north.handleFile(filePath)).rejects.toThrow(new Error(`File ${filePath} does not exist`));
  });

  it('should properly throw fetch error with files', async () => {
    const filePath = '/path/to/file/example.file';
    const error = new Error('error');
    (HTTPRequest as jest.Mock).mockRejectedValueOnce(error);

    await expect(north.handleFile(filePath)).rejects.toThrow(
      new OIBusError(`Fail to reach file endpoint ${hostname}/api/oianalytics/file-uploads. ${error}`, true)
    );
  });

  it('should properly throw error on file bad response', async () => {
    const filePath = '/path/to/file/example.file';
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(501, 'statusText'));

    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { dataSourceId: configuration.name },
      body: expect.any(FormData),
      acceptUnauthorized: false,
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    await expect(north.handleFile(filePath)).rejects.toThrow(new OIBusError(`Error 501: "statusText"`, false));

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/oianalytics/file-uploads` }),
      expectedReqOptions
    );
  });

  it('should not get auth options without accessKey', async () => {
    const newSettings = structuredClone(north['connector'].settings);
    newSettings.specificSettings!.accessKey = undefined;
    north['connector'].settings = newSettings;

    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { dataSourceId: configuration.name },
      body: expect.any(FormData),
      acceptUnauthorized: false,
      auth: undefined, // no auth options given
      timeout: 30000,
      ...proxyOptions
    };

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any',
      source: 'south',
      options: {}
    });

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/oianalytics/file-uploads` }),
      expectedReqOptions
    );
  });

  it('should remove trailing slash from host', async () => {
    const newSettings = structuredClone(north['connector'].settings);
    newSettings.specificSettings!.host = hostname + '/';
    north['connector'].settings = newSettings;

    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { dataSourceId: configuration.name },
      body: expect.any(FormData),
      acceptUnauthorized: false,
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any',
      source: 'south',
      options: {}
    });

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/oianalytics/file-uploads` }),
      expectedReqOptions
    );
  });

  if (settings.specificSettings?.useProxy) {
    it('should throw error when proxy url is not defined', async () => {
      const newSettings = structuredClone(north['connector'].settings);
      newSettings.specificSettings!.proxyUrl = undefined;
      north['connector'].settings = newSettings;

      await expect(
        north.handleContent({
          contentFile: 'path/to/file/example.file',
          contentSize: 1234,
          numberOfElement: 1,
          createdAt: '2020-02-02T02:02:02.222Z',
          contentType: 'any',
          source: 'south',
          options: {}
        })
      ).rejects.toThrow(
        `Fail to reach file endpoint ${hostname}/api/oianalytics/file-uploads. ${new Error('Proxy URL not specified using specific settings')}`
      );
    });
  }
});

describe('NorthOIAnalytics with Azure Active Directory', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      useOiaModule: false,
      timeout: 30,
      compress: false,
      specificSettings: {
        host: hostname,
        acceptUnauthorized: false,
        useProxy: false,
        tenantId: 'tenantId',
        clientId: 'clientId'
      } as NorthOIAnalyticsSettingsSpecificSettings
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (filesExists as jest.Mock).mockReturnValue(true);
    (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200));
  });

  describe('Azure Active Directory using certificate', () => {
    beforeEach(async () => {
      configuration.settings.specificSettings = {
        ...configuration.settings.specificSettings,
        authentication: 'aad-certificate',
        certificateId: 'certificateId'
      } as NorthOIAnalyticsSettingsSpecificSettings;

      (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);

      north = new NorthOIAnalytics(
        configuration,
        northConnectorRepository,
        scanModeRepository,
        certificateRepository,
        oIAnalyticsRegistrationRepository,
        logger,
        mockBaseFolders(testData.north.list[0].id)
      );
      await north.start();
    });

    it('should add auth option with aad-certificate', async () => {
      (certificateRepository.findById as jest.Mock).mockReturnValueOnce({
        name: 'name',
        description: 'description',
        publicKey: 'public key',
        privateKey: 'private key',
        certificate: 'cert',
        expiry: '2020-10-10T00:00:00.000Z'
      });

      const expectedReqOptions = {
        method: 'POST',
        headers: {
          'content-type': expect.stringContaining('multipart/form-data; boundary=')
        },
        query: { dataSourceId: configuration.name },
        body: expect.any(FormData),
        acceptUnauthorized: false,
        auth: {
          type: 'bearer',
          token: 'Bearer client-certificate-token'
        } as ReqAuthOptions,
        timeout: 30000,
        proxy: undefined
      };

      await north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any',
        source: 'south',
        options: {}
      });

      const { tenantId, clientId } = configuration.settings.specificSettings!;
      expect(ClientCertificateCredential).toHaveBeenCalledWith(tenantId, clientId, {
        certificate: `cert\nprivate key`
      });
      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({ href: `${hostname}/api/oianalytics/file-uploads` }),
        expectedReqOptions
      );
    });

    it('should not auth option with aad-certificate when cert not found', async () => {
      (certificateRepository.findById as jest.Mock).mockReturnValueOnce(null);

      const expectedReqOptions = {
        method: 'POST',
        headers: {
          'content-type': expect.stringContaining('multipart/form-data; boundary=')
        },
        query: { dataSourceId: configuration.name },
        body: expect.any(FormData),
        acceptUnauthorized: false,
        auth: undefined,
        timeout: 30000,
        proxy: undefined
      };

      await north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any',
        source: 'south',
        options: {}
      });

      (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
      expect(ClientCertificateCredential).not.toHaveBeenCalled();
      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({ href: `${hostname}/api/oianalytics/file-uploads` }),
        expectedReqOptions
      );
    });
  });

  describe('Azure Active Directory using client secret', () => {
    beforeEach(async () => {
      configuration.settings.specificSettings = {
        ...configuration.settings.specificSettings,
        authentication: 'aad-client-secret',
        clientSecret: 'clientSecret'
      } as NorthOIAnalyticsSettingsSpecificSettings;
      (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);

      north = new NorthOIAnalytics(
        configuration,
        northConnectorRepository,
        scanModeRepository,
        certificateRepository,
        oIAnalyticsRegistrationRepository,
        logger,
        mockBaseFolders(testData.north.list[0].id)
      );
      await north.start();
    });

    it('should add auth option with aad-client-secret', async () => {
      const expectedReqOptions = {
        method: 'POST',
        headers: {
          'content-type': expect.stringContaining('multipart/form-data; boundary=')
        },
        query: { dataSourceId: configuration.name },
        body: expect.any(FormData),
        acceptUnauthorized: false,
        auth: {
          type: 'bearer',
          token: 'Bearer client-secret-token'
        } as ReqAuthOptions,
        timeout: 30000,
        proxy: undefined
      };

      await north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any',
        source: 'south',
        options: {}
      });

      const { tenantId, clientId, clientSecret } = configuration.settings.specificSettings!;
      expect(ClientSecretCredential).toHaveBeenCalledWith(tenantId, clientId, clientSecret);
      expect(HTTPRequest).toHaveBeenCalledWith(
        expect.objectContaining({ href: `${hostname}/api/oianalytics/file-uploads` }),
        expectedReqOptions
      );
    });
  });
});

describe('NorthOIAnalytics with OIA module', () => {
  let registrationSettings: OIAnalyticsRegistration;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      useOiaModule: true,
      timeout: 30,
      compress: false
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (filesExists as jest.Mock).mockReturnValue(true);
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200));

    registrationSettings = {
      id: 'id',
      host: hostname,
      token: 'my-oia-token',
      status: 'REGISTERED',
      activationDate: '2020-01-01T00:00:00Z',
      useProxy: false,
      acceptUnauthorized: false,
      activationCode: null,
      publicCipherKey: null,
      privateCipherKey: null,
      checkUrl: null,
      proxyUrl: null,
      proxyUsername: null,
      proxyPassword: null
    } as OIAnalyticsRegistration;
    north = new NorthOIAnalytics(
      configuration,
      northConnectorRepository,
      scanModeRepository,
      certificateRepository,
      oIAnalyticsRegistrationRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
    await north.start();
  });

  afterEach(() => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should use oia module', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registrationSettings);

    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { dataSourceId: configuration.name },
      body: expect.any(FormData),
      acceptUnauthorized: false,
      auth: {
        type: 'bearer',
        token: 'my-oia-token'
      } as ReqAuthOptions,
      timeout: 30000,
      proxy: undefined
    };

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any',
      source: 'south',
      options: {}
    });

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/oianalytics/file-uploads` }),
      expectedReqOptions
    );
  });

  it('should use oia module with proxy', async () => {
    registrationSettings.host = hostname;
    registrationSettings.useProxy = true;
    registrationSettings.proxyUrl = 'http://localhost:8080';
    registrationSettings.proxyUsername = 'user';
    registrationSettings.proxyPassword = 'pass';
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registrationSettings);

    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { dataSourceId: configuration.name },
      body: expect.any(FormData),
      acceptUnauthorized: false,
      auth: {
        type: 'bearer',
        token: 'my-oia-token'
      } as ReqAuthOptions,
      timeout: 30000,
      proxy: {
        url: 'http://localhost:8080',
        auth: {
          type: 'url',
          username: 'user',
          password: 'pass'
        }
      } as ReqProxyOptions
    };

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any',
      source: 'south',
      options: {}
    });

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/oianalytics/file-uploads` }),
      expectedReqOptions
    );
  });

  it('should use oia module with proxy without user', async () => {
    registrationSettings.host = hostname;
    registrationSettings.useProxy = true;
    registrationSettings.proxyUrl = 'http://localhost:8080';
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registrationSettings);

    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { dataSourceId: configuration.name },
      body: expect.any(FormData),
      acceptUnauthorized: false,
      auth: {
        type: 'bearer',
        token: 'my-oia-token'
      } as ReqAuthOptions,
      timeout: 30000,
      proxy: {
        url: 'http://localhost:8080'
      } as ReqProxyOptions
    };

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any',
      source: 'south',
      options: {}
    });

    expect(HTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({ href: `${hostname}/api/oianalytics/file-uploads` }),
      expectedReqOptions
    );
  });

  it('should not use oia module if not registered', async () => {
    registrationSettings.status = 'PENDING';
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registrationSettings);
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new Error('OIBus not registered in OIAnalytics'));
  });

  it('should not use proxy when oia module is not registered', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockImplementation(() => {
      const { stack } = new Error();
      if (stack?.includes('NorthOIAnalytics.getProxyOptions')) {
        return null;
      }
      return registrationSettings;
    });

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(
      `Fail to reach file endpoint ${hostname}/api/oianalytics/file-uploads. ${new Error('OIBus not registered in OIAnalytics')}`
    );
  });

  it('should not use auth options when oia module is not registered', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockImplementation(() => {
      const { stack } = new Error();
      if (stack?.includes('NorthOIAnalytics.getAuthorizationOptions')) {
        return null;
      }
      return registrationSettings;
    });

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(
      `Fail to reach file endpoint ${hostname}/api/oianalytics/file-uploads. ${new Error('OIBus not registered in OIAnalytics')}`
    );
  });

  it('should not use host when oia module is not registered', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockImplementation(() => {
      const { stack } = new Error();
      if (stack?.includes('NorthOIAnalytics.getHost')) {
        return null;
      }
      return registrationSettings;
    });

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new Error('OIBus not registered in OIAnalytics'));
  });
});
