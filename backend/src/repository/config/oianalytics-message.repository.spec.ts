import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import OIAnalyticsMessageRepository from './oianalytics-message.repository';
import { createPageFromArray } from '../../../shared/model/types';

const TEST_DB_PATH = 'src/tests/test-config-message.db';

let database: Database;
describe('OIAnalyticsMessageRepository', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: OIAnalyticsMessageRepository;
  let createdId: string;
  let createdHistoryQueriesId: string;

  beforeEach(() => {
    repository = new OIAnalyticsMessageRepository(database);
  });

  it('should properly find by id', () => {
    assert.deepStrictEqual(
      stripAuditFields(repository.findById(testData.oIAnalytics.messages.oIBusList[0].id)),
      stripAuditFields(testData.oIAnalytics.messages.oIBusList[0])
    );
    assert.strictEqual(repository.findById('badId'), null);
  });

  it('should properly get messages page by search criteria', () => {
    const filteredResult = repository.search(
      {
        types: ['full-config'],
        status: ['PENDING'],
        start: testData.constants.dates.JANUARY_1ST_2020_UTC,
        end: testData.constants.dates.FAKE_NOW_IN_FUTURE
      },
      0
    );
    assert.deepStrictEqual(
      { ...filteredResult, content: filteredResult.content.map(stripAuditFields) },
      createPageFromArray(
        testData.oIAnalytics.messages.oIBusList
          .filter(element => ['full-config'].includes(element.type) && ['PENDING'].includes(element.status))
          .map(stripAuditFields),
        50,
        0
      )
    );

    const allResult = repository.search({ types: [], status: [], start: undefined, end: undefined }, 0);
    assert.deepStrictEqual(
      { ...allResult, content: allResult.content.map(stripAuditFields) },
      createPageFromArray(testData.oIAnalytics.messages.oIBusList.map(stripAuditFields), 50, 0)
    );
  });

  it('should properly get messages list by search criteria', () => {
    assert.deepStrictEqual(
      repository
        .list({
          types: ['full-config'],
          status: ['PENDING'],
          start: testData.constants.dates.JANUARY_1ST_2020_UTC,
          end: testData.constants.dates.FAKE_NOW_IN_FUTURE
        })
        .map(stripAuditFields),
      testData.oIAnalytics.messages.oIBusList
        .filter(element => ['full-config'].includes(element.type) && ['PENDING'].includes(element.status))
        .map(stripAuditFields)
    );
    assert.deepStrictEqual(
      repository.list({ types: [], status: [], start: undefined, end: undefined }).map(stripAuditFields),
      testData.oIAnalytics.messages.oIBusList.map(stripAuditFields)
    );
  });

  it('should create full-config message', () => {
    repository.create({ type: 'full-config' });
    const allMessages = repository.list({ types: ['full-config'], status: ['PENDING'], start: undefined, end: undefined });
    const newMessage = allMessages.find(m => !testData.oIAnalytics.messages.oIBusList.some(existing => existing.id === m.id));
    assert.ok(newMessage);
    createdId = newMessage.id;

    assert.deepStrictEqual(stripAuditFields(repository.findById(createdId)), {
      id: createdId,
      type: 'full-config',
      status: 'PENDING',
      error: null,
      completedDate: null
    });
  });

  it('should create history-queries message', () => {
    repository.create({ type: 'history-queries' });
    const allMessages = repository.list({ types: ['history-queries'], status: ['PENDING'], start: undefined, end: undefined });
    const newMessage = allMessages.find(m => !testData.oIAnalytics.messages.oIBusList.some(existing => existing.id === m.id));
    assert.ok(newMessage);
    createdHistoryQueriesId = newMessage.id;

    assert.deepStrictEqual(stripAuditFields(repository.findById(createdHistoryQueriesId)), {
      id: createdHistoryQueriesId,
      type: 'history-queries',
      status: 'PENDING',
      error: null,
      completedDate: null
    });
  });

  it('should mark a command as COMPLETED', () => {
    repository.markAsCompleted(testData.oIAnalytics.messages.oIBusList[0].id, testData.constants.dates.FAKE_NOW);

    assert.deepStrictEqual(
      stripAuditFields(repository.findById(testData.oIAnalytics.messages.oIBusList[0].id)),
      stripAuditFields({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.messages.oIBusList[0])),
        status: 'COMPLETED',
        completedDate: testData.constants.dates.FAKE_NOW
      })
    );
  });

  it('should mark a command as ERRORED', () => {
    repository.markAsErrored(testData.oIAnalytics.messages.oIBusList[0].id, testData.constants.dates.FAKE_NOW, 'not ok');

    assert.deepStrictEqual(
      stripAuditFields(repository.findById(testData.oIAnalytics.messages.oIBusList[0].id)),
      stripAuditFields({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.messages.oIBusList[0])),
        status: 'ERRORED',
        completedDate: testData.constants.dates.FAKE_NOW,
        error: 'not ok'
      })
    );
  });

  it('should properly delete new message', () => {
    assert.notStrictEqual(repository.findById(createdId), null);
    repository.delete(createdId);
    assert.strictEqual(repository.findById(createdId), null);
  });
});
