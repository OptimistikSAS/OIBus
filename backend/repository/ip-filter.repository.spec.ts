import SqliteDatabaseMock, { run, all, get } from '../tests/__mocks__/database.mock';
import { generateRandomId } from './utils';
import IpFilterRepository from './ip-filter.repository';
import { IpFilterCommandDTO, IpFilterDTO } from '../../shared/model/ip-filter.model';
import { Database } from 'better-sqlite3';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('./utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: IpFilterRepository;
describe('IP Filter repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new IpFilterRepository(database);
  });

  it('should properly init IP filter table', () => {
    expect(database.prepare).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS ip_filter (id TEXT PRIMARY KEY, address TEXT, description TEXT);'
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should properly get all IP filters', () => {
    const expectedValue: Array<IpFilterDTO> = [
      {
        id: 'id1',
        address: 'ip1',
        description: 'my first ip filter'
      },
      {
        id: 'id2',
        address: 'ip2',
        description: 'my second ip filter'
      }
    ];
    all.mockReturnValueOnce(expectedValue);
    const ipFilters = repository.getIpFilters();
    expect(database.prepare).toHaveBeenCalledWith('SELECT id, address, description FROM ip_filter;');
    expect(ipFilters).toEqual(expectedValue);
  });

  it('should properly get an IP filter', () => {
    const expectedValue: IpFilterDTO = {
      id: 'id1',
      address: 'ip1',
      description: 'my first IP filter'
    };
    get.mockReturnValueOnce(expectedValue);
    const ipFilter = repository.getIpFilter('id1');
    expect(database.prepare).toHaveBeenCalledWith('SELECT id, address, description FROM ip_filter WHERE id = ?;');
    expect(get).toHaveBeenCalledWith('id1');
    expect(ipFilter).toEqual(expectedValue);
  });

  it('should create an IP filter', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    const command: IpFilterCommandDTO = {
      address: 'ip1',
      description: 'my first IP filter'
    };
    repository.createIpFilter(command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith('INSERT INTO ip_filter (id, address, description) VALUES (?, ?, ?);');
    expect(run).toHaveBeenCalledWith('123456', command.address, command.description);
    expect(database.prepare).toHaveBeenCalledWith('SELECT id, address, description FROM ip_filter WHERE ROWID = ?;');
  });

  it('should update an IP filter', () => {
    const command: IpFilterCommandDTO = {
      address: 'ip1',
      description: 'my first IP filter'
    };
    repository.updateIpFilter('id1', command);
    expect(database.prepare).toHaveBeenCalledWith('UPDATE ip_filter SET address = ?, description = ? WHERE id = ?;');
    expect(run).toHaveBeenCalledWith(command.address, command.description, 'id1');
  });

  it('should delete an IP filter', () => {
    repository.deleteIpFilter('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM ip_filter WHERE id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });
});
