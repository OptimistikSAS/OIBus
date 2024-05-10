import fsSync from 'node:fs';

import NorthOIAnalytics from './north-oianalytics';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';

import fetch from 'node-fetch';
import { compress, filesExists } from '../../service/utils';

import ValueCacheServiceMock from '../../tests/__mocks__/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/file-cache-service.mock';
import { NorthOIAnalyticsSettings } from '../../../../shared/model/north-settings.model';
import ArchiveServiceMock from '../../tests/__mocks__/archive-service.mock';
import { createProxyAgent } from '../../service/proxy-agent';
import { OIBusTimeValue, RegistrationSettingsDTO } from '../../../../shared/model/engine.model';
import zlib from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';

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

jest.mock(
  '../../service/cache/archive.service',
  () =>
    function () {
      return new ArchiveServiceMock();
    }
);
jest.mock(
  '../../service/cache/value-cache.service',
  () =>
    function () {
      return new ValueCacheServiceMock();
    }
);
jest.mock(
  '../../service/cache/file-cache.service',
  () =>
    function () {
      return new FileCacheServiceMock();
    }
);
const resetMetrics = jest.fn();
jest.mock(
  '../../service/north-connector-metrics.service',
  () =>
    function () {
      return {
        initMetrics: jest.fn(),
        updateMetrics: jest.fn(),
        get stream() {
          return { stream: 'myStream' };
        },
        resetMetrics,
        metrics: {
          numberOfValuesSent: 1,
          numberOfFilesSent: 1
        }
      };
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

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();

const nowDateString = '2020-02-02T02:02:02.222Z';
let north: NorthOIAnalytics;

describe('NorthOIAnalytics without proxy', () => {
  const configuration: NorthConnectorDTO<NorthOIAnalyticsSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
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
    },
    caching: {
      scanModeId: 'id1',
      retryInterval: 5000,
      groupCount: 10000,
      maxSendCount: 10000,
      retryCount: 2,
      sendFileImmediately: true,
      maxSize: 30000
    },
    archive: {
      enabled: true,
      retentionDuration: 720
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.northConnectorRepository.getNorthConnector = jest.fn().mockReturnValue(configuration);

    (filesExists as jest.Mock).mockReturnValue(true);
    north = new NorthOIAnalytics(configuration, encryptionService, repositoryService, logger, 'baseFolder');
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
        timestamp: nowDateString,
        data: { value: '666', quality: 'good' }
      },
      {
        pointId: 'pointId2',
        timestamp: nowDateString,
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
          timestamp: nowDateString,
          data: { value: '666', quality: 'good' }
        },
        {
          pointId: 'pointId2',
          timestamp: nowDateString,
          data: { value: '777', quality: 'good' }
        }
      ]),
      agent: undefined
    };

    await north.handleValues(values);

    expect(fetch).toHaveBeenCalledWith(
      `${configuration.settings.specificSettings!.host}/api/oianalytics/oibus/time-values?dataSourceId=${configuration.name}`,
      expectedFetchOptions
    );
  });

  it('should properly throw fetch error with values', async () => {
    await north.start();
    const values: Array<OIBusTimeValue> = [
      {
        pointId: 'pointId1',
        timestamp: nowDateString,
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
      }/api/oianalytics/oibus/time-values?dataSourceId=${configuration.name}. ${new Error('error')}`,
      retry: true
    });
  });

  it('should properly throw error on values bad response', async () => {
    await north.start();
    const values: Array<OIBusTimeValue> = [
      {
        pointId: 'pointId1',
        timestamp: nowDateString,
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
      `${configuration.settings.specificSettings!.host}/api/oianalytics/oibus/time-values?dataSourceId=${configuration.name}`,
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

    await north.handleFile(filePath);

    expect(fetch).toHaveBeenCalledWith(
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${configuration.name}`,
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
      message: `Fail to reach file endpoint ${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${
        configuration.name
      }. ${new Error('error')}`,
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

    let err;
    try {
      await north.handleFile(filePath);
    } catch (error) {
      err = error;
    }

    expect(err).toEqual({
      message: `Error 501: statusText`,
      retry: false
    });

    expect(fetch).toHaveBeenCalledWith(
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${configuration.name}`,
      expectedFetchOptions
    );
  });
});

describe('NorthOIAnalytics without proxy but with acceptUnauthorized', () => {
  const configuration: NorthConnectorDTO<NorthOIAnalyticsSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
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
    },
    caching: {
      scanModeId: 'id1',
      retryInterval: 5000,
      groupCount: 10000,
      maxSendCount: 10000,
      retryCount: 2,
      sendFileImmediately: true,
      maxSize: 30000
    },
    archive: {
      enabled: true,
      retentionDuration: 720
    }
  };
  const fakeAgent = { rejectUnauthorized: false };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.northConnectorRepository.getNorthConnector = jest.fn().mockReturnValue(configuration);

    (filesExists as jest.Mock).mockReturnValue(true);
    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);
    north = new NorthOIAnalytics(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    await north.start();
  });

  it('should properly handle values', async () => {
    await north.start();
    const values: Array<OIBusTimeValue> = [
      {
        pointId: 'pointId1',
        timestamp: nowDateString,
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
      `${configuration.settings.specificSettings!.host}/api/oianalytics/oibus/time-values?dataSourceId=${configuration.name}`,
      expectedFetchOptions
    );
    expect(createProxyAgent).toHaveBeenCalledWith(
      false,
      `${configuration.settings.specificSettings!.host}/api/oianalytics/oibus/time-values?dataSourceId=${configuration.name}`,
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
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${configuration.name}`,
      expectedFetchOptions
    );
    expect(createProxyAgent).toHaveBeenCalledWith(
      false,
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${configuration.name}`,
      null,
      true
    );
  });
});

describe('NorthOIAnalytics with proxy', () => {
  const configuration: NorthConnectorDTO<NorthOIAnalyticsSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
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
    },
    caching: {
      scanModeId: 'id1',
      retryInterval: 5000,
      groupCount: 10000,
      maxSendCount: 10000,
      retryCount: 2,
      sendFileImmediately: true,
      maxSize: 30000
    },
    archive: {
      enabled: true,
      retentionDuration: 720
    }
  };
  const fakeAgent = { rejectUnauthorized: false };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (filesExists as jest.Mock).mockReturnValue(true);
    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);
    repositoryService.northConnectorRepository.getNorthConnector = jest.fn().mockReturnValue(configuration);

    north = new NorthOIAnalytics(configuration, encryptionService, repositoryService, logger, 'baseFolder');
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
      `${configuration.settings.specificSettings!.host}/api/oianalytics/oibus/time-values?dataSourceId=${configuration.name}`,
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
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${configuration.name}`,
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
  const configuration: NorthConnectorDTO<NorthOIAnalyticsSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
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
    },
    caching: {
      scanModeId: 'id1',
      retryInterval: 5000,
      groupCount: 10000,
      maxSendCount: 10000,
      retryCount: 2,
      sendFileImmediately: true,
      maxSize: 30000
    },
    archive: {
      enabled: true,
      retentionDuration: 720
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (filesExists as jest.Mock).mockReturnValue(true);
    (createProxyAgent as jest.Mock).mockReturnValue({});
    repositoryService.northConnectorRepository.getNorthConnector = jest.fn().mockReturnValue(configuration);

    north = new NorthOIAnalytics(configuration, encryptionService, repositoryService, logger, 'baseFolder');
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
      `${configuration.settings.specificSettings!.host}/api/oianalytics/oibus/time-values/compressed?dataSourceId=${configuration.name}`,
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
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${configuration.name}`,
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
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${configuration.name}`,
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
      `${configuration.settings.specificSettings!.host}/api/oianalytics/file-uploads?dataSourceId=${configuration.name}`,
      expectedFetchOptions
    );
  });
});

