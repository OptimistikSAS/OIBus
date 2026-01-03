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
import { toScanMode } from './scan-mode.repository';

const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';
const HISTORY_TRANSFORMERS_TABLE = 'history_query_transformers';
const TRANSFORMERS_TABLE = 'transformers';
const SCAN_MODE = 'scan_modes';
const PAGE_SIZE = 50;

export default class HistoryQueryRepository {
  constructor(private readonly database: Database) {}

  findAllHistoriesLight(): Array<HistoryQueryEntityLight> {
    const query = `SELECT id, name, description, status, start_time, end_time, south_type, north_type FROM ${HISTORY_QUERIES_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => toHistoryQueryLight(result as Record<string, string>));
  }

  findAllHistoriesFull(): Array<HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>> {
    const query =
      `SELECT id, name, description, status, start_time, end_time, ` +
      `south_type, north_type, south_settings, north_settings, ` +
      `caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, ` +
      `caching_throttling_run_min_delay, caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, ` +
      `caching_error_retry_interval, caching_error_retry_count, caching_error_retention_duration, ` +
      `caching_archive_enabled, caching_archive_retention_duration ` +
      `FROM ${HISTORY_QUERIES_TABLE};`;
    const result = this.database.prepare(query).all();

    return result.map(element => this.toHistoryQueryEntity(element as Record<string, string | number>));
  }

  findHistoryById(id: string): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null {
    const query =
      `SELECT id, name, description, status, start_time, end_time, ` +
      `south_type, north_type, south_settings, north_settings, ` +
      `caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, ` +
      `caching_throttling_run_min_delay, caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, ` +
      `caching_error_retry_interval, caching_error_retry_count, caching_error_retention_duration, ` +
      `caching_archive_enabled, caching_archive_retention_duration ` +
      `FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) {
      return null;
    }
    return this.toHistoryQueryEntity(result as Record<string, string | number>);
  }

  saveHistory(history: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>): void {
    const transaction = this.database.transaction(() => {
      if (!history.id) {
        history.id = generateRandomId(6);
        const insertQuery =
          `INSERT INTO ${HISTORY_QUERIES_TABLE} (id, name, description, status, ` +
          `start_time, end_time, south_type, north_type, south_settings, north_settings, ` +
          `caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, ` +
          `caching_throttling_run_min_delay, caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, ` +
          `caching_error_retry_interval, caching_error_retry_count, caching_error_retention_duration, ` +
          `caching_archive_enabled, caching_archive_retention_duration) ` +
          `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        this.database.prepare(insertQuery).run(
          history.id,
          history.name,
          history.description,
          'PENDING', // disabled by default at creation
          history.startTime,
          history.endTime,
          history.southType,
          history.northType,
          JSON.stringify(history.southSettings),
          JSON.stringify(history.northSettings),
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
          history.caching.archive.retentionDuration
        );
      } else {
        const query =
          `UPDATE ${HISTORY_QUERIES_TABLE} SET name = ?, description = ?, start_time = ?, ` +
          `end_time = ?, south_type = ?, north_type = ?, south_settings = ?, north_settings = ?,` +
          `caching_trigger_schedule = ?, caching_trigger_number_of_elements = ?, caching_trigger_number_of_files = ?, ` +
          `caching_throttling_run_min_delay = ?, caching_throttling_cache_max_size = ?, caching_throttling_max_number_of_elements = ?, ` +
          `caching_error_retry_interval = ?, caching_error_retry_count = ?, caching_error_retention_duration = ?, ` +
          `caching_archive_enabled = ?, caching_archive_retention_duration = ? ` +
          `WHERE id = ?;`;
        this.database
          .prepare(query)
          .run(
            history.name,
            history.description,
            history.startTime,
            history.endTime,
            history.southType,
            history.northType,
            JSON.stringify(history.southSettings),
            JSON.stringify(history.northSettings),
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
            history.id
          );
      }

      if (history.items.length > 0) {
        this.database
          .prepare(`DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ? AND id NOT IN (${history.items.map(() => '?').join(', ')});`)
          .run(
            history.id,
            history.items.map(item => item.id)
          );

        const insert = this.database.prepare(
          `INSERT INTO ${HISTORY_ITEMS_TABLE} (id, name, enabled, history_id, settings) VALUES (?, ?, ?, ?, ?);`
        );
        const update = this.database.prepare(`UPDATE ${HISTORY_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ? WHERE id = ?;`);
        for (const item of history.items) {
          if (!item.id) {
            item.id = generateRandomId(6);
            insert.run(item.id, item.name, +item.enabled, history.id, JSON.stringify(item.settings));
          } else {
            update.run(item.name, +item.enabled, JSON.stringify(item.settings), item.id);
          }
        }
      } else {
        this.database.prepare(`DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`).run(history.id);
      }

      const keepIds = history.northTransformers.map(t => t.id);
      if (keepIds.length === 0) {
        // The list is empty, so we delete EVERYTHING for this history_id
        this.database.prepare(`DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?`).run(history.id);
      } else {
        // The list has items, so we delete only those NOT in the list
        const placeholders = keepIds.map(() => '?').join(',');

        const sql = `DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ? AND id NOT IN (${placeholders})`;
        // We spread (...keepIds) so they fill the placeholders after history.id
        this.database.prepare(sql).run(history.id, ...keepIds);
      }

      for (const transformerWithOptions of history.northTransformers) {
        this.addOrEditTransformer(history.id, transformerWithOptions);
      }
    });
    transaction();
  }

  updateHistoryStatus(id: string, status: HistoryQueryStatus) {
    const query = `UPDATE ${HISTORY_QUERIES_TABLE} SET status = ? WHERE id = ?;`;
    this.database.prepare(query).run(status, id);
  }

  deleteHistory(id: string): void {
    const transaction = this.database.transaction(() => {
      this.database.prepare(`DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`).run(id);
    });
    transaction();
  }

  addOrEditTransformer(historyId: string, transformerWithOptions: HistoryTransformerWithOptions): void {
    if (!transformerWithOptions.id) {
      transformerWithOptions.id = generateRandomId(6);
      const query = `INSERT INTO ${HISTORY_TRANSFORMERS_TABLE} (id, history_id, transformer_id, options, input_type) VALUES (?, ?, ?, ?, ?);`;
      this.database
        .prepare(query)
        .run(
          transformerWithOptions.id,
          historyId,
          transformerWithOptions.transformer.id,
          JSON.stringify(transformerWithOptions.options),
          transformerWithOptions.inputType
        );
    } else {
      const query = `UPDATE ${HISTORY_TRANSFORMERS_TABLE} SET transformer_id = ?, options = ?, input_type = ? WHERE id = ?;`;
      this.database
        .prepare(query)
        .run(
          transformerWithOptions.transformer.id,
          JSON.stringify(transformerWithOptions.options),
          transformerWithOptions.inputType,
          transformerWithOptions.id
        );
    }
  }

  removeTransformer(id: string): void {
    const query = `DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
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

    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_ITEMS_TABLE} ${whereClause} LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * page};`;
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

    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_ITEMS_TABLE} ${whereClause};`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toHistoryQueryItemEntity(result as Record<string, string>));
  }

  findAllItemsForHistory(historyId: string): Array<HistoryQueryItemEntity<SouthItemSettings>> {
    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`;
    return this.database
      .prepare(query)
      .all(historyId)
      .map(result => this.toHistoryQueryItemEntity(result as Record<string, string>));
  }

  findItemById(historyId: string, itemId: string): HistoryQueryItemEntity<SouthItemSettings> | null {
    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_ITEMS_TABLE} WHERE id = ? AND history_id = ?;`;
    const result = this.database.prepare(query).get(itemId, historyId);
    if (!result) return null;
    return this.toHistoryQueryItemEntity(result as Record<string, string>);
  }

  saveItem<I extends SouthItemSettings>(historyId: string, item: HistoryQueryItemEntity<I>): void {
    if (!item.id) {
      item.id = generateRandomId(6);
      const insertQuery = `INSERT INTO ${HISTORY_ITEMS_TABLE} (id, name, enabled, history_id, settings) ` + `VALUES (?, ?, ?, ?, ?);`;
      this.database.prepare(insertQuery).run(item.id, item.name, +item.enabled, historyId, JSON.stringify(item.settings));
    } else {
      const query = `UPDATE ${HISTORY_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ? WHERE id = ?;`;
      this.database.prepare(query).run(item.name, +item.enabled, JSON.stringify(item.settings), item.id);
    }
  }

  saveAllItems(historyId: string, items: Array<HistoryQueryItemEntity<SouthItemSettings>>, deleteItemsNotPresent: boolean): void {
    const transaction = this.database.transaction(() => {
      if (deleteItemsNotPresent) {
        this.deleteAllItemsByHistory(historyId);
      }
      for (const item of items) {
        this.saveItem(historyId, item);
      }
    });
    transaction();
  }

  deleteItem(historyId: string, itemId: string): void {
    const query = `DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ? AND id = ?;`;
    this.database.prepare(query).run(historyId, itemId);
  }

  deleteAllItemsByHistory(historyId: string): void {
    const query = `DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`;
    this.database.prepare(query).run(historyId);
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
    const query = `SELECT t.id, t.type, ht.input_type, t.output_type, t.function_name, t.name, t.description, t.custom_manifest, t.custom_code, t.language, ht.options, ht.id as htId FROM ${HISTORY_TRANSFORMERS_TABLE} ht JOIN ${TRANSFORMERS_TABLE} t ON ht.transformer_id = t.id WHERE ht.history_id = ?;`;
    const result = this.database.prepare(query).all(historyId) as Array<Record<string, string>>;
    return result.map(element => ({
      id: element.htId,
      transformer: toTransformer(element),
      options: JSON.parse(element.options),
      inputType: element.input_type
    }));
  }

  private findScanModeForHistory(scanModeId: string): ScanMode {
    const query = `SELECT id, name, description, cron FROM ${SCAN_MODE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(scanModeId) as Record<string, string>;
    return toScanMode(result);
  }

  private toHistoryQueryItemEntity(result: Record<string, string>): HistoryQueryItemEntity<SouthItemSettings> {
    return {
      id: result.id,
      name: result.name,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings) as SouthItemSettings
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
      startTime: result.start_time as Instant,
      endTime: result.end_time as Instant,
      southType: result.south_type as OIBusSouthType,
      northType: result.north_type as OIBusNorthType,
      southSettings: JSON.parse(result.south_settings as string) as SouthSettings,
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
      northTransformers: this.findTransformersForHistory(result.id as string)
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
    northType: result.north_type as OIBusNorthType
  };
};
