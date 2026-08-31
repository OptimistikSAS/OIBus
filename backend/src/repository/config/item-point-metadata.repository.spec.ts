import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import ItemPointMetadataRepository from './item-point-metadata.repository';
import ConfigurationWorkflowRepository from './configuration-workflow.repository';
import { createAuditServiceMock, emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { ItemPointMetadataWrite } from '../../model/item-point-metadata.model';

const TEST_DB_PATH = 'src/tests/test-config-item-point-metadata.db';

let database: Database;
describe('Item Point Metadata Repository', () => {
  let workflowId: string;
  let itemId: string;
  let otherItemId: string;

  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
    itemId = testData.south.list[0].items[0].id;
    otherItemId = testData.south.list[0].items[1].id;
    const workflowRepository = new ConfigurationWorkflowRepository(database, createAuditServiceMock());
    workflowId = workflowRepository.create(
      {
        name: 'Item point metadata test workflow',
        southId: testData.south.list[0].id,
        targetItemId: null,
        discoveryScope: { rootNodeId: 'ns=1;s=Root' },
        identityKeyFields: ['nodeId'],
        eligibilityFilter: [],
        itemFieldMapping: { name: '{{name}}' },
        remoteFieldMapping: { unit: '{{unit}}' },
        scanMode: null,
        enabled: true
      },
      'userTest'
    ).id;
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  describe('Item point metadata operations', () => {
    let repository: ItemPointMetadataRepository;

    const write: ItemPointMetadataWrite = {
      workflowId: '',
      southItemId: '',
      discoveredEntryKey: 'ns=1;s=Temperature',
      discoveredMetadata: { nodeId: 'ns=1;s=Temperature', type: 'Variable' },
      description: 'Reactor temperature',
      unit: '°C',
      minAcceptableValue: -20,
      maxAcceptableValue: 120,
      resolution: null,
      resamplingMethod: null,
      remoteMetadataExtra: null
    };

    beforeEach(() => {
      repository = new ItemPointMetadataRepository(database);
    });

    it('should create a point and find it by id', () => {
      const created = repository.create({ ...write, workflowId, southItemId: itemId });

      assert.strictEqual(created.workflowId, workflowId);
      assert.strictEqual(created.southItemId, itemId);
      assert.deepStrictEqual(created.discoveredMetadata, { nodeId: 'ns=1;s=Temperature', type: 'Variable' });
      assert.strictEqual(created.unit, '°C');
      assert.strictEqual(created.minAcceptableValue, -20);
      assert.strictEqual(created.maxAcceptableValue, 120);
      assert.strictEqual(created.status, 'active');
      assert.strictEqual(created.orphanedAt, null);
      assert.strictEqual(created.lastPushedAt, null);

      assert.deepStrictEqual(repository.findById(created.id), created);
    });

    it('should find a point by workflow and discovered entry key', () => {
      const created = repository.create({ ...write, workflowId, southItemId: itemId, discoveredEntryKey: 'ns=1;s=Unique' });

      const found = repository.findByWorkflowAndKey(workflowId, 'ns=1;s=Unique');
      assert.deepStrictEqual(found, created);
      assert.strictEqual(repository.findByWorkflowAndKey(workflowId, 'ns=1;s=DoesNotExist'), null);
    });

    it('should find all points for a workflow', () => {
      repository.create({ ...write, workflowId, southItemId: itemId, discoveredEntryKey: 'a' });
      repository.create({ ...write, workflowId, southItemId: itemId, discoveredEntryKey: 'b' });

      const all = repository.findAllByWorkflow(workflowId);
      assert.ok(all.length >= 2);
      assert.ok(all.every(point => point.workflowId === workflowId));
    });

    it('should find all points sharing one item (the N:1 SQL case)', () => {
      repository.create({ ...write, workflowId, southItemId: itemId, discoveredEntryKey: 'columnA' });
      repository.create({ ...write, workflowId, southItemId: itemId, discoveredEntryKey: 'columnB' });
      repository.create({ ...write, workflowId, southItemId: otherItemId, discoveredEntryKey: 'columnC' });

      const forItem = repository.findBySouthItemId(itemId);
      assert.ok(forItem.length >= 2);
      assert.ok(forItem.every(point => point.southItemId === itemId));
    });

    it('should update a point, reactivating it if it had orphaned', () => {
      const created = repository.create({ ...write, workflowId, southItemId: itemId, discoveredEntryKey: 'ns=1;s=Reactivate' });
      repository.markOrphaned(created.id);
      assert.strictEqual(repository.findById(created.id)!.status, 'orphaned');

      repository.update(created.id, {
        discoveredEntryKey: created.discoveredEntryKey,
        discoveredMetadata: { nodeId: 'ns=1;s=Reactivate', type: 'Variable' },
        description: 'Updated description',
        unit: '°F',
        minAcceptableValue: 0,
        maxAcceptableValue: 250,
        resolution: 0.1,
        resamplingMethod: 'mean',
        remoteMetadataExtra: { calibratedAt: '2026-01-01' }
      });

      const updated = repository.findById(created.id)!;
      assert.strictEqual(updated.status, 'active');
      assert.strictEqual(updated.orphanedAt, null);
      assert.strictEqual(updated.unit, '°F');
      assert.strictEqual(updated.resolution, 0.1);
      assert.strictEqual(updated.resamplingMethod, 'mean');
      assert.deepStrictEqual(updated.remoteMetadataExtra, { calibratedAt: '2026-01-01' });
    });

    it('should mark a point orphaned without deleting it', () => {
      const created = repository.create({ ...write, workflowId, southItemId: itemId, discoveredEntryKey: 'ns=1;s=ToOrphan' });

      repository.markOrphaned(created.id);

      const found = repository.findById(created.id)!;
      assert.strictEqual(found.status, 'orphaned');
      assert.ok(found.orphanedAt);
    });

    it('should mark a point pushed', () => {
      const created = repository.create({ ...write, workflowId, southItemId: itemId, discoveredEntryKey: 'ns=1;s=ToPush' });
      assert.strictEqual(created.lastPushedAt, null);

      repository.markPushed(created.id);

      assert.ok(repository.findById(created.id)!.lastPushedAt);
    });

    it('should delete a point', () => {
      const created = repository.create({ ...write, workflowId, southItemId: itemId, discoveredEntryKey: 'ns=1;s=ToDelete' });

      repository.delete(created.id);

      assert.strictEqual(repository.findById(created.id), null);
    });

    it('should return null/empty when nothing matches', () => {
      assert.strictEqual(repository.findById('nonExistingId'), null);
      assert.deepStrictEqual(repository.findAllByWorkflow('nonExistingWorkflowId'), []);
      assert.deepStrictEqual(repository.findBySouthItemId('nonExistingItemId'), []);
    });
  });
});
