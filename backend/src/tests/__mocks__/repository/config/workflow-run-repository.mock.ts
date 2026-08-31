import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { WorkflowRunCounts, WorkflowRunEntity, WorkflowRunTriggerType } from '../../../../model/workflow-run.model';
import { Page } from '../../../../../shared/model/types';
import WorkflowRunRepository from '../../../../repository/config/workflow-run.repository';

/**
 * Create a mock object for Workflow Run repository
 */
export default class WorkflowRunRepositoryMock extends WorkflowRunRepository {
  constructor() {
    super({} as Database);
  }
  override findById = mock.fn((_id: string): WorkflowRunEntity | null => null);
  override findByWorkflowId = mock.fn((_workflowId: string, _page: number): Page<WorkflowRunEntity> => ({
    content: [],
    size: 50,
    number: 0,
    totalElements: 0,
    totalPages: 0
  }));
  override start = mock.fn(
    (_workflowId: string, _triggerType: WorkflowRunTriggerType, _triggeredBy: string | null): WorkflowRunEntity => ({}) as WorkflowRunEntity
  );
  override complete = mock.fn((_id: string, _counts: WorkflowRunCounts): void => undefined);
  override fail = mock.fn((_id: string, _error: string, _counts?: WorkflowRunCounts): void => undefined);
}
