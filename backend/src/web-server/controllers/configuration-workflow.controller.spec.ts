import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CustomExpressRequest } from '../express';
import { createMockServices, fixTsoaModuleResolution, reloadModule } from '../../tests/utils/test-utils';
import ConfigurationWorkflowServiceMock from '../../tests/__mocks__/service/configuration-workflow-service.mock';
import ConfigurationWorkflowRunServiceMock from '../../tests/__mocks__/service/configuration-workflow-run-service.mock';
import testData from '../../tests/utils/test-data';
import { ConfigurationWorkflowEntity } from '../../model/configuration-workflow.model';
import { WorkflowRunEntity } from '../../model/workflow-run.model';
import { ConfigurationWorkflowCommandDTO, WorkflowPreviewResultDTO } from '../../../shared/model/configuration-workflow.model';
import { createPageFromArray } from '../../../shared/model/types';
import type { ConfigurationWorkflowController as ConfigurationWorkflowControllerShape } from './configuration-workflow.controller';

const nodeRequire = createRequire(import.meta.url);

let ConfigurationWorkflowController: typeof ConfigurationWorkflowControllerShape;

before(() => {
  fixTsoaModuleResolution(nodeRequire);
  const mod = reloadModule<{ ConfigurationWorkflowController: typeof ConfigurationWorkflowControllerShape }>(
    nodeRequire,
    './configuration-workflow.controller'
  );
  ConfigurationWorkflowController = mod.ConfigurationWorkflowController;
});

const SOUTH_ID = testData.south.list[0].id;

