import SouthOianalytics from './south-oianalytics';
import * as utils from '../../service/utils';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';

import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import path from 'node:path';
import { SouthOIAnalyticsItemSettings, SouthOIAnalyticsSettings } from '../../../shared/model/south-settings.model';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import testData from '../../tests/utils/test-data';
import { mockBaseFolders } from '../../tests/utils/test-utils';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import OIAnalyticsRegistrationRepositoryMock from '../../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import CertificateRepository from '../../repository/config/certificate.repository';
import CertificateRepositoryMock from '../../tests/__mocks__/repository/config/certificate-repository.mock';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import { HTTPRequest } from '../../service/http-request.utils';
import { createMockResponse } from '../../tests/__mocks__/undici.mock';

jest.mock('../../service/utils', () => {
  const actualUtils = jest.requireActual('../../service/utils');
  return {
    formatInstant: jest.fn((instant: string) => instant),
    persistResults: jest.fn(),
    createFolder: jest.fn(),
    formatQueryParams: actualUtils.formatQueryParams,
    getOIBusInfo: jest.fn(),
    createBaseFolders: jest.fn()
  };
});
jest.mock('@azure/identity', () => ({
  ClientSecretCredential: jest.fn().mockImplementation(() => ({
    getToken: () => ({ token: 'ClientSecretCredentialToken' })
  })),
  ClientCertificateCredential: jest.fn().mockImplementation(() => ({
    getToken: () => ({ token: 'ClientCertificateCredentialToken' })
  }))
}));

