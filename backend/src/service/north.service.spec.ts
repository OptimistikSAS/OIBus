import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import PinoLogger from '../tests/__mocks__/logger.mock';
import EncryptionService from './encryption.service';
import NorthService from './north.service';
import RepositoryService from './repository.service';
import pino from 'pino';
import ProxyService from './proxy.service';

import { NorthCacheSettingsLightDTO } from '../../../shared/model/north-connector.model';

jest.mock('../repository/proxy.repository');
jest.mock('./encryption.service');

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
        type: 'Console',
        enabled: false,
        caching: {} as NorthCacheSettingsLightDTO,
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
});
