import fetch from 'node-fetch';
import SouthSlims, { SlimsResults } from './south-slims';
import * as utils from '../../service/utils';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';

import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import path from 'node:path';
import { SouthSlimsItemSettings, SouthSlimsSettings } from '../../../shared/model/south-settings.model';
import { DateTime } from 'luxon';
import { createProxyAgent } from '../../service/proxy-agent';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import testData from '../../tests/utils/test-data';

jest.mock('../../service/proxy-agent');
// Mock node-fetch
jest.mock('node-fetch');
jest.mock('https', () => ({ Agent: jest.fn() }));
jest.mock('node:fs/promises');
jest.mock('../../service/utils');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

describe('SouthSlims with body', () => {
  let south: SouthSlims;
  const configuration: SouthConnectorEntity<SouthSlimsSettings, SouthSlimsItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      url: 'http://localhost',
      port: 4200,
      timeout: 30,
      username: 'username',
      password: 'password',
      useProxy: false,
      acceptUnauthorized: false
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: 'my body',
          queryParams: [],
          dateTimeFields: null,
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: '',
          queryParams: [{ key: 'my key', value: 'my value' }],
          dateTimeFields: [{ useAsReference: false, type: 'iso-string', fieldName: 'rslt_cf_samplingDateAndTime' }],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: null,
          queryParams: null,
          dateTimeFields: [
            { useAsReference: true, type: 'unix-epoch-ms', fieldName: 'rslt_modifiedOn' },
            {
              useAsReference: false,
              type: 'string',
              fieldName: 'rslt_cf_samplingDateAndTime',
              format: 'yyyy-MM-dd HH:mm:ss.S',
              locale: 'en/US',
              timezone: 'Europe/Paris'
            }
          ],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId2'
      },
      {
        id: 'id4',
        name: 'item4',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: 'my body',
          queryParams: [],
          dateTimeFields: [{ useAsReference: true, type: 'iso-string', fieldName: 'timestamp' }],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthSlims(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder'
    );
  });

  it('should get throttling settings', () => {
    expect(south.getThrottlingSettings(configuration.settings)).toEqual({
      maxReadInterval: configuration.settings.throttling.maxReadInterval,
      readDelay: configuration.settings.throttling.readDelay
    });
    expect(south.getMaxInstantPerItem(configuration.settings)).toEqual(false);
    expect(south.getOverlap(configuration.settings)).toEqual(configuration.settings.throttling.overlap);
  });

  it('should test connection', async () => {
    (fetch as unknown as jest.Mock)
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          status: 404
        })
      )
      .mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          status: 401,
          statusText: 'Unauthorized'
        })
      );

    await expect(south.testConnection()).resolves.not.toThrow();
    await expect(south.testConnection()).rejects.toThrow(`HTTP request failed with status code 401 and message: Unauthorized`);
  });

  it('should log error if temp folder creation fails', async () => {
    await south.start();
    expect(utils.createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', 'tmp'));
  });

  it('should properly run historyQuery', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    south.queryData = jest
      .fn()
      .mockReturnValueOnce([
        { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
        { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
      ])
      .mockReturnValue([]);
    south.parseData = jest
      .fn()
      .mockImplementationOnce((_item: SouthConnectorItemEntity<SouthSlimsItemSettings>, httpResults: Array<unknown>) => ({
        formattedResult: httpResults,
        maxInstant: '2020-03-01T00:00:00.000Z'
      }))
      .mockImplementation(() => ({
        formattedResult: [],
        maxInstant: '2020-03-01T00:00:00.000Z'
      }));

    await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
    expect(utils.persistResults).toHaveBeenCalledTimes(1);
    expect(south.queryData).toHaveBeenCalledTimes(4);
    expect(south.parseData).toHaveBeenCalledTimes(4);
    expect(south.queryData).toHaveBeenCalledWith(configuration.items[0], startTime, testData.constants.dates.FAKE_NOW);
    expect(south.queryData).toHaveBeenCalledWith(configuration.items[1], '2020-03-01T00:00:00.000Z', testData.constants.dates.FAKE_NOW);
    expect(south.queryData).toHaveBeenCalledWith(configuration.items[2], '2020-03-01T00:00:00.000Z', testData.constants.dates.FAKE_NOW);
    expect(south.queryData).toHaveBeenCalledWith(configuration.items[3], '2020-03-01T00:00:00.000Z', testData.constants.dates.FAKE_NOW);
    expect(logger.info).toHaveBeenCalledWith(`Found 2 results for item ${configuration.items[0].name} in 0 ms`);
    expect(logger.info).toHaveBeenCalledWith(`No result found for item ${configuration.items[1].name}. Request done in 0 ms`);
    expect(logger.info).toHaveBeenCalledWith(`No result found for item ${configuration.items[2].name}. Request done in 0 ms`);
  });

  it('should properly fetch with Body', async () => {
    (utils.httpGetWithBody as jest.Mock).mockReturnValue(Promise.resolve({ result: [] }));

    const result = await south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
    expect(result).toEqual({ result: [] });
    const expectedOptions = {
      method: 'GET',
      host: 'localhost',
      protocol: 'http:',
      timeout: 30000,
      port: configuration.settings.port,
      path: configuration.items[0].settings.endpoint,
      headers: {
        authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
        'content-length': '7',
        'content-type': 'application/json'
      }
    };
    expect(utils.httpGetWithBody).toHaveBeenCalledWith('my body', expectedOptions);
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data with GET method and body "my body" on: "${expectedOptions.host}:${expectedOptions.port}${expectedOptions.path}"`
    );
  });

  it('should properly fetch', async () => {
    (fetch as unknown as jest.Mock).mockReturnValue(
      Promise.resolve({
        json: () => ({ result: [] }),
        ok: true
      })
    );
    await south.start();
    const result = await south.queryData(configuration.items[1], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
    expect(result).toEqual({ result: [] });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        headers: { authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' },
        method: 'GET',
        timeout: 30000
      }
    );
    expect(createProxyAgent).toHaveBeenCalledWith(false, configuration.settings.url, null, configuration.settings.acceptUnauthorized);
    expect(logger.info).toHaveBeenCalledWith(
      'Requesting data from URL "http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X"'
    );
  });
});

describe('SouthSlims with body and accept self signed', () => {
  let south: SouthSlims;
  const configuration: SouthConnectorEntity<SouthSlimsSettings, SouthSlimsItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      url: 'https://localhost/',
      port: 4200,
      timeout: 30,
      username: 'username',
      password: 'password',
      useProxy: false,
      acceptUnauthorized: true
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: 'my body',
          queryParams: [],
          dateTimeFields: null,
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: '',
          queryParams: [{ key: 'my key', value: 'my value' }],
          dateTimeFields: [{ useAsReference: false, type: 'iso-string', fieldName: 'rslt_cf_samplingDateAndTime' }],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: null,
          queryParams: null,
          dateTimeFields: [
            { useAsReference: true, type: 'unix-epoch-ms', fieldName: 'rslt_modifiedOn' },
            {
              useAsReference: false,
              type: 'string',
              fieldName: 'rslt_cf_samplingDateAndTime',
              format: 'yyyy-MM-dd HH:mm:ss.S',
              locale: 'en/US',
              timezone: 'Europe/Paris'
            }
          ],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId2'
      },
      {
        id: 'id4',
        name: 'item4',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: 'my body',
          queryParams: [],
          dateTimeFields: [{ useAsReference: true, type: 'iso-string', fieldName: 'timestamp' }],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthSlims(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder'
    );
  });

  it('should test connection', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Timeout error');
    });
    await south.start();
    await expect(south.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(fetch).toHaveBeenCalledWith('https://localhost:4200/slimsrest/rest', {
      headers: { authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' },
      method: 'GET',
      timeout: 30000
    });
  });

  it('should properly fetch with Body', async () => {
    (utils.httpGetWithBody as jest.Mock).mockReturnValue(Promise.resolve({ result: [] }));

    await south.start();
    const result = await south.queryData(configuration.items[3], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
    expect(result).toEqual({ result: [] });
    const expectedOptions = {
      method: 'GET',
      host: 'localhost',
      protocol: 'https:',
      timeout: 30000,
      port: configuration.settings.port,
      path: configuration.items[3].settings.endpoint,
      headers: {
        authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
        'content-length': '7',
        'content-type': 'application/json'
      }
    };
    expect(utils.httpGetWithBody).toHaveBeenCalledWith('my body', expectedOptions);
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data with GET method and body "my body" on: "${expectedOptions.host}:${expectedOptions.port}${expectedOptions.path}"`
    );
  });
});

