import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { generateRandomId } from '../service/utils';
import { SouthConnectorCommandDTO, SouthConnectorDTO } from '../../../shared/model/south-connector.model';
import SouthConnectorRepository from './south-connector.repository';
import { Database } from 'better-sqlite3';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: SouthConnectorRepository;
describe('South connector repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new SouthConnectorRepository(database);
  });

  it('should properly get south connectors', () => {
    const expectedValue: Array<SouthConnectorDTO> = [
      {
        id: 'id1',
        name: 'south1',
        type: 'SouthConnector',
        description: 'My south connector',
        enabled: true,
        history: {
          maxInstantPerItem: true,
          maxReadInterval: 0,
          readDelay: 200
        },
        settings: {}
      },
      {
        id: 'id2',
        name: 'south2',
        type: 'SouthConnector',
        description: 'My second south connector',
        enabled: true,
        history: {
          maxInstantPerItem: false,
          maxReadInterval: 0,
          readDelay: 200
        },
        settings: {}
      }
    ];
    all.mockReturnValueOnce([
      {
        id: 'id1',
        name: 'south1',
        type: 'SouthConnector',
        description: 'My south connector',
        enabled: true,
        maxInstantPerItem: true,
        maxReadInterval: 0,
        readDelay: 200,
        settings: JSON.stringify({})
      },
      {
        id: 'id2',
        name: 'south2',
        type: 'SouthConnector',
        description: 'My second south connector',
        enabled: true,
        maxInstantPerItem: false,
        maxReadInterval: 0,
        readDelay: 200,
        settings: JSON.stringify({})
      }
    ]);
    const southConnectors = repository.getSouthConnectors();
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, type, description, enabled, history_max_instant_per_item AS maxInstantPerItem, ' +
        'history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, settings FROM south_connectors;'
    );
    expect(southConnectors).toEqual(expectedValue);
  });

  it('should properly get a south connector', () => {
    const expectedValue: SouthConnectorDTO = {
      id: 'id1',
      name: 'south1',
      type: 'SouthConnector',
      description: 'My south connector',
      enabled: true,
      history: {
        maxInstantPerItem: false,
        maxReadInterval: 0,
        readDelay: 200
      },
      settings: {}
    };
    get.mockReturnValueOnce({
      id: 'id1',
      name: 'south1',
      type: 'SouthConnector',
      description: 'My south connector',
      enabled: true,
      maxInstantPerItem: false,
      maxReadInterval: 0,
      readDelay: 200,
      settings: JSON.stringify({})
    });
    const southConnector = repository.getSouthConnector('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, type, description, enabled, history_max_instant_per_item AS maxInstantPerItem, ' +
        'history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, settings FROM south_connectors WHERE id = ?;'
    );
    expect(get).toHaveBeenCalledWith('id1');
    expect(southConnector).toEqual(expectedValue);
  });

  it('should return null when south connector not found', () => {
    get.mockReturnValueOnce(null);
    const southConnector = repository.getSouthConnector('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, type, description, enabled, history_max_instant_per_item AS maxInstantPerItem, ' +
        'history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, settings FROM south_connectors WHERE id = ?;'
    );
    expect(get).toHaveBeenCalledWith('id1');
    expect(southConnector).toBeNull();
  });

  it('should create a south connector', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce({ settings: '{}' });

    const command: SouthConnectorCommandDTO = {
      name: 'south1',
      type: 'SouthConnector',
      description: 'My south connector',
      enabled: true,
      history: {
        maxInstantPerItem: false,
        maxReadInterval: 0,
        readDelay: 200
      },
      settings: {}
    };
    repository.createSouthConnector(command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      'INSERT INTO south_connectors (id, name, type, description, enabled, history_max_instant_per_item, history_max_read_interval, history_read_delay, settings) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);'
    );
    expect(run).toHaveBeenCalledWith(
      '123456',
      command.name,
      command.type,
      command.description,
      0,
      +command.history.maxInstantPerItem,
      command.history.maxReadInterval,
      command.history.readDelay,
      JSON.stringify(command.settings)
    );
    expect(get).toHaveBeenCalledWith(1);

    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, type, description, enabled, history_max_instant_per_item AS maxInstantPerItem, ' +
        'history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, settings FROM south_connectors WHERE ROWID = ?;'
    );
  });

  it('should update a south connector', () => {
    const command: SouthConnectorCommandDTO = {
      name: 'south1',
      type: 'SouthConnector',
      description: 'My south connector',
      enabled: true,
      history: {
        maxInstantPerItem: false,
        maxReadInterval: 0,
        readDelay: 200
      },
      settings: {}
    };
    repository.updateSouthConnector('id1', command);
    expect(database.prepare).toHaveBeenCalledWith(
      'UPDATE south_connectors SET name = ?, description = ?, ' +
        'history_max_instant_per_item = ?, history_max_read_interval = ?, history_read_delay = ?, settings = ? WHERE id = ?;'
    );
    expect(run).toHaveBeenCalledWith(
      command.name,
      command.description,
      +command.history.maxInstantPerItem,
      command.history.maxReadInterval,
      command.history.readDelay,
      JSON.stringify(command.settings),
      'id1'
    );
  });

  it('should delete a south connector', () => {
    repository.deleteSouthConnector('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM south_connectors WHERE id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });
});
