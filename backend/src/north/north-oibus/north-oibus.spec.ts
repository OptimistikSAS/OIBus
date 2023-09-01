import fsSync from 'node:fs';

import NorthOibus from './north-oibus';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';

import fetch from 'node-fetch';
import * as utils from '../../service/utils';

import ValueCacheServiceMock from '../../tests/__mocks__/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/file-cache-service.mock';
import { NorthOIBusSettings } from '../../../../shared/model/north-settings.model';
import ArchiveServiceMock from '../../tests/__mocks__/archive-service.mock';
import { createProxyAgent } from '../../service/proxy.service';
import { OIBusDataValue } from '../../../../shared/model/engine.model';

jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('../../service/utils');
jest.mock('../../service/proxy.service');

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
let north: NorthOibus;

describe('NorthOIConnect with proxy', () => {
  const configuration: NorthConnectorDTO<NorthOIBusSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      host: 'https://hostname/',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost',
      proxyUsername: 'my username',
      proxyPassword: 'my password',
      username: 'user',
      password: 'pass'
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
    (utils.filesExists as jest.Mock).mockReturnValue(true);
    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);
    north = new NorthOibus(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    await north.start();
  });

  it('should properly handle values', async () => {
    await north.start();
    const values: Array<OIBusDataValue> = [
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
        authorization: `Basic ${Buffer.from(`${configuration.settings.username}:${configuration.settings.password}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(values),
      agent: fakeAgent
    };

    await north.handleValues(values);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/add-values?name=${configuration.name}`, expectedFetchOptions);
  });

  it('should properly throw fetch error with values', async () => {
    await north.start();
    const values: Array<OIBusDataValue> = [
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
      message: `Fail to reach values endpoint ${configuration.settings.host}/api/add-values?name=${configuration.name}. ${new Error(
        'error'
      )}`,
      retry: true
    });
  });

  it('should properly throw error on values bad response', async () => {
    await north.start();
    const values: Array<OIBusDataValue> = [
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
        authorization: `Basic ${Buffer.from(`${configuration.settings.username}:${configuration.settings.password}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(values),
      agent: fakeAgent
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

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/add-values?name=${configuration.name}`, expectedFetchOptions);
  });

  it('should properly handle files', async () => {
    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${configuration.settings.username}:${configuration.settings.password}`).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      body: expect.anything(),
      agent: fakeAgent
    };

    await north.handleFile(filePath);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/add-file?name=${configuration.name}`, expectedFetchOptions);
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
      message: `Fail to reach file endpoint ${configuration.settings.host}/api/add-file?name=${configuration.name}. ${new Error('error')}`,
      retry: true
    });
  });

  it('should properly throw error when file does not exist', async () => {
    const filePath = '/path/to/file/example.file';

    (utils.filesExists as jest.Mock).mockReturnValueOnce(false);
    let err;
    try {
      await north.handleFile(filePath);
    } catch (error) {
      err = error;
    }
    expect(err).toEqual(new Error(`File ${filePath} does not exist`));
  });

  it('should properly throw error on file bad response', async () => {
    await north.start();

    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve({ ok: false, status: 400, statusText: 'statusText' }));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${configuration.settings.username}:${configuration.settings.password}`).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      body: expect.anything(),
      agent: fakeAgent
    };

    let err;
    try {
      await north.handleFile(filePath);
    } catch (error) {
      err = error;
    }

    expect(err).toEqual({
      message: `Error 400: statusText`,
      retry: false
    });

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/add-file?name=${configuration.name}`, expectedFetchOptions);
  });

  it('should manage timeout error on test connection', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Timeout error');
    });

    await expect(north.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(fetch).toHaveBeenCalledWith('https://hostname/api/info', {
      agent: fakeAgent,
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
      method: 'GET'
    });
    expect(logger.error).toHaveBeenCalledWith(`Fetch error ${new Error('Timeout error')}`);
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

    await north.testConnection();
    expect(logger.info).toHaveBeenCalledWith(`Testing connection on "${configuration.settings.host}"`);
    expect(logger.info).toHaveBeenCalledWith('OIConnect request successful');
    await expect(north.testConnection()).rejects.toThrow(`HTTP request failed with status code 401 and message: Unauthorized`);
  });
});

describe('NorthOIConnect with proxy but without proxy password', () => {
  const configuration: NorthConnectorDTO<NorthOIBusSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      host: 'https://hostname',
      acceptUnauthorized: false,
      useProxy: true,
      proxyUrl: 'http://localhost',
      proxyUsername: 'my username',
      proxyPassword: null,
      username: 'user',
      password: 'pass'
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
    (utils.filesExists as jest.Mock).mockReturnValue(true);
    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);

    north = new NorthOibus(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    await north.start();
  });

  it('should test connection', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Timeout error');
    });

    await expect(north.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(fetch).toHaveBeenCalledWith('https://hostname/api/info', {
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
      method: 'GET',
      agent: fakeAgent
    });
    expect(logger.error).toHaveBeenCalledWith(`Fetch error ${new Error('Timeout error')}`);
  });

  it('should properly handle values without password', async () => {
    await north.start();
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${configuration.settings.username}:${configuration.settings.password}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([]),
      agent: fakeAgent
    };

    await north.handleValues([]);
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      `${configuration.settings.host}/api/add-values?name=${configuration.name}`,
      {
        url: configuration.settings.proxyUrl!,
        username: configuration.settings.proxyUsername!,
        password: null
      },
      false
    );
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/add-values?name=${configuration.name}`, expectedFetchOptions);
  });

  it('should properly handle files without password', async () => {
    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${configuration.settings.username}:${configuration.settings.password}`).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      body: expect.anything(),
      agent: fakeAgent
    };

    await north.handleFile(filePath);

    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      `${configuration.settings.host}/api/add-file?name=${configuration.name}`,
      {
        url: configuration.settings.proxyUrl!,
        username: configuration.settings.proxyUsername!,
        password: null
      },
      false
    );
    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/add-file?name=${configuration.name}`, expectedFetchOptions);
  });
});

describe('NorthOIConnect without proxy', () => {
  const configuration: NorthConnectorDTO<NorthOIBusSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      host: 'https://hostname',
      acceptUnauthorized: false,
      useProxy: false,
      username: 'user',
      password: 'pass'
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
    (createProxyAgent as jest.Mock).mockReturnValue(undefined);

    north = new NorthOibus(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    await north.start();
  });

  it('should manage timeout error on test connection', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Timeout error');
    });

    await expect(north.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(fetch).toHaveBeenCalledWith('https://hostname/api/info', {
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
      method: 'GET'
    });
    expect(logger.error).toHaveBeenCalledWith(`Fetch error ${new Error('Timeout error')}`);
  });

  it('should properly handle values without password', async () => {
    await north.start();
    const values: Array<OIBusDataValue> = [
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
        authorization: `Basic ${Buffer.from(`${configuration.settings.username}:${configuration.settings.password}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(values)
    };

    await north.handleValues(values);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/add-values?name=${configuration.name}`, expectedFetchOptions);
  });

  it('should properly handle files without password', async () => {
    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${configuration.settings.username}:${configuration.settings.password}`).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      body: expect.anything()
    };

    await north.handleFile(filePath);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/add-file?name=${configuration.name}`, expectedFetchOptions);
  });
});
