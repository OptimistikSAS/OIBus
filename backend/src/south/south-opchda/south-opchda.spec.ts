import SouthOPCHDA from './south-opchda';
import deferredPromise from '../../service/deferred-promise';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import { SouthOPCHDAItemSettings, SouthOPCHDASettings } from '../../../../shared/model/south-settings.model';

jest.mock('../../service/deferred-promise');
jest.mock('node:fs/promises');
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
const items: Array<SouthConnectorItemDTO<SouthOPCHDAItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Random',
      aggregate: 'Raw',
      resampling: 'None'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Counter',
      aggregate: 'Raw',
      resampling: 'None'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id3',
    name: 'item3',
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Triangle',
      aggregate: 'Raw',
      resampling: 'None'
    },
    scanModeId: 'scanModeId2'
  }
];

const configuration: SouthConnectorDTO<SouthOPCHDASettings> = {
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
    tcpPort: 2224,
    retryInterval: 10000,
    maxReturnValues: 0,
    readTimeout: 60,
    agentFilename: './HdaAgent/HdaAgent.exe',
    logLevel: 'trace',
    host: '1.2.3.4',
    serverName: 'MyOPCServer'
  }
};
let south: SouthOPCHDA;

const originalPlatform = process.platform;

describe('South OPCHDA', () => {
  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    (deferredPromise as jest.Mock).mockImplementation(() => ({
      promise: {
        resolve: jest.fn(),
        reject: jest.fn(() => {
          throw new Error('promise error');
        })
      }
    }));

    south = new SouthOPCHDA(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should log error if the connector is run on the wrong platform', async () => {
    Object.defineProperty(process, 'platform', { value: 'notWin32' });
    await south.start();

    expect(logger.error).toHaveBeenCalledWith('OIBus OPCHDA Agent only supported on Windows: notWin32');
    Object.defineProperty(process, 'platform', { value: 'win32' });
  });
});
