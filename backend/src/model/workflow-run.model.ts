import { WorkflowPreviewEntryDTO } from '../../shared/model/api/configuration-workflow.model';
import { WorkflowRunCounts, WorkflowRunStatus, WorkflowRunTriggerType } from '../../shared/model/api/workflow-run.model';
import { OIBusRecord } from '../../shared/model/common/content.model';

// Re-exported so existing backend-internal consumers don't need to know these live in the shared model -
// see the equivalent note in configuration-workflow.model.ts.
export {
  WORKFLOW_RUN_STATUSES,
  WORKFLOW_RUN_TRIGGER_TYPES,
  WorkflowRunCounts,
  WorkflowRunSearchParam,
  WorkflowRunStatus,
  WorkflowRunTriggerType
} from '../../shared/model/api/workflow-run.model';

/**
 * The full discovered payload behind one run's summary counts - not just "how many", but "which ones,
 * and what happened to them". Mirrors `WorkflowPreviewResultDTO`'s own `entries`/`records` shape: a
 * local (item-creating) workflow populates `entries` (empty for remote); a remote (push-to-OIAnalytics)
 * workflow populates `records` (empty for local). Written once, at `complete`/`fail` time.
 */
export interface WorkflowRunPayload {
  entries: Array<WorkflowPreviewEntryDTO>;
  records: Array<OIBusRecord>;
}

/**
 * One execution of a Configuration Workflow - manual or scheduled - reviewable independent of whether
 * anyone was watching. This table *is* the audit trail for a run (the same way `audit_logs` itself
 * isn't audited), so there's no separate AuditService wiring for it.
 */
export interface WorkflowRunEntity extends WorkflowRunCounts, WorkflowRunPayload {
  id: string;
  workflowId: string;
  triggerType: WorkflowRunTriggerType;
  status: WorkflowRunStatus;
  startedAt: string;
  /** Null while `status` is `RUNNING`. */
  completedAt: string | null;
  /** Set only when `status` is `ERRORED`. */
  error: string | null;
  /** The user who triggered a manual run; null for a scheduled one. */
  triggeredBy: string | null;
}
