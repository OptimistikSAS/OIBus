import path from 'node:path';
import fsSync from 'node:fs';

import NorthREST from './north-rest';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';

import { HTTPRequest, ReqAuthOptions, ReqOptions, ReqProxyOptions } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';
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
import fs from 'node:fs/promises';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import csv from 'papaparse';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';

jest.mock('node:fs');
jest.mock('node:fs/promises');
jest.mock('papaparse');
jest.mock('../../service/utils');
jest.mock('../../service/transformer.service');
jest.mock('../../service/http-request.utils');

const logger: pino.Logger = new PinoLogger();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
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

let north: NorthREST;
let configuration: NorthConnectorEntity<NorthRESTSettings>;

const timeValues: Array<OIBusTimeValue> = [
  {
    pointId: 'pointId',
    timestamp: testData.constants.dates.FAKE_NOW,
    data: { value: '666', quality: 'good' }
  }
];

class ErrorWithCode extends Error {
  constructor(
    message: string,
    public readonly code: number
  ) {
    super(message);
  }
}

const sharedSettings = {
  host: 'http://test.ing/',
  endpoint: '/file-upload',
  testPath: '/test-auth',
  timeout: 30,
  queryParams: [{ key: 'entityId', value: 'test' }]
} as NorthRESTSettings;
const testCases: Array<[string, NorthRESTSettings]> = [
  [
    'without proxy using basic auth',
    {
      ...sharedSettings,
      authType: 'basic',
      basicAuthUsername: 'user',
      basicAuthPassword: 'pass',
      useProxy: false
    }
  ],
  [
    'without proxy using missing basic auth',
    {
      ...sharedSettings,
      authType: 'basic',
      useProxy: false
    }
  ],
  [
    'without proxy using bearer auth',
    {
      ...sharedSettings,
      authType: 'bearer',
      bearerAuthToken: 'auth-token',
      useProxy: false
    }
  ],
  [
    'without proxy using missing bearer auth',
    {
      ...sharedSettings,
      authType: 'bearer',
      useProxy: false
    }
  ],
  [
    'with proxy using basic auth',
    {
      ...sharedSettings,
      authType: 'basic',
      basicAuthUsername: 'user',
      basicAuthPassword: 'pass',
      useProxy: true,
      proxyUrl: 'http://localhost',
      proxyUsername: 'proxy-user',
      proxyPassword: 'proxy-password'
    }
  ],
  [
    'with proxy using bearer auth',
    {
      ...sharedSettings,
      authType: 'bearer',
      bearerAuthToken: 'auth-token',
      useProxy: true,
      proxyUrl: 'http://localhost',
      proxyUsername: 'proxy-user',
      proxyPassword: 'proxy-password'
    }
  ]
];
describe.each(testCases)('NorthREST %s', (_, settings) => {
  let authOptions: ReqAuthOptions | undefined;
  let proxyOptions: { proxy?: ReqProxyOptions };

  async function changeNorthConfig(config: NorthConnectorEntity<NorthRESTSettings>) {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(config);
    await north.start(); // needed to reload the north's config
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = {
      ...testData.north.list[0],
      settings
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (filesExists as jest.Mock).mockReturnValue(true);
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (HTTPRequest as jest.Mock).mockResolvedValue(createMockResponse(200));
    (fs.readFile as jest.Mock).mockReturnValue(JSON.stringify(timeValues));
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    // Expected auth options
    switch (settings.authType) {
      case 'basic':
        authOptions = settings.basicAuthUsername
          ? {
              type: 'basic',
              username: settings.basicAuthUsername,
              password: settings.basicAuthPassword
            }
          : undefined;
        break;
      case 'bearer':
        authOptions = settings.bearerAuthToken
          ? {
              type: 'bearer',
              token: settings.bearerAuthToken
            }
          : undefined;
        break;
    }

    proxyOptions = settings.useProxy
      ? {
          proxy: {
            url: settings.proxyUrl,
            auth: {
              type: 'basic',
              username: settings.proxyUsername,
              password: settings.proxyPassword
            }
          } as ReqProxyOptions
        }
      : {};

    north = new NorthREST(configuration, northConnectorRepository, scanModeRepository, logger, mockBaseFolders(testData.north.list[0].id));
    await north.start();
  });

  it('should be able to test the connection', async () => {
    const expectedReqOptions: ReqOptions = {
      method: 'GET',
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    await north.testConnection();

    expect(HTTPRequest).toHaveBeenCalledWith(new URL(settings.testPath, settings.host), expectedReqOptions);
  });

  it('should be able to test the connection with different slashes', async () => {
    const expectedReqOptions: ReqOptions = {
      method: 'GET',
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

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

        expect(HTTPRequest).toHaveBeenCalledWith(new URL(settings.testPath, settings.host), expectedReqOptions);
      }
    }
  });

  it('should manage timeout error on test connection', async () => {
    const expectedReqOptions: ReqOptions = {
      method: 'GET',
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    (HTTPRequest as jest.Mock).mockRejectedValueOnce(new Error('Timeout error'));

    await expect(north.testConnection()).rejects.toThrow(
      `Failed to reach file endpoint ${new URL(settings.testPath, settings.host)}; message: Timeout error`
    );

    expect(HTTPRequest).toHaveBeenCalledWith(new URL(settings.testPath, settings.host), expectedReqOptions);
  });

  it('should manage bad response on test connection', async () => {
    const expectedReqOptions: ReqOptions = {
      method: 'GET',
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(500, 'Internal Server Error'));

    await expect(north.testConnection()).rejects.toThrow(
      new OIBusError('HTTP request failed with status code 500 and message: "Internal Server Error"', false)
    );

    expect(HTTPRequest).toHaveBeenCalledWith(new URL(settings.testPath, settings.host), expectedReqOptions);
  });

  it('should properly handle files', async () => {
    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
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

    expect(HTTPRequest).toHaveBeenCalledWith(new URL(settings.endpoint, settings.host), expectedReqOptions);
  });

  it('should properly handle files without query params', async () => {
    await changeNorthConfig({
      ...configuration,
      settings: {
        ...configuration.settings,
        queryParams: null
      }
    });
    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: {},
      body: expect.any(FormData),
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

    expect(HTTPRequest).toHaveBeenCalledWith(new URL(settings.endpoint, settings.host), expectedReqOptions);
  });

  it('should properly throw error when file does not exist', async () => {
    (filesExists as jest.Mock).mockReturnValueOnce(false);

    await expect(
      north.handleContent({
        contentFile: 'example.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(`File ${path.resolve('example.file')} does not exist`);

    expect(HTTPRequest).not.toHaveBeenCalled();
  });

  it('should properly throw fetch error with files', async () => {
    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    (HTTPRequest as jest.Mock).mockRejectedValueOnce(new Error('error'));

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
    ).rejects.toThrow(new OIBusError(`Failed to reach file endpoint ${new URL(settings.endpoint, settings.host)}; message: error`, true));

    expect(HTTPRequest).toHaveBeenCalledWith(new URL(settings.endpoint, settings.host), expectedReqOptions);
  });

  it('should properly throw error on file bad response without retrying', async () => {
    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    // 500 error should not be retried
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(500, 'Internal Server Error'));

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
    ).rejects.toThrow(new OIBusError('HTTP request failed with status code 500 and message: "Internal Server Error"', false));

    expect(HTTPRequest).toHaveBeenCalledWith(new URL(settings.endpoint, settings.host), expectedReqOptions);
  });

  it('should properly throw error on file bad response with retrying', async () => {
    const expectedReqOptions = {
      method: 'POST',
      headers: {
        'content-type': expect.stringContaining('multipart/form-data; boundary=')
      },
      query: { entityId: 'test' },
      body: expect.any(FormData),
      auth: authOptions,
      timeout: 30000,
      ...proxyOptions
    };

    // 401 error should be retried
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(401, 'Internal Server Error'));

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
    ).rejects.toThrow(new OIBusError('HTTP request failed with status code 401 and message: "Internal Server Error"', true));

    expect(HTTPRequest).toHaveBeenCalledWith(new URL(settings.endpoint, settings.host), expectedReqOptions);
  });

  it('should properly get message from generic Error', async () => {
    (HTTPRequest as jest.Mock).mockRejectedValue(new Error('generic error object'));

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
      new OIBusError(`Failed to reach file endpoint ${new URL(settings.endpoint, settings.host)}; message: generic error object`, true)
    );

    expect(HTTPRequest).toHaveBeenCalled();
  });

  it('should properly get message from non Errors', async () => {
    (HTTPRequest as jest.Mock).mockRejectedValue({ some: 'data' });

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
    ).rejects.toThrow(new OIBusError(`Failed to reach file endpoint ${new URL(settings.endpoint, settings.host)}; {"some":"data"}`, true));

    expect(HTTPRequest).toHaveBeenCalled();
  });

  it('should properly get message from generic AggregateError', async () => {
    (HTTPRequest as jest.Mock).mockRejectedValue(new AggregateError([new Error('error 1'), new Error('error 2')]));

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
      new OIBusError(`Failed to reach file endpoint ${new URL(settings.endpoint, settings.host)}; message: error 1; message: error 2`, true)
    );

    expect(HTTPRequest).toHaveBeenCalled();
  });

  it('should properly get message from Error with code', async () => {
    const error = new ErrorWithCode('error with code', 1);
    (HTTPRequest as jest.Mock).mockRejectedValue(error);

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
      new OIBusError(`Failed to reach file endpoint ${new URL(settings.endpoint, settings.host)}; message: error with code, code: 1`, true)
    );

    expect(HTTPRequest).toHaveBeenCalled();
  });

  it('should properly get message from AggregateError with codes', async () => {
    const error1 = new ErrorWithCode('error with code 1', 1);
    const error2 = new ErrorWithCode('error with code 2', 2);
    (HTTPRequest as jest.Mock).mockRejectedValue(new AggregateError([error1, error2]));

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
      new OIBusError(
        `Failed to reach file endpoint ${new URL(settings.endpoint, settings.host)}; message: error with code 1, code: 1; message: error with code 2, code: 2`,
        true
      )
    );

    expect(HTTPRequest).toHaveBeenCalled();
  });

  it('should ignore data if bad content type', async () => {
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'time-values',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(`Unsupported data type: time-values (file path/to/file/example-123456789.file)`);
  });

  if (settings.useProxy) {
    it('should throw error when proxy url is not defined', async () => {
      await changeNorthConfig({
        ...configuration,
        settings: {
          ...configuration.settings,
          proxyUrl: undefined
        }
      });

      await expect(
        north.handleContent({
          contentFile: 'example.file',
          contentSize: 1234,
          numberOfElement: 1,
          createdAt: '2020-02-02T02:02:02.222Z',
          contentType: 'any',
          source: 'south',
          options: {}
        })
      ).rejects.toThrow(`Failed to reach file endpoint ${new URL(settings.endpoint, settings.host)}; message: Proxy URL not specified`);
    });
  }
});
