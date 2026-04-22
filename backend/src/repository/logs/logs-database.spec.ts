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
          messageContent: '',
          page: 0,
          start: testData.constants.dates.DATE_1,
          end: testData.constants.dates.DATE_2
        }).totalElements,
        4
      );
    });

    it('should delete logs', () => {
      repository.delete(1);
      assert.strictEqual(repository.count(), testData.logs.list.length - 1);

      repository.deleteLogsByScopeId('south', testData.logs.list[0].scopeId as string);
      assert.strictEqual(repository.count(), testData.logs.list.length - 2);

      repository.vacuum();
    });

    it('should search scopes and find by id', () => {
      const result = repository.suggestScopes(testData.logs.list[2].scopeName as string);
      assert.deepStrictEqual(result, [{ scopeId: testData.logs.list[2].scopeId, scopeName: testData.logs.list[2].scopeName }]);

      const scope = repository.getScopeById(testData.logs.list[2].scopeId as string);
      assert.deepStrictEqual(scope, { scopeId: testData.logs.list[2].scopeId, scopeName: testData.logs.list[2].scopeName });

      assert.strictEqual(repository.getScopeById('bad id'), null);
    });
  });
});
