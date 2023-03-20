import SqliteDatabaseMock, { run, get, all } from '../tests/__mocks__/database.mock';
import { generateRandomId } from '../service/utils';
import SouthItemRepository from './south-item.repository';
import { OibusItemCommandDTO, OibusItemDTO } from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import { Database } from 'better-sqlite3';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: SouthItemRepository;
describe('South item repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new SouthItemRepository(database);
  });

  it('should properly init south scan table', () => {
    expect(database.prepare).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS south_item (id TEXT PRIMARY KEY, connector_id TEXT, scan_mode_id TEXT, name TEXT, ' +
        'settings TEXT, FOREIGN KEY(connector_id) REFERENCES south_connector(id), ' +
        'FOREIGN KEY(scan_mode_id) REFERENCES scan_mode(id));'
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should properly search south items', () => {
    const expectedValue: Page<OibusItemDTO> = {
      content: [
        {
          id: 'id1',
          name: 'my south scan',
          connectorId: 'south1',
          scanModeId: 'scanMode1',
          settings: {}
        },
        {
          id: 'id2',
          name: 'my second south scan',
          connectorId: 'south1',
          scanModeId: 'scan1',
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
        name: 'my south scan',
        connectorId: 'south1',
        scanModeId: 'scanMode1',
        settings: JSON.stringify({})
      },
      {
        id: 'id2',
        name: 'my second south scan',
        connectorId: 'south1',
        scanModeId: 'scan1',
        settings: JSON.stringify({})
      }
    ]);
    get.mockReturnValueOnce({ count: 2 });
    const southScans = repository.searchSouthItems('southId', {
      page: 0,
      name: 'my item'
    });
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM south_item WHERE ' +
        "connector_id = ? AND name like '%my item%' LIMIT 50 OFFSET 0;"
    );
    expect(southScans).toEqual(expectedValue);
  });

  it('should properly get south items by South ID', () => {
    const expectedValue: Array<OibusItemDTO> = [
      {
        id: 'id1',
        name: 'my south scan',
        connectorId: 'south1',
        scanModeId: 'scanMode1',
        settings: {}
      },
      {
        id: 'id2',
        name: 'my second south scan',
        connectorId: 'south1',
        scanModeId: 'scan1',
        settings: {}
      }
    ];
    all.mockReturnValueOnce([
      {
        id: 'id1',
        name: 'my south scan',
        connectorId: 'south1',
        scanModeId: 'scanMode1',
        settings: JSON.stringify({})
      },
      {
        id: 'id2',
        name: 'my second south scan',
        connectorId: 'south1',
        scanModeId: 'scan1',
        settings: JSON.stringify({})
      }
    ]);
    const southScans = repository.getSouthItems('southId');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM south_item WHERE connector_id = ?;'
    );
    expect(southScans).toEqual(expectedValue);
  });

  it('should properly get a south item', () => {
    const expectedValue: OibusItemDTO = {
      id: 'id1',
      name: 'southScan1',
      connectorId: 'southId',
      scanModeId: 'scanModeId',
      settings: {}
    };
    get.mockReturnValueOnce({
      id: 'id1',
      name: 'southScan1',
      connectorId: 'southId',
      scanModeId: 'scanModeId',
      settings: JSON.stringify({})
    });
    const southScan = repository.getSouthItem('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM south_item WHERE id = ?;'
    );
    expect(get).toHaveBeenCalledWith('id1');
    expect(southScan).toEqual(expectedValue);
  });

  it('should create a south item', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce({ settings: '{}' });

    const command: OibusItemCommandDTO = {
      name: 'southScan1',
      scanModeId: 'scanModeId',
      settings: {}
    };
    repository.createSouthItem('southId', command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      'INSERT INTO south_item (id, name, connector_id, scan_mode_id, settings) VALUES (?, ?, ?, ?, ?);'
    );
    expect(run).toHaveBeenCalledWith('123456', command.name, 'southId', command.scanModeId, JSON.stringify(command.settings));
    expect(get).toHaveBeenCalledWith(1);

    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM south_item WHERE ROWID = ?;'
    );
  });

  it('should update a south item', () => {
    const command: OibusItemCommandDTO = {
      name: 'southScan1',
      scanModeId: 'scanModeId',
      settings: {}
    };
    repository.updateSouthItem('id1', command);
    expect(database.prepare).toHaveBeenCalledWith('UPDATE south_item SET name = ?, scan_mode_id = ?, settings = ? WHERE id = ?;');
    expect(run).toHaveBeenCalledWith(command.name, command.scanModeId, JSON.stringify(command.settings), 'id1');
  });

  it('should delete a south item', () => {
    repository.deleteSouthItem('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM south_item WHERE id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });

  it('should delete all south items associated to a connector id', () => {
    repository.deleteSouthItemByConnectorId('connectorId');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM south_item WHERE connector_id = ?;');
    expect(run).toHaveBeenCalledWith('connectorId');
  });
});
