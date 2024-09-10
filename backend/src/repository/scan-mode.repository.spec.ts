import ScanModeRepository from './scan-mode.repository';
import { Database } from 'better-sqlite3';
import { generateRandomId } from '../service/utils';
import { emptyDatabase, initDatabase } from '../tests/utils/test-utils';
import testData from '../tests/utils/test-data';

jest.mock('../service/utils');

let oibusDatabase: Database;
let repository: ScanModeRepository;

describe('Scan Mode Repository', () => {
  beforeAll(async () => {
    oibusDatabase = await initDatabase();
  });

  afterAll(() => {
    emptyDatabase();
  });

  describe('with empty repository', () => {
    it('should properly init scan mode table', () => {
      (generateRandomId as jest.Mock)
        .mockReturnValueOnce('id1')
        .mockReturnValueOnce('id2')
        .mockReturnValueOnce('id3')
        .mockReturnValueOnce('id4')
        .mockReturnValueOnce('id5')
        .mockReturnValueOnce('id6');

      repository = new ScanModeRepository(oibusDatabase);
      expect(generateRandomId).toHaveBeenCalledTimes(6);
      expect(repository.findAll().length).toEqual(7);
    });
  });

  describe('with non-empty repository', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      repository = new ScanModeRepository(oibusDatabase);
    });

    it('should properly get all scan modes', () => {
      expect(repository.findAll().length).toEqual(7);
    });

    it('should properly get a scan mode', () => {
      expect(repository.findById('id1')).toEqual({
        name: 'Every second',
        description: 'Trigger every second',
        cron: '* * * * * *',
        id: 'id1'
      });
      expect(repository.findById('subscription')).toEqual({
        name: 'Subscription',
        description: 'Used for subscription',
        cron: '',
        id: 'subscription'
      });
      expect(repository.findById('badId')).toEqual(null);
    });

    it('should create a scan mode', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newId');
      expect(repository.create(testData.scanMode.command)).toEqual({ ...testData.scanMode.command, id: 'newId' });
    });

    it('should update a scan mode', () => {
      repository.update('newId', testData.scanMode.command);
      expect(repository.findById('newId')).toEqual({ ...testData.scanMode.command, id: 'newId' });
    });

    it('should delete a scan mode', () => {
      repository.delete('id1');
      expect(repository.findById('id1')).toEqual(null);
    });
  });
});
