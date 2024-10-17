import fsSync from 'node:fs';

import NorthOIAnalytics from './north-oianalytics';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';

import fetch from 'node-fetch';
import { compress, filesExists } from '../../service/utils';

import ValueCacheServiceMock from '../../tests/__mocks__/service/cache/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/service/cache/file-cache-service.mock';
import { NorthOIAnalyticsSettings } from '../../../../shared/model/north-settings.model';
import ArchiveServiceMock from '../../tests/__mocks__/service/cache/archive-service.mock';
import { createProxyAgent } from '../../service/proxy-agent';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';
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

jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('node:zlib');
jest.mock('../../service/utils');
jest.mock('../../service/proxy-agent');
jest.mock('@azure/identity', () => ({
  ClientSecretCredential: jest.fn().mockImplementation(() => ({
    getToken: () => ({ token: 'token' })
  })),
  ClientCertificateCredential: jest.fn().mockImplementation(() => ({
    getToken: () => ({ token: 'token' })
  }))
}));
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OianalyticsRegistrationRepositoryMock();
const valueCacheService = new ValueCacheServiceMock();
const fileCacheService = new FileCacheServiceMock();
const archiveService = new ArchiveServiceMock();

jest.mock(
  '../../service/cache/value-cache.service',
  () =>
    function () {
      return valueCacheService;
    }
);
jest.mock(
  '../../service/cache/file-cache.service',
  () =>
    function () {
      return fileCacheService;
    }
);
jest.mock(
  '../../service/cache/archive.service',
  () =>
    function () {
      return archiveService;
    }
);

const myReadStream = {
  pipe: jest.fn().mockReturnThis(),
  on: jest.fn().mockImplementation((event, handler) => {
    handler();
    return this;
  }),
  pause: jest.fn(),
  close: jest.fn()
};
(fsSync.createReadStream as jest.Mock).mockReturnValue(myReadStream);

let north: NorthOIAnalytics;
let configuration: NorthConnectorEntity<NorthOIAnalyticsSettings>;
describe('NorthOIAnalytics without proxy', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      useOiaModule: false,
      timeout: 30,
      compress: false,
      specificSettings: {
        host: 'https://hostname/',
        acceptUnauthorized: false,
        authentication: 'basic',
        accessKey: 'anyUser',
        secretKey: 'anypass',
        useProxy: false
      }
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    (filesExists as jest.Mock).mockReturnValue(true);
    north = new NorthOIAnalytics(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,

      certificateRepository,
      oIAnalyticsRegistrationRepository,
      logger,
      'baseFolder'
    );
    await north.start();
  });

  it('should manage timeout error on test connection', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Timeout error');
    });

    await expect(north.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(fetch).toHaveBeenCalledWith('https://hostname/api/optimistik/oibus/status', {
      headers: { authorization: 'Basic YW55VXNlcjphbnlwYXNz' },
      method: 'GET',
      timeout: 30000
    });
    expect(createProxyAgent).toHaveBeenCalledWith(
      false,
      `${configuration.settings.specificSettings!.host}/api/optimistik/oibus/status`,
      null,
      configuration.settings.specificSettings!.acceptUnauthorized
    );
  });

  it('should properly handle values', async () => {
    await north.start();
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
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(
          `${configuration.settings.specificSettings!.accessKey}:${configuration.settings.specificSettings!.secretKey}`
        ).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      body: JSON.stringify([
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
      ]),
      agent: undefined
    };

    await north.handleContent({ type: 'time-values', content: values });

    expect(fetch).toHaveBeenCalledWith(
      `${configuration.settings.specificSettings!.host}/api/oianalytics/oibus/time-values?dataSourceId=${encodeURI(configuration.name)}`,
      expectedFetchOptions
    );
  });

  it('should properly throw fetch error with values', async () => {
    await north.start();
    const values: Array<OIBusTimeValue> = [
      {
        pointId: 'pointId1',
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '666', quality: 'good' }
      }
    ];
    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });

    let err;
    try {
      await north.handleValues(values);
    } catch (error) {
      err = error;
    }
    expect(err).toEqual({
      message: `Fail to reach values endpoint ${
        configuration.settings.specificSettings!.host
      }/api/oianalytics/oibus/time-values?dataSourceId=${encodeURI(configuration.name)}. ${new Error('error')}`,
      retry: true
    });
  });

  it('should properly throw error on values bad response', async () => {
    await north.start();
    const values: Array<OIBusTimeValue> = [
      {
        pointId: 'pointId1',
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '666', quality: 'good' }
      }
    ];
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve({ ok: false, status: 400, statusText: 'statusText' }));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(
          `${configuration.settings.specificSettings!.accessKey}:${configuration.settings.specificSettings!.secretKey}`
        ).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      body: JSON.stringify(values),
      agent: undefined
    };

    let err;
    try {
      await north.handleValues(values);
    } catch (error) {
      err = error;
    }

    expect(err).toEqual({
      message: `Error 400: statusText`,
      retry: false
    });

    expect(fetch).toHaveBeenCalledWith(
      `${configuration.settings.specificSettings!.host}/api/oianalytics/oibus/time-values?dataSourceId=${encodeURI(configuration.name)}`,
      expectedFetchOptions
    );
  });

  it('should properly handle files', async () => {
    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(
          `${configuration.settings.specificSettings!.accessKey}:${configuration.settings.specificSettings!.secretKey}`
        ).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      timeout: 30000,
      body: expect.anything(),
      agent: undefined
    };

    await north.handleContent({ type: 'raw', filePath });

    expect(fetch).toHaveBeenCalledWith(
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${encodeURI(configuration.name)}`,
      expectedFetchOptions
    );
  });

  it('should properly throw error when file does not exist', async () => {
    const filePath = '/path/to/file/example.file';

    (filesExists as jest.Mock).mockReturnValueOnce(false);
    let err;
    try {
      await north.handleFile(filePath);
    } catch (error) {
      err = error;
    }
    expect(err).toEqual(new Error(`File ${filePath} does not exist`));
  });

  it('should properly throw fetch error with files', async () => {
    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('error');
    });

    let err;
    try {
      await north.handleFile(filePath);
    } catch (error) {
      err = error;
    }
    expect(err).toEqual({
      message: `Fail to reach file endpoint ${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${encodeURI(
        configuration.name
      )}. ${new Error('error')}`,
      retry: true
    });
  });

  it('should properly throw error on file bad response', async () => {
    await north.start();

    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve({ ok: false, status: 501, statusText: 'statusText' }));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(
          `${configuration.settings.specificSettings!.accessKey}:${configuration.settings.specificSettings!.secretKey}`
        ).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      timeout: 30000,
      body: expect.anything(),
      agent: undefined
    };

    await expect(north.handleFile(filePath)).rejects.toThrow({
      message: `Error 501: statusText`,
      retry: false
    } as unknown as Error);

    expect(fetch).toHaveBeenCalledWith(
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${encodeURI(configuration.name)}`,
      expectedFetchOptions
    );
  });
});

