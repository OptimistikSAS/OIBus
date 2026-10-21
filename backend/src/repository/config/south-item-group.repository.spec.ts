import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

import { Database } from 'better-sqlite3';

import { SouthItemGroupCommand } from '../../model/south-connector.model';
import AuditService from '../../service/audit.service';
import { emptyDatabase, initDatabase } from '../../tests/utils/database-utils';
import testData from '../../tests/utils/test-data';
import { createAuditServiceMock, Mocked } from '../../tests/utils/test-utils';
import SouthConnectorRepository from './south-connector.repository';
import SouthItemGroupRepository, { toSouthItemGroup } from './south-item-group.repository';

const TEST_DB_PATH = 'src/tests/test-config-south-item-group.db';

type GroupUpdate = Omit<SouthItemGroupCommand, 'southId'>;

const groupUpdate = (name: string, overrides: Partial<GroupUpdate> = {}): GroupUpdate => ({
  name,
  scanMode: testData.scanMode.list[0],
  startTimeOffset: null,
  endTimeOffset: null,
  maxReadInterval: null,
  readDelay: 0,
  recoveryStrategy: null,
  cachingStrategy: null,
  ...overrides
});

/** A group of the first south connector. */
const groupCommand = (name: string, overrides: Partial<GroupUpdate> = {}): SouthItemGroupCommand => ({
  southId: testData.south.list[0].id,
  ...groupUpdate(name, overrides)
});