describe('SouthSlims with query params', () => {
  let south: SouthSlims;
  const configuration: SouthConnectorEntity<SouthSlimsSettings, SouthSlimsItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      url: 'http://localhost',
      port: 4200,
      timeout: 30,
      username: 'username',
      password: 'password',
      useProxy: true,
      proxyUsername: 'proxy username',
      proxyPassword: null,
      acceptUnauthorized: false
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: 'my body',
          queryParams: [],
          dateTimeFields: null,
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: '',
          queryParams: [{ key: 'my key', value: 'my value' }],
          dateTimeFields: [{ useAsReference: false, type: 'iso-string', fieldName: 'rslt_cf_samplingDateAndTime' }],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: null,
          queryParams: null,
          dateTimeFields: [
            { useAsReference: true, type: 'unix-epoch-ms', fieldName: 'rslt_modifiedOn' },
            {
              useAsReference: false,
              type: 'string',
              fieldName: 'rslt_cf_samplingDateAndTime',
              format: 'yyyy-MM-dd HH:mm:ss.S',
              locale: 'en/US',
              timezone: 'Europe/Paris'
            }
          ],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId2'
      },
      {
        id: 'id4',
        name: 'item4',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: 'my body',
          queryParams: [],
          dateTimeFields: [{ useAsReference: true, type: 'iso-string', fieldName: 'timestamp' }],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };
  const fakeAgent = { rejectUnauthorized: false };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (utils.formatInstant as jest.Mock).mockImplementation((instant: string) => instant);
    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthSlims(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder'
    );
  });

  it('should properly fetch with Body', async () => {
    (utils.httpGetWithBody as jest.Mock).mockReturnValue(Promise.resolve({ result: [] }));

    const result = await south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
    expect(result).toEqual({ result: [] });
    const expectedOptions = {
      method: 'GET',
      host: 'localhost',
      protocol: 'http:',
      agent: fakeAgent,
      timeout: 30000,
      port: configuration.settings.port,
      path: configuration.items[0].settings.endpoint,
      headers: {
        authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
        'content-length': '7',
        'content-type': 'application/json'
      }
    };
    expect(utils.httpGetWithBody).toHaveBeenCalledWith('my body', expectedOptions);
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      configuration.settings.url,
      {
        url: configuration.settings.proxyUrl!,
        username: configuration.settings.proxyUsername!,
        password: null
      },
      configuration.settings.acceptUnauthorized
    );
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data with GET method and body "my body" on: "${expectedOptions.host}:${expectedOptions.port}${expectedOptions.path}"`
    );
  });

  it('should properly fetch', async () => {
    (fetch as unknown as jest.Mock).mockReturnValue(
      Promise.resolve({
        json: () => ({ result: [] }),
        ok: true
      })
    );
    await south.start();
    const result = await south.queryData(configuration.items[1], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
    expect(result).toEqual({ result: [] });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        agent: fakeAgent,
        headers: { authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' },
        method: 'GET',
        timeout: 30000
      }
    );
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      configuration.settings.url,
      {
        url: configuration.settings.proxyUrl!,
        username: configuration.settings.proxyUsername!,
        password: null
      },
      configuration.settings.acceptUnauthorized
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Requesting data from URL "http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X"'
    );
  });

  it('should fail to fetch', async () => {
    (fetch as unknown as jest.Mock).mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'statusText'
      })
    );

    await south.start();
    await expect(south.queryData(configuration.items[1], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z')).rejects.toThrow(
      'HTTP request failed with status code 400 and message: statusText'
    );

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        agent: fakeAgent,
        headers: { authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' },
        method: 'GET',
        timeout: 30000
      }
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Requesting data from URL "http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X"'
    );
  });

  it('should test connection', async () => {
    (fetch as unknown as jest.Mock).mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        status: 404
      })
    );

    await south.testConnection();
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      `${configuration.settings.url}:${configuration.settings.port}/slimsrest/rest`,
      {
        url: configuration.settings.proxyUrl!,
        username: configuration.settings.proxyUsername!,
        password: null
      },
      configuration.settings.acceptUnauthorized
    );
  });

  it('should reject if no entries', () => {
    try {
      south.parseData(configuration.items[0], null as unknown as SlimsResults);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect SLIMS values to be an array.'));
    }
    try {
      south.parseData(configuration.items[0], {} as unknown as SlimsResults);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect SLIMS values to be an array.'));
    }
    try {
      south.parseData(configuration.items[0], { entities: 1 } as unknown as SlimsResults);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect SLIMS values to be an array.'));
    }
  });

  it('should format SLIMS results', () => {
    (utils.convertDateTimeToInstant as jest.Mock)
      .mockReturnValueOnce('2020-01-01T00:00:00.000Z')
      .mockReturnValueOnce('2023-01-02T00:00:00.000Z')
      .mockReturnValueOnce('2021-01-01T00:00:00.000Z')
      .mockReturnValueOnce('2023-01-02T00:00:00.000Z')
      .mockReturnValueOnce('2020-06-01T00:00:00.000Z')
      .mockReturnValueOnce('2023-01-02T00:00:00.000Z');
    const slimsResults = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            },
            {
              name: 'rslt_value',
              value: 123,
              unit: 'g/L'
            },
            {
              name: 'rslt_modifiedOn',
              value: DateTime.fromISO('2023-01-02T00:00:00.000Z').toMillis()
            },
            {
              name: 'rslt_cf_samplingDateAndTime',
              value: '2020-01-01 00:00:00.0'
            }
          ]
        },
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myOtherPid'
            },
            {
              name: 'test_name',
              value: 'myOtherName'
            },
            {
              name: 'rslt_value',
              value: 0
            },
            {
              name: 'rslt_modifiedOn',
              value: DateTime.fromISO('2023-01-02T00:00:00.000Z').toMillis()
            },
            {
              name: 'rslt_cf_samplingDateAndTime',
              value: '2021-01-01 00:00:00.0'
            }
          ]
        },
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'anotherPid'
            },
            {
              name: 'test_name',
              value: 'anotherName'
            },
            {
              name: 'rslt_value',
              value: 0
            },
            {
              name: 'rslt_modifiedOn',
              value: DateTime.fromISO('2023-01-02T00:00:00.000Z').toMillis()
            },
            {
              name: 'rslt_cf_samplingDateAndTime',
              value: '2020-06-01 00:00:00.0'
            }
          ]
        }
      ]
    };

    const expectedResult = [
      {
        pointId: 'myPid-myName',
        timestamp: '2020-01-01T00:00:00.000Z',
        unit: 'g/L',
        value: 123
      },
      {
        pointId: 'myOtherPid-myOtherName',
        timestamp: '2021-01-01T00:00:00.000Z',
        unit: 'Ø',
        value: 0
      },
      {
        pointId: 'anotherPid-anotherName',
        timestamp: '2020-06-01T00:00:00.000Z',
        unit: 'Ø',
        value: 0
      }
    ];

    const result = south.parseData(configuration.items[2], slimsResults);
    expect(result).toEqual({ formattedResult: expectedResult, maxInstant: '2023-01-02T00:00:00.000Z' });
  });

  it('should throw error if dateTimeFields not found', () => {
    (utils.convertDateTimeToInstant as jest.Mock)
      .mockReturnValueOnce('2020-01-01T00:00:00.000Z')
      .mockReturnValueOnce('2023-01-02T00:00:00.000Z')
      .mockReturnValueOnce('2021-01-01T00:00:00.000Z')
      .mockReturnValueOnce('2023-01-02T00:00:00.000Z')
      .mockReturnValueOnce('2020-06-01T00:00:00.000Z')
      .mockReturnValueOnce('2023-01-02T00:00:00.000Z');
    const slimsResults = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            },
            {
              name: 'rslt_value',
              value: 123,
              unit: 'g/L'
            },
            {
              name: 'rslt_modifiedOn',
              value: DateTime.fromISO('2023-01-02T00:00:00.000Z').toMillis()
            },
            {
              name: 'rslt_cf_samplingDateAndTime',
              value: '2020-01-01 00:00:00.0'
            }
          ]
        }
      ]
    };

    let error;
    try {
      south.parseData(configuration.items[0], slimsResults);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('Bad config: expect rslt_cf_samplingDateAndTime to have an associated date time fields (see item)'));
  });

  it('should throw error if dateTimeFields not found for reference time', () => {
    (utils.convertDateTimeToInstant as jest.Mock)
      .mockReturnValueOnce('2020-01-01T00:00:00.000Z')
      .mockReturnValueOnce('2023-01-02T00:00:00.000Z')
      .mockReturnValueOnce('2021-01-01T00:00:00.000Z')
      .mockReturnValueOnce('2023-01-02T00:00:00.000Z')
      .mockReturnValueOnce('2020-06-01T00:00:00.000Z')
      .mockReturnValueOnce('2023-01-02T00:00:00.000Z');
    const slimsResults = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            },
            {
              name: 'rslt_value',
              value: 123,
              unit: 'g/L'
            },
            {
              name: 'rslt_modifiedOn',
              value: DateTime.fromISO('2023-01-02T00:00:00.000Z').toMillis()
            },
            {
              name: 'rslt_cf_samplingDateAndTime',
              value: '2020-01-01 00:00:00.0'
            }
          ]
        }
      ]
    };

    let error;
    try {
      south.parseData(configuration.items[1], slimsResults);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('Bad config: expect to have a reference field (rslt_modifiedOn) in date time fields (see item)'));
  });

  it('should throw error on parsing', () => {
    const slimsResultsWithoutPid = {
      entities: [{ columns: [] }]
    };
    try {
      south.parseData(configuration.items[0], slimsResultsWithoutPid);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_cf_pid to have a value'));
    }

    const slimsResultsWithoutPidValue = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: null
            }
          ]
        }
      ]
    };
    try {
      south.parseData(configuration.items[0], slimsResultsWithoutPidValue);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_cf_pid to have a value'));
    }

    const slimsResultsWithoutTestName = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            }
          ]
        }
      ]
    };
    try {
      south.parseData(configuration.items[0], slimsResultsWithoutTestName);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect test_name to have a value'));
    }

    const slimsResultsWithoutTestNameValue = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: null
            }
          ]
        }
      ]
    };
    try {
      south.parseData(configuration.items[0], slimsResultsWithoutTestNameValue);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect test_name to have a value'));
    }

    const slimsResultsWithoutTestValue = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            }
          ]
        }
      ]
    };
    try {
      south.parseData(configuration.items[0], slimsResultsWithoutTestValue);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_value to have a unit and a value'));
    }

    const slimsResultsWithEmptyTestValue = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            },
            {
              name: 'rslt_value',
              value: null,
              unit: 'g/L'
            }
          ]
        }
      ]
    };
    try {
      south.parseData(configuration.items[0], slimsResultsWithEmptyTestValue);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_value to have a unit and a value'));
    }

    const slimsResultsWithoutModifiedOn = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            },
            {
              name: 'rslt_value',
              value: 123,
              unit: 'g/L'
            }
          ]
        }
      ]
    };
    try {
      south.parseData(configuration.items[0], slimsResultsWithoutModifiedOn);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_modifiedOn to have a value'));
    }

    const slimsResultsWithoutModifiedOnValue = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            },
            {
              name: 'rslt_value',
              value: 123,
              unit: 'g/L'
            },
            {
              name: 'rslt_modifiedOn',
              value: null
            }
          ]
        }
      ]
    };
    try {
      south.parseData(configuration.items[0], slimsResultsWithoutModifiedOnValue);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_modifiedOn to have a value'));
    }

    const slimsResultsWithoutSamplingDateAndTime = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            },
            {
              name: 'rslt_value',
              value: 123,
              unit: 'g/L'
            },
            {
              name: 'rslt_modifiedOn',
              value: DateTime.fromISO('2023-01-02T00:00:00.000Z').toMillis()
            }
          ]
        }
      ]
    };
    try {
      south.parseData(configuration.items[0], slimsResultsWithoutSamplingDateAndTime);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_cf_samplingDateAndTime to have a value'));
    }

    const slimsResultsWithoutSamplingDateAndTimeValue = {
      entities: [
        {
          columns: [
            {
              name: 'rslt_cf_pid',
              value: 'myPid'
            },
            {
              name: 'test_name',
              value: 'myName'
            },
            {
              name: 'rslt_value',
              value: 123,
              unit: 'g/L'
            },
            {
              name: 'rslt_modifiedOn',
              value: DateTime.fromISO('2023-01-02T00:00:00.000Z').toMillis()
            },
            {
              name: 'rslt_cf_samplingDateAndTime',
              value: null
            }
          ]
        }
      ]
    };
    try {
      south.parseData(configuration.items[0], slimsResultsWithoutSamplingDateAndTimeValue);
    } catch (error) {
      expect(error).toEqual(new Error('Bad data: expect rslt_cf_samplingDateAndTime to have a value'));
    }
  });
});

describe('SouthSlims with query params and accept self signed', () => {
  let south: SouthSlims;
  const configuration: SouthConnectorEntity<SouthSlimsSettings, SouthSlimsItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      throttling: {
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
      url: 'http://localhost',
      port: 4200,
      timeout: 30,
      username: 'username',
      password: 'password',
      useProxy: true,
      proxyPassword: 'proxy password',
      proxyUsername: 'proxy username',
      acceptUnauthorized: false
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: 'my body',
          queryParams: [],
          dateTimeFields: null,
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: '',
          queryParams: [{ key: 'my key', value: 'my value' }],
          dateTimeFields: [{ useAsReference: false, type: 'iso-string', fieldName: 'rslt_cf_samplingDateAndTime' }],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id3',
        name: 'item3',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: null,
          queryParams: null,
          dateTimeFields: [
            { useAsReference: true, type: 'unix-epoch-ms', fieldName: 'rslt_modifiedOn' },
            {
              useAsReference: false,
              type: 'string',
              fieldName: 'rslt_cf_samplingDateAndTime',
              format: 'yyyy-MM-dd HH:mm:ss.S',
              locale: 'en/US',
              timezone: 'Europe/Paris'
            }
          ],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId2'
      },
      {
        id: 'id4',
        name: 'item4',
        enabled: true,
        settings: {
          endpoint: '/api/my/endpoint',
          body: 'my body',
          queryParams: [],
          dateTimeFields: [{ useAsReference: true, type: 'iso-string', fieldName: 'timestamp' }],
          serialization: {
            type: 'csv',
            filename: 'sql-@CurrentDate.csv',
            delimiter: 'COMMA',
            compression: true,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'Europe/Paris'
          }
        },
        scanModeId: 'scanModeId2'
      }
    ]
  };
  const fakeAgent = { rejectUnauthorized: false };

  beforeEach(() => {
    jest.clearAllMocks();
    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);
    (utils.formatInstant as jest.Mock).mockImplementation((instant: string) => instant);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthSlims(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder'
    );
  });

  it('should properly fetch with Body', async () => {
    (utils.httpGetWithBody as jest.Mock).mockReturnValue(Promise.resolve({ result: [] }));

    const result = await south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
    expect(result).toEqual({ result: [] });
    const expectedOptions = {
      method: 'GET',
      host: 'localhost',
      protocol: 'http:',
      agent: fakeAgent,
      timeout: 30000,
      port: configuration.settings.port,
      path: configuration.items[0].settings.endpoint,
      headers: {
        authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
        'content-length': '7',
        'content-type': 'application/json'
      }
    };
    expect(utils.httpGetWithBody).toHaveBeenCalledWith('my body', expectedOptions);
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      configuration.settings.url,
      {
        url: configuration.settings.proxyUrl!,
        username: configuration.settings.proxyUsername!,
        password: configuration.settings.proxyPassword!
      },
      configuration.settings.acceptUnauthorized
    );
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data with GET method and body "my body" on: "${expectedOptions.host}:${expectedOptions.port}${expectedOptions.path}"`
    );
  });

  it('should properly fetch', async () => {
    (fetch as unknown as jest.Mock).mockReturnValue(
      Promise.resolve({
        json: () => ({ result: [] }),
        ok: true
      })
    );

    await south.start();
    const result = await south.queryData(configuration.items[2], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
    expect(result).toEqual({ result: [] });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        agent: fakeAgent,
        headers: { authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' },
        method: 'GET',
        timeout: 30000
      }
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Requesting data from URL "http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X"'
    );
  });

  it('should test connection', async () => {
    (fetch as unknown as jest.Mock).mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        status: 404
      })
    );

    await south.testConnection();
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      `${configuration.settings.url}:${configuration.settings.port}/slimsrest/rest`,
      {
        url: configuration.settings.proxyUrl!,
        username: configuration.settings.proxyUsername!,
        password: configuration.settings.proxyPassword!
      },
      configuration.settings.acceptUnauthorized
    );
  });

  it('should test item', async () => {
    const callback = jest.fn();
    south.queryData = jest.fn().mockReturnValueOnce([]);
    south.parseData = jest.fn().mockImplementationOnce(results => ({ formattedResult: results }));
    await south.testItem(configuration.items[0], callback);
    expect(south.queryData).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
