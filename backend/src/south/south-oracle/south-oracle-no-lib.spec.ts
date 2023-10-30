import SouthOracle from './south-oracle';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';

import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import { SouthOracleItemSettings, SouthOracleSettings } from '../../../../shared/model/south-settings.model';

jest.mock('oracledb', () => {
  throw new Error('bad');
});
jest.mock('../../service/utils');

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
const items: Array<SouthConnectorItemDTO<SouthOracleItemSettings>> = [];

// Spy on console info and error
jest.spyOn(global.console, 'info').mockImplementation(() => {});
jest.spyOn(global.console, 'error').mockImplementation(() => {});

let south: SouthOracle;
describe('SouthOracle with authentication', () => {
  const connector: SouthConnectorDTO<SouthOracleSettings> = {
    id: 'southId',
    name: 'south',
    type: 'oracle',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      host: 'localhost',
      port: 1521,
      database: 'db',
      username: 'username',
      password: 'password',
      connectionTimeout: 1000
    }
  };
  beforeEach(async () => {
    jest.clearAllMocks();

    south = new SouthOracle(connector, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should throw error if library not loaded', async () => {
    await expect(south.testConnection()).rejects.toThrow(new Error('oracledb library not loaded'));

    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    await expect(south.queryData({} as SouthConnectorItemDTO, startTime, endTime)).rejects.toThrow(
      new Error('oracledb library not loaded')
    );
  });
});