jest.mock('../../service/http-request.utils');
jest.mock('node:fs/promises');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
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
const baseConfiguration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = {
  id: 'southId',
  name: 'south',
  type: 'oianalytics',
  description: 'my test connector',
  enabled: true,
  settings: {
    throttling: {
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    useOiaModule: false,
    timeout: 30,
    specificSettings: {
      host: 'http://localhost:4200/',
      acceptUnauthorized: true,
      authentication: 'basic',
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
        //from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X
        queryParams: [
          { key: 'from', value: '2019-10-03T13:36:38.590Z' },
          { key: 'to', value: '2019-10-03T15:36:38.590Z' },
          { key: 'aggregation', value: 'RAW_VALUES' },
          { key: 'data-reference', value: 'SP_003_X' }
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

describe('SouthOIAnalytics with Basic auth', () => {
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = structuredClone(baseConfiguration);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should get throttling settings', () => {
    expect(south.getThrottlingSettings(configuration.settings)).toEqual({
      maxReadInterval: configuration.settings.throttling.maxReadInterval,
      readDelay: configuration.settings.throttling.readDelay
    });
    expect(south.getMaxInstantPerItem(configuration.settings)).toEqual(true);
    expect(south.getOverlap(configuration.settings)).toEqual(configuration.settings.throttling.overlap);
  });

  it('should test connection', async () => {
    (HTTPRequest as jest.Mock)
      .mockResolvedValueOnce(createMockResponse(200))
      .mockResolvedValueOnce(createMockResponse(401, 'Unauthorized'));

    await expect(south.testConnection()).resolves.not.toThrow();
    await expect(south.testConnection()).rejects.toThrow(`HTTP request failed with status code 401 and message: "Unauthorized"`);
  });

  it('should log error if temp folder creation fails', async () => {
    await south.start();
    expect(utils.createFolder).toHaveBeenCalledWith(path.resolve(mockBaseFolders(configuration.id).cache, 'tmp'));
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
    expect(south.queryData).toHaveBeenCalledWith(configuration.items[1], startTime, testData.constants.dates.FAKE_NOW);
    expect(south.queryData).toHaveBeenCalledWith(configuration.items[2], startTime, testData.constants.dates.FAKE_NOW);
    expect(logger.info).toHaveBeenCalledWith(`Found 2 results for item ${configuration.items[0].name} in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${configuration.items[1].name}. Request done in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${configuration.items[2].name}. Request done in 0 ms`);
  });

  it('should fail to scan', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(400, 'statusText'));

    await expect(south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z')).rejects.toThrow(
      'HTTP request failed with status code 400 and message: "statusText"'
    );

    const query = {
      from: '2019-10-03T13:36:38.590Z',
      to: '2019-10-03T15:36:38.590Z',
      aggregation: 'RAW_VALUES',
      'data-reference': 'SP_003_X'
    };

    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/my/endpoint' }), {
      method: 'GET',
      query,
      auth: { type: 'basic', username: 'username', password: 'password' },
      proxy: undefined,
      timeout: 30000
    });
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data from URL "http://localhost:4200/api/my/endpoint" and query params "${JSON.stringify(query)}"`
    );
  });

  it('should properly fetch', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, { result: [] }));

    const query = {
      from: '2019-10-03T13:36:38.590Z',
      to: '2019-10-03T15:36:38.590Z',
      aggregation: 'RAW_VALUES',
      'data-reference': 'SP_003_X'
    };
    const result = await south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(result).toEqual({ result: [] });
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/my/endpoint' }), {
      method: 'GET',
      query,
      auth: { type: 'basic', username: 'username', password: 'password' },
      proxy: undefined,
      timeout: 30000
    });
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data from URL "http://localhost:4200/api/my/endpoint" and query params "${JSON.stringify(query)}"`
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
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = structuredClone(baseConfiguration);
  configuration.settings.specificSettings = {
    ...configuration.settings.specificSettings!,
    useProxy: true,
    proxyUrl: 'http://proxyurl',
    proxyPassword: 'proxyPassword',
    proxyUsername: 'proxyUsername'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should test connection', async () => {
    (HTTPRequest as unknown as jest.Mock).mockRejectedValueOnce(new Error('Timeout error'));

    await expect(south.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/optimistik/oibus/status' }), {
      method: 'GET',
      auth: { type: 'basic', username: 'username', password: 'password' },
      proxy: {
        url: 'http://proxyurl',
        auth: {
          type: 'url',
          username: 'proxyUsername',
          password: 'proxyPassword'
        }
      },
      timeout: 30000
    });
  });

  it('should properly fetch', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, { result: [] }));

    const query = {
      from: '2019-10-03T13:36:38.590Z',
      to: '2019-10-03T15:36:38.590Z',
      aggregation: 'RAW_VALUES',
      'data-reference': 'SP_003_X'
    };
    const result = await south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(result).toEqual({ result: [] });
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/my/endpoint' }), {
      method: 'GET',
      query,
      auth: { type: 'basic', username: 'username', password: 'password' },
      proxy: {
        url: 'http://proxyurl',
        auth: {
          type: 'url',
          username: 'proxyUsername',
          password: 'proxyPassword'
        }
      },
      timeout: 30000
    });
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data from URL "http://localhost:4200/api/my/endpoint" and query params "${JSON.stringify(query)}"`
    );
  });
});

describe('SouthOIAnalytics with proxy but without proxy password', () => {
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = structuredClone(baseConfiguration);
  configuration.settings.specificSettings = {
    ...configuration.settings.specificSettings!,
    useProxy: true,
    proxyUrl: 'http://proxyurl',
    proxyUsername: 'proxyUsername'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
  });

  it('should test connection', async () => {
    (HTTPRequest as unknown as jest.Mock).mockRejectedValueOnce(new Error('Timeout error'));

    await expect(south.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/optimistik/oibus/status' }), {
      method: 'GET',
      auth: { type: 'basic', username: 'username', password: 'password' },
      proxy: {
        url: 'http://proxyurl',
        auth: {
          type: 'url',
          username: 'proxyUsername'
        }
      },
      timeout: 30000
    });
  });

  it('should properly fetch', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, { result: [] }));

    const query = {
      from: '2019-10-03T13:36:38.590Z',
      to: '2019-10-03T15:36:38.590Z',
      aggregation: 'RAW_VALUES',
      'data-reference': 'SP_003_X'
    };
    const result = await south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(result).toEqual({ result: [] });
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/my/endpoint' }), {
      method: 'GET',
      query,
      auth: { type: 'basic', username: 'username', password: 'password' },
      proxy: {
        url: 'http://proxyurl',
        auth: {
          type: 'url',
          username: 'proxyUsername'
        }
      },
      timeout: 30000
    });
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data from URL "http://localhost:4200/api/my/endpoint" and query params "${JSON.stringify(query)}"`
    );
  });
});

