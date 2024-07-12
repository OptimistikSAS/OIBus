import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import RepositoryService from './repository.service';
import HistoryQueryService from './history-query.service';

jest.mock('./encryption.service');

const repositoryRepository: RepositoryService = new RepositoryServiceMock('', '');

let service: HistoryQueryService;
describe('history query service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new HistoryQueryService(repositoryRepository);
  });

  it('should get a History query settings', () => {
    service.getHistoryQuery('historyId');
    expect(repositoryRepository.historyQueryRepository.getHistoryQuery).toHaveBeenCalledTimes(1);
    expect(repositoryRepository.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
  });

  it('should get a History query items', () => {
    service.listItems('historyId', {});
    expect(repositoryRepository.historyQueryItemRepository.listHistoryItems).toHaveBeenCalledTimes(1);
    expect(repositoryRepository.historyQueryItemRepository.listHistoryItems).toHaveBeenCalledWith('historyId', {});
  });

  it('should get all History queries settings', () => {
    service.getHistoryQueryList();
    expect(repositoryRepository.historyQueryRepository.getHistoryQueries).toHaveBeenCalledTimes(1);
  });
});
