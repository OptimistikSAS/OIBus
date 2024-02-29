import fetch from 'node-fetch';
import SouthOianalytics from './south-oianalytics';
import * as utils from '../../service/utils';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import PinoLogger from '../../tests/__mocks__/logger.mock';

import pino from 'pino';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import path from 'node:path';
import { SouthOIAnalyticsItemSettings, SouthOIAnalyticsSettings } from '../../../../shared/model/south-settings.model';
import { createProxyAgent } from '../../service/proxy.service';
import { RegistrationSettingsDTO } from '../../../../shared/model/engine.model';

jest.mock('../../service/proxy.service');
jest.mock('../../service/utils', () => ({
  formatInstant: jest.fn((instant: string) => instant),
  persistResults: jest.fn(),
  createFolder: jest.fn(),
  formatQueryParams: jest.fn(),
  getOIBusInfo: jest.fn()
}));
jest.mock('@azure/identity', () => ({
  ClientSecretCredential: jest.fn().mockImplementation(() => ({
    getToken: () => ({ token: 'token' })
  })),
  ClientCertificateCredential: jest.fn().mockImplementation(() => ({
    getToken: () => ({ token: 'token' })
  }))
}));

// Mock node-fetch
jest.mock('https', () => ({ Agent: jest.fn() }));
jest.mock('node-fetch');
jest.mock('node:fs/promises');
const database = new DatabaseMock();
jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return {
        createSouthCacheScanModeTable: jest.fn(),
        southCacheRepository: {
          database
        }
      };
    }
);
jest.mock(
  '../../service/south-connector-metrics.service',
  () =>
    function () {
      return {
        initMetrics: jest.fn(),
        updateMetrics: jest.fn(),
        get stream() {
          return { stream: 'myStream' };
        },
        metrics: {
          numberOfValuesRetrieved: 1,
          numberOfFilesRetrieved: 1
        }
      };
    }
);
const addValues = jest.fn();
const addFile = jest.fn();

const logger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const items: Array<SouthConnectorItemDTO<SouthOIAnalyticsItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    connectorId: 'southId',
    settings: {
      endpoint: '/api/my/endpoint',
      queryParams: [],
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
    connectorId: 'southId',
    settings: {
      endpoint: '/api/my/endpoint',
      queryParams: null,
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
    connectorId: 'southId',
    settings: {
      endpoint: '/api/my/endpoint',
      queryParams: [],
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
];

const nowDateString = '2020-02-02T02:02:02.222Z';
let south: SouthOianalytics;

describe('SouthOIAnalytics with Basic auth', () => {
  const connector: SouthConnectorDTO<SouthOIAnalyticsSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      useOiaModule: false,
      timeout: 30,
      specificSettings: {
        host: 'http://localhost:4200',
        authentication: 'basic',
        acceptUnauthorized: false,
        accessKey: 'username',
        secretKey: 'password',
        useProxy: false
      }
    }
  };
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthOianalytics(connector, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
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
      .mockImplementationOnce((httpResults: Array<any>) => ({
        formattedResult: httpResults,
        maxInstant: '2020-03-01T00:00:00.000Z'
      }))
      .mockImplementation(() => ({
        formattedResult: [],
        maxInstant: '2020-03-01T00:00:00.000Z'
      }));

    await south.historyQuery(items, startTime, nowDateString);
    expect(utils.persistResults).toHaveBeenCalledTimes(1);
    expect(south.queryData).toHaveBeenCalledTimes(3);
    expect(south.parseData).toHaveBeenCalledTimes(3);
    expect(south.queryData).toHaveBeenCalledWith(items[0], startTime, nowDateString);
    expect(south.queryData).toHaveBeenCalledWith(items[1], '2020-03-01T00:00:00.000Z', nowDateString);
    expect(south.queryData).toHaveBeenCalledWith(items[2], '2020-03-01T00:00:00.000Z', nowDateString);
    expect(logger.info).toHaveBeenCalledWith(`Found 2 results for item ${items[0].name} in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[1].name}. Request done in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[2].name}. Request done in 0 ms`);
  });

  it('should fail to scan', async () => {
    (fetch as unknown as jest.Mock).mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'statusText'
      })
    );

    await expect(south.queryData(items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z')).rejects.toThrow(
      'HTTP request failed with status code 400 and message: statusText'
    );

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
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

  it('should properly fetch', async () => {
    (fetch as unknown as jest.Mock).mockReturnValue(
      Promise.resolve({
        json: () => ({ result: [] }),
        ok: true
      })
    );

    const result = await south.queryData(items[1], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
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
    expect(logger.info).toHaveBeenCalledWith(
      'Requesting data from URL "http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X"'
    );
  });
});

