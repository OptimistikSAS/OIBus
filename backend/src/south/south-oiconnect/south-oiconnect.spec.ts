import fetch from 'node-fetch';
import SouthOIConnect from './south-oiconnect';
import * as utils from './utils';
import * as mainUtils from '../../service/utils';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import PinoLogger from '../../tests/__mocks__/logger.mock';

import pino from 'pino';
import { SouthConnectorItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import ProxyService from '../../service/proxy.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import path from 'node:path';
import https from 'node:https';

jest.mock('./utils', () => ({
  formatQueryParams: jest.fn(),
  parsers: new Map(),
  httpGetWithBody: jest.fn()
}));
jest.mock('../../service/utils');

// Mock node-fetch
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
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);
const items: Array<SouthConnectorItemDTO> = [
  {
    id: 'id1',
    name: 'item1',
    connectorId: 'southId',
    settings: {
      requestMethod: 'POST',
      endpoint: '/api/my/endpoint',
      payloadParser: 'raw',
      requestTimeout: 3000,
      body: 'my body',
      serialization: {
        type: 'file',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        dateTimeOutputFormat: { type: 'iso-8601-string' },
        datetimeSerialization: [
          { field: 'anotherTimestamp', useAsReference: false, datetimeFormat: { type: 'unix-epoch-ms', timezone: 'Europe/Paris' } },
          {
            field: 'timestamp',
            useAsReference: true,
            datetimeFormat: { type: 'specific-string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
          }
        ]
      }
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    connectorId: 'southId',
    settings: {
      requestMethod: 'GET',
      endpoint: '/api/my/endpoint',
      payloadParser: 'raw',
      requestTimeout: 3000,
      body: '',
      serialization: {
        type: 'file',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        dateTimeOutputFormat: { type: 'iso-8601-string' },
        datetimeSerialization: [
          { field: 'anotherTimestamp', useAsReference: false, datetimeFormat: { type: 'unix-epoch-ms', timezone: 'Europe/Paris' } },
          {
            field: 'timestamp',
            useAsReference: true,
            datetimeFormat: { type: 'specific-string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
          }
        ]
      }
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id3',
    name: 'item3',
    connectorId: 'southId',
    settings: {
      requestMethod: 'GET',
      endpoint: '/api/my/endpoint',
      payloadParser: 'raw',
      requestTimeout: 3000,
      body: 'my body',
      serialization: {
        type: 'file',
        filename: 'sql-@CurrentDate.csv',
        delimiter: 'COMMA',
        compression: true,
        dateTimeOutputFormat: { type: 'iso-8601-string' },
        datetimeSerialization: [
          { field: 'anotherTimestamp', useAsReference: false, datetimeFormat: { type: 'unix-epoch-ms', timezone: 'Europe/Paris' } },
          {
            field: 'timestamp',
            useAsReference: true,
            datetimeFormat: { type: 'specific-string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
          }
        ]
      }
    },
    scanModeId: 'scanModeId2'
  }
];

const nowDateString = '2020-02-02T02:02:02.222Z';
let south: SouthOIConnect;

describe('SouthOIConnect with Basic auth', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      url: 'http://localhost',
      port: 4200,
      acceptSelfSigned: false,
      requestMethod: 'GET',
      authentication: { type: 'basic', username: 'username', password: 'password' }
    }
  };
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthOIConnect(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true
    );
  });

  it('should test connection with odbc', async () => {
    // TODO
    await expect(SouthOIConnect.testConnection({}, logger, encryptionService)).rejects.toThrow('TODO: method needs to be implemented');
    expect(logger.trace).toHaveBeenCalledWith(`Testing connection`);
  });

  it('should log error if temp folder creation fails', async () => {
    await south.start();
    expect(mainUtils.createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', 'tmp'));
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
    const rawMethod = jest
      .fn()
      .mockImplementationOnce((item: SouthConnectorItemDTO, httpResults: Array<any>) => ({
        formattedResult: httpResults,
        maxInstant: '2020-03-01T00:00:00.000Z'
      }))
      .mockImplementation(() => ({
        formattedResult: [],
        maxInstant: '2020-03-01T00:00:00.000Z'
      }));
    utils.parsers.set('raw', rawMethod);

    await south.historyQuery(items, startTime, nowDateString);
    expect(mainUtils.persistResults).toHaveBeenCalledTimes(1);
    expect(south.queryData).toHaveBeenCalledTimes(3);
    expect(rawMethod).toHaveBeenCalledTimes(3);
    expect(south.queryData).toHaveBeenCalledWith(items[0], startTime, nowDateString);
    expect(south.queryData).toHaveBeenCalledWith(items[1], '2020-03-01T00:00:00.000Z', nowDateString);
    expect(south.queryData).toHaveBeenCalledWith(items[2], '2020-03-01T00:00:00.000Z', nowDateString);
    expect(logger.info).toHaveBeenCalledWith(`Found 2 results for item ${items[0].name} in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[1].name}. Request done in 0 ms`);
    expect(logger.debug).toHaveBeenCalledWith(`No result found for item ${items[2].name}. Request done in 0 ms`);
  });

  it('should fail to scan', async () => {
    (fetch as unknown as jest.Mock).mockReturnValue(Promise.resolve({ ok: false, status: 400, statusText: 'statusText' }));

    await expect(south.queryData(items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z')).rejects.toThrowError(
      'HTTP request failed with status code 400 and message: statusText'
    );

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        agent: null,
        headers: { 'Content-Length': 7, 'Content-Type': 'application/json', authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' },
        method: 'POST',
        timeout: 3000,
        body: 'my body'
      }
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Requesting data with POST ' +
        'method: "http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X"'
    );
  });
});

describe('SouthOIConnect with Bearer auth', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      url: 'http://localhost',
      port: 4200,
      acceptSelfSigned: true,
      requestMethod: 'GET',
      authentication: {
        type: 'bearer',
        token: 'my token'
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthOIConnect(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true
    );
  });

  it('should fetch data', async () => {
    (fetch as unknown as jest.Mock).mockReturnValue(Promise.resolve({ ok: true, status: 200, json: () => ['some data'] }));

    const result = await south.queryData(items[0], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(result).toEqual(['some data']);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        agent: expect.any(https.Agent),
        headers: { 'Content-Length': 7, 'Content-Type': 'application/json', authorization: 'Bearer my token' },
        method: 'POST',
        timeout: 3000,
        body: 'my body'
      }
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Requesting data with POST ' +
        'method: "http://localhost:4200/api/my/endpoint' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X"'
    );
  });
});

