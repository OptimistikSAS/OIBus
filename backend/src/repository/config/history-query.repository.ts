import { HistoryQueryItemSearchParam, HistoryQueryStatus } from '../../../shared/model/history-query.model';
import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { HistoryQueryEntity, HistoryQueryEntityLight, HistoryQueryItemEntity } from '../../model/histor-query.model';
import { Page } from '../../../shared/model/types';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { Instant } from '../../model/types';
import { OIBusNorthType } from '../../../shared/model/north-connector.model';
import { OIBusSouthType } from '../../../shared/model/south-connector.model';
import { HistoryTransformerWithOptions } from '../../model/transformer.model';
import { toTransformer } from './transformer.repository';
import { ScanMode } from '../../model/scan-mode.model';
import { scanModeColumns, toScanMode } from './scan-mode.repository';
import { SouthConnectorItemEntityLight } from '../../model/south-connector.model';
import AuditService from '../../service/audit.service';
import { encryptionService } from '../../service/encryption.service';
import { southManifestList } from '../../service/south-manifests';
import { northManifestList } from '../../service/north-manifests';
import { OIBusObjectAttribute } from '../../../shared/model/form.model';

const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';
const HISTORY_TRANSFORMERS_TABLE = 'history_query_transformers';
const HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE = 'history_query_transformers_items';
const TRANSFORMERS_TABLE = 'transformers';
const SCAN_MODE = 'scan_modes';
const PAGE_SIZE = 50;

export default class HistoryQueryRepository {
  constructor(
    private readonly database: Database,
    private readonly auditService: AuditService
  ) {}

