import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toHistoryQueryItemDTO } from './history-query-item-dto.utils';
import testData from '../tests/utils/test-data';
import { GetUserInfo } from '../../shared/model/types';
import { HistoryQueryItemEntity } from '../model/histor-query.model';
import { SouthItemSettings } from '../../shared/model/south-settings.model';

const getUserInfo: GetUserInfo = (id: string) => ({ id, friendlyName: id });

describe('history-query-item-dto utils', () => {
  describe('toHistoryQueryItemDTO', () => {
    it('should map a history query item to its DTO for a given south type', () => {
      const historyQueryItem = testData.historyQueries.list[0].items[0] as HistoryQueryItemEntity<SouthItemSettings>;
      const southType = testData.historyQueries.list[0].southType;

      const result = toHistoryQueryItemDTO(historyQueryItem, southType, getUserInfo);

      assert.strictEqual(result.id, historyQueryItem.id);
      assert.strictEqual(result.name, historyQueryItem.name);
      assert.strictEqual(result.enabled, historyQueryItem.enabled);
      assert.deepStrictEqual(result.createdBy, getUserInfo(historyQueryItem.createdBy));
      assert.deepStrictEqual(result.updatedBy, getUserInfo(historyQueryItem.updatedBy));
      assert.strictEqual(result.createdAt, historyQueryItem.createdAt);
      assert.strictEqual(result.updatedAt, historyQueryItem.updatedAt);
    });

    it('should map a disabled history query item, filtering secrets from its settings', () => {
      const historyQueryItem = testData.historyQueries.list[0].items[1] as HistoryQueryItemEntity<SouthItemSettings>;
      const disabledItem: HistoryQueryItemEntity<SouthItemSettings> = { ...historyQueryItem, enabled: false };
      const southType = testData.historyQueries.list[0].southType;

      const result = toHistoryQueryItemDTO(disabledItem, southType, getUserInfo);

      assert.strictEqual(result.id, disabledItem.id);
      assert.strictEqual(result.enabled, false);
      assert.notStrictEqual(result.settings, undefined);
    });
  });
});
