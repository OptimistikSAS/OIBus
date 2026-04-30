import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import SouthCacheRepository from './south-cache.repository';

describe('SouthCacheRepository', () => {
  let repository: SouthCacheRepository;
  let runMock: ReturnType<typeof mock.fn>;
  let getMock: ReturnType<typeof mock.fn>;
  let allMock: ReturnType<typeof mock.fn>;
  let prepareMock: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    runMock = mock.fn();
    getMock = mock.fn();
    allMock = mock.fn();
    prepareMock = mock.fn(() => ({ run: runMock, get: getMock, all: allMock }));
    const mockDatabase = { prepare: prepareMock, run: runMock, get: getMock, all: allMock };
    repository = new SouthCacheRepository(mockDatabase as unknown as Database);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('createItemValueTable() should create table with correct schema', () => {
    repository.createItemValueTable('south1');
    assert.ok(prepareMock.mock.calls.some(c => (c.arguments[0] as string).includes('south_item_cache_south1')));
    assert.ok(runMock.mock.calls.length > 0);
  });

  it('dropItemValueTable() should drop table', () => {
    repository.dropItemValueTable('south1');
    assert.deepStrictEqual(prepareMock.mock.calls[0].arguments, ['DROP TABLE IF EXISTS "south_item_cache_south1";']);
    assert.ok(runMock.mock.calls.length > 0);
  });

  describe('getItemLastValue', () => {
    it('should return null if result is undefined', () => {
      getMock.mock.mockImplementationOnce(() => undefined);
      const result = repository.getItemLastValue('south1', 'group1', 'item1');
      assert.strictEqual(result, null);
    });

    it('should return parsed value', () => {
      getMock.mock.mockImplementationOnce(() => ({
        item_id: 'item1',
        query_time: '2023-01-01',
        value: '{"a":1}',
        tracked_instant: '2023-01-01'
      }));
      const result = repository.getItemLastValue('south1', 'group1', 'item1');
      assert.deepStrictEqual(result, {
        itemId: 'item1',
        groupId: null,
        queryTime: '2023-01-01',
        value: { a: 1 },
        trackedInstant: '2023-01-01'
      });
    });

    it('should return raw value if parse fails', () => {
      getMock.mock.mockImplementationOnce(() => ({
        item_id: 'item1',
        value: 'invalid-json'
      }));
      const result = repository.getItemLastValue('south1', 'group1', 'item1');
      assert.strictEqual(result?.value, 'invalid-json');
    });

    it('should return null on db error', () => {
      prepareMock.mock.mockImplementationOnce(() => {
        throw new Error('DB Error');
      });
      const result = repository.getItemLastValue('south1', 'group1', 'item1');
      assert.strictEqual(result, null);
    });
  });

  describe('saveItemLastValue', () => {
    it('should insert if not exists', () => {
      getMock.mock.mockImplementationOnce(() => undefined);
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: 1, trackedInstant: 'now', queryTime: 'now' });
      assert.ok(prepareMock.mock.calls.some(c => (c.arguments[0] as string).includes('INSERT INTO')));
    });

    it('should update if exists with group id', () => {
      getMock.mock.mockImplementationOnce(() => ({}));
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: 1, trackedInstant: 'now', queryTime: 'now' });
      assert.ok(
        prepareMock.mock.calls.some(c =>
          (c.arguments[0] as string).includes(
            'UPDATE "south_item_cache_south1" SET query_time = ?, value = ?, tracked_instant = ? WHERE item_id = ? AND group_id = ?'
          )
        )
      );
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['now', '1', 'now', 'item1', 'group1']);
    });

    it('should update with IS NULL when group id is null', () => {
      getMock.mock.mockImplementationOnce(() => ({}));
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: null, value: 1, trackedInstant: 'now', queryTime: 'now' });
      assert.ok(
        prepareMock.mock.calls.some(c =>
          (c.arguments[0] as string).includes(
            'UPDATE "south_item_cache_south1" SET query_time = ?, value = ?, tracked_instant = ? WHERE item_id = ? AND group_id IS NULL'
          )
        )
      );
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['now', '1', 'now', 'item1']);
    });

    it('should store null when value is null', () => {
      getMock.mock.mockImplementationOnce(() => undefined);
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: null, trackedInstant: 'now', queryTime: 'now' });
      // prepareMock calls: [0] = SELECT (getItemLastValue), [1] = INSERT
      // runMock calls: [0] = INSERT run args
      const insertCall = prepareMock.mock.calls.find(c => (c.arguments[0] as string).includes('INSERT INTO'));
      assert.ok(insertCall, 'INSERT INTO query not found');
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['group1', 'item1', 'now', null, 'now']);
    });
  });

  describe('deleteItemValue', () => {
    it('should delete item with group id', () => {
      repository.deleteItemValue('south1', 'group1', 'item1');
      assert.ok(
        prepareMock.mock.calls.some(c =>
          (c.arguments[0] as string).includes('DELETE FROM "south_item_cache_south1" WHERE item_id = ? AND group_id = ?')
        )
      );
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['item1', 'group1']);
    });

    it('should delete item without group id using IS NULL', () => {
      repository.deleteItemValue('south1', null, 'item1');
      assert.ok(
        prepareMock.mock.calls.some(c =>
          (c.arguments[0] as string).includes('DELETE FROM "south_item_cache_south1" WHERE item_id = ? AND group_id IS NULL')
        )
      );
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['item1']);
    });

    it('should catch error', () => {
      prepareMock.mock.mockImplementationOnce(() => {
        throw new Error('DB Error');
      });
      assert.doesNotThrow(() => repository.deleteItemValue('south1', 'group1', 'item1'));
    });
  });
});
