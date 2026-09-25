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

    const localCommand: ConfigurationWorkflowCommand = {
      name: 'Local (self-scoped) workflow',
      southId: testData.south.list[0].id,
      discoveryScope: { rootNodeId: 'ns=1;s=Root' },
      identityKeyFields: ['nodeId'],
      eligibilityFilter: [{ field: 'type', operator: 'equals', value: 'Variable' }],
      itemFieldMapping: { name: '{{name}}', 'settings.nodeId': '{{nodeId}}' },
      pushToOIAnalytics: false,
      scanMode: testData.scanMode.list[0],
      enabled: true
    };

    beforeEach(() => {
      auditService = createAuditServiceMock();
      repository = new ConfigurationWorkflowRepository(database, auditService);
    });

    it('should create a local (item-creating) workflow and find it by id', () => {
      const created = repository.create(localCommand, 'userTest');

      assert.strictEqual(created.southId, testData.south.list[0].id);
      assert.deepStrictEqual(created.discoveryScope, { rootNodeId: 'ns=1;s=Root' });
      assert.deepStrictEqual(created.identityKeyFields, ['nodeId']);
      assert.deepStrictEqual(created.eligibilityFilter, [{ field: 'type', operator: 'equals', value: 'Variable' }]);
      assert.deepStrictEqual(created.itemFieldMapping, { name: '{{name}}', 'settings.nodeId': '{{nodeId}}' });
      assert.strictEqual(created.pushToOIAnalytics, false);
      assert.strictEqual(created.scanMode!.id, testData.scanMode.list[0].id);
      assert.strictEqual(created.enabled, true);

      const found = repository.findById(created.id);
      assert.deepStrictEqual(found, created);

      assert.strictEqual((auditService.record as unknown as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      const call = (auditService.record as unknown as ReturnType<typeof mock.fn>).mock.calls[0];
      assert.deepStrictEqual(call.arguments.slice(0, 3), ['configuration_workflow', created.id, 'CREATE']);
      assert.strictEqual(call.arguments[3], null);
    });

    it('should create a remote (push-to-OIAnalytics) workflow, with no scan mode (manual-only)', () => {
      const command: ConfigurationWorkflowCommand = {
        name: 'Metadata query workflow',
        southId: testData.south.list[0].id,
        discoveryScope: { query: 'SELECT tag_name, unit, min, max FROM metadata_table' },
        identityKeyFields: ['tagName'],
        eligibilityFilter: [],
        itemFieldMapping: null,
        pushToOIAnalytics: true,
        scanMode: null,
        enabled: true
      };

      const created = repository.create(command, 'userTest');

      assert.strictEqual(created.itemFieldMapping, null);
      assert.strictEqual(created.pushToOIAnalytics, true);
      assert.strictEqual(created.scanMode, null);

      const found = repository.findById(created.id);
      assert.strictEqual(found!.itemFieldMapping, null);
      assert.strictEqual(found!.pushToOIAnalytics, true);
    });

    it('should return null when finding a non-existing workflow', () => {
      assert.strictEqual(repository.findById('nonExistingId'), null);
    });

    it('should find workflows by south id', () => {
      repository.create({ ...localCommand, name: 'Workflow A', discoveryScope: { rootNodeId: 'a' } }, 'userTest');
      repository.create({ ...localCommand, name: 'Workflow B', discoveryScope: { rootNodeId: 'b' } }, 'userTest');

      const found = repository.findBySouthId(testData.south.list[0].id);
      assert.ok(found.length >= 2);
      assert.ok(found.every(workflow => workflow.southId === testData.south.list[0].id));
    });

    it('should find every workflow, across souths', () => {
      const first = repository.create({ ...localCommand, name: 'Workflow all A' }, 'userTest');
      const second = repository.create({ ...localCommand, name: 'Workflow all B', southId: testData.south.list[1].id }, 'userTest');

      const found = repository.findAll();
      assert.deepStrictEqual(
        found
          .filter(workflow => [first.id, second.id].includes(workflow.id))
          .map(workflow => [workflow.id, workflow.southId])
          .sort(),
        [
          [first.id, testData.south.list[0].id],
          [second.id, testData.south.list[1].id]
        ].sort()
      );
    });

    it('should return an empty array when finding workflows for a non-existing south id', () => {
      assert.deepStrictEqual(repository.findBySouthId('nonExistingSouthId'), []);
    });

    it('should update a workflow and record the audit diff', () => {
      const created = repository.create({ ...localCommand, name: 'Update test workflow' }, 'userTest');

      repository.update(
        created.id,
        {
          name: 'Updated workflow name',
          discoveryScope: { rootNodeId: 'ns=1;s=Updated' },
          identityKeyFields: ['nodeId', 'parentPath'],
          eligibilityFilter: [],
          itemFieldMapping: { name: '{{name}}' },
          pushToOIAnalytics: false,
          scanMode: testData.scanMode.list[1],
          enabled: false
        },
        'updateUser'
      );

      const updated = repository.findById(created.id);
      assert.deepStrictEqual(updated!.discoveryScope, { rootNodeId: 'ns=1;s=Updated' });
      assert.deepStrictEqual(updated!.identityKeyFields, ['nodeId', 'parentPath']);
      assert.deepStrictEqual(updated!.eligibilityFilter, []);
      assert.deepStrictEqual(updated!.itemFieldMapping, { name: '{{name}}' });
      assert.strictEqual(updated!.scanMode!.id, testData.scanMode.list[1].id);
      assert.strictEqual(updated!.enabled, false);
      assert.strictEqual(updated!.updatedBy, 'updateUser');

      const updateCall = (auditService.record as unknown as ReturnType<typeof mock.fn>).mock.calls[1];
      assert.deepStrictEqual(updateCall.arguments.slice(0, 3), ['configuration_workflow', created.id, 'UPDATE']);
    });

    it('should delete a workflow and record the audit deletion', () => {
      const created = repository.create({ ...localCommand, name: 'Delete test workflow' }, 'userTest');

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
