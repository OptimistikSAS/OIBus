import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import {
  SouthConnectorEntity,
  SouthConnectorEntityLight,
  SouthConnectorItemEntity,
  SouthItemGroupEntity
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
const SCAN_MODE = 'scan_modes';
const PAGE_SIZE = 50;

export default class SouthConnectorRepository {
  private groupRepository: SouthItemGroupRepository;

  constructor(private readonly database: Database) {
    this.groupRepository = new SouthItemGroupRepository(database);
  }

  findAllSouth(): Array<SouthConnectorEntityLight> {
    const query = `SELECT id, name, type, description, enabled FROM ${SOUTH_CONNECTORS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => toSouthConnectorLight(result as Record<string, string>));
  }

  findSouthById(id: string): SouthConnectorEntity<SouthSettings, SouthItemSettings> | null {
    const query = `
        SELECT id, name, type, description, enabled, settings
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
        const insertQuery = `INSERT INTO ${SOUTH_CONNECTORS_TABLE} (id, name, type, description, enabled, settings) VALUES (?, ?, ?, ?, ?, ?);`;
        this.database
          .prepare(insertQuery)
          .run(south.id, south.name, south.type, south.description, +south.enabled, JSON.stringify(south.settings));
      } else {
        const query = `UPDATE ${SOUTH_CONNECTORS_TABLE} SET name = ?, description = ?, enabled = ?, settings = ? WHERE id = ?;`;
        this.database.prepare(query).run(south.name, south.description, +south.enabled, JSON.stringify(south.settings), south.id);
      }

      if (south.items.length > 0) {
        this.database
          .prepare(
            `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
                     WHERE id IN (
                       SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE south_id = ?
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
          `INSERT INTO ${SOUTH_ITEMS_TABLE} (id, name, enabled, connector_id, scan_mode_id, settings) VALUES (?, ?, ?, ?, ?, ?);`
        );
        const update = this.database.prepare(
          `UPDATE ${SOUTH_ITEMS_TABLE} SET name = ?, enabled = ?, scan_mode_id = ?, settings = ? WHERE id = ?;`
        );
        const insertGroup = this.database.prepare(`INSERT INTO group_items (group_id, item_id) VALUES (?, ?);`);
        const deleteGroups = this.database.prepare(`DELETE FROM group_items WHERE item_id = ?;`);

        for (const item of south.items) {
          if (!item.id) {
            item.id = generateRandomId(6);
            insert.run(item.id, item.name, +item.enabled, south.id, item.scanMode.id, JSON.stringify(item.settings));
          } else {
            update.run(item.name, +item.enabled, item.scanMode.id, JSON.stringify(item.settings), item.id);
          }
          // Update groups
          deleteGroups.run(item.id);
          if (item.groups && item.groups.length > 0) {
            for (const group of item.groups) {
              insertGroup.run(group.id, item.id);
            }
          }
        }
      } else {
        this.database
          .prepare(
            `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
                     WHERE id IN (
                       SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE south_id = ?
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
      this.database
        .prepare(
          `DELETE FROM ${NORTH_TRANSFORMERS_ITEMS_TABLE}
         WHERE id IN (
           SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE south_id = ?
         );`
        )
        .run(id);
      this.database.prepare(`DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE south_id = ?;`).run(id);
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
    const query = `SELECT id, name, enabled, scan_mode_id, settings FROM ${SOUTH_ITEMS_TABLE} ${whereClause};`;

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
      `SELECT id, name, enabled, scan_mode_id, settings FROM ${SOUTH_ITEMS_TABLE} ${whereClause}` +
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
    const query = `SELECT id, name, enabled, scan_mode_id, settings FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map(result => this.toSouthConnectorItemEntity(result as Record<string, string>));
  }

  findItemById(southConnectorId: string, itemId: string): SouthConnectorItemEntity<SouthItemSettings> | null {
    const query = `SELECT id, name, enabled, scan_mode_id, settings FROM ${SOUTH_ITEMS_TABLE} WHERE id = ? AND connector_id = ?;`;
    const result = this.database.prepare(query).get(itemId, southConnectorId);
    if (!result) return null;
    return this.toSouthConnectorItemEntity(result as Record<string, string>);
  }

  saveItem(southConnectorId: string, southItem: SouthConnectorItemEntity<SouthItemSettings>): void {
    if (!southItem.id) {
      southItem.id = generateRandomId(6);
      const insertQuery =
        `INSERT INTO ${SOUTH_ITEMS_TABLE} (id, name, enabled, connector_id, scan_mode_id, settings) ` + `VALUES (?, ?, ?, ?, ?, ?);`;
      this.database
        .prepare(insertQuery)
        .run(southItem.id, southItem.name, +southItem.enabled, southConnectorId, southItem.scanMode.id, JSON.stringify(southItem.settings));
    } else {
      const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET name = ?, enabled = ?, scan_mode_id = ?, settings = ? WHERE id = ?;`;
      this.database
        .prepare(query)
        .run(southItem.name, +southItem.enabled, southItem.scanMode.id, JSON.stringify(southItem.settings), southItem.id);
    }

    // Update groups
    this.database.prepare(`DELETE FROM group_items WHERE item_id = ?;`).run(southItem.id);
    if (southItem.groups && southItem.groups.length > 0) {
      const insertGroup = this.database.prepare(`INSERT INTO group_items (group_id, item_id) VALUES (?, ?);`);
      for (const group of southItem.groups) {
        insertGroup.run(group.id, southItem.id);
      }
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
                       SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE south_id = ?
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
           SELECT id FROM ${NORTH_TRANSFORMERS_TABLE} WHERE south_id = ?
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
      this.database.prepare(`DELETE FROM group_items WHERE item_id IN (${placeholders});`).run(...itemIds);

      if (groupId) {
        const insertGroup = this.database.prepare(`INSERT INTO group_items (group_id, item_id) VALUES (?, ?);`);
        for (const itemId of itemIds) {
          insertGroup.run(groupId, itemId);
        }
      }
    });
    transaction();
  }

  findScanModeForSouth(scanModeId: string): ScanMode {
    const query = `SELECT id, name, description, cron FROM ${SCAN_MODE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(scanModeId) as Record<string, string>;
    return toScanMode(result);
  }

  private findGroupsForItem(itemId: string) {
    const query = `SELECT group_id FROM group_items WHERE item_id = ?;`;
    const results = this.database.prepare(query).all(itemId) as Array<{ group_id: string }>;
    return results.map(r => this.groupRepository.findById(r.group_id)).filter((item): item is SouthItemGroupEntity => item !== null);
  }

  private toSouthConnectorItemEntity(result: Record<string, string>): SouthConnectorItemEntity<SouthItemSettings> {
    return {
      id: result.id,
      name: result.name,
      enabled: Boolean(result.enabled),
      scanMode: this.findScanModeForSouth(result.scan_mode_id as string),
      settings: JSON.parse(result.settings) as SouthItemSettings,
      groups: this.findGroupsForItem(result.id)
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
      items: this.findAllItemsForSouth(result.id as string)
    };
  }
}

export const toSouthConnectorLight = (result: Record<string, string>): SouthConnectorEntityLight => {
  return {
    id: result.id,
    name: result.name,
    type: result.type as OIBusSouthType,
    description: result.description,
    enabled: Boolean(result.enabled)
  };
};
