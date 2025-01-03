import SouthCacheService from './south-cache.service';

import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import { SouthCache } from '../../shared/model/south-connector.model';
import testData from '../tests/utils/test-data';

const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();

let service: SouthCacheService;
describe('South cache service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    service = new SouthCacheService(southCacheRepository);
  });

  it('should create or update cache scan mode', () => {
    const command: SouthCache = {
      scanModeId: 'id1',
      itemId: 'itemId',
      southId: 'southId',
      maxInstant: ''
    };
    service.saveSouthCache(command);
    expect(southCacheRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should get scan mode', () => {
    const scanMode: SouthCache = {
      scanModeId: 'id1',
      itemId: 'itemId',
      southId: 'southId',
      maxInstant: ''
    };
    (southCacheRepository.getSouthCache as jest.Mock).mockReturnValueOnce(scanMode).mockReturnValue(null);
    const result = service.getSouthCache('southId', 'id1', 'itemId', testData.constants.dates.FAKE_NOW);
    expect(result).toEqual(scanMode);

    const defaultResult = service.getSouthCache('southId', 'id1', 'itemId', testData.constants.dates.FAKE_NOW);
    expect(defaultResult).toEqual({
      scanModeId: 'id1',
      itemId: 'itemId',
      maxInstant: testData.constants.dates.FAKE_NOW,
      southId: 'southId'
    });
  });

  it('should reset cache', () => {
    service.resetSouthCache('id');
    expect(southCacheRepository.deleteAllBySouthConnector).toHaveBeenCalledTimes(1);
  });

  it('should reset cache', () => {
    service.resetSouthCache('id');
    expect(southCacheRepository.deleteAllBySouthConnector).toHaveBeenCalledTimes(1);
  });

  it('should create custom table', () => {
    service.createCustomTable('table name', 'fields');
    expect(southCacheRepository.createCustomTable).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.createCustomTable).toHaveBeenCalledWith('table name', 'fields');
  });

  it('should get query on custom table', () => {
    service.getQueryOnCustomTable('query', []);
    expect(southCacheRepository.getQueryOnCustomTable).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.getQueryOnCustomTable).toHaveBeenCalledWith('query', []);
  });

  it('should run query on custom table', () => {
    service.runQueryOnCustomTable('query', []);
    expect(southCacheRepository.runQueryOnCustomTable).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.runQueryOnCustomTable).toHaveBeenCalledWith('query', []);
  });
});
