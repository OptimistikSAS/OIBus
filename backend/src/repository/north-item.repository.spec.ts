import SqliteDatabaseMock, { run, get, all } from '../tests/__mocks__/database.mock';
import { generateRandomId } from '../service/utils';
import NorthItemRepository from './north-item.repository';
import { NorthConnectorItemCommandDTO, NorthConnectorItemDTO } from '../../../shared/model/north-connector.model';
import { Page } from '../../../shared/model/types';
import { Database } from 'better-sqlite3';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: NorthItemRepository;
describe('North item repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new NorthItemRepository(database);
  });

  it('should properly list north items with search params', () => {
    const expectedValue: Array<NorthConnectorItemDTO> = [
      {
        id: 'id1',
        name: 'my north scan',
        enabled: true,
        connectorId: 'north1',
        settings: {}
      },
      {
        id: 'id2',
        name: 'my second north scan',
        enabled: false,
        connectorId: 'north1',
        settings: {}
      }
    ];
    all.mockReturnValueOnce([
      {
        id: 'id1',
        name: 'my north scan',
        enabled: true,
        connectorId: 'north1',
        settings: JSON.stringify({})
      },
      {
        id: 'id2',
        name: 'my second north scan',
        enabled: false,
        connectorId: 'north1',
        settings: JSON.stringify({})
      }
    ]);
    const northItems = repository.listNorthItems('northId', { enabled: true });
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, enabled, connector_id AS connectorId, settings FROM north_items WHERE connector_id = ? AND enabled = ?;'
    );
    expect(northItems).toEqual(expectedValue);
  });

  it('should properly list north items with empty search params', () => {
    all.mockReturnValueOnce([]);
    repository.listNorthItems('northId', {});
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, enabled, connector_id AS connectorId, settings FROM north_items WHERE connector_id = ?;'
    );
  });

  it('should properly search north items', () => {
    const expectedValue: Page<NorthConnectorItemDTO> = {
      content: [
        {
          id: 'id1',
          name: 'my north scan',
          enabled: true,
          connectorId: 'north1',
          settings: {}
        },
        {
          id: 'id2',
          name: 'my second north scan',
          enabled: false,
          connectorId: 'north1',
          settings: {}
        }
      ],
      size: 50,
      number: 1,
      totalElements: 2,
      totalPages: 1
    };
    all.mockReturnValueOnce([
      {
        id: 'id1',
        name: 'my north scan',
        enabled: true,
        connectorId: 'north1',
        settings: JSON.stringify({})
      },
      {
        id: 'id2',
        name: 'my second north scan',
        enabled: false,
        connectorId: 'north1',
        settings: JSON.stringify({})
      }
    ]);
    get.mockReturnValueOnce({ count: 2 });
    const northItems = repository.searchNorthItems('northId', {
      page: 1,
      name: 'my item'
    });
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, enabled, connector_id AS connectorId, settings FROM north_items WHERE ' +
        "connector_id = ? AND name like '%' || ? || '%' LIMIT 50 OFFSET 50;"
    );
    expect(northItems).toEqual(expectedValue);
  });

  it('should properly search north items without page', () => {
    const expectedValue: Page<NorthConnectorItemDTO> = {
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    };
    all.mockReturnValueOnce([]);
    get.mockReturnValueOnce({ count: 0 });
    const northItems = repository.searchNorthItems('northId', {
      name: 'my item'
    });
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, enabled, connector_id AS connectorId, settings FROM north_items WHERE ' +
        "connector_id = ? AND name like '%' || ? || '%' LIMIT 50 OFFSET 0;"
    );
    expect(northItems).toEqual(expectedValue);
  });

  it('should properly get north items by North ID', () => {
    const expectedValue: Array<NorthConnectorItemDTO> = [
      {
        id: 'id1',
        name: 'my north scan',
        enabled: true,
        connectorId: 'north1',
        settings: {}
      },
      {
        id: 'id2',
        name: 'my second north scan',
        enabled: false,
        connectorId: 'north1',
        settings: {}
      }
    ];
    all.mockReturnValueOnce([
      {
        id: 'id1',
        name: 'my north scan',
        enabled: true,
        connectorId: 'north1',
        settings: JSON.stringify({})
      },
      {
        id: 'id2',
        name: 'my second north scan',
        enabled: false,
        connectorId: 'north1',
        settings: JSON.stringify({})
      }
    ]);
    const northItems = repository.getNorthItems('northId');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, enabled, connector_id AS connectorId, settings FROM north_items WHERE connector_id = ?;'
    );
    expect(northItems).toEqual(expectedValue);
  });

  it('should properly get a north item', () => {
    const expectedValue: NorthConnectorItemDTO = {
      id: 'id1',
      name: 'northScan1',
      enabled: true,
      connectorId: 'northId',
      settings: {}
    };
    get.mockReturnValueOnce({
      id: 'id1',
      name: 'northScan1',
      enabled: true,
      connectorId: 'northId',
      settings: JSON.stringify({})
    });
    const northScan = repository.getNorthItem('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, enabled, connector_id AS connectorId, settings FROM north_items WHERE id = ?;'
    );
    expect(get).toHaveBeenCalledWith('id1');
    expect(northScan).toEqual(expectedValue);
  });

  it('should properly get null when north item not found', () => {
    get.mockReturnValueOnce(null);
    const northScan = repository.getNorthItem('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, enabled, connector_id AS connectorId, settings FROM north_items WHERE id = ?;'
    );
    expect(get).toHaveBeenCalledWith('id1');
    expect(northScan).toEqual(null);
  });

  it('should create a north item', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce({ settings: '{}' });

    const command: NorthConnectorItemCommandDTO = {
      name: 'northScan1',
      enabled: true,
      settings: {}
    };
    repository.createNorthItem('northId', command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      'INSERT INTO north_items (id, name, enabled, connector_id, settings) VALUES (?, ?, ?, ?, ?);'
    );
    expect(get).toHaveBeenCalledWith(1);

    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, enabled, connector_id AS connectorId, settings FROM north_items WHERE ROWID = ?;'
    );
  });

  it('should update a north item', () => {
    const command: NorthConnectorItemCommandDTO = {
      name: 'northScan1',
      enabled: true,
      settings: {}
    };
    repository.updateNorthItem('id1', command);
    expect(database.prepare).toHaveBeenCalledWith('UPDATE north_items SET name = ?, enabled = ?, settings = ? WHERE id = ?;');
  });

  it('should delete a north item', () => {
    repository.deleteNorthItem('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM north_items WHERE id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });

  it('should delete all north items', () => {
    repository.deleteAllNorthItems('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM north_items WHERE connector_id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });

  it('should delete all north items associated to a connector id', () => {
    repository.deleteAllNorthItems('connectorId');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM north_items WHERE connector_id = ?;');
    expect(run).toHaveBeenCalledWith('connectorId');
  });

  it('should create and update north items', () => {
    (database.transaction as jest.Mock).mockImplementationOnce(callback => {
      return () => callback();
    });
    const itemToAdd: NorthConnectorItemDTO = {
      id: 'id1',
      name: 'northScan1',
      enabled: true,
      connectorId: 'northId',
      settings: {}
    };

    const itemToUpdate: NorthConnectorItemDTO = {
      id: 'id2',
      name: 'northScan2',
      enabled: false,
      connectorId: 'northId',
      settings: {}
    };

    repository.createAndUpdateNorthItems('connectorId', [itemToAdd], [itemToUpdate]);
    expect(database.prepare).toHaveBeenCalledWith(
      `INSERT INTO north_items (id, name, enabled, connector_id, settings) VALUES (?, ?, ?, ?, ?);`
    );
    expect(database.prepare).toHaveBeenCalledWith(`UPDATE north_items SET name = ?, settings = ? WHERE id = ?;`);
  });

  it('should enable north item', () => {
    repository.enableNorthItem('id1');
    expect(database.prepare).toHaveBeenCalledWith('UPDATE north_items SET enabled = 1 WHERE id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });

  it('should disable north item', () => {
    repository.disableNorthItem('id1');
    expect(database.prepare).toHaveBeenCalledWith('UPDATE north_items SET enabled = 0 WHERE id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });
});