describe('SouthOIConnect with API-Key auth', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      url: 'http://localhost',
      port: 4200,
      acceptSelfSigned: true,
      requestMethod: 'GET',
      authentication: {
        type: 'api-key',
        key: 'myKey',
        secret: 'mySecret'
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthOIConnect(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true
    );
  });

  it('should fetch data with GET method and body', async () => {
    (utils.httpGetWithBody as unknown as jest.Mock).mockReturnValue(Promise.resolve(['some data']));

    const result = await south.queryData(items[2], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(result).toEqual(['some data']);

    expect(utils.httpGetWithBody).toHaveBeenCalledWith('my body', {
      agent: expect.any(https.Agent),
      headers: {
        'Content-Length': 7,
        'Content-Type': 'application/json',
        myKey: 'mySecret'
      },
      host: 'http://localhost',
      method: 'GET',
      path: '/api/my/endpoint',
      port: 4200,
      timeout: 3000
    });
    expect(logger.info).toHaveBeenCalledWith('Requesting data with GET method and body on: "http://localhost:4200/api/my/endpoint"');
  });
});

describe('SouthOIConnect without auth', () => {
  const configuration: SouthConnectorDTO = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      url: 'http://localhost',
      port: 4200,
      acceptSelfSigned: false,
      authentication: {
        type: 'none'
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );

    south = new SouthOIConnect(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true
    );
  });

  it('should fetch data with GET and Body', async () => {
    (utils.httpGetWithBody as unknown as jest.Mock).mockReturnValue(Promise.resolve(['some data']));

    const result = await south.queryData(items[2], '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(result).toEqual(['some data']);

    expect(utils.httpGetWithBody).toHaveBeenCalledWith('my body', {
      agent: null,
      headers: {
        'Content-Length': 7,
        'Content-Type': 'application/json'
      },
      host: 'http://localhost',
      method: 'GET',
      path: '/api/my/endpoint',
      port: 4200,
      timeout: 3000
    });
    expect(logger.info).toHaveBeenCalledWith('Requesting data with GET method and body on: "http://localhost:4200/api/my/endpoint"');
  });
});
