import { mock } from 'node:test';
import { WorkflowRunEntity } from '../../../model/workflow-run.model';
import { WorkflowPreviewResultDTO } from '../../../../shared/model/configuration-workflow.model';
import { Page } from '../../../../shared/model/types';

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
    entries: []
  }));
  findRuns = mock.fn((_southId: string, _workflowId: string, _page: number): Page<WorkflowRunEntity> => ({
    content: [],
    size: 50,
    number: 0,
    totalElements: 0,
    totalPages: 0
  }));
}
