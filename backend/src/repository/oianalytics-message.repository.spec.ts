import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';
import OianalyticsMessageRepository from './oianalytics-message.repository';
import { Page } from '../../../shared/model/types';
import { InfoMessageContent, OIAnalyticsMessageCommand, OIAnalyticsMessageDTO } from '../../../shared/model/oianalytics-message.model';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));
const nowDateString = '2020-02-02T02:02:02.222Z';

const existingMessage: OIAnalyticsMessageDTO = {
  id: '1234',
  status: 'ERRORED',
  type: 'INFO',
  content: {} as InfoMessageContent
};

let database: Database;
let repository: OianalyticsMessageRepository;
describe('OIAnalytics Message repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    all.mockReturnValue([existingMessage]);
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new OianalyticsMessageRepository(database);
  });

  it('should create message', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce({ ...existingMessage, content: '{}' });
    const command: OIAnalyticsMessageCommand = {
      type: 'INFO',
      content: {} as InfoMessageContent
    };
    repository.createOIAnalyticsMessages(command);
    expect(database.prepare).toHaveBeenCalledWith('INSERT INTO oianalytics_messages (id, type, status, content) VALUES (?, ?, ?, ?);');
    expect(run).toHaveBeenCalledWith('123456', command.type, 'PENDING', JSON.stringify(command.content));
  });

  it('should update message', () => {
    const command: OIAnalyticsMessageCommand = {
      type: 'INFO',
      content: {} as InfoMessageContent
    };
    repository.updateOIAnalyticsMessages('id', command);
    expect(database.prepare).toHaveBeenCalledWith('UPDATE oianalytics_messages SET content = ? WHERE id = ?;');
    expect(run).toHaveBeenCalledWith(JSON.stringify(command.content), 'id');
  });

  it('should properly get messages page by search criteria', () => {
    const expectedValue: Page<OIAnalyticsMessageDTO> = {
      content: [
        {
          id: '1234',
          creationDate: '2023-01-01T00:00:00.000Z',
          type: 'INFO',
          status: 'PENDING',
          content: {} as InfoMessageContent
        },
        {
          id: '1234',
          creationDate: '2024-01-01T00:00:00.000Z',
          type: 'INFO',
          status: 'ERRORED',
          content: {} as InfoMessageContent
        }
      ],
      size: 50,
      number: 0,
      totalElements: 2,
      totalPages: 1
    };
    all.mockReturnValueOnce([
      {
        id: '1234',
        creationDate: '2023-01-01T00:00:00.000Z',
        type: 'INFO',
        status: 'PENDING',
        content: '{}'
      },
      {
        id: '1234',
        creationDate: '2024-01-01T00:00:00.000Z',
        type: 'INFO',
        status: 'ERRORED',
        content: '{}'
      }
    ]);
    get.mockReturnValueOnce({ count: 2 });
    const logs = repository.searchMessagesPage(
      {
        types: ['INFO'],
        status: ['PENDING', 'ERRORED'],
        start: '2023-01-01T00:00:00.000Z',
        end: '2023-01-02T00:00:00.000Z'
      },
      0
    );
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, created_at as creationDate, completed_date as compeltedDate, type, status, error, content FROM oianalytics_messages WHERE id IS NOT NULL ' +
        'AND type IN (?) AND status IN (?,?) AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC LIMIT 50 OFFSET ?;'
    );
    expect(logs).toEqual(expectedValue);

    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT COUNT(*) as count FROM oianalytics_messages WHERE id IS NOT NULL AND type IN (?) AND status IN (?,?) AND created_at >= ? AND created_at <= ?;'
    );
  });

  it('should properly get messages list by search criteria', () => {
    const expectedValue: Array<OIAnalyticsMessageDTO> = [
      {
        id: '1234',
        creationDate: '2023-01-01T00:00:00.000Z',
        type: 'INFO',
        status: 'PENDING',
        content: {} as InfoMessageContent
      },
      {
        id: '1234',
        creationDate: '2024-01-01T00:00:00.000Z',
        type: 'INFO',
        status: 'ERRORED',
        content: {} as InfoMessageContent
      }
    ];
    all.mockReturnValueOnce([
      {
        id: '1234',
        creationDate: '2023-01-01T00:00:00.000Z',
        type: 'INFO',
        status: 'PENDING',
        content: '{}'
      },
      {
        id: '1234',
        creationDate: '2024-01-01T00:00:00.000Z',
        type: 'INFO',
        status: 'ERRORED',
        content: '{}'
      }
    ]);
    const messages = repository.searchMessagesList({
      types: ['INFO'],
      status: ['PENDING', 'ERRORED'],
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z'
    });
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, created_at as creationDate, completed_date as compeltedDate, type, status, error, content FROM oianalytics_messages WHERE id IS NOT NULL ' +
        'AND type IN (?) AND status IN (?,?) AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC;'
    );
    expect(messages).toEqual(expectedValue);
  });

  it('should mark a command as COMPLETED', () => {
    repository.markAsCompleted('id1', nowDateString);
    const query = `UPDATE oianalytics_messages SET status = 'COMPLETED', completed_date = ? WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith(nowDateString, 'id1');
  });

  it('should mark a command as ERRORED', () => {
    repository.markAsErrored('id1', nowDateString, 'not ok');
    const query = `UPDATE oianalytics_messages SET status = 'ERRORED', completed_date = ?, error = ? WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith(nowDateString, 'not ok', 'id1');
  });
});
