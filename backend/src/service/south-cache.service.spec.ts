import SouthCacheService from './south-cache.service';

import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
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

  it('should create item value table', () => {
    service.createItemValueTable('conn-1');
    expect(southCacheRepository.createItemValueTable).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.createItemValueTable).toHaveBeenCalledWith('conn-1');
  });

  it('should get item last value', () => {
    const value = { itemId: 'item-1', queryTime: null, value: { x: 1 }, trackedInstant: '2024-01-01T00:00:00Z' };
    (southCacheRepository.getItemLastValue as jest.Mock).mockReturnValueOnce(value);
    const result = service.getItemLastValue('conn-1', 'group-1', 'item-1');
    expect(southCacheRepository.getItemLastValue).toHaveBeenCalledWith('conn-1', 'group-1', 'item-1');
    expect(result).toEqual(value);
  });

  it('should save item last value', () => {
    const value = { itemId: 'item-1', groupId: 'group-1', queryTime: null, value: { x: 1 }, trackedInstant: '2024-01-01T00:00:00Z' };
    service.saveItemLastValue('conn-1', value);
    expect(southCacheRepository.saveItemLastValue).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.saveItemLastValue).toHaveBeenCalledWith('conn-1', value);
  });

  it('should delete item value', () => {
    service.deleteItemValue('conn-1', 'group-1', 'item-1');
    expect(southCacheRepository.deleteItemValue).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.deleteItemValue).toHaveBeenCalledWith('conn-1', 'group-1', 'item-1');
  });

  it('should drop item value table', () => {
    service.dropItemValueTable('conn-1');
    expect(southCacheRepository.dropItemValueTable).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.dropItemValueTable).toHaveBeenCalledWith('conn-1');
  });
});