/** A south_item_groups row joined with its scan mode. */
const groupRow = (id: string, name: string, columns: Record<string, string | number | null | undefined>) =>
  ({
    id,
    created_at: '2024-01-01 00:00:00',
    updated_at: '2024-01-01 00:00:00',
    name,
    south_id: 'southId1',
    scan_mode_id: testData.scanMode.list[0].id,
    ...columns,
    sm_id: testData.scanMode.list[0].id,
    sm_name: testData.scanMode.list[0].name,
    sm_description: testData.scanMode.list[0].description,
    sm_cron: testData.scanMode.list[0].cron,
    sm_type: testData.scanMode.list[0].type
  }) as Record<string, string | number>;

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
    let auditService: Mocked<AuditService>;

    beforeEach(() => {
      auditService = createAuditServiceMock();
      repository = new SouthItemGroupRepository(database, auditService);
    });

    it('should find a group by id', () => {
      const created = repository.create(groupCommand('Test Group 1'), 'userTest');

      const found = repository.findById(created.id);
      assert.ok(found);
      assert.strictEqual(found.id, created.id);
      assert.strictEqual(found.name, 'Test Group 1');
      assert.strictEqual(found.southId, testData.south.list[0].id);
      assert.strictEqual(found.scanMode.id, testData.scanMode.list[0].id);
      assert.strictEqual(found.startTimeOffset, null);
    });

    it('should return null when finding non-existing group', () => {
      const found = repository.findById('nonExistingId');
      assert.strictEqual(found, null);
    });

    it('should find groups by south id', () => {
      repository.create(groupCommand('Group A', { startTimeOffset: 10 }), 'userTest');
      repository.create(groupCommand('Group B', { scanMode: testData.scanMode.list[1] }), 'userTest');

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
      const created = repository.create(groupCommand('Find By Name Group'), 'userTest');

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
      repository.create(groupCommand('Group For Different South'), 'userTest');

      const found = repository.findByNameAndSouthId('Group For Different South', 'differentSouthId');
      assert.strictEqual(found, null);
    });

    it('should create a group with generated id', () => {
      const created = repository.create(groupCommand('New Group', { startTimeOffset: 5 }), 'userTest');
      assert.ok(created.id);
      assert.strictEqual(created.name, 'New Group');
      assert.strictEqual(created.southId, testData.south.list[0].id);
      assert.strictEqual(created.scanMode.id, testData.scanMode.list[0].id);
      assert.strictEqual(created.startTimeOffset, 5);

      assert.deepStrictEqual(
        auditService.record.mock.calls.map(call => call.arguments),
        [['south_item_group', created.id, 'CREATE', null, created, 'userTest']]
      );
    });

    it('should persist and update a non-null cachingStrategy on a group', () => {
      const created = repository.create(groupCommand('Group With Caching Strategy', { cachingStrategy: 'onChange' }), 'userTest');
      assert.strictEqual(created.cachingStrategy, 'onChange');

      const found = repository.findById(created.id);
      assert.strictEqual(found!.cachingStrategy, 'onChange');

      repository.update(
        created.id,
        {
          name: created.name,
          scanMode: created.scanMode,
          startTimeOffset: created.startTimeOffset,
          endTimeOffset: created.endTimeOffset,
          maxReadInterval: created.maxReadInterval,
          readDelay: created.readDelay,
          recoveryStrategy: created.recoveryStrategy,
          cachingStrategy: 'threshold'
        },
        'userTest'
      );

      const updated = repository.findById(created.id);
      assert.strictEqual(updated!.cachingStrategy, 'threshold');
    });

    it('should create a group with custom id', () => {
      const customId = 'customGroupId';
      const created = repository.create(groupCommand('Custom Group'), 'userTest', customId);
      assert.strictEqual(created.id, customId);
      assert.strictEqual(created.name, 'Custom Group');

      const found = repository.findById(customId);
      assert.ok(found);
      assert.strictEqual(found.id, customId);
    });

    it('should throw error when create fails to find created group', () => {
      // The repository is rebuilt for each test: the stub needs no restore
      mock.method(repository, 'findById', () => null);

      assert.throws(
        () => repository.create(groupCommand('Group That Will Fail'), 'userTest', 'failingGroupId'),
        /Failed to create south item group with id failingGroupId/
      );
    });

    it('should update a group', () => {
      const created = repository.create(groupCommand('Original Name'), 'userTest');

      const before = repository.findById(created.id);
      repository.update(created.id, groupUpdate('Updated Name', { scanMode: testData.scanMode.list[1], startTimeOffset: 15 }), 'userTest');

      const updated = repository.findById(created.id);
      assert.ok(updated);
      assert.strictEqual(updated.name, 'Updated Name');
      assert.strictEqual(updated.scanMode.id, testData.scanMode.list[1].id);
      assert.strictEqual(updated.startTimeOffset, 15);
      assert.strictEqual(updated.southId, testData.south.list[0].id);

      assert.strictEqual(auditService.record.mock.callCount(), 2); // create + update
      assert.deepStrictEqual(auditService.record.mock.calls[1].arguments, [
        'south_item_group',
        created.id,
        'UPDATE',
        before,
        updated,
        'userTest'
      ]);
    });

    it('should cascade a group scan mode change to its synced member items', () => {
      const southConnectorRepository = new SouthConnectorRepository(database, auditService);

      const group = repository.create(groupCommand('Cascade Group'), 'userTest');

      const existingItems = southConnectorRepository.findAllItemsForSouth(testData.south.list[0].id);
      const itemToSync = existingItems[0];
      southConnectorRepository.moveItemsToGroup([itemToSync.id], group.id);

      const syncedItemBefore = southConnectorRepository.findItemById(testData.south.list[0].id, itemToSync.id);
      assert.ok(syncedItemBefore);
      assert.strictEqual(syncedItemBefore.scanMode!.id, testData.scanMode.list[0].id);

      repository.update(group.id, groupUpdate('Cascade Group', { scanMode: testData.scanMode.list[1] }), 'userTest');

      const syncedItemAfter = southConnectorRepository.findItemById(testData.south.list[0].id, itemToSync.id);
      assert.ok(syncedItemAfter);
      assert.strictEqual(
        syncedItemAfter.scanMode!.id,
        testData.scanMode.list[1].id,
        "member item's own scan_mode_id must follow the group's, otherwise it keeps a stale FK to the old scan mode"
      );
    });

    it('should update a group with null startTimeOffset', () => {
      const created = repository.create(groupCommand('Group With StartTimeOffset', { startTimeOffset: 10 }), 'userTest');

      repository.update(created.id, groupUpdate('Updated Name Null'), 'userTest');

      const updated = repository.findById(created.id);
      assert.ok(updated);
      assert.strictEqual(updated.startTimeOffset, null);
    });

    it('should delete a group', () => {
      const created = repository.create(groupCommand('Group To Delete'), 'userTest');
      assert.ok(repository.findById(created.id));

      repository.delete(created.id, 'userTest');
      assert.strictEqual(repository.findById(created.id), null);

      assert.strictEqual(auditService.record.mock.callCount(), 2); // create + delete
      assert.deepStrictEqual(auditService.record.mock.calls[1].arguments, [
        'south_item_group',
        created.id,
        'DELETE',
        created,
        null,
        'userTest'
      ]);
    });

    it('should convert database result to SouthItemGroupEntity', () => {
      const dbResult = groupRow('testId', 'Test Group', {
        start_time_offset: 20,
        end_time_offset: 0,
        max_read_interval: 3600,
        read_delay: 200
      });

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
      assert.strictEqual(converted.startTimeOffset, 20);
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

    it('should convert database result with null start_time_offset', () => {
      const converted = toSouthItemGroup(groupRow('testId2', 'Test Group 2', { start_time_offset: null, end_time_offset: null }), []);
      assert.strictEqual(converted.startTimeOffset, null);
    });

    it('should convert database result with undefined start_time_offset', () => {
      const converted = toSouthItemGroup(
        groupRow('testId3', 'Test Group 3', { start_time_offset: undefined, end_time_offset: undefined }),
        []
      );
      assert.strictEqual(converted.startTimeOffset, null);
    });

    it('should convert database result with null max_read_interval', () => {
      const converted = toSouthItemGroup(
        groupRow('testId4', 'Test Group 4', { startTimeOffset: null, endTimeOffset: null, max_read_interval: null, read_delay: 0 }),
        []
      );
      assert.strictEqual(converted.maxReadInterval, null);
      assert.strictEqual(converted.readDelay, 0);
    });

    it('should convert database result with a non-null recovery strategy', () => {
      const converted = toSouthItemGroup(
        groupRow('testId5', 'Test Group 5', {
          start_time_offset: 0,
          end_time_offset: 0,
          max_read_interval: 3600,
          read_delay: 200,
          recovery_strategy: 'oldest'
        }),
        []
      );
      assert.strictEqual(converted.recoveryStrategy, 'oldest');
    });
  });
});