describe('NorthOIAnalytics without proxy but with acceptUnauthorized', () => {
  const fakeAgent = { rejectUnauthorized: false };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      useOiaModule: false,
      timeout: 30,
      compress: false,
      specificSettings: {
        host: 'https://hostname',
        acceptUnauthorized: true,
        accessKey: 'anyUser',
        authentication: 'aad-client-secret',
        tenantId: 'tenantId',
        clientId: 'clientId',
        clientSecret: 'clientSecret',
        scope: 'api://my-scope/.default',
        secretKey: null,
        useProxy: false
      }
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    (filesExists as jest.Mock).mockReturnValue(true);
    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);
    north = new NorthOIAnalytics(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,

      certificateRepository,
      oIAnalyticsRegistrationRepository,
      logger,
      'baseFolder'
    );
    await north.start();
  });

  it('should properly handle values', async () => {
    await north.start();
    const values: Array<OIBusTimeValue> = [
      {
        pointId: 'pointId1',
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '666', quality: 'good' }
      }
    ];
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Bearer token`,
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      body: JSON.stringify(values),
      agent: fakeAgent
    };

    await north.handleValues(values);

    expect(fetch).toHaveBeenCalledWith(
      `${configuration.settings.specificSettings!.host}/api/oianalytics/oibus/time-values?dataSourceId=${encodeURI(configuration.name)}`,
      expectedFetchOptions
    );
    expect(createProxyAgent).toHaveBeenCalledWith(
      false,
      `${configuration.settings.specificSettings!.host}/api/oianalytics/oibus/time-values?dataSourceId=${encodeURI(configuration.name)}`,
      null,
      true
    );
  });

  it('should properly handle files', async () => {
    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Bearer token`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      body: expect.anything(),
      agent: fakeAgent,
      timeout: 30000
    };

    await north.handleFile(filePath);

    expect(fetch).toHaveBeenCalledWith(
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${encodeURI(configuration.name)}`,
      expectedFetchOptions
    );
    expect(createProxyAgent).toHaveBeenCalledWith(
      false,
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${encodeURI(configuration.name)}`,
      null,
      true
    );
  });
});

