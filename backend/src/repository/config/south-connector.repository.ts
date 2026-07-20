import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import {
  SouthConnectorEntity,
  SouthConnectorEntityLight,
  SouthConnectorItemEntity,
  SouthItemGroupEntity,
  SouthItemGroupEntityLight
} from '../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { OIBusSouthType, SouthConnectorItemSearchParam } from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import { ScanMode } from '../../model/scan-mode.model';
import { toScanMode } from './scan-mode.repository';
import SouthItemGroupRepository from './south-item-group.repository';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const NORTH_TRANSFORMERS_ITEMS_TABLE = 'north_transformers_items';
const SCAN_MODE_TABLE = 'scan_modes';
const GROUP_ITEMS_TABLE = 'group_items';
const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';
const PAGE_SIZE = 50;

/**
 * SELECT clause and FROM clause shared by all item-fetching queries.
 * Using LEFT JOINs to resolve scan modes and groups in one round-trip.
 */
const ITEM_JOIN_SELECT =
  `SELECT si.id, si.name, si.enabled, si.scan_mode_id, si.settings, si.sync_with_group, ` +
  `si.max_read_interval, si.read_delay, si.overlap, si.created_by, si.updated_by, si.created_at, si.updated_at, ` +
  `sm.id AS sm_id, sm.name AS sm_name, sm.description AS sm_description, sm.cron AS sm_cron, ` +
  `sm.created_by AS sm_created_by, sm.updated_by AS sm_updated_by, ` +
  `sm.created_at AS sm_created_at, sm.updated_at AS sm_updated_at, ` +
  `g.id AS g_id, g.name AS g_name, g.overlap AS g_overlap, g.max_read_interval AS g_max_read_interval, ` +
  `g.read_delay AS g_read_delay, g.created_by AS g_created_by, g.updated_by AS g_updated_by, ` +
  `g.created_at AS g_created_at, g.updated_at AS g_updated_at, ` +
  `gsm.id AS gsm_id, gsm.name AS gsm_name, gsm.description AS gsm_description, gsm.cron AS gsm_cron, ` +
  `gsm.created_by AS gsm_created_by, gsm.updated_by AS gsm_updated_by, ` +
  `gsm.created_at AS gsm_created_at, gsm.updated_at AS gsm_updated_at`;

const ITEM_JOIN_FROM =
  `FROM ${SOUTH_ITEMS_TABLE} si ` +
  `LEFT JOIN ${SCAN_MODE_TABLE} sm ON si.scan_mode_id = sm.id ` +
  `LEFT JOIN ${GROUP_ITEMS_TABLE} gi ON si.id = gi.item_id ` +
  `LEFT JOIN ${SOUTH_ITEM_GROUPS_TABLE} g ON gi.group_id = g.id ` +
  `LEFT JOIN ${SCAN_MODE_TABLE} gsm ON g.scan_mode_id = gsm.id`;

export default class SouthConnectorRepository {
  private groupRepository: SouthItemGroupRepository;

  constructor(private readonly database: Database) {
    this.groupRepository = new SouthItemGroupRepository(database);
  }

