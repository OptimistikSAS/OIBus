import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { generateRandomId } from '../service/utils';
import { OibusItemCommandDTO, OibusItemDTO } from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import { Database } from 'better-sqlite3';
import HistoryQueryItemRepository from './history-query-item.repository';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: HistoryQueryItemRepository;
describe('History query item repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new HistoryQueryItemRepository(database);
  });

  it('should properly init history query item table', () => {
    expect(database.prepare).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS history_item (id TEXT PRIMARY KEY, history_id TEXT, name TEXT, ' +
        'settings TEXT, FOREIGN KEY(history_id) REFERENCES history_queries(id));'
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should properly search history query items', () => {
    const expectedValue: Page<OibusItemDTO> = {
      content: [
        {
          id: 'id1',
          name: 'my history query item',
          connectorId: 'historyId',
          settings: {}
        },
        {
          id: 'id2',
          name: 'my second history query item',
          connectorId: 'historyId',
          settings: {}
        }
      ],
      size: 50,
      number: 0,
      totalElements: 2,
      totalPages: 1
    };
    all.mockReturnValueOnce([
      {
        id: 'id1',
        name: 'my history query item',
        historyId: 'historyId',
        settings: JSON.stringify({})
      },
      {
        id: 'id2',
        name: 'my second history query item',
        historyId: 'historyId',
        settings: JSON.stringify({})
      }
    ]);
    get.mockReturnValueOnce({ count: 2 });
    const southScans = repository.searchHistoryItems('historyId', {
      page: 0,
      name: 'my item'
    });
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, history_id AS historyId, settings FROM history_item WHERE ' +
        "history_id = ? AND name like '%my item%' LIMIT 50 OFFSET 0;"
    );
    expect(southScans).toEqual(expectedValue);
  });

  it('should properly get history query items by History query ID', () => {
    const expectedValue: Array<OibusItemDTO> = [
      {
        id: 'id1',
        name: 'my history query item',
        connectorId: 'historyId',
        settings: {}
      },
      {
        id: 'id2',
        name: 'my second history query item',
        connectorId: 'historyId',
        settings: {}
      }
    ];
    all.mockReturnValueOnce([
      {
        id: 'id1',
        name: 'my history query item',
        historyId: 'historyId',
        scanModeId: 'scanMode1',
        settings: JSON.stringify({})
      },
      {
        id: 'id2',
        name: 'my second history query item',
        historyId: 'historyId',
        scanModeId: 'scan1',
        settings: JSON.stringify({})
      }
    ]);
    const southScans = repository.getHistoryItems('historyId');
    expect(database.prepare).toHaveBeenCalledWith('SELECT id, name, settings FROM history_item WHERE history_id = ?;');
    expect(southScans).toEqual(expectedValue);
  });

  it('should properly get a history query item', () => {
    const expectedValue: OibusItemDTO = {
      id: 'id1',
      name: 'historyItem1',
      connectorId: 'historyId',
      settings: {}
    };
    get.mockReturnValueOnce({
      id: 'id1',
      name: 'historyItem1',
      historyId: 'historyId',
      settings: JSON.stringify({})
    });
    const southScan = repository.getHistoryItem('id1');
    expect(database.prepare).toHaveBeenCalledWith('SELECT id, name, history_id AS historyId, settings FROM history_item WHERE id = ?;');
    expect(get).toHaveBeenCalledWith('id1');
    expect(southScan).toEqual(expectedValue);
  });

  it('should create a history query item', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce({ settings: '{}' });

    const command: OibusItemCommandDTO = {
      name: 'historyItem1',
      scanModeId: null,
      settings: {}
    };
    repository.createHistoryItem('historyId', command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith('INSERT INTO history_item (id, name, history_id, settings) VALUES (?, ?, ?, ?);');
    expect(run).toHaveBeenCalledWith('123456', command.name, 'historyId', JSON.stringify(command.settings));
    expect(get).toHaveBeenCalledWith(1);

    expect(database.prepare).toHaveBeenCalledWith('SELECT id, name, history_id AS historyId, settings FROM history_item WHERE ROWID = ?;');
  });

  it('should update a history query item', () => {
    const command: OibusItemCommandDTO = {
      name: 'historyItem1',
      scanModeId: null,
      settings: {}
    };
    repository.updateHistoryItem('id1', command);
    expect(database.prepare).toHaveBeenCalledWith('UPDATE history_item SET name = ?, settings = ? WHERE id = ?;');
    expect(run).toHaveBeenCalledWith(command.name, JSON.stringify(command.settings), 'id1');
  });

  it('should delete a history query item', () => {
    repository.deleteHistoryItem('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM history_item WHERE id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });

  it('should delete all history query items associated to a history id', () => {
    repository.deleteHistoryItemByHistoryId('historyId');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM history_item WHERE history_id = ?;');
    expect(run).toHaveBeenCalledWith('historyId');
  });
});