describe('NorthOIAnalytics with proxy', () => {
  const fakeAgent = { rejectUnauthorized: false };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (filesExists as jest.Mock).mockReturnValue(true);
    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      useOiaModule: false,
      timeout: 30,
      compress: false,
      specificSettings: {
        host: 'https://hostname',
        acceptUnauthorized: false,
        authentication: 'aad-client-secret',
        tenantId: 'tenantId',
        clientId: 'clientId',
        clientSecret: 'clientSecret',
        scope: 'api://my-scope/.default',
        useProxy: true,
        proxyUrl: 'http://localhost',
        proxyUsername: 'my username',
        proxyPassword: 'my password'
      }
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    north = new NorthOIAnalytics(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,

      certificateRepository,
      oIAnalyticsRegistrationRepository,
      logger,
      'baseFolder'
    );
    await north.start();
  });

  it('should manage timeout error on test connection', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Timeout error');
    });

    await expect(north.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(fetch).toHaveBeenCalledWith('https://hostname/api/optimistik/oibus/status', {
      headers: { authorization: `Bearer token` },
      method: 'GET',
      agent: fakeAgent,
      timeout: 30000
    });
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      `${configuration.settings.specificSettings!.host}/api/optimistik/oibus/status`,
      {
        url: configuration.settings.specificSettings!.proxyUrl!,
        username: configuration.settings.specificSettings!.proxyUsername!,
        password: configuration.settings.specificSettings!.proxyPassword
      },
      configuration.settings.specificSettings!.acceptUnauthorized
    );
  });

  it('should test connection', async () => {
    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          status: 200
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        })
      );

    await expect(north.testConnection()).resolves.not.toThrow();
    await expect(north.testConnection()).rejects.toThrow(`HTTP request failed with status code 401 and message: Unauthorized`);
  });

  it('should properly handle values', async () => {
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));
    await north.handleValues([]);
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      `${configuration.settings.specificSettings!.host}/api/oianalytics/oibus/time-values?dataSourceId=${encodeURI(configuration.name)}`,
      {
        url: configuration.settings.specificSettings!.proxyUrl!,
        username: configuration.settings.specificSettings!.proxyUsername!,
        password: configuration.settings.specificSettings!.proxyPassword
      },
      configuration.settings.specificSettings!.acceptUnauthorized
    );
  });

  it('should properly handle files', async () => {
    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));
    await north.handleFile(filePath);
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${encodeURI(configuration.name)}`,
      {
        url: configuration.settings.specificSettings!.proxyUrl!,
        username: configuration.settings.specificSettings!.proxyUsername!,
        password: configuration.settings.specificSettings!.proxyPassword
      },
      configuration.settings.specificSettings!.acceptUnauthorized
    );
  });
});

describe('NorthOIAnalytics with proxy but without proxy password', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (filesExists as jest.Mock).mockReturnValue(true);
    (createProxyAgent as jest.Mock).mockReturnValue({});
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      useOiaModule: false,
      timeout: 30,
      compress: true,
      specificSettings: {
        host: 'https://hostname',
        acceptUnauthorized: false,
        authentication: 'basic',
        accessKey: 'anyUser',
        secretKey: null,
        useProxy: true,
        proxyUrl: 'http://localhost',
        proxyUsername: 'my username',
        proxyPassword: null
      }
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    north = new NorthOIAnalytics(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,

      certificateRepository,
      oIAnalyticsRegistrationRepository,
      logger,
      'baseFolder'
    );
    await north.start();
  });

  it('should manage timeout error on test connection', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Timeout error');
    });

    await expect(north.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      `${configuration.settings.specificSettings!.host}/api/optimistik/oibus/status`,
      {
        url: configuration.settings.specificSettings!.proxyUrl!,
        username: configuration.settings.specificSettings!.proxyUsername!,
        password: configuration.settings.specificSettings!.proxyPassword
      },
      configuration.settings.specificSettings!.acceptUnauthorized
    );
  });

  it('should properly handle values', async () => {
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));
    await north.handleValues([]);
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      `${configuration.settings.specificSettings!.host}/api/oianalytics/oibus/time-values/compressed?dataSourceId=${encodeURI(configuration.name)}`,
      {
        url: configuration.settings.specificSettings!.proxyUrl!,
        username: configuration.settings.specificSettings!.proxyUsername!,
        password: null
      },
      configuration.settings.specificSettings!.acceptUnauthorized
    );
    expect(zlib.gzipSync).toHaveBeenCalledWith(JSON.stringify([]));
  });

  it('should properly handle files and compress it', async () => {
    const filePath = '/path/to/file/example-123456.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));
    (filesExists as jest.Mock).mockReturnValueOnce(true).mockReturnValueOnce(false);
    await north.handleFile(filePath);
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${encodeURI(configuration.name)}`,
      {
        url: configuration.settings.specificSettings!.proxyUrl!,
        username: configuration.settings.specificSettings!.proxyUsername!,
        password: null
      },
      configuration.settings.specificSettings!.acceptUnauthorized
    );
    expect(compress).toHaveBeenCalledWith(filePath, path.resolve('/path', 'to', 'file', 'example.file-123456.gz'));
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('/path', 'to', 'file', 'example.file-123456.gz'));
  });

  it('should properly handle files and not compress it', async () => {
    const filePath = '/path/to/file/example-123456.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));
    (filesExists as jest.Mock).mockReturnValueOnce(true).mockReturnValueOnce(true);
    await north.handleFile(filePath);
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${encodeURI(configuration.name)}`,
      {
        url: configuration.settings.specificSettings!.proxyUrl!,
        username: configuration.settings.specificSettings!.proxyUsername!,
        password: null
      },
      configuration.settings.specificSettings!.acceptUnauthorized
    );
    expect(compress).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalledWith(path.resolve('/path', 'to', 'file', 'example.file-123456.gz'));
  });

  it('should properly handle files without secret key', async () => {
    const filePath = '/path/to/file/example-123456.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${configuration.settings.specificSettings!.accessKey}:`).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      body: expect.anything(),
      timeout: configuration.settings.timeout * 1000,
      agent: {}
    };

    await north.handleFile(filePath);

    expect(fetch).toHaveBeenCalledWith(
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${encodeURI(configuration.name)}`,
      expectedFetchOptions
    );
  });
});

describe('NorthOIAnalytics with aad-certificate', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      useOiaModule: false,
      timeout: 30,
      compress: false,
      specificSettings: {
        host: 'https://hostname/',
        acceptUnauthorized: false,
        authentication: 'aad-certificate',
        certificateId: 'certificateId',
        useProxy: false
      }
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    (filesExists as jest.Mock).mockReturnValue(true);
    north = new NorthOIAnalytics(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,

      certificateRepository,
      oIAnalyticsRegistrationRepository,
      logger,
      'baseFolder'
    );
    await north.start();
  });

  it('should add header with aad-certificate', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce({
      name: 'name',
      description: 'description',
      publicKey: 'public key',
      privateKey: 'private key',
      certificate: 'cert',
      expiry: '2020-10-10T00:00:00.000Z'
    });
    const result = await north.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({ authorization: 'Bearer token' });
    expect(result.host).toEqual(configuration.settings.specificSettings!.host);
  });

  it('should not add header with aad-certificate when cert not found', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(null);
    const result = await north.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({});
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

    registrationSettings = {
      id: 'id',
      host: 'http://localhost:4200',
      token: 'my oia token',
      status: 'REGISTERED',
      activationDate: '2020-01-01T00:00:00Z',
      useProxy: false,
      acceptUnauthorized: false
    };
    north = new NorthOIAnalytics(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,

      certificateRepository,
      oIAnalyticsRegistrationRepository,
      logger,
      'baseFolder'
    );
    await north.start();
  });

  it('should use oia module', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(registrationSettings);
    const result = await north.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({ authorization: 'Bearer my oia token' });
    expect(result.host).toEqual(registrationSettings.host);
    expect(createProxyAgent).toHaveBeenCalledWith(
      registrationSettings.useProxy,
      `${registrationSettings.host}/endpoint`,
      null,
      registrationSettings.acceptUnauthorized
    );
  });

  it('should use oia module with proxy', async () => {
    registrationSettings.host = 'http://localhost:4200/';
    registrationSettings.useProxy = true;
    registrationSettings.proxyUrl = 'http://localhost:8080';
    registrationSettings.proxyUsername = 'user';
    registrationSettings.proxyPassword = 'pass';
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(registrationSettings);
    const result = await north.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({ authorization: 'Bearer my oia token' });
    expect(result.host).toEqual('http://localhost:4200');
    expect(createProxyAgent).toHaveBeenCalledWith(
      registrationSettings.useProxy,
      `${registrationSettings.host}/endpoint`,
      { url: registrationSettings.proxyUrl, username: registrationSettings.proxyUsername, password: registrationSettings.proxyPassword },
      registrationSettings.acceptUnauthorized
    );
  });

  it('should use oia module with proxy without user', async () => {
    registrationSettings.host = 'http://localhost:4200/';
    registrationSettings.useProxy = true;
    registrationSettings.proxyUrl = 'http://localhost:8080';
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(registrationSettings);
    const result = await north.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({ authorization: 'Bearer my oia token' });
    expect(result.host).toEqual('http://localhost:4200');
    expect(createProxyAgent).toHaveBeenCalledWith(
      registrationSettings.useProxy,
      `${registrationSettings.host}/endpoint`,
      { url: registrationSettings.proxyUrl, username: undefined, password: null },
      registrationSettings.acceptUnauthorized
    );
  });

  it('should not use oia module if not registered', async () => {
    registrationSettings.status = 'PENDING';
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(registrationSettings);

    await expect(north.getNetworkSettings('/endpoint')).rejects.toThrow(new Error('OIBus not registered in OIAnalytics'));

    expect(createProxyAgent).not.toHaveBeenCalled();
  });
});
