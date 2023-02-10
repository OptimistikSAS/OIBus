import SqliteDatabaseMock, { run, all, get } from '../tests/__mocks__/database.mock';
import { generateRandomId } from '../service/utils';
import { SouthConnectorCommandDTO, SouthConnectorDTO } from '../../shared/model/south-connector.model';
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

  it('should properly init south connector table', () => {
    expect(database.prepare).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS south_connector (id TEXT PRIMARY KEY, name TEXT, type TEXT, description TEXT, ' +
        'enabled INTEGER, settings TEXT);'
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should properly get south connectors', () => {
    const expectedValue: Array<SouthConnectorDTO> = [
      {
        id: 'id1',
        name: 'south1',
        type: 'SouthConnector',
        description: 'My south connector',
        enabled: true,
        settings: {}
      },
      {
        id: 'id2',
        name: 'south2',
        type: 'SouthConnector',
        description: 'My second south connector',
        enabled: true,
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
        settings: JSON.stringify({})
      },
      {
        id: 'id2',
        name: 'south2',
        type: 'SouthConnector',
        description: 'My second south connector',
        enabled: true,
        settings: JSON.stringify({})
      }
    ]);
    const southConnectors = repository.getSouthConnectors();
    expect(database.prepare).toHaveBeenCalledWith('SELECT id, name, type, description, enabled, settings FROM south_connector;');
    expect(southConnectors).toEqual(expectedValue);
  });

  it('should properly get a south connector', () => {
    const expectedValue: SouthConnectorDTO = {
      id: 'id1',
      name: 'south1',
      type: 'SouthConnector',
      description: 'My south connector',
      enabled: true,
      settings: {}
    };
    get.mockReturnValueOnce({
      id: 'id1',
      name: 'south1',
      type: 'SouthConnector',
      description: 'My south connector',
      enabled: true,
      settings: JSON.stringify({})
    });
    const southConnector = repository.getSouthConnector('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, type, description, enabled, settings FROM south_connector WHERE id = ?;'
    );
    expect(get).toHaveBeenCalledWith('id1');
    expect(southConnector).toEqual(expectedValue);
  });

  it('should create a south connector', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce({ settings: '{}' });

    const command: SouthConnectorCommandDTO = {
      name: 'south1',
      type: 'SouthConnector',
      description: 'My south connector',
      enabled: true,
      settings: {}
    };
    repository.createSouthConnector(command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      'INSERT INTO south_connector (id, name, type, description, enabled, settings) VALUES (?, ?, ?, ?, ?, ?);'
    );
    expect(run).toHaveBeenCalledWith(
      '123456',
      command.name,
      command.type,
      command.description,
      +command.enabled,
      JSON.stringify(command.settings)
    );
    expect(get).toHaveBeenCalledWith(1);

    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, type, description, enabled, settings FROM south_connector WHERE ROWID = ?;'
    );
  });

  it('should update a south connector', () => {
    const command: SouthConnectorCommandDTO = {
      name: 'south1',
      type: 'SouthConnector',
      description: 'My south connector',
      enabled: true,
      settings: {}
    };
    repository.updateSouthConnector('id1', command);
    expect(database.prepare).toHaveBeenCalledWith(
      'UPDATE south_connector SET name = ?, description = ?, enabled = ?, settings = ? WHERE id = ?;'
    );
    expect(run).toHaveBeenCalledWith(command.name, command.description, +command.enabled, JSON.stringify(command.settings), 'id1');
  });

  it('should delete a south connector', () => {
    repository.deleteSouthConnector('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM south_connector WHERE id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });
});
