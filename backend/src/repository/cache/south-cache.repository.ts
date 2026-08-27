import { Database, Statement } from 'better-sqlite3';
import { SouthItemLastValue } from '../../../shared/model/south-connector.model';

/**
 * Internal cache-row shape. Distinct from the public {@link SouthItemLastValue} API type (whose
 * `itemId` is always the requested item's id, filled in by the caller) because a row for a synced
 * group on a batching connector is keyed by `groupId` alone — `itemId` is `null` for that row,
 * there being no single item it belongs to.
 */
export type SouthCacheEntry = Omit<SouthItemLastValue, 'itemName' | 'groupName' | 'itemId'> & { itemId: string | null };

/**
 * Repository for South connector cache (per-item / per-group history tracking).
 *
 * All connectors share a single `south_item_cache` table (PRIMARY KEY: south_id, item_id).
 * A row either tracks one item (`item_id` set, `group_id` null or set to the item's own group when
 * the item isn't synced with it) or tracks a synced group shared by a batching connector
 * (`group_id` set, `item_id` NULL — see `saveGroupLastValue`). Prepared statements are created once
 * at construction time since the table name is fixed.
 */
export default class SouthCacheRepository {
  private readonly _database: Database;
  private readonly getStmt: Statement;
  private readonly getByGroupStmt: Statement;
  private readonly upsertStmt: Statement;
  private readonly updateGroupStmt: Statement;
  private readonly insertGroupStmt: Statement;
  private readonly deleteStmt: Statement;
  private readonly deleteAllBySouthStmt: Statement;
  private readonly getCachedValueStmt: Statement;
  private readonly upsertCachedValueStmt: Statement;

  constructor(database: Database) {
    this._database = database;
    this.getStmt = this._database.prepare(
      'SELECT south_id, group_id, item_id, query_time, value, tracked_instant ' +
        'FROM south_item_cache WHERE south_id = ? AND item_id = ?;'
    );
    this.getByGroupStmt = this._database.prepare(
      'SELECT south_id, group_id, item_id, query_time, value, tracked_instant ' +
        'FROM south_item_cache WHERE south_id = ? AND group_id = ? LIMIT 1;'
    );
    // `ON CONFLICT DO UPDATE` scoped to just these four columns, NOT a blanket `INSERT OR REPLACE`
    // — a full row replace would delete-then-reinsert the row on conflict, wiping out whatever the
    // dedicated cached_value/cached_instant columns (see upsertCachedValueStmt below) held for this
    // item, since those columns aren't part of this statement's column list and would silently
    // reset to NULL. Scoped SET preserves them untouched.
    this.upsertStmt = this._database.prepare(
      'INSERT INTO south_item_cache (south_id, group_id, item_id, query_time, value, tracked_instant) ' +
        'VALUES (?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT (south_id, item_id) DO UPDATE SET group_id = excluded.group_id, query_time = excluded.query_time, ' +
        'value = excluded.value, tracked_instant = excluded.tracked_instant;'
    );
    // Dedicated to the caching-strategy feature's own last-cached-value/instant, kept in separate
    // columns from `value`/`tracked_instant` (used for the windowed-history cursor and the legacy
    // direct-query "last value" write) so the two mechanisms never clobber each other — see the
    // south-cache-migrations/3/3.11/v3.11.0.ts migration doc comment for the history here. Reuses
    // `INSERT OR REPLACE` on the same `(south_id, item_id)` primary key as `upsertStmt`, but only
    // ever targets `item_id`-keyed rows (never NULL), so the group-row NULL-uniqueness caveat that
    // forces `updateGroupStmt`'s update-then-insert dance doesn't apply here.
    this.getCachedValueStmt = this._database.prepare(
      'SELECT cached_value, cached_instant FROM south_item_cache WHERE south_id = ? AND item_id = ?;'
    );
    this.upsertCachedValueStmt = this._database.prepare(
      'INSERT INTO south_item_cache (south_id, group_id, item_id, query_time, value, tracked_instant, cached_value, cached_instant) ' +
        'VALUES (?, NULL, ?, NULL, NULL, NULL, ?, ?) ' +
        'ON CONFLICT (south_id, item_id) DO UPDATE SET cached_value = excluded.cached_value, cached_instant = excluded.cached_instant;'
    );
    // Group-shared rows have item_id = NULL, so they can't rely on the (south_id, item_id) PRIMARY
    // KEY for INSERT OR REPLACE to upsert correctly: SQLite treats every NULL as distinct from every
    // other NULL for uniqueness purposes, so two saves with item_id = NULL would never be seen as
    // conflicting and would just keep appending rows instead of replacing. Update-if-exists,
    // else-insert (keyed on group_id explicitly) sidesteps that entirely.
    this.updateGroupStmt = this._database.prepare(
      'UPDATE south_item_cache SET query_time = ?, value = ?, tracked_instant = ? ' +
        'WHERE south_id = ? AND group_id = ? AND item_id IS NULL;'
    );
    this.insertGroupStmt = this._database.prepare(
      'INSERT INTO south_item_cache (south_id, item_id, group_id, query_time, value, tracked_instant) ' + 'VALUES (?, NULL, ?, ?, ?, ?);'
    );
    this.deleteStmt = this._database.prepare('DELETE FROM south_item_cache WHERE south_id = ? AND item_id = ?;');
    this.deleteAllBySouthStmt = this._database.prepare('DELETE FROM south_item_cache WHERE south_id = ?;');
  }

  getItemLastValue(connectorId: string, itemId: string): SouthCacheEntry | null {
    const result = this.getStmt.get(connectorId, itemId) as Record<string, string> | undefined;
    if (!result) return null;
    return this.toSouthCacheEntry(result);
  }

