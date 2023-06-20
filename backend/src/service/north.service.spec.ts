import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import PinoLogger from '../tests/__mocks__/logger.mock';
import EncryptionService from './encryption.service';
import NorthService from './north.service';
import RepositoryService from './repository.service';
import pino from 'pino';
import ProxyService from './proxy.service';

import { NorthCacheSettingsDTO } from '../../../shared/model/north-connector.model';

jest.mock('../repository/proxy.repository');
jest.mock('./encryption.service');
jest.mock('./north-connector-metrics.service');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryRepository: RepositoryService = new RepositoryServiceMock('', '');
const proxyService: ProxyService = new ProxyService(repositoryRepository.proxyRepository, encryptionService);

const logger: pino.Logger = new PinoLogger();
let service: NorthService;
describe('north service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new NorthService(proxyService, encryptionService, repositoryRepository);
  });

  it('should get a North connector settings', () => {
    service.getNorth('northId');
    expect(repositoryRepository.northConnectorRepository.getNorthConnector).toHaveBeenCalledTimes(1);
    expect(repositoryRepository.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('northId');
  });

  it('should get all North connector settings', () => {
    service.getNorthList();
    expect(repositoryRepository.northConnectorRepository.getNorthConnectors).toHaveBeenCalledTimes(1);
  });

  it('should create North connector', () => {
    const connector = service.createNorth(
      {
        id: 'northId',
        name: 'myNorth',
        description: 'my test connector',
        type: 'console',
        enabled: false,
        caching: {} as NorthCacheSettingsDTO,
        archive: {
          enabled: false,
          retentionDuration: 0
        },
        settings: { verbose: true }
      },
      'myBaseFolder',
      logger
    );
    expect(connector).toBeDefined();
  });

  it('should not create North connector not installed', () => {
    let connector;
    let error;
    try {
      connector = service.createNorth(
        {
          id: 'northId',
          name: 'myNorth',
          description: 'my test connector',
          type: 'another',
          enabled: false,
          caching: {} as NorthCacheSettingsDTO,
          archive: {
            enabled: false,
            retentionDuration: 0
          },
          settings: { verbose: true }
        },
        'myBaseFolder',
        logger
      );
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('North connector of type another not installed'));
    expect(connector).not.toBeDefined();
  });
});