const workflowEntity: ConfigurationWorkflowEntity = {
  id: 'workflowId1',
  name: 'Reactor discovery',
  southId: SOUTH_ID,
  targetItemId: null,
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [],
  itemFieldMapping: { name: '{{name}}' },
  remoteFieldMapping: null,
  scanMode: null,
  enabled: true,
  createdBy: 'userTest',
  updatedBy: 'userTest',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

const command: ConfigurationWorkflowCommandDTO = {
  name: 'Reactor discovery',
  targetItemId: null,
  discoveryScope: { rootNodeId: 'ns=1;s=Root' },
  identityKeyFields: ['nodeId'],
  eligibilityFilter: [],
  itemFieldMapping: { name: '{{name}}' },
  remoteFieldMapping: null,
  scanModeId: null,
  enabled: true
};

const runEntity: WorkflowRunEntity = {
  id: 'runId1',
  workflowId: 'workflowId1',
  triggerType: 'manual',
  status: 'COMPLETED',
  startedAt: '2024-01-01T00:00:00.000Z',
  completedAt: '2024-01-01T00:00:01.000Z',
  discoveredCount: 3,
  eligibleCount: 2,
  createdCount: 1,
  updatedCount: 1,
  disabledCount: 0,
  pushedCount: 0,
  error: null,
  triggeredBy: 'userTest'
};

describe('ConfigurationWorkflowController', () => {
  let controller: ConfigurationWorkflowControllerShape;
  let configurationWorkflowService: ConfigurationWorkflowServiceMock;
  let configurationWorkflowRunService: ConfigurationWorkflowRunServiceMock;
  let mockRequest: Partial<CustomExpressRequest>;

  beforeEach(() => {
    configurationWorkflowService = new ConfigurationWorkflowServiceMock();
    configurationWorkflowRunService = new ConfigurationWorkflowRunServiceMock();
    mockRequest = {
      services: createMockServices({ configurationWorkflowService, configurationWorkflowRunService }),
      user: { id: 'userTest', login: 'testUser' }
    } as Partial<CustomExpressRequest>;
    controller = new ConfigurationWorkflowController();
  });

  describe('list()', () => {
    it('should list workflows for a south connector', () => {
      configurationWorkflowService.findBySouthId = mock.fn(() => [workflowEntity]);

      const result = controller.list(SOUTH_ID, mockRequest as CustomExpressRequest);

      assert.strictEqual(configurationWorkflowService.findBySouthId.mock.calls.length, 1);
      assert.strictEqual(configurationWorkflowService.findBySouthId.mock.calls[0].arguments[0], SOUTH_ID);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, 'workflowId1');
      assert.strictEqual(result[0].name, 'Reactor discovery');
      assert.strictEqual(result[0].scanMode, null);
    });
  });

  describe('get()', () => {
    it('should get a workflow by id', () => {
      configurationWorkflowService.findById = mock.fn(() => workflowEntity);

      const result = controller.get(SOUTH_ID, 'workflowId1', mockRequest as CustomExpressRequest);

      assert.deepStrictEqual(configurationWorkflowService.findById.mock.calls[0].arguments, [SOUTH_ID, 'workflowId1']);
      assert.strictEqual(result.id, 'workflowId1');
    });

    it('should resolve scanMode to a DTO when set', () => {
      configurationWorkflowService.findById = mock.fn(() => ({ ...workflowEntity, scanMode: testData.scanMode.list[0] }));

      const result = controller.get(SOUTH_ID, 'workflowId1', mockRequest as CustomExpressRequest);

      assert.strictEqual(result.scanMode?.id, testData.scanMode.list[0].id);
    });
  });

  describe('create()', () => {
    it('should create a workflow using the authenticated user as creator', () => {
      configurationWorkflowService.create = mock.fn(() => workflowEntity);

      const result = controller.create(SOUTH_ID, command, mockRequest as CustomExpressRequest);

      assert.deepStrictEqual(configurationWorkflowService.create.mock.calls[0].arguments, [SOUTH_ID, command, 'userTest']);
      assert.strictEqual(result.id, 'workflowId1');
    });
  });

  describe('update()', () => {
    it('should update a workflow and return the refreshed DTO', () => {
      configurationWorkflowService.update = mock.fn(() => ({ ...workflowEntity, name: 'Updated name' }));

      const result = controller.update(SOUTH_ID, 'workflowId1', command, mockRequest as CustomExpressRequest);

      assert.deepStrictEqual(configurationWorkflowService.update.mock.calls[0].arguments, [SOUTH_ID, 'workflowId1', command, 'userTest']);
      assert.strictEqual(result.name, 'Updated name');
    });
  });

  describe('delete()', () => {
    it('should delete a workflow', () => {
      configurationWorkflowService.delete = mock.fn(() => undefined);

      controller.delete(SOUTH_ID, 'workflowId1', mockRequest as CustomExpressRequest);

      assert.deepStrictEqual(configurationWorkflowService.delete.mock.calls[0].arguments, [SOUTH_ID, 'workflowId1', 'userTest']);
    });
  });

  describe('run()', () => {
    it('should run a workflow now and return the resulting run DTO', async () => {
      configurationWorkflowRunService.runNow = mock.fn(async () => runEntity);

      const result = await controller.run(SOUTH_ID, 'workflowId1', mockRequest as CustomExpressRequest);

      assert.deepStrictEqual(configurationWorkflowRunService.runNow.mock.calls[0].arguments, [SOUTH_ID, 'workflowId1', 'userTest']);
      assert.strictEqual(result.id, 'runId1');
      assert.strictEqual(result.status, 'COMPLETED');
      assert.strictEqual(result.createdCount, 1);
    });
  });

  describe('preview()', () => {
    it('should preview a workflow without running it', async () => {
      const previewResult: WorkflowPreviewResultDTO = {
        discoveredCount: 2,
        eligibleCount: 1,
        entries: [{ key: 'nodeId=x', status: 'new', record: { nodeId: 'x' }, previousMetadata: null }]
      };
      configurationWorkflowRunService.preview = mock.fn(async () => previewResult);

      const result = await controller.preview(SOUTH_ID, 'workflowId1', mockRequest as CustomExpressRequest);

      assert.deepStrictEqual(configurationWorkflowRunService.preview.mock.calls[0].arguments, [SOUTH_ID, 'workflowId1']);
      assert.deepStrictEqual(result, previewResult);
    });
  });

  describe('listRuns()', () => {
    it('should list a workflow run history page', () => {
      const page = createPageFromArray([runEntity], 50, 0);
      configurationWorkflowRunService.findRuns = mock.fn(() => page);

      const result = controller.listRuns(SOUTH_ID, 'workflowId1', mockRequest as CustomExpressRequest, 1);

      assert.deepStrictEqual(configurationWorkflowRunService.findRuns.mock.calls[0].arguments, [SOUTH_ID, 'workflowId1', 1]);
      assert.strictEqual(result.content.length, 1);
      assert.strictEqual(result.content[0].id, 'runId1');
    });

    it('should default page to 0', () => {
      configurationWorkflowRunService.findRuns = mock.fn(() => createPageFromArray([], 50, 0));

      controller.listRuns(SOUTH_ID, 'workflowId1', mockRequest as CustomExpressRequest);

      assert.strictEqual(configurationWorkflowRunService.findRuns.mock.calls[0].arguments[2], 0);
    });
  });
});
