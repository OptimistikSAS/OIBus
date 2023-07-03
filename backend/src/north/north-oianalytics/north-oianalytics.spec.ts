import fsSync from 'node:fs';

import NorthOIAnalytics from './north-oianalytics';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';

import fetch from 'node-fetch';
import * as utils from '../../service/utils';

import ValueCacheServiceMock from '../../tests/__mocks__/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/file-cache-service.mock';
import { NorthOIAnalyticsSettings } from '../../../../shared/model/north-settings.model';

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
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);

const nowDateString = '2020-02-02T02:02:02.222Z';
const configuration: NorthConnectorDTO<NorthOIAnalyticsSettings> = {
  id: 'id',
  name: 'north',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  settings: {
    host: 'https://hostname',
    timeout: 1000,
    acceptUnauthorized: false,
    accessKey: 'anyUser',
    secretKey: 'anypass',
    proxyId: 'proxyId'
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
let north: NorthOIAnalytics;

describe('NorthOIAnalytics', () => {
  const proxy = { aField: 'myProxy' };
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.filesExists as jest.Mock).mockReturnValue(true);
    proxyService.createProxyAgent = jest.fn().mockReturnValue(proxy);
    north = new NorthOIAnalytics(configuration, encryptionService, proxyService, repositoryService, logger, 'baseFolder');
    await north.start();
  });

  it('should be properly initialized with proxy', async () => {
    await north.start();
    expect(proxyService.createProxyAgent).toHaveBeenCalledWith('proxyId', configuration.settings.acceptUnauthorized);
  });

  it('should properly handle values', async () => {
    await north.start();
    const values = [
      {
        pointId: 'pointId1',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' }
      },
      undefined,
      {
        pointId: 'pointId2',
        timestamp: nowDateString,
        data: undefined
      },
      {
        pointId: 'pointId3',
        timestamp: nowDateString,
        data: { value: undefined, quality: 'good' }
      },
      {
        pointId: 'pointId4',
        timestamp: nowDateString,
        data: { value: null, quality: 'good' }
      },
      {
        pointId: 'pointId4',
        timestamp: undefined,
        data: { value: 666, quality: 'good' }
      },
      {
        pointId: undefined,
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' }
      }
    ];
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${configuration.settings.accessKey}:${configuration.settings.secretKey}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        {
          timestamp: values[0]!.timestamp,
          data: values[0]!.data,
          pointId: values[0]!.pointId
        }
      ]),
      timeout: configuration.settings.timeout * 1000,
      agent: proxy
    };

    await north.handleValues(values);

    expect(fetch).toHaveBeenCalledWith(
      `${configuration.settings.host}/api/oianalytics/oibus/time-values?dataSourceId=${configuration.name}`,
      expectedFetchOptions
    );
  });

  it('should properly throw fetch error with values', async () => {
    await north.start();
    const values = [
      {
        pointId: 'pointId1',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' }
      },
      undefined,
      {
        pointId: 'pointId2',
        timestamp: nowDateString,
        data: undefined
      },
      {
        pointId: 'pointId3',
        timestamp: nowDateString,
        data: { value: undefined, quality: 'good' }
      },
      {
        pointId: 'pointId4',
        timestamp: nowDateString,
        data: { value: null, quality: 'good' }
      },
      {
        pointId: 'pointId4',
        timestamp: undefined,
        data: { value: 666, quality: 'good' }
      },
      {
        pointId: undefined,
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
      message: `Fail to reach values endpoint ${configuration.settings.host}/api/oianalytics/oibus/time-values?dataSourceId=${
        configuration.name
      }. ${new Error('error')}`,
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
      },
      undefined,
      {
        pointId: 'pointId2',
        timestamp: nowDateString,
        data: undefined
      },
      {
        pointId: 'pointId3',
        timestamp: nowDateString,
        data: { value: undefined, quality: 'good' }
      },
      {
        pointId: 'pointId4',
        timestamp: nowDateString,
        data: { value: null, quality: 'good' }
      },
      {
        pointId: 'pointId4',
        timestamp: undefined,
        data: { value: 666, quality: 'good' }
      },
      {
        pointId: undefined,
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' }
      }
    ];
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve({ ok: false, status: 400, statusText: 'statusText' }));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${configuration.settings.accessKey}:${configuration.settings.secretKey}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        {
          timestamp: values[0]!.timestamp,
          data: values[0]!.data,
          pointId: values[0]!.pointId
        }
      ]),
      timeout: configuration.settings.timeout * 1000,
      agent: proxy
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
      `${configuration.settings.host}/api/oianalytics/oibus/time-values?dataSourceId=${configuration.name}`,
      expectedFetchOptions
    );
  });

  it('should properly handle files', async () => {
    const filePath = '/path/to/file/example.file';
    (fetch as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(new Response('Ok')));

    const expectedFetchOptions = {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${configuration.settings.accessKey}:${configuration.settings.secretKey}`).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      body: expect.anything(),
      timeout: configuration.settings.timeout * 1000,
      agent: proxy
    };

    await north.handleFile(filePath);

    expect(fetch).toHaveBeenCalledWith(
      `${configuration.settings.host}/api/oianalytics/file-uploads?dataSourceId=${configuration.name}`,
      expectedFetchOptions
    );
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
      message: `Fail to reach file endpoint ${configuration.settings.host}/api/oianalytics/file-uploads?dataSourceId=${
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
        authorization: `Basic ${Buffer.from(`${configuration.settings.accessKey}:${configuration.settings.secretKey}`).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      body: expect.anything(),
      timeout: configuration.settings.timeout * 1000,
      agent: proxy
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
      `${configuration.settings.host}/api/oianalytics/file-uploads?dataSourceId=${configuration.name}`,
      expectedFetchOptions
    );
  });
});
