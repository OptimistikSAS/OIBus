import fetch from 'node-fetch';
import SouthOianalytics from './south-oianalytics';
import * as utils from '../../service/utils';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';

import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import path from 'node:path';
import { SouthOIAnalyticsItemSettings, SouthOIAnalyticsSettings } from '../../../../shared/model/south-settings.model';
import { createProxyAgent } from '../../service/proxy-agent';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthConnectorMetricsRepository from '../../repository/logs/south-connector-metrics.repository';
import NorthMetricsRepositoryMock from '../../tests/__mocks__/repository/log/north-metrics-repository.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import SouthConnectorMetricsServiceMock from '../../tests/__mocks__/service/south-connector-metrics-service.mock';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import testData from '../../tests/utils/test-data';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import OIAnalyticsRegistrationRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import CertificateRepository from '../../repository/config/certificate.repository';
import CertificateRepositoryMock from '../../tests/__mocks__/repository/config/certificate-repository.mock';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';

jest.mock('../../service/proxy-agent');
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

jest.mock('../../service/utils');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southMetricsRepository: SouthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const southCacheService = new SouthCacheServiceMock();
const southConnectorMetricsService = new SouthConnectorMetricsServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);

jest.mock(
  '../../service/south-connector-metrics.service',
  () =>
    function () {
      return southConnectorMetricsService;
    }
);

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

describe('SouthOIAnalytics with Basic auth', () => {
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = {
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
    sharedConnection: false,
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
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
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
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      'baseFolder'
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
      .mockImplementationOnce((httpResults: Array<OIBusTimeValue>) => ({
        formattedResult: httpResults,
        maxInstant: '2020-03-01T00:00:00.000Z'
      }))
      .mockImplementation(() => ({
        formattedResult: [],
        maxInstant: '2020-03-01T00:00:00.000Z'
      }));

    await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
    expect(utils.persistResults).toHaveBeenCalledTimes(1);
    expect(south.queryData).toHaveBeenCalledTimes(3);
    expect(south.parseData).toHaveBeenCalledTimes(3);
    expect(south.queryData).toHaveBeenCalledWith(configuration.items[0], startTime, testData.constants.dates.FAKE_NOW);
    expect(south.queryData).toHaveBeenCalledWith(configuration.items[1], '2020-03-01T00:00:00.000Z', testData.constants.dates.FAKE_NOW);
    expect(south.queryData).toHaveBeenCalledWith(configuration.items[2], '2020-03-01T00:00:00.000Z', testData.constants.dates.FAKE_NOW);
    expect(logger.info).toHaveBeenCalledWith(`Found 2 results for item ${configuration.items[0].name} in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${configuration.items[1].name}. Request done in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${configuration.items[2].name}. Request done in 0 ms`);
  });

  it('should fail to scan', async () => {
    (fetch as unknown as jest.Mock).mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'statusText'
      })
    );

    await expect(south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z')).rejects.toThrow(
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
    expect(logger.info).toHaveBeenCalledWith(
      'Requesting data from URL "http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X"'
    );
  });
});

describe('SouthOIAnalytics without proxy but with accept self signed', () => {
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = {
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
    sharedConnection: false,
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
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
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
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      'baseFolder'
    );
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

    const result = await south.queryData(configuration.items[2], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
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
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = {
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
    sharedConnection: false,
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
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
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
    ]
  };

  const fakeAgent = { rejectUnauthorized: false };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      'baseFolder'
    );
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

    const result = await south.queryData(configuration.items[2], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
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
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = {
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
    sharedConnection: false,
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
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
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
    ]
  };

  const fakeAgent = { rejectUnauthorized: false };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);
    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      'baseFolder'
    );
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

    const result = await south.queryData(configuration.items[2], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');
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
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = {
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
    sharedConnection: false,
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
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
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
    ]
  };

  const fakeAgent = { rejectUnauthorized: false };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    (createProxyAgent as jest.Mock).mockReturnValue(fakeAgent);
    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      'baseFolder'
    );
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
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = {
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
    sharedConnection: false,
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
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
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
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (createProxyAgent as jest.Mock).mockReturnValue({});
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      'baseFolder'
    );
    await south.start();
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
    const result = await south.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({ authorization: 'Bearer token' });
    expect(result.host).toEqual('https://hostname');
    expect(result.agent).toEqual({});
  });

  it('should not add header with aad-certificate when cert not found', async () => {
    (certificateRepository.findById as jest.Mock).mockReturnValueOnce(null);
    const result = await south.getNetworkSettings('/endpoint');
    expect(result.headers).toEqual({});
  });
});

describe('SouthOIAnalytics with OIA module', () => {
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = {
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
    sharedConnection: false,
    settings: {
      useOiaModule: true,
      timeout: 30
    },
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
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
    ]
  };

  let registrationSettings: OIAnalyticsRegistration;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

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
    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      'baseFolder'
    );
    await south.start();
  });

  it('should use oia module', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(registrationSettings);
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
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(registrationSettings);
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
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(registrationSettings);
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
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValueOnce(registrationSettings);

    await expect(south.getNetworkSettings('/endpoint')).rejects.toThrow(new Error('OIBus not registered in OIAnalytics'));

    expect(createProxyAgent).not.toHaveBeenCalled();
  });

  it('should test item', async () => {
    const callback = jest.fn();
    south.queryData = jest.fn().mockReturnValueOnce([]);
    await south.testItem(configuration.items[0], callback);
    expect(south.queryData).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