describe('SouthOIAnalytics without proxy but with accept self signed', () => {
  const configuration: SouthConnectorDTO<SouthOIAnalyticsSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      useOiaModule: false,
      timeout: 30,
      specificSettings: {
        host: 'https://localhost:4200/',
        acceptUnauthorized: true,
        authentication: 'basic',
        accessKey: 'username',
        secretKey: '',
        useProxy: false
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthOianalytics(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should test connection', async () => {
    await south.start();
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Timeout error');
    });

    await expect(south.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(fetch).toHaveBeenCalledWith('https://localhost:4200/api/optimistik/oibus/status', {
      headers: { authorization: 'Basic dXNlcm5hbWU6' },
      method: 'GET',
      timeout: 30000
    });
  });

  it('should properly fetch', async () => {
    (fetch as unknown as jest.Mock).mockReturnValue(
      Promise.resolve({
        json: () => ({ result: [] }),
        ok: true
      })
    );

    const result = await south.queryData(items[2], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
    expect(result).toEqual({ result: [] });
    expect(fetch).toHaveBeenCalledWith(
      'https://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        headers: { authorization: 'Basic dXNlcm5hbWU6' },
        method: 'GET',
        timeout: 30000
      }
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Requesting data from URL "https://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X"'
    );
  });

  it('should reject bad data', () => {
    try {
      south.parseData({} as any);
    } catch (error) {
      expect(error).toEqual(Error('Bad data: expect OIAnalytics time values to be an array'));
    }

    try {
      south.parseData([{}] as any);
    } catch (error) {
      expect(error).toEqual(Error('Bad data: expect data.reference field'));
    }

    try {
      south.parseData([{ data: { reference: 'dataReference' } }] as any);
    } catch (error) {
      expect(error).toEqual(Error('Bad data: expect unit.label field'));
    }

    try {
      south.parseData([
        {
          data: { reference: 'dataReference' },
          unit: { label: 'g/L' }
        }
      ] as any);
    } catch (error) {
      expect(error).toEqual(Error('Bad data: expect values to be an array'));
    }

    try {
      south.parseData([
        {
          data: { reference: 'dataReference' },
          unit: { label: 'g/L' },
          values: []
        }
      ] as any);
    } catch (error) {
      expect(error).toEqual(Error('Bad data: expect timestamps to be an array'));
    }
  });

  it('should correctly parse accepted data', () => {
    const oiaData = [
      {
        type: 'time-values',
        unit: { id: '2', label: '%' },
        data: {
          dataType: 'RAW_TIME_DATA',
          id: 'D4',
          reference: 'ref1',
          description: 'Concentration O2 fermentation'
        },
        timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
        values: [63, 84]
      },
      {
        type: 'time-values',
        unit: { id: '180', label: 'pH' },
        data: {
          dataType: 'RAW_TIME_DATA',
          id: 'D5',
          reference: 'ref2',
          description: 'pH fermentation'
        },
        timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
        values: [7, 8]
      }
    ];

    expect(south.parseData(oiaData)).toEqual({
      formattedResult: [
        {
          pointId: 'ref1',
          timestamp: '2022-01-01T00:00:00.000Z',
          data: {
            unit: '%',
            value: 63
          }
        },
        {
          pointId: 'ref1',
          timestamp: '2022-01-01T00:10:00.000Z',
          data: {
            unit: '%',
            value: 84
          }
        },
        {
          pointId: 'ref2',
          timestamp: '2022-01-01T00:00:00.000Z',
          data: {
            unit: 'pH',
            value: 7
          }
        },
        {
          pointId: 'ref2',
          timestamp: '2022-01-01T00:10:00.000Z',
          data: {
            unit: 'pH',
            value: 8
          }
        }
      ],
      maxInstant: '2022-01-01T00:10:00.000Z'
    });

    expect(south.parseData([])).toEqual({ formattedResult: [], maxInstant: '1970-01-01T00:00:00.000Z' });
    expect(
      south.parseData([
        {
          type: 'time-values',
          unit: { id: '2', label: '%' },
          data: {
            dataType: 'RAW_TIME_DATA',
            id: 'D4',
            reference: 'ref1',
            description: 'Concentration O2 fermentation'
          },
          timestamps: [],
          values: []
        }
      ])
    ).toEqual({ formattedResult: [], maxInstant: '1970-01-01T00:00:00.000Z' });
  });
});

describe('SouthOIAnalytics with proxy', () => {
  const configuration: SouthConnectorDTO<SouthOIAnalyticsSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      useOiaModule: false,
      timeout: 30,
      specificSettings: {
        host: 'http://localhost:4200',
        acceptUnauthorized: false,
        authentication: 'basic',
        accessKey: 'username',
        secretKey: 'password',
        useProxy: true,
        proxyPassword: 'proxyPassword',
        proxyUrl: 'http://proxyurl',
        proxyUsername: 'proxyUsername'
      }
    }
  };
  const fakeAgent = { rejectUnauthorized: false };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthOianalytics(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should test connection', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Timeout error');
    });

    await expect(south.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/api/optimistik/oibus/status', {
      agent: fakeAgent,
      headers: { authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' },
      method: 'GET',
      timeout: 30000
    });
  });

  it('should properly fetch', async () => {
    (fetch as unknown as jest.Mock).mockReturnValue(
      Promise.resolve({
        json: () => ({ result: [] }),
        ok: true
      })
    );

    const result = await south.queryData(items[2], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
    expect(result).toEqual({ result: [] });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        headers: { authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' },
        method: 'GET',
        agent: fakeAgent,
        timeout: 30000
      }
    );
  });
});

