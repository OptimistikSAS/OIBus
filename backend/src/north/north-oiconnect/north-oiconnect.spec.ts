import fsSync from 'node:fs';

import NorthOIConnect from './north-oiconnect';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';

import fetch from 'node-fetch';
import https from 'node:https';
import * as utils from '../../service/utils';

import ValueCacheServiceMock from '../../tests/__mocks__/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/file-cache-service.mock';
import { NorthOIConnectSettings } from '../../../../shared/model/north-settings.model';

jest.mock('node:fs/promises');
jest.mock('node:fs');
jest.mock('../../service/utils');

jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

jest.mock('../../service/cache/archive.service');
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
const configuration: NorthConnectorDTO<NorthOIConnectSettings> = {
  id: 'id',
  name: 'north',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  settings: {
    host: 'https://hostname',
    acceptUnauthorized: false,
    valuesEndpoint: '/api/values',
    fileEndpoint: '/api/file',
    timeout: 10,
    useProxy: false,
    authentication: {
      type: 'basic',
      username: 'user',
      password: 'pass'
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
let north: NorthOIConnect;

describe('NorthOIConnect', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (utils.filesExists as jest.Mock).mockReturnValue(true);
    north = new NorthOIConnect(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    await north.start();
  });

  it('should properly handle values', async () => {
    await north.start();
    const values = [
      {
        pointId: 'pointId1',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' }
      }
    ];
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(
          `${configuration.settings.authentication.username}:${configuration.settings.authentication.password}`
        ).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(values),
      timeout: configuration.settings.timeout * 1000,
      agent: undefined
    };

    await north.handleValues(values);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/values?name=${configuration.name}`, expectedFetchOptions);
  });

  it('should properly throw fetch error with values', async () => {
    await north.start();
    const values = [
      {
        pointId: 'pointId1',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' }
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
      message: `Fail to reach values endpoint ${configuration.settings.host}/api/values?name=${configuration.name}. ${new Error('error')}`,
      retry: true
    });
  });

  it('should properly throw error on values bad response', async () => {
    await north.start();
    const values = [
      {
        pointId: 'pointId1',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' }
      }
    ];
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve({ ok: false, status: 400, statusText: 'statusText' }));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(
          `${configuration.settings.authentication.username}:${configuration.settings.authentication.password}`
        ).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(values),
      timeout: configuration.settings.timeout * 1000,
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

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/values?name=${configuration.name}`, expectedFetchOptions);
  });

  it('should properly handle files', async () => {
    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(
          `${configuration.settings.authentication.username}:${configuration.settings.authentication.password}`
        ).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      body: expect.anything(),
      timeout: configuration.settings.timeout * 1000,
      agent: undefined
    };

    await north.handleFile(filePath);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/file?name=${configuration.name}`, expectedFetchOptions);
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
      message: `Fail to reach file endpoint ${configuration.settings.host}/api/file?name=${configuration.name}. ${new Error('error')}`,
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
        authorization: `Basic ${Buffer.from(
          `${configuration.settings.authentication.username}:${configuration.settings.authentication.password}`
        ).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      body: expect.anything(),
      timeout: configuration.settings.timeout * 1000,
      agent: undefined
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

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/file?name=${configuration.name}`, expectedFetchOptions);
  });
});

describe('NorthOIConnect without proxy nor password and with acceptUnauthorized', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    configuration.settings.authentication.password = undefined;
    configuration.settings.acceptUnauthorized = true;
    north = new NorthOIConnect(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    await north.start();
  });

  it('should properly handle values without password', async () => {
    await north.start();
    const values = [
      {
        pointId: 'pointId1',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' }
      }
    ];
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${configuration.settings.authentication.username}:`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(values),
      timeout: configuration.settings.timeout * 1000,
      agent: expect.any(https.Agent)
    };

    await north.handleValues(values);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/values?name=${configuration.name}`, expectedFetchOptions);
  });

  it('should properly handle files without password', async () => {
    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${configuration.settings.authentication.username}:`).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      body: expect.anything(),
      timeout: configuration.settings.timeout * 1000,
      agent: expect.any(https.Agent)
    };

    await north.handleFile(filePath);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/file?name=${configuration.name}`, expectedFetchOptions);
  });
});

describe('NorthOIConnect without authentication', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    configuration.settings.authentication = { type: 'none' };
    configuration.settings.acceptUnauthorized = false;

    north = new NorthOIConnect(configuration, encryptionService, repositoryService, logger, 'baseFolder');
    await north.start();
  });

  it('should properly handle values without auth', async () => {
    await north.start();
    const values = [
      {
        pointId: 'pointId1',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' }
      }
    ];
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(values),
      timeout: configuration.settings.timeout * 1000,
      agent: undefined
    };

    await north.handleValues(values);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/values?name=${configuration.name}`, expectedFetchOptions);
  });

  it('should properly handle files without auth', async () => {
    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      body: expect.anything(),
      timeout: configuration.settings.timeout * 1000,
      agent: undefined
    };

    await north.handleFile(filePath);

    expect(fetch).toHaveBeenCalledWith(`${configuration.settings.host}/api/file?name=${configuration.name}`, expectedFetchOptions);
  });
});
