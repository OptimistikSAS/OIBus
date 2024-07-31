import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';
import OianalyticsMessageRepository, { OIAnalyticsMessageResult } from './oianalytics-message.repository';
import { Page } from '../../../shared/model/types';
import {
  OIAnalyticsMessage,
  OIAnalyticsMessageFullConfigCommandDTO,
  OIAnalyticsMessageInfoCommandDTO
} from '../../../shared/model/oianalytics-message.model';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));
const nowDateString = '2020-02-02T02:02:02.222Z';

const mockResults: Array<OIAnalyticsMessageResult> = [
  {
    id: 'id1',
    created_at: '2020-02-02T02:02:02.222Z',
    completed_date: '2020-02-02T02:02:02.222Z',
    type: 'info',
    status: 'PENDING',
    error: '',
    content: '{}'
  },
  {
    id: 'id2',
    created_at: '2020-02-02T02:02:02.222Z',
    completed_date: '2020-02-02T02:02:02.222Z',
    type: 'full-config',
    status: 'PENDING',
    error: '',
    content: ''
  }
];

let database: Database;
let repository: OianalyticsMessageRepository;
describe('OIAnalytics Message repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    all.mockReturnValue(mockResults);
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new OianalyticsMessageRepository(database);
  });

  it('should create INFO message', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce(mockResults[0]);

    repository.create({ type: 'info' } as OIAnalyticsMessageInfoCommandDTO);
    expect(database.prepare).toHaveBeenCalledWith('INSERT INTO oianalytics_messages (id, type, status) VALUES (?, ?, ?);');
    expect(run).toHaveBeenCalledWith('123456', 'info', 'PENDING');
  });

  it('should create FULL_CONFIG message', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce(mockResults[1]);

    repository.create({ type: 'full-config' } as OIAnalyticsMessageFullConfigCommandDTO);
    expect(database.prepare).toHaveBeenCalledWith('INSERT INTO oianalytics_messages (id, type, status) VALUES (?, ?, ?);');
    expect(run).toHaveBeenCalledWith('123456', 'full-config', 'PENDING');
  });

  it('should properly get messages page by search criteria', () => {
    const expectedValue: Page<OIAnalyticsMessage> = {
      content: [
        {
          id: 'id1',
          creationDate: '2020-02-02T02:02:02.222Z',
          completedDate: '2020-02-02T02:02:02.222Z',
          type: 'info',
          status: 'PENDING',
          error: ''
        },
        {
          id: 'id2',
          creationDate: '2020-02-02T02:02:02.222Z',
          completedDate: '2020-02-02T02:02:02.222Z',
          type: 'full-config',
          status: 'PENDING',
          error: ''
        }
      ],
      size: 50,
      number: 0,
      totalElements: 3,
      totalPages: 1
    };
    all.mockReturnValueOnce(mockResults);
    get.mockReturnValueOnce({ count: 3 });
    const messages = repository.search(
      {
        types: ['info'],
        status: ['PENDING', 'ERRORED'],
        start: '2023-01-01T00:00:00.000Z',
        end: '2023-01-02T00:00:00.000Z'
      },
      0
    );
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT * FROM oianalytics_messages WHERE id IS NOT NULL AND type IN (?) AND status IN (?,?) AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC LIMIT 50 OFFSET ?;'
    );
    expect(messages).toEqual(expectedValue);

    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT COUNT(*) as count FROM oianalytics_messages WHERE id IS NOT NULL AND type IN (?) AND status IN (?,?) AND created_at >= ? AND created_at <= ?;'
    );
  });

  it('should properly get messages list by search criteria', () => {
    const expectedValue: Array<OIAnalyticsMessage> = [
      {
        id: 'id1',
        creationDate: '2020-02-02T02:02:02.222Z',
        completedDate: '2020-02-02T02:02:02.222Z',
        type: 'info',
        status: 'PENDING',
        error: ''
      },
      {
        id: 'id2',
        creationDate: '2020-02-02T02:02:02.222Z',
        completedDate: '2020-02-02T02:02:02.222Z',
        type: 'full-config',
        status: 'PENDING',
        error: ''
      }
    ];
    all.mockReturnValueOnce(mockResults);
    const messages = repository.list({
      types: ['info'],
      status: ['PENDING', 'ERRORED'],
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z'
    });
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT * FROM oianalytics_messages WHERE id IS NOT NULL AND type IN (?) AND status IN (?,?) AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC;'
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
