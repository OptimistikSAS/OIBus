import { before, after, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import ConfigurationWorkflowRepository from './configuration-workflow.repository';
import { createAuditServiceMock, emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { ConfigurationWorkflowCommand } from '../../model/configuration-workflow.model';
import AuditService from '../../service/audit.service';

const TEST_DB_PATH = 'src/tests/test-config-configuration-workflow.db';

let database: Database;
describe('Configuration Workflow Repository', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  describe('Configuration workflow operations', () => {
    let repository: ConfigurationWorkflowRepository;
    let auditService: AuditService;

    const selfScopedCommand: ConfigurationWorkflowCommand = {
      name: 'Self-scoped workflow',
      southId: testData.south.list[0].id,
      targetItemId: null,
      discoveryScope: { rootNodeId: 'ns=1;s=Root' },
      identityKeyFields: ['nodeId'],
      eligibilityFilter: [{ field: 'type', operator: 'equals', value: 'Variable' }],
      itemFieldMapping: { name: '{{name}}', 'settings.nodeId': '{{nodeId}}' },
      remoteFieldMapping: null,
      scanMode: testData.scanMode.list[0],
      enabled: true
    };

    beforeEach(() => {
      auditService = createAuditServiceMock();
      repository = new ConfigurationWorkflowRepository(database, auditService);
    });

    it('should create a self-scoped workflow (no target item) and find it by id', () => {
      const created = repository.create(selfScopedCommand, 'userTest');

      assert.strictEqual(created.southId, testData.south.list[0].id);
      assert.strictEqual(created.targetItemId, null);
      assert.deepStrictEqual(created.discoveryScope, { rootNodeId: 'ns=1;s=Root' });
      assert.deepStrictEqual(created.identityKeyFields, ['nodeId']);
      assert.deepStrictEqual(created.eligibilityFilter, [{ field: 'type', operator: 'equals', value: 'Variable' }]);
      assert.deepStrictEqual(created.itemFieldMapping, { name: '{{name}}', 'settings.nodeId': '{{nodeId}}' });
      assert.strictEqual(created.remoteFieldMapping, null);
      assert.strictEqual(created.scanMode!.id, testData.scanMode.list[0].id);
      assert.strictEqual(created.enabled, true);

      const found = repository.findById(created.id);
      assert.deepStrictEqual(found, created);

      assert.strictEqual((auditService.record as unknown as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      const call = (auditService.record as unknown as ReturnType<typeof mock.fn>).mock.calls[0];
      assert.deepStrictEqual(call.arguments.slice(0, 3), ['configuration_workflow', created.id, 'CREATE']);
      assert.strictEqual(call.arguments[3], null);
    });

    it('should create a workflow targeting one existing item, with no scan mode (manual-only)', () => {
      const command: ConfigurationWorkflowCommand = {
        name: 'Metadata query workflow',
        southId: testData.south.list[0].id,
        targetItemId: testData.south.list[0].items[0].id,
        discoveryScope: { query: 'SELECT tag_name, unit, min, max FROM metadata_table' },
        identityKeyFields: ['tagName'],
        eligibilityFilter: [],
        itemFieldMapping: {},
        remoteFieldMapping: { unit: '{{unit}}' },
        scanMode: null,
        enabled: true
      };

      const created = repository.create(command, 'userTest');

      assert.strictEqual(created.targetItemId, testData.south.list[0].items[0].id);
      assert.deepStrictEqual(created.remoteFieldMapping, { unit: '{{unit}}' });
      assert.strictEqual(created.scanMode, null);
    });

    it('should create a remote-metadata-only workflow (itemFieldMapping null — never touches items)', () => {
      const command: ConfigurationWorkflowCommand = {
        name: 'Remote metadata only workflow',
        southId: testData.south.list[0].id,
        targetItemId: testData.south.list[0].items[0].id,
        discoveryScope: { query: 'SELECT tag_name, unit FROM metadata_table' },
        identityKeyFields: ['tagName'],
        eligibilityFilter: [],
        itemFieldMapping: null,
        remoteFieldMapping: { unit: '{{unit}}' },
        scanMode: null,
        enabled: true
      };

      const created = repository.create(command, 'userTest');

      assert.strictEqual(created.itemFieldMapping, null);
      assert.deepStrictEqual(created.remoteFieldMapping, { unit: '{{unit}}' });

      const found = repository.findById(created.id);
      assert.strictEqual(found!.itemFieldMapping, null);
    });

    it('should return null when finding a non-existing workflow', () => {
      assert.strictEqual(repository.findById('nonExistingId'), null);
    });

    it('should find workflows by south id', () => {
      repository.create({ ...selfScopedCommand, name: 'Workflow A', discoveryScope: { rootNodeId: 'a' } }, 'userTest');
      repository.create({ ...selfScopedCommand, name: 'Workflow B', discoveryScope: { rootNodeId: 'b' } }, 'userTest');

      const found = repository.findBySouthId(testData.south.list[0].id);
      assert.ok(found.length >= 2);
      assert.ok(found.every(workflow => workflow.southId === testData.south.list[0].id));
    });

    it('should return an empty array when finding workflows for a non-existing south id', () => {
      assert.deepStrictEqual(repository.findBySouthId('nonExistingSouthId'), []);
    });

    it('should update a workflow and record the audit diff', () => {
      const created = repository.create({ ...selfScopedCommand, name: 'Update test workflow' }, 'userTest');

      repository.update(
        created.id,
        {
          name: 'Updated workflow name',
          targetItemId: null,
          discoveryScope: { rootNodeId: 'ns=1;s=Updated' },
          identityKeyFields: ['nodeId', 'parentPath'],
          eligibilityFilter: [],
          itemFieldMapping: { name: '{{name}}' },
          remoteFieldMapping: { unit: '{{unit}}' },
          scanMode: testData.scanMode.list[1],
          enabled: false
        },
        'updateUser'
      );

      const updated = repository.findById(created.id);
      assert.deepStrictEqual(updated!.discoveryScope, { rootNodeId: 'ns=1;s=Updated' });
      assert.deepStrictEqual(updated!.identityKeyFields, ['nodeId', 'parentPath']);
      assert.deepStrictEqual(updated!.eligibilityFilter, []);
      assert.deepStrictEqual(updated!.remoteFieldMapping, { unit: '{{unit}}' });
      assert.strictEqual(updated!.scanMode!.id, testData.scanMode.list[1].id);
      assert.strictEqual(updated!.enabled, false);
      assert.strictEqual(updated!.updatedBy, 'updateUser');

      const updateCall = (auditService.record as unknown as ReturnType<typeof mock.fn>).mock.calls[1];
      assert.deepStrictEqual(updateCall.arguments.slice(0, 3), ['configuration_workflow', created.id, 'UPDATE']);
    });

    it('should delete a workflow and record the audit deletion', () => {
      const created = repository.create({ ...selfScopedCommand, name: 'Delete test workflow' }, 'userTest');

      repository.delete(created.id, 'deleteUser');

      assert.strictEqual(repository.findById(created.id), null);
      const deleteCall = (auditService.record as unknown as ReturnType<typeof mock.fn>).mock.calls[1];
      assert.deepStrictEqual(deleteCall.arguments.slice(0, 3), ['configuration_workflow', created.id, 'DELETE']);
      assert.strictEqual(deleteCall.arguments[4], null);
    });

    it('should silently no-op deleting a non-existing workflow (no audit record)', () => {
      repository.delete('nonExistingId', 'deleteUser');

      assert.strictEqual((auditService.record as unknown as ReturnType<typeof mock.fn>).mock.calls.length, 0);
    });
  });
});
