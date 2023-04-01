import fetch from 'node-fetch';
import SouthOIConnect from './south-oiconnect';
import * as utils from './utils';
import * as mainUtils from '../../service/utils';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import PinoLogger from '../../tests/__mocks__/logger.mock';

import pino from 'pino';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import ProxyService from '../../service/proxy.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import path from 'node:path';

jest.mock('./utils', () => ({
  generateCSV: jest.fn(),
  formatQueryParams: jest.fn(),
  parsers: new Map(),
  httpGetWithBody: jest.fn()
}));
jest.mock('../../service/utils', () => ({
  replaceFilenameWithVariable: jest.fn(),
  compress: jest.fn(),
  createFolder: jest.fn()
}));

// Mock node-fetch
jest.mock('node-fetch');
jest.mock('node:fs/promises');
jest.mock('../../service/utils');
const database = new DatabaseMock();
jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return {
        createCacheHistoryTable: jest.fn(),
        southCacheRepository: {
          database
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
const items: Array<OibusItemDTO> = [
  {
    id: 'id1',
    name: 'item1',
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Random'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Counter'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id3',
    name: 'item3',
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Triangle'
    },
    scanModeId: 'scanModeId2'
  }
];

const nowDateString = '2020-02-02T02:02:02.222Z';
let south: SouthOIConnect;
const configuration: SouthConnectorDTO = {
  id: 'southId',
  name: 'south',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  settings: {
    port: 4200,
    connectionTimeout: 1000,
    requestTimeout: 1000,
    host: 'localhost',
    protocol: 'http',
    compression: false,
    requestMethod: 'GET',
    endpoint: '/api/oianalytics/data/values/query',
    delimiter: ',',
    dateFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
    fileName: 'rast-api-results_@CurrentDate.csv',
    timeColumn: 'timestamp',
    timezone: 'Europe/Paris',
    variableDateFormat: 'ISO',
    authentication: {
      username: 'user',
      password: 'password',
      type: 'basic'
    },
    queryParams: [
      {
        queryParamKey: 'from',
        queryParamValue: '@StartTime'
      },
      {
        queryParamKey: 'to',
        queryParamValue: '@EndTime'
      },
      {
        queryParamKey: 'aggregation',
        queryParamValue: 'RAW_VALUES'
      },
      {
        queryParamKey: 'data-reference',
        queryParamValue: 'SP_003_X'
      }
    ],
    acceptSelfSigned: false,
    convertToCsv: true,
    payloadParser: 'Raw'
  }
};

describe('SouthRest', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.formatQueryParams as jest.Mock).mockReturnValue(
      '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z' + '&aggregation=RAW_VALUES&data-reference=SP_003_X'
    );
    (mainUtils.replaceFilenameWithVariable as jest.Mock).mockReturnValue('myFile');

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

  it('should log error if temp folder creation fails', async () => {
    await south.start();
    expect(mainUtils.createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', 'tmp'));
  });

  it('should fail to scan', async () => {
    utils.parsers.set(
      'Raw',
      jest.fn(results => ({ httpResults: results, latestDateRetrieved: '2020-01-01T00:00:00.000Z' }))
    );
    (fetch as unknown as jest.Mock).mockReturnValue(Promise.resolve({ ok: false, status: 400, statusText: 'statusText' }));
    await south.start();

    await expect(south.historyQuery(items, '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z')).rejects.toThrowError(
      'HTTP request failed with status code 400 and message: statusText'
    );

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/oianalytics/data/values/query' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      { agent: null, headers: { authorization: 'Basic dXNlcjp1bmRlZmluZWQ=' }, method: 'GET', timeout: 1000 }
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Requesting data with GET ' +
        'method: "http://localhost:4200/api/oianalytics/data/values/query' +
        '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X"'
    );
  });

  it('should successfully scan http endpoint', async () => {
    utils.parsers.set(
      'Raw',
      jest.fn(results => ({ httpResults: results, latestDateRetrieved: new Date('2020-01-01T00:00:00.000Z') }))
    );
    const endpointResult = [
      {
        value: 'val1',
        timestamp: new Date('2020-01-01T00:00:00.000Z')
      }
    ];
    (fetch as unknown as jest.Mock).mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'statusText',
        json: () =>
          new Promise(resolve => {
            resolve(endpointResult);
          })
      })
    );
    await south.start();
    await south.connect();

    await south.historyQuery(items, '2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z');
    expect(utils.generateCSV).toHaveBeenCalledWith(endpointResult, ',');
  });

  it('should return empty results', async () => {
    utils.parsers.set(
      'Raw',
      jest.fn(() => ({ httpResults: [], latestDateRetrieved: new Date() }))
    );
    const endpointResult: Array<any> = [];
    (fetch as unknown as jest.Mock).mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'statusText',
        json: () =>
          new Promise(resolve => {
            resolve(endpointResult);
          })
      })
    );
    await south.start();
    await south.connect();

    await south.historyQuery(items, '2019-10-03T13:36:38.590Z', '2019-10-03T15:36:38.590Z');

    expect(logger.debug).toHaveBeenCalledWith('No result found between 2019-10-03T13:36:38.590Z and 2019-10-03T15:36:38.590Z');
  });
});
