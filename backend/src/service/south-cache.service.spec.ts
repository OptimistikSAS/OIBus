import SouthCacheService from './south-cache.service';

import SouthCacheRepositoryMock from '../tests/__mocks__/repository/south-cache-repository.mock';
import SouthCacheRepository from '../repository/south-cache.repository';
import { SouthCache } from '../../../shared/model/south-connector.model';

const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();

const nowDateString = '2020-02-02T02:02:02.222Z';
let service: SouthCacheService;

describe('South cache service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    service = new SouthCacheService('connectorId', southCacheRepository);
  });

  it('should be properly initialized', () => {
    expect(service.cacheRepository).toBeDefined();
  });

  it('should create or update cache scan mode', () => {
    const command: SouthCache = {
      scanModeId: 'id1',
      itemId: 'itemId',
      southId: 'southId',
      maxInstant: ''
    };
    service.createOrUpdateCacheScanMode(command);
    expect(service.cacheRepository.createOrUpdate).toHaveBeenCalledTimes(1);
  });

  it('should get scan mode', () => {
    const scanMode: SouthCache = {
      scanModeId: 'id1',
      itemId: 'itemId',
      southId: 'southId',
      maxInstant: ''
    };
    (service.cacheRepository.getScanMode as jest.Mock).mockReturnValueOnce(scanMode).mockReturnValue(null);
    const result = service.getSouthCacheScanMode('southId', 'id1', 'itemId', nowDateString);
    expect(result).toEqual(scanMode);

    const defaultResult = service.getSouthCacheScanMode('southId', 'id1', 'itemId', nowDateString);
    expect(defaultResult).toEqual({
      scanModeId: 'id1',
      itemId: 'itemId',
      maxInstant: nowDateString,
      southId: 'southId'
    });
  });

  it('should reset cache', () => {
    service.resetCacheScanMode('id');
    expect(service.cacheRepository.reset).toHaveBeenCalledTimes(1);
  });

  it('should reset cache', () => {
    service.resetCacheScanMode('id');
    expect(service.cacheRepository.reset).toHaveBeenCalledTimes(1);
  });
});
