import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import {
  WorkflowRunCounts,
  WorkflowRunEntity,
  WorkflowRunPayload,
  WorkflowRunSearchParam,
  WorkflowRunStatus,
  WorkflowRunTriggerType
} from '../../model/workflow-run.model';
import { Page } from '../../../shared/model/types';

const WORKFLOW_RUNS_TABLE = 'workflow_runs';
const PAGE_SIZE = 50;

const ZERO_COUNTS: WorkflowRunCounts = {
  discoveredCount: 0,
  eligibleCount: 0,
  createdCount: 0,
  updatedCount: 0,
  disabledCount: 0,
  pushedCount: 0
};

const EMPTY_PAYLOAD: WorkflowRunPayload = { entries: [], records: [] };

/**
 * Repository used for Configuration Workflow run history. This table *is* the audit trail for a run
 * (the same way `audit_logs` itself isn't audited), so unlike most repositories in this codebase it
 * has no `AuditService` wiring.
 */
export default class WorkflowRunRepository {
  constructor(private readonly database: Database) {}

  findById(id: string): WorkflowRunEntity | null {
    const query = `SELECT * FROM ${WORKFLOW_RUNS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id) as Record<string, unknown> | undefined;
    return result ? toWorkflowRun(result) : null;
  }

  /** Paginated, most-recent-first run history for one workflow, optionally narrowed by `searchParams` -
   *  mirrors LogRepository's own search() shape/conventions (a base WHERE clause, extended per active filter). */
  findByWorkflowId(workflowId: string, searchParams: WorkflowRunSearchParam): Page<WorkflowRunEntity> {
    const queryParams: Array<unknown> = [workflowId];
    let whereClause = `WHERE workflow_id = ?`;
    if (searchParams.start) {
      whereClause += ` AND started_at >= ?`;
      queryParams.push(searchParams.start);
    }
    if (searchParams.end) {
      whereClause += ` AND started_at <= ?`;
      queryParams.push(searchParams.end);
    }
    if (searchParams.statuses.length > 0) {
      whereClause += ` AND status IN (${searchParams.statuses.map(() => '?')})`;
      queryParams.push(...searchParams.statuses);
    }
    if (searchParams.triggerTypes.length > 0) {
      whereClause += ` AND trigger_type IN (${searchParams.triggerTypes.map(() => '?')})`;
      queryParams.push(...searchParams.triggerTypes);
    }

    const results: Array<WorkflowRunEntity> = this.database
      .prepare(`SELECT * FROM ${WORKFLOW_RUNS_TABLE} ${whereClause} ORDER BY started_at DESC LIMIT ${PAGE_SIZE} OFFSET ?;`)
      .all(...queryParams, PAGE_SIZE * searchParams.page)
      .map(result => toWorkflowRun(result as Record<string, unknown>));
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${WORKFLOW_RUNS_TABLE} ${whereClause}`).get(...queryParams) as {
        count: number;
      }
    ).count;

    return {
      content: results,
      size: PAGE_SIZE,
      number: searchParams.page,
      totalElements,
      totalPages: Math.ceil(totalElements / PAGE_SIZE)
    };
  }

  /** Records the start of a run — `RUNNING`, zeroed counts, no `completedAt`/`error` yet. */
  start(workflowId: string, triggerType: WorkflowRunTriggerType, triggeredBy: string | null, id = generateRandomId(6)): WorkflowRunEntity {
    const query =
      `INSERT INTO ${WORKFLOW_RUNS_TABLE} ` +
      `(id, workflow_id, trigger_type, status, started_at, triggered_by) ` +
      `VALUES (?, ?, ?, 'RUNNING', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), ?);`;
    this.database.prepare(query).run(id, workflowId, triggerType, triggeredBy);
    const created = this.findById(id);
    if (!created) {
      throw new Error(`Failed to create workflow run with id ${id}`);
    }
    return created;
  }

  /** Marks a run `COMPLETED` with its final counts and full discovered payload. */
  complete(id: string, counts: WorkflowRunCounts, payload: WorkflowRunPayload): void {
    const query =
      `UPDATE ${WORKFLOW_RUNS_TABLE} SET status = 'COMPLETED', completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), ` +
      `discovered_count = ?, eligible_count = ?, created_count = ?, updated_count = ?, disabled_count = ?, pushed_count = ?, ` +
      `payload = ? WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(
        counts.discoveredCount,
        counts.eligibleCount,
        counts.createdCount,
        counts.updatedCount,
        counts.disabledCount,
        counts.pushedCount,
        JSON.stringify(payload),
        id
      );
  }

  /**
   * Marks a run `ERRORED` with whatever counts/payload it reached before failing — both default to
   * empty so a failure during Retrieve itself (before anything is known) doesn't need a caller to fill
   * one in by hand.
   */
  fail(id: string, error: string, counts: WorkflowRunCounts = ZERO_COUNTS, payload: WorkflowRunPayload = EMPTY_PAYLOAD): void {
    const query =
      `UPDATE ${WORKFLOW_RUNS_TABLE} SET status = 'ERRORED', completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), error = ?, ` +
      `discovered_count = ?, eligible_count = ?, created_count = ?, updated_count = ?, disabled_count = ?, pushed_count = ?, ` +
      `payload = ? WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(
        error,
        counts.discoveredCount,
        counts.eligibleCount,
        counts.createdCount,
        counts.updatedCount,
        counts.disabledCount,
        counts.pushedCount,
        JSON.stringify(payload),
        id
      );
  }
}

export const toWorkflowRun = (result: Record<string, unknown>): WorkflowRunEntity => {
  // Null while the run is still RUNNING (payload is only ever written by complete()/fail()).
  const payload: WorkflowRunPayload = result.payload ? JSON.parse(result.payload as string) : EMPTY_PAYLOAD;
  return {
    id: result.id as string,
    workflowId: result.workflow_id as string,
    triggerType: result.trigger_type as WorkflowRunTriggerType,
    status: result.status as WorkflowRunStatus,
    startedAt: result.started_at as string,
    completedAt: (result.completed_at as string | null) ?? null,
    discoveredCount: result.discovered_count as number,
    eligibleCount: result.eligible_count as number,
    createdCount: result.created_count as number,
    updatedCount: result.updated_count as number,
    disabledCount: result.disabled_count as number,
    pushedCount: result.pushed_count as number,
    entries: payload.entries,
    records: payload.records,
    error: (result.error as string | null) ?? null,
    triggeredBy: (result.triggered_by as string | null) ?? null
  };
};
