import db from 'better-sqlite3';
import SouthCacheService from './south-cache.service';

jest.mock(
  '../repository/connector-cache.repository',
  () =>
    function () {
      return {
        createMetricsTable: jest.fn(),
        createSouthCacheScanModeTable: jest.fn(),
        createOrUpdateCacheScanMode: jest.fn(),
        getSouthCacheScanMode: jest.fn(),
        resetSouthCacheDatabase: jest.fn()
      };
    }
);
jest.mock('better-sqlite3', () => jest.fn(() => 'sqlite database'));

const nowDateString = '2020-02-02T02:02:02.222Z';
let service: SouthCacheService;

describe('South cache service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    service = new SouthCacheService('connectorId', 'south-cache');
  });

  it('should be properly initialized', () => {
    expect(db).toHaveBeenCalledWith('south-cache');
    expect(service.cacheRepository).toBeDefined();
  });

  it('should create cache history table', () => {
    service.createSouthCacheScanModeTable();
    expect(service.cacheRepository.createSouthCacheScanModeTable).toHaveBeenCalledTimes(1);
  });

  it('should create or update cache scan mode', () => {
    const command = {
      scanModeId: 'id1',
      itemId: 'itemId',
      intervalIndex: 1,
      maxInstant: ''
    };
    service.createOrUpdateCacheScanMode(command);
    expect(service.cacheRepository.createOrUpdateCacheScanMode).toHaveBeenCalledTimes(1);
  });

  it('should get scan mode', () => {
    const scanMode = {
      scanModeId: 'id1',
      itemId: 'itemId',
      intervalIndex: 1,
      maxInstant: ''
    };
    (service.cacheRepository.getSouthCacheScanMode as jest.Mock).mockReturnValueOnce(scanMode).mockReturnValue(null);
    const result = service.getSouthCacheScanMode('id1', 'itemId', nowDateString);
    expect(result).toEqual(scanMode);

    const defaultResult = service.getSouthCacheScanMode('id1', 'itemId', nowDateString);
    expect(defaultResult).toEqual({
      scanModeId: 'id1',
      itemId: 'itemId',
      maxInstant: nowDateString,
      intervalIndex: 0
    });
  });

  it('should reset cache', () => {
    service.resetCacheScanMode();
    expect(service.cacheRepository.resetSouthCacheDatabase).toHaveBeenCalledTimes(1);
  });

  it('should reset cache', () => {
    service.resetCacheScanMode();
    expect(service.cacheRepository.resetSouthCacheDatabase).toHaveBeenCalledTimes(1);
  });
});
