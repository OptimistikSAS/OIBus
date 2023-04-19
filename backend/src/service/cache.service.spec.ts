import db from 'better-sqlite3';
import ConnectorCacheRepository from '../repository/connector-cache.repository';
import CacheService from './cache.service';

jest.mock('../repository/connector-cache.repository');
jest.mock('better-sqlite3', () => jest.fn(() => 'sqlite database'));

const nowDateString = '2020-02-02T02:02:02.222Z';
let service: CacheService;
describe('South cache service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    service = new CacheService('connectorId', 'south-cache');
  });

  it('should be properly initialized', () => {
    expect(db).toHaveBeenCalledWith('south-cache');
    expect(ConnectorCacheRepository).toHaveBeenCalledWith('sqlite database');
    expect(service.cacheRepository).toBeDefined();
  });

  it('should create cache history table', () => {
    service.createCacheHistoryTable();
    expect(service.cacheRepository.createCacheHistoryTable).toHaveBeenCalledTimes(1);
  });

  it('should create or update cache scan mode', () => {
    const command = {
      scanModeId: 'id1',
      intervalIndex: 1,
      maxInstant: ''
    };
    service.createOrUpdateCacheScanMode(command);
    expect(service.cacheRepository.createOrUpdateCacheScanMode).toHaveBeenCalledTimes(1);
  });

  it('should get scan mode', () => {
    const scanMode = {
      scanModeId: 'id1',
      intervalIndex: 1,
      maxInstant: ''
    };
    (service.cacheRepository.getSouthCacheScanMode as jest.Mock).mockReturnValueOnce(scanMode).mockReturnValue(null);
    const result = service.getSouthCache('id1', nowDateString);
    expect(result).toEqual(scanMode);

    const defaultResult = service.getSouthCache('id1', nowDateString);
    expect(defaultResult).toEqual({
      scanModeId: 'id1',
      maxInstant: nowDateString,
      intervalIndex: 0
    });
  });

  it('should reset cache', () => {
    service.resetCache();
    expect(service.cacheRepository.resetDatabase).toHaveBeenCalledTimes(1);
  });
});
