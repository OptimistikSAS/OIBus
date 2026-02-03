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

  afterEach(() => {
    jest.useRealTimers();
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

  it('should create item value table', () => {
    service.createItemValueTable('conn-1');
    expect(southCacheRepository.createItemValueTable).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.createItemValueTable).toHaveBeenCalledWith('conn-1');
  });

  it('should get item last value', () => {
    const value = { itemId: 'item-1', queryTime: null, value: { x: 1 }, trackedInstant: '2024-01-01T00:00:00Z' };
    (southCacheRepository.getItemLastValue as jest.Mock).mockReturnValueOnce(value);
    const result = service.getItemLastValue('conn-1', 'item-1');
    expect(southCacheRepository.getItemLastValue).toHaveBeenCalledWith('conn-1', 'item-1');
    expect(result).toEqual(value);
  });

  it('should get all item values', () => {
    const values = [
      { itemId: 'item-1', queryTime: null, value: null, trackedInstant: '2024-01-01T00:00:00Z' },
      { itemId: 'item-2', queryTime: null, value: null, trackedInstant: '2024-01-02T00:00:00Z' }
    ];
    (southCacheRepository.getAllItemValues as jest.Mock).mockReturnValueOnce(values);
    const result = service.getAllItemValues('conn-1');
    expect(southCacheRepository.getAllItemValues).toHaveBeenCalledWith('conn-1');
    expect(result).toEqual(values);
  });

  it('should save item last value', () => {
    const value = { itemId: 'item-1', queryTime: null, value: { x: 1 }, trackedInstant: '2024-01-01T00:00:00Z' };
    service.saveItemLastValue('conn-1', value);
    expect(southCacheRepository.saveItemLastValue).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.saveItemLastValue).toHaveBeenCalledWith('conn-1', value);
  });

  it('should delete item value', () => {
    service.deleteItemValue('conn-1', 'item-1');
    expect(southCacheRepository.deleteItemValue).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.deleteItemValue).toHaveBeenCalledWith('conn-1', 'item-1');
  });

  it('should drop item value table', () => {
    service.dropItemValueTable('conn-1');
    expect(southCacheRepository.dropItemValueTable).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.dropItemValueTable).toHaveBeenCalledWith('conn-1');
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