describe('SouthOIAnalytics with aad-client-secret', () => {
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = structuredClone(baseConfiguration);
  configuration.settings.specificSettings = {
    ...configuration.settings.specificSettings!,
    authentication: 'aad-client-secret',
    tenantId: 'tenantId',
    clientId: 'clientId',
    clientSecret: 'clientSecret',
    scope: 'api://my-scope/.default',
    secretKey: null,
    useProxy: false
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
    await south.start();
  });

  it('should test connection', async () => {
    (HTTPRequest as unknown as jest.Mock).mockRejectedValueOnce(new Error('Timeout error'));

    await expect(south.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/optimistik/oibus/status' }), {
      method: 'GET',
      auth: { type: 'bearer', token: 'Bearer ClientSecretCredentialToken' },
      proxy: undefined,
      timeout: 30000
    });
  });

  it('should properly fetch', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, { result: [] }));

    const query = {
      from: '2019-10-03T13:36:38.590Z',
      to: '2019-10-03T15:36:38.590Z',
      aggregation: 'RAW_VALUES',
      'data-reference': 'SP_003_X'
    };
    const result = await south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(result).toEqual({ result: [] });
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/my/endpoint' }), {
      method: 'GET',
      query,
      auth: { type: 'bearer', token: 'Bearer ClientSecretCredentialToken' },
      proxy: undefined,
      timeout: 30000
    });
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data from URL "http://localhost:4200/api/my/endpoint" and query params "${JSON.stringify(query)}"`
    );
  });
});

describe('SouthOIAnalytics with aad-certificate', () => {
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = structuredClone(baseConfiguration);
  configuration.settings.specificSettings = {
    ...configuration.settings.specificSettings!,
    authentication: 'aad-certificate',
    certificateId: 'certificateId',
    useProxy: false
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);
    (certificateRepository.findById as jest.Mock).mockReturnValue({
      privateKey: 'private key',
      certificate: 'certificate'
    });

    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
    await south.start();
  });

  it('should test connection', async () => {
    (HTTPRequest as unknown as jest.Mock).mockRejectedValueOnce(new Error('Timeout error'));

    await expect(south.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/optimistik/oibus/status' }), {
      method: 'GET',
      auth: { type: 'bearer', token: 'Bearer ClientCertificateCredentialToken' },
      proxy: undefined,
      timeout: 30000
    });
  });

  it('should properly fetch', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, { result: [] }));

    const query = {
      from: '2019-10-03T13:36:38.590Z',
      to: '2019-10-03T15:36:38.590Z',
      aggregation: 'RAW_VALUES',
      'data-reference': 'SP_003_X'
    };
    const result = await south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(result).toEqual({ result: [] });
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/my/endpoint' }), {
      method: 'GET',
      query,
      auth: { type: 'bearer', token: 'Bearer ClientCertificateCredentialToken' },
      proxy: undefined,
      timeout: 30000
    });
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data from URL "http://localhost:4200/api/my/endpoint" and query params "${JSON.stringify(query)}"`
    );
  });
});

