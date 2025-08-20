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
import { TransformerWithOptions } from '../../model/transformer.model';
import { toTransformer } from './transformer.repository';
import { ScanMode } from '../../model/scan-mode.model';
import { toScanMode } from './scan-mode.repository';
import { TransformerDTOWithOptions } from '../../../shared/model/transformer.model';

const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';
const HISTORY_TRANSFORMERS_TABLE = 'history_query_transformers';
const TRANSFORMERS_TABLE = 'transformers';
const SCAN_MODE = 'scan_modes';
const PAGE_SIZE = 50;

export default class HistoryQueryRepository {
  constructor(private readonly database: Database) {}

  findAllHistoryQueriesLight(): Array<HistoryQueryEntityLight> {
    const query = `SELECT id, name, description, status, start_time, end_time, south_type, north_type FROM ${HISTORY_QUERIES_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => toHistoryQueryLight(result as Record<string, string>));
  }

  findAllHistoryQueriesFull(): Array<HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>> {
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

  findHistoryQueryById(id: string): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null {
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

  saveHistoryQuery(historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>): void {
    const transaction = this.database.transaction(() => {
      if (!historyQuery.id) {
        historyQuery.id = generateRandomId(6);
        const insertQuery =
          `INSERT INTO ${HISTORY_QUERIES_TABLE} (id, name, description, status, ` +
          `start_time, end_time, south_type, north_type, south_settings, north_settings, ` +
          `caching_trigger_schedule, caching_trigger_number_of_elements, caching_trigger_number_of_files, ` +
          `caching_throttling_run_min_delay, caching_throttling_cache_max_size, caching_throttling_max_number_of_elements, ` +
          `caching_error_retry_interval, caching_error_retry_count, caching_error_retention_duration, ` +
          `caching_archive_enabled, caching_archive_retention_duration) ` +
          `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        this.database.prepare(insertQuery).run(
          historyQuery.id,
          historyQuery.name,
          historyQuery.description,
          'PENDING', // disabled by default at creation
          historyQuery.startTime,
          historyQuery.endTime,
          historyQuery.southType,
          historyQuery.northType,
          JSON.stringify(historyQuery.southSettings),
          JSON.stringify(historyQuery.northSettings),
          historyQuery.caching.trigger.scanMode.id,
          historyQuery.caching.trigger.numberOfElements,
          historyQuery.caching.trigger.numberOfFiles,
          historyQuery.caching.throttling.runMinDelay,
          historyQuery.caching.throttling.maxSize,
          historyQuery.caching.throttling.maxNumberOfElements,
          historyQuery.caching.error.retryInterval,
          historyQuery.caching.error.retryCount,
          historyQuery.caching.error.retentionDuration,
          +historyQuery.caching.archive.enabled,
          historyQuery.caching.archive.retentionDuration
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
            historyQuery.name,
            historyQuery.description,
            historyQuery.startTime,
            historyQuery.endTime,
            historyQuery.southType,
            historyQuery.northType,
            JSON.stringify(historyQuery.southSettings),
            JSON.stringify(historyQuery.northSettings),
            historyQuery.caching.trigger.scanMode.id,
            historyQuery.caching.trigger.numberOfElements,
            historyQuery.caching.trigger.numberOfFiles,
            historyQuery.caching.throttling.runMinDelay,
            historyQuery.caching.throttling.maxSize,
            historyQuery.caching.throttling.maxNumberOfElements,
            historyQuery.caching.error.retryInterval,
            historyQuery.caching.error.retryCount,
            historyQuery.caching.error.retentionDuration,
            +historyQuery.caching.archive.enabled,
            historyQuery.caching.archive.retentionDuration,
            historyQuery.id
          );
      }

      if (historyQuery.items.length > 0) {
        this.database
          .prepare(
            `DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ? AND id NOT IN (${historyQuery.items.map(() => '?').join(', ')});`
          )
          .run(
            historyQuery.id,
            historyQuery.items.map(item => item.id)
          );

        const insert = this.database.prepare(
          `INSERT INTO ${HISTORY_ITEMS_TABLE} (id, name, enabled, history_id, settings) VALUES (?, ?, ?, ?, ?);`
        );
        const update = this.database.prepare(`UPDATE ${HISTORY_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ? WHERE id = ?;`);
        for (const item of historyQuery.items) {
          if (!item.id) {
            item.id = generateRandomId(6);
            insert.run(item.id, item.name, +item.enabled, historyQuery.id, JSON.stringify(item.settings));
          } else {
            update.run(item.name, +item.enabled, JSON.stringify(item.settings), item.id);
          }
        }
      } else {
        this.database.prepare(`DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`).run(historyQuery.id);
      }

