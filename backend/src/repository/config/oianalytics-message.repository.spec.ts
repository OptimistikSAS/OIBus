import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import OIAnalyticsMessageRepository from './oianalytics-message.repository';
import { createPageFromArray } from '../../../shared/model/types';

jest.mock('../../service/utils');

const TEST_DB_PATH = 'src/tests/test-config-message.db';

let database: Database;
describe('OIAnalyticsMessageRepository', () => {
  beforeAll(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: OIAnalyticsMessageRepository;
  beforeEach(() => {
    jest.resetAllMocks();
    repository = new OIAnalyticsMessageRepository(database);
  });

  it('should properly find by id', () => {
    expect(stripAuditFields(repository.findById(testData.oIAnalytics.messages.oIBusList[0].id))).toEqual(
      stripAuditFields(testData.oIAnalytics.messages.oIBusList[0])
    );
    expect(repository.findById('badId')).toEqual(null);
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
    expect({
      ...filteredResult,
      content: filteredResult.content.map(stripAuditFields)
    }).toEqual(
      createPageFromArray(
        testData.oIAnalytics.messages.oIBusList
          .filter(element => ['full-config'].includes(element.type) && ['PENDING'].includes(element.status))
          .map(stripAuditFields),
        50,
        0
      )
    );

    const allResult = repository.search({ types: [], status: [], start: undefined, end: undefined }, 0);
    expect({
      ...allResult,
      content: allResult.content.map(stripAuditFields)
    }).toEqual(createPageFromArray(testData.oIAnalytics.messages.oIBusList.map(stripAuditFields), 50, 0));
  });

  it('should properly get messages list by search criteria', () => {
    expect(
      repository
        .list({
          types: ['full-config'],
          status: ['PENDING'],
          start: testData.constants.dates.JANUARY_1ST_2020_UTC,
          end: testData.constants.dates.FAKE_NOW_IN_FUTURE
        })
        .map(stripAuditFields)
    ).toEqual(
      testData.oIAnalytics.messages.oIBusList
        .filter(element => ['full-config'].includes(element.type) && ['PENDING'].includes(element.status))
        .map(stripAuditFields)
    );
    expect(repository.list({ types: [], status: [], start: undefined, end: undefined }).map(stripAuditFields)).toEqual(
      testData.oIAnalytics.messages.oIBusList.map(stripAuditFields)
    );
  });

  it('should create full-config message', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newId');

    repository.create({ type: 'full-config' });

    expect(stripAuditFields(repository.findById('newId'))).toEqual({
      id: 'newId',
      type: 'full-config',
      status: 'PENDING',
      error: null,
      completedDate: null
    });
  });

  it('should create history-queries message', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newHistoryQueriesId');

    repository.create({ type: 'history-queries' });

    expect(stripAuditFields(repository.findById('newHistoryQueriesId'))).toEqual({
      id: 'newHistoryQueriesId',
      type: 'history-queries',
      status: 'PENDING',
      error: null,
      completedDate: null
    });
  });

  it('should mark a command as COMPLETED', () => {
    repository.markAsCompleted(testData.oIAnalytics.messages.oIBusList[0].id, testData.constants.dates.FAKE_NOW);

    expect(stripAuditFields(repository.findById(testData.oIAnalytics.messages.oIBusList[0].id))).toEqual(
      stripAuditFields({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.messages.oIBusList[0])),
        status: 'COMPLETED',
        completedDate: testData.constants.dates.FAKE_NOW
      })
    );
  });

  it('should mark a command as ERRORED', () => {
    repository.markAsErrored(testData.oIAnalytics.messages.oIBusList[0].id, testData.constants.dates.FAKE_NOW, 'not ok');

    expect(stripAuditFields(repository.findById(testData.oIAnalytics.messages.oIBusList[0].id))).toEqual(
      stripAuditFields({
        ...JSON.parse(JSON.stringify(testData.oIAnalytics.messages.oIBusList[0])),
        status: 'ERRORED',
        completedDate: testData.constants.dates.FAKE_NOW,
        error: 'not ok'
      })
    );
  });

  it('should properly delete new message', () => {
    expect(repository.findById('newId')).not.toEqual(null);
    repository.delete('newId');
    expect(repository.findById('newId')).toEqual(null);
  });
});
