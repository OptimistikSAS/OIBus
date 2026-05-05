import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import SouthCacheService from './south-cache.service';
import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import testData from '../tests/utils/test-data';

let southCacheRepository: SouthCacheRepositoryMock;
let service: SouthCacheService;

describe('South cache service', () => {
  beforeEach(() => {
    southCacheRepository = new SouthCacheRepositoryMock();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
    service = new SouthCacheService(southCacheRepository as unknown as SouthCacheRepository);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should create item value table', () => {
    service.createItemValueTable('conn-1');
    assert.strictEqual(southCacheRepository.createItemValueTable.mock.calls.length, 1);
    assert.deepStrictEqual(southCacheRepository.createItemValueTable.mock.calls[0].arguments, ['conn-1']);
  });

  it('should get item last value', () => {
    const value = { itemId: 'item-1', groupId: 'group-1', queryTime: null, value: { x: 1 }, trackedInstant: '2024-01-01T00:00:00Z' };
    southCacheRepository.getItemLastValue.mock.mockImplementationOnce(() => value);
    const result = service.getItemLastValue('conn-1', 'group-1', 'item-1');
    assert.deepStrictEqual(southCacheRepository.getItemLastValue.mock.calls[0].arguments, ['conn-1', 'group-1', 'item-1']);
    assert.deepStrictEqual(result, value);
  });

  it('should save item last value', () => {
    const value = { itemId: 'item-1', groupId: 'group-1', queryTime: null, value: { x: 1 }, trackedInstant: '2024-01-01T00:00:00Z' };
    service.saveItemLastValue('conn-1', value);
    assert.strictEqual(southCacheRepository.saveItemLastValue.mock.calls.length, 1);
    assert.deepStrictEqual(southCacheRepository.saveItemLastValue.mock.calls[0].arguments, ['conn-1', value]);
  });

  it('should delete item value', () => {
    service.deleteItemValue('conn-1', 'group-1', 'item-1');
    assert.strictEqual(southCacheRepository.deleteItemValue.mock.calls.length, 1);
    assert.deepStrictEqual(southCacheRepository.deleteItemValue.mock.calls[0].arguments, ['conn-1', 'group-1', 'item-1']);
  });

  it('should drop item value table', () => {
    service.dropItemValueTable('conn-1');
    assert.strictEqual(southCacheRepository.dropItemValueTable.mock.calls.length, 1);
    assert.deepStrictEqual(southCacheRepository.dropItemValueTable.mock.calls[0].arguments, ['conn-1']);
  });
});
