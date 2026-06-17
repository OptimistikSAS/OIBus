import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import LogRepository from './log.repository';
import testData from '../../tests/utils/test-data';
import { createPageFromArray } from '../../../shared/model/types';

let database: Database;
describe('Repository with populated database', () => {
  before(async () => {
    database = await initDatabase('logs');
  });

  after(async () => {
    database.close();
    await emptyDatabase('logs');
  });

  describe('Logs', () => {
    let repository: LogRepository;

    beforeEach(() => {
      repository = new LogRepository(database);
    });

    it('should save all logs and search them', () => {
      repository.saveAll(
        testData.logs.list.map(log => {
          let pinoLevel: string;
          switch (log.level) {
            case 'trace':
              pinoLevel = '10';
              break;
            case 'debug':
              pinoLevel = '20';
              break;
            case 'info':
              pinoLevel = '30';
              break;
            case 'warn':
              pinoLevel = '40';
              break;
            case 'error':
              pinoLevel = '50';
              break;
            default:
              pinoLevel = '20';
              break;
          }

          return {
            msg: log.message,
            scopeType: log.scopeType,
            scopeId: log.scopeId,
            scopeName: log.scopeName,
            time: log.timestamp,
            level: pinoLevel
          };
        })
      );
      repository.saveAll([]);

      assert.deepStrictEqual(
        repository.search({
          levels: [testData.logs.list[0].level],
          scopeIds: [testData.logs.list[0].scopeId as string],
          scopeTypes: [testData.logs.list[0].scopeType],
          itemIds: [],
          messageContent: 'message',
          page: 0,
          start: testData.constants.dates.DATE_1,
          end: testData.constants.dates.DATE_2
        }),
        createPageFromArray([testData.logs.list[0]], 50, 0)
      );

      assert.strictEqual(repository.count(), testData.logs.list.length);

      assert.strictEqual(
        repository.search({
          levels: [],
          scopeIds: [],
          scopeTypes: ['internal'],
          itemIds: [],
          messageContent: '',
          page: 0,
          start: testData.constants.dates.DATE_1,
          end: testData.constants.dates.DATE_2
        }).totalElements,
        1
      );

      assert.strictEqual(
        repository.search({
          levels: [],
          scopeIds: [],
          scopeTypes: [],
          itemIds: [],
          messageContent: '',
          page: 0,
          start: testData.constants.dates.DATE_1,
          end: testData.constants.dates.DATE_2
        }).totalElements,
        4
      );
    });

    it('should delete logs', () => {
      const deletedCount = repository.delete(1);
      assert.strictEqual(deletedCount, 1);
      assert.strictEqual(repository.count(), testData.logs.list.length - 1);

      repository.deleteLogsByScopeId('south', testData.logs.list[0].scopeId as string);
      assert.strictEqual(repository.count(), testData.logs.list.length - 2);

      // No vacuum() / incrementalVacuum() to assert here — the v3.8.0 logs
      // migration sets `auto_vacuum = FULL`, so SQLite reclaims free pages
      // itself as part of the DELETE transaction. The repository no longer
      // exposes any vacuum API.
    });

    it('should search scopes and find by id', () => {
      const result = repository.suggestScopes(testData.logs.list[2].scopeName as string);
      assert.deepStrictEqual(result, [{ scopeId: testData.logs.list[2].scopeId, scopeName: testData.logs.list[2].scopeName }]);

      const scope = repository.getScopeById(testData.logs.list[2].scopeId as string);
      assert.deepStrictEqual(scope, { scopeId: testData.logs.list[2].scopeId, scopeName: testData.logs.list[2].scopeName });

      assert.strictEqual(repository.getScopeById('bad id'), null);
    });

    it('should search items and find by id', () => {
      repository.saveAll([
        {
          msg: 'item log',
          scopeType: 'south',
          scopeId: 'south-1',
          scopeName: 'South 1',
          itemId: 'item-abc',
          itemName: 'Temperature Sensor',
          time: testData.constants.dates.DATE_1,
          level: '30'
        },
        {
          msg: 'another item log',
          scopeType: 'south',
          scopeId: 'south-1',
          scopeName: 'South 1',
          itemId: 'item-def',
          itemName: 'Pressure Gauge',
          time: testData.constants.dates.DATE_1,
          level: '30'
        }
      ]);

      const suggestions = repository.suggestItems('Sensor');
      assert.deepStrictEqual(suggestions, [{ itemId: 'item-abc', itemName: 'Temperature Sensor' }]);

      const allItems = repository.suggestItems('');
      assert.strictEqual(allItems.length, 2);

      const found = repository.getItemById('item-abc');
      assert.deepStrictEqual(found, { itemId: 'item-abc', itemName: 'Temperature Sensor' });

      assert.strictEqual(repository.getItemById('bad-id'), null);
    });

    it('should filter search results by itemIds', () => {
      repository.saveAll([
        {
          msg: 'item log',
          scopeType: 'south',
          scopeId: 'south-x',
          scopeName: 'South X',
          itemId: 'item-xyz',
          itemName: 'Flow Meter',
          time: testData.constants.dates.DATE_1,
          level: '30'
        }
      ]);

      const result = repository.search({
        levels: [],
        scopeIds: [],
        scopeTypes: [],
        itemIds: ['item-xyz'],
        messageContent: '',
        page: 0,
        start: testData.constants.dates.DATE_1,
        end: testData.constants.dates.DATE_2
      });

      assert.strictEqual(result.totalElements, 1);
      assert.strictEqual(result.content[0].itemId, 'item-xyz');
      assert.strictEqual(result.content[0].itemName, 'Flow Meter');
    });
  });
});