  findAllSouth(): Array<SouthConnectorEntityLight> {
    const query = `SELECT id, name, type, description, enabled, created_by, updated_by, created_at, updated_at FROM ${SOUTH_CONNECTORS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => toSouthConnectorLight(result as Record<string, string>));
  }

  findSouthById(id: string): SouthConnectorEntity<SouthSettings, SouthItemSettings> | null {
    const query = `
        SELECT id, name, type, description, enabled, settings, created_by, updated_by, created_at, updated_at
        FROM ${SOUTH_CONNECTORS_TABLE}
        WHERE id = ?;`;

    const result = this.database.prepare(query).get(id);
    if (!result) {
      return null;
    }
    return this.toSouthConnector(result as Record<string, string | number>);
  }

  saveSouth(south: SouthConnectorEntity<SouthSettings, SouthItemSettings>): void {
    const transaction = this.database.transaction(() => {
      if (!south.id) {
        south.id = generateRandomId(6);
        const insertQuery = `INSERT INTO ${SOUTH_CONNECTORS_TABLE} (id, name, type, description, enabled, settings, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
        this.database
          .prepare(insertQuery)
          .run(
            south.id,
            south.name,
            south.type,
            south.description,
            +south.enabled,
            JSON.stringify(south.settings),
            south.createdBy,
            south.updatedBy
          );
      } else {
        const query = `UPDATE ${SOUTH_CONNECTORS_TABLE} SET name = ?, description = ?, enabled = ?, settings = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`;
        this.database
          .prepare(query)
          .run(south.name, south.description, +south.enabled, JSON.stringify(south.settings), south.updatedBy, south.id);
      }

      const groupsToCreate = south.groups.filter(group => group.id?.startsWith('temp_'));
      for (const groupToCreate of groupsToCreate) {
        const newGroup = this.groupRepository.create(
          {
            name: groupToCreate.name,
            southId: south.id,
            scanMode: groupToCreate.scanMode,
            overlap: groupToCreate.overlap,
            maxReadInterval: groupToCreate.maxReadInterval,
            readDelay: groupToCreate.readDelay
          },
          south.updatedBy
        );
        for (const item of south.items) {
          if (item.group?.id === groupToCreate.id) {
            item.group.id = newGroup.id;
          }
        }
        south.groups[south.groups.findIndex(group => group.id === groupToCreate.id)] = newGroup;
      }

      // Update existing groups (name, scan mode, history settings may have changed via the connector edit form)
      const updateGroupStmt = this.database.prepare(
        `UPDATE ${SOUTH_ITEM_GROUPS_TABLE} SET name = ?, scan_mode_id = ?, overlap = ?, max_read_interval = ?, read_delay = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`
      );
      for (const group of south.groups.filter(g => g.id && !g.id.startsWith('temp_'))) {
        updateGroupStmt.run(
          group.name,
          group.scanMode?.id ?? null,
          group.overlap ?? null,
          group.maxReadInterval ?? null,
          group.readDelay ?? null,
          south.updatedBy,
          group.id
        );
      }

      if (south.items.length > 0) {
        this.database
          .prepare(
            `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
                     WHERE id IN (
                       SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE source_south_south_id = ?
                     ) AND item_id NOT IN (${south.items
                       .filter(item => item.id)
                       .map(() => '?')
                       .join(', ')});`
          )
          .run(
            south.id,
            south.items.filter(item => item.id).map(item => item.id)
          );

        this.database
          .prepare(
            `DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ? AND id NOT IN (${south.items
              .filter(item => item.id)
              .map(() => '?')
              .join(', ')});`
          )
          .run(
            south.id,
            south.items.filter(item => item.id).map(item => item.id)
          );
        const insert = this.database.prepare(
          `INSERT INTO ${SOUTH_ITEMS_TABLE} (id, name, enabled, connector_id, scan_mode_id, settings, sync_with_group, max_read_interval, read_delay, overlap, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`
        );
        const update = this.database.prepare(
          `UPDATE ${SOUTH_ITEMS_TABLE} SET name = ?, enabled = ?, scan_mode_id = ?, settings = ?, sync_with_group = ?, max_read_interval = ?, read_delay = ?, overlap = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`
        );
        const insertGroup = this.database.prepare(`INSERT INTO ${GROUP_ITEMS_TABLE} (group_id, item_id) VALUES (?, ?);`);
        const deleteGroups = this.database.prepare(`DELETE FROM ${GROUP_ITEMS_TABLE} WHERE item_id = ?;`);

        for (const item of south.items) {
          if (!item.id) {
            item.id = generateRandomId(6);
            insert.run(
              item.id,
              item.name,
              +item.enabled,
              south.id,
              item.scanMode?.id ?? null,
              JSON.stringify(item.settings),
              +item.syncWithGroup,
              item.maxReadInterval ?? null,
              item.readDelay ?? null,
              item.overlap ?? null,
              item.createdBy,
              item.updatedBy
            );
          } else {
            update.run(
              item.name,
              +item.enabled,
              item.scanMode?.id ?? null,
              JSON.stringify(item.settings),
              +item.syncWithGroup,
              item.maxReadInterval ?? null,
              item.readDelay ?? null,
              item.overlap ?? null,
              item.updatedBy,
              item.id
            );
          }
          // Update groups
          deleteGroups.run(item.id);
          if (item.group) {
            insertGroup.run(item.group.id, item.id);
          }
        }
      } else {
        this.database
          .prepare(
            `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
                     WHERE id IN (
                       SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE source_south_south_id = ?
                     );`
          )
          .run(south.id);
        this.database.prepare(`DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`).run(south.id);
      }
      if (south.groups.length > 0) {
        this.database
          .prepare(
            `DELETE FROM ${SOUTH_ITEM_GROUPS_TABLE} WHERE south_id = ? AND id NOT IN (${south.groups
              .filter(group => group.id)
              .map(() => '?')
              .join(', ')});`
          )
          .run(
            south.id,
            south.groups.filter(group => group.id).map(group => group.id)
          );
      } else {
        this.database.prepare(`DELETE FROM ${SOUTH_ITEM_GROUPS_TABLE} WHERE south_id = ?;`).run(south.id);
      }
    });
    transaction();
  }

  start(id: string): void {
    const query = `UPDATE ${SOUTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(1, id);
  }

  stop(id: string): void {
    const query = `UPDATE ${SOUTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(0, id);
  }

  deleteSouth(id: string): void {
    const transaction = this.database.transaction(() => {
      this.database.prepare(`DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE source_south_south_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${SOUTH_CONNECTORS_TABLE} WHERE id = ?;`).run(id);
    });
    transaction();
  }

  /**
   * Deletes a south item group. Items that belonged to it keep working afterwards: any of their own
   * scan mode / history settings (overlap, max read interval, read delay) left empty is filled in with
   * the value the item was inheriting from the group.
   */
  deleteGroupAndUpdateItems(southId: string, group: SouthItemGroupEntity, applyHistorySettings: boolean): void {
    const items = this.findAllItemsForSouth(southId).filter(item => item.group?.id === group.id);
    const transaction = this.database.transaction(() => {
      for (const item of items) {
        if (!item.scanMode) {
          item.scanMode = group.scanMode;
        }
        if (applyHistorySettings) {
          if (item.overlap == null) {
            item.overlap = group.overlap;
          }
          if (item.maxReadInterval == null) {
            item.maxReadInterval = group.maxReadInterval;
          }
          if (item.readDelay == null) {
            item.readDelay = group.readDelay;
          }
        }
        item.syncWithGroup = false;
        item.group = null;
        this.saveItem(southId, item);
      }
      this.groupRepository.delete(group.id);
    });
    transaction();
  }

  listItems(
    southId: string,
    searchParams: Omit<SouthConnectorItemSearchParam, 'page'>
  ): Array<SouthConnectorItemEntity<SouthItemSettings>> {
    let whereClause = `WHERE si.connector_id = ?`;
    const queryParams = [southId];

    if (searchParams.scanModeId) {
      queryParams.push(searchParams.scanModeId);
      whereClause += ` AND si.scan_mode_id = ?`;
    }
    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND si.enabled = ?`;
    }
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND si.name like '%' || ? || '%'`;
    }
    const query = `${ITEM_JOIN_SELECT} ${ITEM_JOIN_FROM} ${whereClause};`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => toItemEntityFromJoinedRow(result as Record<string, string | number | null>));
  }

  searchItems(southId: string, searchParams: SouthConnectorItemSearchParam): Page<SouthConnectorItemEntity<SouthItemSettings>> {
    let whereClause = `WHERE si.connector_id = ?`;
    let countWhereClause = `WHERE connector_id = ?`;
    const queryParams = [southId];

    const page = searchParams.page;

    if (searchParams.scanModeId) {
      queryParams.push(searchParams.scanModeId);
      whereClause += ` AND si.scan_mode_id = ?`;
      countWhereClause += ` AND scan_mode_id = ?`;
    }
    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND si.enabled = ?`;
      countWhereClause += ` AND enabled = ?`;
    }
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND si.name like '%' || ? || '%'`;
      countWhereClause += ` AND name like '%' || ? || '%'`;
    }
    const query = `${ITEM_JOIN_SELECT} ${ITEM_JOIN_FROM} ${whereClause} LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => toItemEntityFromJoinedRow(result as Record<string, string | number | null>));
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${SOUTH_ITEMS_TABLE} ${countWhereClause}`).get(...queryParams) as {
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

  findAllItemsForSouth(southId: string): Array<SouthConnectorItemEntity<SouthItemSettings>> {
    const query = `${ITEM_JOIN_SELECT} ${ITEM_JOIN_FROM} WHERE si.connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map(result => toItemEntityFromJoinedRow(result as Record<string, string | number | null>));
  }

  findItemById(southConnectorId: string, itemId: string): SouthConnectorItemEntity<SouthItemSettings> | null {
    const query = `${ITEM_JOIN_SELECT} ${ITEM_JOIN_FROM} WHERE si.id = ? AND si.connector_id = ?;`;
    const result = this.database.prepare(query).get(itemId, southConnectorId);
    if (!result) return null;
    return toItemEntityFromJoinedRow(result as Record<string, string | number | null>);
  }

  saveItem(southConnectorId: string, southItem: SouthConnectorItemEntity<SouthItemSettings>): void {
    if (!southItem.id) {
      southItem.id = generateRandomId(6);
      const insertQuery =
        `INSERT INTO ${SOUTH_ITEMS_TABLE} (id, name, enabled, connector_id, scan_mode_id, settings, sync_with_group, max_read_interval, read_delay, overlap, created_by, updated_by, created_at, updated_at) ` +
        `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
      this.database
        .prepare(insertQuery)
        .run(
          southItem.id,
          southItem.name,
          +southItem.enabled,
          southConnectorId,
          southItem.scanMode?.id ?? null,
          JSON.stringify(southItem.settings),
          +southItem.syncWithGroup,
          southItem.maxReadInterval ?? null,
          southItem.readDelay ?? null,
          southItem.overlap ?? null,
          southItem.createdBy,
          southItem.updatedBy
        );
    } else {
      const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET name = ?, enabled = ?, scan_mode_id = ?, settings = ?, sync_with_group = ?, max_read_interval = ?, read_delay = ?, overlap = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`;
      this.database
        .prepare(query)
        .run(
          southItem.name,
          +southItem.enabled,
          southItem.scanMode?.id ?? null,
          JSON.stringify(southItem.settings),
          +southItem.syncWithGroup,
          southItem.maxReadInterval ?? null,
          southItem.readDelay ?? null,
          southItem.overlap ?? null,
          southItem.updatedBy,
          southItem.id
        );
    }

    this.database.prepare(`DELETE FROM ${GROUP_ITEMS_TABLE} WHERE item_id = ?;`).run(southItem.id);
    if (southItem.group) {
      const insertGroup = this.database.prepare(`INSERT INTO ${GROUP_ITEMS_TABLE} (group_id, item_id) VALUES (?, ?);`);
      insertGroup.run(southItem.group.id, southItem.id);
    }
  }

  saveAllItems(
    southConnectorId: string,
    southItems: Array<SouthConnectorItemEntity<SouthItemSettings>>,
    deleteItemsNotPresent: boolean
  ): void {
    const transaction = this.database.transaction(() => {
      if (deleteItemsNotPresent) {
        this.deleteAllItemsBySouth(southConnectorId);
      }
      for (const item of southItems) {
        this.saveItem(southConnectorId, item);
      }
    });
    transaction();
  }

  deleteItem(southId: string, id: string): void {
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
                     WHERE id IN (
                       SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE source_south_south_id = ?
                     ) AND item_id = ?;`
        )
        .run(southId, id);
      this.database.prepare(`DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ? AND id = ?;`).run(southId, id);
    });
    transaction();
  }

  deleteAllItemsBySouth(southId: string): void {
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
         WHERE id IN (
           SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE source_south_south_id = ?
         );`
        )
        .run(southId);
      this.database.prepare(`DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`).run(southId);
    });
    transaction();
  }

  enableItem(id: string): void {
    const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET enabled = 1 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  disableItem(id: string): void {
    const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET enabled = 0 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  moveItemsToGroup(itemIds: Array<string>, groupId: string | null): void {
    const placeholders = itemIds.map(() => '?').join(', ');
    const transaction = this.database.transaction(() => {
      // Remove items from all groups (enforcing single-group behavior for "Move to")
      this.database.prepare(`DELETE FROM ${GROUP_ITEMS_TABLE} WHERE item_id IN (${placeholders});`).run(...itemIds);

      if (groupId) {
        const insertGroup = this.database.prepare(`INSERT INTO ${GROUP_ITEMS_TABLE} (group_id, item_id) VALUES (?, ?);`);
        const setSyncWithGroup = this.database.prepare(`UPDATE ${SOUTH_ITEMS_TABLE} SET sync_with_group = 1 WHERE id = ?;`);
        for (const itemId of itemIds) {
          insertGroup.run(groupId, itemId);
          setSyncWithGroup.run(itemId);
        }
      } else {
        // When removing from group, reset sync_with_group to false
        this.database.prepare(`UPDATE ${SOUTH_ITEMS_TABLE} SET sync_with_group = 0 WHERE id IN (${placeholders});`).run(...itemIds);
      }
    });
    transaction();
  }

  findScanModeForSouth(scanModeId: string): ScanMode {
    const query = `SELECT id, name, description, cron, created_by, updated_by, created_at, updated_at FROM ${SCAN_MODE_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(scanModeId) as Record<string, string>;
    return toScanMode(result);
  }

  findGroupBySouthId(southId: string): Array<SouthItemGroupEntityLight> {
    const query =
      `SELECT g.id, g.created_at, g.updated_at, g.created_by, g.updated_by, g.name, ` +
      `g.scan_mode_id, g.overlap, g.max_read_interval, g.read_delay, s.id as scan_mode_id_full, ` +
      `s.name as scan_mode_name, s.description as scan_mode_description, s.cron as scan_mode_cron, ` +
      `s.created_at as scan_mode_created_at, s.updated_at as scan_mode_updated_at, s.created_by as scan_mode_created_by, s.updated_by as scan_mode_updated_by ` +
      `FROM ${SOUTH_ITEM_GROUPS_TABLE} g JOIN ${SCAN_MODE_TABLE} s ON g.scan_mode_id = s.id WHERE g.south_id = ? ORDER BY g.name;`;
    return this.database
      .prepare<[string], Record<string, string | number>>(query)
      .all(southId)
      .map(result => toSouthItemGroupLight(result));
  }

  private toSouthConnector(result: Record<string, string | number>): SouthConnectorEntity<SouthSettings, SouthItemSettings> {
    return {
      id: result.id as string,
      name: result.name as string,
      type: result.type as OIBusSouthType,
      description: result.description as string,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings as string) as SouthSettings,
      items: this.findAllItemsForSouth(result.id as string),
      groups: this.findGroupBySouthId(result.id as string),
      createdBy: result.created_by as string,
      updatedBy: result.updated_by as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string
    };
  }
}

