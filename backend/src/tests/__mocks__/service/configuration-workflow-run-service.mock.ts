import { mock } from 'node:test';

import { ConfigurationWorkflowCommandDTO, WorkflowPreviewResultDTO } from '../../../../shared/model/api/configuration-workflow.model';
import { SouthConnectorItemCommandDTO } from '../../../../shared/model/api/south-connector.model';
import { Page } from '../../../../shared/model/common/types';

import { WorkflowRunEntity, WorkflowRunSearchParam } from '../../../model/workflow-run.model';

/**
 * Create a mock object for Configuration Workflow Run Service
 */
export default class ConfigurationWorkflowRunServiceMock {
  runNow = mock.fn(
    async (_southId: string, _workflowId: string, _triggeredBy: string): Promise<WorkflowRunEntity> => ({}) as WorkflowRunEntity
  );
  preview = mock.fn(async (_southId: string, _workflowId: string): Promise<WorkflowPreviewResultDTO> => ({
    discoveredCount: 0,
    eligibleCount: 0,
    entries: [],
    records: []
  }));
  previewCommand = mock.fn(
    async (
      _southId: string,
      _southType: string,
      _southSettings: unknown,
      _workflowId: string | null,
      _command: ConfigurationWorkflowCommandDTO
    ): Promise<WorkflowPreviewResultDTO> => ({
      discoveredCount: 0,
      eligibleCount: 0,
      entries: [],
      records: []
    })
  );
  discoverItems = mock.fn(
    async (
      _southId: string,
      _southType: string,
      _southSettings: unknown,
      _discoveryScope: Record<string, unknown>,
      _itemFieldMapping: Record<string, string>
    ): Promise<Array<SouthConnectorItemCommandDTO>> => []
  );
  findRuns = mock.fn((_southId: string, _workflowId: string, _searchParams: WorkflowRunSearchParam): Page<WorkflowRunEntity> => ({
    content: [],
    size: 50,
    number: 0,
    totalElements: 0,
    totalPages: 0
  }));
  findRunById = mock.fn((_southId: string, _workflowId: string, _runId: string): WorkflowRunEntity => ({}) as WorkflowRunEntity);
}
