import SouthCacheService from './south-cache.service';

import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import { SouthCache } from '../../../shared/model/south-connector.model';

const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();

const nowDateString = '2020-02-02T02:02:02.222Z';
let service: SouthCacheService;

describe('South cache service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

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
    const result = service.getSouthCache('southId', 'id1', 'itemId', nowDateString);
    expect(result).toEqual(scanMode);

    const defaultResult = service.getSouthCache('southId', 'id1', 'itemId', nowDateString);
    expect(defaultResult).toEqual({
      scanModeId: 'id1',
      itemId: 'itemId',
      maxInstant: nowDateString,
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
});
