import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import ConfigurationWorkflowRunService from './configuration-workflow-run.service';
import WorkflowRunRepositoryMock from '../tests/__mocks__/repository/config/workflow-run-repository.mock';
import ItemPointMetadataRepositoryMock from '../tests/__mocks__/repository/config/item-point-metadata-repository.mock';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import testData from '../tests/utils/test-data';
import { ConfigurationWorkflowEntity } from '../model/configuration-workflow.model';
import { ItemPointMetadataEntity } from '../model/item-point-metadata.model';
import { SouthConnectorItemEntity } from '../model/south-connector.model';
import { OIBusValidationError } from '../model/types';

const SOUTH_ID = testData.south.list[0].id;
const WORKFLOW_ID = 'workflowId1';

const baseWorkflow: ConfigurationWorkflowEntity = {
  id: WORKFLOW_ID,
  name: 'Reactor discovery',
  southId: SOUTH_ID,
  targetItemId: null,
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [{ field: 'type', operator: 'equals', value: 'Variable' }],
  itemFieldMapping: { name: '{{name}}', 'settings.nodeId': '{{nodeId}}' },
  remoteFieldMapping: null,
  scanMode: null,
  enabled: true,
  createdBy: 'userTest',
  updatedBy: 'userTest',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

const runningItem: SouthConnectorItemEntity<never> = {
  id: 'existingItemId',
  name: 'Temperature',
  enabled: true,
  scanMode: null,
  settings: { nodeId: 'ns=1;s=Temperature' } as never,
  group: null,
  syncWithGroup: false,
  maxReadInterval: null,
  readDelay: null,
  startTimeOffset: null,
  endTimeOffset: null,
  recoveryStrategy: null,
  createdBy: 'userTest',
  updatedBy: 'userTest',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

const startedRun = {
  id: 'runId1',
  workflowId: WORKFLOW_ID,
  triggerType: 'manual' as const,
  status: 'RUNNING' as const,
  startedAt: '2024-01-01T00:00:00.000Z',
  completedAt: null,
  discoveredCount: 0,
  eligibleCount: 0,
  createdCount: 0,
  updatedCount: 0,
  disabledCount: 0,
  pushedCount: 0,
  error: null,
  triggeredBy: 'userTest'
};

let configurationWorkflowService: { findById: ReturnType<typeof mock.fn> };
let workflowRunRepository: WorkflowRunRepositoryMock;
let itemPointMetadataRepository: ItemPointMetadataRepositoryMock;
let southConnectorRepository: SouthConnectorRepositoryMock;
let southService: SouthServiceMock;
let engine: DataStreamEngineMock;
let south: SouthConnectorMock;
let service: ConfigurationWorkflowRunService;

describe('Configuration Workflow Run Service', () => {
  beforeEach(() => {
    configurationWorkflowService = { findById: mock.fn(() => baseWorkflow) };
    workflowRunRepository = new WorkflowRunRepositoryMock();
    itemPointMetadataRepository = new ItemPointMetadataRepositoryMock();
    southConnectorRepository = new SouthConnectorRepositoryMock();
    southService = new SouthServiceMock();
    engine = new DataStreamEngineMock();
    south = new SouthConnectorMock(testData.south.list[0]);

    workflowRunRepository.start.mock.mockImplementation(() => startedRun);
    workflowRunRepository.findById.mock.mockImplementation(() => startedRun);
    engine.hasSouth.mock.mockImplementation(() => true);
    engine.getSouth.mock.mockImplementation(() => ({ south, metrics: {} }) as never);
    // enqueueWorkflowRun (inherited, unmocked, from the real SouthConnector base class) requires
    // the connector to be enabled to accept anything onto its queue.
    south.isEnabled.mock.mockImplementation(() => true);
    south.hasConfigurationDiscovery.mock.mockImplementation(() => true);
    south.discover.mock.mockImplementation(async () => []);
    southConnectorRepository.findItemById.mock.mockImplementation(() => runningItem as never);
    southService.createItem.mock.mockImplementation(async () => ({ ...runningItem, id: 'createdItemId' }) as never);

    service = new ConfigurationWorkflowRunService(
      configurationWorkflowService as never,
      workflowRunRepository,
      itemPointMetadataRepository,
      southConnectorRepository,
      southService as never,
      engine as never
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should throw without recording a run when the south connector is not registered in the engine', async () => {
    engine.hasSouth.mock.mockImplementation(() => false);
    // No south instance to enqueue onto - this is a pre-flight check, before any run record exists
    // (unlike a discovery-time failure, e.g. a missing hasConfigurationDiscovery, which does get
    // recorded as an ERRORED run, since retrieve() runs inside the queued executeRun()).
    await assert.rejects(
      service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest'),
      new OIBusValidationError(`South connector "${SOUTH_ID}" not found`)
    );
    assert.strictEqual(workflowRunRepository.start.mock.calls.length, 0);
  });

  it('should throw without queuing anything when this workflow is already queued or running', async () => {
    south.enqueueWorkflowRun = mock.fn(() => null) as never;
    await assert.rejects(
      service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest'),
      new OIBusValidationError(`Configuration workflow "${baseWorkflow.name}" is already running`)
    );
    assert.strictEqual(workflowRunRepository.start.mock.calls.length, 0);
  });

  it('should still run when the south connector is disabled - a workflow must be testable before its connector is switched on', async () => {
    south.isEnabled.mock.mockImplementation(() => false);
    const result = await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');
    assert.strictEqual(result, startedRun);
    assert.strictEqual(workflowRunRepository.start.mock.calls.length, 1);
  });

  it('should throw when the south connector does not support configuration discovery', async () => {
    south.hasConfigurationDiscovery.mock.mockImplementation(() => false);
    await assert.rejects(
      service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest'),
      new OIBusValidationError(`South connector "${SOUTH_ID}" does not support configuration discovery`)
    );
  });

  it('should start a run, then complete it with zeroed counts when discovery finds nothing', async () => {
    const result = await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');
    assert.strictEqual(result, startedRun);
    assert.deepStrictEqual(workflowRunRepository.start.mock.calls[0].arguments, [WORKFLOW_ID, 'manual', 'userTest']);
    const completeCall = workflowRunRepository.complete.mock.calls[0];
    assert.strictEqual(completeCall.arguments[0], 'runId1');
    assert.deepStrictEqual(completeCall.arguments[1], {
      discoveredCount: 0,
      eligibleCount: 0,
      createdCount: 0,
      updatedCount: 0,
      disabledCount: 0,
      pushedCount: 0
    });
  });

  it('should filter out ineligible records before counting/acting', async () => {
    south.discover.mock.mockImplementation(async () => [
      { nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' },
      { nodeId: 'ns=1;s=Folder', name: 'Folder', type: 'Object' }
    ]);
    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');
    const counts = workflowRunRepository.complete.mock.calls[0].arguments[1] as { discoveredCount: number; eligibleCount: number };
    assert.strictEqual(counts.discoveredCount, 2);
    assert.strictEqual(counts.eligibleCount, 1);
  });

  it('should create a new item for a brand-new discovered entry and claim ownership', async () => {
    south.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' }]);
    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');

    assert.strictEqual(southService.createItem.mock.calls.length, 1);
    const createCall = southService.createItem.mock.calls[0];
    assert.strictEqual(createCall.arguments[0], SOUTH_ID);
    assert.strictEqual(createCall.arguments[2], 'userTest');
    const command = createCall.arguments[1] as { name: string; settings: { nodeId: string } };
    assert.strictEqual(command.name, 'Temperature');
    assert.strictEqual(command.settings.nodeId, 'ns=1;s=Temperature');

    assert.deepStrictEqual(southConnectorRepository.claimItemForWorkflow.mock.calls[0].arguments, [
      SOUTH_ID,
      'createdItemId',
      WORKFLOW_ID,
      'userTest'
    ]);

    const counts = workflowRunRepository.complete.mock.calls[0].arguments[1] as { createdCount: number };
    assert.strictEqual(counts.createdCount, 1);
  });

  it('should coerce a mapped boolean/number constant to the type the south connector manifest (folder-scanner) actually declares', async () => {
    south.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' }]);
    configurationWorkflowService.findById.mock.mockImplementation(() => ({
      ...baseWorkflow,
      // 'enabled' is a top-level boolean manifest attribute; 'settings.minAge' is a number nested one
      // level under folder-scanner's own item settings - both typed in here as plain constant text,
      // exactly as the field-mapping UI produces for a "constant" (not {{variable}}) selection.
      itemFieldMapping: { name: '{{name}}', enabled: 'false', 'settings.minAge': '120' }
    }));

    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');

    const command = southService.createItem.mock.calls[0].arguments[1] as { enabled: boolean; settings: { minAge: number } };
    assert.strictEqual(command.enabled, false);
    assert.strictEqual(command.settings.minAge, 120);
  });

  it('should leave an unrecognized boolean constant untouched rather than guessing at it', async () => {
    south.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' }]);
    configurationWorkflowService.findById.mock.mockImplementation(() => ({
      ...baseWorkflow,
      itemFieldMapping: { name: '{{name}}', enabled: 'yes' }
    }));

    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');

    const command = southService.createItem.mock.calls[0].arguments[1] as { enabled: unknown };
    // Not coerced to a boolean - SouthService's own settings validation is left to catch the mistake,
    // rather than this silently guessing what "yes" was meant to mean.
    assert.strictEqual(command.enabled, 'yes');
  });

  it("should create a tracking point row even when remoteFieldMapping is null, for the next run's diff", async () => {
    south.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' }]);
    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');
    assert.strictEqual(itemPointMetadataRepository.create.mock.calls.length, 1);
    const write = itemPointMetadataRepository.create.mock.calls[0].arguments[0] as { southItemId: string; discoveredEntryKey: string };
    assert.strictEqual(write.southItemId, 'createdItemId');
    assert.strictEqual(write.discoveredEntryKey, 'nodeId=ns=1;s=Temperature');
  });

  it('should update the item this workflow previously created when the entry is re-discovered and changed', async () => {
    const previousPoint: ItemPointMetadataEntity = {
      id: 'pointId1',
      workflowId: WORKFLOW_ID,
      southItemId: 'existingItemId',
      discoveredEntryKey: 'nodeId=ns=1;s=Temperature',
      discoveredMetadata: { nodeId: 'ns=1;s=Temperature', name: 'Old Name', type: 'Variable' },
      description: null,
      unit: null,
      minAcceptableValue: null,
      maxAcceptableValue: null,
      resolution: null,
      resamplingMethod: null,
      remoteMetadataExtra: null,
      status: 'active',
      orphanedAt: null,
      lastPushedAt: null
    };
    itemPointMetadataRepository.findAllByWorkflow.mock.mockImplementation(() => [previousPoint]);
    south.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' }]);

    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');

    assert.strictEqual(southService.updateItem.mock.calls.length, 1);
    assert.strictEqual(southService.createItem.mock.calls.length, 0);
    const updateCall = southService.updateItem.mock.calls[0];
    assert.strictEqual(updateCall.arguments[0], SOUTH_ID);
    assert.strictEqual(updateCall.arguments[1], 'existingItemId');
    assert.strictEqual(southConnectorRepository.claimItemForWorkflow.mock.calls.length, 0);

    const counts = workflowRunRepository.complete.mock.calls[0].arguments[1] as { updatedCount: number; createdCount: number };
    assert.strictEqual(counts.updatedCount, 1);
    assert.strictEqual(counts.createdCount, 0);

    assert.strictEqual(itemPointMetadataRepository.update.mock.calls.length, 1);
    assert.strictEqual(itemPointMetadataRepository.update.mock.calls[0].arguments[0], 'pointId1');
  });

  it('should skip acting on an entry that is unchanged and already active', async () => {
    const previousPoint: ItemPointMetadataEntity = {
      id: 'pointId1',
      workflowId: WORKFLOW_ID,
      southItemId: 'existingItemId',
      discoveredEntryKey: 'nodeId=ns=1;s=Temperature',
      discoveredMetadata: { nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' },
      description: null,
      unit: null,
      minAcceptableValue: null,
      maxAcceptableValue: null,
      resolution: null,
      resamplingMethod: null,
      remoteMetadataExtra: null,
      status: 'active',
      orphanedAt: null,
      lastPushedAt: null
    };
    itemPointMetadataRepository.findAllByWorkflow.mock.mockImplementation(() => [previousPoint]);
    south.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' }]);

    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');

    assert.strictEqual(southService.updateItem.mock.calls.length, 0);
    assert.strictEqual(southService.createItem.mock.calls.length, 0);
    assert.strictEqual(itemPointMetadataRepository.update.mock.calls.length, 0);
    assert.strictEqual(itemPointMetadataRepository.create.mock.calls.length, 0);
  });

  it('should reactivate an orphaned entry that reappears, even with identical metadata', async () => {
    const previousPoint: ItemPointMetadataEntity = {
      id: 'pointId1',
      workflowId: WORKFLOW_ID,
      southItemId: 'existingItemId',
      discoveredEntryKey: 'nodeId=ns=1;s=Temperature',
      discoveredMetadata: { nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' },
      description: null,
      unit: null,
      minAcceptableValue: null,
      maxAcceptableValue: null,
      resolution: null,
      resamplingMethod: null,
      remoteMetadataExtra: null,
      status: 'orphaned',
      orphanedAt: '2024-01-02T00:00:00.000Z',
      lastPushedAt: null
    };
    itemPointMetadataRepository.findAllByWorkflow.mock.mockImplementation(() => [previousPoint]);
    south.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' }]);

    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');

    assert.strictEqual(southService.updateItem.mock.calls.length, 1);
    assert.strictEqual(itemPointMetadataRepository.update.mock.calls.length, 1);
  });

  it('should orphan a point that is no longer discovered and disable the item once all its points are orphaned', async () => {
    const previousPoint: ItemPointMetadataEntity = {
      id: 'pointId1',
      workflowId: WORKFLOW_ID,
      southItemId: 'existingItemId',
      discoveredEntryKey: 'nodeId=ns=1;s=Temperature',
      discoveredMetadata: { nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' },
      description: null,
      unit: null,
      minAcceptableValue: null,
      maxAcceptableValue: null,
      resolution: null,
      resamplingMethod: null,
      remoteMetadataExtra: null,
      status: 'active',
      orphanedAt: null,
      lastPushedAt: null
    };
    itemPointMetadataRepository.findAllByWorkflow.mock.mockImplementation(() => [previousPoint]);
    itemPointMetadataRepository.findBySouthItemId.mock.mockImplementation(() => [{ ...previousPoint, status: 'orphaned' as const }]);
    south.discover.mock.mockImplementation(async () => []);

    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');

    assert.strictEqual(itemPointMetadataRepository.markOrphaned.mock.calls.length, 1);
    assert.strictEqual(itemPointMetadataRepository.markOrphaned.mock.calls[0].arguments[0], 'pointId1');
    assert.deepStrictEqual(southConnectorRepository.disableItemWithReason.mock.calls[0].arguments, [
      SOUTH_ID,
      'existingItemId',
      'Configuration workflow no longer discovers this entry',
      'userTest'
    ]);
    const counts = workflowRunRepository.complete.mock.calls[0].arguments[1] as { disabledCount: number };
    assert.strictEqual(counts.disabledCount, 1);
  });

  it('should orphan a missing point without disabling the item when a sibling point is still active (N:1)', async () => {
    const orphanedPoint: ItemPointMetadataEntity = {
      id: 'pointId1',
      workflowId: WORKFLOW_ID,
      southItemId: 'sharedItemId',
      discoveredEntryKey: 'col=missing',
      discoveredMetadata: { col: 'missing' },
      description: null,
      unit: null,
      minAcceptableValue: null,
      maxAcceptableValue: null,
      resolution: null,
      resamplingMethod: null,
      remoteMetadataExtra: null,
      status: 'active',
      orphanedAt: null,
      lastPushedAt: null
    };
    const siblingPoint: ItemPointMetadataEntity = {
      ...orphanedPoint,
      id: 'pointId2',
      discoveredEntryKey: 'col=still-here',
      status: 'active'
    };
    itemPointMetadataRepository.findAllByWorkflow.mock.mockImplementation(() => [orphanedPoint]);
    itemPointMetadataRepository.findBySouthItemId.mock.mockImplementation(() => [
      { ...orphanedPoint, status: 'orphaned' as const },
      siblingPoint
    ]);
    south.discover.mock.mockImplementation(async () => []);

    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');

    assert.strictEqual(itemPointMetadataRepository.markOrphaned.mock.calls.length, 1);
    assert.strictEqual(southConnectorRepository.disableItemWithReason.mock.calls.length, 0);
    const counts = workflowRunRepository.complete.mock.calls[0].arguments[1] as { disabledCount: number };
    assert.strictEqual(counts.disabledCount, 0);
  });

  it('should not act on an already-orphaned point again', async () => {
    const orphanedPoint: ItemPointMetadataEntity = {
      id: 'pointId1',
      workflowId: WORKFLOW_ID,
      southItemId: 'existingItemId',
      discoveredEntryKey: 'nodeId=ns=1;s=Gone',
      discoveredMetadata: { nodeId: 'ns=1;s=Gone' },
      description: null,
      unit: null,
      minAcceptableValue: null,
      maxAcceptableValue: null,
      resolution: null,
      resamplingMethod: null,
      remoteMetadataExtra: null,
      status: 'orphaned',
      orphanedAt: '2024-01-02T00:00:00.000Z',
      lastPushedAt: null
    };
    itemPointMetadataRepository.findAllByWorkflow.mock.mockImplementation(() => [orphanedPoint]);
    south.discover.mock.mockImplementation(async () => []);

    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');

    assert.strictEqual(itemPointMetadataRepository.markOrphaned.mock.calls.length, 0);
  });

  it('should always update the single target item for a targetItemId workflow, never creating one', async () => {
    configurationWorkflowService.findById.mock.mockImplementation(() => ({
      ...baseWorkflow,
      targetItemId: 'existingItemId',
      itemFieldMapping: { 'settings.nodeId': '{{nodeId}}' }
    }));
    south.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' }]);

    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');

    assert.strictEqual(southService.createItem.mock.calls.length, 0);
    assert.strictEqual(southService.updateItem.mock.calls.length, 1);
    assert.strictEqual(southService.updateItem.mock.calls[0].arguments[1], 'existingItemId');
  });

  it('should write remote point metadata, referencing the acted-on item, without touching items when itemFieldMapping is null', async () => {
    configurationWorkflowService.findById.mock.mockImplementation(() => ({
      ...baseWorkflow,
      targetItemId: 'existingItemId',
      itemFieldMapping: null,
      remoteFieldMapping: { unit: '{{unit}}', description: 'Point for {{item.name}}' }
    }));
    south.discover.mock.mockImplementation(async () => [
      { nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable', unit: '°C' }
    ]);

    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');

    assert.strictEqual(southService.createItem.mock.calls.length, 0);
    assert.strictEqual(southService.updateItem.mock.calls.length, 0);
    assert.strictEqual(itemPointMetadataRepository.create.mock.calls.length, 1);
    const write = itemPointMetadataRepository.create.mock.calls[0].arguments[0] as {
      southItemId: string;
      unit: string;
      description: string;
    };
    assert.strictEqual(write.southItemId, 'existingItemId');
    assert.strictEqual(write.unit, '°C');
    assert.strictEqual(write.description, 'Point for Temperature');
  });

  it('should route unmapped remoteFieldMapping keys into remoteMetadataExtra', async () => {
    configurationWorkflowService.findById.mock.mockImplementation(() => ({
      ...baseWorkflow,
      targetItemId: 'existingItemId',
      itemFieldMapping: null,
      remoteFieldMapping: { customField: '{{customValue}}' }
    }));
    south.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature', type: 'Variable', customValue: 'hello' }]);

    await service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');

    const write = itemPointMetadataRepository.create.mock.calls[0].arguments[0] as { remoteMetadataExtra: Record<string, unknown> | null };
    assert.deepStrictEqual(write.remoteMetadataExtra, { customField: 'hello' });
  });

  it('should mark the run ERRORED and rethrow when discovery itself fails', async () => {
    south.discover.mock.mockImplementation(async () => {
      throw new Error('connection lost');
    });

    await assert.rejects(service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest'), new Error('connection lost'));

    assert.strictEqual(workflowRunRepository.fail.mock.calls.length, 1);
    const failCall = workflowRunRepository.fail.mock.calls[0];
    assert.strictEqual(failCall.arguments[0], 'runId1');
    assert.strictEqual(failCall.arguments[1], 'connection lost');
    assert.strictEqual(workflowRunRepository.complete.mock.calls.length, 0);
  });

  it('should report counts reached so far when a mid-run action fails', async () => {
    south.discover.mock.mockImplementation(async () => [
      { nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' },
      { nodeId: 'ns=1;s=Pressure', name: 'Pressure', type: 'Variable' }
    ]);
    let callCount = 0;
    southService.createItem.mock.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('validation failed');
      }
      return { ...runningItem, id: 'createdItemId' } as never;
    });

    await assert.rejects(service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest'), new Error('validation failed'));

    const failCall = workflowRunRepository.fail.mock.calls[0];
    const counts = failCall.arguments[2] as { createdCount: number; discoveredCount: number };
    assert.strictEqual(counts.discoveredCount, 2);
    assert.strictEqual(counts.createdCount, 1);
  });

  describe('preview', () => {
    it('should never start a run or write anything', async () => {
      south.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' }]);

      await service.preview(SOUTH_ID, WORKFLOW_ID);

      assert.strictEqual(workflowRunRepository.start.mock.calls.length, 0);
      assert.strictEqual(southService.createItem.mock.calls.length, 0);
      assert.strictEqual(southService.updateItem.mock.calls.length, 0);
      assert.strictEqual(itemPointMetadataRepository.create.mock.calls.length, 0);
      assert.strictEqual(itemPointMetadataRepository.update.mock.calls.length, 0);
      assert.strictEqual(itemPointMetadataRepository.markOrphaned.mock.calls.length, 0);
    });

    it('should classify a brand-new entry as "new"', async () => {
      south.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' }]);

      const result = await service.preview(SOUTH_ID, WORKFLOW_ID);

      assert.strictEqual(result.discoveredCount, 1);
      assert.strictEqual(result.eligibleCount, 1);
      assert.strictEqual(result.entries.length, 1);
      assert.strictEqual(result.entries[0].status, 'new');
      assert.strictEqual(result.entries[0].previousMetadata, null);
      assert.deepStrictEqual(result.entries[0].record, { nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' });
    });

    it('should classify an unchanged, changed, reactivated, and missing entry correctly in one preview', async () => {
      const unchangedPoint: ItemPointMetadataEntity = {
        id: 'p1',
        workflowId: WORKFLOW_ID,
        southItemId: 'itemA',
        discoveredEntryKey: 'nodeId=unchanged',
        discoveredMetadata: { nodeId: 'unchanged', name: 'Same', type: 'Variable' },
        description: null,
        unit: null,
        minAcceptableValue: null,
        maxAcceptableValue: null,
        resolution: null,
        resamplingMethod: null,
        remoteMetadataExtra: null,
        status: 'active',
        orphanedAt: null,
        lastPushedAt: null
      };
      const changedPoint: ItemPointMetadataEntity = {
        ...unchangedPoint,
        id: 'p2',
        discoveredEntryKey: 'nodeId=changed',
        discoveredMetadata: { nodeId: 'changed', name: 'Old Name' }
      };
      const reactivatedPoint: ItemPointMetadataEntity = {
        ...unchangedPoint,
        id: 'p3',
        discoveredEntryKey: 'nodeId=reactivated',
        discoveredMetadata: { nodeId: 'reactivated', name: 'Back Again' },
        status: 'orphaned',
        orphanedAt: '2024-01-02T00:00:00.000Z'
      };
      const missingPoint: ItemPointMetadataEntity = {
        ...unchangedPoint,
        id: 'p4',
        discoveredEntryKey: 'nodeId=missing',
        discoveredMetadata: { nodeId: 'missing', name: 'Gone' }
      };
      itemPointMetadataRepository.findAllByWorkflow.mock.mockImplementation(() => [
        unchangedPoint,
        changedPoint,
        reactivatedPoint,
        missingPoint
      ]);
      south.discover.mock.mockImplementation(async () => [
        { nodeId: 'unchanged', name: 'Same', type: 'Variable' },
        { nodeId: 'changed', name: 'New Name', type: 'Variable' },
        { nodeId: 'reactivated', name: 'Back Again', type: 'Variable' }
      ]);

      const result = await service.preview(SOUTH_ID, WORKFLOW_ID);

      const byKey = new Map(result.entries.map(entry => [entry.key, entry]));
      assert.strictEqual(byKey.get('nodeId=unchanged')?.status, 'unchanged');
      assert.strictEqual(byKey.get('nodeId=changed')?.status, 'changed');
      assert.strictEqual(byKey.get('nodeId=reactivated')?.status, 'reactivated');
      assert.strictEqual(byKey.get('nodeId=missing')?.status, 'missing');
      assert.strictEqual(byKey.get('nodeId=missing')?.record, null);
      assert.deepStrictEqual(byKey.get('nodeId=missing')?.previousMetadata, { nodeId: 'missing', name: 'Gone' });
    });

    it('should throw the same validation errors as runNow when the south is not running or lacks discovery', async () => {
      engine.hasSouth.mock.mockImplementation(() => false);
      await assert.rejects(
        service.preview(SOUTH_ID, WORKFLOW_ID),
        new OIBusValidationError(`South connector "${SOUTH_ID}" is not running - start it before running a workflow`)
      );
    });
  });

  describe('runScheduled', () => {
    it('should run with triggerType "scheduled" and a null triggeredBy on the run record', async () => {
      await service.runScheduled(SOUTH_ID, WORKFLOW_ID);

      assert.deepStrictEqual(workflowRunRepository.start.mock.calls[0].arguments, [WORKFLOW_ID, 'scheduled', null]);
    });

    it('should attribute Act mutations to "system" rather than a real user', async () => {
      south.discover.mock.mockImplementation(async () => [{ nodeId: 'ns=1;s=Temperature', name: 'Temperature', type: 'Variable' }]);

      await service.runScheduled(SOUTH_ID, WORKFLOW_ID);

      assert.strictEqual(southService.createItem.mock.calls[0].arguments[2], 'system');
      assert.strictEqual(southConnectorRepository.claimItemForWorkflow.mock.calls[0].arguments[3], 'system');
    });

    it('should silently no-op (no throw) when the south connector is not registered in the engine', async () => {
      engine.hasSouth.mock.mockImplementation(() => false);
      await assert.doesNotReject(service.runScheduled(SOUTH_ID, WORKFLOW_ID));
      assert.strictEqual(workflowRunRepository.start.mock.calls.length, 0);
    });

    it('should silently no-op (no throw) when this workflow is already queued or running', async () => {
      south.enqueueWorkflowRun = mock.fn(() => null) as never;
      await assert.doesNotReject(service.runScheduled(SOUTH_ID, WORKFLOW_ID));
      assert.strictEqual(workflowRunRepository.start.mock.calls.length, 0);
    });

    it('should silently no-op (no throw) when the south connector is disabled - unlike runNow, a scheduled tick must respect it', async () => {
      south.isEnabled.mock.mockImplementation(() => false);
      const enqueueWorkflowRun = mock.fn(() => null) as never;
      south.enqueueWorkflowRun = enqueueWorkflowRun;
      await assert.doesNotReject(service.runScheduled(SOUTH_ID, WORKFLOW_ID));
      assert.strictEqual(workflowRunRepository.start.mock.calls.length, 0);
      assert.strictEqual((enqueueWorkflowRun as ReturnType<typeof mock.fn>).mock.calls.length, 0);
    });
  });

  describe('runNow and runScheduled share the south connector queue', () => {
    it('should enqueue onto the same connector so a scheduled tick is skipped while a manual run is in flight', async () => {
      // The real (unmocked, inherited) enqueueWorkflowRun tracks queued/running state per workflowId -
      // starting a manual run and, before it resolves, attempting a scheduled run for the same
      // workflow should hit that same backpressure guard.
      let releaseManualRun: () => void = () => undefined;
      south.discover.mock.mockImplementation(
        () =>
          new Promise(resolve => {
            releaseManualRun = () => resolve([]);
          })
      );

      const manualRunPromise = service.runNow(SOUTH_ID, WORKFLOW_ID, 'userTest');
      await service.runScheduled(SOUTH_ID, WORKFLOW_ID); // Should silently no-op, not throw.

      releaseManualRun();
      await manualRunPromise;

      assert.strictEqual(workflowRunRepository.start.mock.calls.length, 1);
    });
  });
});
