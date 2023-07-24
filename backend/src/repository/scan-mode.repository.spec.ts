import ScanModeRepository from './scan-mode.repository';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../shared/model/scan-mode.model';
import SqliteDatabaseMock, { run, all, get } from '../tests/__mocks__/database.mock';
import { generateRandomId } from '../service/utils';
import { Database } from 'better-sqlite3';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: ScanModeRepository;
describe('Scan mode repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    run.mockReturnValue({ lastInsertRowid: 1 });
  });

  describe('with empty repository', () => {
    beforeEach(() => {
      all.mockReturnValue([]);
      database.prepare = jest.fn().mockReturnValue({
        run,
        get,
        all
      });
      repository = new ScanModeRepository(database);
    });

    it('should properly init scan mode table', () => {
      expect(database.prepare).toHaveBeenCalledWith('INSERT INTO scan_modes (id, name, description, cron) VALUES (?, ?, ?, ?);');
      expect(run).toHaveBeenCalledWith('123456', 'Every seconds', 'Trigger every seconds', '* * * * * *');
      expect(run).toHaveBeenCalledWith('123456', 'Every 10 seconds', 'Trigger every 10 seconds', '*/10 * * * * *');
      expect(run).toHaveBeenCalledWith('123456', 'Every minutes', 'Trigger every minutes', '0 * * * * *');
      expect(run).toHaveBeenCalledWith('123456', 'Every 10 minutes', 'Trigger every 10 minutes', '0 */10 * * * *');
      expect(run).toHaveBeenCalledWith('123456', 'Every hours', 'Trigger every hours', '0 0 * * * *');
      expect(run).toHaveBeenCalledWith('123456', 'Every 24 hours', 'Trigger every 24 hours', '0 0 0 * * *');
      expect(run).toHaveBeenCalledWith('subscription', 'Subscription', 'Used for subscription', '');
      expect(run).toHaveBeenCalledTimes(7);
    });
  });

  describe('with non-empty repository', () => {
    beforeEach(() => {
      all.mockReturnValue([
        {
          id: 'id1',
          name: 'scanMode1',
          description: 'my first scanMode',
          cron: '* * * * * *'
        },
        {
          id: 'id2',
          name: 'scanMode2',
          description: 'my second scanMode',
          cron: '* * * * * *'
        }
      ]);
      database.prepare = jest.fn().mockReturnValue({
        run,
        get,
        all
      });
      repository = new ScanModeRepository(database);
    });

    it('should properly get all scan modes', () => {
      const expectedValue: Array<ScanModeDTO> = [
        {
          id: 'id1',
          name: 'scanMode1',
          description: 'my first scanMode',
          cron: '* * * * * *'
        },
        {
          id: 'id2',
          name: 'scanMode2',
          description: 'my second scanMode',
          cron: '* * * * * *'
        }
      ];
      all.mockReturnValueOnce(expectedValue);
      const scanModes = repository.getScanModes();
      expect(database.prepare).toHaveBeenCalledWith('SELECT id, name, description, cron FROM scan_modes;');
      expect(scanModes).toEqual(expectedValue);
    });

    it('should properly get a scan mode', () => {
      const expectedValue: ScanModeDTO = {
        id: 'id1',
        name: 'scanMode1',
        description: 'my first scanMode',
        cron: '* * * * * *'
      };
      get.mockReturnValueOnce(expectedValue);
      const scanMode = repository.getScanMode('id1');
      expect(database.prepare).toHaveBeenCalledWith('SELECT id, name, description, cron FROM scan_modes WHERE id = ?;');
      expect(get).toHaveBeenCalledWith('id1');
      expect(scanMode).toEqual(expectedValue);
    });

    it('should create a scan mode', () => {
      run.mockReturnValueOnce({ lastInsertRowid: 1 });

      const command: ScanModeCommandDTO = {
        name: 'scanMode1',
        description: 'my first scanMode',
        cron: '* * * * * *'
      };
      repository.createScanMode(command);
      expect(generateRandomId).toHaveBeenCalledWith(6);
      expect(database.prepare).toHaveBeenCalledWith('INSERT INTO scan_modes (id, name, description, cron) VALUES (?, ?, ?, ?);');
      expect(run).toHaveBeenCalledWith('123456', command.name, command.description, command.cron);

      expect(database.prepare).toHaveBeenCalledWith('SELECT id, name, description, cron FROM scan_modes WHERE ROWID = ?;');
    });

    it('should update a scan mode', () => {
      const command: ScanModeCommandDTO = {
        name: 'scanMode1',
        description: 'my first scanMode',
        cron: '* * * * * *'
      };
      repository.updateScanMode('id1', command);
      expect(database.prepare).toHaveBeenCalledWith('UPDATE scan_modes SET name = ?, description = ?, cron = ? WHERE id = ?;');
      expect(run).toHaveBeenCalledWith(command.name, command.description, command.cron, 'id1');
    });

    it('should delete a scan mode', () => {
      repository.deleteScanMode('id1');
      expect(database.prepare).toHaveBeenCalledWith('DELETE FROM scan_modes WHERE id = ?;');
      expect(run).toHaveBeenCalledWith('id1');
    });
  });
});