  findAllHistoriesLight(): Array<HistoryQueryEntityLight> {
    const query = `SELECT id, name, description, status, start_time, end_time, south_type, north_type, created_by, updated_by, created_at, updated_at FROM ${HISTORY_QUERIES_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => toHistoryQueryLight(result as Record<string, string>));
  }

  findAllHistoriesFull(): Array<HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>> {
    const query =
      `SELECT id, name, description, status, start_time, end_time, ` +
      `south_type, north_type, south_settings, north_settings, ` +
      `throttling_max_read_interval, throttling_read_delay, ` +
      `caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, ` +
      `caching_throttling_run_min_delay, caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, ` +
      `caching_error_retry_interval, caching_error_retry_count, caching_error_retention_duration, ` +
      `caching_archive_enabled, caching_archive_retention_duration, created_by, updated_by, created_at, updated_at ` +
      `FROM ${HISTORY_QUERIES_TABLE};`;
    const result = this.database.prepare(query).all();

    return result.map(element => this.toHistoryQueryEntity(element as Record<string, string | number>));
  }

  findHistoryById(id: string): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null {
    const query =
      `SELECT id, name, description, status, start_time, end_time, ` +
      `south_type, north_type, south_settings, north_settings, ` +
      `throttling_max_read_interval, throttling_read_delay, ` +
      `caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, ` +
      `caching_throttling_run_min_delay, caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, ` +
      `caching_error_retry_interval, caching_error_retry_count, caching_error_retention_duration, ` +
      `caching_archive_enabled, caching_archive_retention_duration, created_by, updated_by, created_at, updated_at ` +
      `FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) {
      return null;
    }
    return this.toHistoryQueryEntity(result as Record<string, string | number>);
  }

  /**
   * Inserts or updates a history query. Whether a given `history.id` is treated as "create" or
   * "update" is decided by whether a row for that id already exists — not merely by whether `id` is
   * set — so a caller (e.g. config import) can preserve a specific id for a brand-new row instead of
   * always getting a freshly generated one. Every normal caller only ever passes either no id (new
   * history query from the UI) or the id of a history query it just read back from this repository,
   * so this is not a behavior change for them.
   */
  saveHistory(history: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>): void {
    const beforeHistory = history.id ? this.findHistoryById(history.id) : null;
    const isNew = !beforeHistory;
    const beforeItemsById = history.id
      ? new Map(this.findAllItemsForHistory(history.id).map(i => [i.id, i]))
      : new Map<string, HistoryQueryItemEntity<SouthItemSettings>>();
    const transaction = this.database.transaction(() => {
      if (isNew) {
        if (!history.id) {
          history.id = generateRandomId(6);
        }
        const insertQuery =
          `INSERT INTO ${HISTORY_QUERIES_TABLE} (id, name, description, status, ` +
          `start_time, end_time, south_type, north_type, south_settings, north_settings, ` +
          `throttling_max_read_interval, throttling_read_delay, ` +
          `caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, ` +
          `caching_throttling_run_min_delay, caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, ` +
          `caching_error_retry_interval, caching_error_retry_count, caching_error_retention_duration, ` +
          `caching_archive_enabled, caching_archive_retention_duration, created_by, updated_by, created_at, updated_at) ` +
          `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`;
        this.database.prepare(insertQuery).run(
          history.id,
          history.name,
          history.description,
          'PENDING', // disabled by default at creation
          history.queryTimeRange.startTime,
          history.queryTimeRange.endTime,
          history.southType,
          history.northType,
          JSON.stringify(history.southSettings),
          JSON.stringify(history.northSettings),
          history.queryTimeRange.maxReadInterval,
          history.queryTimeRange.readDelay,
          history.caching.trigger.scanMode.id,
          history.caching.trigger.numberOfElements,
          history.caching.trigger.numberOfFiles,
          history.caching.throttling.runMinDelay,
          history.caching.throttling.maxSize,
          history.caching.throttling.maxNumberOfElements,
          history.caching.error.retryInterval,
          history.caching.error.retryCount,
          history.caching.error.retentionDuration,
          +history.caching.archive.enabled,
          history.caching.archive.retentionDuration,
          history.createdBy,
          history.updatedBy
        );
      } else {
        const query =
          `UPDATE ${HISTORY_QUERIES_TABLE} SET name = ?, description = ?, start_time = ?, ` +
          `end_time = ?, south_type = ?, north_type = ?, south_settings = ?, north_settings = ?,` +
          `throttling_max_read_interval = ?, throttling_read_delay = ?, ` +
          `caching_trigger_schedule = ?, caching_trigger_number_of_elements = ?, caching_trigger_number_of_files = ?, ` +
          `caching_throttling_run_min_delay = ?, caching_throttling_cache_max_size = ?, caching_throttling_max_number_of_elements = ?, ` +
          `caching_error_retry_interval = ?, caching_error_retry_count = ?, caching_error_retention_duration = ?, ` +
          `caching_archive_enabled = ?, caching_archive_retention_duration = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ` +
          `WHERE id = ?;`;
        this.database
          .prepare(query)
          .run(
            history.name,
            history.description,
            history.queryTimeRange.startTime,
            history.queryTimeRange.endTime,
            history.southType,
            history.northType,
            JSON.stringify(history.southSettings),
            JSON.stringify(history.northSettings),
            history.queryTimeRange.maxReadInterval,
            history.queryTimeRange.readDelay,
            history.caching.trigger.scanMode.id,
            history.caching.trigger.numberOfElements,
            history.caching.trigger.numberOfFiles,
            history.caching.throttling.runMinDelay,
            history.caching.throttling.maxSize,
            history.caching.throttling.maxNumberOfElements,
            history.caching.error.retryInterval,
            history.caching.error.retryCount,
            history.caching.error.retentionDuration,
            +history.caching.archive.enabled,
            history.caching.archive.retentionDuration,
            history.updatedBy,
            history.id
          );
      }

      if (history.items.length > 0) {
        this.database
          .prepare(
            `DELETE FROM ${HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE}
                     WHERE id IN (
                       SELECT id FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?
                     ) AND item_id NOT IN (${history.items
                       .filter(item => item.id)
                       .map(() => '?')
                       .join(', ')});`
          )
          .run(
            history.id,
            history.items.filter(item => item.id).map(item => item.id)
          );
        this.database
          .prepare(
            `DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ? AND id NOT IN (${history.items
              .filter(item => item.id)
              .map(() => '?')
              .join(', ')});`
          )
          .run(
            history.id,
            history.items.filter(item => item.id).map(item => item.id)
          );

        const insert = this.database.prepare(
          `INSERT INTO ${HISTORY_ITEMS_TABLE} (id, name, enabled, history_id, settings, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`
        );
        const update = this.database.prepare(
          `UPDATE ${HISTORY_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`
        );
        const existingItemsById = new Map(
          this.database
            .prepare<[string], { id: string; name: string; enabled: number; settings: string }>(
              `SELECT id, name, enabled, settings FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`
            )
            .all(history.id)
            .map(row => [row.id, row])
        );

        for (const item of history.items) {
          // A real (non-`temp_`) id that does not correspond to any existing row is how config
          // import preserves an item's original id across a wipe+recreate, instead of always
          // minting a new one.
          if (!item.id || item.id.startsWith('temp_') || !existingItemsById.has(item.id)) {
            const preservedId = item.id && !item.id.startsWith('temp_') ? item.id : generateRandomId(6);
            if (item.id.startsWith('temp_')) {
              for (const transformer of history.northTransformers) {
                const transformerItemIndex = transformer.items.findIndex(element => element.id === item.id);
                if (transformerItemIndex > -1) {
                  transformer.items[transformerItemIndex].id = preservedId;
                }
              }
            }
            item.id = preservedId;
            insert.run(item.id, item.name, +item.enabled, history.id, JSON.stringify(item.settings), item.createdBy, item.updatedBy);
            const created = this.findItemById(history.id, item.id);
            this.auditService.record(
              'history_query_item',
              item.id,
              'CREATE',
              null,
              this.redactItem(created, history.southType),
              item.updatedBy
            );
          } else {
            const existing = existingItemsById.get(item.id);
            const hasChanged =
              !existing ||
              existing.name !== item.name ||
              existing.enabled !== +item.enabled ||
              existing.settings !== JSON.stringify(item.settings);
            if (hasChanged) {
              update.run(item.name, +item.enabled, JSON.stringify(item.settings), item.updatedBy, item.id);
              const after = this.findItemById(history.id, item.id);
              this.auditService.record(
                'history_query_item',
                item.id,
                'UPDATE',
                this.redactItem(beforeItemsById.get(item.id) ?? null, history.southType),
                this.redactItem(after, history.southType),
                item.updatedBy
              );
            }
          }
        }

        const incomingItemIds = new Set(history.items.filter(item => item.id).map(item => item.id));
        for (const [removedItemId, removedItem] of beforeItemsById) {
          if (!incomingItemIds.has(removedItemId)) {
            this.auditService.record(
              'history_query_item',
              removedItemId,
              'DELETE',
              this.redactItem(removedItem, history.southType),
              null,
              history.updatedBy
            );
          }
        }
      } else {
        this.database
          .prepare(
            `DELETE FROM ${HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE}
                     WHERE id IN (
                       SELECT id FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?
                     );`
          )
          .run(history.id);

        this.database.prepare(`DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`).run(history.id);
        for (const [removedItemId, removedItem] of beforeItemsById) {
          this.auditService.record(
            'history_query_item',
            removedItemId,
            'DELETE',
            this.redactItem(removedItem, history.southType),
            null,
            history.updatedBy
          );
        }
      }

      const keepIds = history.northTransformers.filter(t => t.id).map(t => t.id);
      const removedTransformerIds = (beforeHistory?.northTransformers ?? []).filter(t => !keepIds.includes(t.id)).map(t => t.id);
      for (const removedId of removedTransformerIds) {
        this.auditService.record(
          'history_query_transformer',
          removedId,
          'DELETE',
          beforeHistory!.northTransformers.find(t => t.id === removedId) as unknown as Record<string, unknown>,
          null,
          history.updatedBy
        );
      }

      if (keepIds.length === 0) {
        this.database
          .prepare(
            `DELETE FROM ${HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE}
             WHERE id IN (
               SELECT id FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?
             );`
          )
          .run(history.id);

        // The list is empty, so we delete EVERYTHING for this history_id
        this.database.prepare(`DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?`).run(history.id);
      } else {
        this.database
          .prepare(
            `DELETE FROM ${HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE}
             WHERE id IN (
               SELECT id FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?
             ) AND id NOT IN (${keepIds.map(() => '?').join(', ')});`
          )
          .run(history.id, ...keepIds);

        // The list has items, so we delete only those NOT in the list
        const placeholders = keepIds.map(() => '?').join(',');

        const sql = `DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ? AND id NOT IN (${placeholders})`;
        // We spread (...keepIds) so they fill the placeholders after history.id
        this.database.prepare(sql).run(history.id, ...keepIds);
      }

      for (const transformerWithOptions of history.northTransformers) {
        if (transformerWithOptions.id.startsWith('temp_')) {
          transformerWithOptions.id = '';
        }
        this.addOrEditTransformer(history.id, transformerWithOptions, history.updatedBy);
      }

      const afterHistory = this.findHistoryById(history.id);
      this.auditService.record(
        'history_query',
        history.id,
        isNew ? 'CREATE' : 'UPDATE',
        this.redactHistory(beforeHistory),
        this.redactHistory(afterHistory),
        history.updatedBy
      );
    });
    transaction();
  }

  updateHistoryStatus(id: string, status: HistoryQueryStatus) {
    const query = `UPDATE ${HISTORY_QUERIES_TABLE} SET status = ? WHERE id = ?;`;
    this.database.prepare(query).run(status, id);
  }

  deleteHistory(id: string, deletedBy: string): void {
    const before = this.findHistoryById(id);
    const transaction = this.database.transaction(() => {
      // 1. Delete items
      this.database
        .prepare(
          `DELETE FROM ${HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE}
         WHERE id IN (
           SELECT id FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?
         );`
        )
        .run(id);

      // 2. Delete transformers
      this.database.prepare(`DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?;`).run(id);

      // 3. Delete history items
      this.database.prepare(`DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`).run(id);

      // 4. Delete the history itself
      this.database.prepare(`DELETE FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`).run(id);

      if (before) {
        for (const item of before.items) {
          this.auditService.record('history_query_item', item.id, 'DELETE', this.redactItem(item, before.southType), null, deletedBy);
        }
        for (const transformer of before.northTransformers) {
          this.auditService.record(
            'history_query_transformer',
            transformer.id,
            'DELETE',
            transformer as unknown as Record<string, unknown>,
            null,
            deletedBy
          );
        }
        this.auditService.record('history_query', id, 'DELETE', this.redactHistory(before), null, deletedBy);
      }
    });
    transaction();
  }

  /**
   * Inserts or updates a history query's link to a transformer. As with `saveHistory`, whether a
   * given `transformerWithOptions.id` is treated as "create" or "update" is decided by whether a row
   * for that id already exists, so config import can preserve the original link id.
   */
  addOrEditTransformer(historyId: string, transformerWithOptions: HistoryTransformerWithOptions, updatedBy: string): void {
    const before = transformerWithOptions.id
      ? (this.findTransformersForHistory(historyId).find(t => t.id === transformerWithOptions.id) ?? null)
      : null;
    const wasNew = !before;
    if (wasNew) {
      if (!transformerWithOptions.id) {
        transformerWithOptions.id = generateRandomId(6);
      }
      const query = `INSERT INTO ${HISTORY_TRANSFORMERS_TABLE} (id, history_id, transformer_id, options) VALUES (?, ?, ?, ?);`;
      this.database
        .prepare(query)
        .run(transformerWithOptions.id, historyId, transformerWithOptions.transformer.id, JSON.stringify(transformerWithOptions.options));
    } else {
      const query = `UPDATE ${HISTORY_TRANSFORMERS_TABLE} SET transformer_id = ?, options = ? WHERE id = ?;`;
      this.database
        .prepare(query)
        .run(transformerWithOptions.transformer.id, JSON.stringify(transformerWithOptions.options), transformerWithOptions.id);
    }
    this.database.prepare(`DELETE FROM ${HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE} WHERE id = ?;`).run(transformerWithOptions.id);
    const items = transformerWithOptions.items.filter(item => item.id);
    for (const item of items) {
      this.database
        .prepare(`INSERT INTO ${HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE} (id, item_id) VALUES (?, ?);`)
        .run(transformerWithOptions.id, item.id);
    }

    const after = this.findTransformersForHistory(historyId).find(t => t.id === transformerWithOptions.id) ?? null;
    this.auditService.record(
      'history_query_transformer',
      transformerWithOptions.id,
      wasNew ? 'CREATE' : 'UPDATE',
      before as unknown as Record<string, unknown> | null,
      after as unknown as Record<string, unknown> | null,
      updatedBy
    );
  }

  removeTransformer(id: string, deletedBy: string): void {
    const historyId = this.database.prepare(`SELECT history_id FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE id = ?;`).get(id) as
      { history_id: string } | undefined;
    const before = historyId ? (this.findTransformersForHistory(historyId.history_id).find(t => t.id === id) ?? null) : null;
    const transaction = this.database.transaction(() => {
      this.database.prepare(`DELETE FROM ${HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE} WHERE id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE id = ?;`).run(id);
      if (before) {
        this.auditService.record('history_query_transformer', id, 'DELETE', before as unknown as Record<string, unknown>, null, deletedBy);
      }
    });
    transaction();
  }

  removeTransformersByTransformerId(transformerId: string, deletedBy: string): void {
    const affected = this.database
      .prepare(`SELECT id, history_id FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE transformer_id = ?;`)
      .all(transformerId) as Array<{ id: string; history_id: string }>;
    const beforeById = new Map(
      affected.map(row => [row.id, this.findTransformersForHistory(row.history_id).find(t => t.id === row.id) ?? null])
    );
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          `DELETE FROM ${HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE} WHERE id IN (SELECT id FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE transformer_id = ?);`
        )
        .run(transformerId);
      this.database.prepare(`DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE transformer_id = ?;`).run(transformerId);
      for (const row of affected) {
        const before = beforeById.get(row.id);
        if (before) {
          this.auditService.record(
            'history_query_transformer',
            row.id,
            'DELETE',
            before as unknown as Record<string, unknown>,
            null,
            deletedBy
          );
        }
      }
    });
    transaction();
  }

  searchItems(historyId: string, searchParams: HistoryQueryItemSearchParam): Page<HistoryQueryItemEntity<SouthItemSettings>> {
    let whereClause = `WHERE history_id = ?`;
    const queryParams = [historyId];

    const page = searchParams.page;

    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }
    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND enabled = ?`;
    }

    const query = `SELECT id, name, enabled, settings, created_by, updated_by, created_at, updated_at FROM ${HISTORY_ITEMS_TABLE} ${whereClause} LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toHistoryQueryItemEntity(result as Record<string, string>));
    const totalElements: number = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${HISTORY_ITEMS_TABLE} ${whereClause}`).get(...queryParams) as { count: number }
    ).count;
    const totalPages = Math.ceil(totalElements / PAGE_SIZE);
    return {
      content: results,
      size: PAGE_SIZE,
      number: page,
      totalElements,
      totalPages
    };
  }

  listItems(historyId: string, searchParams: Omit<HistoryQueryItemSearchParam, 'page'>): Array<HistoryQueryItemEntity<SouthItemSettings>> {
    let whereClause = `WHERE history_id = ?`;
    const queryParams = [historyId];
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }
    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND enabled = ?`;
    }

    const query = `SELECT id, name, enabled, settings, created_by, updated_by, created_at, updated_at FROM ${HISTORY_ITEMS_TABLE} ${whereClause};`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toHistoryQueryItemEntity(result as Record<string, string>));
  }

  findAllItemsForHistory(historyId: string): Array<HistoryQueryItemEntity<SouthItemSettings>> {
    const query = `SELECT id, name, enabled, settings, created_by, updated_by, created_at, updated_at FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`;
    return this.database
      .prepare(query)
      .all(historyId)
      .map(result => this.toHistoryQueryItemEntity(result as Record<string, string>));
  }

  findItemById(historyId: string, itemId: string): HistoryQueryItemEntity<SouthItemSettings> | null {
    const query = `SELECT id, name, enabled, settings, created_by, updated_by, created_at, updated_at FROM ${HISTORY_ITEMS_TABLE} WHERE id = ? AND history_id = ?;`;
    const result = this.database.prepare(query).get(itemId, historyId);
    if (!result) return null;
    return this.toHistoryQueryItemEntity(result as Record<string, string>);
  }

  saveItem<I extends SouthItemSettings>(historyId: string, item: HistoryQueryItemEntity<I>): void {
    const wasNew = !item.id;
    const before = wasNew ? null : this.findItemById(historyId, item.id);
    const southType = this.findHistoryById(historyId)?.southType;
    if (!item.id) {
      item.id = generateRandomId(6);
      const insertQuery =
        `INSERT INTO ${HISTORY_ITEMS_TABLE} (id, name, enabled, history_id, settings, created_by, updated_by, created_at, updated_at) ` +
        `VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
      this.database
        .prepare(insertQuery)
        .run(item.id, item.name, +item.enabled, historyId, JSON.stringify(item.settings), item.createdBy, item.updatedBy);
    } else {
      const query = `UPDATE ${HISTORY_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`;
      this.database.prepare(query).run(item.name, +item.enabled, JSON.stringify(item.settings), item.updatedBy, item.id);
    }

    const after = this.findItemById(historyId, item.id);
    this.auditService.record(
      'history_query_item',
      item.id,
      wasNew ? 'CREATE' : 'UPDATE',
      southType
        ? this.redactItem(before as unknown as HistoryQueryItemEntity<SouthItemSettings> | null, southType)
        : (before as unknown as Record<string, unknown> | null),
      southType ? this.redactItem(after, southType) : (after as unknown as Record<string, unknown>),
      item.updatedBy
    );
  }

  saveAllItems(
    historyId: string,
    items: Array<HistoryQueryItemEntity<SouthItemSettings>>,
    deleteItemsNotPresent: boolean,
    deletedBy: string
  ): void {
    const transaction = this.database.transaction(() => {
      if (deleteItemsNotPresent) {
        this.deleteAllItemsByHistory(historyId, deletedBy);
      }
      for (const item of items) {
        this.saveItem(historyId, item);
      }
    });
    transaction();
  }

  deleteItem(historyId: string, itemId: string, deletedBy: string): void {
    const before = this.findItemById(historyId, itemId);
    const southType = this.findHistoryById(historyId)?.southType;
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          `DELETE FROM ${HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE}
                     WHERE id IN (
                       SELECT id FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?
                     ) AND item_id = ?;`
        )
        .run(historyId, itemId);
      this.database.prepare(`DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ? AND id = ?;`).run(historyId, itemId);
      if (before) {
        this.auditService.record(
          'history_query_item',
          itemId,
          'DELETE',
          southType ? this.redactItem(before, southType) : (before as unknown as Record<string, unknown>),
          null,
          deletedBy
        );
      }
    });
    transaction();
  }

  deleteAllItemsByHistory(historyId: string, deletedBy: string): void {
    const beforeItems = this.findAllItemsForHistory(historyId);
    const southType = this.findHistoryById(historyId)?.southType;
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          `DELETE FROM ${HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE}
         WHERE id IN (
           SELECT id FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?
         );`
        )
        .run(historyId);
      this.database.prepare(`DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`).run(historyId);
      for (const item of beforeItems) {
        this.auditService.record(
          'history_query_item',
          item.id,
          'DELETE',
          southType ? this.redactItem(item, southType) : (item as unknown as Record<string, unknown>),
          null,
          deletedBy
        );
      }
    });
    transaction();
  }

  enableItem(id: string): void {
    const query = `UPDATE ${HISTORY_ITEMS_TABLE} SET enabled = 1 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  disableItem(id: string): void {
    const query = `UPDATE ${HISTORY_ITEMS_TABLE} SET enabled = 0 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  private findTransformersForHistory(historyId: string): Array<HistoryTransformerWithOptions> {
    const query =
      `SELECT t.id, t.type, t.input_type, t.output_type, t.function_name, t.name, t.description, t.custom_manifest, t.custom_code, t.language, t.timeout, t.created_by, t.updated_by, t.created_at, t.updated_at, ` +
      `ht.options, ht.id as htId FROM ${HISTORY_TRANSFORMERS_TABLE} ht JOIN ${TRANSFORMERS_TABLE} t ON ht.transformer_id = t.id WHERE ht.history_id = ?;`;
    const result = this.database.prepare(query).all(historyId) as Array<Record<string, string>>;
    return result.map(element => ({
      id: element.htId,
      transformer: toTransformer(element),
      options: JSON.parse(element.options),
      items: this.findHistoryItems(element.htId)
    }));
  }

  private findHistoryItems(historyTransformerId: string): Array<SouthConnectorItemEntityLight> {
    const query = `SELECT ht.id, ht.item_id, hi.name, hi.enabled, hi.created_by, hi.updated_by, hi.created_at, hi.updated_at FROM ${HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE} ht JOIN ${HISTORY_ITEMS_TABLE} hi ON ht.item_id = hi.id WHERE ht.id = ?;`;
    const results = this.database.prepare(query).all(historyTransformerId) as Array<Record<string, string>>;
    return results.map(result => ({
      id: result.item_id as string,
      name: result.name as string,
      enabled: Boolean(result.enabled),
      createdBy: result.created_by,
      updatedBy: result.updated_by,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    }));
  }

  private findScanModeForHistory(scanModeId: string): ScanMode {
    const query = `SELECT ${scanModeColumns()} FROM ${SCAN_MODE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(scanModeId) as Record<string, string>;
    return toScanMode(result);
  }

  /**
   * Returns a shallow copy of the history query with its south/north settings' secret fields redacted,
   * using the same manifest-driven filtering applied before exposing the history query to the frontend
   * (see toHistoryQueryDTO in history-query.service.ts), so real secrets never end up persisted in the
   * audit trail.
   */
  private redactHistory(
    entity: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null
  ): Record<string, unknown> | null {
    if (!entity) return null;
    const southManifest = southManifestList.find(element => element.id === entity.southType);
    const northManifest = northManifestList.find(element => element.id === entity.northType);
    return {
      ...entity,
      southSettings: southManifest ? encryptionService.filterSecrets(entity.southSettings, southManifest.settings) : entity.southSettings,
      northSettings: northManifest ? encryptionService.filterSecrets(entity.northSettings, northManifest.settings) : entity.northSettings
    };
  }

  /**
   * Returns a shallow copy of the history query item with its settings' secret fields redacted, using
   * the same item-level manifest lookup as toHistoryQueryItemDTO in history-query-item-dto.utils.ts.
   */
  private redactItem(entity: HistoryQueryItemEntity<SouthItemSettings> | null, southType: string): Record<string, unknown> | null {
    if (!entity) return null;
    const manifest = southManifestList.find(element => element.id === southType);
    if (!manifest) return entity as unknown as Record<string, unknown>;
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(attribute => attribute.key === 'settings') as
      OIBusObjectAttribute | undefined;
    if (!itemSettingsManifest) return entity as unknown as Record<string, unknown>;
    return { ...entity, settings: encryptionService.filterSecrets(entity.settings, itemSettingsManifest) };
  }

  private toHistoryQueryItemEntity(result: Record<string, string>): HistoryQueryItemEntity<SouthItemSettings> {
    return {
      id: result.id,
      name: result.name,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings) as SouthItemSettings,
      createdBy: result.created_by,
      updatedBy: result.updated_by,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  }

  private toHistoryQueryEntity(
    result: Record<string, string | number>
  ): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> {
    return {
      id: result.id as string,
      name: result.name as string,
      description: result.description as string,
      status: result.status as HistoryQueryStatus,
      southType: result.south_type as OIBusSouthType,
      southSettings: JSON.parse(result.south_settings as string) as SouthSettings,
      queryTimeRange: {
        startTime: result.start_time as Instant,
        endTime: result.end_time as Instant,
        maxReadInterval: result.throttling_max_read_interval as number,
        readDelay: result.throttling_read_delay as number
      },
      northType: result.north_type as OIBusNorthType,
      northSettings: JSON.parse(result.north_settings as string) as NorthSettings,
      caching: {
        trigger: {
          scanMode: this.findScanModeForHistory(result.caching_trigger_schedule as string),
          numberOfElements: result.caching_trigger_number_of_elements as number,
          numberOfFiles: result.caching_trigger_number_of_files as number
        },
        throttling: {
          runMinDelay: result.caching_throttling_run_min_delay as number,
          maxSize: result.caching_throttling_cache_max_size as number,
          maxNumberOfElements: result.caching_throttling_max_number_of_elements as number
        },
        error: {
          retryInterval: result.caching_error_retry_interval as number,
          retryCount: result.caching_error_retry_count as number,
          retentionDuration: result.caching_error_retention_duration as number
        },
        archive: {
          enabled: Boolean(result.caching_archive_enabled),
          retentionDuration: result.caching_archive_retention_duration as number
        }
      },
      items: this.findAllItemsForHistory(result.id as string),
      northTransformers: this.findTransformersForHistory(result.id as string),
      createdBy: result.created_by as string,
      updatedBy: result.updated_by as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string
    };
  }
}

export const toHistoryQueryLight = (result: Record<string, string>): HistoryQueryEntityLight => {
  return {
    id: result.id,
    name: result.name,
    description: result.description,
    status: result.status as HistoryQueryStatus,
    startTime: result.start_time,
    endTime: result.end_time,
    southType: result.south_type as OIBusSouthType,
    northType: result.north_type as OIBusNorthType,
    createdBy: result.created_by,
    updatedBy: result.updated_by,
    createdAt: result.created_at,
    updatedAt: result.updated_at
  };
};
