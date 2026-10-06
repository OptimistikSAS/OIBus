import { OIBusRecord } from '../../shared/model/common/content.model';
import { WorkflowPreviewEntryStatus } from '../../shared/model/domain/configuration-workflow.model';
import { WorkflowRunCounts, WorkflowRunStatus, WorkflowRunTriggerType } from '../../shared/model/domain/workflow-run.model';

// Re-exported so existing backend-internal consumers don't need to know these live in the shared model -
// see the equivalent note in configuration-workflow.model.ts.
export {
  WORKFLOW_RUN_STATUSES,
  WORKFLOW_RUN_TRIGGER_TYPES,
  WorkflowRunCounts,
  WorkflowRunSearchParam,
  WorkflowRunStatus,
  WorkflowRunTriggerType
} from '../../shared/model/domain/workflow-run.model';

/** One discovered record of a local workflow run and how it was classified (same shape as `WorkflowPreviewEntryDTO`). */
export interface WorkflowRunEntry {
  key: string;
  status: WorkflowPreviewEntryStatus;
  record: OIBusRecord | null;
  previousMetadata: Record<string, unknown> | null;
}

/**
 * The full discovered payload behind one run's summary counts - not just "how many", but "which ones,
 * and what happened to them". Mirrors `WorkflowPreviewResultDTO`'s own `entries`/`records` shape: a
 * local (item-creating) workflow populates `entries` (empty for remote); a remote (push-to-OIAnalytics)
 * workflow populates `records` (empty for local). Written once, at `complete`/`fail` time.
 */
export interface WorkflowRunPayload {
  entries: Array<WorkflowRunEntry>;
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
