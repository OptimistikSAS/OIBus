import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import WorkflowRunRepository from './workflow-run.repository';
import ConfigurationWorkflowRepository from './configuration-workflow.repository';
import { createAuditServiceMock, emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { WorkflowRunCounts } from '../../model/workflow-run.model';

const TEST_DB_PATH = 'src/tests/test-config-workflow-run.db';

let database: Database;
describe('Workflow Run Repository', () => {
  let workflowId: string;

  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
    const workflowRepository = new ConfigurationWorkflowRepository(database, createAuditServiceMock());
    workflowId = workflowRepository.create(
      {
        southId: testData.south.list[0].id,
        targetItemId: null,
        discoveryScope: { rootNodeId: 'ns=1;s=Root' },
        identityKeyFields: ['nodeId'],
        eligibilityFilter: [],
        itemFieldMapping: { name: '{{name}}' },
        remoteFieldMapping: null,
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

  describe('Workflow run operations', () => {
    let repository: WorkflowRunRepository;

    const fullCounts: WorkflowRunCounts = {
      discoveredCount: 120,
      eligibleCount: 45,
      createdCount: 3,
      updatedCount: 2,
      disabledCount: 1,
      pushedCount: 5
    };

    beforeEach(() => {
      repository = new WorkflowRunRepository(database);
    });

    it('should start a run as RUNNING with zeroed counts', () => {
      const run = repository.start(workflowId, 'manual', 'userTest');

      assert.strictEqual(run.workflowId, workflowId);
      assert.strictEqual(run.triggerType, 'manual');
      assert.strictEqual(run.status, 'RUNNING');
      assert.strictEqual(run.completedAt, null);
      assert.strictEqual(run.error, null);
      assert.strictEqual(run.triggeredBy, 'userTest');
      assert.deepStrictEqual(
        {
          discoveredCount: run.discoveredCount,
          eligibleCount: run.eligibleCount,
          createdCount: run.createdCount,
          updatedCount: run.updatedCount,
          disabledCount: run.disabledCount,
          pushedCount: run.pushedCount
        },
        { discoveredCount: 0, eligibleCount: 0, createdCount: 0, updatedCount: 0, disabledCount: 0, pushedCount: 0 }
      );
    });

    it('should start a scheduled run with no triggeredBy', () => {
      const run = repository.start(workflowId, 'scheduled', null);

      assert.strictEqual(run.triggerType, 'scheduled');
      assert.strictEqual(run.triggeredBy, null);
    });

    it('should complete a run with its final counts', () => {
      const run = repository.start(workflowId, 'manual', 'userTest');

      repository.complete(run.id, fullCounts);

      const found = repository.findById(run.id);
      assert.strictEqual(found!.status, 'COMPLETED');
      assert.ok(found!.completedAt);
      assert.strictEqual(found!.error, null);
      assert.strictEqual(found!.discoveredCount, 120);
      assert.strictEqual(found!.eligibleCount, 45);
      assert.strictEqual(found!.createdCount, 3);
      assert.strictEqual(found!.updatedCount, 2);
      assert.strictEqual(found!.disabledCount, 1);
      assert.strictEqual(found!.pushedCount, 5);
    });

    it('should fail a run with an error and whatever counts it reached', () => {
      const run = repository.start(workflowId, 'manual', 'userTest');

      repository.fail(run.id, 'OPCUA explore session expired, please restart the exploration', {
        ...fullCounts,
        eligibleCount: 0,
        createdCount: 0,
        updatedCount: 0,
        disabledCount: 0,
        pushedCount: 0
      });

      const found = repository.findById(run.id);
      assert.strictEqual(found!.status, 'ERRORED');
      assert.ok(found!.completedAt);
      assert.strictEqual(found!.error, 'OPCUA explore session expired, please restart the exploration');
      assert.strictEqual(found!.discoveredCount, 120);
      assert.strictEqual(found!.createdCount, 0);
    });

    it('should default fail() counts to zero when the failure happens before any count is known', () => {
      const run = repository.start(workflowId, 'manual', 'userTest');

      repository.fail(run.id, 'Could not connect to the data source');

      const found = repository.findById(run.id);
      assert.strictEqual(found!.status, 'ERRORED');
      assert.strictEqual(found!.discoveredCount, 0);
      assert.strictEqual(found!.error, 'Could not connect to the data source');
    });

    it('should return null when finding a non-existing run', () => {
      assert.strictEqual(repository.findById('nonExistingId'), null);
    });

    it('should find runs by workflow id, newest first, paginated', () => {
      repository.start(workflowId, 'manual', 'userTest');
      repository.start(workflowId, 'scheduled', null);

      const page = repository.findByWorkflowId(workflowId, 0);

      assert.ok(page.content.length >= 2);
      assert.ok(page.content.every(run => run.workflowId === workflowId));
      assert.ok(page.totalElements >= 2);
      assert.strictEqual(page.size, 50);
      assert.strictEqual(page.number, 0);
      for (let i = 1; i < page.content.length; i++) {
        assert.ok(page.content[i - 1].startedAt >= page.content[i].startedAt);
      }
    });

    it('should return an empty page when finding runs for a non-existing workflow id', () => {
      const page = repository.findByWorkflowId('nonExistingWorkflowId', 0);

      assert.deepStrictEqual(page.content, []);
      assert.strictEqual(page.totalElements, 0);
    });
  });
});
