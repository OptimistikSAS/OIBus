import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import PinoLogger from '../tests/__mocks__/logger.mock';
import EncryptionService from './encryption.service';
import RepositoryService from './repository.service';
import pino from 'pino';
import ProxyService from './proxy.service';
import SouthService from './south.service';

jest.mock('../repository/proxy.repository');
jest.mock('./encryption.service');
jest.mock('./south-cache.service');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryRepository: RepositoryService = new RepositoryServiceMock('', '');
const proxyService: ProxyService = new ProxyService(repositoryRepository.proxyRepository, encryptionService);

const logger: pino.Logger = new PinoLogger();
let service: SouthService;
describe('south service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new SouthService(proxyService, encryptionService, repositoryRepository);
  });

  it('should get a South connector settings', () => {
    service.getSouth('southId');
    expect(repositoryRepository.southConnectorRepository.getSouthConnector).toHaveBeenCalledTimes(1);
    expect(repositoryRepository.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
  });

  it('should get a South connector items', () => {
    service.getSouthItems('southId');
    expect(repositoryRepository.southItemRepository.getSouthItems).toHaveBeenCalledTimes(1);
    expect(repositoryRepository.southItemRepository.getSouthItems).toHaveBeenCalledWith('southId');
  });

  it('should get all South connector settings', () => {
    service.getSouthList();
    expect(repositoryRepository.southConnectorRepository.getSouthConnectors).toHaveBeenCalledTimes(1);
  });

  it('should create South connector', () => {
    const connector = service.createSouth(
      {
        id: 'southId',
        name: 'mySouth',
        description: 'my test connector',
        type: 'FolderScanner',
        enabled: false,
        settings: { verbose: true }
      },
      [],
      jest.fn(),
      jest.fn(),
      'myBaseFolder',
      true,
      logger
    );
    expect(connector).toBeDefined();
  });
});
