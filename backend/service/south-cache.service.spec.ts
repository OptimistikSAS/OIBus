import db from 'better-sqlite3';
import SouthCacheRepository from '../repository/south-cache.repository';
import SouthCacheService from './south-cache.service';

jest.mock('../repository/south-cache.repository');
jest.mock('better-sqlite3', () => jest.fn(() => 'sqlite database'));

const nowDateString = '2020-02-02T02:02:02.222Z';
let service: SouthCacheService;
describe('South cache service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    service = new SouthCacheService('south-cache');
  });

  it('should be properly initialized', () => {
    expect(db).toHaveBeenCalledWith('south-cache');
    expect(SouthCacheRepository).toHaveBeenCalledWith('sqlite database');
    expect(service.southCacheRepository).toBeDefined();
  });

  it('should create cache history table', () => {
    service.createCacheHistoryTable();
    expect(service.southCacheRepository.createCacheHistoryTable).toHaveBeenCalledTimes(1);
  });

  it('should create or update cache scan mode', () => {
    const command = {
      scanModeId: 'id1',
      intervalIndex: 1,
      maxInstant: ''
    };
    service.createOrUpdateCacheScanMode(command);
    expect(service.southCacheRepository.createOrUpdateCacheScanMode).toHaveBeenCalledTimes(1);
  });

  it('should get scan mode', () => {
    const scanMode = {
      scanModeId: 'id1',
      intervalIndex: 1,
      maxInstant: ''
    };
    (service.southCacheRepository.getSouthCacheScanMode as jest.Mock).mockReturnValueOnce(scanMode).mockReturnValue(null);
    const result = service.getSouthCache('id1', nowDateString);
    expect(result).toEqual(scanMode);

    const defaultResult = service.getSouthCache('id1', nowDateString);
    expect(defaultResult).toEqual({
      scanModeId: 'id1',
      maxInstant: nowDateString,
      intervalIndex: 0
    });
  });
});
