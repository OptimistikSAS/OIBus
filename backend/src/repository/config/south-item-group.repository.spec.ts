import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Database } from 'better-sqlite3';
import SouthItemGroupRepository, { toSouthItemGroup } from './south-item-group.repository';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { SouthItemGroupCommand } from '../../model/south-connector.model';

const TEST_DB_PATH = 'src/tests/test-config-south-item-group.db';

let database: Database;
describe('South Item Group Repository', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  describe('South item group operations', () => {
    let repository: SouthItemGroupRepository;

    beforeEach(() => {
      repository = new SouthItemGroupRepository(database);
    });

    it('should find a group by id', () => {
      const groupToCreate: SouthItemGroupCommand = {
        name: 'Test Group 1',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };
      const created = repository.create(groupToCreate, 'userTest');

      const found = repository.findById(created.id);
      assert.ok(found);
      assert.strictEqual(found.id, created.id);
      assert.strictEqual(found.name, 'Test Group 1');
      assert.strictEqual(found.southId, testData.south.list[0].id);
      assert.strictEqual(found.scanMode.id, testData.scanMode.list[0].id);
      assert.strictEqual(found.overlap, null);
    });

    it('should return null when finding non-existing group', () => {
      const found = repository.findById('nonExistingId');
      assert.strictEqual(found, null);
    });

    it('should find groups by south id', () => {
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
      assert.ok(groups.length >= 2);
      const groupNames = groups.map(g => g.name);
      assert.ok(groupNames.includes('Group A'));
      assert.ok(groupNames.includes('Group B'));
    });

    it('should return empty array when finding groups for non-existing south id', () => {
      const groups = repository.findBySouthId('nonExistingSouthId');
      assert.deepStrictEqual(groups, []);
    });

    it('should find a group by name and south id', () => {
      const groupToCreate: SouthItemGroupCommand = {
        name: 'Find By Name Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };
      const created = repository.create(groupToCreate, 'userTest');

      const found = repository.findByNameAndSouthId('Find By Name Group', testData.south.list[0].id);
      assert.ok(found);
      assert.strictEqual(found.id, created.id);
      assert.strictEqual(found.name, 'Find By Name Group');
      assert.strictEqual(found.southId, testData.south.list[0].id);
    });

    it('should return null when finding group by name that does not exist', () => {
      const found = repository.findByNameAndSouthId('Non Existing Group', testData.south.list[0].id);
      assert.strictEqual(found, null);
    });

    it('should return null when finding group by name for different south id', () => {
      const groupToCreate: SouthItemGroupCommand = {
        name: 'Group For Different South',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };
      repository.create(groupToCreate, 'userTest');

      const found = repository.findByNameAndSouthId('Group For Different South', 'differentSouthId');
      assert.strictEqual(found, null);
    });

    it('should create a group with generated id', () => {
      const groupToCreate: SouthItemGroupCommand = {
        name: 'New Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: 5,
        maxReadInterval: null,
        readDelay: 0
      };

      const created = repository.create(groupToCreate, 'userTest');
      assert.ok(created.id);
      assert.strictEqual(created.name, 'New Group');
      assert.strictEqual(created.southId, testData.south.list[0].id);
      assert.strictEqual(created.scanMode.id, testData.scanMode.list[0].id);
      assert.strictEqual(created.overlap, 5);
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
      assert.strictEqual(created.id, customId);
      assert.strictEqual(created.name, 'Custom Group');

      const found = repository.findById(customId);
      assert.ok(found);
      assert.strictEqual(found.id, customId);
    });

    it('should throw error when create fails to find created group', () => {
      mock.method(repository, 'findById', () => null);

      const groupToCreate: SouthItemGroupCommand = {
        name: 'Group That Will Fail',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };

      assert.throws(
        () => repository.create(groupToCreate, 'userTest', 'failingGroupId'),
        /Failed to create south item group with id failingGroupId/
      );

      mock.restoreAll();
    });

    it('should update a group', () => {
      const groupToCreate: SouthItemGroupCommand = {
        name: 'Original Name',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };

      const created = repository.create(groupToCreate, 'userTest');

      const updateCommand: Omit<SouthItemGroupCommand, 'southId'> = {
        name: 'Updated Name',
        scanMode: testData.scanMode.list[1],
        overlap: 15,
        maxReadInterval: null,
        readDelay: 0
      };

      repository.update(created.id, updateCommand, 'userTest');

      const updated = repository.findById(created.id);
      assert.ok(updated);
      assert.strictEqual(updated.name, 'Updated Name');
      assert.strictEqual(updated.scanMode.id, testData.scanMode.list[1].id);
      assert.strictEqual(updated.overlap, 15);
      assert.strictEqual(updated.southId, testData.south.list[0].id);
    });

    it('should update a group with null overlap', () => {
      const groupToCreate: SouthItemGroupCommand = {
        name: 'Group With Overlap',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: 10,
        maxReadInterval: null,
        readDelay: 0
      };

      const created = repository.create(groupToCreate, 'userTest');

      const updateCommand: Omit<SouthItemGroupCommand, 'southId'> = {
        name: 'Updated Name Null',
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };

      repository.update(created.id, updateCommand, 'userTest');

      const updated = repository.findById(created.id);
      assert.ok(updated);
      assert.strictEqual(updated.overlap, null);
    });

    it('should delete a group', () => {
      const groupToCreate: SouthItemGroupCommand = {
        name: 'Group To Delete',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      };

      const created = repository.create(groupToCreate, 'userTest');
      assert.ok(repository.findById(created.id));

      repository.delete(created.id);
      assert.strictEqual(repository.findById(created.id), null);
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
      assert.strictEqual(converted.id, 'testId');
      assert.strictEqual(converted.name, 'Test Group');
      assert.strictEqual(converted.southId, 'southId1');
      assert.strictEqual(converted.scanMode.id, testData.scanMode.list[0].id);
      assert.strictEqual(converted.scanMode.name, testData.scanMode.list[0].name);
      assert.strictEqual(converted.overlap, 20);
      assert.strictEqual(converted.maxReadInterval, 3600);
      assert.strictEqual(converted.readDelay, 200);
      assert.deepStrictEqual(converted.items, [
        {
          id: 'itemId',
          name: 'itemName',
          enabled: false,
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
      assert.strictEqual(converted.overlap, null);
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
      assert.strictEqual(converted.overlap, null);
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
      assert.strictEqual(converted.maxReadInterval, null);
      assert.strictEqual(converted.readDelay, 0);
    });
  });
});