      this.database.prepare(`DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?;`).run(historyQuery.id);
      const insert = this.database.prepare(
        `INSERT INTO ${HISTORY_TRANSFORMERS_TABLE} (history_id, transformer_id, options, input_type) VALUES (?, ?, ?, ?);`
      );
      for (const transformerWithOptions of historyQuery.northTransformers) {
        insert.run(
          historyQuery.id,
          transformerWithOptions.transformer.id,
          JSON.stringify(transformerWithOptions.options),
          transformerWithOptions.inputType
        );
      }
    });
    transaction();
  }

  updateHistoryQueryStatus(id: string, status: HistoryQueryStatus) {
    const query = `UPDATE ${HISTORY_QUERIES_TABLE} SET status = ? WHERE id = ?;`;
    this.database.prepare(query).run(status, id);
  }

  deleteHistoryQuery(id: string): void {
    const transaction = this.database.transaction(() => {
      this.database.prepare(`DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`).run(id);
    });
    transaction();
  }

  addOrEditTransformer(historyId: string, transformerWithOptions: TransformerDTOWithOptions): void {
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(`DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ? AND transformer_id = ?;`)
        .run(historyId, transformerWithOptions.transformer.id);
      const query = `INSERT INTO ${HISTORY_TRANSFORMERS_TABLE} (history_id, transformer_id, options, input_type) VALUES (?, ?, ?, ?);`;
      this.database
        .prepare(query)
        .run(
          historyId,
          transformerWithOptions.transformer.id,
          JSON.stringify(transformerWithOptions.options),
          transformerWithOptions.inputType
        );
    });
    transaction();
  }

  removeTransformer(historyId: string, transformerId: string): void {
    const query = `DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ? AND transformer_id = ?;`;
    this.database.prepare(query).run(historyId, transformerId);
  }

  searchHistoryQueryItems(historyId: string, searchParams: HistoryQueryItemSearchParam): Page<HistoryQueryItemEntity<SouthItemSettings>> {
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

  listHistoryQueryItems(
    historyId: string,
    searchParams: Omit<HistoryQueryItemSearchParam, 'page'>
  ): Array<HistoryQueryItemEntity<SouthItemSettings>> {
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

  findAllItemsForHistoryQuery(historyQueryId: string): Array<HistoryQueryItemEntity<SouthItemSettings>> {
    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`;
    return this.database
      .prepare(query)
      .all(historyQueryId)
      .map(result => this.toHistoryQueryItemEntity(result as Record<string, string>));
  }

  findHistoryQueryItemById(historyQueryId: string, historyQueryItemId: string): HistoryQueryItemEntity<SouthItemSettings> | null {
    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_ITEMS_TABLE} WHERE id = ? AND history_id = ?;`;
    const result = this.database.prepare(query).get(historyQueryItemId, historyQueryId);
    if (!result) return null;
    return this.toHistoryQueryItemEntity(result as Record<string, string>);
  }

  saveHistoryQueryItem<I extends SouthItemSettings>(historyId: string, historyQueryItem: HistoryQueryItemEntity<I>): void {
    if (!historyQueryItem.id) {
      historyQueryItem.id = generateRandomId(6);
      const insertQuery = `INSERT INTO ${HISTORY_ITEMS_TABLE} (id, name, enabled, history_id, settings) ` + `VALUES (?, ?, ?, ?, ?);`;
      this.database
        .prepare(insertQuery)
        .run(historyQueryItem.id, historyQueryItem.name, +historyQueryItem.enabled, historyId, JSON.stringify(historyQueryItem.settings));
    } else {
      const query = `UPDATE ${HISTORY_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ? WHERE id = ?;`;
      this.database
        .prepare(query)
        .run(historyQueryItem.name, +historyQueryItem.enabled, JSON.stringify(historyQueryItem.settings), historyQueryItem.id);
    }
  }

  saveAllItems(
    historyQueryId: string,
    historyQueryItems: Array<HistoryQueryItemEntity<SouthItemSettings>>,
    deleteItemsNotPresent: boolean
  ): void {
    const transaction = this.database.transaction(() => {
      if (deleteItemsNotPresent) {
        this.deleteAllHistoryQueryItemsByHistoryQuery(historyQueryId);
      }
      for (const item of historyQueryItems) {
        this.saveHistoryQueryItem(historyQueryId, item);
      }
    });
    transaction();
  }

  deleteHistoryQueryItem(historyQueryId: string): void {
    const query = `DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(historyQueryId);
  }

  deleteAllHistoryQueryItemsByHistoryQuery(historyQueryId: string): void {
    const query = `DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`;
    this.database.prepare(query).run(historyQueryId);
  }

  enableHistoryQueryItem(id: string): void {
    const query = `UPDATE ${HISTORY_ITEMS_TABLE} SET enabled = 1 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  disableHistoryQueryItem(id: string): void {
    const query = `UPDATE ${HISTORY_ITEMS_TABLE} SET enabled = 0 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  findTransformersForHistory(historyId: string): Array<TransformerWithOptions> {
    const query = `SELECT t.id,  t.type,  ht.input_type, t.output_type, t.function_name, t.name, t.description, t.custom_manifest, t.custom_code, t.language, ht.options FROM ${HISTORY_TRANSFORMERS_TABLE} ht JOIN ${TRANSFORMERS_TABLE} t ON ht.transformer_id = t.id WHERE ht.history_id = ?;`;
    const result = this.database.prepare(query).all(historyId) as Array<Record<string, string>>;
    return result.map(element => ({
      transformer: toTransformer(element),
      options: JSON.parse(element.options),
      inputType: element.input_type
    }));
  }

  findScanModeForHistoryQuery(scanModeId: string): ScanMode {
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
          scanMode: this.findScanModeForHistoryQuery(result.caching_trigger_schedule as string),
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
      items: this.findAllItemsForHistoryQuery(result.id as string),
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
