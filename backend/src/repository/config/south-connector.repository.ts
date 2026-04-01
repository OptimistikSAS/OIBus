import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { SouthConnectorEntity, SouthConnectorEntityLight, SouthConnectorItemEntity } from '../../model/south-connector.model';
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
const PAGE_SIZE = 50;

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
              item.scanMode.id,
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
              item.scanMode.id,
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

  listItems(
    southId: string,
    searchParams: Omit<SouthConnectorItemSearchParam, 'page'>
  ): Array<SouthConnectorItemEntity<SouthItemSettings>> {
    let whereClause = `WHERE connector_id = ?`;
    const queryParams = [southId];

    if (searchParams.scanModeId) {
      queryParams.push(searchParams.scanModeId);
      whereClause += ` AND scan_mode_id = ?`;
    }
    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND enabled = ?`;
    }
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }
    const query = `SELECT id, name, enabled, scan_mode_id, settings, sync_with_group, max_read_interval, read_delay, overlap, created_by, updated_by, created_at, updated_at FROM ${SOUTH_ITEMS_TABLE} ${whereClause};`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toSouthConnectorItemEntity(result as Record<string, string>));
  }

  searchItems(southId: string, searchParams: SouthConnectorItemSearchParam): Page<SouthConnectorItemEntity<SouthItemSettings>> {
    let whereClause = `WHERE connector_id = ?`;
    const queryParams = [southId];

    const page = searchParams.page;

    if (searchParams.scanModeId) {
      queryParams.push(searchParams.scanModeId);
      whereClause += ` AND scan_mode_id = ?`;
    }
    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND enabled = ?`;
    }
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }
    const query =
      `SELECT id, name, enabled, scan_mode_id, settings, sync_with_group, max_read_interval, read_delay, overlap, created_by, updated_by, created_at, updated_at FROM ${SOUTH_ITEMS_TABLE} ${whereClause}` +
      ` LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toSouthConnectorItemEntity(result as Record<string, string>));
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${SOUTH_ITEMS_TABLE} ${whereClause}`).get(...queryParams) as { count: number }
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
    const query = `SELECT id, name, enabled, scan_mode_id, settings, sync_with_group, max_read_interval, read_delay, overlap, created_by, updated_by, created_at, updated_at FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map(result => this.toSouthConnectorItemEntity(result as Record<string, string>));
  }

  findItemById(southConnectorId: string, itemId: string): SouthConnectorItemEntity<SouthItemSettings> | null {
    const query = `SELECT id, name, enabled, scan_mode_id, settings, sync_with_group, max_read_interval, read_delay, overlap, created_by, updated_by, created_at, updated_at FROM ${SOUTH_ITEMS_TABLE} WHERE id = ? AND connector_id = ?;`;
    const result = this.database.prepare(query).get(itemId, southConnectorId);
    if (!result) return null;
    return this.toSouthConnectorItemEntity(result as Record<string, string>);
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
          southItem.scanMode.id,
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
          southItem.scanMode.id,
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

  private findGroupForItem(itemId: string) {
    const query = `SELECT group_id FROM ${GROUP_ITEMS_TABLE} WHERE item_id = ?;`;
    const result = this.database.prepare(query).get(itemId) as { group_id: string } | null;
    if (!result) return null;
    return this.groupRepository.findById(result.group_id);
  }

  private toSouthConnectorItemEntity(result: Record<string, string>): SouthConnectorItemEntity<SouthItemSettings> {
    return {
      id: result.id,
      name: result.name,
      enabled: Boolean(result.enabled),
      scanMode: this.findScanModeForSouth(result.scan_mode_id as string),
      settings: JSON.parse(result.settings) as SouthItemSettings,
      group: this.findGroupForItem(result.id),
      syncWithGroup: Boolean(result.sync_with_group),
      maxReadInterval:
        result.max_read_interval !== null && result.max_read_interval !== undefined ? Number(result.max_read_interval) : null,
      readDelay: result.read_delay !== null && result.read_delay !== undefined ? Number(result.read_delay) : null,
      overlap: result.overlap !== null && result.overlap !== undefined ? Number(result.overlap) : null,
      createdBy: result.created_by,
      updatedBy: result.updated_by,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
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
      createdBy: result.created_by as string,
      updatedBy: result.updated_by as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string
    };
  }
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
