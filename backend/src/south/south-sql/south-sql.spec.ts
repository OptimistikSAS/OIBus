import path from 'node:path';
// eslint-disable-next-line import/no-unresolved

import SouthSQL from './south-sql';
import * as utils from './utils';
import * as mainUtils from '../../service/utils';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';

const mockDatabase = {
  prepare: jest.fn(),
  close: jest.fn()
};
jest.mock('better-sqlite3', () => () => mockDatabase);
jest.mock('pg', () => ({
  Client: jest.fn(),
  types: jest.fn()
}));
jest.mock('./utils', () => ({
  generateCSV: jest.fn(),
  getMostRecentDate: jest.fn(),
  generateReplacementParameters: jest.fn()
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
let south: SouthSQL;
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

describe('SouthSQL', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (utils.getMostRecentDate as jest.Mock).mockReturnValue(new Date(nowDateString));
    (utils.generateReplacementParameters as jest.Mock).mockReturnValue([new Date(nowDateString), new Date(nowDateString)]);

    (mainUtils.replaceFilenameWithVariable as jest.Mock).mockReturnValue('myFile');

    south = new SouthSQL(
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
});