describe('SouthOIAnalytics with OIA module', () => {
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = structuredClone(baseConfiguration);
  configuration.settings = {
    ...configuration.settings,
    useOiaModule: true
  };

  let registrationSettings: OIAnalyticsRegistration;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    registrationSettings = {
      id: 'id',
      host: 'http://localhost:4200',
      token: 'my oia token',
      status: 'REGISTERED',
      activationDate: '2020-01-01T00:00:00Z',
      useProxy: false,
      acceptUnauthorized: false,
      activationCode: null,
      publicCipherKey: null,
      privateCipherKey: null,
      checkUrl: null,
      proxyUrl: null,
      proxyUsername: null,
      proxyPassword: null
    } as OIAnalyticsRegistration;
    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
    await south.start();
  });

  it('should test connection', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registrationSettings);
    (HTTPRequest as unknown as jest.Mock).mockRejectedValueOnce(new Error('Timeout error'));

    await expect(south.testConnection()).rejects.toThrow(`Fetch error ${new Error('Timeout error')}`);
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/optimistik/oibus/status' }), {
      method: 'GET',
      auth: { type: 'bearer', token: 'my oia token' },
      proxy: undefined,
      timeout: 30000
    });
  });

  it('should properly fetch', async () => {
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registrationSettings);
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, { result: [] }));

    const query = {
      from: '2019-10-03T13:36:38.590Z',
      to: '2019-10-03T15:36:38.590Z',
      aggregation: 'RAW_VALUES',
      'data-reference': 'SP_003_X'
    };
    const result = await south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(result).toEqual({ result: [] });
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/my/endpoint' }), {
      method: 'GET',
      query,
      auth: { type: 'bearer', token: 'my oia token' },
      proxy: undefined,
      timeout: 30000
    });
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data from URL "http://localhost:4200/api/my/endpoint" and query params "${JSON.stringify(query)}"`
    );
  });

  it('should use oia module with proxy', async () => {
    registrationSettings.host = 'http://localhost:4200/';
    registrationSettings.useProxy = true;
    registrationSettings.proxyUrl = 'http://localhost:8080';
    registrationSettings.proxyUsername = 'user';
    registrationSettings.proxyPassword = 'pass';
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registrationSettings);
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, { result: [] }));

    const query = {
      from: '2019-10-03T13:36:38.590Z',
      to: '2019-10-03T15:36:38.590Z',
      aggregation: 'RAW_VALUES',
      'data-reference': 'SP_003_X'
    };
    const result = await south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(result).toEqual({ result: [] });
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/my/endpoint' }), {
      method: 'GET',
      query,
      auth: { type: 'bearer', token: 'my oia token' },
      proxy: {
        url: 'http://localhost:8080',
        auth: { type: 'url', username: 'user', password: 'pass' }
      },
      timeout: 30000
    });
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data from URL "http://localhost:4200/api/my/endpoint" and query params "${JSON.stringify(query)}"`
    );
  });

  it('should use oia module with proxy without user', async () => {
    registrationSettings.host = 'http://localhost:4200/';
    registrationSettings.useProxy = true;
    registrationSettings.proxyUrl = 'http://localhost:8080';
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(registrationSettings);
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, { result: [] }));

    const query = {
      from: '2019-10-03T13:36:38.590Z',
      to: '2019-10-03T15:36:38.590Z',
      aggregation: 'RAW_VALUES',
      'data-reference': 'SP_003_X'
    };
    const result = await south.queryData(configuration.items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(result).toEqual({ result: [] });
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/my/endpoint' }), {
      method: 'GET',
      query,
      auth: { type: 'bearer', token: 'my oia token' },
      proxy: {
        url: 'http://localhost:8080'
      },
      timeout: 30000
    });
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data from URL "http://localhost:4200/api/my/endpoint" and query params "${JSON.stringify(query)}"`
    );
  });

  it('should test item', async () => {
    const callback = jest.fn();
    south.queryData = jest.fn().mockReturnValueOnce([]);
    await south.testItem(configuration.items[0], testData.south.itemTestingSettings, callback);
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    expect(south.queryData).toHaveBeenCalledWith(configuration.items[0], startTime, endTime);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should test item and throw an error', async () => {
    const callback = jest.fn();
    const error = new Error('Unable to query data');
    south.queryData = jest.fn().mockRejectedValue(error);

    await expect(south.testItem(configuration.items[0], testData.south.itemTestingSettings, callback)).rejects.toThrow(error);

    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    expect(south.queryData).toHaveBeenCalledWith(configuration.items[0], startTime, endTime);
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('SouthOIAnalytics with edge cases', () => {
  let south: SouthOianalytics;
  const configuration: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings> = structuredClone(baseConfiguration);

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    south = new SouthOianalytics(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      logger,
      mockBaseFolders(configuration.id)
    );
    await south.start();
  });

  it('should properly query data without query params', async () => {
    (HTTPRequest as jest.Mock).mockResolvedValueOnce(createMockResponse(200, { result: [] }));

    const result = await south.queryData(configuration.items[1], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(result).toEqual({ result: [] });
    expect(HTTPRequest).toHaveBeenCalledWith(expect.objectContaining({ href: 'http://localhost:4200/api/my/endpoint' }), {
      method: 'GET',
      query: {},
      auth: { type: 'basic', username: 'username', password: 'password' },
      proxy: undefined,
      timeout: 30000
    });
    expect(logger.info).toHaveBeenCalledWith(
      `Requesting data from URL "http://localhost:4200/api/my/endpoint" and query params "${JSON.stringify({})}"`
    );
  });

  it('should throw error when OIAnalytics is not set up', async () => {
    south['connector'] = structuredClone(south['connector']);
    south['connector'].settings.useOiaModule = true;
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(null);

    const error = new Error('OIBus not registered in OIAnalytics');
    expect(south['getProxyOptions'].bind(south)).toThrow(error);
    await expect(south['getAuthorizationOptions'].bind(south)).rejects.toThrow(error);
    expect(south['getHost'].bind(south)).toThrow(error);
  });

  it('should throw error when OIAnalytics is not registered', async () => {
    south['connector'] = structuredClone(south['connector']);
    south['connector'].settings.useOiaModule = true;
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue({ status: 'pending' });

    const error = new Error('OIBus not registered in OIAnalytics');
    expect(south['getProxyOptions'].bind(south)).toThrow(error);
    await expect(south['getAuthorizationOptions'].bind(south)).rejects.toThrow(error);
    expect(south['getHost'].bind(south)).toThrow(error);
  });

  it('should throw error when no proxy url is specified', () => {
    // Specific settings
    south['connector'] = structuredClone(south['connector']);
    south['connector'].settings.specificSettings = {
      ...south['connector'].settings.specificSettings!,
      useProxy: true,
      proxyUrl: undefined
    };

    expect(south['getProxyOptions'].bind(south)).toThrow(new Error(`Proxy URL not specified using specific settings`));

    // OIA module
    south['connector'].settings.useOiaModule = true;
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue({ status: 'REGISTERED', useProxy: true, proxyUrl: undefined });

    expect(south['getProxyOptions'].bind(south)).toThrow(new Error(`Proxy URL not specified using registered OIAnalytics module`));
  });

  it('should return undefined when there is no accessKey', async () => {
    south['connector'] = structuredClone(south['connector']);
    south['connector'].settings.specificSettings!.accessKey = undefined;
    (oIAnalyticsRegistrationRepository.get as jest.Mock).mockReturnValue(null);

    const result = await south['getAuthorizationOptions'].call(south);
    expect(result).toBeUndefined();
  });

  it('should return undefined when there is no certificate', async () => {
    south['connector'] = structuredClone(south['connector']);
    south['connector'].settings.specificSettings!.authentication = 'aad-certificate';
    (certificateRepository.findById as jest.Mock).mockReturnValue(null);

    const result = await south['getAuthorizationOptions'].call(south);
    expect(result).toBeUndefined();
  });
});