/**
 * Converts a pre-joined query row (from ITEM_JOIN_SELECT + ITEM_JOIN_FROM) to a SouthConnectorItemEntity.
 * This is the single-trip replacement for the old N+1 toSouthConnectorItemEntity approach.
 */
export function toItemEntityFromJoinedRow(row: Record<string, string | number | null>): SouthConnectorItemEntity<SouthItemSettings> {
  const scanMode: ScanMode | null = row.sm_id
    ? {
        id: row.sm_id as string,
        name: row.sm_name as string,
        description: row.sm_description as string,
        cron: row.sm_cron as string,
        createdBy: row.sm_created_by as string,
        updatedBy: row.sm_updated_by as string,
        createdAt: row.sm_created_at as string,
        updatedAt: row.sm_updated_at as string
      }
    : null;

  const group: SouthItemGroupEntityLight | null = row.g_id
    ? {
        id: row.g_id as string,
        name: row.g_name as string,
        scanMode: {
          id: row.gsm_id as string,
          name: row.gsm_name as string,
          description: row.gsm_description as string,
          cron: row.gsm_cron as string,
          createdBy: row.gsm_created_by as string,
          updatedBy: row.gsm_updated_by as string,
          createdAt: row.gsm_created_at as string,
          updatedAt: row.gsm_updated_at as string
        },
        overlap: row.g_overlap !== null && row.g_overlap !== undefined ? Number(row.g_overlap) : null,
        maxReadInterval: row.g_max_read_interval !== null && row.g_max_read_interval !== undefined ? Number(row.g_max_read_interval) : null,
        readDelay: row.g_read_delay !== null && row.g_read_delay !== undefined ? Number(row.g_read_delay) : null,
        createdBy: row.g_created_by as string,
        updatedBy: row.g_updated_by as string,
        createdAt: row.g_created_at as string,
        updatedAt: row.g_updated_at as string
      }
    : null;

  return {
    id: row.id as string,
    name: row.name as string,
    enabled: Boolean(row.enabled),
    scanMode,
    settings: JSON.parse(row.settings as string) as SouthItemSettings,
    group,
    syncWithGroup: Boolean(row.sync_with_group),
    maxReadInterval: row.max_read_interval !== null && row.max_read_interval !== undefined ? Number(row.max_read_interval) : null,
    readDelay: row.read_delay !== null && row.read_delay !== undefined ? Number(row.read_delay) : null,
    overlap: row.overlap !== null && row.overlap !== undefined ? Number(row.overlap) : null,
    createdBy: row.created_by as string,
    updatedBy: row.updated_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}

export const toSouthConnectorLight = (result: Record<string, string>): SouthConnectorEntityLight => {
  return {
    id: result.id,
    name: result.name,
    type: result.type as OIBusSouthType,
    description: result.description,
    enabled: Boolean(result.enabled),
    createdBy: result.created_by,
    updatedBy: result.updated_by,
    createdAt: result.created_at,
    updatedAt: result.updated_at
  };
};

export const toSouthItemGroupLight = (result: Record<string, string | number>): SouthItemGroupEntityLight => {
  const scanMode: ScanMode = {
    id: result.scan_mode_id_full as string,
    name: result.scan_mode_name as string,
    description: result.scan_mode_description as string,
    cron: result.scan_mode_cron as string,
    createdBy: result.scan_mode_created_by as string,
    updatedBy: result.scan_mode_updated_by as string,
    createdAt: result.scan_mode_created_at as string,
    updatedAt: result.scan_mode_updated_at as string
  };
  return {
    id: result.id as string,
    name: result.name as string,
    scanMode,
    overlap: result.overlap !== null && result.overlap !== undefined ? (result.overlap as number) : null,
    maxReadInterval:
      result.max_read_interval !== null && result.max_read_interval !== undefined ? (result.max_read_interval as number) : null,
    readDelay: (result.read_delay as number) || 0,
    createdBy: result.created_by as string,
    updatedBy: result.updated_by as string,
    createdAt: result.created_at as string,
    updatedAt: result.updated_at as string
  };
};
