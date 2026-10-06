import { Instant } from '../common/types';

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
 * records; the workflow's eligibility filter narrows that to `eligibleCount`; Act then does exactly
 * one of two things, per the workflow's own exclusive mode: a local (item-creating) workflow's
 * `createdCount`/`updatedCount`/`disabledCount`, or a remote (push-to-OIAnalytics) workflow's
 * `pushedCount` - never both at once.
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
 * Parameters for searching/filtering a Configuration Workflow's run history - mirrors `LogSearchParam`'s
 * own shape/conventions (page, an optional start/end range, plus arrays of enum values to filter by).
 */
export interface WorkflowRunSearchParam {
  page: number;

  /** Only runs started at or after this instant - undefined to not filter by a lower bound. */
  start: Instant | undefined;

  /** Only runs started at or before this instant - undefined to not filter by an upper bound. */
  end: Instant | undefined;

  /** Empty means every status matches. */
  statuses: Array<WorkflowRunStatus>;

  /** Empty means every trigger type matches. */
  triggerTypes: Array<WorkflowRunTriggerType>;
}
