import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { ItemPointMetadataEntity, ItemPointMetadataWrite } from '../../model/item-point-metadata.model';

const ITEM_POINT_METADATA_TABLE = 'item_point_metadata';

/**
 * Repository for a Configuration Workflow run's discovered points. Execution-derived state, not
 * something a person directly creates/edits — like `workflow_runs`, there's no `AuditService` wiring;
 * a run's aggregate counts are its own review trail, and auditing every individual point row would be
 * disproportionately noisy for the SQL N:1 case (one row per query column, every run).
 */
export default class ItemPointMetadataRepository {
  constructor(private readonly database: Database) {}

  findById(id: string): ItemPointMetadataEntity | null {
    const result = this.database.prepare(`SELECT * FROM ${ITEM_POINT_METADATA_TABLE} WHERE id = ?;`).get(id) as
      Record<string, unknown> | undefined;
    return result ? toItemPointMetadata(result) : null;
  }

  /** The one lookup every run's diff uses to recognize "the same" entry across runs. */
  findByWorkflowAndKey(workflowId: string, discoveredEntryKey: string): ItemPointMetadataEntity | null {
    const result = this.database
      .prepare(`SELECT * FROM ${ITEM_POINT_METADATA_TABLE} WHERE workflow_id = ? AND discovered_entry_key = ?;`)
      .get(workflowId, discoveredEntryKey) as Record<string, unknown> | undefined;
    return result ? toItemPointMetadata(result) : null;
  }

  /** Every point a workflow currently tracks — a run diffs the new retrieval against this set. */
  findAllByWorkflow(workflowId: string): Array<ItemPointMetadataEntity> {
    return this.database
      .prepare(`SELECT * FROM ${ITEM_POINT_METADATA_TABLE} WHERE workflow_id = ?;`)
      .all(workflowId)
      .map(result => toItemPointMetadata(result as Record<string, unknown>));
  }

  /** Every point sharing one item — the N:1 (SQL) orphan rule needs this to check its siblings. */
  findBySouthItemId(southItemId: string): Array<ItemPointMetadataEntity> {
    return this.database
      .prepare(`SELECT * FROM ${ITEM_POINT_METADATA_TABLE} WHERE south_item_id = ?;`)
      .all(southItemId)
      .map(result => toItemPointMetadata(result as Record<string, unknown>));
  }

  /** A newly-discovered entry — always starts `active`. */
  create(write: ItemPointMetadataWrite, id = generateRandomId(6)): ItemPointMetadataEntity {
    const query =
      `INSERT INTO ${ITEM_POINT_METADATA_TABLE} ` +
      `(id, workflow_id, south_item_id, discovered_entry_key, discovered_metadata, description, unit, ` +
      `min_acceptable_value, max_acceptable_value, resolution, resampling_method, remote_metadata_extra, status) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active');`;
    this.database
      .prepare(query)
      .run(
        id,
        write.workflowId,
        write.southItemId,
        write.discoveredEntryKey,
        JSON.stringify(write.discoveredMetadata),
        write.description,
        write.unit,
        write.minAcceptableValue,
        write.maxAcceptableValue,
        write.resolution,
        write.resamplingMethod,
        write.remoteMetadataExtra !== null ? JSON.stringify(write.remoteMetadataExtra) : null
      );
    const created = this.findById(id);
    if (!created) {
      throw new Error(`Failed to create item point metadata with id ${id}`);
    }
    return created;
  }

  /**
   * A re-discovered entry whose content changed — refreshes the snapshot and remote metadata, and
   * reactivates it if it had previously orphaned (an entry that went missing for one run and came
   * back is "changed", not a brand new point).
   */
  update(id: string, write: Omit<ItemPointMetadataWrite, 'workflowId' | 'southItemId'>): void {
    const query =
      `UPDATE ${ITEM_POINT_METADATA_TABLE} SET discovered_metadata = ?, description = ?, unit = ?, ` +
      `min_acceptable_value = ?, max_acceptable_value = ?, resolution = ?, resampling_method = ?, remote_metadata_extra = ?, ` +
      `status = 'active', orphaned_at = NULL WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(
        JSON.stringify(write.discoveredMetadata),
        write.description,
        write.unit,
        write.minAcceptableValue,
        write.maxAcceptableValue,
        write.resolution,
        write.resamplingMethod,
        write.remoteMetadataExtra !== null ? JSON.stringify(write.remoteMetadataExtra) : null,
        id
      );
  }

  /** The entry's key was no longer found by the latest run's discovery. Never deletes the row. */
  markOrphaned(id: string): void {
    this.database
      .prepare(
        `UPDATE ${ITEM_POINT_METADATA_TABLE} SET status = 'orphaned', orphaned_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`
      )
      .run(id);
  }

  markPushed(id: string): void {
    this.database
      .prepare(`UPDATE ${ITEM_POINT_METADATA_TABLE} SET last_pushed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`)
      .run(id);
  }

  delete(id: string): void {
    this.database.prepare(`DELETE FROM ${ITEM_POINT_METADATA_TABLE} WHERE id = ?;`).run(id);
  }
}

export const toItemPointMetadata = (result: Record<string, unknown>): ItemPointMetadataEntity => ({
  id: result.id as string,
  workflowId: result.workflow_id as string,
  southItemId: result.south_item_id as string,
  discoveredEntryKey: result.discovered_entry_key as string,
  discoveredMetadata: JSON.parse(result.discovered_metadata as string),
  description: (result.description as string | null) ?? null,
  unit: (result.unit as string | null) ?? null,
  minAcceptableValue: (result.min_acceptable_value as number | null) ?? null,
  maxAcceptableValue: (result.max_acceptable_value as number | null) ?? null,
  resolution: (result.resolution as number | null) ?? null,
  resamplingMethod: (result.resampling_method as string | null) ?? null,
  remoteMetadataExtra: result.remote_metadata_extra !== null ? JSON.parse(result.remote_metadata_extra as string) : null,
  status: result.status as ItemPointMetadataEntity['status'],
  orphanedAt: (result.orphaned_at as string | null) ?? null,
  lastPushedAt: (result.last_pushed_at as string | null) ?? null
});
