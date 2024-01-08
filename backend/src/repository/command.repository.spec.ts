import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';
import CommandRepository, { COMMANDS_TABLE } from './command.repository';
import { OIBusCommand, OIBusCommandDTO } from '../../../shared/model/command.model';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: CommandRepository;

const nowDateString = '2020-02-02T02:02:02.222Z';

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
    const expectedValue: Array<OIBusCommandDTO> = [
      {
        id: 'id1',
        type: 'UPGRADE',
        status: 'COMPLETED',
        retrievedDate: '2023-01-01T12:00:00Z',
        completedDate: '2023-01-01T12:00:00Z',
        result: 'ok',
        version: '3.2.0'
      },
      {
        id: 'id2',
        type: 'UPGRADE',
        status: 'PENDING',
        retrievedDate: '2023-01-01T12:00:00Z',
        completedDate: '2023-01-01T12:00:00Z',
        result: 'ok',
        version: '3.2.0'
      }
    ];
    all.mockReturnValueOnce(expectedValue);
    const results = repository.findAll();
    const query = `SELECT id, type, status, retrieved_date as retrievedDate, completed_date as completedDate, result, version FROM commands;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(results).toEqual(expectedValue);
  });

  it('should properly find by id', () => {
    const expectedValue: OIBusCommandDTO = {
      id: 'id1',
      type: 'UPGRADE',
      status: 'COMPLETED',
      retrievedDate: '2023-01-01T12:00:00Z',
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
    repository.create(command);
    const insertQuery = `INSERT INTO ${COMMANDS_TABLE} (id, type, status, retrieved_date, version) VALUES (?, ?, ?, ?, ?);`;
    expect(database.prepare).toHaveBeenCalledWith(insertQuery);
    expect(run).toHaveBeenCalledWith('123456', command.type, 'PENDING', nowDateString, command.version);
  });

  it('should update a command', () => {
    const command: OIBusCommand = {
      type: 'UPGRADE',
      version: '3.2.0'
    };
    repository.update('id1', command);
    const updateQuery = `UPDATE commands SET version  = ? ` + 'WHERE id = ?;';
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
