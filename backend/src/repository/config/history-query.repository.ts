import { HistoryQueryItemSearchParam, HistoryQueryStatus } from '../../../shared/model/history-query.model';
import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import {
  HistoryQueryEntity,
  HistoryQueryEntityLight,
  NorthHistoryQueryItemEntity,
  SouthHistoryQueryItemEntity
} from '../../model/histor-query.model';
import { Page } from '../../../shared/model/types';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthItemSettings, NorthSettings } from '../../../shared/model/north-settings.model';
import { Instant } from '../../model/types';
import { OIBusNorthType } from '../../../shared/model/north-connector.model';
import { OIBusSouthType } from '../../../shared/model/south-connector.model';
import { Transformer } from '../../model/transformer.model';

const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_SOUTH_ITEMS_TABLE = 'history_south_items';
const HISTORY_NORTH_ITEMS_TABLE = 'history_north_items';
const HISTORY_TRANSFORMERS_TABLE = 'history_transformers';
const TRANSFORMERS_TABLE = 'transformers';
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

  findAllHistoryQueriesFull(): Array<HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>> {
    const query =
      `SELECT id, name, description, status, start_time, end_time, ` +
      `south_type, north_type, south_settings, north_settings, ` +
      `caching_scan_mode_id, caching_group_count, caching_retry_interval, ` +
      `caching_retry_count, caching_max_send_count, ` +
      `caching_send_file_immediately, caching_max_size, archive_enabled, ` +
      `archive_retention_duration FROM ${HISTORY_QUERIES_TABLE};`;
    const result = this.database.prepare(query).all();

    return result.map(element => this.toHistoryQueryEntity(element as Record<string, string | number>));
  }

  findHistoryQueryById<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings, J extends NorthItemSettings>(
    id: string
  ): HistoryQueryEntity<S, N, I, J> | null {
    const query =
      `SELECT id, name, description, status, start_time, end_time, ` +
      `south_type, north_type, south_settings, north_settings, ` +
      `caching_scan_mode_id, caching_group_count, caching_retry_interval, ` +
      `caching_retry_count, caching_max_send_count, ` +
      `caching_send_file_immediately, caching_max_size, archive_enabled, ` +
      `archive_retention_duration FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) {
      return null;
    }
    return this.toHistoryQueryEntity<S, N, I, J>(result as Record<string, string | number>);
  }

  saveHistoryQuery<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings, J extends NorthItemSettings>(
    historyQuery: HistoryQueryEntity<S, N, I, J>
  ): void {
    const transaction = this.database.transaction(() => {
      if (!historyQuery.id) {
        historyQuery.id = generateRandomId(6);
        const insertQuery =
          `INSERT INTO ${HISTORY_QUERIES_TABLE} (id, name, description, status, ` +
          `start_time, end_time, south_type, north_type, south_settings, north_settings, caching_scan_mode_id, caching_group_count, ` +
          `caching_retry_interval, caching_retry_count, caching_max_send_count, caching_send_file_immediately, caching_max_size, archive_enabled, ` +
          `archive_retention_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
          `UPDATE ${HISTORY_QUERIES_TABLE} SET name = ?, description = ?, start_time = ?, ` +
          `end_time = ?, south_type = ?, north_type = ?, south_settings = ?, north_settings = ?,` +
          `caching_scan_mode_id = ?, caching_group_count = ?, caching_retry_interval = ?, caching_retry_count = ?, ` +
          `caching_max_send_count = ?, caching_send_file_immediately = ?, caching_max_size = ?, archive_enabled = ?, archive_retention_duration = ? ` +
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

      if (historyQuery.southItems.length > 0) {
        this.database
          .prepare(
            `DELETE FROM ${HISTORY_SOUTH_ITEMS_TABLE} WHERE history_id = ? AND id NOT IN (${historyQuery.southItems.map(() => '?').join(', ')});`
          )
          .run(
            historyQuery.id,
            historyQuery.southItems.map(item => item.id)
          );

        const insert = this.database.prepare(
          `INSERT INTO ${HISTORY_SOUTH_ITEMS_TABLE} (id, name, enabled, history_id, settings) VALUES (?, ?, ?, ?, ?);`
        );
        const update = this.database.prepare(`UPDATE ${HISTORY_SOUTH_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ? WHERE id = ?;`);
        for (const item of historyQuery.southItems) {
          if (!item.id) {
            item.id = generateRandomId(6);
            insert.run(item.id, item.name, +item.enabled, historyQuery.id, JSON.stringify(item.settings));
          } else {
            update.run(item.name, +item.enabled, JSON.stringify(item.settings), item.id);
          }
        }
      } else {
        this.database.prepare(`DELETE FROM ${HISTORY_SOUTH_ITEMS_TABLE} WHERE history_id = ?;`).run(historyQuery.id);
      }

      if (historyQuery.northItems.length > 0) {
        this.database
          .prepare(
            `DELETE FROM ${HISTORY_NORTH_ITEMS_TABLE} WHERE history_id = ? AND id NOT IN (${historyQuery.northItems.map(() => '?').join(', ')});`
          )
          .run(
            historyQuery.id,
            historyQuery.northItems.map(item => item.id)
          );

        const insert = this.database.prepare(
          `INSERT INTO ${HISTORY_NORTH_ITEMS_TABLE} (id, name, enabled, history_id, settings) VALUES (?, ?, ?, ?, ?);`
        );
        const update = this.database.prepare(`UPDATE ${HISTORY_NORTH_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ? WHERE id = ?;`);
        for (const item of historyQuery.northItems) {
          if (!item.id) {
            item.id = generateRandomId(6);
            insert.run(item.id, item.name, +item.enabled, historyQuery.id, JSON.stringify(item.settings));
          } else {
            update.run(item.name, +item.enabled, JSON.stringify(item.settings), item.id);
          }
        }
      } else {
        this.database.prepare(`DELETE FROM ${HISTORY_NORTH_ITEMS_TABLE} WHERE history_id = ?;`).run(historyQuery.id);
      }

      this.database.prepare(`DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?;`).run(historyQuery.id);
      if (historyQuery.southTransformers.length > 0) {
        const insert = this.database.prepare(
          `INSERT INTO ${HISTORY_TRANSFORMERS_TABLE} (history_id, connector_type, transformer_id, transformer_order) VALUES (?, ?, ?, ?);`
        );
        for (const transformer of historyQuery.southTransformers) {
          insert.run(historyQuery.id, 'south', transformer.transformer.id, transformer.order);
        }
      }
      if (historyQuery.northTransformers.length > 0) {
        const insert = this.database.prepare(
          `INSERT INTO ${HISTORY_TRANSFORMERS_TABLE} (history_id, connector_type, transformer_id, transformer_order) VALUES (?, ?, ?, ?);`
        );
        for (const transformer of historyQuery.northTransformers) {
          insert.run(historyQuery.id, 'north', transformer.transformer.id, transformer.order);
        }
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
      this.database.prepare(`DELETE FROM ${HISTORY_SOUTH_ITEMS_TABLE} WHERE history_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`).run(id);
    });
    transaction();
  }

  searchSouthHistoryQueryItems<I extends SouthItemSettings>(
    historyId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Page<SouthHistoryQueryItemEntity<I>> {
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

    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_SOUTH_ITEMS_TABLE} ${whereClause} LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toSouthHistoryQueryItemEntity<I>(result as Record<string, string>));
    const totalElements: number = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${HISTORY_SOUTH_ITEMS_TABLE} ${whereClause}`).get(...queryParams) as {
        count: number;
      }
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

  searchNorthHistoryQueryItems<I extends NorthItemSettings>(
    historyId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Page<NorthHistoryQueryItemEntity<I>> {
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

    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_NORTH_ITEMS_TABLE} ${whereClause} LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toNorthHistoryQueryItemEntity<I>(result as Record<string, string>));
    const totalElements: number = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${HISTORY_NORTH_ITEMS_TABLE} ${whereClause}`).get(...queryParams) as {
        count: number;
      }
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

  listSouthHistoryQueryItems<I extends SouthItemSettings>(
    historyId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Array<SouthHistoryQueryItemEntity<I>> {
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

    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_SOUTH_ITEMS_TABLE} ${whereClause};`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toSouthHistoryQueryItemEntity<I>(result as Record<string, string>));
  }

  listNorthHistoryQueryItems<I extends NorthItemSettings>(
    historyId: string,
    searchParams: HistoryQueryItemSearchParam
  ): Array<NorthHistoryQueryItemEntity<I>> {
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

    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_NORTH_ITEMS_TABLE} ${whereClause};`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toNorthHistoryQueryItemEntity<I>(result as Record<string, string>));
  }

  findAllSouthItemsForHistoryQuery<I extends SouthItemSettings>(historyQueryId: string): Array<SouthHistoryQueryItemEntity<I>> {
    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_SOUTH_ITEMS_TABLE} WHERE history_id = ?;`;
    return this.database
      .prepare(query)
      .all(historyQueryId)
      .map(result => this.toSouthHistoryQueryItemEntity<I>(result as Record<string, string>));
  }

  findAllNorthItemsForHistoryQuery<I extends NorthItemSettings>(historyQueryId: string): Array<NorthHistoryQueryItemEntity<I>> {
    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_NORTH_ITEMS_TABLE} WHERE history_id = ?;`;
    return this.database
      .prepare(query)
      .all(historyQueryId)
      .map(result => this.toNorthHistoryQueryItemEntity<I>(result as Record<string, string>));
  }

  findSouthHistoryQueryItemById<I extends SouthItemSettings>(
    historyQueryId: string,
    historyQueryItemId: string
  ): SouthHistoryQueryItemEntity<I> | null {
    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_SOUTH_ITEMS_TABLE} WHERE id = ? AND history_id = ?;`;
    const result = this.database.prepare(query).get(historyQueryItemId, historyQueryId);
    if (!result) return null;
    return this.toSouthHistoryQueryItemEntity(result as Record<string, string>);
  }

  findNorthHistoryQueryItemById<I extends NorthItemSettings>(
    historyQueryId: string,
    historyQueryItemId: string
  ): NorthHistoryQueryItemEntity<I> | null {
    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_NORTH_ITEMS_TABLE} WHERE id = ? AND history_id = ?;`;
    const result = this.database.prepare(query).get(historyQueryItemId, historyQueryId);
    if (!result) return null;
    return this.toNorthHistoryQueryItemEntity(result as Record<string, string>);
  }

  saveSouthHistoryQueryItem<I extends SouthItemSettings>(historyId: string, historyQueryItem: SouthHistoryQueryItemEntity<I>): void {
    if (!historyQueryItem.id) {
      historyQueryItem.id = generateRandomId(6);
      const insertQuery = `INSERT INTO ${HISTORY_SOUTH_ITEMS_TABLE} (id, name, enabled, history_id, settings) ` + `VALUES (?, ?, ?, ?, ?);`;
      this.database
        .prepare(insertQuery)
        .run(historyQueryItem.id, historyQueryItem.name, +historyQueryItem.enabled, historyId, JSON.stringify(historyQueryItem.settings));
    } else {
      const query = `UPDATE ${HISTORY_SOUTH_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ? WHERE id = ?;`;
      this.database
        .prepare(query)
        .run(historyQueryItem.name, +historyQueryItem.enabled, JSON.stringify(historyQueryItem.settings), historyQueryItem.id);
    }
  }

  saveNorthHistoryQueryItem<I extends NorthItemSettings>(historyId: string, historyQueryItem: NorthHistoryQueryItemEntity<I>): void {
    if (!historyQueryItem.id) {
      historyQueryItem.id = generateRandomId(6);
      const insertQuery = `INSERT INTO ${HISTORY_NORTH_ITEMS_TABLE} (id, name, enabled, history_id, settings) ` + `VALUES (?, ?, ?, ?, ?);`;
      this.database
        .prepare(insertQuery)
        .run(historyQueryItem.id, historyQueryItem.name, +historyQueryItem.enabled, historyId, JSON.stringify(historyQueryItem.settings));
    } else {
      const query = `UPDATE ${HISTORY_NORTH_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ? WHERE id = ?;`;
      this.database
        .prepare(query)
        .run(historyQueryItem.name, +historyQueryItem.enabled, JSON.stringify(historyQueryItem.settings), historyQueryItem.id);
    }
  }

  saveAllSouthItems<I extends SouthItemSettings>(
    historyQueryId: string,
    historyQueryItems: Array<SouthHistoryQueryItemEntity<I>>,
    deleteItemsNotPresent: boolean
  ): void {
    const transaction = this.database.transaction(() => {
      if (deleteItemsNotPresent) {
        this.deleteAllSouthHistoryQueryItemsByHistoryQuery(historyQueryId);
      }
      for (const item of historyQueryItems) {
        this.saveSouthHistoryQueryItem<I>(historyQueryId, item);
      }
    });
    transaction();
  }

  saveAllNorthItems<I extends NorthItemSettings>(
    historyQueryId: string,
    historyQueryItems: Array<NorthHistoryQueryItemEntity<I>>,
    deleteItemsNotPresent: boolean
  ): void {
    const transaction = this.database.transaction(() => {
      if (deleteItemsNotPresent) {
        this.deleteAllNorthHistoryQueryItemsByHistoryQuery(historyQueryId);
      }
      for (const item of historyQueryItems) {
        this.saveNorthHistoryQueryItem<I>(historyQueryId, item);
      }
    });
    transaction();
  }

  deleteSouthHistoryQueryItem(historyQueryId: string): void {
    const query = `DELETE FROM ${HISTORY_SOUTH_ITEMS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(historyQueryId);
  }

  deleteNorthHistoryQueryItem(historyQueryId: string): void {
    const query = `DELETE FROM ${HISTORY_NORTH_ITEMS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(historyQueryId);
  }

  deleteAllSouthHistoryQueryItemsByHistoryQuery(historyQueryId: string): void {
    const query = `DELETE FROM ${HISTORY_SOUTH_ITEMS_TABLE} WHERE history_id = ?;`;
    this.database.prepare(query).run(historyQueryId);
  }

  deleteAllNorthHistoryQueryItemsByHistoryQuery(historyQueryId: string): void {
    const query = `DELETE FROM ${HISTORY_NORTH_ITEMS_TABLE} WHERE history_id = ?;`;
    this.database.prepare(query).run(historyQueryId);
  }

  enableSouthHistoryQueryItem(id: string): void {
    const query = `UPDATE ${HISTORY_SOUTH_ITEMS_TABLE} SET enabled = 1 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  enableNorthHistoryQueryItem(id: string): void {
    const query = `UPDATE ${HISTORY_NORTH_ITEMS_TABLE} SET enabled = 1 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  disableSouthHistoryQueryItem(id: string): void {
    const query = `UPDATE ${HISTORY_SOUTH_ITEMS_TABLE} SET enabled = 0 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  disableNorthHistoryQueryItem(id: string): void {
    const query = `UPDATE ${HISTORY_NORTH_ITEMS_TABLE} SET enabled = 0 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  findAllTransformersForHistory(historyId: string, type: 'south' | 'north'): Array<{ transformer: Transformer; order: number }> {
    const query = `SELECT t.id, t.name, t.description, t.input_type, t.output_type, t.code, ht.transformer_order FROM ${HISTORY_TRANSFORMERS_TABLE} ht JOIN ${TRANSFORMERS_TABLE} t ON ht.transformer_id = t.id WHERE ht.history_id = ? AND ht.connector_type = ?`;
    return this.database
      .prepare(query)
      .all(historyId, type)
      .map(result => this.toTransformer(result as Record<string, string | number>));
  }

  private toTransformer(result: Record<string, string | number>): { transformer: Transformer; order: number } {
    return {
      order: result.transformer_order as number,
      transformer: {
        id: result.id as string,
        name: result.name as string,
        description: result.description as string,
        inputType: result.input_type as string,
        outputType: result.output_type as string,
        code: result.code as string
      }
    };
  }

  private toSouthHistoryQueryItemEntity<I extends SouthItemSettings>(result: Record<string, string>): SouthHistoryQueryItemEntity<I> {
    return {
      id: result.id,
      name: result.name,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings) as I
    };
  }

  private toNorthHistoryQueryItemEntity<I extends NorthItemSettings>(result: Record<string, string>): NorthHistoryQueryItemEntity<I> {
    return {
      id: result.id,
      name: result.name,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings) as I
    };
  }

  private toHistoryQueryEntity<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings, J extends NorthItemSettings>(
    result: Record<string, string | number>
  ): HistoryQueryEntity<S, N, I, J> {
    return {
      id: result.id as string,
      name: result.name as string,
      description: result.description as string,
      status: result.status as HistoryQueryStatus,
      startTime: result.start_time as Instant,
      endTime: result.end_time as Instant,
      southType: result.south_type as OIBusSouthType,
      northType: result.north_type as OIBusNorthType,
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
      southItems: this.findAllSouthItemsForHistoryQuery<I>(result.id as string),
      northItems: this.findAllNorthItemsForHistoryQuery<J>(result.id as string),
      northTransformers: this.findAllTransformersForHistory(result.id as string, 'north'),
      southTransformers: this.findAllTransformersForHistory(result.id as string, 'south')
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
