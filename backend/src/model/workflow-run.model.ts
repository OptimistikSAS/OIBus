import { WorkflowRunCounts, WorkflowRunStatus, WorkflowRunTriggerType } from '../../shared/model/workflow-run.model';

// Re-exported so existing backend-internal consumers don't need to know these live in the shared model -
// see the equivalent note in configuration-workflow.model.ts.
export {
  WORKFLOW_RUN_STATUSES,
  WorkflowRunStatus,
  WORKFLOW_RUN_TRIGGER_TYPES,
  WorkflowRunTriggerType,
  WorkflowRunCounts
} from '../../shared/model/workflow-run.model';

/**
 * One execution of a Configuration Workflow - manual or scheduled - reviewable independent of whether
 * anyone was watching. This table *is* the audit trail for a run (the same way `audit_logs` itself
 * isn't audited), so there's no separate AuditService wiring for it.
 */
export interface WorkflowRunEntity extends WorkflowRunCounts {
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