  getGroupLastValue(connectorId: string, groupId: string): SouthCacheEntry | null {
    const result = this.getByGroupStmt.get(connectorId, groupId) as Record<string, string> | undefined;
    if (!result) return null;
    return this.toSouthCacheEntry(result);
  }

  /** Save a per-item cache row. `command.itemId` must be a real item id (never null). */
  saveItemLastValue(connectorId: string, command: SouthCacheEntry & { itemId: string }): void {
    const valueStr = command.value !== null && command.value !== undefined ? JSON.stringify(command.value) : null;
    this.upsertStmt.run(connectorId, command.groupId, command.itemId, command.queryTime, valueStr, command.trackedInstant);
  }

  /**
   * Save the single shared cache row for a synced group on a batching connector (`item_id = NULL`).
   * Explicit update-then-insert instead of `INSERT OR REPLACE` — see the constructor comment above
   * `updateGroupStmt` for why the PRIMARY KEY can't do this automatically when `item_id` is NULL.
   */
  saveGroupLastValue(connectorId: string, groupId: string, command: Omit<SouthCacheEntry, 'itemId' | 'groupId'>): void {
    const valueStr = command.value !== null && command.value !== undefined ? JSON.stringify(command.value) : null;
    const result = this.updateGroupStmt.run(command.queryTime, valueStr, command.trackedInstant, connectorId, groupId);
    if (result.changes === 0) {
      this.insertGroupStmt.run(connectorId, groupId, command.queryTime, valueStr, command.trackedInstant);
    }
  }

  deleteItemValue(connectorId: string, itemId: string): void {
    this.deleteStmt.run(connectorId, itemId);
  }

  deleteItemsBySouth(connectorId: string): void {
    this.deleteAllBySouthStmt.run(connectorId);
  }

  /**
   * Batched upsert of the caching-strategy feature's own last-*cached*-value/instant, one row per
   * item (`group_id` always NULL — see the class doc: this is always keyed by `item_id`, never
   * falls back to the group-shared row, even when the item is synced with its group). Written to
   * the dedicated `cached_value`/`cached_instant` columns (see `upsertCachedValueStmt`), never
   * `value`/`tracked_instant` — those belong to the windowed-history cursor and the legacy
   * direct-query "last value" write, and must not be touched here or the two mechanisms clobber
   * each other. Looped inside a single `better-sqlite3` transaction so the whole batch commits
   * atomically in one call. Chunked at 100 rows, defensively matching the repo-wide ~100-row
   * batching convention used elsewhere for SQLite compound-select limits, even though a plain
   * looped `INSERT` has no such limit.
   */
  saveItemsLastValues(southId: string, values: Array<{ itemId: string; value: unknown; instant: string }>): void {
    if (values.length === 0) return;

    const runChunk = this._database.transaction((chunk: Array<{ itemId: string; value: unknown; instant: string }>) => {
      for (const entry of chunk) {
        const valueStr = entry.value !== null && entry.value !== undefined ? JSON.stringify(entry.value) : null;
        this.upsertCachedValueStmt.run(southId, entry.itemId, valueStr, entry.instant);
      }
    });

    for (const chunk of this.chunkArray(values, 100)) {
      runChunk(chunk);
    }
  }

  /**
   * Read a single item's last-*cached*-value/instant (dedicated `cached_value`/`cached_instant`
   * columns — see {@link saveItemsLastValues}). Used by the last-value endpoint to show the item's
   * own caching-strategy state, distinct from `getItemLastValue`'s `value`/`tracked_instant`.
   */
  getItemCachedValue(southId: string, itemId: string): { value: unknown; trackedInstant: string } | null {
    const result = this.getCachedValueStmt.get(southId, itemId) as
      { cached_value: string | null; cached_instant: string | null } | undefined;
    if (!result || result.cached_instant === null) return null;
    return { value: this.parseValue(result.cached_value), trackedInstant: result.cached_instant };
  }

  /**
   * Batched read of item-keyed last-*cached*-value/instant rows (dedicated `cached_value`/
   * `cached_instant` columns — see {@link saveItemsLastValues}). `better-sqlite3` has no array
   * binding, so the `IN (...)` clause is built with a dynamically-sized list of placeholders per
   * call; `itemIds` is chunked at 100 per query (same SQLite compound-select convention as
   * {@link saveItemsLastValues}), and the results of every chunk are merged into a single `Map`
   * keyed by `itemId`.
   */
  getItemsLastValues(southId: string, itemIds: Array<string>): Map<string, { value: unknown; trackedInstant: string }> {
    const results = new Map<string, { value: unknown; trackedInstant: string }>();
    if (itemIds.length === 0) return results;

    for (const chunk of this.chunkArray(itemIds, 100)) {
      const placeholders = chunk.map(() => '?').join(', ');
      const stmt = this._database.prepare(
        'SELECT item_id, cached_value, cached_instant ' + `FROM south_item_cache WHERE south_id = ? AND item_id IN (${placeholders});`
      );
      const rows = stmt.all(southId, ...chunk) as Array<{ item_id: string; cached_value: string | null; cached_instant: string | null }>;
      for (const row of rows) {
        if (row.cached_instant === null) continue;
        results.set(row.item_id, { value: this.parseValue(row.cached_value), trackedInstant: row.cached_instant });
      }
    }
    return results;
  }

  private chunkArray<T>(array: Array<T>, size: number): Array<Array<T>> {
    const chunks: Array<Array<T>> = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private toSouthCacheEntry(result: Record<string, string>): SouthCacheEntry {
    return {
      itemId: result.item_id ?? null,
      groupId: result.group_id || null,
      queryTime: result.query_time || null,
      value: this.parseValue(result.value),
      trackedInstant: result.tracked_instant || null
    };
  }

  private parseValue(raw: string | null | undefined): unknown {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
}
