import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import EncryptionService from './encryption.service';
import RepositoryService from './repository.service';
import ProxyService from './proxy.service';
import HistoryQueryService from './history-query.service';

jest.mock('../repository/proxy.repository');
jest.mock('./encryption.service');
jest.mock('./south-cache.service');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryRepository: RepositoryService = new RepositoryServiceMock('', '');
const proxyService: ProxyService = new ProxyService(repositoryRepository.proxyRepository, encryptionService);

let service: HistoryQueryService;
describe('history query service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new HistoryQueryService(proxyService, encryptionService, repositoryRepository);
  });

  it('should get a History query settings', () => {
    service.getHistoryQuery('historyId');
    expect(repositoryRepository.historyQueryRepository.getHistoryQuery).toHaveBeenCalledTimes(1);
    expect(repositoryRepository.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
  });

  it('should get a History query items', () => {
    service.getItems('historyId');
    expect(repositoryRepository.historyQueryItemRepository.getHistoryItems).toHaveBeenCalledTimes(1);
    expect(repositoryRepository.historyQueryItemRepository.getHistoryItems).toHaveBeenCalledWith('historyId');
  });

  it('should get all History queries settings', () => {
    service.getHistoryQueryList();
    expect(repositoryRepository.historyQueryRepository.getHistoryQueries).toHaveBeenCalledTimes(1);
  });
});
