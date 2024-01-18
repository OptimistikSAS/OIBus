import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';
import CommandRepository, { COMMANDS_TABLE } from './command.repository';
import { CommandSearchParam, OIBusCommand, OIBusCommandDTO } from '../../../shared/model/command.model';
import { createPageFromArray } from '../../../shared/model/types';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: CommandRepository;

const nowDateString = '2020-02-02T02:02:02.222Z';

const expectedCommands: Array<OIBusCommandDTO> = [
  {
    id: 'id1',
    type: 'UPGRADE',
    status: 'COMPLETED',
    creationDate: '2023-01-01T12:00:00Z',
    completedDate: '2023-01-01T12:00:00Z',
    result: 'ok',
    version: '3.2.0'
  },
  {
    id: 'id2',
    type: 'UPGRADE',
    status: 'PENDING',
    creationDate: '2023-01-01T12:00:00Z',
    completedDate: '2023-01-01T12:00:00Z',
    result: 'ok',
    version: '3.2.0'
  }
];

describe('Command repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));
    repository = new CommandRepository(database);
  });

  it('should properly list commands', () => {
    all.mockReturnValueOnce(expectedCommands);
    const results = repository.findAll();
    const query = `SELECT id, type, status, retrieved_date as retrievedDate, completed_date as completedDate, result, version FROM commands;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(results).toEqual(expectedCommands);
  });

  it('should properly search commands and page them', () => {
    all.mockReturnValueOnce(expectedCommands);
    const searchCriteria: CommandSearchParam = {
      types: ['UPGRADE'],
      status: ['ERRORED']
    };
    get.mockReturnValueOnce({ count: 2 });
    const results = repository.searchCommandsPage(searchCriteria, 0);
    const query =
      `SELECT id, type, status, retrieved_date as retrievedDate, completed_date as completedDate, ` +
      `result, version FROM commands WHERE id IS NOT NULL AND type IN (?) AND status IN (?) ` +
      `ORDER BY created_at DESC LIMIT 50 OFFSET ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT COUNT(*) as count FROM commands WHERE id IS NOT NULL AND type IN (?) AND status IN (?)'
    );
    expect(results).toEqual(createPageFromArray(expectedCommands, 50, 0));
  });

  it('should properly search commands and list them', () => {
    all.mockReturnValueOnce(expectedCommands);
    const searchCriteria: CommandSearchParam = {
      types: ['UPGRADE'],
      status: ['ERRORED']
    };
    const results = repository.searchCommandsList(searchCriteria);
    const query =
      `SELECT id, type, status, retrieved_date as retrievedDate, completed_date as completedDate, ` +
      `result, version FROM commands WHERE id IS NOT NULL AND type IN (?) AND status IN (?) ORDER BY created_at DESC;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(results).toEqual(expectedCommands);
  });

  it('should properly find by id', () => {
    const expectedValue: OIBusCommandDTO = {
      id: 'id1',
      type: 'UPGRADE',
      status: 'COMPLETED',
      creationDate: '2023-01-01T12:00:00Z',
      completedDate: '2023-01-01T12:00:00Z',
      result: 'ok',
      version: '3.2.0'
    };
    get.mockReturnValueOnce(expectedValue);
    const result = repository.findById('id2');
    const query =
      `SELECT id, type, status, retrieved_date as retrievedDate, completed_date as completedDate, result, ` +
      `version FROM commands WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(get).toHaveBeenCalledWith('id2');
    expect(result).toEqual(expectedValue);
  });

  it('should create a command', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    const command: OIBusCommand = {
      type: 'UPGRADE',
      version: '3.2.0'
    };
    repository.create('id1', command);
    const insertQuery = `INSERT INTO ${COMMANDS_TABLE} (id, retrieved_date, type, status, version) VALUES (?, ?, ?, ?, ?);`;
    expect(database.prepare).toHaveBeenCalledWith(insertQuery);
    expect(run).toHaveBeenCalledWith('id1', nowDateString, command.type, 'PENDING', command.version);
  });

  it('should update a command', () => {
    const command: OIBusCommand = {
      type: 'UPGRADE',
      version: '3.2.0'
    };
    repository.update('id1', command);
    const updateQuery = `UPDATE commands SET version = ? WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(updateQuery);
    expect(run).toHaveBeenCalledWith(command.version, 'id1');
  });

  it('should mark a command as COMPLETED', () => {
    repository.markAsCompleted('id1', 'ok');
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'COMPLETED', result = ? WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith('ok', 'id1');
  });

  it('should mark a command as ERRORED', () => {
    repository.markAsErrored('id1', 'not ok');
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'ERRORED', result = ? WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith('not ok', 'id1');
  });

  it('should cancel a command', () => {
    repository.cancel('id1');
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'CANCELLED' WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith('id1');
  });

  it('should delete a command', () => {
    repository.delete('id1');
    const query = `DELETE FROM ${COMMANDS_TABLE} WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith('id1');
  });
});
