import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { ItemPointMetadataEntity, ItemPointMetadataWrite } from '../../model/item-point-metadata.model';

const ITEM_POINT_METADATA_TABLE = 'item_point_metadata';

/**
 * Repository for a local (item-creating) Configuration Workflow run's discovered entries. Execution-
 * derived state, not something a person directly creates/edits — like `workflow_runs`, there's no
 * `AuditService` wiring; a run's aggregate counts are its own review trail.
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

  /** Every entry a workflow currently tracks — a run diffs the new retrieval against this set. */
  findAllByWorkflow(workflowId: string): Array<ItemPointMetadataEntity> {
    return this.database
      .prepare(`SELECT * FROM ${ITEM_POINT_METADATA_TABLE} WHERE workflow_id = ?;`)
      .all(workflowId)
      .map(result => toItemPointMetadata(result as Record<string, unknown>));
  }

  /** Every entry sharing one item — the orphan rule needs this to check whether the item's other entries are still active. */
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
      `(id, workflow_id, south_item_id, discovered_entry_key, discovered_metadata, status) ` +
      `VALUES (?, ?, ?, ?, ?, 'active');`;
    this.database
      .prepare(query)
      .run(id, write.workflowId, write.southItemId, write.discoveredEntryKey, JSON.stringify(write.discoveredMetadata));
    const created = this.findById(id);
    if (!created) {
      throw new Error(`Failed to create item point metadata with id ${id}`);
    }
    return created;
  }

  /**
   * A re-discovered entry whose content changed — refreshes the snapshot, and reactivates it if it had
   * previously orphaned (an entry that went missing for one run and came back is "changed", not a
   * brand new entry).
   */
  update(id: string, write: Omit<ItemPointMetadataWrite, 'workflowId' | 'southItemId'>): void {
    const query = `UPDATE ${ITEM_POINT_METADATA_TABLE} SET discovered_metadata = ?, status = 'active', orphaned_at = NULL WHERE id = ?;`;
    this.database.prepare(query).run(JSON.stringify(write.discoveredMetadata), id);
  }

  /** The entry's key was no longer found by the latest run's discovery. Never deletes the row. */
  markOrphaned(id: string): void {
    this.database
      .prepare(
        `UPDATE ${ITEM_POINT_METADATA_TABLE} SET status = 'orphaned', orphaned_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`
      )
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
  status: result.status as ItemPointMetadataEntity['status'],
  orphanedAt: (result.orphaned_at as string | null) ?? null
});
