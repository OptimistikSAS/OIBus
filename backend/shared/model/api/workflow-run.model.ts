import { OIBusRecord } from '../common/content.model';
import { UserInfo } from '../common/types';
import { WorkflowRunCounts, WorkflowRunStatus, WorkflowRunTriggerType } from '../domain/workflow-run.model';
import { WorkflowPreviewEntryDTO } from './configuration-workflow.model';

/**
 * One execution of a Configuration Workflow - manual or scheduled - reviewable independent of whether
 * anyone was watching.
 */
export interface WorkflowRunDTO extends WorkflowRunCounts {
  id: string;
  workflowId: string;
  triggerType: WorkflowRunTriggerType;
  status: WorkflowRunStatus;
  startedAt: string;

  /** Null while `status` is `RUNNING`. */
  completedAt: string | null;

  /** Set only when `status` is `ERRORED`. */
  error: string | null;

  /** The user who triggered a manual run, resolved to a display name; null for a scheduled one. */
  triggeredBy: UserInfo | null;
}

/**
 * One run's full detail, including the full discovered payload behind its summary counts - fetched on
 * demand (not part of the paginated run list, which stays lean) since it can be sizeable for a
 * workflow with many discovered records. Shape mirrors `WorkflowPreviewResultDTO`: local (item-creating)
 * workflow populates `entries` (empty for remote); remote (push-to-OIAnalytics) workflow populates
 * `records` (empty for local). Both are empty for a run that errored before Retrieve completed, or one
 * still `RUNNING`.
 */
export interface WorkflowRunDetailDTO extends WorkflowRunDTO {
  entries: Array<WorkflowPreviewEntryDTO>;
  records: Array<OIBusRecord>;
}
