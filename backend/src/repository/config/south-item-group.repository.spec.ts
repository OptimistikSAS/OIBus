import { Database } from 'better-sqlite3';
import SouthItemGroupRepository, { toSouthItemGroup } from './south-item-group.repository';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import { SouthItemGroupEntity } from '../../model/south-connector.model';

jest.mock('../../service/utils');

let database: Database;
describe('South Item Group Repository', () => {
  beforeAll(async () => {
    database = await initDatabase('config');
  });

  afterAll(async () => {
    await emptyDatabase('config');
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
      const groupToCreate: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Test Group 1',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };
      const created = repository.create(groupToCreate);

      const found = repository.findById('testGroupId1');
      expect(found).toBeDefined();
      expect(found!.id).toEqual('testGroupId1');
      expect(found!.name).toEqual('Test Group 1');
      expect(found!.southId).toEqual(testData.south.list[0].id);
      expect(found!.scanMode.id).toEqual(testData.scanMode.list[0].id);
      expect(found!.shareTrackedInstant).toEqual(false);
      expect(found!.overlap).toBeNull();
    });

    it('should return null when finding non-existing group', () => {
      const found = repository.findById('nonExistingId');
      expect(found).toBeNull();
    });

    it('should find groups by south id', () => {
      // Create multiple groups for the same south connector
      (generateRandomId as jest.Mock)
        .mockReturnValueOnce('testGroupId2')
        .mockReturnValueOnce('testGroupId3');

      const group1: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Group A',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: true,
        overlap: 10
      };

      const group2: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Group B',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[1],
        shareTrackedInstant: false,
        overlap: null
      };

      repository.create(group1);
      repository.create(group2);

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
      const groupToCreate: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Find By Name Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };
      repository.create(groupToCreate);

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
      const groupToCreate: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Group For Different South',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };
      repository.create(groupToCreate);

      // Try to find with a different south id
      const found = repository.findByNameAndSouthId('Group For Different South', 'differentSouthId');
      expect(found).toBeNull();
    });

    it('should create a group with generated id', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('generatedGroupId');

      const groupToCreate: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at'> = {
        name: 'New Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: true,
        overlap: 5
      };

      const created = repository.create(groupToCreate);
      expect(created.id).toEqual('generatedGroupId');
      expect(created.name).toEqual('New Group');
      expect(created.southId).toEqual(testData.south.list[0].id);
      expect(created.scanMode.id).toEqual(testData.scanMode.list[0].id);
      expect(created.shareTrackedInstant).toEqual(true);
      expect(created.overlap).toEqual(5);
    });

    it('should create a group with custom id', () => {
      const customId = 'customGroupId';
      const groupToCreate: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Custom Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      const created = repository.create(groupToCreate, customId);
      expect(created.id).toEqual(customId);
      expect(created.name).toEqual('Custom Group');

      const found = repository.findById(customId);
      expect(found).toBeDefined();
      expect(found!.id).toEqual(customId);
    });

    it('should throw error when create fails to find created group', () => {
      // Mock findById to return null to simulate the error path
      const originalFindById = repository.findById.bind(repository);
      jest.spyOn(repository, 'findById').mockReturnValueOnce(null);

      const groupToCreate: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Group That Will Fail',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      expect(() => {
        repository.create(groupToCreate, 'failingGroupId');
      }).toThrow('Failed to create south item group with id failingGroupId');

      // Restore original method
      jest.restoreAllMocks();
    });

    it('should update a group', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('updateGroupId');

      const groupToCreate: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Original Name',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      const created = repository.create(groupToCreate);

      // Update the group
      const updateCommand: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at' | 'southId'> = {
        name: 'Updated Name',
        scanMode: testData.scanMode.list[1],
        shareTrackedInstant: true,
        overlap: 15
      };

      repository.update('updateGroupId', updateCommand);

      const updated = repository.findById('updateGroupId');
      expect(updated).toBeDefined();
      expect(updated!.name).toEqual('Updated Name');
      expect(updated!.scanMode.id).toEqual(testData.scanMode.list[1].id);
      expect(updated!.shareTrackedInstant).toEqual(true);
      expect(updated!.overlap).toEqual(15);
      expect(updated!.southId).toEqual(testData.south.list[0].id); // Should remain unchanged
    });

    it('should update a group with null overlap', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('updateGroupIdNull');

      const groupToCreate: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Group With Overlap',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: 10
      };

      repository.create(groupToCreate);

      // Update with null overlap to test the ?? null branch
      const updateCommand: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at' | 'southId'> = {
        name: 'Updated Name Null',
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      repository.update('updateGroupIdNull', updateCommand);

      const updated = repository.findById('updateGroupIdNull');
      expect(updated).toBeDefined();
      expect(updated!.overlap).toBeNull();
    });

    it('should delete a group', () => {
      (generateRandomId as jest.Mock).mockReturnValueOnce('deleteGroupId');

      const groupToCreate: Omit<SouthItemGroupEntity, 'id' | 'created_at' | 'updated_at'> = {
        name: 'Group To Delete',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        shareTrackedInstant: false,
        overlap: null
      };

      repository.create(groupToCreate);
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
        share_tracked_instant: 1,
        overlap: 20,
        scan_mode_id_full: testData.scanMode.list[0].id,
        scan_mode_name: testData.scanMode.list[0].name,
        scan_mode_description: testData.scanMode.list[0].description,
        scan_mode_cron: testData.scanMode.list[0].cron
      };

      const converted = toSouthItemGroup(dbResult);
      expect(converted.id).toEqual('testId');
      expect(converted.name).toEqual('Test Group');
      expect(converted.southId).toEqual('southId1');
      expect(converted.scanMode.id).toEqual(testData.scanMode.list[0].id);
      expect(converted.scanMode.name).toEqual(testData.scanMode.list[0].name);
      expect(converted.shareTrackedInstant).toEqual(true);
      expect(converted.overlap).toEqual(20);
    });

    it('should convert database result with null overlap', () => {
      const dbResult: Record<string, string | number | null> = {
        id: 'testId2',
        created_at: '2024-01-01 00:00:00',
        updated_at: '2024-01-01 00:00:00',
        name: 'Test Group 2',
        south_id: 'southId1',
        scan_mode_id: testData.scanMode.list[0].id,
        share_tracked_instant: 0,
        overlap: null,
        scan_mode_id_full: testData.scanMode.list[0].id,
        scan_mode_name: testData.scanMode.list[0].name,
        scan_mode_description: testData.scanMode.list[0].description,
        scan_mode_cron: testData.scanMode.list[0].cron
      };

      const converted = toSouthItemGroup(dbResult as Record<string, string | number>);
      expect(converted.shareTrackedInstant).toEqual(false);
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
        share_tracked_instant: 0,
        overlap: undefined,
        scan_mode_id_full: testData.scanMode.list[0].id,
        scan_mode_name: testData.scanMode.list[0].name,
        scan_mode_description: testData.scanMode.list[0].description,
        scan_mode_cron: testData.scanMode.list[0].cron
      };

      const converted = toSouthItemGroup(dbResult as Record<string, string | number>);
      expect(converted.overlap).toBeNull();
    });
  });
});
