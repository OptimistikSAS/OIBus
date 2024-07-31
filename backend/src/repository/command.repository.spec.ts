import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';
import OianalyticsCommandRepository, { COMMANDS_TABLE, OIBusCommandResult } from './oianalytics-command.repository';
import { CommandSearchParam, OIBusCommand, OIBusCommandDTO } from '../../../shared/model/command.model';
import { createPageFromArray } from '../../../shared/model/types';
import { EngineSettingsCommandDTO } from '../../../shared/model/engine.model';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: OianalyticsCommandRepository;

const nowDateString = '2020-02-02T02:02:02.222Z';

const mockResults: Array<OIBusCommandResult> = [
  {
    id: 'id1',
    type: 'UPGRADE',
    status: 'COMPLETED',
    ack: 1,
    created_at: '2023-01-01T12:00:00Z',
    updated_at: '2023-01-01T12:00:00Z',
    retrieved_date: '2023-01-01T12:00:00Z',
    completed_date: '2023-01-01T12:00:00Z',
    result: 'ok',
    upgrade_version: '3.2.0',
    upgrade_asset_id: 'assetId',
    command_content: null,
    target_version: null,
    scan_mode_id: null,
    south_connector_id: null,
    north_connector_id: null
  },
  {
    id: 'id2',
    type: 'update-engine-settings',
    status: 'RETRIEVED',
    ack: 0,
    created_at: '2023-01-01T12:00:00Z',
    updated_at: '2023-01-01T12:00:00Z',
    retrieved_date: '2023-01-01T12:00:00Z',
    completed_date: '2023-01-01T12:00:00Z',
    result: 'ok',
    upgrade_version: null,
    upgrade_asset_id: null,
    command_content: '{}',
    target_version: 'v3.5.0',
    scan_mode_id: null,
    south_connector_id: null,
    north_connector_id: null
  },
  {
    id: 'id3',
    type: 'restart-engine',
    status: 'RETRIEVED',
    ack: 0,
    created_at: '2023-01-01T12:00:00Z',
    updated_at: '2023-01-01T12:00:00Z',
    retrieved_date: '2023-01-01T12:00:00Z',
    completed_date: '2023-01-01T12:00:00Z',
    result: 'ok',
    upgrade_version: null,
    upgrade_asset_id: null,
    command_content: null,
    target_version: null,
    scan_mode_id: null,
    south_connector_id: null,
    north_connector_id: null
  }
];
const expectedResults: Array<OIBusCommand> = [
  {
    id: 'id1',
    type: 'update-version',
    status: 'COMPLETED',
    ack: true,
    creationDate: '2023-01-01T12:00:00Z',
    retrievedDate: '2023-01-01T12:00:00Z',
    completedDate: '2023-01-01T12:00:00Z',
    result: 'ok',
    version: '3.2.0',
    assetId: 'assetId'
  },
  {
    id: 'id2',
    type: 'update-engine-settings',
    status: 'RETRIEVED',
    ack: false,
    creationDate: '2023-01-01T12:00:00Z',
    retrievedDate: '2023-01-01T12:00:00Z',
    completedDate: '2023-01-01T12:00:00Z',
    result: 'ok',
    targetVersion: 'v3.5.0',
    commandContent: {} as EngineSettingsCommandDTO
  },
  {
    id: 'id3',
    type: 'restart-engine',
    status: 'RETRIEVED',
    ack: false,
    creationDate: '2023-01-01T12:00:00Z',
    retrievedDate: '2023-01-01T12:00:00Z',
    completedDate: '2023-01-01T12:00:00Z',
    result: 'ok'
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
    repository = new OianalyticsCommandRepository(database);
  });

  it('should properly list commands', () => {
    all.mockReturnValueOnce(mockResults);
    const results = repository.findAll();
    const query = `SELECT *
                   FROM commands;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(results).toEqual(expectedResults);
  });

  it('should properly search commands and page them', () => {
    all.mockReturnValueOnce(mockResults);
    const searchCriteria: CommandSearchParam = {
      types: ['UPGRADE', 'update-engine-settings'],
      status: ['ERRORED']
    };
    get.mockReturnValueOnce({ count: 3 });
    const results = repository.search(searchCriteria, 0);
    const query = `SELECT *
                   FROM commands WHERE id IS NOT NULL AND type IN (?,?) AND status IN (?)
                   ORDER BY created_at DESC
                   LIMIT 50 OFFSET ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(database.prepare).toHaveBeenCalledWith(`SELECT COUNT(*) as count
           FROM ${COMMANDS_TABLE} WHERE id IS NOT NULL AND type IN (?,?) AND status IN (?)`);
    expect(results).toEqual(createPageFromArray(expectedResults, 50, 0));
  });

  it('should properly search commands and list them', () => {
    all.mockReturnValueOnce(mockResults);
    const searchCriteria: CommandSearchParam = {
      types: ['UPGRADE', 'update-engine-settings'],
      status: ['ERRORED'],
      ack: true
    };
    const results = repository.list(searchCriteria);
    const query = `SELECT *
                   FROM commands WHERE id IS NOT NULL AND type IN (?,?) AND status IN (?) AND ack = ?
                   ORDER BY created_at DESC;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(results).toEqual(expectedResults);
  });

  it('should properly find by id', () => {
    get.mockReturnValueOnce(mockResults[2]);
    const result = repository.findById('id3');
    const query = `SELECT *
                   FROM commands
                   WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(get).toHaveBeenCalledWith('id3');
    expect(result).toEqual(expectedResults[2]);
  });

  it('should properly return null if command not found', () => {
    get.mockReturnValueOnce(undefined);
    const result = repository.findById('id');
    const query = `SELECT *
                   FROM commands
                   WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(get).toHaveBeenCalledWith('id');
    expect(result).toBeNull();
  });

  it('should create an update version command', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce(mockResults[0]);
    const command: OIBusCommandDTO = {
      id: 'c1',
      type: 'update-version',
      version: '3.2.0',
      assetId: 'assetId'
    };
    const result = repository.create('id1', command);
    const insertQuery =
      `INSERT INTO ${COMMANDS_TABLE} (id, retrieved_date, type, status, ack, upgrade_version, ` +
      `upgrade_asset_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
    expect(database.prepare).toHaveBeenCalledWith(insertQuery);
    expect(run).toHaveBeenCalledWith('id1', nowDateString, command.type, 'RETRIEVED', 0, command.version, command.assetId);
    expect(result).toEqual(expectedResults[0]);
  });

  it('should create a update engine settings command', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce(mockResults[1]);
    const command: OIBusCommandDTO = {
      id: 'c1',
      type: 'update-engine-settings',
      targetVersion: '3.3.3',
      commandContent: {} as EngineSettingsCommandDTO
    };
    const result = repository.create('id1', command);
    const insertQuery = `INSERT INTO ${COMMANDS_TABLE} (id, retrieved_date, type, status, ack, target_version, command_content) VALUES (?, ?, ?, ?, ?, ?, ?);`;
    expect(database.prepare).toHaveBeenCalledWith(insertQuery);
    expect(run).toHaveBeenCalledWith('id1', nowDateString, command.type, 'RETRIEVED', 0, '3.3.3', JSON.stringify(command.commandContent));
    expect(result).toEqual(expectedResults[1]);
  });

  it('should create a RESTART command', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce(mockResults[2]);
    const command: OIBusCommandDTO = {
      id: 'c1',
      type: 'restart-engine'
    };
    const result = repository.create('id1', command);
    const insertQuery = `INSERT INTO ${COMMANDS_TABLE} (id, retrieved_date, type, status, ack) VALUES (?, ?, ?, ?, ?);`;
    expect(database.prepare).toHaveBeenCalledWith(insertQuery);
    expect(run).toHaveBeenCalledWith('id1', nowDateString, command.type, 'RETRIEVED', 0);
    expect(result).toEqual(expectedResults[2]);
  });

  it('should mark a command as COMPLETED', () => {
    repository.markAsCompleted('id1', nowDateString, 'ok');
    const query = `UPDATE ${COMMANDS_TABLE}
                   SET status         = 'COMPLETED',
                       completed_date = ?,
                       result         = ?,
                       ack            = 0
                   WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith(nowDateString, 'ok', 'id1');
  });

  it('should mark a command as ERRORED', () => {
    repository.markAsErrored('id1', 'not ok');
    const query = `UPDATE ${COMMANDS_TABLE}
                   SET status = 'ERRORED',
                       result = ?,
                       ack    = 0
                   WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith('not ok', 'id1');
  });

  it('should mark a command as RUNNING', () => {
    repository.markAsRunning('id1');
    const query = `UPDATE ${COMMANDS_TABLE}
                   SET status = 'RUNNING',
                       ack    = 0
                   WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith('id1');
  });

  it('should mark a command as Acknowledged', () => {
    repository.markAsAcknowledged('id1');
    const query = `UPDATE ${COMMANDS_TABLE}
                   SET ack = 1
                   WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith('id1');
  });

  it('should cancel a command', () => {
    repository.cancel('id1');
    const query = `UPDATE ${COMMANDS_TABLE}
                   SET status = 'CANCELLED',
                       ack    = 0
                   WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith('id1');
  });

  it('should delete a command', () => {
    repository.delete('id1');
    const query = `DELETE
                   FROM ${COMMANDS_TABLE}
                   WHERE id = ?;`;
    expect(database.prepare).toHaveBeenCalledWith(query);
    expect(run).toHaveBeenCalledWith('id1');
  });
});
