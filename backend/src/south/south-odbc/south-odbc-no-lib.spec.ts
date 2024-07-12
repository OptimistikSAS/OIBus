import SouthODBC from './south-odbc';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';
// eslint-disable-next-line import/no-unresolved
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import { SouthODBCSettings } from '../../../../shared/model/south-settings.model';

jest.mock('../../service/utils');
jest.mock('odbc', () => {
  throw new Error('bad');
});
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

let south: SouthODBC;

// Spy on console info and error
jest.spyOn(global.console, 'info').mockImplementation(() => {});
jest.spyOn(global.console, 'error').mockImplementation(() => {});

describe('SouthODBC without ODBC Library', () => {
  const configuration: SouthConnectorDTO<SouthODBCSettings> = {
    id: 'southId',
    name: 'south',
    type: 'odbc',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      remoteAgent: false,
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    south = new SouthODBC(configuration, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should throw error if library not loaded', async () => {
    await expect(south.testOdbcConnection()).rejects.toThrow(new Error('odbc library not loaded'));

    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    await expect(south.queryOdbcData({} as SouthConnectorItemDTO, startTime, endTime)).rejects.toThrow(
      new Error('odbc library not loaded')
    );
  });
});
