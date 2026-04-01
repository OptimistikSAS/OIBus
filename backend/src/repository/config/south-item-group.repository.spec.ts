import { Database } from 'better-sqlite3';
import SouthItemGroupRepository, { toSouthItemGroup } from './south-item-group.repository';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import { SouthItemGroupCommand } from '../../model/south-connector.model';

jest.mock('../../service/utils');

const TEST_DB_PATH = 'src/tests/test-config-south-item-group.db';

let database: Database;
describe('South Item Group Repository', () => {
  beforeAll(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  describe('South item group operations', () => {
    let repository: SouthItemGroupRepository;

    beforeEach(() => {
      jest.clearAllMocks();
      repository = new SouthItemGroupRepository(database);
    });

    it('should find a group by id', () => {
      // First create a group to find
      (generateRandomId as jest.Mock).mockReturnValueOnce('testGroupId1');
      const groupToCreate: SouthItemGroupCommand = {
        name: 'Test Group 1',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };
      repository.create(groupToCreate, 'userTest');

      const found = repository.findById('testGroupId1');
      expect(found).toBeDefined();
      expect(found!.id).toEqual('testGroupId1');
      expect(found!.name).toEqual('Test Group 1');
      expect(found!.southId).toEqual(testData.south.list[0].id);
      expect(found!.scanMode.id).toEqual(testData.scanMode.list[0].id);
      expect(found!.overlap).toBeNull();
    });

    it('should return null when finding non-existing group', () => {
      const found = repository.findById('nonExistingId');
      expect(found).toBeNull();
    });

    it('should find groups by south id', () => {
      // Create multiple groups for the same south connector
      (generateRandomId as jest.Mock).mockReturnValueOnce('testGroupId2').mockReturnValueOnce('testGroupId3');

      const group1: SouthItemGroupCommand = {
        name: 'Group A',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: 10,
        maxReadInterval: null,
        readDelay: 0
      };

      const group2: SouthItemGroupCommand = {
        name: 'Group B',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[1],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };

      repository.create(group1, 'userTest');
      repository.create(group2, 'userTest');

      const groups = repository.findBySouthId(testData.south.list[0].id);
      expect(groups.length).toBeGreaterThanOrEqual(2);
      // Groups should be ordered by name
      const groupNames = groups.map(g => g.name);
      expect(groupNames).toContain('Group A');
      expect(groupNames).toContain('Group B');
    });

    it('should return empty array when finding groups for non-existing south id', () => {
      const groups = repository.findBySouthId('nonExistingSouthId');
      expect(groups).toEqual([]);
    });

    it('should find a group by name and south id', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('findByNameGroupId');
      const groupToCreate: SouthItemGroupCommand = {
        name: 'Find By Name Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };
      repository.create(groupToCreate, 'userTest');

      const found = repository.findByNameAndSouthId('Find By Name Group', testData.south.list[0].id);
      expect(found).toBeDefined();
      expect(found!.id).toEqual('findByNameGroupId');
      expect(found!.name).toEqual('Find By Name Group');
      expect(found!.southId).toEqual(testData.south.list[0].id);
    });

    it('should return null when finding group by name that does not exist', () => {
      const found = repository.findByNameAndSouthId('Non Existing Group', testData.south.list[0].id);
      expect(found).toBeNull();
    });

    it('should return null when finding group by name for different south id', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('differentSouthGroupId');
      const groupToCreate: SouthItemGroupCommand = {
        name: 'Group For Different South',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };
      repository.create(groupToCreate, 'userTest');

      // Try to find with a different south id
      const found = repository.findByNameAndSouthId('Group For Different South', 'differentSouthId');
      expect(found).toBeNull();
    });

    it('should create a group with generated id', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('generatedGroupId');

      const groupToCreate: SouthItemGroupCommand = {
        name: 'New Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: 5,
        maxReadInterval: null,
        readDelay: 0
      };

      const created = repository.create(groupToCreate, 'userTest');
      expect(created.id).toEqual('generatedGroupId');
      expect(created.name).toEqual('New Group');
      expect(created.southId).toEqual(testData.south.list[0].id);
      expect(created.scanMode.id).toEqual(testData.scanMode.list[0].id);
      expect(created.overlap).toEqual(5);
    });

    it('should create a group with custom id', () => {
      const customId = 'customGroupId';
      const groupToCreate: SouthItemGroupCommand = {
        name: 'Custom Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };

      const created = repository.create(groupToCreate, 'userTest', customId);
      expect(created.id).toEqual(customId);
      expect(created.name).toEqual('Custom Group');

      const found = repository.findById(customId);
      expect(found).toBeDefined();
      expect(found!.id).toEqual(customId);
    });

    it('should throw error when create fails to find created group', () => {
      // Mock findById to return null to simulate the error path
      jest.spyOn(repository, 'findById').mockReturnValueOnce(null);

      const groupToCreate: SouthItemGroupCommand = {
        name: 'Group That Will Fail',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };

      expect(() => {
        repository.create(groupToCreate, 'userTest', 'failingGroupId');
      }).toThrow('Failed to create south item group with id failingGroupId');

      // Restore original method
      jest.restoreAllMocks();
    });

    it('should update a group', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('updateGroupId');

      const groupToCreate: SouthItemGroupCommand = {
        name: 'Original Name',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };

      repository.create(groupToCreate, 'userTest');

      // Update the group
      const updateCommand: Omit<SouthItemGroupCommand, 'southId'> = {
        name: 'Updated Name',
        scanMode: testData.scanMode.list[1],
        overlap: 15,
        maxReadInterval: null,
        readDelay: 0
      };

      repository.update('updateGroupId', updateCommand, 'userTest');

      const updated = repository.findById('updateGroupId');
      expect(updated).toBeDefined();
      expect(updated!.name).toEqual('Updated Name');
      expect(updated!.scanMode.id).toEqual(testData.scanMode.list[1].id);
      expect(updated!.overlap).toEqual(15);
      expect(updated!.southId).toEqual(testData.south.list[0].id); // Should remain unchanged
    });

    it('should update a group with null overlap', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('updateGroupIdNull');

      const groupToCreate: SouthItemGroupCommand = {
        name: 'Group With Overlap',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: 10,
        maxReadInterval: null,
        readDelay: 0
      };

      repository.create(groupToCreate, 'userTest');

      // Update with null overlap to test the ?? null branch
      const updateCommand: Omit<SouthItemGroupCommand, 'southId'> = {
        name: 'Updated Name Null',
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };

      repository.update('updateGroupIdNull', updateCommand, 'userTest');

      const updated = repository.findById('updateGroupIdNull');
      expect(updated).toBeDefined();
      expect(updated!.overlap).toBeNull();
    });

    it('should delete a group', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('deleteGroupId');

      const groupToCreate: SouthItemGroupCommand = {
        name: 'Group To Delete',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };

      repository.create(groupToCreate, 'userTest');
      expect(repository.findById('deleteGroupId')).toBeDefined();

      repository.delete('deleteGroupId');
      expect(repository.findById('deleteGroupId')).toBeNull();
    });

    it('should convert database result to SouthItemGroupEntity', () => {
      const dbResult: Record<string, string | number> = {
        id: 'testId',
        created_at: '2024-01-01 00:00:00',
        updated_at: '2024-01-01 00:00:00',
        name: 'Test Group',
        south_id: 'southId1',
        scan_mode_id: testData.scanMode.list[0].id,
        overlap: 20,
        max_read_interval: 3600,
        read_delay: 200,
        scan_mode_id_full: testData.scanMode.list[0].id,
        scan_mode_name: testData.scanMode.list[0].name,
        scan_mode_description: testData.scanMode.list[0].description,
        scan_mode_cron: testData.scanMode.list[0].cron
      };

      const converted = toSouthItemGroup(dbResult, [
        {
          id: 'itemId',
          name: 'itemName',
          created_at: '2024-01-01 00:00:00',
          updated_at: '2024-01-01 00:00:00',
          created_by: 'userTest',
          updated_by: 'userTest'
        }
      ]);
      expect(converted.id).toEqual('testId');
      expect(converted.name).toEqual('Test Group');
      expect(converted.southId).toEqual('southId1');
      expect(converted.scanMode.id).toEqual(testData.scanMode.list[0].id);
      expect(converted.scanMode.name).toEqual(testData.scanMode.list[0].name);
      expect(converted.overlap).toEqual(20);
      expect(converted.maxReadInterval).toEqual(3600);
      expect(converted.readDelay).toEqual(200);
      expect(converted.items).toEqual([
        {
          id: 'itemId',
          name: 'itemName',
          createdAt: '2024-01-01 00:00:00',
          updatedAt: '2024-01-01 00:00:00',
          createdBy: 'userTest',
          updatedBy: 'userTest'
        }
      ]);
    });

    it('should convert database result with null overlap', () => {
      const dbResult: Record<string, string | number | null> = {
        id: 'testId2',
        created_at: '2024-01-01 00:00:00',
        updated_at: '2024-01-01 00:00:00',
        name: 'Test Group 2',
        south_id: 'southId1',
        scan_mode_id: testData.scanMode.list[0].id,
        overlap: null,
        scan_mode_id_full: testData.scanMode.list[0].id,
        scan_mode_name: testData.scanMode.list[0].name,
        scan_mode_description: testData.scanMode.list[0].description,
        scan_mode_cron: testData.scanMode.list[0].cron
      };

      const converted = toSouthItemGroup(dbResult as Record<string, string | number>, []);
      expect(converted.overlap).toBeNull();
    });

    it('should convert database result with undefined overlap', () => {
      const dbResult: Record<string, string | number | null | undefined> = {
        id: 'testId3',
        created_at: '2024-01-01 00:00:00',
        updated_at: '2024-01-01 00:00:00',
        name: 'Test Group 3',
        south_id: 'southId1',
        scan_mode_id: testData.scanMode.list[0].id,
        overlap: undefined,
        scan_mode_id_full: testData.scanMode.list[0].id,
        scan_mode_name: testData.scanMode.list[0].name,
        scan_mode_description: testData.scanMode.list[0].description,
        scan_mode_cron: testData.scanMode.list[0].cron
      };

      const converted = toSouthItemGroup(dbResult as Record<string, string | number>, []);
      expect(converted.overlap).toBeNull();
    });

    it('should convert database result with null max_read_interval', () => {
      const dbResult: Record<string, string | number | null> = {
        id: 'testId4',
        created_at: '2024-01-01 00:00:00',
        updated_at: '2024-01-01 00:00:00',
        name: 'Test Group 4',
        south_id: 'southId1',
        scan_mode_id: testData.scanMode.list[0].id,
        overlap: null,
        max_read_interval: null,
        read_delay: 0,
        scan_mode_id_full: testData.scanMode.list[0].id,
        scan_mode_name: testData.scanMode.list[0].name,
        scan_mode_description: testData.scanMode.list[0].description,
        scan_mode_cron: testData.scanMode.list[0].cron
      };

      const converted = toSouthItemGroup(dbResult as Record<string, string | number>, []);
      expect(converted.maxReadInterval).toBeNull();
      expect(converted.readDelay).toEqual(0);
    });
  });
});
