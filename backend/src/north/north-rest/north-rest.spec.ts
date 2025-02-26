import path from 'node:path';
import fsSync from 'node:fs';

import NorthREST from './north-rest';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';

import { Dispatcher, request, ProxyAgent } from 'undici';
import { filesExists } from '../../service/utils';
import FormData from 'form-data';

import { NorthRESTSettings } from '../../../shared/model/north-settings.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import testData from '../../tests/utils/test-data';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import { mockBaseFolders } from '../../tests/utils/test-utils';
import { OIBusError } from '../../model/engine.model';
import CacheService from '../../service/cache/cache.service';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';

function mockResponseData(data: string, statusCode: number) {
  return {
    body: {
      text: () => Promise.resolve(data)
    },
    statusCode
  } as Dispatcher.ResponseData;
}

jest.mock('node:fs');
jest.mock('../../service/utils');
jest.mock('undici');

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const cacheService: CacheService = new CacheServiceMock();

jest.mock(
  '../../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
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

let north: NorthREST;
let configuration: NorthConnectorEntity<NorthRESTSettings>;

describe('NorthREST', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = {
      ...testData.north.list[0],
      settings: {
        endpoint: 'http://test.ing/file-upload',
        testPath: '/test-auth',
        timeout: 30,
        authType: 'basic',
        basicAuthUsername: 'user',
        basicAuthPassword: 'pass',
        useProxy: false,
        queryParams: [{ key: 'entityId', value: 'test' }]
      }
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    (filesExists as jest.Mock).mockReturnValue(true);
    north = new NorthREST(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
    await north.start();
  });

  it('should not handle values', async () => {
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
    ).rejects.toThrow('Can not manage time values');

    expect(request).not.toHaveBeenCalled();
  });

  it('should properly throw error when file does not exist', async () => {
    (filesExists as jest.Mock).mockReturnValueOnce(false);

    await expect(
      north.handleContent({
        contentFile: 'example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(`File ${path.resolve('example.file')} does not exist`);

    expect(request).not.toHaveBeenCalled();
  });

  it('should properly get message from generic Error', async () => {
    (request as unknown as jest.Mock).mockRejectedValue(new Error('generic error object'));

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(
      new OIBusError(`Failed to reach file endpoint ${new URL(configuration.settings.endpoint)}; message: generic error object`, true)
    );

    expect(request).toHaveBeenCalled();
  });

  it('should properly get message from non Errors', async () => {
    (request as unknown as jest.Mock).mockRejectedValue({ some: 'data' });

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError(`Failed to reach file endpoint ${new URL(configuration.settings.endpoint)}; {"some":"data"}`, true));

    expect(request).toHaveBeenCalled();
  });

  it('should properly get message from generic AggregateError', async () => {
    (request as unknown as jest.Mock).mockRejectedValue(new AggregateError([new Error('error 1'), new Error('error 2')]));

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(
      new OIBusError(`Failed to reach file endpoint ${new URL(configuration.settings.endpoint)}; message: error 1; message: error 2`, true)
    );

    expect(request).toHaveBeenCalled();
  });

  it('should properly get message from Error with code', async () => {
    const error = new Error('error with code');
    // @ts-expect-error Error does not have 'code' by default, adding it dynamically
    error['code'] = 1;
    (request as unknown as jest.Mock).mockRejectedValue(error);

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(
      new OIBusError(`Failed to reach file endpoint ${new URL(configuration.settings.endpoint)}; message: error with code, code: 1`, true)
    );

    expect(request).toHaveBeenCalled();
  });

  it('should properly get message from AggregateError with codes', async () => {
    const error1 = new Error('error with code 1');
    // @ts-expect-error Error does not have 'code' by default, adding it dynamically
    error1['code'] = 1;
    const error2 = new Error('error with code 2');
    // @ts-expect-error Error does not have 'code' by default, adding it dynamically
    error2['code'] = 2;
    (request as unknown as jest.Mock).mockRejectedValue(new AggregateError([error1, error2]));

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(
      new OIBusError(
        `Failed to reach file endpoint ${new URL(configuration.settings.endpoint)}; message: error with code 1, code: 1; message: error with code 2, code: 2`,
        true
      )
    );

    expect(request).toHaveBeenCalled();
  });
});

describe('NorthREST without proxy', () => {
  let expectedAuthHeader: string;

  async function changeNorthConfig(config: NorthConnectorEntity<NorthRESTSettings>) {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(config);
    await north.start(); // needed to reload the north's config
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = {
      ...testData.north.list[0],
      settings: {
        endpoint: 'http://test.ing/file-upload',
        testPath: '/test-auth',
        timeout: 30,
        authType: 'basic',
        basicAuthUsername: 'user',
        basicAuthPassword: 'pass',
        useProxy: false,
        queryParams: [{ key: 'entityId', value: 'test' }]
      }
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    (filesExists as jest.Mock).mockReturnValue(true);
    north = new NorthREST(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
    await north.start();

    expectedAuthHeader = `Basic ${Buffer.from(
      `${configuration.settings.basicAuthUsername}:${configuration.settings.basicAuthPassword}`
    ).toString('base64')}`;
  });

  it('should be able to test the connection', async () => {
    const expectedOptions = {
      method: 'GET',
      headers: {
        Authorization: expectedAuthHeader
      },
      dispatcher: undefined,
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.testConnection();

    expect(request).toHaveBeenCalledWith(new URL('http://test.ing/test-auth'), expectedOptions);
  });

  it('should be able to test the connection with different slashes', async () => {
    const expectedOptions = {
      method: 'GET',
      headers: {
        Authorization: expectedAuthHeader
      },
      dispatcher: undefined,
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValue(Promise.resolve(mockResponseData('Ok', 200)));

    for (const endpoint of ['http://test.ing/file-upload', 'http://test.ing/file-upload/']) {
      for (const testPath of ['test-auth', '/test-auth', 'test-auth/', '/test-auth/']) {
        await changeNorthConfig({
          ...configuration,
          settings: {
            ...configuration.settings,
            endpoint,
            testPath
          }
        });

        await north.testConnection();

        expect(request).toHaveBeenCalledWith(new URL('http://test.ing/test-auth'), expectedOptions);
      }
    }
  });

  it('should manage timeout error on test connection', async () => {
    const expectedOptions = {
      method: 'GET',
      headers: { Authorization: expectedAuthHeader },
      dispatcher: undefined,
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockRejectedValueOnce(new Error('Timeout error'));

    await expect(north.testConnection()).rejects.toThrow('Failed to reach file endpoint http://test.ing/test-auth; message: Timeout error');

    expect(request).toHaveBeenCalledWith(new URL('http://test.ing/test-auth'), expectedOptions);
  });

  it('should manage bad response on test connection', async () => {
    const expectedOptions = {
      method: 'GET',
      headers: { Authorization: expectedAuthHeader },
      dispatcher: undefined,
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Internal Server Error', 500)));

    await expect(north.testConnection()).rejects.toThrow(
      new OIBusError('HTTP request failed with status code 500 and message: Internal Server Error', false)
    );

    expect(request).toHaveBeenCalledWith(new URL('http://test.ing/test-auth'), expectedOptions);
  });

  it('should not handle values', async () => {
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
    ).rejects.toThrow('Can not manage time values');

    expect(request).not.toHaveBeenCalled();
  });

  it('should properly handle files', async () => {
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: expectedAuthHeader,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: undefined,
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
  });

  it('should properly handle files without query params', async () => {
    await changeNorthConfig({
      ...configuration,
      settings: {
        ...configuration.settings,
        queryParams: null
      }
    });
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: expectedAuthHeader,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: {},
      body: expect.any(FormData),
      dispatcher: undefined,
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
  });

  it('should properly handle files withoutout basic auth password', async () => {
    await changeNorthConfig({
      ...configuration,
      settings: {
        ...configuration.settings,
        basicAuthPassword: null
      }
    });
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${configuration.settings.basicAuthUsername}:`).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: undefined,
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
  });

  it('should properly handle files with bearer token', async () => {
    await changeNorthConfig({
      ...configuration,
      settings: {
        ...configuration.settings,
        authType: 'bearer',
        bearerAuthToken: 'token',
        basicAuthUsername: undefined,
        basicAuthPassword: null
      }
    });
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: undefined,
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
  });

  it('should properly handle files with missing bearer token', async () => {
    await changeNorthConfig({
      ...configuration,
      settings: {
        ...configuration.settings,
        authType: 'bearer',
        bearerAuthToken: undefined,
        basicAuthUsername: undefined,
        basicAuthPassword: null
      }
    });
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: undefined,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: undefined,
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
  });

  it('should properly throw error when file does not exist', async () => {
    (filesExists as jest.Mock).mockReturnValueOnce(false);

    await expect(
      north.handleContent({
        contentFile: 'example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(`File ${path.resolve('example.file')} does not exist`);

    expect(request).not.toHaveBeenCalled();
  });

  it('should properly throw fetch error with files', async () => {
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: expectedAuthHeader,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: undefined,
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockRejectedValueOnce(new Error('error'));

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError(`Failed to reach file endpoint ${new URL(configuration.settings.endpoint)}; message: error`, true));

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
  });

  it('should properly throw error on file bad response without retrying', async () => {
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: expectedAuthHeader,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: undefined,
      signal: AbortSignal.timeout(30_000)
    };

    // 500 error should not be retried
    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Internal Server Error', 500)));

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError('HTTP request failed with status code 500 and message: Internal Server Error', false));

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
  });

  it('should properly throw error on file bad response with retrying', async () => {
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: expectedAuthHeader,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: undefined,
      signal: AbortSignal.timeout(30_000)
    };

    // 401 error should be retried
    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Internal Server Error', 401)));

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError('HTTP request failed with status code 401 and message: Internal Server Error', true));

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
  });

  it('should properly get message from generic Error', async () => {
    (request as unknown as jest.Mock).mockRejectedValue(new Error('generic error object'));

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(
      new OIBusError(`Failed to reach file endpoint ${new URL(configuration.settings.endpoint)}; message: generic error object`, true)
    );

    expect(request).toHaveBeenCalled();
  });

  it('should properly get message from non Errors', async () => {
    (request as unknown as jest.Mock).mockRejectedValue({ some: 'data' });

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError(`Failed to reach file endpoint ${new URL(configuration.settings.endpoint)}; {"some":"data"}`, true));

    expect(request).toHaveBeenCalled();
  });

  it('should properly get message from generic AggregateError', async () => {
    (request as unknown as jest.Mock).mockRejectedValue(new AggregateError([new Error('error 1'), new Error('error 2')]));

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(
      new OIBusError(`Failed to reach file endpoint ${new URL(configuration.settings.endpoint)}; message: error 1; message: error 2`, true)
    );

    expect(request).toHaveBeenCalled();
  });

  it('should properly get message from Error with code', async () => {
    const error = new Error('error with code');
    // @ts-expect-error Error does not have 'code' by default, adding it dynamically
    error['code'] = 1;
    (request as unknown as jest.Mock).mockRejectedValue(error);

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(
      new OIBusError(`Failed to reach file endpoint ${new URL(configuration.settings.endpoint)}; message: error with code, code: 1`, true)
    );

    expect(request).toHaveBeenCalled();
  });

  it('should properly get message from AggregateError with codes', async () => {
    const error1 = new Error('error with code 1');
    // @ts-expect-error Error does not have 'code' by default, adding it dynamically
    error1['code'] = 1;
    const error2 = new Error('error with code 2');
    // @ts-expect-error Error does not have 'code' by default, adding it dynamically
    error2['code'] = 2;
    (request as unknown as jest.Mock).mockRejectedValue(new AggregateError([error1, error2]));

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(
      new OIBusError(
        `Failed to reach file endpoint ${new URL(configuration.settings.endpoint)}; message: error with code 1, code: 1; message: error with code 2, code: 2`,
        true
      )
    );

    expect(request).toHaveBeenCalled();
  });
});

describe('NorthREST with proxy', () => {
  let expectedAuthHeader: string;
  let expectedProxyToken: string;

  async function changeNorthConfig(config: NorthConnectorEntity<NorthRESTSettings>) {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(config);
    await north.start(); // needed to reload the north's config
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = {
      ...testData.north.list[0],
      settings: {
        endpoint: 'http://test.ing/file-upload',
        testPath: '/test-auth',
        timeout: 30,
        authType: 'basic',
        basicAuthUsername: 'user',
        basicAuthPassword: 'pass',
        useProxy: true,
        proxyUrl: 'http://proxy.url',
        proxyUsername: 'user',
        proxyPassword: 'pass',
        queryParams: [{ key: 'entityId', value: 'test' }]
      }
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    (filesExists as jest.Mock).mockReturnValue(true);
    north = new NorthREST(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
    await north.start();

    expectedAuthHeader = `Basic ${Buffer.from(
      `${configuration.settings.basicAuthUsername}:${configuration.settings.basicAuthPassword}`
    ).toString('base64')}`;

    expectedProxyToken = `Basic ${Buffer.from(`${configuration.settings.proxyUsername}:${configuration.settings.proxyPassword}`).toString(
      'base64'
    )}`;
  });

  it('should be able to test the connection', async () => {
    const expectedOptions = {
      method: 'GET',
      headers: {
        Authorization: expectedAuthHeader
      },
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.testConnection();

    expect(request).toHaveBeenCalledWith(new URL('http://test.ing/test-auth'), expectedOptions);
    expect(ProxyAgent).toHaveBeenCalledWith({
      uri: configuration.settings.proxyUrl,
      token: expectedProxyToken
    });
  });

  it('should be able to test the connection with different slashes', async () => {
    const expectedOptions = {
      method: 'GET',
      headers: {
        Authorization: expectedAuthHeader
      },
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValue(Promise.resolve(mockResponseData('Ok', 200)));

    for (const endpoint of ['http://test.ing/file-upload', 'http://test.ing/file-upload/']) {
      for (const testPath of ['test-auth', '/test-auth', 'test-auth/', '/test-auth/']) {
        await changeNorthConfig({
          ...configuration,
          settings: {
            ...configuration.settings,
            endpoint,
            testPath
          }
        });

        await north.testConnection();

        expect(request).toHaveBeenCalledWith(new URL('http://test.ing/test-auth'), expectedOptions);
        expect(ProxyAgent).toHaveBeenCalledWith({
          uri: configuration.settings.proxyUrl,
          token: expectedProxyToken
        });
      }
    }
  });

  it('should manage timeout error on test connection', async () => {
    const expectedOptions = {
      method: 'GET',
      headers: { Authorization: expectedAuthHeader },
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockRejectedValueOnce(new Error('Timeout error'));

    await expect(north.testConnection()).rejects.toThrow('Failed to reach file endpoint http://test.ing/test-auth; message: Timeout error');

    expect(request).toHaveBeenCalledWith(new URL('http://test.ing/test-auth'), expectedOptions);
    expect(ProxyAgent).toHaveBeenCalledWith({
      uri: configuration.settings.proxyUrl,
      token: expectedProxyToken
    });
  });

  it('should manage bad response on test connection', async () => {
    const expectedOptions = {
      method: 'GET',
      headers: { Authorization: expectedAuthHeader },
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Internal Server Error', 500)));

    await expect(north.testConnection()).rejects.toThrow(
      new OIBusError('HTTP request failed with status code 500 and message: Internal Server Error', false)
    );

    expect(request).toHaveBeenCalledWith(new URL('http://test.ing/test-auth'), expectedOptions);
    expect(ProxyAgent).toHaveBeenCalledWith({
      uri: configuration.settings.proxyUrl,
      token: expectedProxyToken
    });
  });

  it('should properly handle files', async () => {
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: expectedAuthHeader,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
    expect(ProxyAgent).toHaveBeenCalledWith({
      uri: configuration.settings.proxyUrl,
      token: expectedProxyToken
    });
  });

  it('should properly handle files with proxy url error', async () => {
    await changeNorthConfig({
      ...configuration,
      settings: {
        ...configuration.settings,
        proxyUrl: undefined
      }
    });

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new Error('Proxy URL not specified'));

    expect(ProxyAgent).not.toHaveBeenCalled();
  });

  it('should properly handle files with proxy without password', async () => {
    await changeNorthConfig({
      ...configuration,
      settings: {
        ...configuration.settings,
        proxyPassword: undefined
      }
    });
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: expectedAuthHeader,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
    expect(ProxyAgent).toHaveBeenCalledWith({
      uri: configuration.settings.proxyUrl,
      token: `Basic ${Buffer.from(`${configuration.settings.proxyUsername}:`).toString('base64')}`
    });
  });

  it('should properly handle files without query params', async () => {
    await changeNorthConfig({
      ...configuration,
      settings: {
        ...configuration.settings,
        queryParams: null
      }
    });
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: expectedAuthHeader,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: {},
      body: expect.any(FormData),
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
    expect(ProxyAgent).toHaveBeenCalledWith({
      uri: configuration.settings.proxyUrl,
      token: expectedProxyToken
    });
  });

  it('should properly handle files withoutout basic auth password', async () => {
    await changeNorthConfig({
      ...configuration,
      settings: {
        ...configuration.settings,
        basicAuthPassword: null
      }
    });
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${configuration.settings.basicAuthUsername}:`).toString('base64')}`,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
    expect(ProxyAgent).toHaveBeenCalledWith({
      uri: configuration.settings.proxyUrl,
      token: expectedProxyToken
    });
  });

  it('should properly handle files with bearer token', async () => {
    await changeNorthConfig({
      ...configuration,
      settings: {
        ...configuration.settings,
        authType: 'bearer',
        bearerAuthToken: 'token',
        basicAuthUsername: undefined,
        basicAuthPassword: null
      }
    });
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
    expect(ProxyAgent).toHaveBeenCalledWith({
      uri: configuration.settings.proxyUrl,
      token: expectedProxyToken
    });
  });

  it('should properly handle files with missing bearer token', async () => {
    await changeNorthConfig({
      ...configuration,
      settings: {
        ...configuration.settings,
        authType: 'bearer',
        bearerAuthToken: undefined,
        basicAuthUsername: undefined,
        basicAuthPassword: null
      }
    });
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: undefined,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Ok', 200)));

    await north.handleContent({
      contentFile: 'path/to/file/example.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
    expect(ProxyAgent).toHaveBeenCalledWith({
      uri: configuration.settings.proxyUrl,
      token: expectedProxyToken
    });
  });

  it('should properly throw fetch error with files', async () => {
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: expectedAuthHeader,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    (request as unknown as jest.Mock).mockRejectedValueOnce(new Error('error'));

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError(`Failed to reach file endpoint ${new URL(configuration.settings.endpoint)}; message: error`, true));

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
    expect(ProxyAgent).toHaveBeenCalledWith({
      uri: configuration.settings.proxyUrl,
      token: expectedProxyToken
    });
  });

  it('should properly throw error on file bad response without retrying', async () => {
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: expectedAuthHeader,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    // 500 error should not be retried
    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Internal Server Error', 500)));

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError('HTTP request failed with status code 500 and message: Internal Server Error', false));

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
    expect(ProxyAgent).toHaveBeenCalledWith({
      uri: configuration.settings.proxyUrl,
      token: expectedProxyToken
    });
  });

  it('should properly throw error on file bad response with retrying', async () => {
    const expectedOptions = {
      method: 'POST',
      headers: {
        Authorization: expectedAuthHeader,
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      dispatcher: expect.any(ProxyAgent),
      signal: AbortSignal.timeout(30_000)
    };

    // 401 error should be retried
    (request as unknown as jest.Mock).mockReturnValueOnce(Promise.resolve(mockResponseData('Internal Server Error', 401)));

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'raw',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new OIBusError('HTTP request failed with status code 401 and message: Internal Server Error', true));

    expect(request).toHaveBeenCalledWith(new URL(configuration.settings.endpoint), expectedOptions);
    expect(ProxyAgent).toHaveBeenCalledWith({
      uri: configuration.settings.proxyUrl,
      token: expectedProxyToken
    });
  });
});
