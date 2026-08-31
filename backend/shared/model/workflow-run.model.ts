export const WORKFLOW_RUN_STATUSES = ['RUNNING', 'COMPLETED', 'ERRORED'] as const;
/**
 * @example "COMPLETED"
 */
export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUSES)[number];

export const WORKFLOW_RUN_TRIGGER_TYPES = ['manual', 'scheduled'] as const;
/**
 * @example "manual"
 */
export type WorkflowRunTriggerType = (typeof WORKFLOW_RUN_TRIGGER_TYPES)[number];

/**
 * The counts a run reports, mirroring its four-step lifecycle: Retrieve produces `discoveredCount`
 * records; the workflow's eligibility filter narrows that to `eligibleCount`; Act only ever touches
 * new/changed/missing ones, split into item actions (`createdCount`/`updatedCount`/`disabledCount`)
 * and remote pushes (`pushedCount`) - independent, since a workflow can be item-only, remote-only, or
 * both.
 */
export interface WorkflowRunCounts {
  discoveredCount: number;
  eligibleCount: number;
  createdCount: number;
  updatedCount: number;
  disabledCount: number;
  pushedCount: number;
}

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

  /** The user who triggered a manual run; null for a scheduled one. */
  triggeredBy: string | null;
}