describe('SouthOIAnalytics with proxy but without proxy password', () => {
  const configuration: SouthConnectorDTO<SouthOIAnalyticsSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      useOiaModule: false,
      timeout: 30,
      specificSettings: {
        host: 'http://localhost:4200',
        authentication: 'basic',
        acceptUnauthorized: false,
        accessKey: 'username',
        secretKey: 'password',
        useProxy: true,
        proxyPassword: '',
        proxyUrl: 'http://proxyurl',
        proxyUsername: 'proxyUsername'
      }
    }
  };
  const fakeAgent = { rejectUnauthorized: false };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);
    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthOianalytics(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should test connection', async () => {
    (fetch as unknown as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Timeout error');
    });

    await expect(south.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(fetch).toHaveBeenCalledWith('http://localhost:4200/api/optimistik/oibus/status', {
      agent: fakeAgent,
      headers: { authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' },
      method: 'GET',
      timeout: 30000
    });
  });

  it('should properly fetch', async () => {
    (fetch as unknown as jest.Mock).mockReturnValue(
      Promise.resolve({
        json: () => ({ result: [] }),
        ok: true
      })
    );

    const result = await south.queryData(items[2], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
    expect(result).toEqual({ result: [] });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        headers: { authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' },
        method: 'GET',
        timeout: 30000,
        agent: fakeAgent
      }
    );
    expect(createProxyAgent).toHaveBeenCalledWith(
      true,
      'http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        url: configuration.settings.specificSettings!.proxyUrl!,
        username: configuration.settings.specificSettings!.proxyUsername!,
        password: null
      },
      configuration.settings.specificSettings!.acceptUnauthorized
    );
  });
});

describe('SouthOIAnalytics without proxy but with acceptUnauthorized', () => {
  const configuration: SouthConnectorDTO<SouthOIAnalyticsSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      useOiaModule: false,
      timeout: 30,
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
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    }
  };
  const fakeAgent = { rejectUnauthorized: false };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);
    south = new SouthOianalytics(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
    await south.start();
  });

  it('should add header with aad-client-secret', async () => {
    const result = await south.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({ authorization: 'Bearer token' });
    expect(result.host).toEqual(configuration.settings.specificSettings!.host);
    expect(result.agent).toEqual(fakeAgent);
  });
});

describe('SouthOIAnalytics with aad-certificate', () => {
  const configuration: SouthConnectorDTO<SouthOIAnalyticsSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      useOiaModule: false,
      timeout: 30,
      specificSettings: {
        host: 'https://hostname/',
        acceptUnauthorized: false,
        authentication: 'aad-certificate',
        certificateId: 'certificateId',
        useProxy: false
      }
    },
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    (createProxyAgent as jest.Mock).mockReturnValue({});
    south = new SouthOianalytics(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
    await south.start();
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
    const result = await south.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({ authorization: 'Bearer token' });
    expect(result.host).toEqual(configuration.settings.specificSettings!.host);
    expect(result.agent).toEqual({});
  });

  it('should not add header with aad-certificate when cert not found', async () => {
    (repositoryService.certificateRepository.findById as jest.Mock).mockReturnValueOnce(null);
    const result = await south.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({});
  });
});

describe('SouthOIAnalytics with OIA module', () => {
  const configuration: SouthConnectorDTO<SouthOIAnalyticsSettings> = {
    id: 'id',
    name: 'north',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    settings: {
      useOiaModule: true,
      timeout: 30
    },
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    }
  };

  let registrationSettings: RegistrationSettingsDTO;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (createProxyAgent as jest.Mock).mockReturnValue({});
    registrationSettings = {
      id: 'id',
      host: 'http://localhost:4200',
      token: 'my oia token',
      status: 'REGISTERED',
      activationDate: '2020-01-01T00:00:00Z',
      useProxy: false,
      acceptUnauthorized: false
    };
    south = new SouthOianalytics(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
    await south.start();
  });

  it('should use oia module', async () => {
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValueOnce(registrationSettings);
    const result = await south.getNetworkSettings('/endpoint');
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
    const result = await south.getNetworkSettings('/endpoint');
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
    const result = await south.getNetworkSettings('/endpoint');
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

    await expect(south.getNetworkSettings('/endpoint')).rejects.toThrow(new Error('OIBus not registered in OIAnalytics'));

    expect(createProxyAgent).not.toHaveBeenCalled();
  });
});
