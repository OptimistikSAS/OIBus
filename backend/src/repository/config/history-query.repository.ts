import { HistoryQueryItemSearchParam, HistoryQueryStatus } from '../../../../shared/model/history-query.model';
import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { HistoryQueryEntity, HistoryQueryEntityLight, HistoryQueryItemEntity } from '../../model/histor-query.model';
import { Page } from '../../../../shared/model/types';
import { SouthItemSettings, SouthSettings } from '../../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../../shared/model/north-settings.model';
import { Instant } from '../../model/types';

const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';
const PAGE_SIZE = 50;

export default class HistoryQueryRepository {
  constructor(private readonly database: Database) {}

  findAllHistoryQueries(): Array<HistoryQueryEntityLight> {
    const query = `SELECT id, name, description, status, start_time, end_time, south_type, north_type FROM ${HISTORY_QUERIES_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => toHistoryQueryLight(result as Record<string, string>));
  }

  findHistoryQueryById<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings>(
    id: string
  ): HistoryQueryEntity<S, N, I> | null {
    const query =
      `SELECT id, name, description, status, history_max_instant_per_item, ` +
      `history_max_read_interval, history_read_delay, start_time, end_time, ` +
      `south_type, north_type, south_settings, north_settings, ` +
      `caching_scan_mode_id, caching_group_count, caching_retry_interval, ` +
      `caching_retry_count, caching_max_send_count, ` +
      `caching_send_file_immediately, caching_max_size, archive_enabled, ` +
      `archive_retention_duration FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) {
      return null;
    }
    return this.toHistoryQueryEntity<S, N, I>(result as Record<string, string | number>);
  }

  saveHistoryQuery<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings>(
    historyQuery: HistoryQueryEntity<S, N, I>
  ): void {
    const transaction = this.database.transaction(() => {
      if (!historyQuery.id) {
        historyQuery.id = generateRandomId(6);
        const insertQuery =
          `INSERT INTO ${HISTORY_QUERIES_TABLE} (id, name, description, status, history_max_instant_per_item, history_max_read_interval, ` +
          `history_read_delay, start_time, end_time, south_type, north_type, south_settings, north_settings, caching_scan_mode_id, caching_group_count, ` +
          `caching_retry_interval, caching_retry_count, caching_max_send_count, caching_send_file_immediately, caching_max_size, archive_enabled, ` +
          `archive_retention_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        this.database.prepare(insertQuery).run(
          historyQuery.id,
          historyQuery.name,
          historyQuery.description,
          'PENDING', // disabled by default at creation
          +historyQuery.history.maxInstantPerItem,
          historyQuery.history.maxReadInterval,
          historyQuery.history.readDelay,
          historyQuery.startTime,
          historyQuery.endTime,
          historyQuery.southType,
          historyQuery.northType,
          JSON.stringify(historyQuery.southSettings),
          JSON.stringify(historyQuery.northSettings),
          historyQuery.caching.scanModeId,
          historyQuery.caching.oibusTimeValues.groupCount,
          historyQuery.caching.retryInterval,
          historyQuery.caching.retryCount,
          historyQuery.caching.oibusTimeValues.maxSendCount,
          +historyQuery.caching.rawFiles.sendFileImmediately,
          historyQuery.caching.maxSize,
          +historyQuery.caching.rawFiles.archive.enabled,
          historyQuery.caching.rawFiles.archive.retentionDuration
        );
      } else {
        const query =
          `UPDATE ${HISTORY_QUERIES_TABLE} SET name = ?, description = ?, history_max_instant_per_item = ?, ` +
          `history_max_read_interval = ?, history_read_delay = ?, start_time = ?, ` +
          `end_time = ?, south_type = ?, north_type = ?, south_settings = ?, north_settings = ?,` +
          `caching_scan_mode_id = ?, caching_group_count = ?, caching_retry_interval = ?, caching_retry_count = ?, ` +
          `caching_max_send_count = ?, caching_send_file_immediately = ?, caching_max_size = ?, archive_enabled = ?, archive_retention_duration = ? ` +
          `WHERE id = ?;`;
        this.database
          .prepare(query)
          .run(
            historyQuery.name,
            historyQuery.description,
            +historyQuery.history.maxInstantPerItem,
            historyQuery.history.maxReadInterval,
            historyQuery.history.readDelay,
            historyQuery.startTime,
            historyQuery.endTime,
            historyQuery.southType,
            historyQuery.northType,
            JSON.stringify(historyQuery.southSettings),
            JSON.stringify(historyQuery.northSettings),
            historyQuery.caching.scanModeId,
            historyQuery.caching.oibusTimeValues.groupCount,
            historyQuery.caching.retryInterval,
            historyQuery.caching.retryCount,
            historyQuery.caching.oibusTimeValues.maxSendCount,
            +historyQuery.caching.rawFiles.sendFileImmediately,
            historyQuery.caching.maxSize,
            +historyQuery.caching.rawFiles.archive.enabled,
            historyQuery.caching.rawFiles.archive.retentionDuration,
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
      this.database.prepare(`DELETE FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`).run(id);
    });
    transaction();
  }

  searchHistoryQueryItems<I extends SouthItemSettings>(
    historyId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Page<HistoryQueryItemEntity<I>> {
    let whereClause = `WHERE history_id = ?`;
    const queryParams = [historyId];

    const page = searchParams.page ?? 0;

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
      .map(result => this.toHistoryQueryItemEntity<I>(result as Record<string, string>));
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

  listHistoryQueryItems<I extends SouthItemSettings>(
    historyId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Array<HistoryQueryItemEntity<I>> {
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
      .map(result => this.toHistoryQueryItemEntity<I>(result as Record<string, string>));
  }

  findAllItemsForHistoryQuery<I extends SouthItemSettings>(historyQueryId: string): Array<HistoryQueryItemEntity<I>> {
    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`;
    return this.database
      .prepare(query)
      .all(historyQueryId)
      .map(result => this.toHistoryQueryItemEntity<I>(result as Record<string, string>));
  }

  findHistoryQueryItemById<I extends SouthItemSettings>(
    historyQueryId: string,
    historyQueryItemId: string
  ): HistoryQueryItemEntity<I> | null {
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

  saveAllItems<I extends SouthItemSettings>(historyQueryId: string, historyQueryItems: Array<HistoryQueryItemEntity<I>>): void {
    const transaction = this.database.transaction(() => {
      for (const item of historyQueryItems) {
        this.saveHistoryQueryItem<I>(historyQueryId, item);
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

  private toHistoryQueryItemEntity<I extends SouthItemSettings>(result: Record<string, string>): HistoryQueryItemEntity<I> {
    return {
      id: result.id,
      name: result.name,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings) as I
    };
  }

  private toHistoryQueryEntity<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings>(
    result: Record<string, string | number>
  ): HistoryQueryEntity<S, N, I> {
    return {
      id: result.id as string,
      name: result.name as string,
      description: result.description as string,
      status: result.status as HistoryQueryStatus,
      history: {
        maxInstantPerItem: Boolean(result.history_max_instant_per_item),
        readDelay: result.history_read_delay as number,
        maxReadInterval: result.history_max_read_interval as number
      },
      startTime: result.start_time as Instant,
      endTime: result.end_time as Instant,
      southType: result.south_type as string,
      northType: result.north_type as string,
      southSettings: JSON.parse(result.south_settings as string) as S,
      northSettings: JSON.parse(result.north_settings as string) as N,
      caching: {
        scanModeId: result.caching_scan_mode_id as string,
        retryInterval: result.caching_retry_interval as number,
        retryCount: result.caching_retry_count as number,
        maxSize: result.caching_max_size as number,
        oibusTimeValues: {
          groupCount: result.caching_group_count as number,
          maxSendCount: result.caching_max_send_count as number
        },
        rawFiles: {
          sendFileImmediately: Boolean(result.caching_send_file_immediately),
          archive: {
            enabled: Boolean(result.archive_enabled),
            retentionDuration: result.archive_retention_duration as number
          }
        }
      },
      items: this.findAllItemsForHistoryQuery<I>(result.id as string)
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
    southType: result.south_type,
    northType: result.north_type
  };
};