describe('NorthOIAnalytics with aad-certificate', () => {
  const configuration: NorthConnectorDTO<NorthOIAnalyticsSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
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
    },
    caching: {
      scanModeId: 'id1',
      retryInterval: 5000,
      groupCount: 10000,
      maxSendCount: 10000,
      retryCount: 2,
      sendFileImmediately: true,
      maxSize: 30000
    },
    archive: {
      enabled: true,
      retentionDuration: 720
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.northConnectorRepository.getNorthConnector = jest.fn().mockReturnValue(configuration);

    (filesExists as jest.Mock).mockReturnValue(true);
    north = new NorthOIAnalytics(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    await north.start();
  });

  it('should add header with aad-certificate', async () => {
    (repositoryService.certificateRepository.findById as jest.Mock).mockReturnValueOnce({
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
    expect(result.agent).toEqual({});
  });

  it('should not add header with aad-certificate when cert not found', async () => {
    (repositoryService.certificateRepository.findById as jest.Mock).mockReturnValueOnce(null);
    const result = await north.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({});
  });
});

describe('NorthOIAnalytics with OIA module', () => {
  const configuration: NorthConnectorDTO<NorthOIAnalyticsSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      useOiaModule: true,
      timeout: 30,
      compress: false
    },
    caching: {
      scanModeId: 'id1',
      retryInterval: 5000,
      groupCount: 10000,
      maxSendCount: 10000,
      retryCount: 2,
      sendFileImmediately: true,
      maxSize: 30000
    },
    archive: {
      enabled: true,
      retentionDuration: 720
    }
  };

  let registrationSettings: RegistrationSettingsDTO;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repositoryService.northConnectorRepository.getNorthConnector = jest.fn().mockReturnValue(configuration);

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
    north = new NorthOIAnalytics(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    await north.start();
  });

  it('should use oia module', async () => {
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValueOnce(registrationSettings);
    const result = await north.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({ authorization: 'Bearer my oia token' });
    expect(result.host).toEqual(registrationSettings.host);
    expect(createProxyAgent).toHaveBeenCalledWith(
      registrationSettings.useProxy,
      `${registrationSettings.host}/endpoint`,
      null,
      registrationSettings.acceptUnauthorized
    );
    expect(result.agent).toEqual({});
  });

  it('should use oia module with proxy', async () => {
    registrationSettings.host = 'http://localhost:4200/';
    registrationSettings.useProxy = true;
    registrationSettings.proxyUrl = 'http://localhost:8080';
    registrationSettings.proxyUsername = 'user';
    registrationSettings.proxyPassword = 'pass';
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValueOnce(registrationSettings);
    const result = await north.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({ authorization: 'Bearer my oia token' });
    expect(result.host).toEqual('http://localhost:4200');
    expect(createProxyAgent).toHaveBeenCalledWith(
      registrationSettings.useProxy,
      `${registrationSettings.host}/endpoint`,
      { url: registrationSettings.proxyUrl, username: registrationSettings.proxyUsername, password: registrationSettings.proxyPassword },
      registrationSettings.acceptUnauthorized
    );
    expect(result.agent).toEqual({});
  });

  it('should use oia module with proxy without user', async () => {
    registrationSettings.host = 'http://localhost:4200/';
    registrationSettings.useProxy = true;
    registrationSettings.proxyUrl = 'http://localhost:8080';
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValueOnce(registrationSettings);
    const result = await north.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({ authorization: 'Bearer my oia token' });
    expect(result.host).toEqual('http://localhost:4200');
    expect(createProxyAgent).toHaveBeenCalledWith(
      registrationSettings.useProxy,
      `${registrationSettings.host}/endpoint`,
      { url: registrationSettings.proxyUrl, username: undefined, password: null },
      registrationSettings.acceptUnauthorized
    );
    expect(result.agent).toEqual({});
  });

  it('should not use oia module if not registered', async () => {
    registrationSettings.status = 'PENDING';
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValueOnce(registrationSettings);

    await expect(north.getNetworkSettings('/endpoint')).rejects.toThrow(new Error('OIBus not registered in OIAnalytics'));

    expect(createProxyAgent).not.toHaveBeenCalled();
  });
});
